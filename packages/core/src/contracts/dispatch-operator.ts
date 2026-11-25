/**
 * The typed dispatch operator surface (GH-354 F-1..F-7, API-1..API-12,
 * DM-1..DM-7; TDR-0058).
 *
 * Four read queries over the delivered durable lane record plus the two new
 * read sources: the per-ref, per-stream harness-stdout artifact family and the
 * capability-gated transcript read. Types, closed vocabularies, and declared
 * bounds only — the queries themselves are pure functions in the app and
 * domain tiers, and every I/O edge is injected.
 */
import type { DispatchLaneOwner, DispatchLaneState, DispatchToken } from "./dispatch.js";
import type { HarnessKind, HarnessOutcome } from "./harness.js";

/* ------------------------------------------------------------------------- */
/* The query family.                                                         */
/* ------------------------------------------------------------------------- */

/** The four query discriminators, each a single `data.query` value (DM-5). */
export const DISPATCH_OPERATOR_QUERIES = [
  "status",
  "log",
  "is-delivering",
  "last-message",
] as const;

export type DispatchOperatorQuery = (typeof DISPATCH_OPERATOR_QUERIES)[number];

/** The operator-visible marker names derived from the lane state (DM-1). */
export const DISPATCH_OPERATOR_MARKERS = ["active", "terminal", "absent"] as const;

export type DispatchOperatorMarker = (typeof DISPATCH_OPERATOR_MARKERS)[number];

/** The closed advisory owner-probe verdicts (API-10, DM-4). */
export const DISPATCH_PROBE_VERDICTS = ["live", "dead", "unknown"] as const;

export type DispatchProbeVerdict = (typeof DISPATCH_PROBE_VERDICTS)[number];

/** The reported probe value: a verdict plus the absent-ref `not-applicable`. */
export const DISPATCH_OPERATOR_PROBE_VALUES = [
  ...DISPATCH_PROBE_VERDICTS,
  "not-applicable",
] as const;

export type DispatchOperatorProbe = (typeof DISPATCH_OPERATOR_PROBE_VALUES)[number];

/** The declared start-instant tolerance (the shell's own PID-reuse guard). */
export const DISPATCH_PROBE_TOLERANCE_MS = 5000 as const;

/** The declared bound on one ref-less `is-delivering` answer's ref list. */
export const DISPATCH_MAX_DELIVERING_REFS = 20 as const;

/* ------------------------------------------------------------------------- */
/* The declared bounds (DM-6, TDR-0058 C-1).                                 */
/* ------------------------------------------------------------------------- */

/** The tail default and the accepted canonical-decimal range. */
export const DISPATCH_LOG_TAIL_DEFAULT = 50 as const;
export const DISPATCH_LOG_TAIL_MIN = 1 as const;
export const DISPATCH_LOG_TAIL_MAX = 500 as const;
/** The canonical decimal form: no sign, no whitespace, no leading zero. */
export const DISPATCH_LOG_TAIL_PATTERN = "[1-9][0-9]*" as const;

/** The log output's own human bounds (never the attempts constants). */
export const DISPATCH_LOG_MAX_HUMAN_LINES = 200 as const;
export const DISPATCH_LOG_MAX_HUMAN_BYTES = 32768 as const;

/** The artifact family: one directory per ref, one file per stream segment. */
export const DISPATCH_LOG_DIRECTORY_PREFIX = "dispatch-logs" as const;
export const DISPATCH_LOG_FILE_CAP_BYTES = 1048576 as const;
export const DISPATCH_LOG_RETAINED_FILES = 2 as const;
export const DISPATCH_LOG_FAMILY_BYTES = DISPATCH_LOG_FILE_CAP_BYTES * DISPATCH_LOG_RETAINED_FILES;
/** The closed stream kinds a streaming adapter opens (API-8). */
export const DISPATCH_LOG_STREAM_KINDS = ["spawn", "resume", "deliver"] as const;
export type DispatchLogStreamKind = (typeof DISPATCH_LOG_STREAM_KINDS)[number];

/**
 * The declared stream ordinal of each stream kind.
 *
 * It is a property of the kind (not a shared counter), so two streams of one
 * attempt and iteration at one recorded instant cannot collide on one name and
 * lexical order still equals creation order.
 */
export const DISPATCH_LOG_STREAM_ORDINALS: Readonly<Record<DispatchLogStreamKind, number>> = {
  spawn: 1,
  resume: 2,
  deliver: 3,
};

/** Zero-padded width of the segment ordinal in a file name. */
export const DISPATCH_LOG_SEGMENT_WIDTH = 4 as const;
/** Zero-padded width of the per-stream ordinal in a file name. */
export const DISPATCH_LOG_STREAM_WIDTH = 2 as const;

/** The closed `log` absence reasons (DEC-5, DM-7). */
export const DISPATCH_LOG_REASONS = ["no-log", "unreadable"] as const;
export type DispatchLogReason = (typeof DISPATCH_LOG_REASONS)[number];

/** The closed `last-message` absence ladder, in its declared order (DEC-4). */
export const DISPATCH_MESSAGE_REASONS = [
  "no-lane",
  "capability-gap",
  "session-unknown",
  "no-message",
  "unreadable",
] as const;
export type DispatchMessageReason = (typeof DISPATCH_MESSAGE_REASONS)[number];

