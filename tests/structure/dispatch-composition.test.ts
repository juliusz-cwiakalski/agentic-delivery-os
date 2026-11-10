/**
 * TC-MERGE-004 / TC-DISP-001 / TC-TRUTH-001..TC-TRUTH-004 (phase 4) — the
 * production dispatch composition exposes only the declared dispatch ports (no
 * merge executor, merge port, or merge invocation), and its truth read is
 * composed from the real sources: the change branch history, the GitHub-bound
 * pull request and work item, the CI verdict on the pushed head, and the
 * verify-change ledger outcome.
 *
 * The production composer is exercised end to end through `runCli`; only the
 * external seams are injected (a recording GitHub transport, a recording git
 * child runner, a credential port, the harness spawn runner, and the repository
 * facts), so no network, no model, and no checkout mutation happens. Repository
 * facts are injected rather than read from the checkout, so the suite is not
 * environment-dependent on a parseable origin remote.
 */
import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  dispatchIdentityMarkerPath,
  readDispatchIdentityMarkerText,
} from "../../packages/adapters/src/file/dispatch-identity";
import type { GitChildRunner, GitChildRunnerResult } from "../../packages/adapters/src/git/index";
import { type CliStreams, runCli } from "../../packages/cli/src/index";
import { createProductionComposer } from "../../packages/cli/src/production";
import { appendDaemonLane } from "../../packages/core/src/app/daemon";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
  readDispatchAttempts,
  readDispatchHandover,
} from "../../packages/core/src/app/dispatch-ledger";
import { declareQueueEntry } from "../../packages/core/src/app/queue";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import {
  type BrandIdentity,
  type CredentialPort,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type DispatchComparisonRecord,
  type DispatchEnvelopeData,
  type HarnessSpawnRunner,
  type HarnessSpawnRunnerResult,
  type HarnessSpawnStarter,
} from "../../packages/core/src/contracts/index";
import { serializeIdentityMarker } from "../../packages/core/src/domain/dispatch-identity";
import {
  appendEconomicsRestartEvent,
  createNodeStateEdge,
  createStateStore,
  readEconomicsRecords,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/state/index";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { readFail } from "../fixtures/dispatch/truth";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { makeDivergence, REPOSITORY } from "../fixtures/dispatch/ledger";
import { streamStarterFromRunner } from "../fixtures/harness/harness-io";

const ROOT = process.cwd();

/** The injected checkout remote and the derived identity it normalizes to. */
const GITHUB_ORIGIN = "https://github.com/owner/repo.git";

/**
 * Create a minimal checkout whose git common directory carries the given
 * origin. The identity marker is checkout-scoped, so the harness composes over
 * a real (temporary) checkout instead of the repository under test.
 */
const createCheckout = (
  parent: string,
  name: string,
  originUrl?: string,
): { readonly directory: string; readonly commonDir: string } => {
  const directory = join(parent, name);
  const commonDir = join(directory, ".git");
  mkdirSync(commonDir, { recursive: true });
  if (originUrl !== undefined) {
    writeFileSync(join(commonDir, "config"), `[remote "origin"]\n\turl = ${originUrl}\n`);
  }
  return { directory, commonDir };
};

/** Read the checkout-scoped identity marker through the delivered adapter. */
const markerOf = (commonDir: string): string | undefined =>
  readDispatchIdentityMarkerText(commonDir);

describe("TC-MERGE-004 the production composition has no reachable merge port", () => {
  test("the composition type declares no merge member", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    const start = source.indexOf("export type DispatchComposition = {");
    expect(start).toBeGreaterThan(0);
    const end = source.indexOf("};", start);
    const block = source.slice(start, end);
    expect(block.length).toBeGreaterThan(0);
    expect(block.toLowerCase().includes("merge")).toBe(false);
    for (const expected of [
      "harnesses",
      "descriptor",
      "readTruth",
      "claimLease",
      "releaseLease",
      "evidenceClass",
    ]) {
      expect(block).toContain(expected);
    }
  });

  test("the runtime declares only the run surface and fires no merge", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      expect(Object.keys(scenario.runtime)).toEqual(["run"]);
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(scenario.calls.merge).toBe(0);
      expect(Object.keys(run.envelope?.data ?? {})).not.toContain("merge");
    } finally {
      scenario.dispose();
    }
  });

  test("a source-level merge import added to the composition would be caught by the boundary rule", () => {
    const config = readFileSync(join(ROOT, ".dependency-cruiser.cjs"), "utf8");
    const rule = config.slice(config.indexOf('name: "dispatch-merge-absence"'));
    expect(rule).toContain("cli/src/commands/merge");
    expect(rule).toContain("domain/merge-");
  });
});

