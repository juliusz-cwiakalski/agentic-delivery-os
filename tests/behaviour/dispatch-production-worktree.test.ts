/**
 * F-6 (review remediation, Decision 1-3) — the DEFAULT-mode worktree lane
 * through the REAL production composition:
 * `createProductionComposer` → real CLI program → `queue add` / `dispatch` /
 * `merge` / `closeout --apply` over real temporary git repositories with the
 * real git binary. Only the harness session, the harness version probe, the
 * provider transport, the credentials, and the install/build children are
 * stubbed; the worktree provisioning, the merge post-landing port, and the
 * closeout sweep are the production code paths. Seeded from the reviewer's
 * reproducer probes (outside the repository). Zero timing assertions.
 *
 * Scenarios:
 * 1. Default first dispatch — provision (DETACHED at the base tip), the
 *    lane's phases run in the worktree, the main checkout stays on base and
 *    clean, the lane record carries the worktree path, and the provisioning
 *    children run inside the worktree with the worktree bin leading PATH.
 * 2. Operator resume AFTER the lane created its delivery branch
 *    (`feat/<REF>/<slug>`) in the worktree — accepted per Decision 1.
 * 3. A failed provisioning child — the just-created worktree is rolled back
 *    (F-4a), the refusal carries the stderr tail (F-9), and the recovered
 *    retry provisions fresh.
 * 4. The merge post-landing deletion defers for a worktree-checked-out
 *    branch (Decision 2 — satisfied-by-closeout).
 * 5. Closeout: the production sweep closure copies the runner-log entries to
 *    the state-root destination (Decision 3, real files), deletes the scratch,
 *    observes the POST-sweep cleanliness, and removes nothing on failure.
 * 6. A terminal lane record whose worktree closeout removed provisions fresh
 *    for the ref's new lane (F-4b) instead of refusing.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGitBranchSeam, createGitMergeSeam } from "../../packages/adapters/src/git/index";
import { type CliStreams, runCli } from "../../packages/cli/src/index";
import { createMergeCommandRuntime } from "../../packages/cli/src/edge";
import { createLaneLogSweep, createProductionComposer } from "../../packages/cli/src/production";
import {
  appendDispatchLane,
  latestDispatchLaneFor,
  readDispatchLanes,
} from "../../packages/core/src/app/dispatch-ledger";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import type {
  BrandIdentity,
  CredentialPort,
  DispatchLaneRecord,
  HarnessSpawnRunner,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import { DISPATCH_LANE_PAYLOAD_SCHEMA } from "../../packages/core/src/contracts/dispatch";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/state/index";
import { streamStarterFromRunner } from "../fixtures/harness/stream";
import { projectScopeFor } from "../fixtures/projects/state-scope";
import {
  DEFAULT_MODE_PROVIDER_PROFILES_CONFIG,
  PROVIDER_PROFILES_CONFIG_FILE,
} from "../fixtures/queue/production/harness";

const WORKING_NAME = "delivery-os";
const BRAND: BrandIdentity = (() => {
  const resolved = resolveBrandIdentity({ workingName: WORKING_NAME });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

/** The provider-profiles document WITHOUT the GH-404 exception flag: the default (worktree) production path (review F-6). */
const DEFAULT_MODE_CONFIG = DEFAULT_MODE_PROVIDER_PROFILES_CONFIG;

type Harness = {
  readonly root: string;
  readonly repo: string;
  readonly stateDirectory: string;
  readonly store: StateStorePort;
  readonly run: (
    argv: readonly string[],
    cwd?: string,
  ) => Promise<{
    readonly exitCode: number;
    readonly stdout: string;
    readonly envelope: Record<string, unknown> | undefined;
  }>;
  readonly provisioningChildren: readonly {
    readonly file: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
  }[];
  readonly sessionSpawns: readonly {
    readonly file: string;
    readonly cwd: string;
    readonly env: Readonly<Record<string, string>>;
  }[];
  readonly laneWorktreePath: (ref: string) => string | undefined;
  readonly setProvisionExit: (byArgs: (args: readonly string[]) => number | undefined) => void;
  readonly git: (cwd: string, args: readonly string[]) => string;
  readonly dispose: () => void;
};

