/**
 * The `loop` supervision-profile vocabulary (GH-348 F-1..F-8, DM-1..DM-9).
 *
 * Runtime-neutral and I/O-free: closed vocabularies, the two additive record
 * payload types, the declared output/retention bounds, the declared backoff
 * policy data, and the two read-only projection types. The loop is a
 * COMPOSITION PROFILE over the delivered supervision engine under the distinct
 * supervisor identity `loop-main` (TDR-0055); the coordinator family is not
 * extended and no coordinator declaration moves.
 *
 * Two additive record kinds only: `loop.session` (DM-1) and `loop.stop`
 * (DM-2). No error identity, domain kind, configuration key, or delivered
 * schema version is added (NFR-7, NG-9).
 */
import type { CoordinatorProgressState, CoordinatorVerdict } from "./coordinator.js";

/* ------------------------------- identity -------------------------------- */

/** The single declared supervisor identity of the loop profile (DM-1, DEC-1). */
export const LOOP_V1_SUPERVISOR_IDENTITY = "loop-main" as const;

export type LoopSupervisorIdentity = typeof LOOP_V1_SUPERVISOR_IDENTITY;

/* ------------------------------ vocabulary ------------------------------- */

/** The five declared verbs, in grammar order (F-1, API-1..API-5). */
export const LOOP_VERBS = ["start", "stop", "status", "log", "reset"] as const;
export type LoopVerb = (typeof LOOP_VERBS)[number];

/** The two declared stop modes; `drain` is the parity default (F-4, API-2). */
export const LOOP_STOP_MODES = ["drain", "immediate"] as const;
export type LoopStopMode = (typeof LOOP_STOP_MODES)[number];

/** The two declared durable-stop transitions (DM-2, TDR-0056). */
export const LOOP_STOP_ACTIONS = ["requested", "cleared"] as const;
export type LoopStopAction = (typeof LOOP_STOP_ACTIONS)[number];

/** The two declared session states (DM-1). */
export const LOOP_SESSION_STATES = ["active", "ended"] as const;
export type LoopSessionState = (typeof LOOP_SESSION_STATES)[number];

/** The eleven-name closed operational-log event vocabulary (F-7, DM-7). */
export const LOOP_LOG_EVENTS = [
  "start",
  "cycle",
  "session",
  "stuck-verdict",
  "kill",
  "restart",
  "backoff",
  "stop",
  "budget-exhausted",
  "release",
  "error",
] as const;
export type LoopLogEvent = (typeof LOOP_LOG_EVENTS)[number];

/** The closed five-value degradation vocabulary (API-4, DM-4). */
export const LOOP_DEGRADATIONS = [
  "session-pid-unknown",
  "progress-unreadable",
  "delivery-corroborator-unreadable",
  "live-facts-unknown",
  "log-unavailable",
] as const;
export type LoopDegradation = (typeof LOOP_DEGRADATIONS)[number];

/** The three declared projection states of the instance (API-4). */
export const LOOP_INSTANCE_STATES = ["running", "stopped", "unknown"] as const;
export type LoopInstanceState = (typeof LOOP_INSTANCE_STATES)[number];

/** The declared delivery-corroborator readings (F-5, DM-6). */
export const LOOP_DELIVERY_READINGS = ["in-progress", "none", "unknown"] as const;
export type LoopDeliveryReading = (typeof LOOP_DELIVERY_READINGS)[number];

/**
 * The status keys in the DECLARED order (API-7): the six shell names first, so
 * an existing `key=value` consumer keeps working, then `stop_mode` and the
 * additive tail.
 */
export const LOOP_STATUS_KEYS = [
  "loop_running",
  "loop_pid",
  "ceo_alive",
  "ceo_pid",
  "ceo_session",
  "stop_signal",
  "stop_mode",
  "loop_id",
  "ceo_title",
  "restarts",
  "budget_epoch",
  "last_restart_reason",
  "last_verdict",
  "degraded",
] as const;
export type LoopStatusKey = (typeof LOOP_STATUS_KEYS)[number];

/** Exactly three status keys are boolean and render `yes`/`no` (API-7). */
export const LOOP_BOOLEAN_STATUS_KEYS = ["loop_running", "ceo_alive", "stop_signal"] as const;
export type LoopBooleanStatusKey = (typeof LOOP_BOOLEAN_STATUS_KEYS)[number];

/** The six shell keys preserved verbatim, in the shell's order (API-7, §8.5). */
export const LOOP_SHELL_STATUS_KEYS = [
  "loop_running",
  "loop_pid",
  "ceo_alive",
  "ceo_pid",
  "ceo_session",
  "stop_signal",
] as const;

/* -------------------------------- records -------------------------------- */

/** The `loop.session` record kind, key prefix, and payload schema (DM-1). */
export const LOOP_SESSION_RECORD_KIND = "loop.session" as const;
export const LOOP_SESSION_KEY_PREFIX = "loop.sessions:" as const;
export const LOOP_SESSION_PAYLOAD_SCHEMA = "delivery.loop.session.v1" as const;

