/**
 * Real-checkout fixtures (GH-288 TC-PROJ-001..004, TC-PROJ-040).
 *
 * The identity input is the delivered git-metadata resolution, so these
 * fixtures create real repositories with `git init`, real commits, real
 * clones, and real linked worktrees rather than fabricating `.git` metadata the
 * production code would then be tested against. Every command runs with a
 * sanitized git environment and `GIT_CEILING_DIRECTORIES` pinned to the
 * approved base, so no fixture can discover the repository that runs the test.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APPROVED_BASE, guardStateFixtureRoot } from "./state-scope";

const GIT_ENVIRONMENT: Readonly<Record<string, string>> = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  GIT_AUTHOR_NAME: "GH-288 fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.invalid",
  GIT_COMMITTER_NAME: "GH-288 fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_CEILING_DIRECTORIES: APPROVED_BASE,
};

/** Run one git command in a fixture directory; a non-zero status throws. */
export const git = (cwd: string, args: readonly string[]): string => {
  const result = spawnSync("git", [...args], {
    cwd,
    env: GIT_ENVIRONMENT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${cwd}: ${result.stderr || result.error?.message || "unknown"}`,
    );
  }
  return result.stdout;
};

const commitInitial = (root: string): void => {
  writeFileSync(join(root, "README.md"), "# GH-288 fixture\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-m", "fixture: initial commit"]);
};

/**
 * Create one real repository with one commit. The directory name is the
 * identity input, so two parents with the same child name produce two
 * same-basename checkouts.
 */
export const createRepository = (parent: string, name: string): string => {
  guardStateFixtureRoot(parent);
  const root = join(parent, name);
  mkdirSync(root, { recursive: true });
  git(root, ["init", "-b", "main"]);
  commitInitial(root);
  return root;
};

/** Create one bare repository usable as a clone origin. */
export const createBareOrigin = (parent: string, name: string): string => {
  guardStateFixtureRoot(parent);
  const origin = join(parent, name);
  mkdirSync(origin, { recursive: true });
  git(origin, ["init", "--bare", "-b", "main"]);
  return origin;
};

/** Seed a bare origin with one commit so it can be cloned. */
export const seedOrigin = (workdir: string, origin: string): void => {
  const root = createRepository(workdir, "origin-seed");
  git(root, ["remote", "add", "origin", origin]);
  git(root, ["push", "origin", "main"]);
};

/** Clone one origin into a fresh directory (the clone's own common directory). */
export const cloneRepository = (origin: string, parent: string, name: string): string => {
  guardStateFixtureRoot(parent);
  const root = join(parent, name);
  mkdirSync(root, { recursive: true });
  git(root, ["clone", origin, "."]);
  return root;
};

/** Add one real linked worktree of an existing repository. */
export const addWorktree = (repository: string, parent: string, name: string): string => {
  guardStateFixtureRoot(parent);
  const root = join(parent, name);
  git(repository, ["worktree", "add", root, "-b", name]);
  return root;
};

/** Create a nested directory inside a checkout (no git metadata of its own). */
export const nestedDirectory = (root: string, ...segments: readonly string[]): string => {
  const directory = join(root, ...segments);
  mkdirSync(directory, { recursive: true });
  return directory;
};

/** Remove one fixture directory tree. */
export const removeDirectory = (directory: string): void => {
  rmSync(directory, { recursive: true, force: true });
};