const makeHarness = (
  label: string,
  options: {
    /** Maps a provisioning child's argv to the exit code it should report (absent → 0). */
    readonly provisionExit?: (args: readonly string[]) => number | undefined;
  } = {},
): Harness => {
  const root = mkdtempSync(join(tmpdir(), `gh404-prod-${label}-`));
  const repo = join(root, "repo");
  mkdirSync(repo, { recursive: true });
  const git = (cwd: string, args: readonly string[]): string =>
    execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();
  git(repo, ["init", "-q", "-b", "main-tools"]);
  git(repo, ["config", "user.email", "gh404@example.invalid"]);
  git(repo, ["config", "user.name", "GH-404 Production Fixture"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  writeFileSync(join(repo, "README.md"), "fixture\n");
  writeFileSync(join(repo, ".gitignore"), ".delivery-os/\n");
  git(repo, ["add", "README.md", ".gitignore"]);
  git(repo, ["commit", "-q", "-m", "base"]);
  git(repo, ["remote", "add", "origin", "https://github.com/owner/repo.git"]);
  mkdirSync(join(repo, BRAND.configDirectoryName), { recursive: true });
  writeFileSync(
    join(repo, BRAND.configDirectoryName, PROVIDER_PROFILES_CONFIG_FILE),
    DEFAULT_MODE_CONFIG,
  );

  const home = mkdtempSync(join(tmpdir(), `gh404-prod-home-${label}-`));
  const hostRoot = join(home, BRAND.stateDirectoryName);
  const stateDirectory = projectScopeFor({
    cwd: repo,
    hostRoot,
    home,
    brand: BRAND,
  }).scope.stateLocation;

  const provisioningChildren: {
    file: string;
    args: readonly string[];
    cwd: string;
    env: Readonly<Record<string, string>>;
  }[] = [];
  const sessionSpawns: {
    file: string;
    cwd: string;
    env: Readonly<Record<string, string>>;
  }[] = [];
  let provisionExit: (args: readonly string[]) => number | undefined =
    options.provisionExit ?? (() => undefined);
  const spawnRunner: HarnessSpawnRunner = async (file, args, spawnOptions) => {
    if (file === "pnpm") {
      provisioningChildren.push({
        file,
        args,
        cwd: spawnOptions.cwd,
        env: spawnOptions.env,
      });
      return {
        stdout: "",
        stderr: "synthetic install/build child failure\n",
        status: provisionExit(args) ?? 0,
        timedOut: false,
      };
    }
    sessionSpawns.push({ file, cwd: spawnOptions.cwd, env: spawnOptions.env });
    return {
      stdout: JSON.stringify({
        session: { id: "session-404" },
        result: { completion: "complete" },
      }),
      stderr: "",
      status: 0,
      timedOut: false,
    };
  };
  const credentials: CredentialPort = {
    resolve: () => ({ ok: true, material: { value: "synthetic-credential" } }),
  };
  const program = createProductionComposer({
    harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
    environment: {
      HOME: home,
      PATH: process.env.PATH ?? "",
      HARNESS_MODEL: "synthetic/model-large",
      HARNESS_SMALL_MODEL: "synthetic/model-small",
    },
    cwd: repo,
    homeDirectory: home,
    workingName: WORKING_NAME,
    processId: process.pid,
    repositoryFacts: { originUrl: "https://github.com/owner/repo.git" },
    harnessSpawnRunner: spawnRunner,
    harnessSpawnStarter: streamStarterFromRunner(spawnRunner),
    credentials,
    githubTransport: {
      send: async (request: { readonly url: string }) => ({
        status: 200,
        body: request.url.includes("/issues/")
          ? { number: 404, title: "fixture", state: "open", labels: [] }
          : {},
      }),
    },
  })(BRAND);
  const store: StateStorePort = createStateStore(
    {
      level: "local",
      workspaceId: "default",
      fenceNamespace: "cli",
      schemaVersion: STATE_SCHEMA_VERSION,
      stateDirectory,
    },
    { driver: "jsonl", edge: createNodeStateEdge() },
  );
  let ordinal = 0;
  const run = async (argv: readonly string[], cwd?: string) => {
    const out: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: () => undefined },
    };
    ordinal += 1;
    const previous = process.cwd();
    if (cwd !== undefined) process.chdir(cwd);
    try {
      const exitCode = await runCli(argv, streams, {
        brand: BRAND,
        clock: { now: () => Date.parse("2026-11-25T12:00:00.000Z") },
        newRunId: () => `run-gh404-${String(ordinal)}`,
        secrets: [],
        program,
      });
      const stdout = out.join("");
      const trimmed = stdout.trim();
      const envelope =
        trimmed.startsWith("{") && trimmed.endsWith("}")
          ? (JSON.parse(trimmed) as Record<string, unknown>)
          : undefined;
      return { exitCode, stdout: trimmed.slice(0, 600), envelope };
    } finally {
      process.chdir(previous);
    }
  };
  return {
    root,
    repo,
    stateDirectory,
    store,
    run,
    provisioningChildren,
    sessionSpawns,
    laneWorktreePath: (ref) => {
      const lanes = readDispatchLanes(store);
      return lanes.ok ? latestDispatchLaneFor(lanes.records, ref)?.worktreePath : undefined;
    },
    setProvisionExit: (byArgs) => {
      provisionExit = byArgs;
    },
    git,
    dispose: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    },
  };
};

