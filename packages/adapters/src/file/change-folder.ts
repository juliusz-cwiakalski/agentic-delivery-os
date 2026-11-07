/**
 * Change-folder location (GH-242 F-5, DEC-4).
 *
 * Locates `doc/changes/<month>/<date>--<ref>--<slug>/` through the same
 * convention as pm-notes and the plan artifact, and converts it to the
 * repository-relative prefix the commit staging scope consumes. Read-only: no
 * writes, spawns, network, or clock.
 */
import type { PmNotesFileSystemFacts } from "./pm-notes-parser.js";

const REF_PATTERN = /^[A-Z]+-[0-9]+$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

export type ChangeFolderRequest = {
  readonly changeRef: string;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
};

export type ChangeFolderLookup = ChangeFolderRequest & { readonly repoRoot: string };

const safeList = (fs: PmNotesFileSystemFacts, path: string): readonly string[] => {
  try {
    return fs.listDirectory(path);
  } catch {
    return [];
  }
};

/** Locate one ref's change folder by the `--<ref>--` convention. */
export const locateChangeFolder = (request: ChangeFolderRequest): string | undefined => {
  if (!REF_PATTERN.test(request.changeRef)) return undefined;
  const { fs, changesDirectory, changeRef } = request;
  if (!fs.exists(changesDirectory)) return undefined;
  for (const month of [...safeList(fs, changesDirectory)]
    .filter((name) => MONTH_PATTERN.test(name))
    .sort()) {
    const monthDirectory = `${changesDirectory}/${month}`;
    for (const folder of [...safeList(fs, monthDirectory)].sort()) {
      if (folder.includes(`--${changeRef}--`)) return `${monthDirectory}/${folder}`;
    }
  }
  return undefined;
};

const trimSeparators = (path: string): string => path.replace(/[\\/]+$/u, "");

/**
 * Resolve the change folder to a repository-relative prefix.
 *
 * A folder outside the repository root is returned unchanged so the staging
 * computation can classify it as a stray instead of silently widening scope.
 */
export const relativeChangeFolder = (request: ChangeFolderLookup): string | undefined => {
  const folder = locateChangeFolder(request);
  if (folder === undefined) return undefined;
  const root = `${trimSeparators(request.repoRoot)}/`;
  return folder.startsWith(root) ? folder.slice(root.length) : folder;
};
