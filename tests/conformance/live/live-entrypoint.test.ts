/**
 * Live composition controls (GH-189 P5: TC-CONF-020..025).
 *
 * The live entrypoint is exercised through its injected composition; one
 * subprocess proves the `not-configured` exit path and artifact write.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AdapterOperation,
  CapabilityGap,
  CredentialPort,
  CredentialReference,
  WorkItem,
} from "@delivery-os/core/contracts";
import {
  CONFORMANCE_ADAPTERS,
  type ConformanceAdapterClient,
  type ConformanceAdapterRegistration,
  type ConformanceArtifact,
  type ConformanceTransport,
  runConformance,
  validateConformanceArtifact,
} from "@delivery-os/testkit";
import { SECRET_READ_ALLOWLIST } from "../../../scripts/checks/secret-read-boundary";
import {
  isConfigured,
  PROVIDER_LIVE_SETTINGS,
  PROVIDER_LIVE_TOKEN_KEYS,
  readLiveConfig,
} from "./config";
import { createRecordingTransport, type RecordedRequest } from "./recording-transport";
import { type LiveRunInput, runLive } from "./run-live";
import { createCanaryCredentialPort, loadMockTenants } from "../support/fixtures";
import { scanSourceMap, scanTestkitSource } from "../support/testkit-source-scan";

const ROOT = process.cwd();
const CLOCK = "2026-10-31T00:00:00Z";
const RUN_ID = "live-run-1";
const GITHUB_SHA = "1111111111111111111111111111111111111111";
const GITLAB_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

const FULL_VALUES: Readonly<Record<string, string>> = {
  CONFORMANCE_LIVE_GITHUB_BASE_URL: "https://github.example.com",
  CONFORMANCE_LIVE_GITHUB_OWNER: "owner-placeholder",
  CONFORMANCE_LIVE_GITHUB_REPO: "project-placeholder",
  CONFORMANCE_LIVE_GITHUB_ISSUE_NUMBER: "601",
  CONFORMANCE_LIVE_GITHUB_PULL_NUMBER: "504",
  CONFORMANCE_LIVE_GITHUB_COMMIT_SHA: GITHUB_SHA,
  CONFORMANCE_LIVE_GITHUB_TOKEN: "github-canary-token-value",
  CONFORMANCE_LIVE_GITLAB_BASE_URL: "https://gitlab.example.com",
  CONFORMANCE_LIVE_GITLAB_PROJECT_PATH: "project-placeholder",
  CONFORMANCE_LIVE_GITLAB_MR_IID: "42",
  CONFORMANCE_LIVE_GITLAB_COMMIT_SHA: GITLAB_SHA,
  CONFORMANCE_LIVE_GITLAB_TOKEN: "gitlab-canary-token-value",
  CONFORMANCE_LIVE_JIRA_BASE_URL: "https://jira.example.com",
  CONFORMANCE_LIVE_JIRA_ISSUE_KEY: "TRACK-101",
  CONFORMANCE_LIVE_JIRA_TOKEN: "jira-canary-token-value",
};

const PROVIDERS = ["github", "gitlab", "jira"] as const;

const namesFor = (provider: (typeof PROVIDERS)[number]): string[] => [
  ...PROVIDER_LIVE_SETTINGS[provider],
  PROVIDER_LIVE_TOKEN_KEYS[provider],
];

const ALL_NAMES: readonly string[] = PROVIDERS.flatMap((provider) => namesFor(provider));

const fullEnvironment = (): Record<string, string> => ({ ...FULL_VALUES });

const githubOnlyEnvironment = (): Record<string, string> => {
  const environment: Record<string, string> = {};
  for (const name of namesFor("github")) {
    const value = FULL_VALUES[name];
    if (value !== undefined) environment[name] = value;
  }
  return environment;
};

const fixtureTransport = (): ConformanceTransport => {
  const tenants = Object.values(loadMockTenants());
  return {
    send: async (request) => {
      for (const tenant of tenants) {
        const route = tenant.routes.find(
          (candidate) => candidate.method === request.method && candidate.url === request.url,
        );
        if (route !== undefined) return { status: route.status, body: route.body };
      }
      throw new Error(`unfixtured live request ${request.method} ${request.url}`);
    },
  };
};

const failingTransport = (): ConformanceTransport => ({
  send: async () => ({ status: 500, body: {} }),
});

const recordingCredentialPort = (
  value = "canary-credential-material",
): { readonly port: CredentialPort; readonly lookups: CredentialReference[] } => {
  const lookups: CredentialReference[] = [];
  return {
    port: {
      resolve: (reference) => {
        lookups.push(reference);
        return { ok: true, material: { value } };
      },
    },
    lookups,
  };
};

type RunOptions = {
  readonly environment: LiveRunInput["environment"];
  readonly adapters?: readonly ConformanceAdapterRegistration[];
  readonly transportFactory?: (provider: string) => ConformanceTransport;
  readonly credentials?: CredentialPort;
  readonly recordedRequests?: readonly RecordedRequest[];
  readonly clock?: string;
  readonly runId?: string;
  readonly writer?: (artifact: ConformanceArtifact) => void;
};

const runOnce = async (
  options: RunOptions,
): Promise<{
  readonly result: Awaited<ReturnType<typeof runLive>>;
  readonly artifacts: ConformanceArtifact[];
}> => {
  const artifacts: ConformanceArtifact[] = [];
  const result = await runLive({
    environment: options.environment,
    adapters: options.adapters ?? CONFORMANCE_ADAPTERS,
    clock: options.clock ?? CLOCK,
    runId: options.runId ?? RUN_ID,
    writer: options.writer ?? ((artifact) => artifacts.push(artifact)),
    transportFactory: options.transportFactory ?? (() => fixtureTransport()),
    credentials: options.credentials ?? createCanaryCredentialPort(),
    ...(options.recordedRequests !== undefined
      ? { recordedRequests: options.recordedRequests }
      : {}),
  });
  return { result, artifacts };
};

const withEmptyValues = (value: string): Record<string, string> => {
  const environment: Record<string, string> = {};
  for (const name of ALL_NAMES) environment[name] = value;
  return environment;
};

const controlWorkItem = (): WorkItem => ({
  identity: { systemName: "github", entityId: "601" },
  title: "Live control work item",
  status: { nativeStatus: "open", deliveryState: "ready" },
  labels: ["tracker"],
  relations: [],
  updatedAt: "2026-10-29T08:00:00Z",
});

const ALL_OPERATIONS: readonly AdapterOperation[] = [
  "read-work-item",
  "write-work-item",
  "transition-work-item",
  "read-delivery-request",
  "write-delivery-request",
  "read-pipeline-run",
  "write-comment",
  "resolve-delivery-thread",
];

const gapsExcept = (supported: readonly AdapterOperation[]): CapabilityGap[] => {
  const set = new Set(supported);
  return ALL_OPERATIONS.filter((operation) => !set.has(operation)).map((operation) => ({
    operation,
    reason: "adapter-not-implemented",
  }));
};

const liveControl = (handler: () => void): ConformanceAdapterRegistration => {
  const client: ConformanceAdapterClient = {
    readWorkItem: async () => ({ ok: true, value: controlWorkItem() }),
  };
  return {
    provider: "github",
    contract: {
      adapterName: "github",
      systemKind: "vcs",
      capabilities: {
        supportedOperations: ["read-work-item", "write-comment"],
        declaredGaps: gapsExcept(["read-work-item", "write-comment"]),
        writableCarriers: [],
        readableCarriers: [],
      },
    },
    buildClient: () => client,
    writeHandler: () => {
      handler();
      return { ok: true, detail: "live control write", assertionCount: 1 };
    },
  };
};

const listSourceFiles = (relative: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules") continue;
      files.push(...listSourceFiles(next));
    } else if (entry.name.endsWith(".ts")) {
      files.push(next);
    }
  }
  return files;
};

describe("TC-CONF-020 live status matrix and writer", () => {
  test("not-configured exits 0 and writes one valid artifact", async () => {
    const { result, artifacts } = await runOnce({ environment: {} });
    expect(result.status).toBe("not-configured");
    expect(result.exitCode).toBe(0);
    expect(artifacts).toHaveLength(1);
    expect(validateConformanceArtifact(artifacts[0])).toEqual([]);
  });

  test("passed exits 0 and writes one valid artifact", async () => {
    const { result, artifacts } = await runOnce({ environment: githubOnlyEnvironment() });
    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(artifacts).toHaveLength(1);
    expect(validateConformanceArtifact(artifacts[0])).toEqual([]);
  });

  test("failed exits 1 and still writes one valid artifact", async () => {
    const { result, artifacts } = await runOnce({
      environment: githubOnlyEnvironment(),
      transportFactory: () => failingTransport(),
    });
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(1);
    expect(artifacts).toHaveLength(1);
    expect(validateConformanceArtifact(artifacts[0])).toEqual([]);
  });

  test("the mock tier stays in memory and is never persisted as an artifact", async () => {
    const tenants = loadMockTenants();
    const report = await runConformance({
      adapters: CONFORMANCE_ADAPTERS,
      tenants,
      credentials: createCanaryCredentialPort(),
      transportFactory: (provider) => {
        const tenant = tenants[provider];
        if (tenant === undefined) throw new Error(`missing tenant ${provider}`);
        return createRecordingTransport({
          send: async (request) => {
            const route = tenant.routes.find((candidate) => candidate.url === request.url);
            if (route === undefined) throw new Error(`unfixtured ${request.url}`);
            return { status: route.status, body: route.body };
          },
        });
      },
      nowIso: CLOCK,
      runId: "mock-memory",
      tier: "mock",
    });
    expect(report.tier).toBe("mock");
    expect(report.status).toBe("passed");
    expect("schema" in report).toBe(false);
  });

  test("a writer that skips on failure leaves no artifact and the presence check fails", async () => {
    const artifacts: ConformanceArtifact[] = [];
    const { result } = await runOnce({
      environment: githubOnlyEnvironment(),
      transportFactory: () => failingTransport(),
      writer: (artifact) => {
        if (artifact.status !== "failed") artifacts.push(artifact);
      },
    });
    expect(result.status).toBe("failed");
    expect(artifacts).toEqual([]);
    expect(() => {
      const artifact = artifacts[0];
      if (artifact === undefined) throw new Error(`missing artifact for ${result.status} run`);
    }).toThrow("missing artifact");
  });
});

describe("TC-CONF-021 not-configured occupancy matrix", () => {
  const shapes: readonly { readonly id: string; readonly environment: Record<string, string> }[] = [
    { id: "absent", environment: {} },
    { id: "present-but-empty", environment: withEmptyValues("") },
    { id: "whitespace", environment: withEmptyValues(" \t") },
  ];

  for (const shape of shapes) {
    test(`${shape.id} is not-configured with exactly 15 names and no lookups`, async () => {
      const recording = recordingCredentialPort();
      let transports = 0;
      const { result, artifacts } = await runOnce({
        environment: shape.environment,
        credentials: recording.port,
        transportFactory: () => {
          transports += 1;
          return fixtureTransport();
        },
      });
      expect(result.status).toBe("not-configured");
      expect(result.exitCode).toBe(0);
      expect(recording.lookups).toEqual([]);
      expect(transports).toBe(0);
      const artifact = artifacts[0];
      if (artifact === undefined) throw new Error("missing artifact");
      expect(artifact.providers.map((provider) => provider.missingSettings.length)).toEqual([
        7, 5, 3,
      ]);
      expect(artifact.providers.flatMap((provider) => provider.missingSettings)).toHaveLength(15);
      expect(artifact.providers.every((provider) => provider.status === "not-configured")).toBe(
        true,
      );
      expect(JSON.stringify(artifact).includes("canary-token")).toBe(false);
    });
  }

  test("occupancy is per provider: blanking one GitHub setting demotes only GitHub", async () => {
    const environment = fullEnvironment();
    delete environment.CONFORMANCE_LIVE_GITHUB_OWNER;
    const { result, artifacts } = await runOnce({ environment });
    const artifact = artifacts[0];
    if (artifact === undefined) throw new Error("missing artifact");
    const github = artifact.providers.find((provider) => provider.provider === "github");
    const gitlab = artifact.providers.find((provider) => provider.provider === "gitlab");
    const jira = artifact.providers.find((provider) => provider.provider === "jira");
    expect(github?.status).toBe("not-configured");
    expect(github?.missingSettings).toEqual(["CONFORMANCE_LIVE_GITHUB_OWNER"]);
    expect(gitlab?.status).toBe("passed");
    expect(gitlab?.missingSettings).toEqual([]);
    expect(jira?.status).toBe("passed");
    expect(jira?.missingSettings).toEqual([]);
    expect(result.status).toBe("passed");
  });

  test("the spawned entrypoint exits 0 and writes a valid artifact", () => {
    const directory = mkdtempSync(join(tmpdir(), "gh189-live-"));
    const out = join(directory, "conformance-live.json");
    const environment: Record<string, string | undefined> = { ...process.env };
    for (const name of ALL_NAMES) delete environment[name];
    try {
      const spawned = spawnSync(
        "bun",
        ["run", "tests/conformance/live/run-live.ts", "--out", out],
        { cwd: ROOT, env: environment, encoding: "utf8", timeout: 60_000 },
      );
      expect(spawned.status, spawned.stderr).toBe(0);
      expect(existsSync(out)).toBe(true);
      const artifact: unknown = JSON.parse(readFileSync(out, "utf8"));
      expect(validateConformanceArtifact(artifact)).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("TC-CONF-022 configured-provider live failure", () => {
  test("a configured failure exits 1, writes the artifact and leaves other providers not-configured", async () => {
    const { result, artifacts } = await runOnce({
      environment: githubOnlyEnvironment(),
      transportFactory: () => failingTransport(),
    });
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(1);
    const artifact = artifacts[0];
    if (artifact === undefined) throw new Error("missing artifact");
    const github = artifact.providers.find((provider) => provider.provider === "github");
    const gitlab = artifact.providers.find((provider) => provider.provider === "gitlab");
    const jira = artifact.providers.find((provider) => provider.provider === "jira");
    expect(github?.status).toBe("failed");
    expect(gitlab?.status).toBe("not-configured");
    expect(jira?.status).toBe("not-configured");
    expect(artifact.mutationRequests).toBe(0);
    expect(artifact.createdArtifacts).toBe(0);
    expect(
      artifact.steps.some(
        (step) => step.operation.startsWith("write") && step.status === "executed",
      ),
    ).toBe(false);
    const failed = artifact.steps.find((step) => step.status === "failed");
    expect(failed?.provider).toBe("github");
    expect(failed?.flowId.length).toBeGreaterThan(0);
    expect(failed?.stepId.length).toBeGreaterThan(0);
    expect(failed?.operation.length).toBeGreaterThan(0);
    expect(failed?.failure?.assertion.length).toBeGreaterThan(0);
    expect(typeof failed?.failure?.expected).toBe("string");
    expect(typeof failed?.failure?.received).toBe("string");
    expect((failed?.failure?.reference ?? "").length).toBeGreaterThan(0);
  });
});

describe("TC-CONF-023 live read-only and no-mutation proof", () => {
  test("all live requests are GET with zero mutations and created artifacts", async () => {
    const inner = createRecordingTransport(fixtureTransport());
    const { result, artifacts } = await runOnce({
      environment: fullEnvironment(),
      transportFactory: () => inner,
    });
    expect(result.status).toBe("passed");
    expect(inner.records.every((record) => record.method === "GET")).toBe(true);
    expect(result.artifact.mutationRequests).toBe(0);
    expect(result.artifact.createdArtifacts).toBe(0);
    expect(artifacts).toHaveLength(1);
  });

  test("a synthetic POST fails the run naming the method and URL", async () => {
    const { result } = await runOnce({
      environment: githubOnlyEnvironment(),
      recordedRequests: [{ method: "POST", url: "https://github.example.com/mutate" }],
    });
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(1);
    expect(result.artifact.mutationRequests).toBe(1);
    const guard = result.artifact.steps.find((step) => step.stepId === "live-read-only.guard");
    expect(guard?.failure?.received).toBe("POST");
    expect(guard?.failure?.reference).toBe("https://github.example.com/mutate");
  });

  test("a supported non-read step is a live-read-only deferral and never dispatches", async () => {
    let writes = 0;
    const control = liveControl(() => {
      writes += 1;
    });
    const { result } = await runOnce({
      environment: githubOnlyEnvironment(),
      adapters: [control],
    });
    const writeSteps = result.artifact.steps.filter((step) => step.operation === "write-comment");
    expect(writeSteps.some((step) => step.skipKind === "live-read-only")).toBe(true);
    expect(writes).toBe(0);
  });

  test("an unsupported non-read step records its declared gap and never dispatches", async () => {
    const { result } = await runOnce({ environment: githubOnlyEnvironment() });
    const declareGap = result.artifact.steps.find(
      (step) => step.operation === "write-work-item" && step.provider === "github",
    );
    expect(declareGap?.status).toBe("skipped");
    expect(declareGap?.skipKind).toBe("declared-gap");
    expect(declareGap?.skipReason).toBe("adapter-not-implemented");
  });

  test("both mutation counters are pinned to zero in every status", async () => {
    const passed = await runOnce({ environment: githubOnlyEnvironment() });
    const failed = await runOnce({
      environment: githubOnlyEnvironment(),
      transportFactory: () => failingTransport(),
    });
    const notConfigured = await runOnce({ environment: {} });
    for (const { result } of [passed, failed, notConfigured]) {
      expect(result.artifact.mutationRequests).toBe(0);
      expect(result.artifact.createdArtifacts).toBe(0);
    }
    expect(notConfigured.result.status).toBe("not-configured");
    expect(passed.result.status).toBe("passed");
    expect(failed.result.status).toBe("failed");
  });
});

describe("TC-CONF-024 config reader and credential-port exclusivity", () => {
  test("the reader returns non-secret settings and occupancy only", () => {
    const environment = fullEnvironment();
    const config = readLiveConfig(environment);
    for (const provider of config.providers) {
      expect(provider.occupancy).toBe("present");
      expect(provider.missingSettings).toEqual([]);
      expect(provider.credentialReference.referenceName).toBe(
        PROVIDER_LIVE_TOKEN_KEYS[provider.provider],
      );
      expect(isConfigured(provider)).toBe(true);
    }
    const serialized = JSON.stringify(config);
    for (const tokenKey of Object.values(PROVIDER_LIVE_TOKEN_KEYS)) {
      const value = environment[tokenKey];
      if (value !== undefined) expect(serialized.includes(value)).toBe(false);
    }
  });

  test("undefined, empty and whitespace-only values are missing", () => {
    const environment = fullEnvironment();
    environment.CONFORMANCE_LIVE_GITHUB_TOKEN = "   ";
    const github = readLiveConfig(environment).providers.find(
      (provider) => provider.provider === "github",
    );
    expect(github?.occupancy).toBe("missing");
    expect(github === undefined ? true : isConfigured(github)).toBe(false);
    expect(github?.missingSettings).toContain("CONFORMANCE_LIVE_GITHUB_TOKEN");
  });

  test("configured providers resolve tokens only through the credential port", async () => {
    const recording = recordingCredentialPort("canary-token-material");
    const { result, artifacts } = await runOnce({
      environment: githubOnlyEnvironment(),
      credentials: recording.port,
    });
    expect(result.status).toBe("passed");
    expect(recording.lookups.length).toBeGreaterThan(0);
    expect(recording.lookups[0]?.referenceName).toBe("CONFORMANCE_LIVE_GITHUB_TOKEN");
    const serialized = JSON.stringify(artifacts[0]);
    expect(serialized.includes("canary-token-material")).toBe(false);
  });

  test("production source is non-empty and free of live reader references", () => {
    const files = listSourceFiles("packages").filter((file) => file.includes("/src/"));
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((file) => {
      const text = readFileSync(join(ROOT, file), "utf8");
      return text.includes("tests/conformance/live") || text.includes("CONFORMANCE_LIVE_");
    });
    expect(offenders).toEqual([]);
    expect(SECRET_READ_ALLOWLIST).toHaveLength(4);
  });
});

describe("TC-CONF-025 live injection determinism", () => {
  test("identical injected inputs produce identical artifacts", async () => {
    const first = await runOnce({ environment: fullEnvironment() });
    const second = await runOnce({ environment: fullEnvironment() });
    expect(second.result.artifact).toEqual(first.result.artifact);
    expect(JSON.stringify(second.result.artifact)).toBe(JSON.stringify(first.result.artifact));
  });

  test("only the injected run id changes when it changes", async () => {
    const first = await runOnce({ environment: githubOnlyEnvironment(), runId: "run-a" });
    const second = await runOnce({ environment: githubOnlyEnvironment(), runId: "run-b" });
    expect({ ...first.result.artifact, runId: second.result.artifact.runId }).toEqual(
      second.result.artifact,
    );
  });

  test("only the injected clock changes when it changes", async () => {
    const first = await runOnce({
      environment: githubOnlyEnvironment(),
      clock: "2026-10-31T00:00:00Z",
    });
    const second = await runOnce({
      environment: githubOnlyEnvironment(),
      clock: "2026-10-31T01:00:00Z",
    });
    expect({ ...first.result.artifact, generatedAt: second.result.artifact.generatedAt }).toEqual(
      second.result.artifact,
    );
  });

  test("testkit source contains no ambient time, randomness or environment access", () => {
    expect(scanTestkitSource(ROOT)).toEqual([]);
    const hits = scanSourceMap({
      "packages/testkit/src/conformance/probe.ts":
        "const a = Date.now();\nconst b = Math.random();\nconst c = process.env.SECRET;\n",
    });
    expect(hits.length).toBeGreaterThan(0);
  });
});
