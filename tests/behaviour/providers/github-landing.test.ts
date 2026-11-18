/**
 * TC-LAND-001..008 — the provider-side squash landing (F-3, DM-1, AC-F3-1..5).
 *
 * Every case replays a committed sanitized fixture through the production
 * client over an injected transport: one landing request, never retried, no
 * per-request failover, and already-merged success only after a read-back that
 * observes provider-asserted merged truth.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import { GITHUB_ADAPTER_CONTRACT } from "../../../packages/adapters/src/github/capabilities";
import {
  createGitHubClient,
  type GithubClient,
} from "../../../packages/adapters/src/github/client";
import {
  ADAPTER_OPERATIONS,
  type ExternalSystemInstance,
  type MergeDeliveryRequestOutcome,
} from "../../../packages/core/src/contracts/index";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import {
  createFixtureTransport,
  type FixtureRoute,
  isRecord,
  type RecordingTransport,
  readJson,
  recordField,
} from "./support";

const FIXTURE = "tests/fixtures/providers/github/landing-responses.json";
const HEAD_SHA = "1111111111111111111111111111111111111111";

const instance: ExternalSystemInstance = {
  instanceName: "github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "github-landing",
      sourceKey: { style: "literal", name: "FIXTURE_GITHUB_TOKEN" },
    },
  },
};

const credentials = createEnvironmentCredentialPort({
  environment: { FIXTURE_GITHUB_TOKEN: "canary-landing-token" },
  brand: fixtureBrand,
});

const pullUrl =
  "https://api.github.example.com/repos/group-placeholder/project-placeholder/pulls/504";
const mergeUrl = `${pullUrl}/merge`;

const landingCase = (name: string): Record<string, unknown> => recordField(readJson(FIXTURE), name);

const routesFor = (name: string): FixtureRoute[] => {
  const fixture = landingCase(name);
  const routes: FixtureRoute[] = [
    { method: "PUT", url: mergeUrl, status: fixture.status as number, body: fixture.body },
  ];
  if (isRecord(fixture.readBack)) {
    routes.push({ method: "GET", url: pullUrl, body: fixture.readBack });
  }
  return routes;
};

const clientFor = (
  routes: readonly FixtureRoute[],
): {
  readonly client: GithubClient;
  readonly transport: RecordingTransport;
} => {
  const transport = createFixtureTransport(routes);
  return {
    client: createGitHubClient({
      instance,
      credentials,
      repository: { owner: "group-placeholder", name: "project-placeholder" },
      transport,
    }),
    transport,
  };
};

const landingInput = (expectedHeadSha?: string) => ({
  deliveryRequest: { systemName: "github", entityId: "504" },
  strategy: "squash" as const,
  commitTitle: "feat(GH-338): crafted squash title",
  commitMessage: "Crafted squash message\n\nWith a body.",
  ...(expectedHeadSha === undefined ? {} : { expectedHeadSha }),
});

const mergeRequests = (transport: RecordingTransport): number =>
  transport.requests.filter((request) => request.method === "PUT" && request.url === mergeUrl)
    .length;

const readBackRequests = (transport: RecordingTransport): number =>
  transport.requests.filter((request) => request.method === "GET" && request.url === pullUrl)
    .length;

const parsedBody = (body: string | undefined): Record<string, unknown> => {
  if (body === undefined) throw new Error("expected a serialized request body");
  const parsed: unknown = JSON.parse(body);
  if (!isRecord(parsed)) throw new Error("expected a JSON object request body");
  return parsed;
};

describe("TC-LAND-001 the ninth operation exists with squash-only arguments", () => {
  test("merge-delivery-request appends to the closed set and is supported by GitHub", () => {
    expect([...ADAPTER_OPERATIONS]).toHaveLength(9);
    expect(ADAPTER_OPERATIONS[7]).toBe("resolve-delivery-thread");
    expect(ADAPTER_OPERATIONS[8]).toBe("merge-delivery-request");
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations).toContain(
      "merge-delivery-request",
    );
    expect(
      GITHUB_ADAPTER_CONTRACT.capabilities.declaredGaps.map((gap) => gap.operation),
    ).not.toContain("merge-delivery-request");
  });
});

describe("TC-LAND-002 crafted metadata is verbatim and the identity is presence-honest", () => {
  test("title and message are transmitted byte-identically and the provider sha is returned", async () => {
    const { client, transport } = clientFor(routesFor("landedWithSha"));
    const result = await client.mergeDeliveryRequest(landingInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value: MergeDeliveryRequestOutcome = result.value;
    expect(value.merged).toBe(true);
    expect(value.mergeCommitSha).toBe("4444444444444444444444444444444444444444");
    const landing = transport.requests.find((request) => request.method === "PUT");
    const body = parsedBody(landing?.body);
    expect(body.merge_method).toBe("squash");
    expect(body.commit_title).toBe("feat(GH-338): crafted squash title");
    expect(body.commit_message).toBe("Crafted squash message\n\nWith a body.");
    expect(mergeRequests(transport)).toBe(1);
  });

  test("an omitted provider identity stays absent, never null and never derived", async () => {
    const { client } = clientFor(routesFor("landedWithoutSha"));
    const result = await client.mergeDeliveryRequest(landingInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.hasOwn(result.value, "mergeCommitSha")).toBe(false);
  });
});

describe("TC-LAND-003 an expected-head mismatch refuses and lands nothing", () => {
  test("the guard is transmitted and a mismatch is a classified refusal with one request", async () => {
    const { client, transport } = clientFor(routesFor("headMismatch"));
    const result = await client.mergeDeliveryRequest(landingInput(HEAD_SHA));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider.payload.invalid");
    expect(result.httpStatus).toBe(409);
    const landing = transport.requests.find((request) => request.method === "PUT");
    expect(parsedBody(landing?.body).sha).toBe(HEAD_SHA);
    expect(mergeRequests(transport)).toBe(1);
    expect(transport.requests).toHaveLength(1);
  });
});

describe("TC-LAND-004 already-merged is success only after merged-truth read-back", () => {
  test("a merged read-back yields success with the provider landing identity", async () => {
    const { client, transport } = clientFor(routesFor("alreadyMergedThenMergedTrue"));
    const result = await client.mergeDeliveryRequest(landingInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mergeCommitSha).toBe("5555555555555555555555555555555555555555");
    expect(mergeRequests(transport)).toBe(1);
    expect(readBackRequests(transport)).toBe(1);
    expect(transport.requests).toHaveLength(2);
  });

  test("an unmerged read-back leaves the classified failure standing", async () => {
    const { client, transport } = clientFor(routesFor("alreadyMergedThenMergedFalse"));
    const result = await client.mergeDeliveryRequest(landingInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider.payload.invalid");
    expect(result.httpStatus).toBe(405);
    expect(Object.hasOwn(result, "value")).toBe(false);
    expect(mergeRequests(transport)).toBe(1);
    expect(transport.requests).toHaveLength(2);
  });
});

describe("TC-LAND-005 a refusal alone is never success", () => {
  test("prose that mentions an already-merged request does not decide the outcome", async () => {
    const { client, transport } = clientFor(routesFor("refusalWithoutMergedTruth"));
    const result = await client.mergeDeliveryRequest(landingInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider.payload.invalid");
    expect(result.httpStatus).toBe(409);
    expect(mergeRequests(transport)).toBe(1);
  });
});

describe("TC-LAND-006 a non-2xx landing is classified and never retried", () => {
  for (const [name, status] of [
    ["unprocessable", 422],
    ["serverError", 500],
    ["forbidden", 403],
  ] as const) {
    test(`${name} is provider.payload.invalid with the structured status and one request`, async () => {
      const { client, transport } = clientFor(routesFor(name));
      const result = await client.mergeDeliveryRequest(landingInput());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("provider.payload.invalid");
      expect(result.httpStatus).toBe(status);
      expect(mergeRequests(transport)).toBe(1);
      expect(transport.requests).toHaveLength(1);
    });
  }
});

describe("TC-LAND-007 a transport failure is classified, status-absent and not retried", () => {
  test("a thrown transport failure has no status and issues exactly one attempt", async () => {
    let attempts = 0;
    const client = createGitHubClient({
      instance,
      credentials,
      repository: { owner: "group-placeholder", name: "project-placeholder" },
      transport: {
        send: async () => {
          attempts += 1;
          throw new Error("socket closed");
        },
      },
    });
    const result = await client.mergeDeliveryRequest(landingInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider.payload.invalid");
    expect(Object.hasOwn(result, "httpStatus")).toBe(false);
    expect(attempts).toBe(1);
  });
});

describe("TC-LAND-008 the content write never lands", () => {
  test("write-delivery-request stays a declared gap with no landing member", () => {
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.declaredGaps.map((gap) => gap.operation)).toContain(
      "write-delivery-request",
    );
    const { client } = clientFor([]);
    expect(Object.keys(client)).not.toContain("writeDeliveryRequest");
  });
});
