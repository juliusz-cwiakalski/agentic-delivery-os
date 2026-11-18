/**
 * TC-CLI-005 / TC-PARITY-006 — one route table replayed through both
 * transports, with the mock tier's network and child-process guards armed.
 *
 * The table is exactly the operations whose client members exist after plan
 * phase 1: the delivered reads, delivered thread resolution, and the landing
 * member. The comment-write and content-write routes join the SAME table and
 * the SAME suite in plan phase 3, when those members exist.
 */
import { describe, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import {
  createGithubCliTransport,
  type GithubChildRunner,
} from "../../packages/adapters/src/github/cli-transport";
import { createGitHubClient, type GithubClient } from "../../packages/adapters/src/github/client";
import type {
  ProviderRequest,
  ProviderTransport,
} from "../../packages/adapters/src/io/provider-transport";
import {
  installChildProcessGuard,
  installThrowingFetchGuard,
  isRecord,
  readJson,
} from "../behaviour/providers/support";
import { fixtureBrand } from "../fixtures/credentials/cases";

const ROUTES = "tests/fixtures/providers/github/transport-parity-routes.json";
const BASE_URL = "https://api.github.example.com";

type RouteRequest = {
  readonly method: ProviderRequest["method"];
  readonly path: string;
  readonly status: number;
  readonly body: unknown;
};

type Route = {
  readonly name: string;
  readonly member: string;
  readonly argument: unknown;
  readonly requests: readonly RouteRequest[];
};

const routes = (): readonly Route[] => {
  const parsed = readJson(ROUTES);
  const list = (parsed as { readonly routes?: unknown }).routes;
  if (!Array.isArray(list)) throw new Error("transport-parity fixture has no routes");
  return list
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const requests = Array.isArray(entry.requests) ? entry.requests : [];
      return {
        name: String(entry.name),
        member: String(entry.member),
        argument: entry.argument,
        requests: requests
          .filter((request): request is Record<string, unknown> => isRecord(request))
          .map((request) => ({
            method: String(request.method) as ProviderRequest["method"],
            path: String(request.path),
            status: Number(request.status),
            body: request.body,
          })),
      };
    });
};

const instance = {
  instanceName: "github",
  systemKind: "vcs" as const,
  baseUrl: BASE_URL,
  authMethod: { mechanism: "anonymous" as const },
};

const credentials = createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand });

/** The API transport: exact method+path matching, one recorded request list. */
const apiTransportFor = (
  route: Route,
): ProviderTransport & {
  readonly requests: readonly ProviderRequest[];
} => {
  const requests: ProviderRequest[] = [];
  return {
    requests,
    send: async (request) => {
      requests.push(request);
      const match = route.requests.find(
        (candidate) =>
          candidate.method === request.method && request.url === `${BASE_URL}${candidate.path}`,
      );
      if (match === undefined) {
        throw new Error(`unfixtured API request ${request.method} ${request.url}`);
      }
      return { status: match.status, body: match.body };
    },
  };
};

const statusBlockFor = (request: ProviderRequest, route: Route): string => {
  const path = request.url.startsWith(BASE_URL) ? request.url.slice(BASE_URL.length) : request.url;
  const match = route.requests.find(
    (candidate) => candidate.method === request.method && candidate.path === path,
  );
  if (match === undefined) {
    throw new Error(`unfixtured CLI request ${request.method} ${path}`);
  }
  return `HTTP/2.0 ${match.status} OK\ncontent-type: application/json\n\n${JSON.stringify(match.body)}\n`;
};

const cliRunnerFor = (
  route: Route,
): { readonly runner: GithubChildRunner; readonly calls: readonly string[] } => {
  const calls: string[] = [];
  const runner: GithubChildRunner = async (_file, args) => {
    calls.push(args.join(" "));
    const request: ProviderRequest = {
      url: `${BASE_URL}${args[1] ?? ""}`,
      method: (args[3] ?? "GET") as ProviderRequest["method"],
      headers: {},
    };
    return {
      stdout: statusBlockFor(request, route),
      stderr: "",
      status: 0,
      timedOut: false,
    };
  };
  return { runner, calls };
};

