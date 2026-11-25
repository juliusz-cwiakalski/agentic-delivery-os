/**
 * The governing worktree-lane lifecycle fixture (GH-404 F-2, F-3, F-8;
 * TC-WT-003/004/005, TC-ENV-001/002, TC-REG-002; AC-F2-1, AC-F3-1, AC-F8-1;
 * NFR-2, NFR-7). Hermetic end to end: temporary git repositories, temporary
 * state stores, scripted harnesses, and install/build STUBS (RSK-T5) — no
 * network, no credentials, zero timing assertions (TC-ENV-004 is delivery
 * evidence in the change pm-notes, never a suite assertion).
 */
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitBranchSeam } from "@delivery-os/adapters/git";
import type { DispatchWorktreeProvisioning } from "../../packages/core/src/app/dispatch";
import { runDispatch } from "../../packages/core/src/app/dispatch";
import { newestDispatchLaneWorktreePaths } from "../../packages/core/src/app/dispatch-lane-view";
import {
  latestDispatchLaneFor,
  readDispatchLanes,
} from "../../packages/core/src/app/dispatch-ledger";
import { resolveLaneWorktreePlacement } from "../../packages/core/src/app/state-scope";
import { deriveLaneWorktreeEnvironment } from "../../packages/core/src/domain/lane-worktree-plan";
import {
  COMPLETED_EVIDENCE,
  createDispatchState,
  createScriptedHarness,
} from "../fixtures/dispatch/harness";

/** A temporary git repository parked on its base branch, clean. */
const makeBaseRepo = (): {
  readonly directory: string;
  readonly baseRef: string;
  readonly run: (args: readonly string[]) => string;
  readonly remove: () => void;
} => {
  const directory = mkdtempSync(join(tmpdir(), "gh404-lane-repo-"));
  const run = (args: readonly string[]): string => {
    const { execFileSync } = require("node:child_process") as {
      execFileSync: (file: string, args: readonly string[], options: unknown) => string;
    };
    return execFileSync("git", [...args], { cwd: directory, encoding: "utf8" }).trim();
  };
  run(["init", "-q", "-b", "main-tools"]);
  run(["config", "user.email", "gh404@example.invalid"]);
  run(["config", "user.name", "GH-404 Fixture"]);
  run(["commit", "-q", "--allow-empty", "-m", "base"]);
  return {
    directory,
    baseRef: "main-tools",
    run,
    remove: () => rmSync(directory, { recursive: true, force: true }),
  };
};

const isClean = (repoDirectory: string): boolean => {
  const { execFileSync } = require("node:child_process") as {
    execFileSync: (file: string, args: readonly string[], options: unknown) => string;
  };
  return (
    execFileSync("git", ["status", "--porcelain"], {
      cwd: repoDirectory,
      encoding: "utf8",
    }).trim().length === 0
  );
};

const branchOf = (repoDirectory: string): string => {
  const { execFileSync } = require("node:child_process") as {
    execFileSync: (file: string, args: readonly string[], options: unknown) => string;
  };
  return execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoDirectory,
    encoding: "utf8",
  }).trim();
};

/** The real provisioning stub: creation + gate temp dir, install/build stubbed. */
const makeProvisioner = (input: {
  readonly repo: ReturnType<typeof makeBaseRepo>;
  readonly configuredRoot?: string;
  readonly placementRoot?: string;
  readonly steps: string[];
  readonly mode: "worktree" | "in-checkout";
}) => {
  const environment = {
    current: undefined as ReturnType<typeof deriveLaneWorktreeEnvironment> | undefined,
  };
  return async (ref: string): Promise<DispatchWorktreeProvisioning> => {
    if (input.mode === "in-checkout") return { ok: true, mode: "in-checkout" };
    const placement = resolveLaneWorktreePlacement({
      physicalCheckoutRoot: input.placementRoot ?? input.repo.directory,
      ...(input.configuredRoot === undefined ? {} : { configuredRoot: input.configuredRoot }),
      ref,
    });
    const derived = deriveLaneWorktreeEnvironment({ worktreePath: placement.worktreePath });
    environment.current = derived;
    const created = await createGitBranchSeam({
      cwd: input.repo.directory,
      timeoutMs: 10_000,
    }).addWorktree({
      path: placement.worktreePath,
      newBranch: placement.branch,
      baseRef: input.repo.baseRef,
    });
    if (!created.ok) {
      return { ok: false, code: created.code, detail: created.detail };
    }
    // The ordered provisioning steps (install, gate build) — STUBBED (RSK-T5):
    // recorded, never executed, never timed. The gate temporary directory is
    // created inside the worktree for real (DEC-6).
    input.steps.push("install-dependencies");
    input.steps.push("build-gate-prerequisites");
    input.steps.push("create-gate-temporary-directory");
    mkdirSync(derived.gateTemporaryDirectory, { recursive: true });
    return {
      ok: true,
      mode: "worktree",
      worktreePath: placement.worktreePath,
      branch: placement.branch,
    };
  };
};

