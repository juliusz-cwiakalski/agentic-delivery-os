/**
 * Identity-marker helpers for the corruption and copied-marker cells
 * (GH-288 TC-PROJ-003/004, and phase-3's TC-PROJ-040 cell 4).
 *
 * The helpers are built on the product's own seam: the marker path comes from
 * the adapter, so a test never spells the artifact name, and raw byte writes
 * exist only here (a marker is untrusted input by contract).
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import {
  projectIdentityMarkerPath,
  readProjectIdentityMarker,
} from "../../../packages/adapters/src/file/project-identity";

/** The marker path inside one checkout's git common directory. */
export const markerPathOf = (gitCommonDirectory: string): string =>
  projectIdentityMarkerPath(gitCommonDirectory);

/** Read the marker text through the delivered seam; undefined when unusable. */
export const markerTextOf = (gitCommonDirectory: string): string | undefined => {
  const read = readProjectIdentityMarker(gitCommonDirectory);
  return read.state === "present" ? read.text : undefined;
};

/** Write raw marker bytes (a corruption provocation), replacing any marker. */
export const writeRawMarker = (gitCommonDirectory: string, bytes: string): void => {
  mkdirSync(gitCommonDirectory, { recursive: true });
  const path = markerPathOf(gitCommonDirectory);
  rmSync(path, { force: true });
  writeFileSync(path, bytes);
};

/**
 * Replace one checkout's marker with a freshly minted payload (the re-keyed
 * cell). A marker is untrusted input by contract, so the raw write is the
 * provocation and the delivered read seam still governs the outcome.
 */
export const rotateProjectIdentityMarker = (gitCommonDirectory: string, bytes: string): void => {
  writeRawMarker(gitCommonDirectory, bytes);
};

/** Copy one checkout's marker bytes into another checkout's common directory. */
export const copyMarker = (fromCommonDirectory: string, toCommonDirectory: string): string => {
  const bytes = readFileSync(markerPathOf(fromCommonDirectory), "utf8");
  writeRawMarker(toCommonDirectory, bytes);
  return bytes;
};

/** The marker file's mode bits (`0o777`-masked), or undefined when absent. */
export const markerModeOf = (gitCommonDirectory: string): number | undefined => {
  try {
    return statSync(markerPathOf(gitCommonDirectory)).mode & 0o777;
  } catch {
    return undefined;
  }
};

/** The marker file's inode and mtime, for the create-once assertion. */
export const markerStatOf = (
  gitCommonDirectory: string,
): { readonly inode: number; readonly mtimeMs: number } | undefined => {
  try {
    const stat = statSync(markerPathOf(gitCommonDirectory));
    return { inode: stat.ino, mtimeMs: stat.mtimeMs };
  } catch {
    return undefined;
  }
};
