/**
 * Real temporary git repositories for the watchdog behaviour suites (GH-221
 * test-plan §6). Every fixture lives under the OS temp directory, is initialized
 * with an explicit `main` base and a fixed author identity, and is removed
 * explicitly. A guard rejects any fixture root equal to the live workspace, so a
 * destructive-adjacent teardown test can never target the checkout it runs in.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { WatchdogLaneRecord } from "../../../packages/core/src/contracts/index";

export const BASE_REF = "main";
export const LANE = "lane-1";
export const LANE_BRANCH = "feat/GH-221/lane-1";
export const MEMORY_PUBLICATION = ".ai/memory/agents/watchdog-fixture/README.md";
export const MEMORY_UNTRACKED = ".ai/memory/agents/watchdog-fixture/new.md";

export type WatchdogTempRepository = {
  readonly directory: string;
  readonly baseRef: string;
  readonly laneBranch: string;
  readonly run: (args: readonly string[]) => string;
  readonly write: (relative: string, content: string) => void;
  readonly read: (relative: string) => string;
  readonly exists: (relative: string) => boolean;
  readonly commitFile: (relative: string, content: string, message: string) => string;
  readonly remove: () => void;
};

export type WatchdogTempRepositoryOptions = {
  /** Commit a tracked `.ai/memory` publication on the base branch before branching. */
  readonly memoryBaseline?: boolean;
};

const guardFixtureRoot = (directory: string): void => {
  if (resolve(directory) === resolve(process.cwd())) {
    throw new Error("watchdog fixture root must not be the live workspace");
  }
  if (!resolve(directory).startsWith(resolve(tmpdir()))) {
    throw new Error("watchdog fixture root must live under the OS temp directory");
  }
};