const invoke = async (
  client: GithubClient,
  member: string,
  argument: unknown,
): Promise<unknown> => {
  switch (member) {
    case "readWorkItem":
      return await client.readWorkItem(argument as number);
    case "writeWorkItem":
      return await client.writeWorkItem(argument as Parameters<GithubClient["writeWorkItem"]>[0]);
    case "writeComment":
      return await client.writeComment(argument as Parameters<GithubClient["writeComment"]>[0]);
    case "writeDeliveryRequest":
      return await client.writeDeliveryRequest(
        argument as Parameters<GithubClient["writeDeliveryRequest"]>[0],
      );
    case "transitionWorkItem":
      return await client.transitionWorkItem(
        argument as Parameters<GithubClient["transitionWorkItem"]>[0],
      );
    case "readDeliveryRequest":
      return await client.readDeliveryRequest(argument as number);
    case "readPipelineRun":
      return await client.readPipelineRun(argument as string);
    case "resolveDeliveryThread":
      return await client.resolveDeliveryThread(
        argument as Parameters<GithubClient["resolveDeliveryThread"]>[0],
      );
    case "mergeDeliveryRequest":
      return await client.mergeDeliveryRequest(
        argument as Parameters<GithubClient["mergeDeliveryRequest"]>[0],
      );
    default:
      throw new Error(`route names no known client member: ${member}`);
  }
};

describe("TC-CLI-005 both transports produce identical views and failures", () => {
  for (const route of routes()) {
    test(`${route.name} is deep-equal across the API and CLI transports`, async () => {
      const apiTransport = apiTransportFor(route);
      const apiClient = createGitHubClient({
        instance,
        credentials,
        repository: { owner: "group-placeholder", name: "project-placeholder" },
        transport: apiTransport,
      });
      const cli = cliRunnerFor(route);
      const cliClient = createGitHubClient({
        instance,
        credentials,
        repository: { owner: "group-placeholder", name: "project-placeholder" },
        transport: createGithubCliTransport({
          runner: cli.runner,
          environment: { PATH: "/opt/example/bin", TMPDIR: "/tmp/example-tmp" },
        }),
      });
      const viaApi = await invoke(apiClient, route.member, route.argument);
      const viaCli = await invoke(cliClient, route.member, route.argument);
      expect(viaCli).toEqual(viaApi);
      expect(apiTransport.requests).toHaveLength(route.requests.length);
      expect(cli.calls).toHaveLength(route.requests.length);
    });
  }

  test("the route table covers the operations whose members exist after the backlog phase", async () => {
    const members = routes().map((route) => route.name);
    expect(members).toEqual([
      "read-work-item",
      "write-work-item",
      "transition-work-item",
      "read-delivery-request",
      "read-pipeline-run",
      "resolve-delivery-thread",
      "merge-delivery-request",
      "write-comment",
      "write-delivery-request-create",
      "write-delivery-request-update",
    ]);
  });
});

describe("TC-PARITY-006 zero network and zero live child processes", () => {
  test("the whole mock tier records zero fetch calls and zero spawns", async () => {
    const network = installThrowingFetchGuard();
    const child = installChildProcessGuard();
    try {
      for (const route of routes()) {
        const cli = cliRunnerFor(route);
        const client = createGitHubClient({
          instance,
          credentials,
          repository: { owner: "group-placeholder", name: "project-placeholder" },
          transport: createGithubCliTransport({
            runner: cli.runner,
            environment: { PATH: "/opt/example/bin", TMPDIR: "/tmp/example-tmp" },
          }),
        });
        await invoke(client, route.member, route.argument);
      }
      expect(network.calls).toHaveLength(0);
      expect(child.calls).toEqual([]);
    } finally {
      child.restore();
      network.restore();
    }
  });

  test("the child-process guard is armed: a live spawn throws naming the call", () => {
    const guard = installChildProcessGuard();
    try {
      expect(() => execFile("gh", ["--version"], () => undefined)).toThrow(
        /must not spawn a live child process \(execFile\)/u,
      );
      expect(guard.calls).toEqual(["execFile"]);
    } finally {
      guard.restore();
    }
  });
});
