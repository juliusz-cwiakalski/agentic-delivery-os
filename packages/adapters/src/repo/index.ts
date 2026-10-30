/**
 * `@delivery-os/adapters/repo` — repository I/O adapter subpath.
 * Resolves a bounded git root (including linked-worktree `.git` files) and
 * never searches above the first root. Configuration discovery consumes only
 * the returned fact; this module never reads configuration files.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export type RepositoryIo = {
  readonly exists: (path: string) => boolean;
  readonly isFile: (path: string) => boolean;
  readonly readText: (path: string) => string;
};

export type RepositoryRootInput = {
  readonly cwd: string;
  readonly explicitRoot?: string;
  readonly io: RepositoryIo;
};

export type RepositoryRootFacts = {
  readonly gitRoot?: string;
  readonly explicitRoot?: string;
};

const gitDirectoryFile = (path: string, io: RepositoryIo): boolean =>
  io.isFile(path) && io.readText(path).trimStart().startsWith("gitdir:");

/**
 * Walk from cwd to the first `.git` entry. A directory is a normal root; a
 * `.git` file is a linked worktree root. Never continues above that root.
 */
export const findGitRoot = (cwd: string, io: RepositoryIo): string | undefined => {
  let current = cwd;
  for (;;) {
    const candidate = join(current, ".git");
    if (io.exists(candidate)) {
      if (io.isFile(candidate)) {
        return gitDirectoryFile(candidate, io) ? current : undefined;
      }
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
};

export const resolveRepositoryRoot = (input: RepositoryRootInput): RepositoryRootFacts => {
  const gitRoot = findGitRoot(input.cwd, input.io);
  return {
    ...(gitRoot !== undefined ? { gitRoot } : {}),
    ...(input.explicitRoot !== undefined ? { explicitRoot: input.explicitRoot } : {}),
  };
};

/** Production filesystem facts for the runtime edge and integration tests. */
export const nodeRepositoryIo = (): RepositoryIo => ({
  exists: (path) => existsSync(path),
  isFile: (path) => {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  },
  readText: (path) => readFileSync(path, "utf8"),
});
