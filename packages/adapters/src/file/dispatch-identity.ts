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
 * normalization and resolution order are the pure domain policy. The marker is
 * written exclusively on first use and is never overwritten, so the persisted
 * binding survives a remote change and a process restart.
 */
import { readFileSync, writeFileSync } from "node:fs";
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

/**
 * Get-or-create the marker for one checkout. Creation is exclusive and happens
 * only when no marker exists; a later call returns the existing content and
 * never rewrites it, so a rename or remote change cannot re-key the binding.
 */
export const ensureDispatchIdentityMarkerText = (
  gitCommonDirectory: string | undefined,
  content: string,
): string | undefined => {
  if (gitCommonDirectory === undefined) return undefined;
  const path = dispatchIdentityMarkerPath(gitCommonDirectory);
  try {
    writeFileSync(path, content, { flag: "wx" });
    return content;
  } catch {
    return readDispatchIdentityMarkerText(gitCommonDirectory);
  }
};