describe("TC-WT-003 dispatch creates the worktree before the first phase, lease-first", () => {
  test("the lease is claimed, the worktree is provisioned, then the lane spawns in it", async () => {
    const repo = makeBaseRepo();
    const state = createDispatchState("wt-lease-first");
    const order: string[] = [];
    const steps: string[] = [];
    const provision = makeProvisioner({ repo, steps, mode: "worktree" });
    const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
    const spawnInputs = scripted.spawnInputs;
    try {
      const result = await runDispatch({
        store: state.store,
        fenceToken: state.fenceToken,
        harness: scripted.port,
        harnessKind: "opencode",
        descriptor: { kind: "headless", workDirectory: repo.directory, environment: [] },
        prompt: "deliver",
        ref: "GH-401",
        evidenceClass: "pilot",
        repository: "github.com/owner/repo",
        handoverState: "dual-run",
        nowIso: () => "2026-11-25T12:00:00.000Z",
        newAttemptId: () => "attempt-wt",
        newDivergenceId: () => "DIV-WT",
        readTruth: async () => ({
          artifacts: {
            ok: true,
            value: {
              branchCommits: 1,
              pr: { state: "open", url: "https://x/pr", checks: { verdict: "success" } },
              pmNotes: { complete: true, phases: 11 },
            },
          },
          ledger: {
            ok: true,
            value: { completed: 10, total: 11, progressed: true, workRemaining: true },
          },
          tracker: { ok: true, value: { state: "in-progress", blocking: false } },
          ci: { ok: true, value: { verdict: "success" } },
          verifyOutcome: null,
          trackerToken: null,
          phasesComplete: false,
        }),
        claimLease: () => {
          order.push("lease");
          return { ok: true as const, leaseId: "lease-wt" };
        },
        releaseLease: () => true,
        phaseLedger: { completed: 0, total: 11, variant: "full" },
        laneOwner: { processId: 1, startedAt: "2026-11-25T12:00:00.000Z" },
        provisionWorktree: () => {
          order.push("provision");
          return provision("GH-401");
        },
      });
      expect(result.ok).toBe(true);
      // The lease-first order is the engine's own sequence (NG-2), and the
      // provisioning steps all ran before the lane's first phase.
      expect(order).toEqual(["lease", "provision"]);
      expect(steps).toEqual([
        "install-dependencies",
        "build-gate-prerequisites",
        "create-gate-temporary-directory",
      ]);
      // The lane spawns INSIDE the worktree (F-3).
      const worktreePath = spawnInputs[0]?.descriptor.workDirectory ?? "";
      expect(worktreePath).toContain("GH-401");
      expect(existsSync(worktreePath)).toBe(true);
      expect(branchOf(worktreePath)).toBe("lane/GH-401");
      // The worktree is a sibling of the main checkout at the base tip.
      expect(worktreePath.startsWith(`${repo.directory}-`)).toBe(true);
      expect(repo.run(["-C", worktreePath, "rev-parse", "HEAD"])).toBe(
        repo.run(["rev-parse", repo.baseRef]),
      );
      // The main checkout stays on the base branch and clean (NFR-2).
      expect(branchOf(repo.directory)).toBe(repo.baseRef);
      expect(isClean(repo.directory)).toBe(true);
      // The lane record carries the worktree context (DM-1).
      const lanes = readDispatchLanes(state.store);
      const latest = lanes.ok ? latestDispatchLaneFor(lanes.records, "GH-401") : undefined;
      expect(latest?.worktreePath).toBe(worktreePath);
      // The join source maps it (the surfaces' ref-keyed join).
      expect(newestDispatchLaneWorktreePaths(lanes.ok ? lanes.records : [])["GH-401"]).toBe(
        worktreePath,
      );
    } finally {
      const worktreePath = spawnInputs[0]?.descriptor.workDirectory;
      if (worktreePath !== undefined && existsSync(worktreePath)) {
        repo.run(["worktree", "remove", "--force", worktreePath]);
      }
      repo.remove();
      state.dispose();
    }
  });

  test("a provisioning refusal releases the lease and surfaces without retry", async () => {
    const state = createDispatchState("wt-refusal");
    const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
    let provisions = 0;
    try {
      const result = await runDispatch({
        store: state.store,
        fenceToken: state.fenceToken,
        harness: scripted.port,
        harnessKind: "opencode",
        descriptor: { kind: "headless", workDirectory: "/nowhere", environment: [] },
        prompt: "deliver",
        ref: "GH-402",
        evidenceClass: "pilot",
        repository: "github.com/owner/repo",
        handoverState: "dual-run",
        nowIso: () => "2026-11-25T12:00:00.000Z",
        newAttemptId: () => "attempt-wt2",
        newDivergenceId: () => "DIV-WT2",
        readTruth: async () => ({
          artifacts: {
            ok: true,
            value: {
              branchCommits: 1,
              pr: { state: "open", url: "https://x/pr", checks: { verdict: "success" } },
              pmNotes: { complete: true, phases: 11 },
            },
          },
          ledger: {
            ok: true,
            value: { completed: 10, total: 11, progressed: true, workRemaining: true },
          },
          tracker: { ok: true, value: { state: "in-progress", blocking: false } },
          ci: { ok: true, value: { verdict: "success" } },
          verifyOutcome: null,
          trackerToken: null,
          phasesComplete: false,
        }),
        claimLease: () => ({ ok: true as const, leaseId: "lease-wt2" }),
        releaseLease: () => true,
        phaseLedger: { completed: 0, total: 11, variant: "full" },
        provisionWorktree: () => {
          provisions += 1;
          return {
            ok: false,
            code: "worktree-add-refused",
            detail: "git refused the worktree creation (128)",
          };
        },
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("dispatch.session.spawn-failed");
        expect(result.error.summary).toContain("the lane worktree could not be provisioned");
      }
      // Zero retries: exactly one provisioning attempt, zero spawns.
      expect(provisions).toBe(1);
      expect(scripted.calls.filter((call) => call === "spawn")).toHaveLength(0);
    } finally {
      state.dispose();
    }
  });
});

describe("TC-WT-004 the sibling default and the explicit worktree-root setting", () => {
  test("unset worktree-root places the worktree as a sibling of the main checkout", () => {
    const repo = makeBaseRepo();
    try {
      const basename = repo.directory.slice(repo.directory.lastIndexOf("/") + 1);
      const placement = resolveLaneWorktreePlacement({
        physicalCheckoutRoot: repo.directory,
        ref: "GH-404",
      });
      expect(placement.worktreeRoot).toBe(repo.directory.slice(0, repo.directory.lastIndexOf("/")));
      expect(placement.worktreePath).toBe(`${placement.worktreeRoot}/${basename}-GH-404`);
      expect(placement.branch).toBe("lane/GH-404");
    } finally {
      repo.remove();
    }
  });

  test("an explicit worktree-root wins over the sibling default", () => {
    const repo = makeBaseRepo();
    const explicitRoot = mkdtempSync(join(tmpdir(), "gh404-explicit-root-"));
    try {
      const basename = repo.directory.slice(repo.directory.lastIndexOf("/") + 1);
      const placement = resolveLaneWorktreePlacement({
        physicalCheckoutRoot: repo.directory,
        configuredWorktreeRoot: explicitRoot,
        ref: "GH-404",
      });
      expect(placement.worktreeRoot).toBe(explicitRoot);
      expect(placement.worktreePath).toBe(join(explicitRoot, `${basename}-GH-404`));
    } finally {
      rmSync(explicitRoot, { recursive: true, force: true });
      repo.remove();
    }
  });
});

describe("TC-WT-005 paths resolve from the clone's physical location", () => {
  test("a symlinked alias never participates in the placement", () => {
    const repo = makeBaseRepo();
    const parent = mkdtempSync(join(tmpdir(), "gh404-physical-"));
    try {
      // Move the clone to a physical location and reach it through an alias.
      const physical = join(parent, "physical-repo");
      renameSync(repo.directory, physical);
      const alias = join(parent, "alias-repo");
      symlinkSync(physical, alias);
      expect(realpathSync(alias)).toBe(physical);
      // The composition resolves the PHYSICAL location once (realpathSync) and
      // the placement derives from it — the sibling lands beside the physical
      // clone, never beside the alias.
      const placement = resolveLaneWorktreePlacement({
        physicalCheckoutRoot: realpathSync(alias),
        ref: "GH-405",
      });
      expect(placement.worktreePath).toBe(join(parent, "physical-repo-GH-405"));
      expect(placement.worktreePath.startsWith(alias)).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("TC-ENV-002 the derived lane environment", () => {
  test("the worktree bin leads PATH, the gate temp dir lives inside the worktree", () => {
    const derived = deriveLaneWorktreeEnvironment({
      worktreePath: "/repos/checkout-GH-404",
    });
    expect(derived.workingDirectory).toBe("/repos/checkout-GH-404");
    expect(derived.pathLeadingBin).toBe("/repos/checkout-GH-404/node_modules/.bin");
    expect(derived.gateTemporaryDirectory).toBe("/repos/checkout-GH-404/tmp/tmpdir");
    expect(derived.gateTemporaryDirectoryEvidenceLiteral).toBe("$PWD/tmp/tmpdir");
    // The gate temporary directory is created inside the worktree by the
    // provisioning (asserted on the real fixture above: TC-WT-003's steps).
  });
});

describe("TC-REG-002 the disable-worktrees exception at the same seam", () => {
  test("an in-checkout provisioning creates nothing and the lane runs in the main checkout", async () => {
    const repo = makeBaseRepo();
    const state = createDispatchState("wt-exception");
    const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
    const spawnInputs = scripted.spawnInputs;
    try {
      const result = await runDispatch({
        store: state.store,
        fenceToken: state.fenceToken,
        harness: scripted.port,
        harnessKind: "opencode",
        descriptor: { kind: "headless", workDirectory: repo.directory, environment: [] },
        prompt: "deliver",
        ref: "GH-403",
        evidenceClass: "pilot",
        repository: "github.com/owner/repo",
        handoverState: "dual-run",
        nowIso: () => "2026-11-25T12:00:00.000Z",
        newAttemptId: () => "attempt-wt3",
        newDivergenceId: () => "DIV-WT3",
        readTruth: async () => ({
          artifacts: {
            ok: true,
            value: {
              branchCommits: 1,
              pr: { state: "open", url: "https://x/pr", checks: { verdict: "success" } },
              pmNotes: { complete: true, phases: 11 },
            },
          },
          ledger: {
            ok: true,
            value: { completed: 10, total: 11, progressed: true, workRemaining: true },
          },
          tracker: { ok: true, value: { state: "in-progress", blocking: false } },
          ci: { ok: true, value: { verdict: "success" } },
          verifyOutcome: null,
          trackerToken: null,
          phasesComplete: false,
        }),
        claimLease: () => ({ ok: true as const, leaseId: "lease-wt3" }),
        releaseLease: () => true,
        phaseLedger: { completed: 0, total: 11, variant: "full" },
        laneOwner: { processId: 1, startedAt: "2026-11-25T12:00:00.000Z" },
        provisionWorktree: () => ({ ok: true, mode: "in-checkout" }),
      });
      expect(result.ok).toBe(true);
      // The lane runs in the main checkout exactly as today.
      expect(spawnInputs[0]?.descriptor.workDirectory).toBe(repo.directory);
      // No worktree is created or referenced anywhere.
      const lanes = readDispatchLanes(state.store);
      const latest = lanes.ok ? latestDispatchLaneFor(lanes.records, "GH-403") : undefined;
      expect(latest?.worktreePath).toBeUndefined();
      expect(
        newestDispatchLaneWorktreePaths(lanes.ok ? lanes.records : [])["GH-403"],
      ).toBeUndefined();
      expect(branchOf(repo.directory)).toBe(repo.baseRef);
      expect(isClean(repo.directory)).toBe(true);
    } finally {
      repo.remove();
      state.dispose();
    }
  });
});
