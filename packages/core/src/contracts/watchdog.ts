/**
 * `delivery.watchdog.v1` — the watchdog probe contract (GH-221 DM-1..DM-4).
 *
 * Runtime-neutral by construction: types and `as const` data only. No I/O,
 * clock, randomness, or environment access; the probes, their evaluation, and
 * the rendering live in the domain and surface tiers.
 */

/** The only home of the watchdog probe schema identifier. */
export const WATCHDOG_SCHEMA_VERSION = "delivery.watchdog.v1" as const;

export type WatchdogSchemaVersion = typeof WATCHDOG_SCHEMA_VERSION;

/**
 * The verdict vocabulary (DM-1). One declaration drives both the runtime list
 * and the `WatchdogVerdict` union so the two cannot drift. `stalled` and
 * `progressing` are declared contract values whose signal-backed reachability
 * arrives with M1-S15; M1-S1 never emits them.
 */
export const WATCHDOG_VERDICTS = ["ok", "refused", "stalled", "progressing"] as const;

export type WatchdogVerdict = (typeof WATCHDOG_VERDICTS)[number];

/**
 * The declared progress-signal keys (DM-2). CPU is deliberately absent: a
 * CPU-only reading can never satisfy the declared shape, so it can never
 * classify a verdict.
 */
export const WATCHDOG_SIGNAL_KEYS = ["heartbeatAgeMs", "tokenDelta", "traffic"] as const;

export type WatchdogSignalKey = (typeof WATCHDOG_SIGNAL_KEYS)[number];

/** The progress signals a probe may observe; an absent field is unknown. */
export type WatchdogSignals = {
  readonly heartbeatAgeMs?: number;
  readonly tokenDelta?: number;
  readonly traffic?: number;
};

/**
 * A heartbeat age at or beyond this bound is a stall candidate only when the
 * declared progress signals corroborate it (DEC-3).
 */
export const WATCHDOG_STALL_HEARTBEAT_MS = 300_000 as const;

/** The three check subcommands (F-6): checks, never runner verbs. */
export const WATCHDOG_PROBES = ["preflight", "teardown", "liveness"] as const;

export type WatchdogProbe = (typeof WATCHDOG_PROBES)[number];

/** The error identities the `watchdog` domain kind declares (DM-5). */
export const WATCHDOG_ERROR_CODES = [
  "watchdog.checkout-dirty",
  "watchdog.checkout-non-base",
  "watchdog.signals-absent",
] as const;

export type WatchdogErrorCode = (typeof WATCHDOG_ERROR_CODES)[number];

/** A lane and the declared facts the probes compare against (PIN-5). */
export type WatchdogLaneRecord = {
  readonly lane: string;
  readonly baseRef: string;
  readonly workspacePaths: readonly string[];
};

/** One lane-record read: the record, or the classified absence/torn reason. */
export type WatchdogLaneRead =
  | { readonly ok: true; readonly record: WatchdogLaneRecord }
  | { readonly ok: false; readonly reason: "missing" | "malformed" | "torn" };

/** Expected-vs-actual evidence (DM-3). */
export type WatchdogExpectedActual = {
  readonly expected: string;
  readonly actual: string;
};

/** One working-tree entry observed by `git status --porcelain`. */
export type WatchdogWorktreeEntry = {
  readonly path: string;
  readonly change: "modified" | "untracked" | "staged";
};

/** One agent-memory publication candidate (DM-4). */
export type WatchdogMemoryFact = {
  readonly path: string;
  readonly state: "committed" | "modified" | "untracked" | "staged";
  readonly commit?: string;
};

/** The checkout facts the git seam returns; unreadable facts fail closed. */
export type WatchdogGitFacts =
  | {
      readonly kind: "facts";
      readonly baseResolves: boolean;
      readonly branch?: string;
      readonly detached: boolean;
      readonly head: string;
      readonly clean: boolean;
      readonly entries: readonly WatchdogWorktreeEntry[];
      readonly memory: readonly WatchdogMemoryFact[];
      readonly strandedCommit?: string;
      readonly branchHead?: string;
    }
  | { readonly kind: "unreadable"; readonly detail: string };

/** A local mutation outcome; failures are data, never a throw across the port. */
export type WatchdogGitMutationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly detail: string };

/** The bounded git seam contract the command composes (PIN-3, PIN-4). */
export type WatchdogGitPort = {
  readonly readCheckoutFacts: (input: {
    readonly baseRef: string;
    readonly workspacePaths: readonly string[];
  }) => Promise<WatchdogGitFacts>;
  readonly restoreCheckout: (input: {
    readonly baseRef: string;
  }) => Promise<WatchdogGitMutationResult>;
  readonly removePath: (input: { readonly path: string }) => Promise<WatchdogGitMutationResult>;
  readonly preserveCommit: (input: {
    readonly ref: string;
    readonly commit: string;
  }) => Promise<WatchdogGitMutationResult>;
};

/** A declared signal source; production M1-S1 wires none (PIN-6). */
export type WatchdogSignalSource = (lane: string) => WatchdogSignals | undefined;

/** One restoration action in report order (DM-4). */
export const WATCHDOG_RESTORATION_ACTION_KINDS = [
  "preserve-commit",
  "restore-checkout",
  "checkout-unchanged",
  "remove-residue",
  "preserve-content",
] as const;

export type WatchdogRestorationActionKind = (typeof WATCHDOG_RESTORATION_ACTION_KINDS)[number];

/** One restoration-report action: kind, observation, and non-empty evidence. */
export type WatchdogRestorationAction = {
  readonly kind: WatchdogRestorationActionKind;
  readonly observation: string;
  readonly evidence: string;
};

/** The memory-publication status vocabulary (DM-4). */
export const WATCHDOG_MEMORY_STATUSES = ["committed", "preserved"] as const;

export type WatchdogMemoryStatus = (typeof WATCHDOG_MEMORY_STATUSES)[number];

/** One memory publication named by the restoration report. */
export type WatchdogMemoryPublication = {
  readonly path: string;
  readonly status: WatchdogMemoryStatus;
  readonly evidence: string;
};

/**
 * Verdict-bearing probe data: `data` carries `verdict`, `signals`, and
 * `evidence` (AC-F4-2, DM-3).
 */
export type WatchdogVerdictData = {
  readonly schemaVersion: WatchdogSchemaVersion;
  readonly probe: WatchdogProbe;
  readonly lane: string;
  readonly verdict: WatchdogVerdict;
  readonly signals: WatchdogSignals;
  readonly evidence: string;
};

export type WatchdogPreflightData = WatchdogVerdictData;

export type WatchdogLivenessData = WatchdogVerdictData;

/** Teardown `data`: the verdict data plus the restoration report (DM-4). */
export type WatchdogTeardownData = WatchdogVerdictData & {
  readonly actions: readonly WatchdogRestorationAction[];
  readonly memory: readonly WatchdogMemoryPublication[];
};