/** Create a repository with `main`, a lane branch, and one lane delivery commit. */
export const createWatchdogRepository = (
  options: WatchdogTempRepositoryOptions = {},
): WatchdogTempRepository => {
  const directory = mkdtempSync(join(tmpdir(), "gh221-watchdog-"));
  guardFixtureRoot(directory);
  const run = (args: readonly string[]): string =>
    execFileSync("git", [...args], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  const write = (relative: string, content: string): void => {
    const path = join(directory, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  const commitFile = (relative: string, content: string, message: string): string => {
    write(relative, content);
    run(["add", "--", relative]);
    run(["commit", "-m", message]);
    return run(["rev-parse", "HEAD"]);
  };

  run(["init", "-b", BASE_REF]);
  run(["config", "user.email", "watchdog@example.invalid"]);
  run(["config", "user.name", "Watchdog Fixture"]);
  commitFile("README.md", "baseline\n", "baseline");
  if (options.memoryBaseline === true) {
    commitFile(MEMORY_PUBLICATION, "baseline memory\n", "baseline memory publication");
  }
  run(["checkout", "-b", LANE_BRANCH]);
  commitFile("feature.txt", "lane delivery\n", "lane delivery work");

  return {
    directory,
    baseRef: BASE_REF,
    laneBranch: LANE_BRANCH,
    run,
    write,
    read: (relative) => readFileSync(join(directory, relative), "utf8"),
    exists: (relative) => existsSync(join(directory, relative)),
    commitFile,
    remove: () => {
      rmSync(directory, { recursive: true, force: true });
    },
  };
};

/** The lane record every fixture injects (PIN-5). */
export const laneRecord = (
  overrides: Partial<WatchdogLaneRecord> = {},
): WatchdogLaneRecord => ({
  lane: LANE,
  baseRef: BASE_REF,
  workspacePaths: ["work"],
  ...overrides,
});

export type CheckoutSnapshot = {
  readonly status: string;
  readonly head: string;
  readonly branch: string;
};

/** Record what preflight must leave untouched. */
export const snapshotCheckout = (repo: WatchdogTempRepository): CheckoutSnapshot => ({
  status: repo.run(["status", "--porcelain"]),
  head: repo.run(["rev-parse", "HEAD"]),
  branch: repo.run(["rev-parse", "--abbrev-ref", "HEAD"]),
});

/** FIX-CLEAN: a clean checkout on the declared base. */
export const makeClean = (repo: WatchdogTempRepository): void => {
  repo.run(["checkout", BASE_REF]);
};

/** FIX-DIRTY: an uncommitted modification and an untracked file on the lane branch. */
export const makeDirty = (repo: WatchdogTempRepository): void => {
  repo.write("README.md", "modified baseline\n");
  repo.write("notes.local", "dirty note\n");
};

/** FIX-OFFBASE: an unrelated branch carrying a foreign commit. */
export const makeOffBase = (repo: WatchdogTempRepository): void => {
  repo.run(["checkout", "-b", "chore/foreign"]);
  repo.commitFile("foreign.txt", "foreign work\n", "foreign commit");
};

export type ForeignWorktree = {
  readonly directory: string;
  readonly branch: string;
};

/** FIX-FOREIGN-WORKTREE: a real `git worktree` checked out away from the base. */
export const makeForeignWorktree = (repo: WatchdogTempRepository): ForeignWorktree => {
  const branch = "chore/foreign-worktree";
  repo.run(["branch", branch, BASE_REF]);
  const directory = join(repo.directory, "foreign-wt");
  repo.run(["worktree", "add", directory, branch]);
  execFileSync("git", ["config", "user.email", "watchdog@example.invalid"], {
    cwd: directory,
    encoding: "utf8",
  });
  execFileSync("git", ["config", "user.name", "Watchdog Fixture"], {
    cwd: directory,
    encoding: "utf8",
  });
  writeFileSync(join(directory, "foreign.txt"), "foreign worktree work\n");
  execFileSync("git", ["add", "foreign.txt"], { cwd: directory, encoding: "utf8" });
  execFileSync("git", ["commit", "-m", "foreign worktree commit"], {
    cwd: directory,
    encoding: "utf8",
  });
  return { directory, branch };
};

/** FIX-SUCCESS-RESIDUE: lane residue under the declared workspace. */
export const makeSuccessResidue = (repo: WatchdogTempRepository): void => {
  repo.write("work/residue.txt", "lane residue\n");
};

/** FIX-FAIL-EXIT: a stray commit on the lane branch plus untracked content. */
export const makeFailExit = (repo: WatchdogTempRepository): string => {
  const head = repo.commitFile("work/stray.txt", "stray commit work\n", "stray lane commit");
  repo.write("notes.local", "uncommitted after failure\n");
  return head;
};

export type InterruptedState = {
  readonly strandedCommit: string;
  readonly branchHead: string;
};

/** FIX-INTERRUPTED: detached HEAD with a stranded commit plus uncommitted work. */
export const makeInterrupted = (repo: WatchdogTempRepository): InterruptedState => {
  const branchHead = repo.run(["rev-parse", "HEAD"]);
  repo.run(["checkout", "--detach"]);
  const strandedCommit = repo.commitFile(
    "stranded.txt",
    "stranded lane work\n",
    "stranded detached commit",
  );
  repo.write("scratch.txt", "uncommitted scratch\n");
  repo.write(MEMORY_UNTRACKED, "uncommitted memory publication\n");
  return { strandedCommit, branchHead };
};

/** FIX-MEM-COMMITTED: a memory publication committed on the lane branch. */
export const makeMemoryCommitted = (repo: WatchdogTempRepository): string =>
  repo.commitFile(MEMORY_PUBLICATION, "committed publication\n", "commit memory publication");

/** FIX-MEM-UNCOMMITTED: a modified tracked publication and an untracked one. */
export const makeMemoryUncommitted = (repo: WatchdogTempRepository): void => {
  repo.write(MEMORY_PUBLICATION, "modified publication with canary bytes\n");
  repo.write(MEMORY_UNTRACKED, "new untracked publication with canary bytes\n");
};

/** FIX-UNATTRIBUTED: untracked content unrelated to the lane. */
export const makeUnattributed = (repo: WatchdogTempRepository): void => {
  repo.write("notes.local", "unattributable local note\n");
};

/** FIX-BASE-MISSING is a lane-record fact, not a repository mutation. */
export const makeBaseMissingLane = (): WatchdogLaneRecord => laneRecord({ baseRef: "missing-base" });

/** Read a file's bytes from the working tree. */
export const readWorkingFile = (repo: WatchdogTempRepository, relative: string): string =>
  readFileSync(join(repo.directory, relative), "utf8");

/** Whether a ref exists locally. */
export const refExists = (repo: WatchdogTempRepository, ref: string): boolean => {
  try {
    execFileSync("git", ["rev-parse", "--verify", ref], {
      cwd: repo.directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
};

/** Whether `ancestor` is reachable from `descendant`. */
export const isAncestor = (
  repo: WatchdogTempRepository,
  ancestor: string,
  descendant: string,
): boolean => {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: repo.directory,
      encoding: "utf8",
    });
    return true;
  } catch {
    return false;
  }
};
