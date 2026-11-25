/**
 * F-6 / F-22 (review remediations) — the DEFAULT-mode worktree lane through the
 * REAL production composition:
 * `createProductionComposer` → real CLI program → `queue add` / `dispatch` /
 * `verify gates` / `merge` / `closeout --apply` over real temporary git
 * repositories with the real git binary. Only the harness session, the harness
 * version probe, the provider transport, the credentials, and the
 * install/build children are stubbed; the worktree provisioning, the merge
 * post-landing port, the closeout sweep and the board runtime are production
 * code paths, composed ONE PROGRAM PER INVOCATION like the binary launcher.
 * Seeded from the reviewer's reproducer probes (outside the repository). Zero
 * timing assertions.
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
 * 4. The merge runtime's post-landing deferral port over a real repository
 *    (JUSTIFIED seam-level proof; the END-TO-END merge through the composer is
 *    scenario 7).
 * 5. The production sweep closure over real files: copy, scratch deletion,
 *    post-sweep cleanliness, failure moves nothing (JUSTIFIED closure-level
 *    proof; the END-TO-END closeout is scenario 7, the repeat sweeps scenarios
 *    8-10).
 * 6. A terminal lane record whose worktree closeout removed provisions fresh
 *    for the ref's new lane (F-4b) instead of refusing.
 * 7. END TO END (F-19/F-22): merge in the lane worktree with the deletion
 *    deferred, then `closeout --apply` from the main checkout in a repository
 *    that does NOT ignore `tmp/` — plan passes, the sweep runs, the worktree
 *    is removed, the branch is deleted, the logs are at the destination, and
 *    the applied payload discloses the sweep.
 * 8. F-18: a SECOND lane of the same ref after the first closeout sweeps into
 *    the same destination and succeeds (never wedges).
 * 9. F-18: one worktree swept twice with new logs in between, same date and a
 *    later date, extends the destination (a same-named file takes the newer
 *    bytes).
 * 9b. F-38: a same-date re-sweep with DISTINCT file names preserves every file
 *    the first sweep placed (scenario 9's same-named pin is the complement).
 * 10. F-21: the byte cap's truncation is disclosed in the applied payload, and
 *    a sweep that could preserve nothing refuses instead of deleting silently.
 * 11. F-25: a stale worktree registration names the path and the `git worktree
 *    prune` recovery, and a refused rollback discloses the path and remedy.
 * 12. F-20: the board renders the lane worktree path when its derived
 *    repository key differs from the dispatch.lane record's origin identity.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  truncateSync,
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
import { claimQueueLease } from "../../packages/core/src/app/queue";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import type {
  BrandIdentity,
  CloseoutData,
  CredentialPort,
  DispatchLaneRecord,
  HarnessSpawnRunner,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import { DISPATCH_LANE_PAYLOAD_SCHEMA } from "../../packages/core/src/contracts/dispatch";
import { LANE_LOG_SWEEP_BYTE_CAP } from "../../packages/core/src/domain/lane-worktree-plan";
import { renderCloseoutHuman } from "../../packages/core/src/domain/closeout";
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
    /** A failing child leaves an untracked, non-ignored file (the F-25 refused rollback). */
    readonly provisionLeftovers?: boolean;
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
      const status = provisionExit(args) ?? 0;
      if (status !== 0 && options.provisionLeftovers === true && spawnOptions.cwd !== undefined) {
        // A partial install/build leaves an untracked, non-ignored file: the
        // F-25 rollback refusal shape.
        writeFileSync(join(spawnOptions.cwd, "leftover-partial-install.txt"), "partial\n");
      }
      return {
        stdout: "",
        stderr: "synthetic install/build child failure\n",
        status,
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
      send: async (request: { readonly url: string }) => {
        if (request.url.includes("/issues?")) return { status: 200, body: [] };
        if (request.url.includes("/issues/")) {
          const number = Number(request.url.match(/issues\/(\d+)/u)?.[1] ?? 0);
          return {
            status: 200,
            body: { number, title: "fixture", state: "open", labels: [] },
          };
        }
        if (request.url.includes("/pulls?")) return { status: 200, body: [] };
        return { status: 200, body: {} };
      },
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
      // The delivered classification over a fixture repo: 0 when the provider
      // truth is readable, 2 (`state-unverified`) when it is not. The
      // LIFECYCLE effects below are what this fixture proves (F-6).
      expect([0, 2]).toContain(dispatch.exitCode);
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
      expect([0, 2]).toContain(first.exitCode);
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
      // F-30: the reuse arm CREATES the TMPDIR anchor it binds.
      rmSync(join(worktreePath, "tmp", "tmpdir"), { recursive: true, force: true });
      expect(existsSync(join(worktreePath, "tmp", "tmpdir"))).toBe(false);
      const reResumed = await harness.run(["dispatch", "GH-405", "--json"]);
      const reResumedError = reResumed.envelope?.error as Record<string, unknown> | undefined;
      expect(reResumedError?.code).not.toBe("dispatch.session.spawn-failed");
      expect(existsSync(join(worktreePath, "tmp", "tmpdir"))).toBe(true);
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
    // JUSTIFIED seam-level proof (review F-22): the production merge runtime
    // (production.ts mergeRuntimeBase shape) over a real repository with a real
    // linked worktree holding the delivery branch defers the deletion as
    // satisfied-by-closeout (Decision 2). The END-TO-END merge through the
    // composer, with the branch retained, is scenario 7.
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
    // JUSTIFIED closure-level proof (review F-22): the production sweep CLOSURE
    // (`createLaneLogSweep`, the exact function the closeout composition binds)
    // over real files in a real worktree. The END-TO-END closeout transaction
    // is scenario 7; the repeat-sweep shapes are scenarios 8-10.
    const harness = makeHarness("closeout");
    try {
      await dispatchRef(harness, "GH-407");
      const first = await harness.run(["dispatch", "GH-407", "--json"]);
      expect([0, 2]).toContain(first.exitCode);
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
      // F-30: an ephemeral-deletion failure in the no-logs arm is the declared
      // refusal shape, never a rejected promise (a read-only `tmp/`).
      const stale = join(worktreePath, "tmp", "stale.log");
      writeFileSync(stale, "stale\n");
      const mode = statSync(join(worktreePath, "tmp")).mode;
      chmodSync(join(worktreePath, "tmp"), 0o500);
      try {
        const errored = await createLaneLogSweep({
          stateDirectory: join(harness.stateDirectory, "readonly-state"),
        })({ workItemRef: "GH-407", worktreePath });
        expect(errored.ok).toBe(false);
        if (!errored.ok) expect(errored.code).toBe("closeout.lane-log-sweep-failed");
      } finally {
        chmodSync(join(worktreePath, "tmp"), mode);
      }
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

/* ------------------------------------------------------------------------- */
/* The END-TO-END lifecycle world (review F-22): one composed program per     */
/* CLI invocation, exactly like the binary launcher, over a real temporary   */
/* repository; only the harness session, version probe, provider transport,  */
/* credentials and install/build children are injected.                      */
/* ------------------------------------------------------------------------- */

type Reply = { readonly status: number; readonly body: unknown };

type LifecycleWorld = {
  readonly root: string;
  readonly repo: string;
  readonly home: string;
  readonly stateDirectory: string;
  readonly store: StateStorePort;
  readonly transport: readonly { readonly method: string; readonly url: string }[];
  readonly run: (
    argv: readonly string[],
    cwd?: string,
  ) => Promise<{
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
    readonly envelope: Record<string, unknown> | undefined;
  }>;
  readonly git: (cwd: string, args: readonly string[]) => string;
  readonly setReply: (reply: (url: string, method: string) => Reply | undefined) => void;
  readonly dispose: () => void;
};

const makeLifecycleWorld = (
  label: string,
  options: { readonly ignoreTmp?: boolean } = {},
): LifecycleWorld => {
  const root = mkdtempSync(join(tmpdir(), `gh404-e2e-${label}-`));
  const repo = join(root, "repo");
  mkdirSync(repo, { recursive: true });
  const git = (cwd: string, args: readonly string[]): string =>
    execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();
  git(repo, ["init", "-q", "-b", "main-tools"]);
  git(repo, ["config", "user.email", "gh404@example.invalid"]);
  git(repo, ["config", "user.name", "GH-404 Lifecycle Fixture"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  // Review F-19: `ignoreTmp: false` is the repository that does NOT ignore the
  // lane's own logs — the shape the plan-time cleanliness exclusion must serve.
  writeFileSync(join(repo, ".gitignore"), options.ignoreTmp === true ? "tmp/\n" : "");
  mkdirSync(join(repo, ".github/workflows"), { recursive: true });
  writeFileSync(
    join(repo, ".github/workflows/ci.yml"),
    "jobs:\n  'CI / test':\n    steps: [echo]\n  'CI / lint':\n    steps: [echo]\n",
  );
  writeFileSync(join(repo, "README.md"), "fixture\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", "base"]);
  mkdirSync(join(repo, BRAND.configDirectoryName), { recursive: true });
  writeFileSync(
    join(repo, BRAND.configDirectoryName, PROVIDER_PROFILES_CONFIG_FILE),
    DEFAULT_MODE_CONFIG,
  );
  git(repo, ["add", BRAND.configDirectoryName]);
  git(repo, ["commit", "-q", "-m", "chore: provider profiles"]);
  git(repo, ["remote", "add", "origin", "https://github.com/owner/repo.git"]);

  const home = mkdtempSync(join(tmpdir(), `gh404-e2e-home-${label}-`));
  const hostRoot = join(home, BRAND.stateDirectoryName);
  const stateDirectory = projectScopeFor({
    cwd: repo,
    hostRoot,
    home,
    brand: BRAND,
  }).scope.stateLocation;
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

  const transport: { method: string; url: string }[] = [];
  let reply: (url: string, method: string) => Reply | undefined = (url) =>
    url.includes("/issues/")
      ? {
          status: 200,
          body: {
            number: Number(url.match(/issues\/(\d+)/u)?.[1] ?? 0),
            title: "fixture",
            state: "open",
            labels: [],
            updated_at: "2026-11-25T09:00:00Z",
          },
        }
      : url.includes("/pulls?")
        ? { status: 200, body: [] }
        : url.includes("/issues?")
          ? { status: 200, body: [] }
          : undefined;
  const spawnRunner: HarnessSpawnRunner = async (file, _args, spawnOptions) => {
    if (file === "pnpm") {
      return { stdout: "", stderr: "", status: 0, timedOut: false };
    }
    void spawnOptions;
    return {
      stdout: JSON.stringify({
        session: { id: "session-e2e" },
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
  let ordinal = 0;
  const run = async (argv: readonly string[], cwd: string = repo) => {
    const program = createProductionComposer({
      harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
      environment: {
        HOME: home,
        PATH: process.env.PATH ?? "",
        HARNESS_MODEL: "synthetic/model-large",
        HARNESS_SMALL_MODEL: "synthetic/model-small",
      },
      cwd,
      homeDirectory: home,
      workingName: WORKING_NAME,
      processId: process.pid,
      repositoryFacts: { originUrl: "https://github.com/owner/repo.git" },
      harnessSpawnRunner: spawnRunner,
      harnessSpawnStarter: streamStarterFromRunner(spawnRunner),
      credentials,
      githubTransport: {
        send: async (request: { readonly method: string; readonly url: string }) => {
          transport.push({ method: request.method, url: request.url });
          return reply(request.url, request.method) ?? { status: 404, body: {} };
        },
      },
    })(BRAND);
    const out: string[] = [];
    const err: string[] = [];
    ordinal += 1;
    const exitCode = await runCli(
      argv,
      {
        stdout: { write: (chunk: string) => out.push(chunk) },
        stderr: { write: (chunk: string) => err.push(chunk) },
      },
      {
        brand: BRAND,
        clock: { now: () => Date.parse("2026-11-25T12:00:00.000Z") },
        newRunId: () => `run-e2e-${String(ordinal)}`,
        secrets: [],
        program,
      },
    );
    const trimmed = out.join("").trim();
    const envelope =
      trimmed.startsWith("{") && trimmed.endsWith("}")
        ? (JSON.parse(trimmed) as Record<string, unknown>)
        : undefined;
    return { exitCode, stdout: trimmed.slice(0, 800), stderr: err.join("").trim(), envelope };
  };
  return {
    root,
    repo,
    home,
    stateDirectory,
    store,
    transport,
    run,
    git,
    setReply: (next) => {
      reply = next;
    },
    dispose: () => {
      rmSync(root, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    },
  };
};

/** The provider truth for one lane's delivery request (open PR -> merged). */
const laneProvider = (
  world: LifecycleWorld,
  ref: string,
  initialBranch: string,
  options: { readonly landed?: boolean } = {},
): {
  readonly reply: (url: string, method: string) => Reply | undefined;
  readonly setBranch: (branch: string) => void;
  readonly state: { landed: boolean };
} => {
  const state = { landed: options.landed ?? false, branch: initialBranch };
  const issue = Number(ref.replace(/\D+/gu, ""));
  const head = (): string => {
    try {
      return world.git(world.repo, ["rev-parse", state.branch]);
    } catch {
      return "";
    }
  };
  const pull = (merged: boolean): Record<string, unknown> => ({
    number: issue,
    state: merged ? "closed" : "open",
    draft: false,
    ...(merged ? { merged_at: "2026-11-25T09:30:00Z", merged: true } : {}),
    head: { ref: state.branch, sha: head() },
    base: { ref: "main-tools" },
    commits: 1,
    changed_files: 1,
    mergeable: true,
    mergeable_state: "clean",
    merge_commit_sha: merged ? "c1d2e3f4a5b60718293a4b5c6d7e8f9012345678" : undefined,
  });
  const reply = (url: string, method: string): Reply | undefined => {
    if (url.includes("/issues?")) return { status: 200, body: [] };
    if (url.includes("/issues/")) {
      return {
        status: 200,
        body: {
          number: issue,
          title: "Probe work item",
          state: "open",
          labels: [],
          updated_at: "2026-11-25T09:00:00Z",
        },
      };
    }
    if (url.includes("/check-runs")) {
      return {
        status: 200,
        body: {
          check_runs: ["CI / test", "CI / lint"].map((name, index) => ({
            id: 8001 + index,
            name,
            status: "completed",
            conclusion: "success",
          })),
        },
      };
    }
    if (url.includes("/pulls?state=open")) {
      return { status: 200, body: state.landed ? [] : [pull(false)] };
    }
    if (url.includes("/pulls?state=closed")) {
      return { status: 200, body: state.landed ? [pull(true)] : [] };
    }
    if (url.includes("/graphql")) return { status: 200, body: { data: {} } };
    if (url.endsWith("/merge") && method === "PUT") {
      state.landed = true;
      return { status: 200, body: { merged: true, sha: pull(true).merge_commit_sha } };
    }
    if (url.includes("/pulls/")) return { status: 200, body: pull(state.landed) };
    return undefined;
  };
  return {
    reply,
    setBranch: (branch) => {
      state.branch = branch;
    },
    state,
  };
};

/** Drive one lane's dispatch and seed its own lifecycle work in the worktree. */
const seedLane = async (
  world: LifecycleWorld,
  ref: string,
  slug: string,
  options: { readonly runnerLogs?: boolean } = {},
): Promise<{ readonly worktree: string; readonly branch: string }> => {
  const added = await world.run(["queue", "add", ref, "--json"]);
  expect(added.exitCode, `queue add ${ref}`).toBe(0);
  const dispatched = await world.run(["dispatch", ref, "--json"]);
  // A readable unmerged provider truth lets the dispatch complete (exit 0); an
  // unreadable one classifies `state-unverified` (exit 2). The LIFECYCLE
  // effects — the worktree and the lane record — are the proof either way.
  expect([0, 2], dispatched.stdout).toContain(dispatched.exitCode);
  const lanes = readDispatchLanes(world.store);
  const worktree = lanes.ok ? latestDispatchLaneFor(lanes.records, ref)?.worktreePath : undefined;
  expect(worktree).toBeDefined();
  if (worktree === undefined) throw new Error(`no worktree for ${ref}`);
  const branch = `feat/${ref}/${slug}`;
  world.git(worktree, ["checkout", "-q", "-b", branch]);
  const folder = join(worktree, "doc/changes/2026-11", `2026-11-25--${ref}--${slug}`);
  mkdirSync(folder, { recursive: true });
  const base = readFileSync(
    join(process.cwd(), "tests/fixtures/verify/classification/full/base-complete.yaml"),
    "utf8",
  );
  writeFileSync(
    join(folder, `chg-${ref}-pm-notes.yaml`),
    `${base.replace("change_id: GH-177", `change_id: ${ref}`)}branch: ${branch}\n`,
  );
  world.git(worktree, ["add", "doc/changes"]);
  world.git(worktree, ["commit", "-q", "-m", `docs(${ref}): declare the change branch`]);
  if (options.runnerLogs !== false) {
    const dated = join(worktree, "tmp", "run-logs-runner", "2026-11-25");
    mkdirSync(dated, { recursive: true });
    writeFileSync(join(dated, "gate.log"), "lane gate evidence\n");
  }
  return { worktree, branch };
};

/** A worktree path is gone when `rev-parse --verify` refuses it. */
const branchExists = (world: LifecycleWorld, branch: string): boolean => {
  try {
    return world.git(world.repo, ["rev-parse", "--verify", `refs/heads/${branch}`]).length > 0;
  } catch {
    return false;
  }
};

const dataOf = (run: {
  readonly envelope: Record<string, unknown> | undefined;
}): Record<string, unknown> => (run.envelope?.data as Record<string, unknown> | undefined) ?? {};

const stepsOf = (run: {
  readonly envelope: Record<string, unknown> | undefined;
}): readonly Record<string, unknown>[] =>
  (dataOf(run).steps as readonly Record<string, unknown>[] | undefined) ?? [];

describe("GH-404 review iteration 2 — merge and closeout END TO END through the composer", () => {
  test("scenario 7 — merge in the worktree, closeout from main with tmp/ NOT ignored (F-19, F-21, F-22)", async () => {
    const world = makeLifecycleWorld("tmp-not-ignored", { ignoreTmp: false });
    try {
      const provider = laneProvider(world, "GH-940", "feat/GH-940/some-slug");
      world.setReply(provider.reply);
      const lane = await seedLane(world, "GH-940", "some-slug");
      // The lane verifies in its worktree, then merges there.
      const verify = await world.run(["--json", "verify", "gates", "GH-940"], lane.worktree);
      expect(verify.exitCode, verify.stdout + verify.stderr).toBe(0);
      const merge = await world.run(["--json", "merge", "GH-940"], lane.worktree);
      expect(merge.exitCode, merge.stdout + merge.stderr).toBe(0);
      // Decision 2 end to end: the post-landing deletion DEFERRED — the branch
      // is retained for closeout's delivered order.
      expect(branchExists(world, lane.branch)).toBe(true);
      // F-19: the plan precedes the sweep; the lane's own tmp logs (NOT
      // ignored) must not make the worktree unsafe.
      const plan = await world.run(["closeout", "GH-940", "--json"], world.repo);
      expect(plan.exitCode, plan.stdout + plan.stderr).toBe(0);
      expect(stepsOf(plan).find((step) => step.stepId === "worktree-cleanup")?.outcome).toBe(
        "would-apply",
      );
      const apply = await world.run(["closeout", "GH-940", "--apply", "--json"], world.repo);
      expect(apply.exitCode, apply.stdout + apply.stderr).toBe(0);
      const cleanup = stepsOf(apply).find((step) => step.stepId === "worktree-cleanup");
      expect(cleanup?.outcome).toBe("applied");
      // F-21: the applied payload carries the sweep evidence.
      expect(cleanup?.laneLogSweep).toEqual({ swept: true, truncated: false, omittedBytes: 0 });
      // The delivered closeout order completed: worktree removed, branch
      // deleted, main checkout back on base, logs at the destination.
      expect(existsSync(lane.worktree)).toBe(false);
      expect(branchExists(world, lane.branch)).toBe(false);
      expect(world.git(world.repo, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("main-tools");
      const destination = join(world.stateDirectory, "closeout-lane-logs", "GH-940");
      expect(readdirSync(destination)).toEqual(["2026-11-25"]);
      expect(readFileSync(join(destination, "2026-11-25", "gate.log"), "utf8")).toBe(
        "lane gate evidence\n",
      );
    } finally {
      world.dispose();
    }
  });

  test("scenario 8 — a second lane of the same ref sweeps again without wedging (F-18)", async () => {
    const world = makeLifecycleWorld("second-lane", { ignoreTmp: true });
    try {
      const provider = laneProvider(world, "GH-941", "feat/GH-941/first");
      world.setReply(provider.reply);
      const first = await seedLane(world, "GH-941", "first");
      const verify = await world.run(["--json", "verify", "gates", "GH-941"], first.worktree);
      expect(verify.exitCode, verify.stdout).toBe(0);
      const merge = await world.run(["--json", "merge", "GH-941"], first.worktree);
      expect(merge.exitCode, merge.stdout).toBe(0);
      const applied = await world.run(["closeout", "GH-941", "--apply", "--json"], world.repo);
      expect(applied.exitCode, applied.stdout).toBe(0);
      const destination = join(world.stateDirectory, "closeout-lane-logs", "GH-941");
      expect(readdirSync(destination)).toEqual(["2026-11-25"]);
      // The ref's SECOND lane after the worktree removal: fresh dispatch at the
      // same deterministic path, new logs, and a second closeout.
      await world.run(["queue", "add", "GH-941", "--json"]);
      const second = await world.run(["dispatch", "GH-941", "--json"]);
      expect([0, 2]).toContain(second.exitCode);
      const lanes = readDispatchLanes(world.store);
      const worktree = lanes.ok
        ? latestDispatchLaneFor(lanes.records, "GH-941")?.worktreePath
        : undefined;
      expect(worktree).toBe(first.worktree);
      if (worktree === undefined) return;
      const branch = "feat/GH-941/second";
      world.git(worktree, ["checkout", "-q", "-b", branch]);
      provider.setBranch(branch);
      // The lane's new runner logs under a later date.
      const dated = join(worktree, "tmp", "run-logs-runner", "2026-11-26");
      mkdirSync(dated, { recursive: true });
      writeFileSync(join(dated, "gate.log"), "second lane evidence\n");
      const secondApply = await world.run(["closeout", "GH-941", "--apply", "--json"], world.repo);
      expect(secondApply.exitCode, secondApply.stdout + secondApply.stderr).toBe(0);
      expect(readdirSync(destination).sort()).toEqual(["2026-11-25", "2026-11-26"]);
      expect(readFileSync(join(destination, "2026-11-26", "gate.log"), "utf8")).toBe(
        "second lane evidence\n",
      );
      expect(existsSync(worktree)).toBe(false);
    } finally {
      world.dispose();
    }
  });

  test("scenario 9 — one worktree swept twice with new logs in between (F-18)", async () => {
    // JUSTIFIED closure-level shape: this drives the production sweep port (the
    // exact closure the composition binds) over one worktree; the
    // transaction-level second lane is scenario 8.
    const world = makeLifecycleWorld("swept-twice", { ignoreTmp: true });
    try {
      const provider = laneProvider(world, "GH-942", "feat/GH-942/slug");
      world.setReply(provider.reply);
      const lane = await seedLane(world, "GH-942", "slug");
      const sweep = createLaneLogSweep({ stateDirectory: world.stateDirectory });
      const first = await sweep({ workItemRef: "GH-942", worktreePath: lane.worktree });
      expect(first.ok).toBe(true);
      // New logs after the first sweep: same date (same name) + a later date.
      const sameDate = join(lane.worktree, "tmp", "run-logs-runner", "2026-11-25");
      mkdirSync(sameDate, { recursive: true });
      writeFileSync(join(sameDate, "gate.log"), "rewritten gate evidence\n");
      const laterDate = join(lane.worktree, "tmp", "run-logs-runner", "2026-11-26");
      mkdirSync(laterDate, { recursive: true });
      writeFileSync(join(laterDate, "closeout.log"), "later evidence\n");
      const second = await sweep({ workItemRef: "GH-942", worktreePath: lane.worktree });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.swept).toBe(true);
      const destination = join(world.stateDirectory, "closeout-lane-logs", "GH-942");
      expect(readdirSync(destination).sort()).toEqual(["2026-11-25", "2026-11-26"]);
      // The merged same-date entry takes the NEW bytes for a same-named file
      // (scenario 9b proves distinct files are preserved beside it).
      expect(readFileSync(join(destination, "2026-11-25", "gate.log"), "utf8")).toBe(
        "rewritten gate evidence\n",
      );
      expect(readFileSync(join(destination, "2026-11-26", "closeout.log"), "utf8")).toBe(
        "later evidence\n",
      );
    } finally {
      world.dispose();
    }
  });

  test("scenario 9b — a same-date re-sweep with distinct file names preserves the earlier files (F-38)", async () => {
    // the production sweep closure again: one date directory, a second sweep
    // writing a DIFFERENT file into it must keep what the first sweep placed.
    const world = makeLifecycleWorld("swept-twice-distinct", { ignoreTmp: true });
    try {
      const provider = laneProvider(world, "GH-945", "feat/GH-945/slug");
      world.setReply(provider.reply);
      const lane = await seedLane(world, "GH-945", "slug", { runnerLogs: false });
      const sameDate = join(lane.worktree, "tmp", "run-logs-runner", "2026-11-25");
      mkdirSync(sameDate, { recursive: true });
      writeFileSync(join(sameDate, "090001-phase-gates.log"), "gate one\n");
      writeFileSync(join(sameDate, "090002-commit-range-lint.log"), "lint two\n");
      const sweep = createLaneLogSweep({ stateDirectory: world.stateDirectory });
      const first = await sweep({ workItemRef: "GH-945", worktreePath: lane.worktree });
      expect(first.ok).toBe(true);
      // The re-sweep writes a DISTINCT file into the same date directory.
      mkdirSync(sameDate, { recursive: true });
      writeFileSync(join(sameDate, "100003-after-cleanup.log"), "after cleanup\n");
      const second = await sweep({ workItemRef: "GH-945", worktreePath: lane.worktree });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.swept).toBe(true);
      expect(second.truncated).toBe(false);
      expect(second.omittedBytes).toBe(0);
      const preserved = join(world.stateDirectory, "closeout-lane-logs", "GH-945", "2026-11-25");
      // Every file lands: the first sweep's two and the re-sweep's one.
      expect(readdirSync(preserved).sort()).toEqual([
        "090001-phase-gates.log",
        "090002-commit-range-lint.log",
        "100003-after-cleanup.log",
      ]);
      expect(readFileSync(join(preserved, "090001-phase-gates.log"), "utf8")).toBe("gate one\n");
      expect(readFileSync(join(preserved, "090002-commit-range-lint.log"), "utf8")).toBe(
        "lint two\n",
      );
      expect(readFileSync(join(preserved, "100003-after-cleanup.log"), "utf8")).toBe(
        "after cleanup\n",
      );
    } finally {
      world.dispose();
    }
  });

  test("scenario 10 — the cap truncation is disclosed in the applied payload (F-21)", async () => {
    const world = makeLifecycleWorld("truncated", { ignoreTmp: true });
    try {
      // The provider already reports the delivery merged: closeout alone.
      const provider = laneProvider(world, "GH-943", "feat/GH-943/slug", { landed: true });
      world.setReply(provider.reply);
      const lane = await seedLane(world, "GH-943", "slug");
      const runnerLogs = join(lane.worktree, "tmp", "run-logs-runner");
      // An OLDER dated entry one byte over the cap (sparse: no disk cost) and a
      // NEWER small entry: the sweep copies the small one and discloses the
      // omitted bytes.
      const hugeDate = join(runnerLogs, "2026-11-24");
      mkdirSync(hugeDate, { recursive: true });
      const huge = join(hugeDate, "huge.log");
      writeFileSync(huge, "");
      truncateSync(huge, LANE_LOG_SWEEP_BYTE_CAP + 1);
      const smallDate = join(runnerLogs, "2026-11-25");
      mkdirSync(smallDate, { recursive: true });
      writeFileSync(join(smallDate, "gate.log"), "small evidence\n");
      const apply = await world.run(["closeout", "GH-943", "--apply", "--json"], world.repo);
      expect(apply.exitCode, apply.stdout + apply.stderr).toBe(0);
      const cleanup = stepsOf(apply).find((step) => step.stepId === "worktree-cleanup");
      expect(cleanup?.laneLogSweep).toEqual({
        swept: true,
        truncated: true,
        omittedBytes: LANE_LOG_SWEEP_BYTE_CAP + 1,
      });
      const destination = join(world.stateDirectory, "closeout-lane-logs", "GH-943");
      expect(readdirSync(destination)).toEqual(["2026-11-25"]);
      expect(existsSync(lane.worktree)).toBe(false);
      // The human digest renders the same disclosure.
      const human = renderCloseoutHuman(dataOf(apply) as unknown as CloseoutData);
      expect(human).toContain("lane logs: swept, truncated");
      expect(human).toContain(`${String(LANE_LOG_SWEEP_BYTE_CAP + 1)} bytes omitted`);
    } finally {
      world.dispose();
    }
  });

  test("scenario 10b — a sweep that can preserve nothing refuses and keeps the logs (F-21)", async () => {
    const world = makeLifecycleWorld("truncated-total", { ignoreTmp: true });
    try {
      const provider = laneProvider(world, "GH-944", "feat/GH-944/slug");
      world.setReply(provider.reply);
      const lane = await seedLane(world, "GH-944", "slug", { runnerLogs: false });
      const onlyDate = join(lane.worktree, "tmp", "run-logs-runner", "2026-11-24");
      mkdirSync(onlyDate, { recursive: true });
      const huge = join(onlyDate, "huge.log");
      writeFileSync(huge, "");
      truncateSync(huge, LANE_LOG_SWEEP_BYTE_CAP + 1);
      const swept = await createLaneLogSweep({ stateDirectory: world.stateDirectory })({
        workItemRef: "GH-944",
        worktreePath: lane.worktree,
      });
      expect(swept.ok).toBe(false);
      if (!swept.ok) {
        expect(swept.code).toBe("closeout.lane-log-sweep-failed");
        expect(swept.detail).toContain("stay intact");
      }
      // Nothing was moved or deleted.
      expect(existsSync(huge)).toBe(true);
      expect(existsSync(join(world.stateDirectory, "closeout-lane-logs", "GH-944"))).toBe(true);
    } finally {
      world.dispose();
    }
  });
});

describe("GH-404 review iteration 2 — refusals name the path and the board join (F-20, F-25)", () => {
  test("scenario 11a — a stale worktree registration names the path and the prune recovery (F-25)", async () => {
    const harness = makeHarness("stale-registration");
    try {
      await dispatchRef(harness, "GH-450");
      const first = await harness.run(["dispatch", "GH-450", "--json"]);
      expect([0, 2]).toContain(first.exitCode);
      const worktreePath = harness.laneWorktreePath("GH-450");
      expect(worktreePath).toBeDefined();
      if (worktreePath === undefined) return;
      // The directory is removed WITHOUT `git worktree remove`: the registration
      // is stale, which used to surface as a bare (128).
      rmSync(worktreePath, { recursive: true, force: true });
      const again = await harness.run(["dispatch", "GH-450", "--json"]);
      expect(again.exitCode).toBe(1);
      const summary = String(
        (again.envelope?.error as Record<string, unknown> | undefined)?.summary ?? "",
      );
      expect(summary).toContain(worktreePath);
      expect(summary).toContain("git worktree prune");
      expect(summary).toContain("exit 128");
      expect(summary).not.toBe("the lane worktree could not be provisioned (worktree-add-refused)");
    } finally {
      harness.dispose();
    }
  });

  test("scenario 11b — a refused rollback discloses the worktree path and the recovery (F-25)", async () => {
    const harness = makeHarness("refused-rollback", { provisionLeftovers: true });
    try {
      await dispatchRef(harness, "GH-451");
      harness.setProvisionExit((args) => (args.includes("run") ? 1 : undefined));
      const refused = await harness.run(["dispatch", "GH-451", "--json"]);
      expect(refused.exitCode).toBe(1);
      const summary = String(
        (refused.envelope?.error as Record<string, unknown> | undefined)?.summary ?? "",
      );
      const worktreePath = `${harness.repo}-GH-451`;
      expect(summary).toContain("could not be rolled back");
      expect(summary).toContain(worktreePath);
      expect(summary).toContain("git worktree prune");
      // The orphan is disclosed, not hidden: the worktree remains on disk.
      expect(existsSync(worktreePath)).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("scenario 12 — the board renders the path when its key differs from the record identity (F-20)", async () => {
    const harness = makeHarness("board-join");
    try {
      await dispatchRef(harness, "GH-442");
      const dispatch = await harness.run(["dispatch", "GH-442", "--json"]);
      expect([0, 2]).toContain(dispatch.exitCode);
      const worktreePath = harness.laneWorktreePath("GH-442");
      expect(worktreePath).toBeDefined();
      const lanes = readDispatchLanes(harness.store);
      const record = lanes.ok ? latestDispatchLaneFor(lanes.records, "GH-442") : undefined;
      // An active lease is what makes the board render a lane row; the
      // production claim primitive lands it (the command's readiness gates are
      // not the subject here).
      const claimed = claimQueueLease(harness.store, {
        ref: "GH-442",
        holder: "fixture",
        runner: "fixture-runner",
        weightClass: "standard",
        nowIso: "2026-11-25T12:00:00.000Z",
        nowMs: Date.parse("2026-11-25T12:00:00.000Z"),
        fenceToken: "fence-board-join",
        precheck: () => ({ ok: true as const }),
      });
      expect(claimed.ok).toBe(true);
      const board = await harness.run(["board", "--json"]);
      expect(board.exitCode, board.stdout).toBe(0);
      const repositories = (dataOf(board).repositories ?? []) as readonly string[];
      // The differing-key shape: the board's derived key is NOT the dispatch.lane
      // record's origin identity.
      expect(repositories).toHaveLength(1);
      expect(repositories[0]).not.toBe(record?.repository);
      expect(record?.repository).toBe("github.com/owner/repo");
      const row = (dataOf(board).lanes as readonly Record<string, unknown>[]).find(
        (lane) => lane.ref === "GH-442",
      );
      expect(row?.repository).toBe(repositories[0]);
      expect(row?.worktreePath).toBe(worktreePath);
    } finally {
      harness.dispose();
    }
  });

  test("scenario 13 — the deferral matches the exact branch line and skips prunable blocks (F-29)", async () => {
    const base = mkdtempSync(join(tmpdir(), "gh404-exact-match-"));
    const repo = join(base, "repo");
    mkdirSync(repo, { recursive: true });
    const git = (cwd: string, args: readonly string[]): string =>
      execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();
    git(repo, ["init", "-q", "-b", "main-tools"]);
    git(repo, ["config", "user.email", "gh404@example.invalid"]);
    git(repo, ["config", "user.name", "GH-404 Exact Match"]);
    git(repo, ["commit", "-q", "--allow-empty", "-m", "base"]);
    const wtA = join(base, "a");
    const wtB = join(base, "b");
    git(repo, ["worktree", "add", "-q", wtA, "-b", "feat/GH-1/a"]);
    git(repo, ["worktree", "add", "-q", wtB, "-b", "feat/GH-1/ab"]);
    try {
      const seam = createGitMergeSeam({ cwd: repo, timeoutMs: 30_000 });
      // The exact branch is held; the prefix-related branch is a DIFFERENT
      // branch (a substring match would defer the wrong deletion).
      expect(await seam.isBranchCheckedOutInLinkedWorktree({ branch: "feat/GH-1/a" })).toBe(true);
      expect(await seam.isBranchCheckedOutInLinkedWorktree({ branch: "feat/GH-1/ab" })).toBe(true);
      expect(await seam.isBranchCheckedOutInLinkedWorktree({ branch: "feat/GH-1/a/x" })).toBe(
        false,
      );
      // A prunable registration (its directory gone) holds no branch.
      rmSync(wtA, { recursive: true, force: true });
      expect(await seam.isBranchCheckedOutInLinkedWorktree({ branch: "feat/GH-1/a" })).toBe(false);
      expect(await seam.isBranchCheckedOutInLinkedWorktree({ branch: "feat/GH-1/ab" })).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