const dispatchRef = async (harness: Harness, ref: string): Promise<void> => {
  const added = await harness.run(["queue", "add", ref, "--json"]);
  expect(added.exitCode, `queue add ${ref}`).toBe(0);
};

describe("F-6 the default-mode worktree lane through the production composition", () => {
  test("scenario 1 — first dispatch provisions detached and the phases run in the worktree", async () => {
    const harness = makeHarness("first");
    try {
      await dispatchRef(harness, "GH-404");
      const dispatch = await harness.run(["dispatch", "GH-404", "--json"]);
      // The delivered classification over a fixture repo without a merged
      // request is `state-unverified` (exit 2); the LIFECYCLE effects below
      // are what this fixture proves (F-6).
      expect(dispatch.exitCode, JSON.stringify(dispatch.envelope?.error ?? dispatch.stdout)).toBe(
        2,
      );
      const worktreePath = harness.laneWorktreePath("GH-404");
      expect(worktreePath).toBeDefined();
      expect(existsSync(worktreePath)).toBe(true);
      // Decision 1: DETACHED at the base tip — no lane branch.
      const abbrev = harness.git(worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
      expect(abbrev).toBe("HEAD");
      expect(harness.git(worktreePath, ["rev-parse", "HEAD"])).toBe(
        harness.git(harness.repo, ["rev-parse", "main-tools"]),
      );
      // The main checkout stays parked on base and clean (NFR-2).
      expect(harness.git(harness.repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main-tools");
      expect(harness.git(harness.repo, ["status", "--porcelain"])).toBe("");
      // F-5: the provisioning children ran inside the worktree with the
      // worktree bin leading PATH and TMPDIR anchored inside it.
      expect(harness.provisioningChildren.length).toBe(2);
      for (const child of harness.provisioningChildren) {
        expect(child.cwd).toBe(worktreePath);
        expect(child.env.PATH.startsWith(`${worktreePath}/node_modules/.bin:`)).toBe(true);
        expect(child.env.TMPDIR).toBe(`${worktreePath}/tmp/tmpdir`);
      }
      // F-5: the LANE SESSION (not only the provisioning children) spawns in
      // the worktree with the worktree's dependency binaries leading PATH.
      expect(harness.sessionSpawns.length).toBeGreaterThan(0);
      for (const session of harness.sessionSpawns) {
        expect(session.cwd).toBe(worktreePath);
        expect(session.env.PATH.startsWith(`${worktreePath}/node_modules/.bin:`)).toBe(true);
        expect(session.env.TMPDIR).toBe(`${worktreePath}/tmp/tmpdir`);
      }
      // The gate temporary directory exists inside the worktree (DEC-6).
      expect(existsSync(`${worktreePath}/tmp/tmpdir`)).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("scenario 2 — resume after the lane created its delivery branch is accepted", async () => {
    const harness = makeHarness("resume");
    try {
      await dispatchRef(harness, "GH-405");
      const first = await harness.run(["dispatch", "GH-405", "--json"]);
      expect(first.exitCode).toBe(2);
      const worktreePath = harness.laneWorktreePath("GH-405");
      expect(worktreePath).toBeDefined();
      // The lane's own lifecycle creates its delivery branch in the worktree.
      harness.git(worktreePath, ["checkout", "-q", "-b", "feat/GH-405/some-slug"]);
      // Operator resume: accepted per Decision 1 (the convention branch).
      const beforeResume = harness.sessionSpawns.length;
      const resumed = await harness.run(["dispatch", "GH-405", "--json"]);
      // The resume is ACCEPTED per Decision 1: no lane-worktree-branch-
      // mismatch refusal (the convention branch is the accepted state).
      const resumedError = resumed.envelope?.error as Record<string, unknown> | undefined;
      expect(resumedError?.code).not.toBe("dispatch.session.spawn-failed");
      expect(String(resumedError?.summary ?? "")).not.toContain("lane-worktree-branch-mismatch");
      // F-5 on the RESUME path: the same recorded worktree is the session's
      // working directory with the worktree's binaries leading PATH.
      expect(harness.sessionSpawns.length).toBeGreaterThan(beforeResume);
      for (const session of harness.sessionSpawns.slice(beforeResume)) {
        expect(session.cwd).toBe(worktreePath);
        expect(session.env.PATH.startsWith(`${worktreePath}/node_modules/.bin:`)).toBe(true);
      }
      // Zero second worktrees (NFR-3): the same recorded path.
      expect(harness.laneWorktreePath("GH-405")).toBe(worktreePath);
      // F-1 negative control: a GENUINELY FOREIGN branch still refuses, and a
      // provisioning/resume refusal spawns no session (F-9's recorded-attempt
      // reality).
      harness.git(worktreePath, ["checkout", "-q", "-b", "some-foreign-branch"]);
      const spawnedBeforeRefusal = harness.sessionSpawns.length;
      const refused = await harness.run(["dispatch", "GH-405", "--json"]);
      expect(refused.exitCode).toBe(1);
      const refusal = refused.envelope?.error as Record<string, unknown> | undefined;
      expect(refusal?.code).toBe("dispatch.session.spawn-failed");
      expect(String(refusal?.summary)).toContain("lane-worktree-branch-mismatch");
      expect(String(refusal?.summary)).toContain("some-foreign-branch");
      expect(harness.sessionSpawns.length).toBe(spawnedBeforeRefusal);
    } finally {
      harness.dispose();
    }
  });

  test("scenario 3 — a failed provisioning child rolls back, then recovery provisions fresh", async () => {
    const harness = makeHarness("rollback");
    try {
      await dispatchRef(harness, "GH-406");
      harness.setProvisionExit((args) => (args.includes("run") ? 1 : undefined));
      const refused = await harness.run(["dispatch", "GH-406", "--json"]);
      expect(refused.exitCode).toBe(1);
      const error = refused.envelope?.error as Record<string, unknown> | undefined;
      expect(error?.code).toBe("dispatch.session.spawn-failed");
      // F-9: the refusal names the failing step, the bound, and the stderr tail.
      expect(String(error?.summary)).toContain("gate build");
      expect(String(error?.summary)).toContain("stderr: synthetic install/build child failure");
      // F-4a: the just-created worktree is rolled back — no orphan.
      const worktreePath = `${harness.repo}-GH-406`;
      expect(existsSync(worktreePath)).toBe(false);
      // Recovery: the retry provisions fresh.
      harness.setProvisionExit(() => undefined);
      const retried = await harness.run(["dispatch", "GH-406", "--json"]);
      // The recovery provisions fresh (the delivered classification may still
      // be state-unverified over the fixture repo — the WORKTREE is the proof).
      const retriedError = retried.envelope?.error as Record<string, unknown> | undefined;
      expect(retriedError?.code).not.toBe("dispatch.session.spawn-failed");
      expect(existsSync(harness.laneWorktreePath("GH-406") ?? "")).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("scenario 4 — the post-landing deletion defers for a worktree-checked-out branch", async () => {
    // The production merge runtime wiring (production.ts mergeRuntimeBase
    // shape) over a real repository with a real linked worktree holding the
    // delivery branch: the deletion defers as satisfied-by-closeout (Decision
    // 2) — the worktree and the branch stay for closeout's delivered order.
    const base = mkdtempSync(join(tmpdir(), "gh404-defer-"));
    const main = join(base, "main");
    const worktree = join(base, "worktree");
    mkdirSync(main, { recursive: true });
    const git = (cwd: string, args: readonly string[]): string =>
      execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();
    git(main, ["init", "-q", "-b", "base"]);
    git(main, ["config", "user.email", "gh404@example.invalid"]);
    git(main, ["config", "user.name", "GH-404 Deferred Deletion"]);
    git(main, ["commit", "-q", "--allow-empty", "-m", "base"]);
    const branch = "feat/GH-404/deferred";
    git(main, ["worktree", "add", "-q", worktree, "-b", branch]);
    writeFileSync(join(worktree, "delivery.txt"), "delivery\n");
    git(worktree, ["add", "delivery.txt"]);
    git(worktree, ["commit", "-q", "-m", "delivery work"]);
    const noopStore: StateStorePort = createStateStore(
      {
        level: "local",
        workspaceId: "default",
        fenceNamespace: "cli",
        schemaVersion: STATE_SCHEMA_VERSION,
        stateDirectory: join(base, "state"),
      },
      { driver: "jsonl", edge: createNodeStateEdge() },
    );
    const gitBranches = createGitBranchSeam({ cwd: worktree, timeoutMs: 30_000 });
    const mergeGit = createGitMergeSeam({ cwd: worktree, timeoutMs: 30_000 });
    const runtime = createMergeCommandRuntime({
      store: noopStore,
      git: mergeGit,
      land: async () => ({ ok: true as const, requestState: "merged" }),
      landingGap: () => undefined,
      isBranchCheckedOutInLinkedWorktree: async (input) =>
        mergeGit.isBranchCheckedOutInLinkedWorktree(input),
      restoreCheckout: async (baseRef) => {
        const restored = await gitBranches.restoreCheckout({ baseRef });
        return restored.ok ? "ok" : "failed";
      },
      values: () => ({}),
      readWorkItem: async () => ({ ok: false as const, code: "x" }),
      readCheckRuns: async () => ({ ok: false as const, code: "x" }),
      readRequestDetail: async () => ({ ok: false as const, code: "x" }),
    });
    const ports = runtime.createPorts("GH-404");
    const deferred = await ports.deleteBranch({ branch });
    expect(deferred).toBe("ok");
    // The branch is NOT deleted — closeout's delivered order completes it.
    expect(git(main, ["rev-parse", "--verify", `refs/heads/${branch}`]).length).toBeGreaterThan(0);
    rmSync(base, { recursive: true, force: true });
  });

  test("scenario 5 — the production sweep preserves runner logs, deletes scratch, refuses nothing", async () => {
    // The production sweep CLOSURE (`createLaneLogSweep`, the exact function
    // the closeout composition binds) over real files in a real worktree
    // (review F-2: pin the production closure with a real-file test).
    const harness = makeHarness("closeout");
    try {
      await dispatchRef(harness, "GH-407");
      const first = await harness.run(["dispatch", "GH-407", "--json"]);
      expect(first.exitCode).toBe(2);
      const worktreePath = harness.laneWorktreePath("GH-407");
      expect(worktreePath).toBeDefined();
      if (worktreePath === undefined) return;
      // Seed the lane's real runner logs inside the worktree (the runner
      // contract: ./tmp/run-logs-runner/<date>/), plus a sibling dated entry.
      const runnerLogs = join(worktreePath, "tmp", "run-logs-runner");
      const dated = join(runnerLogs, "2026-11-25");
      mkdirSync(dated, { recursive: true });
      writeFileSync(join(dated, "gate.log"), "gate evidence\n");
      writeFileSync(join(dated, "closeout.log"), "closeout evidence\n");
      const older = join(runnerLogs, "2026-11-24");
      mkdirSync(older, { recursive: true });
      writeFileSync(join(older, "phase.log"), "older evidence\n");
      // The scratch the provisioning created is present before the sweep.
      expect(existsSync(join(worktreePath, "tmp", "tmpdir"))).toBe(true);
      // A failing destination moves NOTHING: the logs stay intact in the
      // worktree and the removal is refused (Decision 3).
      const blockedState = join(harness.stateDirectory, "blocked-state");
      mkdirSync(blockedState, { recursive: true });
      writeFileSync(join(blockedState, "closeout-lane-logs"), "not a directory\n");
      const refusedSweep = await createLaneLogSweep({ stateDirectory: blockedState })({
        workItemRef: "GH-407",
        worktreePath,
      });
      expect(refusedSweep.ok).toBe(false);
      if (!refusedSweep.ok) {
        expect(refusedSweep.code).toBe("closeout.lane-log-sweep-failed");
      }
      expect(existsSync(join(dated, "gate.log"))).toBe(true);
      expect(existsSync(join(worktreePath, "tmp", "tmpdir"))).toBe(true);
      let observedCleanlinessPath: string | undefined;
      const sweep = createLaneLogSweep({
        stateDirectory: harness.stateDirectory,
        isWorktreeClean: async ({ path }) => {
          observedCleanlinessPath = path;
          return true;
        },
      });
      const swept = await sweep({ workItemRef: "GH-407", worktreePath });
      expect(swept.ok).toBe(true);
      if (!swept.ok) return;
      expect(swept.swept).toBe(true);
      const destination = join(harness.stateDirectory, "closeout-lane-logs", "GH-407");
      expect(swept.destination).toBe(destination);
      // The COPIED ENTRIES are retrievable at the destination (real file
      // bytes, not a directory the sweep just made).
      expect(readdirSync(destination).sort()).toEqual(["2026-11-24", "2026-11-25"]);
      expect(readFileSync(join(destination, "2026-11-25", "gate.log"), "utf8")).toBe(
        "gate evidence\n",
      );
      expect(readFileSync(join(destination, "2026-11-25", "closeout.log"), "utf8")).toBe(
        "closeout evidence\n",
      );
      expect(readFileSync(join(destination, "2026-11-24", "phase.log"), "utf8")).toBe(
        "older evidence\n",
      );
      // Decision 3: the scratch is DELETED, never preserved.
      expect(existsSync(join(worktreePath, "tmp", "tmpdir"))).toBe(false);
      expect(existsSync(join(destination, "tmpdir"))).toBe(false);
      // The swept source leaves the worktree, and the POST-sweep cleanliness
      // is what the ordering gate evaluates (review F-8).
      expect(existsSync(runnerLogs)).toBe(false);
      expect(swept.postSweepClean).toBe(true);
      expect(observedCleanlinessPath).toBe(worktreePath);
      // The run recorded the lane's worktree path for closeout to consume.
      expect(harness.laneWorktreePath("GH-407")).toBe(worktreePath);
    } finally {
      harness.dispose();
    }
  });

  test("scenario 6 — a terminal record whose worktree closeout removed provisions fresh (F-4b)", async () => {
    const harness = makeHarness("post-closeout");
    try {
      const removedPath = `${harness.repo}-GH-408`;
      // The closeout outcome: the NEWEST lane record is TERMINAL and still
      // carries the worktree path closeout removed (the record is not rewritten).
      const closed: DispatchLaneRecord = {
        schema: DISPATCH_LANE_PAYLOAD_SCHEMA,
        ref: "GH-408",
        repository: "github.com/owner/repo",
        attemptId: "attempt-closed",
        sessionId: "session-closed",
        harnessKind: "opencode",
        owner: { processId: 4242, startedAt: "2026-11-25T11:00:00.000Z" },
        iterationOrdinal: 1,
        restartsConsumed: 0,
        state: "terminal",
        worktreePath: removedPath,
        lastToken: "completed",
        lastOutcome: "completed",
        recordedAt: "2026-11-25T11:30:00.000Z",
      };
      const appended = appendDispatchLane(harness.store, "fence-post-closeout", closed);
      expect(appended.ok).toBe(true);
      expect(existsSync(removedPath)).toBe(false);
      await dispatchRef(harness, "GH-408");
      const dispatch = await harness.run(["dispatch", "GH-408", "--json"]);
      const error = dispatch.envelope?.error as Record<string, unknown> | undefined;
      // No `lane-worktree-missing` refusal: the ref's NEW lane provisions.
      expect(error?.code).not.toBe("dispatch.session.spawn-failed");
      expect(harness.laneWorktreePath("GH-408")).toBe(removedPath);
      expect(existsSync(removedPath)).toBe(true);
    } finally {
      harness.dispose();
    }
  });
});
