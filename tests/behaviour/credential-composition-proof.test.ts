/**
 * TC-COMP-001/002/003 — the C-1 CI proof: the real production composition
 * with injected seams. The declared argv reaches the recording child runner,
 * material registers into the live registry at materialization, and the
 * shipped default resolves exactly as today with zero spawns.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChildRunRequest } from "../../packages/adapters/src/credentials/command-strategy";
import { runEntrypoint } from "../../packages/cli/src/entrypoint";
import { createProductionComposer } from "../../packages/cli/src/production";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import type { BrandIdentity } from "../../packages/core/src/contracts/index";

const TMP = join(process.cwd(), "tmp", "tmpdir");
const FIXED_NOW = "2026-01-01T12:00:00Z";

const branded = resolveBrandIdentity({ workingName: "jaiship" });
if (!branded.ok) throw new Error("brand is invalid");
const _BRAND: BrandIdentity = branded.value;

const COMMAND_DECLARATION_CONFIG = `github:
  credential:
    sourceKey:
      style: command
      program: /usr/bin/gh
      args: [auth, token, "--hostname", github.example.com]
provider:
  defaultChain: ch
  credentials:
    deepseek:
      sourceKey:
        style: harness-store
        harness: opencode
        integrationId: deepseek
  entries:
    p:
      class: subscription
      quota:
        enabled: true
        endpoint: https://quota.example.invalid
        credentialRef: deepseek
        timeoutMs: 1000
        thresholdPercent: 100
        maxSleepLoops: 1
        outageParkTtlSeconds: 10
        credentialParkTtlSeconds: 10
        capParkTtlSeconds: 10
  chains:
    ch:
      entries:
        - p
`;

const DEFAULTS_ONLY_CONFIG = `provider:
  defaultChain: ch
  entries:
    p:
      class: subscription
  chains:
    ch:
      entries:
        - p
`;

type Scratch = {
  readonly root: string;
  readonly checkout: string;
  readonly environment: Record<string, string>;
  dispose(): void;
};

const scratch = (label: string, config: string): Scratch => {
  mkdirSync(TMP, { recursive: true });
  const root = mkdtempSync(join(TMP, `gh394-comp-${label}-`));
  const checkout = join(root, "checkout");
  mkdirSync(checkout, { recursive: true });
  mkdirSync(join(checkout, ".jaiship"), { recursive: true });
  writeFileSync(join(checkout, ".jaiship", "config.yaml"), config);
  // A real repository: the merge surface's local resolution reads git before
  // its tracker read, and the tracker client resolves the declared credential
  // on that path.
  const git = (args: readonly string[]): void => {
    const result = spawnSync(
      "git",
      ["-c", "user.email=fixture@example.invalid", "-c", "user.name=fixture", ...args],
      { cwd: checkout, encoding: "utf8" },
    );
    if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  };
  git(["init"]);
  writeFileSync(join(checkout, "README.md"), "fixture\n");
  git(["add", "README.md"]);
  git(["commit", "-m", "fixture"]);
  git(["remote", "add", "origin", "https://github.example.com/example/repo.git"]);
  return {
    root,
    checkout,
    environment: { HOME: join(root, "home"), PATH: "/usr/bin:/bin" },
    dispose: () => {
      rmSyncJoin(root);
    },
  };
};

const rmSyncJoin = (() => {
  // Local import indirection keeps the top-of-file import list small.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { rmSync } = require("node:fs") as typeof import("node:fs");
  return (path: string): void => rmSync(path, { recursive: true, force: true });
})();

const recordingRunner = () => {
  const requests: ChildRunRequest[] = [];
  return {
    requests,
    runChild: (request: ChildRunRequest) => {
      requests.push(request);
      return {
        ok: true as const,
        exitCode: 0,
        stdout: `recorded-material\n`,
        stdoutTruncated: false,
        stderrBytes: 0,
      };
    },
  };
};

const exportFixture = (integrationId: string, _standalone: boolean) => ({
  ok: true as const,
  stdout: JSON.stringify([
    {
      id: "fixture-1",
      integrationID: integrationId,
      label: "Fixture",
      active: true,
      value: { type: "key", key: "fixture-store-key" },
    },
  ]),
  stdoutTruncated: false,
});

const composeOptions = (
  facts: Scratch,
  seams: {
    runChild?: (request: ChildRunRequest) => unknown;
    storeFacts?: {
      exportEntries: (request: { integrationId: string; standalone: boolean }) => unknown;
    };
    secrets?: SecretRegistry;
  },
) => {
  const composer = createProductionComposer({
    environment: facts.environment,
    cwd: facts.checkout,
    homeDirectory: join(facts.root, "home"),
    workingName: "jaiship",
    clock: { nowMs: () => Date.parse(FIXED_NOW), nowIso: () => FIXED_NOW },
    ...(seams.runChild === undefined ? {} : { credentialChildRunner: seams.runChild as never }),
    ...(seams.storeFacts === undefined ? {} : { credentialStoreFacts: seams.storeFacts as never }),
    ...(seams.secrets === undefined ? {} : { secrets: seams.secrets }),
    // The provider quota probe reaches the network in this posture; the
    // reachability suite's classified-park posture covers it and the proof
    // asserts on the seams, never on the quota outcome.
  });
  const streams = { stdout: sink(), stderr: sink() };
  return { composer, streams };
};

const sink = () => {
  const chunks: string[] = [];
  return { chunks, value: () => chunks.join(""), write: (text: string) => void chunks.push(text) };
};

const invoke = async (
  facts: Scratch,
  seams: Parameters<typeof composeOptions>[1],
  argv: readonly string[],
): Promise<{ readonly exit: number; readonly stdout: string; readonly stderr: string }> => {
  const { composer, streams } = composeOptions(facts, seams);
  const exit = await runEntrypoint(argv, {
    streams: { stdout: streams.stdout as never, stderr: streams.stderr as never },
    environment: facts.environment,
    declaredWorkingName: "jaiship",
    configuredWorkingName: "jaiship",
    composeProgram: composer,
    clock: { now: () => Date.parse(FIXED_NOW) },
    newRunId: () => "run-gh394-comp",
  });
  return { exit, stdout: streams.stdout.value(), stderr: streams.stderr.value() };
};

const COMMAND_SCRATCH = scratch("command", COMMAND_DECLARATION_CONFIG);
const STORE_SCRATCH = scratch("store", COMMAND_DECLARATION_CONFIG);
const DEFAULT_SCRATCH = scratch("default", DEFAULTS_ONLY_CONFIG);

afterAll(() => {
  COMMAND_SCRATCH.dispose();
  STORE_SCRATCH.dispose();
  DEFAULT_SCRATCH.dispose();
});

describe("TC-COMP-001 tracker command declaration resolves through the real composition", () => {
  test("the declared argv — not the literal — reaches the recording seam", async () => {
    const recording = recordingRunner();
    const run = await invoke(COMMAND_SCRATCH, { runChild: recording.runChild }, [
      "merge",
      "GH-394",
      "--dry-run",
      "--json",
    ]);
    // The merge's work-item read is the tracker consumer: the credential
    // resolution happens before the read, whose classified refusal (the
    // fixture transport answers 404) never gates the seam assertions.
    expect(recording.requests.length).toBeGreaterThan(0);
    const request = recording.requests[0];
    if (request === undefined) throw new Error("the seam was not consulted");
    expect(request.argv[0]).toBe("/usr/bin/gh");
    expect(request.argv.slice(1)).toEqual(["auth", "token", "--hostname", "github.example.com"]);
    // Material registered at materialization is redacted at render time
    // through the live registry: the recorded material appears on no stream.
    expect(run.stdout).not.toContain("recorded-material");
    expect(run.stderr).not.toContain("recorded-material");
  });

  test("no product-written credential file and no operator-copied credential exists", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const entries = readdirSync(COMMAND_SCRATCH.checkout, { recursive: true }).map(String);
    expect(entries.join("\n")).not.toMatch(/credential|GITHUB_TOKEN=/);
    expect(entries.join("\n")).not.toMatch(/\.env/);
  });
});

describe("TC-COMP-002 provider harness-store declaration resolves through the real composition", () => {
  test("the export seam is consulted exactly once with the declared integration id", async () => {
    const consulted: string[] = [];
    const run = await invoke(
      STORE_SCRATCH,
      {
        storeFacts: {
          exportEntries: (request) => {
            consulted.push(`${request.integrationId}:${String(request.standalone)}`);
            return exportFixture(request.integrationId, request.standalone);
          },
        },
      },
      ["provider", "quota", "--json"],
    );
    // The quota walk resolves the declared credential before any transport
    // call; the classified quota outcome (a park on the unreachable fixture
    // endpoint) never gates the seam assertions.
    expect(consulted).toEqual(["deepseek:false"]);
    // The registered key is redacted at render time through the live
    // registry — registration precedes any render consult.
    expect(run.stdout).not.toContain("fixture-store-key");
    expect(run.stderr).not.toContain("fixture-store-key");
  });
});

describe("TC-COMP-003 the shipped default resolves exactly as today", () => {
  test("zero spawns: environment-backed references never consult the child seam", async () => {
    const recording = recordingRunner();
    const run = await invoke(DEFAULT_SCRATCH, { runChild: recording.runChild }, [
      "provider",
      "quota",
      "--json",
    ]);
    expect(run.exit).toBe(0);
    expect(recording.requests).toEqual([]);
    // The shipped tracker reference stays the delivered literal.
    const { DECLARED_CREDENTIAL_REFERENCES } = await import("../../packages/cli/src/production");
    expect(DECLARED_CREDENTIAL_REFERENCES[0]?.sourceKey).toEqual({
      style: "literal",
      name: "GITHUB_TOKEN",
    });
  });
});
