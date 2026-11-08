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
 * child runner, a credential port, and the harness spawn runner), so no network,
 * no model, and no checkout mutation happens. A source that genuinely fails
 * keeps its classified identity and the dispatch classifies `state-unverified`.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { declareQueueEntry } from "../../packages/core/src/app/queue";
import type {
  CredentialPort,
  DispatchComparisonRecord,
  DispatchEnvelopeData,
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
} from "../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/state/index";
import { createProductionComposer } from "../../packages/cli/src/production";
import { runCli, type CliStreams } from "../../packages/cli/src/index";
import { normalizeRepositoryRemote } from "../../packages/core/src/domain/dispatch-identity";
import {
  nodeRepositoryIo,
  parseGitHubRemote,
  readRepositoryFacts,
} from "../../packages/adapters/src/repo/index";
import type { GitChildRunner, GitChildRunnerResult } from "../../packages/adapters/src/git/index";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

const ROOT = process.cwd();

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
  test("a production-composed dispatch spawns through the delivered port", async () => {
    const base = join(ROOT, "tmp", "tmpdir");
    mkdirSync(base, { recursive: true });
    const home = mkdtempSync(join(base, "gh239-production-"));
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
      const repositoryFacts = readRepositoryFacts({ cwd: ROOT, io: nodeRepositoryIo() });
      const repository = normalizeRepositoryRemote(repositoryFacts.originUrl);
      expect(repository).toBeDefined();
      if (repository === undefined) return;
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
        return {
          stdout: JSON.stringify({
            session: { id: "ses-production-1" },
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
          HARNESS_MODEL: "synthetic/model-large",
          HARNESS_SMALL_MODEL: "synthetic/model-small",
        },
        cwd: ROOT,
        homeDirectory: home,
        workingName: "delivery-os",
        harnessSpawnRunner: runner,
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
        readonly error?: { readonly code?: string };
      };

      expect(invocations).toHaveLength(1);
      expect(invocations[0]?.command.startsWith("opencode ")).toBe(true);
      expect(Object.keys(invocations[0]?.environment ?? {}).sort()).toEqual([
        "DELIVERY_WORK_PATH",
        "HARNESS_MODEL",
        "HARNESS_SMALL_MODEL",
      ]);
      expect(outcome.error).toBeUndefined();
      expect(outcome.data?.result).toBeDefined();
      expect(outcome.data?.result).not.toBe("harness.capability.gap");
      // The composed truth read is honest: an unresolvable provider credential
      // classifies `state-unverified` with its own identity, never a fabricated
      // artifact or tracker fact.
      expect(outcome.data?.result).toBe("state-unverified");
      expect(outcome.data?.error?.code).toBe("dispatch.state-unverified");
      expect(outcome.data?.error?.summary).toContain("config.credential.missing");

      const attempts = readDispatchAttempts(store);
      expect(attempts.ok).toBe(true);
      if (attempts.ok) {
        expect(attempts.records).toHaveLength(1);
        expect(attempts.records[0]?.evidenceClass).toBe("pilot");
      }
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
const expectedPrUrl = (): string => {
  const facts = readRepositoryFacts({ cwd: ROOT, io: nodeRepositoryIo() });
  const parsed = parseGitHubRemote(facts.originUrl);
  if (!parsed.ok) throw new Error("origin is not a GitHub remote");
  return `https://github.com/${parsed.owner}/${parsed.name}/pull`;
};

/** Run one production-composed dispatch over the injected seams. */
const observeTruth = async (scenario: TruthScenario): Promise<TruthObservation> => {
  const brandResult = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!brandResult.ok) throw new Error("brand resolution failed");
  const brand = brandResult.value;
  const base = join(ROOT, "tmp", "tmpdir");
  mkdirSync(base, { recursive: true });
  const home = mkdtempSync(join(base, "gh239-truth-"));
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
    const facts = readRepositoryFacts({ cwd: ROOT, io: nodeRepositoryIo() });
    const repository = normalizeRepositoryRemote(facts.originUrl);
    if (repository === undefined) throw new Error("repository identity is unresolvable");
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
        if (scenario.transportFails === true) throw new Error("synthetic transport failure");
        const path = request.url.replace(/^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+/u, "");
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
        HARNESS_MODEL: "synthetic/model-large",
        HARNESS_SMALL_MODEL: "synthetic/model-small",
      },
      cwd: ROOT,
      homeDirectory: home,
      workingName: "delivery-os",
      harnessSpawnRunner: completedSessionRunner,
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
    expect(observed.attempts[0]?.comparison.token).toBe("pr-open-unverified");
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
  test("a missing credential classifies state-unverified with its identity", async () => {
    const observed = await observeTruth({ branch: BRANCH, credentialMissing: true });

    expect(observed.exit).toBe(2);
    expect(observed.data?.result).toBe("state-unverified");
    expect(observed.data?.error?.code).toBe("dispatch.state-unverified");
    expect(observed.data?.error?.summary).toContain("config.credential.missing");
    expect(observed.attempts).toHaveLength(1);
    expect(observed.attempts[0]?.token).toBe("state-unverified");
    // The credential resolves before any request leaves the process.
    expect(observed.requests).toEqual([]);
  });

  test("a provider transport failure classifies state-unverified with its identity", async () => {
    const observed = await observeTruth({
      branch: BRANCH,
      openPullRequests: [openPullRequest(42)],
      transportFails: true,
    });

    expect(observed.exit).toBe(2);
    expect(observed.data?.result).toBe("state-unverified");
    expect(observed.data?.error?.code).toBe("dispatch.state-unverified");
    expect(observed.data?.error?.summary).toContain("provider.payload.invalid");
    expect(observed.attempts[0]?.token).toBe("state-unverified");
    expect(observed.requests.length).toBeGreaterThan(0);
  });
});
