/**
 * The state driver's runtime edge — types only.
 *
 * Every runtime API (filesystem, permissions, SQLite binding, clock) enters the
 * state tier through one injected `StateRuntimeEdge`. Production constructs the
 * real edge in `./driver/runtime-edge`; tests construct fault-injectable fakes.
 * Nothing here reads an ambient environment, clock, or randomness source.
 */
import type { StateVerificationClass } from "#contracts";

/** Named, deterministic injection points (test-plan §4.3; delivery may add). */
export type StateEdgeFaultPoint =
  | "append-before-flush"
  | "append-after-flush"
  | "replace-before-temp"
  | "replace-after-temp-write"
  | "replace-rename"
  | "replace-after-rename"
  | "fence-after-acquire"
  | "fence-after-recovery"
  | "index-rebuild-write";

/** The platform family the edge enforces permissions for (spec OQ-2). */
export type StatePlatform = "posix" | "win32";

/** Which permission contract applies to a path. */
export type StatePathKind = "directory" | "file";

/** One derived-index row: the ledger-derived projection, never truth. */
export type StateIndexRow = {
  readonly sequence: number;
  readonly key: string;
  readonly kind: string;
  readonly checksum: string;
  readonly payload: string;
};

/** The integrity classes a read performs; exported for evidence assembly. */
export type StateVerificationSet = readonly StateVerificationClass[];

/**
 * The runtime edge. Every method is synchronous so a read or write is one
 * uninterrupted in-process observation (no timing, no interleaving windows).
 */
export interface StateRuntimeEdge {
  readonly platform: StatePlatform;
  /** Injected clock; fence staleness never reads a wall clock in core. */
  now(): number;
  exists(path: string): boolean;
  readText(path: string): string;
  writeFile(path: string, text: string): void;
  appendFile(path: string, text: string): void;
  /** Exclusive create (`wx`); returns false when the path already exists. */
  createExclusiveFile(path: string, text: string): boolean;
  removeFile(path: string): void;
  truncateFile(path: string, length: number): void;
  /** Ensures the directory exists with the creation permission matrix. */
  ensureDirectory(path: string): void;
  listDirectory(path: string): readonly string[];
  /** Applies the creation permission contract for the platform family. */
  applyPermissions(path: string, kind: StatePathKind): void;
  /** Verifies the permission contract; false means fail closed. */
  verifyPermissions(path: string, kind: StatePathKind): boolean;
  /** Writes and flushes a same-directory temporary; the caller renames it. */
  writeTemporaryFile(path: string, content: string): void;
  /** Atomic rename over an existing target (same directory). */
  renameFile(from: string, to: string): void;
  /** Raises an armed test fault (production: no-op). */
  raiseFault(point: StateEdgeFaultPoint): void;
  /** Whether the runtime provides a built-in SQLite binding (TDR-0004). */
  indexAvailable(): boolean;
  /** Returns derived rows, or undefined when the index is missing/unreadable. */
  indexRead(path: string): readonly StateIndexRow[] | undefined;
  indexWrite(path: string, rows: readonly StateIndexRow[]): void;
  indexRemove(path: string): void;
}
