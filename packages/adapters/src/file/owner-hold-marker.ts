/**
 * The bounded owner-hold marker reader (GH-280 F-1, DM-9, NFR-1, D12).
 *
 * Reads exactly `<storeDirectory>/owner-hold` over injected filesystem facts:
 * at most one existence check, one regular-file check, and one bounded read of
 * at most 4 096 bytes. The path is fixed by the caller's production store
 * directory; no caller-supplied marker path or store relocation is offered.
 * Every unreadable, non-regular, or stat-failing outcome is fail-closed: the
 * marker exists, so the hold is active with no reason. Only a non-existent path
 * is absent.
 */
import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs";
import {
  OWNER_HOLD_MARKER_NAME,
  OWNER_HOLD_MAX_MARKER_BYTES,
  type OwnerHoldMarkerOutcome,
} from "@delivery-os/core/contracts";

/** Injected filesystem facts; tests supply deterministic doubles. */
export type OwnerHoldMarkerFileSystem = {
  readonly exists: (path: string) => boolean;
  /** A regular-file check; may throw, which resolves fail-closed. */
  readonly isFile: (path: string) => boolean;
  /** One bounded read; may throw, which resolves fail-closed. */
  readonly readText: (path: string, maxBytes: number) => string;
};

/** The reader input: the production store directory, or its absence. */
export type OwnerHoldMarkerReadInput = {
  readonly storeDirectory?: string | undefined;
};

const trimTrailingSeparators = (path: string): string => path.replace(/[\\/]+$/u, "");

/** The fixed marker path; `undefined` when no production store directory exists. */
export const ownerHoldMarkerPath = (storeDirectory: string | undefined): string | undefined => {
  if (storeDirectory === undefined || storeDirectory.length === 0) return undefined;
  return `${trimTrailingSeparators(storeDirectory)}/${OWNER_HOLD_MARKER_NAME}`;
};

/** Read the fixed marker through the injected filesystem facts. */
export const readOwnerHoldMarker = (
  input: OwnerHoldMarkerReadInput,
  fs: OwnerHoldMarkerFileSystem,
): OwnerHoldMarkerOutcome => {
  const path = ownerHoldMarkerPath(input.storeDirectory);
  if (path === undefined) return { state: "absent" };
  if (!fs.exists(path)) return { state: "absent" };
  try {
    if (!fs.isFile(path)) return { state: "unreadable" };
  } catch {
    return { state: "unreadable" };
  }
  try {
    return { state: "present", content: fs.readText(path, OWNER_HOLD_MAX_MARKER_BYTES) };
  } catch {
    return { state: "unreadable" };
  }
};

/** The production filesystem facts: zero network, zero credential, zero writes. */
export const nodeOwnerHoldMarkerFileSystem = (): OwnerHoldMarkerFileSystem => ({
  exists: (path) => existsSync(path),
  isFile: (path) => statSync(path).isFile(),
  readText: (path, maxBytes) => {
    const handle = openSync(path, "r");
    try {
      const buffer = Buffer.alloc(maxBytes);
      const read = readSync(handle, buffer, 0, maxBytes, 0);
      return buffer.subarray(0, read).toString("utf8");
    } finally {
      closeSync(handle);
    }
  },
});
