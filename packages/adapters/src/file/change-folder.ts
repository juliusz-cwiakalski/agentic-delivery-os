/**
 * The one read-only change-folder resolver (GH-240 F-1, DEC-1).
 *
 * Iterates `YYYY-MM` month directories ascending, then folder names ascending,
 * and selects the first folder whose name contains the exact `--<ref>--`
 * token. Resolution never creates a month, a folder, a capsule file, or an
 * archive tree; callers that write do so only after a successful resolution.
 */
import type { CapsuleLocation } from "@delivery-os/core/contracts";

const REF_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** The minimal filesystem facts resolution needs (read-only). */
export type ChangeFolderFileSystem = {
  readonly exists: (path: string) => boolean;
  readonly listDirectory: (path: string) => readonly string[];
};

/** The request shape shared by plan artifacts and the capsule. */
export type ChangeFolderRequest = {
  readonly changeRef: string;
  readonly changesDirectory: string;
  readonly fs: ChangeFolderFileSystem;
};

const safeList = (fs: ChangeFolderFileSystem, path: string): readonly string[] => {
  try {
    return fs.listDirectory(path);
  } catch {
    return [];
  }
};

/**
 * Resolve the unique change folder for one ref.
 *
 * An absent directory, an invalid ref, or an absent match is a classified
 * `capsule.folder-absent`; more than one matching folder in the same month is
 * `capsule.folder-ambiguous`. The first match in `(month, folder name)` order
 * wins (DEC-1).
 */
export const resolveChangeFolder = (request: ChangeFolderRequest): CapsuleLocation => {
  if (!REF_PATTERN.test(request.changeRef)) {
    return {
      ok: false,
      code: "capsule.folder-absent",
      detail: `ref ${request.changeRef} is not a work item reference`,
    };
  }
  const { fs, changesDirectory, changeRef } = request;
  if (!fs.exists(changesDirectory)) {
    return {
      ok: false,
      code: "capsule.folder-absent",
      detail: `changes directory ${changesDirectory} does not exist`,
    };
  }
  const token = `--${changeRef}--`;
  for (const month of [...safeList(fs, changesDirectory)]
    .filter((name) => MONTH_PATTERN.test(name))
    .sort()) {
    const monthDirectory = `${changesDirectory}/${month}`;
    const matches = [...safeList(fs, monthDirectory)].sort().filter((name) => name.includes(token));
    if (matches.length > 1) {
      return {
        ok: false,
        code: "capsule.folder-ambiguous",
        detail: `${matches.length} folders in ${month} match ${token}`,
      };
    }
    const folder = matches[0];
    if (folder !== undefined) {
      return { ok: true, folder: `${monthDirectory}/${folder}`, month, name: folder };
    }
  }
  return {
    ok: false,
    code: "capsule.folder-absent",
    detail: `no change folder contains ${token}`,
  };
};
