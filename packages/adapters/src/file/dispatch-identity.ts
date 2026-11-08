/**
 * The checkout-scoped first-use identity marker (GH-239 F-6; DEC-13;
 * TDR-0015 §6).
 *
 * The marker lives inside the checkout's git common directory, so it travels
 * with the checkout across a working-directory rename and is shared by every
 * linked worktree of the same repository. Two repositories in one home
 * therefore never share a binding, and one repository can never re-key
 * another's evidence.
 *
 * This module owns only the create-once read/write seam; identity
 * normalization and resolution order are the pure domain policy. Both writes
 * are atomic at the final path: the payload is written and synced to a sibling
 * temporary file and only then linked or renamed into place, so an interrupted
 * write can never leave a torn marker behind. The create-once write fails
 * closed when a marker already exists, and the explicit repair write replaces a
 * marker the caller classified as carrying no binding, so an unreadable marker
 * is never a permanently unrepairable state.
 */
import {
  closeSync,
  fsyncSync,
  linkSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { DISPATCH_IDENTITY_MARKER_NAME } from "@delivery-os/core/contracts";

/** The marker path inside one checkout's git common directory. */
export const dispatchIdentityMarkerPath = (gitCommonDirectory: string): string =>
  join(gitCommonDirectory, DISPATCH_IDENTITY_MARKER_NAME);

/** Read the raw persisted marker content; absent or unreadable is undefined. */
export const readDispatchIdentityMarkerText = (
  gitCommonDirectory: string | undefined,
): string | undefined => {
  if (gitCommonDirectory === undefined) return undefined;
  try {
    return readFileSync(dispatchIdentityMarkerPath(gitCommonDirectory), "utf8");
  } catch {
    return undefined;
  }
};

/** Write and sync one payload to a sibling temporary file; undefined on failure. */
const writeMarkerTemporary = (path: string, content: string): string | undefined => {
  const temporary = `${path}.${process.pid.toString(36)}.tmp`;
  rmSync(temporary, { force: true });
  try {
    const descriptor = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(descriptor, content, "utf8");
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    return temporary;
  } catch {
    rmSync(temporary, { force: true });
    return undefined;
  }
};

/**
 * Get-or-create the marker for one checkout. Creation is an exclusive link of a
 * fully written sibling file, so two racing writers can never both win and no
 * reader ever observes a partially written marker. A later call returns the
 * existing content and never rewrites it, so a rename or remote change cannot
 * re-key the binding.
 */
export const ensureDispatchIdentityMarkerText = (
  gitCommonDirectory: string | undefined,
  content: string,
): string | undefined => {
  if (gitCommonDirectory === undefined) return undefined;
  const existing = readDispatchIdentityMarkerText(gitCommonDirectory);
  if (existing !== undefined) return existing;
  const temporary = writeMarkerTemporary(dispatchIdentityMarkerPath(gitCommonDirectory), content);
  if (temporary === undefined) return undefined;
  try {
    linkSync(temporary, dispatchIdentityMarkerPath(gitCommonDirectory));
  } catch {
    // A concurrent writer landed the marker first (or the filesystem refuses a
    // hard link); the marker that exists, if any, governs.
  } finally {
    rmSync(temporary, { force: true });
  }
  return readDispatchIdentityMarkerText(gitCommonDirectory);
};

/**
 * Replace a marker the caller classified as carrying no binding (torn, empty,
 * or otherwise unparseable). The replacement is a synced temporary file renamed
 * over the final path, so the final path is never torn even if the process
 * dies mid-write; an unwritable marker is left unchanged and reported as
 * undefined, never as a crash.
 */
export const replaceDispatchIdentityMarkerText = (
  gitCommonDirectory: string | undefined,
  content: string,
): string | undefined => {
  if (gitCommonDirectory === undefined) return undefined;
  const temporary = writeMarkerTemporary(dispatchIdentityMarkerPath(gitCommonDirectory), content);
  if (temporary === undefined) return undefined;
  try {
    renameSync(temporary, dispatchIdentityMarkerPath(gitCommonDirectory));
    return content;
  } catch {
    return undefined;
  } finally {
    rmSync(temporary, { force: true });
  }
};
