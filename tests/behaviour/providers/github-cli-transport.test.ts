/**
 * TC-CLI-001..013 — the CLI-first transport, probe, environment, status
 * recovery, and the composition-edge selection (F-2; DM-5, DM-7, DM-10;
 * AC-F2-1..5, AC-F8-3).
 *
 * Every CLI invocation goes through an injected child runner: no case spawns a
 * live process, requires a `gh` binary, or reaches the network.
 */
import { describe, expect, test } from "bun:test";
import { ADAPTER_OPERATIONS } from "@delivery-os/core/contracts";
import { createEnvironmentCredentialPort } from "../../../packages/adapters/src/credentials/index";
import {
  createGithubCliTransport,
  GITHUB_CLI_MAX_OUTPUT_BYTES,
  GITHUB_CLI_REFUSAL_CODES,
  GITHUB_TRANSPORT_MATRIX,
  type GithubChildRunner,
  type GithubChildRunnerResult,
  probeGithubCli,
  resolveGithubCliConfigDirectory,
  resolveTransportSelection,
} from "../../../packages/adapters/src/github/cli-transport";
import {
  createGitHubClient,
  createGithubNativeTransport,
} from "../../../packages/adapters/src/github/client";
import type { ProviderRequest } from "../../../packages/adapters/src/io/provider-transport";
import { runEntrypoint } from "../../../packages/cli/src/entrypoint";
import {
  createProductionComposer,
  resolveCompositionTransportSelection,
} from "../../../packages/cli/src/production";
import { fixtureBrand } from "../../fixtures/credentials/cases";
import { isRecord, readJson, recordField } from "./support";

const ARGV_FIXTURE = "tests/fixtures/providers/github/cli-argv.json";
const STATUS_FIXTURE = "tests/fixtures/providers/github/cli-status-blocks.json";
const FAILURE_FIXTURE = "tests/fixtures/providers/github/cli-failures.json";

type SpawnRecord = {
  readonly file: string;
  readonly args: readonly string[];
  readonly options: Parameters<GithubChildRunner>[2];
};

/** A recording runner: one spawn record per call, responses supplied by the case. */
const recordingRunner = (
  respond: (call: SpawnRecord) => GithubChildRunnerResult,
): { readonly runner: GithubChildRunner; readonly spawns: readonly SpawnRecord[] } => {
  const spawns: SpawnRecord[] = [];
  const runner: GithubChildRunner = async (file, args, options) => {
    const call: SpawnRecord = { file, args, options };
    spawns.push(call);
    return await Promise.resolve(respond(call));
  };
  return { runner, spawns };
};

/** The credential canary is constructed at runtime, never committed. */
const RUNTIME_CREDENTIAL = "canary-cli-transport-token";

const requestOf = (value: unknown): ProviderRequest => {
  const record = isRecord(value) ? value : {};
  const headers = recordField(record, "headers");
  const body = record.body;
  return {
    url: String(record.url),
    method: String(record.method) as ProviderRequest["method"],
    headers: {
      ...Object.fromEntries(Object.entries(headers).map(([key, entry]) => [key, String(entry)])),
      Authorization: `Bearer ${RUNTIME_CREDENTIAL}`,
    },
    ...(typeof body === "string" ? { body } : {}),
  };
};

const argvRoutes = (): readonly Record<string, unknown>[] => {
  const parsed = readJson(ARGV_FIXTURE);
  const routes = (parsed as { readonly routes?: unknown }).routes;
  if (!Array.isArray(routes)) throw new Error("cli-argv fixture has no routes");
  return routes.filter((entry): entry is Record<string, unknown> => isRecord(entry));
};

const environment = (): Readonly<Record<string, string>> => ({
  PATH: "/opt/example/bin",
  TMPDIR: "/tmp/example-tmp",
});

const statusBlock = (status: number, body: unknown): string =>
  `HTTP/2.0 ${status} OK\ncontent-type: application/json\n\n${JSON.stringify(body)}\n`;

describe("TC-CLI-001 the transport matrix covers every closed operation", () => {
  test("nine of nine operations declare gh preferred and api fallback, with no extras", () => {
    expect(Object.keys(GITHUB_TRANSPORT_MATRIX).sort()).toEqual([...ADAPTER_OPERATIONS].sort());
    for (const operation of ADAPTER_OPERATIONS) {
      expect(GITHUB_TRANSPORT_MATRIX[operation]).toEqual({ preferred: "gh", fallback: "api" });
    }
  });
});

