/**
 * `@delivery-os/adapters/file` — the bounded state-root enumeration (F-7, DM-4).
 *
 * The effective host root plus each first-level project directory beneath it:
 * nothing below a project directory is visited, no manifest is discovered, and
 * the repository is never walked. The declared cap bounds the enumeration so a
 * pathological machine degrades visibly rather than slowly.
 */
import type { InstallFilePort } from "@delivery-os/core/contracts";
import { INSTALL_MAX_JUDGED_ROOTS } from "@delivery-os/core/contracts";

/** One enumerated state root and its header facts. */
export type StateRootFacts = {
  readonly root: string;
  readonly exists: boolean;
  /** The header file names directly under the root (never their payloads). */
  readonly headers: readonly string[];
};

export type StateRootEnumeration = {
  readonly roots: readonly StateRootFacts[];
  readonly judged: number;
  readonly truncated: boolean;
};

/**
 * Enumerate the host root and its first-level project directories.
 *
 * The host root is judged even when it does not exist (an absent root is
 * `unchecked`, never `accepted`). The project container is read as directory
 * names only; a path that is not a directory is skipped.
 */
export const enumerateStateRoots = (input: {
  readonly fs: InstallFilePort;
  readonly hostRoot: string;
  readonly projectsDirectory: string;
  readonly cap?: number;
}): StateRootEnumeration => {
  const cap = input.cap ?? INSTALL_MAX_JUDGED_ROOTS;
  const rootFacts = (root: string): StateRootFacts => {
    const stat = input.fs.stat(root);
    const exists = stat !== undefined && stat.kind === "directory";
    return {
      root,
      exists,
      headers: exists ? input.fs.list(root).filter((name) => name.startsWith("header.")) : [],
    };
  };
  const projectRoots = input.fs
    .list(input.projectsDirectory)
    .map((name) => `${input.projectsDirectory}/${name}`)
    .filter((path) => input.fs.stat(path)?.kind === "directory");
  const all = [input.hostRoot, ...projectRoots];
  const truncated = all.length > cap;
  const judged = all.slice(0, cap);
  return { roots: judged.map(rootFacts), judged: judged.length, truncated };
};