/** The transcript read's own storage bound (never the 512-character message bound). */
export const DISPATCH_TRANSCRIPT_READ_CAP_CHARS = 262144 as const;

/* ------------------------------------------------------------------------- */
/* The payloads (DM-5, API-1..API-4).                                        */
/* ------------------------------------------------------------------------- */

/** One truncation fact: exactly one per binding bound (API-2, NFR-3). */
export type DispatchOperatorTruncation = {
  readonly scope: "tail" | "bytes";
  readonly bound: number;
  readonly omittedLines: number;
};

/** One truncation fact over the bounded `is-delivering` ref list. */
export type DispatchOperatorRefsTruncation = {
  readonly bound: number;
  readonly omitted: number;
};

/** The lane facts a `status` answer carries; a projection, never a new record. */
export type DispatchOperatorLaneFacts = {
  readonly attemptId: string;
  readonly harness: HarnessKind;
  readonly iterationOrdinal: number;
  readonly restartsConsumed: number;
  readonly ownerStartedAt: string;
  readonly lastToken?: DispatchToken;
  readonly lastOutcome?: HarnessOutcome;
  readonly recordedAt: string;
};

/** `dispatch status <ref>` (API-1). */
export type DispatchStatusData = {
  readonly query: "status";
  readonly ref: string;
  readonly repository: string;
  readonly delivering: boolean;
  readonly stale: boolean;
  readonly marker: DispatchOperatorMarker;
  readonly probe: DispatchOperatorProbe;
  readonly pid: number | null;
  readonly sessionId: string | null;
  readonly lane: DispatchOperatorLaneFacts | null;
  /**
   * The lane's worktree path (GH-404 F-7, DM-1), carried additively from the
   * lane record's own field. Absent renders exactly as today — the
   * classified absence for pre-change records and disable-worktrees lanes
   * (DEC-8); no member is minted for a context-less lane.
   */
  readonly worktreePath?: string;
};

/** `dispatch log <ref> [--tail <n>]` (API-2). */
export type DispatchLogData = {
  readonly query: "log";
  readonly ref: string;
  readonly available: boolean;
  readonly reason?: DispatchLogReason;
  readonly tail: number;
  readonly lines: readonly string[];
  readonly truncation?: DispatchOperatorTruncation;
};

/** `dispatch is-delivering [<ref>]` (API-3). */
export type DispatchDeliveringData = {
  readonly query: "is-delivering";
  readonly delivering: boolean;
  readonly repository: string;
  readonly ref: string | null;
  readonly refs?: readonly string[];
  readonly truncation?: DispatchOperatorRefsTruncation;
};

/** `dispatch last-message <ref>` (API-4). */
export type DispatchLastMessageData = {
  readonly query: "last-message";
  readonly ref: string;
  readonly available: boolean;
  readonly final: boolean;
  readonly reason?: DispatchMessageReason;
  readonly message: string | null;
  readonly truncated: boolean;
  readonly recordedAt: string | null;
};

/** Any operator answer payload; the `query` member is the only discriminator. */
export type DispatchOperatorData =
  | DispatchStatusData
  | DispatchLogData
  | DispatchDeliveringData
  | DispatchLastMessageData;

/* ------------------------------------------------------------------------- */
/* The injected read seams (API-8, API-9, API-10).                            */
/* ------------------------------------------------------------------------- */

/** The advisory owner-liveness probe: one verdict per recorded owner (API-10). */
export type DispatchOwnerProbe = (owner: DispatchLaneOwner) => DispatchProbeVerdict;

/** The lane state a marker is derived from; `undefined` is `absent`. */
export type DispatchMarkerState = DispatchLaneState | undefined;

/** One artifact-family file-system entry name and its byte size. */
export type DispatchLogFileEntry = {
  readonly name: string;
  readonly sizeBytes: number;
};

/**
 * The injected artifact-family filesystem edge (DM-2, §6.2).
 *
 * Every call takes an absolute path; the edge records it and refuses a path
 * outside the addressed ref's directory. The writer half refuses to modify a
 * written byte (create only, append only, remove only for retention); the read
 * half is bounded by the caller.
 */
export type DispatchLogFileSystem = {
  /** Ensure the directory exists (recursively); `false` on failure. */
  readonly ensureDirectory: (directory: string) => boolean;
  /** Create one file `0600`; `false` when it already exists or fails. */
  readonly create: (path: string) => boolean;
  /** Append text to an existing file (one `O_APPEND` write); `false` on failure. */
  readonly append: (path: string, text: string) => boolean;
  /** Remove one file (retention only); `false` on failure. */
  readonly remove: (path: string) => boolean;
  /** The current byte size, or `undefined` when it cannot be read. */
  readonly size: (path: string) => number | undefined;
  /** The file mode, or `undefined` when it cannot be read. */
  readonly mode: (path: string) => number | undefined;
  /** The names inside one directory, or `undefined` when it cannot be listed. */
  readonly list: (directory: string) => readonly DispatchLogFileEntry[] | undefined;
  /** Whether a path exists (the `no-log` / `unreadable` distinction). */
  readonly exists: (path: string) => boolean;
  /** The file's text, or `undefined` when it cannot be read. */
  readonly read: (path: string) => string | undefined;
};