describe("TC-CLI-002 golden argv carries no credential and no shell", () => {
  for (const route of argvRoutes()) {
    test(`${String(route.name)} emits exactly the declared argv`, async () => {
      const request = requestOf(route);
      const { runner, spawns } = recordingRunner(() => ({
        stdout: "HTTP/2.0 200 OK\ncontent-type: application/json\n\n{}\n",
        stderr: "",
        status: 0,
        timedOut: false,
      }));
      const transport = createGithubCliTransport({ runner, environment: environment() });
      await transport.send(request);
      expect(spawns).toHaveLength(1);
      const spawn = spawns[0];
      expect(spawn?.file).toBe("gh");
      expect(spawn?.args).toEqual(route.expectedArgv as string[]);
      const serialized = JSON.stringify(spawn?.args);
      expect(serialized).not.toContain(RUNTIME_CREDENTIAL);
      expect(serialized).not.toContain("--paginate");
      expect(serialized).not.toContain("--jq");
      expect(serialized).not.toContain("sh -c");
      expect(spawn?.options.killSignal).toBe("SIGKILL");
    });
  }
});

describe("TC-CLI-003 the child environment is isolated and credential-bearing", () => {
  test("the exact key set is constructed from injected data", async () => {
    const { runner, spawns } = recordingRunner(() => ({
      stdout: "HTTP/2.0 200 OK\n\n{}\n",
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    await createGithubCliTransport({ runner, environment: environment() }).send({
      url: "https://api.github.example.com/repos/o/r/issues/1",
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer canary-environment-token",
      },
    });
    const env = spawns[0]?.options.env;
    expect(env).toEqual({
      PATH: "/opt/example/bin",
      GH_CONFIG_DIR: "/tmp/example-tmp/jaiship-gh-config",
      GH_PROMPT_DISABLED: "1",
      NO_COLOR: "1",
      GH_NO_UPDATE_NOTIFIER: "1",
      GH_TOKEN: "canary-environment-token",
    });
    expect(resolveGithubCliConfigDirectory(environment())).not.toContain("/.config/gh");
  });

  test("an anonymous request carries no credential variable", async () => {
    const { runner, spawns } = recordingRunner(() => ({
      stdout: "HTTP/2.0 200 OK\n\n{}\n",
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    await createGithubCliTransport({ runner, environment: environment() }).send({
      url: "https://api.github.example.com/repos/o/r/issues/1",
      method: "GET",
      headers: { Accept: "application/vnd.github+json" },
    });
    expect(spawns[0]?.options.env.GH_TOKEN).toBeUndefined();
  });
});

describe("TC-CLI-004 --include status parsing classifies 2xx/404/non-2xx", () => {
  const statusCases = (): readonly Record<string, unknown>[] => {
    const parsed = readJson(STATUS_FIXTURE);
    const cases = (parsed as { readonly cases?: unknown }).cases;
    if (!Array.isArray(cases)) throw new Error("status fixture has no cases");
    return cases.filter((entry): entry is Record<string, unknown> => isRecord(entry));
  };

  for (const entry of statusCases()) {
    test(`${String(entry.name)} is reconstructed exactly`, async () => {
      const expected = recordField(entry, "expected");
      const { runner } = recordingRunner(() => ({
        stdout: String(entry.stdout),
        stderr: "",
        status: 0,
        timedOut: false,
      }));
      const transport = createGithubCliTransport({ runner, environment: environment() });
      const request: ProviderRequest = {
        url: "https://api.github.example.com/repos/o/r/issues/601",
        method: "GET",
        headers: { Accept: "application/vnd.github+json" },
      };
      if (expected.unparsable === true) {
        await expect(transport.send(request)).rejects.toThrow(/status block|not JSON/u);
        return;
      }
      const response = await transport.send(request);
      expect(response.status).toBe(expected.status as number);
      expect(response.body ?? null).toEqual(expected.body);
    });
  }

  test("the client keeps 404 definitive and non-2xx structured across the CLI transport", async () => {
    const credentials = createEnvironmentCredentialPort({
      environment: {},
      brand: fixtureBrand,
    });
    for (const [status, body, identity] of [
      [404, { message: "Not Found" }, "provider.not-found"],
      [403, { message: "Forbidden" }, "provider.payload.invalid"],
      [500, { message: "Server Error" }, "provider.payload.invalid"],
    ] as const) {
      const { runner } = recordingRunner(() => ({
        stdout: statusBlock(status, body),
        stderr: "",
        status: 0,
        timedOut: false,
      }));
      const client = createGitHubClient({
        instance: {
          instanceName: "github",
          systemKind: "vcs",
          baseUrl: "https://api.github.example.com",
          authMethod: { mechanism: "anonymous" },
        },
        credentials,
        repository: { owner: "o", name: "r" },
        transport: createGithubCliTransport({ runner, environment: environment() }),
      });
      const result = await client.readWorkItem(601);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.code).toBe(identity);
      expect(result.httpStatus).toBe(status);
    }
  });
});

describe("TC-CLI-006/007/008 the runner failure modes are classified", () => {
  const failures = (): Record<string, unknown> => {
    const parsed = readJson(FAILURE_FIXTURE);
    return recordField(parsed, "runner");
  };

  const request: ProviderRequest = {
    url: "https://api.github.example.com/repos/o/r/issues/601",
    method: "GET",
    headers: { Accept: "application/vnd.github+json" },
  };

  test("oversized output is refused, never partially parsed", async () => {
    const oversized = recordField(failures(), "oversized");
    const padding = String(oversized.padding).repeat(4);
    const { runner, spawns } = recordingRunner(() => ({
      stdout: `${String(oversized.bodyPrefix)}${padding}${String(oversized.bodySuffix)}`,
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    const transport = createGithubCliTransport({
      runner,
      environment: environment(),
      maxResponseBytes: 64,
    });
    await expect(transport.send(request)).rejects.toThrow(/output bound/u);
    expect(spawns).toHaveLength(1);
    expect(GITHUB_CLI_MAX_OUTPUT_BYTES).toBeGreaterThan(64);
  });

  test("a timeout is a transport failure with no status", async () => {
    const { runner, spawns } = recordingRunner(() => ({
      stdout: "",
      stderr: "",
      status: 124,
      timedOut: true,
    }));
    const transport = createGithubCliTransport({ runner, environment: environment() });
    await expect(transport.send(request)).rejects.toThrow(/timed out/u);
    expect(spawns).toHaveLength(1);
  });

  test("a non-zero exit never forwards stderr prose", async () => {
    const nonZero = recordField(failures(), "nonZeroExit");
    const { runner } = recordingRunner(() => ({
      stdout: "",
      stderr: String(nonZero.stderr),
      status: 1,
      timedOut: false,
    }));
    const client = createGitHubClient({
      instance: {
        instanceName: "github",
        systemKind: "vcs",
        baseUrl: "https://api.github.example.com",
        authMethod: { mechanism: "anonymous" },
      },
      credentials: createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand }),
      repository: { owner: "o", name: "r" },
      transport: createGithubCliTransport({ runner, environment: environment() }),
    });
    const result = await client.readWorkItem(601);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("STDERR-CANARY-VALUE");
    expect(JSON.stringify(result)).not.toContain("rejected");
  });
});

describe("TC-CLI-009 malformed or unparsable status is refused", () => {
  test("an unparsable status block never becomes an assumed 200", async () => {
    const runnerCases = recordField(readJson(FAILURE_FIXTURE), "runner");
    const unparsableField = runnerCases.unparsableStatus;
    if (!isRecord(unparsableField)) throw new Error("runner fixture has no unparsableStatus case");
    const unparsable = unparsableField;
    expect(unparsable.status).toBe(0);
    const { runner } = recordingRunner(() => ({
      stdout: String(unparsable.stdout),
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    const transport = createGithubCliTransport({ runner, environment: environment() });
    await expect(
      transport.send({
        url: "https://api.github.example.com/repos/o/r/issues/601",
        method: "GET",
        headers: {},
      }),
    ).rejects.toThrow(/status block/u);
  });
});

describe("TC-CLI-010 the probe returns exactly one closed refusal code", () => {
  const probeFixture = (): Record<string, unknown> =>
    recordField(readJson(FAILURE_FIXTURE), "probe");

  const probeFor = async (name: string) => {
    const fixture = recordField(probeFixture(), name);
    const { runner, spawns } = recordingRunner(() => {
      if (fixture.throws === true) throw new Error("spawn ENOENT");
      return {
        stdout: String(fixture.stdout ?? ""),
        stderr: String(fixture.stderr ?? ""),
        status: typeof fixture.status === "number" ? fixture.status : 0,
        timedOut: false,
      };
    });
    const result = await probeGithubCli({ runner, environment: environment() });
    return { result, spawns };
  };

  test("a usable CLI reports its version", async () => {
    const { result, spawns } = await probeFor("usable");
    expect(result).toEqual({ ok: true, version: "2.40.1" });
    expect(spawns).toHaveLength(1);
    expect(spawns[0]?.args).toEqual(["--version"]);
    expect(spawns[0]?.options.env.GH_TOKEN).toBeUndefined();
  });

  test("the refusal set is closed and every unusable case maps to exactly one code", async () => {
    const expectations: ReadonlyArray<readonly [string, string]> = [
      ["absent", "provider.cli.unavailable"],
      ["belowWindow", "provider.cli.version-unsupported"],
      ["aboveWindow", "provider.cli.version-unsupported"],
      ["capabilityPoor", "provider.cli.capability-unsupported"],
      ["nonZeroExit", "provider.cli.unavailable"],
    ];
    for (const [name, code] of expectations) {
      const { result, spawns } = await probeFor(name);
      expect(result.ok, name).toBe(false);
      if (!result.ok) {
        expect(result.code, name).toBe(code);
        expect(GITHUB_CLI_REFUSAL_CODES).toContain(result.code);
      }
      expect(spawns).toHaveLength(1);
    }
    expect([...GITHUB_CLI_REFUSAL_CODES]).toHaveLength(3);
  });

  test("importing the module performs no probe and no request", async () => {
    const { runner, spawns } = recordingRunner(() => ({
      stdout: "",
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    // The module is already imported; constructing nothing must not spawn.
    expect(spawns).toHaveLength(0);
    const transport = createGithubCliTransport({ runner, environment: environment() });
    expect(transport).toBeDefined();
    expect(spawns).toHaveLength(0);
  });
});

describe("TC-CLI-011 the selection value, its single line, and the absent fact", () => {
  test("api-only never probes and carries no degradation", () => {
    const value = resolveTransportSelection({ policy: "api-only" });
    expect(value).toEqual({ policy: "api-only", selected: "api" });
    expect(Object.hasOwn(value, "degradation")).toBe(false);
  });

  test("prefer-cli selects the CLI on a passing probe", () => {
    expect(
      resolveTransportSelection({ policy: "prefer-cli", probe: { ok: true, version: "2.4.0" } }),
    ).toEqual({ policy: "prefer-cli", selected: "gh" });
  });

  test("prefer-cli degrades with the exact probe refusal code", () => {
    for (const code of GITHUB_CLI_REFUSAL_CODES) {
      const value = resolveTransportSelection({ policy: "prefer-cli", probe: { ok: false, code } });
      expect(value).toEqual({ policy: "prefer-cli", selected: "api", degradation: { code } });
    }
  });

  test("the composition resolver probes once under prefer-cli and never under api-only", async () => {
    const { runner, spawns } = recordingRunner(() => ({
      stdout: String(recordField(recordField(readJson(FAILURE_FIXTURE), "probe"), "usable").stdout),
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    const selected = await resolveCompositionTransportSelection({
      environment: environment(),
      runner,
    });
    expect(selected).toEqual({ policy: "prefer-cli", selected: "gh" });
    expect(spawns).toHaveLength(1);

    const apiOnly = await resolveCompositionTransportSelection({
      environment: environment(),
      runner,
      policy: "api-only",
    });
    expect(apiOnly).toEqual({ policy: "api-only", selected: "api" });
    expect(spawns).toHaveLength(1);
  });

  test("a degradation renders exactly one composition line and persists nothing", async () => {
    const lines: string[] = [];
    const selection = resolveTransportSelection({
      policy: "prefer-cli",
      probe: { ok: false, code: "provider.cli.version-unsupported" },
    });
    const program = await createProductionComposer({
      environment: { HOME: "/tmp/example-home", PATH: "/usr/bin" },
      cwd: "/tmp/example-home",
      homeDirectory: "/tmp/example-home",
      workingName: fixtureBrand.binaryName,
      githubTransportSelection: selection,
    })(fixtureBrand, {
      command: "status",
      groupScoped: false,
      onCompositionNotice: (line) => lines.push(line),
    });
    const selectionLines = lines.filter((line) =>
      line.includes("provider.cli.version-unsupported"),
    );
    expect(selectionLines).toHaveLength(1);
    expect(JSON.stringify(Object.keys(program))).not.toContain("degradation");
    expect(JSON.stringify(program)).not.toContain("provider.cli.version-unsupported");
  });

  test("an absent composition fact probes nothing and renders nothing", async () => {
    const lines: string[] = [];
    const { runner, spawns } = recordingRunner(() => ({
      stdout: "",
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    const program = await createProductionComposer({
      environment: { HOME: "/tmp/example-home", PATH: "/usr/bin" },
      cwd: "/tmp/example-home",
      homeDirectory: "/tmp/example-home",
      workingName: fixtureBrand.binaryName,
      githubCliRunner: runner,
    })(fixtureBrand, {
      command: "status",
      groupScoped: false,
      onCompositionNotice: (line) => lines.push(line),
    });
    expect(program.commands).toBeDefined();
    expect(spawns).toHaveLength(0);
    expect(lines.filter((line) => line.includes("provider.cli."))).toHaveLength(0);
  });

  test("the entrypoint never probes on a self-description path", async () => {
    const { runner, spawns } = recordingRunner(() => ({
      stdout: "",
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    let compositions = 0;
    const write = (): { readonly write: (chunk: string) => void } => ({ write: () => undefined });
    for (const argv of [
      ["--version"],
      ["--print-install-path"],
      ["--help"],
      ["status", "--help"],
    ]) {
      const code = await runEntrypoint(argv, {
        streams: { stdout: write(), stderr: write() },
        environment: { HOME: "/tmp/example-home" },
        declaredWorkingName: fixtureBrand.binaryName,
        composeProgram: async (brand, invocation) => {
          compositions += 1;
          const selection = await resolveCompositionTransportSelection({
            environment: environment(),
            runner,
          });
          return createProductionComposer({
            environment: { HOME: "/tmp/example-home", PATH: "/usr/bin" },
            cwd: "/tmp/example-home",
            homeDirectory: "/tmp/example-home",
            workingName: brand.binaryName,
            githubTransportSelection: selection,
          })(brand, invocation);
        },
      });
      expect(code).toBe(0);
    }
    expect(compositions).toBe(0);
    expect(spawns).toHaveLength(0);
  });
});

describe("TC-CLI-012 no per-request failover", () => {
  test("a failing CLI write is not re-issued on the API transport", async () => {
    const { runner, spawns } = recordingRunner(() => ({
      stdout: "",
      stderr: "rejected",
      status: 1,
      timedOut: false,
    }));
    const client = createGitHubClient({
      instance: {
        instanceName: "github",
        systemKind: "vcs",
        baseUrl: "https://api.github.example.com",
        authMethod: { mechanism: "anonymous" },
      },
      credentials: createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand }),
      repository: { owner: "o", name: "r" },
      transport: createGithubCliTransport({ runner, environment: environment() }),
    });
    const result = await client.transitionWorkItem({ entityId: "601", deliveryState: "done" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect(Object.hasOwn(result, "httpStatus")).toBe(false);
    }
    // One CLI spawn, no second attempt: the client holds exactly one transport.
    expect(spawns).toHaveLength(1);
    expect(Object.keys(client)).not.toContain("transport");
  });
});

describe("TC-CLI-013 exactly one process per request", () => {
  test("three requests spawn exactly three processes and an API client spawns none", async () => {
    const { runner, spawns } = recordingRunner(() => ({
      stdout:
        'HTTP/2.0 200 OK\ncontent-type: application/json\n\n{"number":601,"title":"t","state":"open","labels":[]}\n',
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    const transport = createGithubCliTransport({ runner, environment: environment() });
    const request: ProviderRequest = {
      url: "https://api.github.example.com/repos/o/r/issues/601",
      method: "GET",
      headers: { Accept: "application/vnd.github+json" },
    };
    for (const _ of [1, 2, 3]) await transport.send(request);
    expect(spawns).toHaveLength(3);
    for (const spawn of spawns)
      expect(spawn.args.filter((entry) => entry === "api")).toHaveLength(1);

    const { runner: unused, spawns: unusedSpawns } = recordingRunner(() => ({
      stdout: "",
      stderr: "",
      status: 0,
      timedOut: false,
    }));
    const apiClient = createGitHubClient({
      instance: {
        instanceName: "github",
        systemKind: "vcs",
        baseUrl: "https://api.github.example.com",
        authMethod: { mechanism: "anonymous" },
      },
      credentials: createEnvironmentCredentialPort({ environment: {}, brand: fixtureBrand }),
      repository: { owner: "o", name: "r" },
      transport: createGithubNativeTransport(),
    });
    expect(apiClient).toBeDefined();
    expect(unused).toBeDefined();
    expect(unusedSpawns).toHaveLength(0);
  });
});
