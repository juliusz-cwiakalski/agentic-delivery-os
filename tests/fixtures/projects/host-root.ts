/**
 * Host-root snapshots (GH-288 TC-PROJ-009, TC-PROJ-041).
 *
 * A snapshot is name → sha256 plus the file mode and the mode of every
 * directory, so "nothing under the project container changed" is a byte and
 * mode claim rather than an existence claim.
 */
import { createHash } from "node:crypto";
import { type Dirent, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type TreeSnapshot = {
  readonly files: Readonly<Record<string, { readonly sha256: string; readonly mode: number }>>;
  readonly directories: Readonly<Record<string, number>>;
};

const modeOf = (path: string): number => statSync(path).mode & 0o777;

/** Snapshot every file (bytes + mode) and directory (mode) under one root. */
export const snapshotTree = (root: string): TreeSnapshot => {
  const files: Record<string, { sha256: string; mode: number }> = {};
  const directories: Record<string, number> = {};
  const walk = (relative: string): void => {
    const directory = relative.length === 0 ? root : join(root, relative);
    let entries: Dirent[];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    directories[relative.length === 0 ? "." : relative] = modeOf(directory);
    for (const entry of entries) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(next);
        continue;
      }
      const path = join(root, next);
      files[next] = {
        sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
        mode: modeOf(path),
      };
    }
  };
  walk("");
  return { files, directories };
};

/** The differences between two snapshots; empty means byte- and mode-identical. */
export const snapshotDifferences = (before: TreeSnapshot, after: TreeSnapshot): string[] => {
  const differences: string[] = [];
  for (const [name, fact] of Object.entries(before.files)) {
    const current = after.files[name];
    if (current === undefined) {
      differences.push(`removed file ${name}`);
      continue;
    }
    if (current.sha256 !== fact.sha256) differences.push(`changed bytes ${name}`);
    if (current.mode !== fact.mode) differences.push(`changed file mode ${name}`);
  }
  for (const name of Object.keys(after.files)) {
    if (before.files[name] === undefined) differences.push(`added file ${name}`);
  }
  for (const [name, mode] of Object.entries(before.directories)) {
    const current = after.directories[name];
    if (current === undefined) differences.push(`removed directory ${name}`);
    else if (current !== mode) differences.push(`changed directory mode ${name}`);
  }
  for (const name of Object.keys(after.directories)) {
    if (before.directories[name] === undefined) differences.push(`added directory ${name}`);
  }
  return differences.sort();
};