describe("the production composer builds a real harness session port", () => {
  test("a refusing credential port refuses before any spawn (TC-ADMIT-005 inversion)", async () => {
    const base = join(ROOT, "tmp", "tmpdir");
    mkdirSync(base, { recursive: true });
    const home = mkdtempSync(join(base, "gh239-production-"));
    const checkout = createCheckout(home, "checkout", GITHUB_ORIGIN);
    try {
      const brandResult = resolveBrandIdentity({ workingName: "delivery-os" });
      expect(brandResult.ok).toBe(true);
      if (!brandResult.ok) return;
      const brand = brandResult.value;
      const stateDirectory = join(home, brand.stateDirectoryName);
      const store = createStateStore(
        {
          level: "local",
          workspaceId: "default",
          fenceNamespace: "cli",
          schemaVersion: STATE_SCHEMA_VERSION,
          stateDirectory,
        },
        { driver: "jsonl", edge: createNodeStateEdge() },
      );
      const repository = "github.com/owner/repo";
      const seeded = declareQueueEntry(store, {
        ref: "GH-301",
        repository,
        repositoryRoot: ROOT,
        recordedAt: new Date().toISOString(),
        fenceToken: "seed-fence",
      });
      expect(seeded.ok).toBe(true);
      const invocations: Array<{
        readonly command: string;
        readonly environment: Readonly<Record<string, string>>;
      }> = [];
      const runner: HarnessSpawnRunner = async (
        file,
        _args,
        options,
      ): Promise<HarnessSpawnRunnerResult> => {
        invocations.push({ command: `${file} ${_args.join(" ")}`, environment: options.env });
        return { stdout: "", stderr: "", status: 0, timedOut: false };
      };
      const starterInvocations: Array<{
        readonly command: string;
        readonly environment: Readonly<Record<string, string>>;
      }> = [];
      const starter: HarnessSpawnStarter = (file, args, options) => {
        starterInvocations.push({
          command: `${file} ${args.join(" ")}`,
          environment: options.env,
        });
        const lines = [
          JSON.stringify({
            session: { id: "ses-production-1" },
            result: { completion: "complete" },
          }),
        ];
        return {
          lines: (async function* () {
            for (const line of lines) yield line;
          })(),
          completion: Promise.resolve({
            stdout: lines.join("\n"),
            stderr: "",
            status: 0,
            timedOut: false,
          }),
          acquired: () => undefined,
          kill: () => undefined,
        };
      };

      const program = createProductionComposer({
        environment: {
          HOME: home,
          PATH: "/synthetic/bin:/synthetic/usr/bin",
          HARNESS_MODEL: "synthetic/model-large",
          HARNESS_SMALL_MODEL: "synthetic/model-small",
        },
        cwd: checkout.directory,
        homeDirectory: home,
        workingName: "delivery-os",
        repositoryFacts: { originUrl: GITHUB_ORIGIN },
        harnessSpawnRunner: runner,
        harnessSpawnStarter: starter,
        // A failing credential port keeps the truth read hermetic: the provider
        // read is refused before any request leaves the process.
        credentials: {
          resolve: () => ({
            ok: false,
            code: "config.credential.missing",
            domainKind: "config",
            category: "user",
            retryable: false,
            consequence: "not_landed",
            projectionClass: "user-validation",
          }),
        },
      })(brand);

      const definition = program.commands.dispatch;
      expect(definition).toBeDefined();
      if (definition === undefined) return;
      const outcome = (await definition.handler({
        command: "dispatch",
        flags: {},
        argv: ["GH-301"],
        positionals: ["GH-301"],
        brand,
      })) as {
        readonly data?: {
          readonly result?: string;
          readonly error?: { readonly code?: string; readonly summary?: string };
        };
        readonly error?: { readonly code?: string; readonly summary?: string };
      };

      // The refusal is pre-session: the harness port records zero spawns and the
      // one-shot runner is not invoked, so no session or attempt exists.
      expect(starterInvocations).toHaveLength(0);
      expect(invocations).toHaveLength(0);
      expect(outcome.data).toBeUndefined();
      expect(outcome.error?.code).toBe("config.credential.missing");
      expect(outcome.error?.summary).toContain("GITHUB_TOKEN");
      expect(outcome.error?.summary).toContain("github-read");

      const attempts = readDispatchAttempts(store);
      expect(attempts.ok).toBe(true);
      if (attempts.ok) expect(attempts.records).toHaveLength(0);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

/* ----------------------------- truth-read proof ----------------------------- */

const CHANGE_REF = "GH-239";
const BRANCH = "feat/GH-239/dispatch-engine";
const HEAD_SHA = "a".repeat(40);

const gitOk = (stdout: string): GitChildRunnerResult => ({
  stdout,
  stderr: "",
  status: 0,
  timedOut: false,
});

const credentialPort = (missing: boolean): CredentialPort => ({
  resolve: () =>
    missing
      ? {
          ok: false,
          code: "config.credential.missing",
          domainKind: "config",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          projectionClass: "user-validation",
        }
      : { ok: true, material: { value: "synthetic-token" } },
});

/** The recording harness runner: one completed session, no harness process. */
const completedSessionRunner: HarnessSpawnRunner = async (): Promise<HarnessSpawnRunnerResult> => ({
  stdout: JSON.stringify({ session: { id: "ses-truth" }, result: { completion: "complete" } }),
  stderr: "",
  status: 0,
  timedOut: false,
});

type TruthScenario = {
  /** The local change branch; absent proves the no-branch artifact path. */
  readonly branch?: string;
  readonly openPullRequests?: readonly unknown[];
  readonly closedPullRequests?: readonly unknown[];
  readonly issue?: unknown;
  readonly checkRuns?: readonly unknown[];
  /** The `base..branch` count the git runner reports. */
  readonly ahead?: string;
  readonly credentialMissing?: boolean;
  readonly transportFails?: boolean;
};

type TruthObservation = {
  readonly exit: number;
  readonly data?: DispatchEnvelopeData;
  readonly error?: { readonly code: string; readonly summary?: string };
  readonly requests: readonly string[];
  readonly gitArgv: readonly string[];
  readonly attempts: readonly {
    readonly token: string;
    readonly comparison: DispatchComparisonRecord;
    readonly falseSuccess: boolean;
    readonly corroboration: {
      readonly pmNotes: string;
      readonly tracker: string;
      readonly ci: string;
    };
    readonly divergenceRef?: string;
  }[];
};

const OPEN_ISSUE = { number: 239, title: "Dispatch engine", state: "open", labels: [] };

const openPullRequest = (number: unknown): unknown => ({
  number,
  state: "open",
  head: { ref: BRANCH, sha: HEAD_SHA },
  base: { ref: "main-tools" },
});

const mergedPullRequest = (): unknown => ({
  number: 77,
  state: "closed",
  merged_at: "2026-11-08T09:00:00Z",
  head: { ref: BRANCH, sha: HEAD_SHA },
  base: { ref: "main-tools" },
});

const successChecks = [{ id: 1, name: "ci", status: "completed", conclusion: "success" }];

/** The provider web address the composed read derives for one request number. */
const expectedPrUrl = (): string => "https://github.com/owner/repo/pull";

/** Run one production-composed dispatch over the injected seams. */
const observeTruth = async (scenario: TruthScenario): Promise<TruthObservation> => {
  const brandResult = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!brandResult.ok) throw new Error("brand resolution failed");
  const brand = brandResult.value;
  const base = join(ROOT, "tmp", "tmpdir");
  mkdirSync(base, { recursive: true });
  const home = mkdtempSync(join(base, "gh239-truth-"));
  const checkout = createCheckout(home, "checkout", GITHUB_ORIGIN);
  const requests: string[] = [];
  const gitArgv: string[] = [];
  try {
    const store = createStateStore(
      {
        level: "local",
        workspaceId: "default",
        fenceNamespace: "cli",
        schemaVersion: STATE_SCHEMA_VERSION,
        stateDirectory: join(home, brand.stateDirectoryName),
      },
      { driver: "jsonl", edge: createNodeStateEdge() },
    );
    const facts = { originUrl: GITHUB_ORIGIN };
    const repository = "github.com/owner/repo";
    const seeded = declareQueueEntry(store, {
      ref: CHANGE_REF,
      repository,
      repositoryRoot: ROOT,
      recordedAt: new Date().toISOString(),
      fenceToken: "seed-fence",
    });
    if (!seeded.ok) throw new Error("queue seeding failed");

    const gitRunner: GitChildRunner = async (_file, args) => {
      gitArgv.push(args.join(" "));
      const [verb] = args;
      if (verb === "for-each-ref") {
        return gitOk(scenario.branch === undefined ? "" : `${scenario.branch} ${HEAD_SHA}`);
      }
      if (verb === "rev-list") {
        return gitOk(scenario.ahead ?? "0");
      }
      return { stdout: "", stderr: "unexpected git argv", status: 1, timedOut: false };
    };

    const transport = {
      send: async (request: { readonly url: string }) => {
        requests.push(request.url);
        const path = request.url.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/u, "");
        // The admission read must succeed so a post-session failure is reachable;
        // only the later provider reads fail here.
        if (scenario.transportFails === true && !path.startsWith("/issues/")) {
          throw new Error("synthetic transport failure");
        }
        if (path.startsWith("/pulls?")) {
          return {
            status: 200,
            body: request.url.includes("state=closed")
              ? (scenario.closedPullRequests ?? [])
              : (scenario.openPullRequests ?? []),
          };
        }
        if (path.startsWith("/issues/")) {
          return { status: 200, body: scenario.issue ?? OPEN_ISSUE };
        }
        if (path.includes("/check-runs")) {
          return { status: 200, body: { check_runs: scenario.checkRuns ?? successChecks } };
        }
        return { status: 404, body: {} };
      },
    };

    const program = createProductionComposer({
      environment: {
        HOME: home,
        PATH: "/synthetic/bin:/synthetic/usr/bin",
        HARNESS_MODEL: "synthetic/model-large",
        HARNESS_SMALL_MODEL: "synthetic/model-small",
      },
      cwd: checkout.directory,
      homeDirectory: home,
      workingName: "delivery-os",
      repositoryFacts: facts,
      harnessSpawnRunner: completedSessionRunner,
      harnessSpawnStarter: streamStarterFromRunner(completedSessionRunner),
      credentials: credentialPort(scenario.credentialMissing === true),
      githubTransport: transport,
      gitChildRunner: gitRunner,
    })(brand);

    const out: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: () => undefined },
    };
    const exit = await runCli(["dispatch", CHANGE_REF, "--json"], streams, {
      brand,
      clock: { now: () => Date.parse("2026-11-08T10:00:00.000Z") },
      newRunId: () => "run-truth",
      secrets: [],
      program,
    });
    const text = out.join("").trim();
    const envelope = text.startsWith("{")
      ? (JSON.parse(text) as { data?: DispatchEnvelopeData; error?: TruthObservation["error"] })
      : {};
    const read = readDispatchAttempts(store);
    if (!read.ok) throw new Error("attempt read failed");
    return {
      exit,
      ...(envelope.data === undefined ? {} : { data: envelope.data }),
      ...(envelope.error === undefined ? {} : { error: envelope.error }),
      requests,
      gitArgv,
      attempts: read.records.map((record) => ({
        token: record.token,
        comparison: record.comparison,
        falseSuccess: record.falseSuccess,
        corroboration: record.corroboration,
        ...(record.divergenceRef === undefined ? {} : { divergenceRef: record.divergenceRef }),
      })),
    };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
};

describe("the production truth read classifies artifact and tracker truth", () => {
  test("an open pull request on the change branch classifies pr-open", async () => {
    const observed = await observeTruth({
      branch: BRANCH,
      openPullRequests: [openPullRequest(42)],
      ahead: "3",
    });

    expect(observed.exit).toBe(0);
    expect(observed.data?.result).toBe("pr-open");
    expect(observed.data?.prUrl).toBe(`${expectedPrUrl()}/42`);
    expect(observed.data?.error).toBeUndefined();
    expect(typeof observed.data?.outcome).toBe("string");
    expect(observed.attempts).toHaveLength(1);
    expect(observed.attempts[0]?.token).toBe("pr-open");
    expect(observed.attempts[0]?.comparison).toEqual({
      class: "tracker-truth",
      token: "pr-open",
      outcome: "match",
      urlResolved: true,
    });
    expect(observed.attempts[0]?.divergenceRef).toBeUndefined();
    expect(observed.attempts[0]?.falseSuccess).toBe(false);
    expect(observed.attempts[0]?.corroboration.tracker).toBe("satisfied");

    // The real reads ran: branch history through git, provider facts over the
    // injected transport only.
    expect(observed.gitArgv.some((argv) => argv.startsWith("rev-list --count"))).toBe(true);
    expect(observed.gitArgv.some((argv) => argv.startsWith("for-each-ref"))).toBe(true);
    expect(observed.requests.length).toBeGreaterThan(0);
    for (const url of observed.requests) {
      expect(url.startsWith("https://api.github.com/repos/")).toBe(true);
    }
  });

  test("an already-merged pull request classifies merged and resolves its URL", async () => {
    const observed = await observeTruth({
      branch: BRANCH,
      openPullRequests: [],
      closedPullRequests: [mergedPullRequest()],
      ahead: "3",
    });

    expect(observed.exit).toBe(0);
    expect(observed.data?.result).toBe("merged");
    expect(observed.data?.prUrl).toBe(`${expectedPrUrl()}/77`);
    expect(observed.attempts[0]?.token).toBe("merged");
    expect(observed.attempts[0]?.comparison.class).toBe("tracker-truth");
    expect(observed.attempts[0]?.comparison.token).toBe("merged");
    expect(observed.attempts[0]?.comparison.outcome).toBe("match");
    expect(observed.attempts[0]?.divergenceRef).toBeUndefined();
    // The CI read on the pushed head is real: green checks satisfy the claim's
    // CI corroboration instead of leaving it permanently unreadable.
    expect(observed.attempts[0]?.corroboration.ci).toBe("satisfied");
  });

  test("an owner-attention label on the work item classifies blocked", async () => {
    const observed = await observeTruth({
      branch: BRANCH,
      openPullRequests: [openPullRequest(42)],
      issue: { ...OPEN_ISSUE, labels: [{ name: "human-input-needed" }] },
      ahead: "3",
    });

    expect(observed.exit).toBe(0);
    expect(observed.data?.result).toBe("blocked");
    expect(observed.attempts[0]?.token).toBe("blocked");
    expect(observed.attempts[0]?.comparison).toEqual({
      class: "tracker-truth",
      token: "blocked",
      outcome: "match",
      urlResolved: false,
    });
  });

  test("an open pull request without an addressable URL classifies pr-open-unverified", async () => {
    const observed = await observeTruth({
      branch: BRANCH,
      openPullRequests: [openPullRequest("PR-42")],
      ahead: "3",
    });

    expect(observed.exit).toBe(0);
    expect(observed.data?.result).toBe("pr-open-unverified");
    expect(observed.data?.prUrl).toBe("");
    expect(observed.attempts[0]?.token).toBe("pr-open-unverified");
    expect(observed.attempts[0]?.comparison).toMatchObject({
      class: "tracker-truth",
      outcome: "match",
      urlResolved: false,
    });
    // The independent tracker baseline is the open request itself; the concrete
    // address is the engine-side attribute, never a second tracker token.
    expect(observed.attempts[0]?.comparison.token).toBe("pr-open");
    expect(observed.attempts[0]?.falseSuccess).toBe(false);
    expect(observed.attempts[0]?.divergenceRef).toBeUndefined();
  });

  test("a change branch that does not exist reads zero branch commits", async () => {
    const observed = await observeTruth({ openPullRequests: [], closedPullRequests: [] });

    expect(observed.gitArgv.some((argv) => argv.startsWith("rev-list"))).toBe(false);
    expect(observed.data?.result).toBeDefined();
    expect(observed.attempts).toHaveLength(1);
  });

  test("a non-green check set never corroborates a merged claim", async () => {
    for (const checkRuns of [
      [{ id: 1, name: "ci", status: "completed", conclusion: "failure" }],
      [{ id: 1, name: "ci", status: "in_progress", conclusion: null }],
      [],
    ]) {
      const observed = await observeTruth({
        branch: BRANCH,
        openPullRequests: [],
        closedPullRequests: [mergedPullRequest()],
        checkRuns,
        ahead: "3",
      });
      expect(observed.data?.result).toBe("merged");
      expect(observed.attempts[0]?.corroboration.ci).toBe("unsatisfied");
    }
  });
});

describe("the production truth read keeps honest failure classified", () => {
  test("a missing credential refuses pre-session with no attempt (TC-ADMIT-005 inversion)", async () => {
    const observed = await observeTruth({ branch: BRANCH, credentialMissing: true });

    expect(observed.exit).toBe(1);
    expect(observed.data).toBeUndefined();
    expect(observed.error?.code).toBe("config.credential.missing");
    expect(observed.error?.summary).toContain("GITHUB_TOKEN");
    expect(observed.error?.summary).toContain("github-read");
    // The credential resolves before any request leaves the process.
    expect(observed.requests).toEqual([]);
    expect(observed.attempts).toHaveLength(0);
  });

  test("a post-session provider transport failure classifies state-unverified", async () => {
    const observed = await observeTruth({
      branch: BRANCH,
      openPullRequests: [openPullRequest(42)],
      transportFails: true,
    });

    // The admission issue read succeeded; the later provider read failed.
    expect(observed.exit).toBe(2);
    expect(observed.data?.result).toBe("state-unverified");
    expect(observed.data?.error?.code).toBe("dispatch.state-unverified");
    expect(observed.data?.error?.summary).toContain("provider.payload.invalid");
    expect(observed.attempts[0]?.token).toBe("state-unverified");
    expect(observed.requests.length).toBeGreaterThan(0);
  });
});

describe("TC-ADMIT-004 the positive control reaches a real verdict", () => {
  test("a provisioned credential and readable truth derive a token other than state-unverified", async () => {
    const observed = await observeTruth({
      branch: BRANCH,
      openPullRequests: [openPullRequest(42)],
      ahead: "3",
    });
    expect(observed.data?.result).toBe("pr-open");
    expect(observed.data?.result).not.toBe("state-unverified");
    expect(observed.attempts).toHaveLength(1);
  });
});

describe("TC-ADMIT-008 the no-preflight control preserves the delivered order", () => {
  test("a direct engine caller without the port still spawns and classifies state-unverified", async () => {
    const scenario = createCommandScenario({
      reads: readsFrom({ tracker: readFail("tracker", "config.credential.missing") }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("the production composition supplies and orders the preflight", () => {
  test("production wires the preflight and the engine invokes it before claimLease", () => {
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    const engine = readFileSync(join(ROOT, "packages/core/src/app/dispatch.ts"), "utf8");
    expect(production).toContain("preflight: dispatchPreflight");
    expect(engine.indexOf("ports.preflight()")).toBeGreaterThan(0);
    expect(engine.indexOf("ports.preflight()")).toBeLessThan(
      engine.indexOf("const claimed = ports.claimLease()"),
    );
  });
});

/* ----------------------- production gate and resume proof ------------------ */

type ProductionHarness = {
  readonly brand: BrandIdentity;
  readonly home: string;
  readonly checkout: string;
  readonly commonDir: string;
  readonly store: StateStorePort;
  readonly program: ReturnType<ReturnType<typeof createProductionComposer>>;
  readonly spawns: readonly { readonly command: string; readonly args: readonly string[] }[];
  readonly dispose: () => void;
};

/**
 * Compose the shipped production program over a temp state root with every
 * external seam injected. The checkout remote is injected, so no real origin is
 * required (F-12); an existing `home` re-opens the same state root.
 */
const createProductionHarness = (input: {
  readonly label: string;
  readonly home?: string;
  /** An existing checkout directory; a fresh one is created under the home. */
  readonly checkout?: string;
  readonly originUrl?: string;
  readonly credentialMissing?: boolean;
  readonly transport?: { send: (request: { readonly url: string }) => Promise<unknown> };
  readonly gitRunner?: GitChildRunner;
}): ProductionHarness => {
  const brandResult = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!brandResult.ok) throw new Error("brand resolution failed");
  const brand = brandResult.value;
  const base = join(ROOT, "tmp", "tmpdir");
  mkdirSync(base, { recursive: true });
  const home = input.home ?? mkdtempSync(join(base, input.label));
  const checkout =
    input.checkout === undefined
      ? createCheckout(home, `${input.label}checkout`, input.originUrl)
      : { directory: input.checkout, commonDir: join(input.checkout, ".git") };
  const store = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory: join(home, brand.stateDirectoryName),
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  const spawns: { command: string; args: readonly string[] }[] = [];
  const runner: HarnessSpawnRunner = async (file, args): Promise<HarnessSpawnRunnerResult> => {
    spawns.push({ command: file, args });
    return {
      stdout: JSON.stringify({
        session: { id: "ses-existing" },
        result: { completion: "complete" },
      }),
      stderr: "",
      status: 0,
      timedOut: false,
    };
  };
  const program = createProductionComposer({
    environment: {
      HOME: home,
      PATH: "/synthetic/bin:/synthetic/usr/bin",
      HARNESS_MODEL: "synthetic/model-large",
      HARNESS_SMALL_MODEL: "synthetic/model-small",
    },
    cwd: checkout.directory,
    homeDirectory: home,
    workingName: "delivery-os",
    ...(input.originUrl === undefined
      ? { repositoryFacts: {} }
      : { repositoryFacts: { originUrl: input.originUrl } }),
    harnessSpawnRunner: runner,
    harnessSpawnStarter: streamStarterFromRunner(runner),
    credentials: credentialPort(input.credentialMissing === true),
    // The admission read must not reach the network; a resolved credential plus
    // this hermetic transport keeps the preflight hermetic while the later reads
    // stay unreadable exactly where each suite expects.
    githubTransport:
      input.transport ??
      ({
        send: async (request: { readonly url: string }) =>
          request.url.includes("/issues/")
            ? {
                status: 200,
                body: { number: 301, title: "Hermetic issue", state: "open", labels: [] },
              }
            : { status: 404, body: {} },
      } as { send: (request: { readonly url: string }) => Promise<unknown> }),
    ...(input.gitRunner === undefined ? {} : { gitChildRunner: input.gitRunner }),
  })(brand);
  return {
    brand,
    home,
    checkout: checkout.directory,
    commonDir: checkout.commonDir,
    store,
    program,
    spawns,
    dispose: () => rmSync(home, { recursive: true, force: true }),
  };
};

const invokeProduction = async (
  harness: ProductionHarness,
  argv: readonly string[],
): Promise<{
  readonly exit: number;
  readonly data?: Record<string, unknown>;
  readonly error?: { readonly code: string; readonly summary?: string };
}> => {
  const out: string[] = [];
  const streams: CliStreams = {
    stdout: { write: (chunk: string) => out.push(chunk) },
    stderr: { write: () => undefined },
  };
  const exit = await runCli(argv, streams, {
    brand: harness.brand,
    clock: { now: () => Date.parse("2026-11-08T10:00:00.000Z") },
    newRunId: () => "run-production",
    secrets: [],
    program: harness.program,
  });
  const text = out.join("").trim();
  const envelope = text.startsWith("{")
    ? (JSON.parse(text) as {
        data?: Record<string, unknown>;
        error?: { code: string; summary?: string };
      })
    : {};
  return {
    exit,
    ...(envelope.data === undefined ? {} : { data: envelope.data }),
    ...(envelope.error === undefined ? {} : { error: envelope.error }),
  };
};

describe("the production composer exposes the dual-run gate and handover", () => {
  test("summary, handover, resolve, and reversal run through the shipped CLI", async () => {
    const harness = createProductionHarness({ label: "gh239-gate-", originUrl: GITHUB_ORIGIN });
    try {
      for (const attempt of buildAttempts(eligibleSpecs())) {
        const appended = appendDispatchAttempt(harness.store, "seed-fence", attempt);
        expect(appended.ok).toBe(true);
      }

      const summary = await invokeProduction(harness, [
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      expect(summary.error).toBeUndefined();
      expect(summary.exit).toBe(0);
      expect(summary.data?.repository).toBe(REPOSITORY);
      expect(summary.data?.verdict).toBe("eligible");

      const handover = await invokeProduction(harness, [
        "dispatch",
        "handover",
        REPOSITORY,
        "--json",
      ]);
      expect(handover.error).toBeUndefined();
      expect(handover.exit).toBe(0);
      expect(handover.data).toMatchObject({
        repository: REPOSITORY,
        operation: "authoritative",
        recorded: true,
        noop: false,
      });
      const records = readDispatchHandover(harness.store);
      expect(records.ok && records.records).toHaveLength(1);
      expect(records.ok && records.records[0]?.principal).toBe("local-same-user");

      const replay = await invokeProduction(harness, [
        "dispatch",
        "handover",
        REPOSITORY,
        "--json",
      ]);
      expect(replay.exit).toBe(0);
      expect(replay.data).toMatchObject({ recorded: false, noop: true });

      const divergence = makeDivergence();
      const opened = appendDispatchDivergence(harness.store, "seed-fence", divergence);
      expect(opened.ok).toBe(true);
      const resolved = await invokeProduction(harness, [
        "dispatch",
        "dual-run",
        "resolve",
        divergence.divergenceId,
        "--note",
        "tracker truth re-read",
        "--json",
      ]);
      expect(resolved.error).toBeUndefined();
      expect(resolved.exit).toBe(0);
      expect(resolved.data).toMatchObject({
        divergenceId: divergence.divergenceId,
        state: "resolved",
      });

      const revert = await invokeProduction(harness, [
        "dispatch",
        "handover",
        REPOSITORY,
        "--revert",
        "--json",
      ]);
      expect(revert.exit).toBe(0);
      expect(revert.data).toMatchObject({ operation: "dual-run", recorded: true, noop: false });
    } finally {
      harness.dispose();
    }
  });
});

describe("the production composer resumes the existing lane", () => {
  test("--resume-prompt resumes the delivered session instead of spawning fresh", async () => {
    const harness = createProductionHarness({ label: "gh239-resume-", originUrl: GITHUB_ORIGIN });
    try {
      const queued = declareQueueEntry(harness.store, {
        ref: CHANGE_REF,
        repository: REPOSITORY,
        repositoryRoot: ROOT,
        recordedAt: new Date().toISOString(),
        fenceToken: "seed-fence",
      });
      expect(queued.ok).toBe(true);
      const seeded = appendDaemonLane(harness.store, "seed-fence", {
        schema: DAEMON_LANE_PAYLOAD_SCHEMA,
        ref: CHANGE_REF,
        state: "delivering",
        harnessKind: "opencode",
        sessionId: "ses-existing",
        ledgerPosition: { lastCompletedPhase: "specification" },
        spawnOrdinal: 1,
        recordedAt: "2026-11-08T09:00:00.000Z",
      });
      expect(seeded.ok).toBe(true);

      const run = await invokeProduction(harness, [
        "dispatch",
        CHANGE_REF,
        "--resume-prompt",
        "continue",
        "--json",
      ]);
      // The resume is a session resume: the delivered port passes `--session`
      // with the persisted id; a fresh spawn would omit it.
      expect(harness.spawns).toHaveLength(1);
      expect(harness.spawns[0]?.command.startsWith("opencode")).toBe(true);
      expect(harness.spawns[0]?.args).toContain("--session");
      expect(harness.spawns[0]?.args).toContain("ses-existing");

      const attempts = readDispatchAttempts(harness.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      expect(attempts.records).toHaveLength(1);
      expect(attempts.records[0]?.resumeMode).toBe("attach-continue");
      expect(run.exit).toBe(2);
    } finally {
      harness.dispose();
    }
  });

  test("a restart-budget refusal appends the terminal exhaustion record", async () => {
    const harness = createProductionHarness({ label: "gh239-budget-", originUrl: GITHUB_ORIGIN });
    try {
      const queued = declareQueueEntry(harness.store, {
        ref: CHANGE_REF,
        repository: REPOSITORY,
        repositoryRoot: ROOT,
        recordedAt: new Date().toISOString(),
        fenceToken: "seed-fence",
      });
      expect(queued.ok).toBe(true);
      const seeded = appendDaemonLane(harness.store, "seed-fence", {
        schema: DAEMON_LANE_PAYLOAD_SCHEMA,
        ref: CHANGE_REF,
        state: "delivering",
        harnessKind: "opencode",
        sessionId: "ses-existing",
        spawnOrdinal: 4,
        recordedAt: "2026-11-08T09:00:00.000Z",
      });
      expect(seeded.ok).toBe(true);
      for (const ordinal of [1, 2, 3]) {
        const appended = appendEconomicsRestartEvent(harness.store, "seed-fence", {
          schemaId: "delivery.economics.restart.v1",
          workItemRef: CHANGE_REF,
          runId: "ses-existing",
          sessionId: "ses-existing",
          ordinal,
          reason: "session-interrupted",
          recordedAt: "2026-11-08T09:00:00.000Z",
        });
        expect(appended.ok).toBe(true);
      }

      const run = await invokeProduction(harness, [
        "dispatch",
        CHANGE_REF,
        "--resume-prompt",
        "retry",
        "--json",
      ]);
      expect(run.exit).toBe(1);
      expect(run.data?.result).toBe("max-restarts");
      expect((run.data?.error as { code?: string } | undefined)?.code).toBe(
        "dispatch.restart-budget-exceeded",
      );
      // No spawn and no resume occurred; the refusal is decided before one.
      expect(harness.spawns).toHaveLength(0);
      const economics = readEconomicsRecords(harness.store, CHANGE_REF);
      expect(economics.ok && economics.terminal !== undefined).toBe(true);
      const attempts = readDispatchAttempts(harness.store);
      expect(attempts.ok && attempts.records).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });
});

describe("the production composer keeps the repository identity rename-invariant", () => {
  test("a renamed checkout with a changed remote and scheduler key reuses its binding", async () => {
    const first = createProductionHarness({ label: "gh239-identity-", originUrl: GITHUB_ORIGIN });
    try {
      const seeded = declareQueueEntry(first.store, {
        ref: CHANGE_REF,
        repository: "github.com/owner/alpha",
        repositoryRoot: first.checkout,
        recordedAt: new Date().toISOString(),
        fenceToken: "seed-fence",
      });
      expect(seeded.ok).toBe(true);
      const run = await invokeProduction(first, ["dispatch", CHANGE_REF, "--json"]);
      expect(run.exit).toBe(2);
      const attempts = readDispatchAttempts(first.store);
      expect(attempts.ok && attempts.records[0]?.repository).toBe("github.com/owner/alpha");
      // The binding lives with this checkout, not in the shared state root.
      expect(markerOf(first.commonDir)).toBe(serializeIdentityMarker("github.com/owner/alpha"));

      // Rename the checkout directory and change its remote, keeping the same
      // home/state root. The checkout-scoped marker governs, so history is
      // never re-keyed (AC-F6-6).
      const renamedDirectory = join(first.home, "renamed");
      renameSync(first.checkout, renamedDirectory);
      writeFileSync(
        join(renamedDirectory, ".git", "config"),
        `[remote "origin"]\n\turl = https://github.com/owner/renamed.git\n`,
      );
      const renamed = createProductionHarness({
        label: "gh239-identity-renamed-",
        home: first.home,
        checkout: renamedDirectory,
        originUrl: "https://github.com/owner/renamed.git",
      });
      try {
        expect(markerOf(renamed.commonDir)).toBe(serializeIdentityMarker("github.com/owner/alpha"));
        const requeued = declareQueueEntry(renamed.store, {
          ref: CHANGE_REF,
          repository: "github.com/owner/renamed",
          repositoryRoot: renamed.checkout,
          recordedAt: new Date(Date.now() + 1000).toISOString(),
          fenceToken: "seed-fence-2",
        });
        expect(requeued.ok).toBe(true);

        const summary = await invokeProduction(renamed, [
          "dispatch",
          "dual-run",
          "summary",
          "--repo",
          "github.com/owner/renamed",
          "--json",
        ]);
        expect(summary.error).toBeUndefined();
        expect(summary.exit).toBe(0);
        expect(summary.data?.repository).toBe("github.com/owner/alpha");

        const rerun = await invokeProduction(renamed, ["dispatch", CHANGE_REF, "--json"]);
        expect(rerun.exit).toBe(2);
        const recorded = readDispatchAttempts(renamed.store);
        expect(recorded.ok && recorded.records[1]?.repository).toBe("github.com/owner/alpha");
      } finally {
        // The renamed harness shares the first home; disposing it also clears
        // that shared state root, and the outer dispose is idempotent.
        renamed.dispose();
      }
    } finally {
      first.dispose();
    }
  });

  test("two checkouts in one home bind and record under their own identities", async () => {
    const alpha = createProductionHarness({
      label: "gh239-iso-alpha-",
      originUrl: "https://github.com/acme/alpha.git",
    });
    try {
      const beta = createProductionHarness({
        label: "gh239-iso-beta-",
        home: alpha.home,
        originUrl: "https://github.com/acme/beta.git",
      });
      try {
        // The same home/state root serves both checkouts; each queue entry names
        // its own repository.
        for (const [harness, ref, repository] of [
          [alpha, "GH-901", "github.com/acme/alpha"],
          [beta, "GH-902", "github.com/acme/beta"],
        ] as const) {
          const queued = declareQueueEntry(harness.store, {
            ref,
            repository,
            repositoryRoot: harness.checkout,
            recordedAt: new Date().toISOString(),
            fenceToken: `seed-${ref}`,
          });
          expect(queued.ok).toBe(true);
          const run = await invokeProduction(harness, ["dispatch", ref, "--json"]);
          expect(run.exit).toBe(2);
        }

        const attempts = readDispatchAttempts(beta.store);
        expect(attempts.ok).toBe(true);
        const repositoryByRef = new Map(
          attempts.ok ? attempts.records.map((record) => [record.ref, record.repository]) : [],
        );
        expect(repositoryByRef.get("GH-901")).toBe("github.com/acme/alpha");
        expect(repositoryByRef.get("GH-902")).toBe("github.com/acme/beta");
        expect(markerOf(alpha.commonDir)).toBe(serializeIdentityMarker("github.com/acme/alpha"));
        expect(markerOf(beta.commonDir)).toBe(serializeIdentityMarker("github.com/acme/beta"));

        // A third checkout's read-only summary must not bind its --repo argument.
        const gamma = createCheckout(alpha.home, "gamma", "https://github.com/acme/gamma.git");
        const gammaHarness = createProductionHarness({
          label: "gh239-iso-gamma-",
          home: alpha.home,
          checkout: gamma.directory,
          originUrl: "https://github.com/acme/gamma.git",
        });
        try {
          const summary = await invokeProduction(gammaHarness, [
            "dispatch",
            "dual-run",
            "summary",
            "--repo",
            "github.com/acme/other",
            "--json",
          ]);
          expect(summary.error).toBeUndefined();
          expect(summary.exit).toBe(0);
          expect(markerOf(gamma.commonDir)).toBeUndefined();

          const alphaSummary = await invokeProduction(gammaHarness, [
            "dispatch",
            "dual-run",
            "summary",
            "--repo",
            "github.com/acme/alpha",
            "--json",
          ]);
          expect(alphaSummary.exit).toBe(0);
          expect(alphaSummary.data?.repository).toBe("github.com/acme/alpha");
          expect(markerOf(gamma.commonDir)).toBeUndefined();
        } finally {
          // The gamma harness shares the home with alpha/beta; the outer dispose
          // clears it, so only its own checkout is removed here.
          rmSync(gamma.directory, { recursive: true, force: true });
        }

        // The read-only reads never re-keyed either checkout's binding.
        expect(markerOf(alpha.commonDir)).toBe(serializeIdentityMarker("github.com/acme/alpha"));
        expect(markerOf(beta.commonDir)).toBe(serializeIdentityMarker("github.com/acme/beta"));
      } finally {
        beta.dispose();
      }
    } finally {
      alpha.dispose();
    }
  });

  test("a torn marker binds nothing and the next dispatch repairs it", async () => {
    const harness = createProductionHarness({ label: "gh239-torn-", originUrl: GITHUB_ORIGIN });
    try {
      writeFileSync(
        dispatchIdentityMarkerPath(harness.commonDir),
        '{"schema":"delivery.dispatch.identity.v1","repository":',
      );
      const seeded = declareQueueEntry(harness.store, {
        ref: CHANGE_REF,
        repository: "github.com/owner/torn",
        repositoryRoot: harness.checkout,
        recordedAt: new Date().toISOString(),
        fenceToken: "seed-fence-torn",
      });
      expect(seeded.ok).toBe(true);

      const run = await invokeProduction(harness, ["dispatch", CHANGE_REF, "--json"]);
      expect(run.exit).toBe(2);
      const attempts = readDispatchAttempts(harness.store);
      // The torn marker carried no binding, so the queue key governed the run.
      expect(attempts.ok && attempts.records[0]?.repository).toBe("github.com/owner/torn");
      // The run repaired it in place instead of leaving it unrepairable.
      expect(markerOf(harness.commonDir)).toBe(serializeIdentityMarker("github.com/owner/torn"));
      expect(readdirSync(harness.commonDir).filter((name) => name.endsWith(".tmp"))).toEqual([]);

      // A later run with a different scheduler key reads the repaired binding.
      const requeued = declareQueueEntry(harness.store, {
        ref: CHANGE_REF,
        repository: "github.com/owner/rival",
        repositoryRoot: harness.checkout,
        recordedAt: new Date(Date.now() + 1000).toISOString(),
        fenceToken: "seed-fence-torn-2",
      });
      expect(requeued.ok).toBe(true);
      const rerun = await invokeProduction(harness, ["dispatch", CHANGE_REF, "--json"]);
      expect(rerun.exit).toBe(2);
      const recorded = readDispatchAttempts(harness.store);
      expect(recorded.ok && recorded.records[1]?.repository).toBe("github.com/owner/torn");
    } finally {
      harness.dispose();
    }
  });

  test("an unresolvable identity refuses cleanly at exit 1", async () => {
    const harness = createProductionHarness({ label: "gh239-unresolvable-" });
    try {
      const summary = await invokeProduction(harness, [
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        "not-a-repository",
        "--json",
      ]);
      expect(summary.exit).toBe(1);
      expect(summary.error?.code).toBe("input.value.rejected");
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-OCS-060 each harness receives exactly its declared seams", () => {
  test("opencode is built with the streaming starter; Claude is not", () => {
    const source = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(source).toContain("facts.harnessSpawnStarter ?? createHostSpawnStarter()");
    const opencodeStart = source.indexOf("createOpencodeSession({");
    const claudeStart = source.indexOf("createClaudeSession({");
    expect(opencodeStart).toBeGreaterThan(0);
    expect(claudeStart).toBeGreaterThan(opencodeStart);
    const opencodeBranch = source.slice(opencodeStart, claudeStart);
    expect(opencodeBranch).toContain("starter: harnessSpawnStarter");
    const claudeBranch = source.slice(claudeStart, source.indexOf("});", claudeStart));
    expect(claudeBranch).not.toContain("starter");
    expect(claudeBranch).toContain("...common");
  });

  test("both harnesses classify through the one shared reference", async () => {
    const { createClaudeSession, createOpencodeSession } = await import(
      "../../packages/adapters/src/harness/index"
    );
    const { classifyHarnessEvidence } = await import("../../packages/core/src/domain/index");
    const { streamStarterFromRunner } = await import("../fixtures/harness/harness-io");
    const runner = async () => ({ stdout: "", stderr: "", status: 0, timedOut: false });
    const common = {
      command: "synthetic",
      runner,
      buildEnvironment: () => ({ ok: true as const, value: {} }),
      classify: classifyHarnessEvidence,
      assembleLiveness: () => ({ readings: [] }),
      now: () => "2026-11-08T10:00:00.000Z",
    };
    const opencode = createOpencodeSession({
      ...common,
      starter: streamStarterFromRunner(runner),
    });
    const claude = createClaudeSession(common);
    expect(opencode.classify).toBe(classifyHarnessEvidence);
    expect(claude.classify).toBe(classifyHarnessEvidence);
    expect(opencode.classify).toBe(claude.classify);
    expect(Object.keys(claude)).not.toContain("starter");
  });
});