/** The loop's durable session identity and process identity (DM-1). */
export type LoopSessionRecord = {
  readonly schemaId: typeof LOOP_SESSION_PAYLOAD_SCHEMA;
  readonly sessionRecordId: string;
  readonly loopId: string;
  readonly sessionId: string;
  readonly harnessKind: string;
  /** The spawned session's process id, or `null` when the adapter supplies none. */
  readonly pid: number | null;
  /** The platform process start time read at acquisition, or `null`. */
  readonly processStartTimeMs: number | null;
  /** The fresh-spawn title, or `null` on a resume or an absent fact. */
  readonly title: string | null;
  readonly state: LoopSessionState;
  /**
   * The progress state the supervisor last OBSERVED for this session (DM-1's
   * declared fields are unchanged; this additive OPTIONAL member is the
   * implementation-decided identifier §25.4 Appendix D leaves open). ABSENT
   * before the first reading and never fabricated; a later record is appended
   * only when the state changes, never per cycle.
   */
  readonly progressState?: CoordinatorProgressState;
  readonly acquiredAt: string;
  readonly recordedAt: string;
};

/** The `loop.stop` record kind, key prefix, and payload schema (DM-2). */
export const LOOP_STOP_RECORD_KIND = "loop.stop" as const;
export const LOOP_STOP_KEY_PREFIX = "loop.stops:" as const;
export const LOOP_STOP_PAYLOAD_SCHEMA = "delivery.loop.stop.v1" as const;

/**
 * The durable, identity-scoped stop (DM-2, TDR-0056). No pid, holder, or
 * instance field participates: the stop names the loop identity, which is what
 * makes it survive a restart, a crash, and a fresh process.
 */
export type LoopStopRecord = {
  readonly schemaId: typeof LOOP_STOP_PAYLOAD_SCHEMA;
  readonly stopId: string;
  readonly loopId: string;
  readonly action: LoopStopAction;
  readonly mode: LoopStopMode | null;
  readonly recordedAt: string;
};

/* ------------------------------ projections ------------------------------ */

/** The read-only `delivery.loop.v1` observation (API-4, DM-4). */
export const LOOP_OBSERVATION_SCHEMA = "delivery.loop.v1" as const;

export type LoopStatusProjection = {
  readonly schemaVersion: typeof LOOP_OBSERVATION_SCHEMA;
  readonly loopId: string;
  readonly state: LoopInstanceState;
  readonly instance: {
    readonly instanceId: string;
    readonly pid: number | null;
  } | null;
  readonly session: {
    readonly sessionId: string | null;
    readonly alive: boolean;
    readonly pid: number | null;
    readonly title: string | null;
    readonly progress: CoordinatorProgressState | null;
  };
  readonly restarts: {
    readonly count: number;
    readonly bound: number;
    readonly budgetEpochId: string | null;
    readonly lastReason: string | null;
  };
  readonly stop: {
    readonly requested: boolean;
    readonly mode: LoopStopMode | null;
    readonly recordedAt: string | null;
  };
  readonly verdict: {
    readonly verdict: CoordinatorVerdict;
    readonly reason: string | null;
    readonly evidence: string | null;
  } | null;
  readonly degraded: readonly LoopDegradation[];
};

/** The read-only `delivery.loop.log.v1` projection (API-5, DM-4). */
export const LOOP_LOG_OBSERVATION_SCHEMA = "delivery.loop.log.v1" as const;

export type LoopLogProjection = {
  readonly schemaVersion: typeof LOOP_LOG_OBSERVATION_SCHEMA;
  readonly loopId: string;
  readonly requestedLines: number;
  readonly returnedLines: number;
  readonly totalBytes: number;
  readonly truncated: boolean;
  readonly unreadable: boolean;
  readonly lines: readonly string[];
};

/* --------------------------------- bounds -------------------------------- */

/** One log line is at most 512 UTF-8 bytes (NFR-3, DM-7). */
export const LOOP_MAX_LOG_LINE_BYTES = 512 as const;
/** The active log file is at most 1 MiB (NFR-3, DM-7). */
export const LOOP_MAX_LOG_ACTIVE_BYTES = 1_048_576 as const;
/** Exactly one retained rotated generation (NFR-3, DM-7). */
export const LOOP_LOG_RETAINED_GENERATIONS = 1 as const;
/** The total log footprint is at most 2 MiB per identity (NFR-3, DM-7). */
export const LOOP_MAX_LOG_TOTAL_BYTES = 2_097_152 as const;
/** The `log` read default and maximum line counts (API-5, DM-7). */
export const LOOP_LOG_DEFAULT_LINES = 50 as const;
export const LOOP_LOG_MAX_LINES = 100 as const;
/** The human line bound for `start`/`stop`/`status`/`reset` (API-7, NFR-2). */
export const LOOP_MAX_HUMAN_LINES = 32 as const;
/** The machine `data` byte bound for every verb (API-7, NFR-2). */
export const LOOP_MAX_DATA_BYTES = 65_536 as const;

/** The declared backoff policy data (DM-5, DEC-4). */
export const LOOP_BACKOFF_BASE_MS = 2_000 as const;
export const LOOP_BACKOFF_CAP_MS = 300_000 as const;
export const LOOP_BACKOFF_MAX_ORDINAL = 10 as const;

/** The declared durable reason the loop records on a restart (DM-5, F-3). */
export const LOOP_RESTART_REASON = "stuck-artifact-evidence" as const;

/** The declared persisted reason for an unevaluable verdict (DM-6). */
export const LOOP_UNEVALUABLE_REASON = "evidence-unevaluable" as const;

/** The log path relative to the project state directory (F-7, AC-F7-4). */
export const loopLogRelativePath = (loopId: string): string => `loop/${loopId}.log`;
