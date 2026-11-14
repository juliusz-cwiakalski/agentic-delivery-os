/**
 * The containment-safe workspace discovery scan (GH-309 F-3, DM-1, NFR-4, C-4).
 *
 * The scan walks a registered `workspaceRoot` in read-only fashion and reports
 * clones that the configuration already declares. Membership is configuration
 * only: a candidate is admitted exactly when its durable repository key is a
 * declared `repoKey` selector or its root is a declared `root` selector — an
 * undeclared clone is never returned, at any depth. The walk descends into
 * every non-symbolic child directory (including inside another checkout) and
 * never enters a `.git` directory, so a nested undeclared clone is still
 * filtered by the same admission rule.
 *
 * Filesystem facts are injected; production supplies `node:fs`. The module
 * reads only: it creates, moves, and removes nothing.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

/** One directory entry fact the walk consumes. */
export type WorkspaceScanEntry = {
  readonly name: string;
  readonly directory: boolean;
  readonly symbolicLink: boolean;
};

/** The injected directory-listing seam; a failed listing is an empty list. */
export type WorkspaceScanFileSystem = {
  readonly list: (path: string) => readonly WorkspaceScanEntry[];
};

/** The production listing seam over `node:fs`; unreadable directories are empty. */
export const nodeWorkspaceScanFileSystem = (): WorkspaceScanFileSystem => ({
  list: (path) => {
    try {
      return readdirSync(path, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        directory: entry.isDirectory(),
        symbolicLink: entry.isSymbolicLink(),
      }));
    } catch {
      return [];
    }
  },
});

/** One declared member's selector facts; exactly the sides the configuration carries. */
export type WorkspaceScanMember = {
  readonly root?: string;
  readonly repoKey?: string;
};

/** One admitted clone: its checkout root and, when readable, its durable key. */
export type WorkspaceLocatedClone = {
  readonly root: string;
  readonly repoKey?: string;
};

const normalizeRoot = (path: string): string => path.replace(/[\\/]+$/u, "");

const byName = (left: WorkspaceScanEntry, right: WorkspaceScanEntry): number =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

/**
 * Scan one registered workspace root and return only declared clones.
 *
 * `repoKeyOf` is the injected identity read for a candidate root (the durable
 * marker key); it returns `undefined` when the candidate carries no readable
 * identity. A candidate is admitted by a declared key or a declared root; no
 * other candidate is ever returned. The result is ordered by root so repeated
 * reads over unchanged state are stable.
 */
export const scanDeclaredWorkspaceMembers = (input: {
  readonly workspaceRoot: string;
  readonly declared: readonly WorkspaceScanMember[];
  readonly repoKeyOf: (root: string) => string | undefined;
  readonly fs?: WorkspaceScanFileSystem;
}): readonly WorkspaceLocatedClone[] => {
  const fs = input.fs ?? nodeWorkspaceScanFileSystem();
  const declaredKeys = new Set(
    input.declared.flatMap((member) => (member.repoKey === undefined ? [] : [member.repoKey])),
  );
  const declaredRoots = new Set(
    input.declared.flatMap((member) =>
      member.root === undefined ? [] : [normalizeRoot(member.root)],
    ),
  );
  const located: WorkspaceLocatedClone[] = [];

  const walk = (directory: string, isRoot: boolean): void => {
    const entries = [...fs.list(directory)].sort(byName);
    const isCheckout = entries.some((entry) => entry.name === ".git");
    if (!isRoot && isCheckout) {
      let repoKey: string | undefined;
      try {
        repoKey = input.repoKeyOf(directory);
      } catch {
        repoKey = undefined;
      }
      const admittedByKey = repoKey !== undefined && declaredKeys.has(repoKey);
      const admittedByRoot = declaredRoots.has(normalizeRoot(directory));
      if (admittedByKey || admittedByRoot) {
        located.push({ root: directory, ...(repoKey === undefined ? {} : { repoKey }) });
      }
    }
    for (const entry of entries) {
      if (!entry.directory || entry.symbolicLink || entry.name === ".git") continue;
      walk(join(directory, entry.name), false);
    }
  };

  walk(input.workspaceRoot, true);
  return [...located].sort((left, right) =>
    left.root < right.root ? -1 : left.root > right.root ? 1 : 0,
  );
};
