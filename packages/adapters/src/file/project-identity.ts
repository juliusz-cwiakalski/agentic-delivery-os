/**
 * The checkout identity marker seam (GH-288 F-1, DM-1, DEC-3).
 *
 * The marker lives inside the checkout's git COMMON directory, so it is shared
 * by every linked worktree of one repository and travels with a working-tree
 * rename or a moved checkout. It records the mint-time basename beside the
 * project key and the random project identifier, so the key can never be
 * recomputed from the current directory name.
 *
 * This module owns only the create-once read/write seam; key shape and marker
 * validation are the pure app-tier policy. The marker is written once, through
 * a synced sibling file linked into place, at mode `0600`, and is never
 * rewritten; a race loser reads the winner's file and no temporary sibling is
 * left behind.
 */
import {
  closeSync,
  fsyncSync,
  linkSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ProjectIdentityMarkerRead } from "@delivery-os/core/contracts";
import { PROJECT_IDENTITY_MARKER_NAME } from "@delivery-os/core/contracts";

/** The marker path inside one checkout's git common directory. */
export const projectIdentityMarkerPath = (gitCommonDirectory: string): string =>
  join(gitCommonDirectory, PROJECT_IDENTITY_MARKER_NAME);

/**
 * Read the raw marker content: `absent` when the path does not exist, `present`
 * when the bytes were read, and `unreadable` for any other failure (a
 * permission refusal, a non-regular path, a directory).
 */
export const readProjectIdentityMarker = (
  gitCommonDirectory: string | undefined,
): ProjectIdentityMarkerRead => {
  if (gitCommonDirectory === undefined) return { state: "absent" };
  try {
    return {
      state: "present",
      text: readFileSync(projectIdentityMarkerPath(gitCommonDirectory), "utf8"),
    };
  } catch (error) {
    return (error as { readonly code?: unknown }).code === "ENOENT"
      ? { state: "absent" }
      : { state: "unreadable" };
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
 * Get-or-create the marker for one checkout.
 *
 * Creation is an exclusive link of a fully written sibling file, so two racing
 * writers can never both win and no reader ever observes a partially written
 * marker. A later call returns the existing content and never rewrites it. The
 * result is the persisted text the invariant validates, or `undefined` when no
 * usable marker exists or could be created (the caller maps that to the
 * state-location failure class, never to a path-derived key).
 */
export const ensureProjectIdentityMarkerText = (
  gitCommonDirectory: string | undefined,
  content: string,
): string | undefined => {
  if (gitCommonDirectory === undefined) return undefined;
  const existing = readProjectIdentityMarker(gitCommonDirectory);
  if (existing.state === "present") return existing.text;
  if (existing.state === "unreadable") return undefined;
  const target = projectIdentityMarkerPath(gitCommonDirectory);
  const temporary = writeMarkerTemporary(target, content);
  if (temporary === undefined) return undefined;
  try {
    linkSync(temporary, target);
  } catch {
    // A concurrent writer landed the marker first (or the filesystem refuses a
    // hard link); the marker that exists, if any, governs.
  } finally {
    rmSync(temporary, { force: true });
  }
  const landed = readProjectIdentityMarker(gitCommonDirectory);
  return landed.state === "present" ? landed.text : undefined;
};
