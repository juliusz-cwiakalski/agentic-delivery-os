/**
 * Fixture checkout topologies (GH-346 F-5, Appendix C.1).
 *
 * A fixture linked worktree, a primary-shaped checkout, a non-worktree clone,
 * and a plain directory. Every shape is created under the repo-local scratch
 * root, and no case depends on the repository's own worktrees.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nodeRepositoryIo, readCheckoutIdentity } from "../../../packages/adapters/src/repo/index";

const ROOT = process.cwd();

const git = (cwd: string, arguments_: readonly string[]): void => {
  execFileSync("git", [...arguments_], {
    cwd,
    stdio: "ignore",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "GH-346",
      GIT_AUTHOR_EMAIL: "gh346@example.invalid",
      GIT_COMMITTER_NAME: "GH-346",
      GIT_COMMITTER_EMAIL: "gh346@example.invalid",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
};

export type FixtureCheckouts = {
  readonly base: string;
  readonly primary: string;
  readonly clone: string;
  readonly worktree: string;
  readonly plain: string;
  dispose: () => void;
};

/** Create the four declared origin shapes under one scratch base. */
export const createFixtureCheckouts = (label: string): FixtureCheckouts => {
  const base = mkdtempSync(join(ROOT, `tmp/tmpdir/gh346-checkouts-${label}-`));
  const primary = join(base, "primary");
  const clone = join(base, "clone");
  const worktree = join(base, "lane");
  const plain = join(base, "plain");
  mkdirSync(primary, { recursive: true });
  git(primary, ["init", "--quiet", "--initial-branch=main"]);
  writeFileSync(join(primary, "README.md"), "# fixture\n");
  git(primary, ["add", "README.md"]);
  git(primary, ["commit", "--quiet", "-m", "fixture"]);
  git(base, ["clone", "--quiet", "--no-hardlinks", primary, clone]);
  git(primary, ["worktree", "add", "--quiet", "-b", "lane", worktree]);
  mkdirSync(plain, { recursive: true });
  return {
    base,
    primary,
    clone,
    worktree,
    plain,
    dispose: () => rmSync(base, { recursive: true, force: true }),
  };
};

/** The delivered worktree-topology read over one fixture directory. */
export const readFixtureCheckout = (directory: string) =>
  readCheckoutIdentity({ cwd: directory, io: nodeRepositoryIo() });

/** Whether a fixture directory resolves as a linked worktree. */
export const isFixtureWorktree = (directory: string): boolean => {
  const read = readFixtureCheckout(directory);
  return read.kind === "resolved" && read.gitDir !== read.commonDir;
};
