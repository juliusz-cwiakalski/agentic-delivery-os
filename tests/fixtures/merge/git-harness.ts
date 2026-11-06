/**
 * Real temporary-git fixtures for the rebase, landing, and convergence cases
 * (test plan §6.1). One `mkdtemp` repository per case, deterministic identity
 * and dates via the testkit builder, no remotes.
 */
import { createGitMergeSeam, type GitMergeSeam } from "../../../packages/adapters/src/git/index";
import {
  createTempGitRepository,
  type TempGitRepository,
} from "../../../packages/testkit/src/commit/index";
import type { MergeGitFacts } from "./harness";

export const FIXTURE_BRANCH = "feat/GH-301/merge";
export const FIXTURE_BASE = "main-tools";

export type RealMergeRepo = {
  readonly repo: TempGitRepository;
  readonly seam: GitMergeSeam;
  readonly git: MergeGitFacts;
  readonly branch: string;
  readonly baseRef: string;
  readonly oldHead: string;
  readonly baseHead: string;
  cleanup(): void;
};

const commit = (repo: TempGitRepository, message: string): void => {
  const added = repo.run(["add", "-A"]);
  if (added.status !== 0) throw new Error(`git add failed: ${added.stderr}`);
  const committed = repo.run(["commit", "-m", message]);
  if (committed.status !== 0) throw new Error(`git commit failed: ${committed.stderr}`);
};

const wrapper = (seam: GitMergeSeam): MergeGitFacts => ({
  head: () => seam.head(),
  isContained: (sha, ref) => seam.isContained(sha, ref),
  refresh: (input) => seam.refresh(input),
  land: (input) => seam.squashLand(input),
  deleteBranch: (input) => seam.deleteBranch(input),
});

/** A request branch behind its base with two conflicting paths. */
export const createConflictingRepo = (): RealMergeRepo => {
  const repo = createTempGitRepository({
    label: "merge-conflict",
    seedFiles: {
      "packages/core/src/a.ts": "export const a = 1;\nexport const shared = 1;\n",
      "packages/core/src/b.ts": "export const b = 1;\nexport const shared = 1;\n",
    },
  });
  repo.run(["branch", "-M", FIXTURE_BASE]);
  const baseHead = repo.head();
  repo.run(["checkout", "-b", FIXTURE_BRANCH]);
  repo.write("packages/core/src/a.ts", "export const a = 2;\nexport const shared = 2;\n");
  repo.write("packages/core/src/b.ts", "export const b = 2;\nexport const shared = 2;\n");
  commit(repo, "feat: change both files");
  const oldHead = repo.head();
  repo.run(["checkout", FIXTURE_BASE]);
  repo.write("packages/core/src/a.ts", "export const a = 3;\nexport const shared = 3;\n");
  repo.write("packages/core/src/b.ts", "export const b = 3;\nexport const shared = 3;\n");
  commit(repo, "chore: conflicting base change");
  repo.run(["checkout", FIXTURE_BRANCH]);
  const seam = createGitMergeSeam({ cwd: repo.root, timeoutMs: 20_000 });
  return {
    repo,
    seam,
    git: wrapper(seam),
    branch: FIXTURE_BRANCH,
    baseRef: FIXTURE_BASE,
    oldHead,
    baseHead,
    cleanup: () => repo.cleanup(),
  };
};

/** A request branch behind its base with no conflict. */
export const createBehindRepo = (): RealMergeRepo => {
  const repo = createTempGitRepository({
    label: "merge-behind",
    seedFiles: { "README.md": "base\n" },
  });
  repo.run(["branch", "-M", FIXTURE_BASE]);
  const baseHead = repo.head();
  repo.run(["checkout", "-b", FIXTURE_BRANCH]);
  repo.write("feature.ts", "export const feature = 1;\n");
  commit(repo, "feat: feature change");
  const oldHead = repo.head();
  repo.run(["checkout", FIXTURE_BASE]);
  repo.write("base-only.ts", "export const baseOnly = 1;\n");
  commit(repo, "chore: base advance");
  repo.run(["checkout", FIXTURE_BRANCH]);
  const seam = createGitMergeSeam({ cwd: repo.root, timeoutMs: 20_000 });
  return {
    repo,
    seam,
    git: wrapper(seam),
    branch: FIXTURE_BRANCH,
    baseRef: FIXTURE_BASE,
    oldHead,
    baseHead,
    cleanup: () => repo.cleanup(),
  };
};

/** A clean request branch that can land as one squash commit. */
export const createLandingRepo = (): RealMergeRepo => {
  const repo = createTempGitRepository({
    label: "merge-land",
    seedFiles: { "README.md": "base\n" },
  });
  repo.run(["branch", "-M", FIXTURE_BASE]);
  const baseHead = repo.head();
  repo.run(["checkout", "-b", FIXTURE_BRANCH]);
  repo.write("feature.ts", "export const feature = 1;\n");
  commit(repo, "feat: feature one");
  repo.write("feature.ts", "export const feature = 2;\n");
  commit(repo, "feat: feature two");
  const oldHead = repo.head();
  const seam = createGitMergeSeam({ cwd: repo.root, timeoutMs: 20_000 });
  return {
    repo,
    seam,
    git: wrapper(seam),
    branch: FIXTURE_BRANCH,
    baseRef: FIXTURE_BASE,
    oldHead,
    baseHead,
    cleanup: () => repo.cleanup(),
  };
};
