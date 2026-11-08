/**
 * The resident-daemon vocabulary (GH-238 F-1..F-17; DM-1..DM-17; Appendix D/J).
 *
 * Runtime-neutral: types and `as const` data only. Every closed set, record
 * kind, payload schema, store key, bound, status projection, command-envelope
 * shape, and daemon-owned port is declared once here. No clock, randomness,
 * environment, filesystem, network, or call expression exists in this module.
 */
import type { EconomicsExhaustionRecord, EconomicsRestartRecord } from "./economics.js";
import type { StateJsonValue } from "./state.js";
import type { CallerPrincipal } from "./principal.js";

/* ------------------------------- scope ----------------------------------- */

/** The state-directory scope digest is the first 16 lowercase hex characters. */
export const DAEMON_SCOPE_DIGEST_LENGTH = 16 as const;

/* ------------------------------- bounds ---------------------------------- */

/** Appendix J bounds. */
export const DAEMON_MAX_FRAME_BYTES = 65_536 as const;
export const DAEMON_DEFAULT_SUBSCRIPTION_BUFFER = 256 as const;
export const DAEMON_MAX_STATUS_LANES = 200 as const;
export const DAEMON_MAX_STATUS_BYTES = 65_536 as const;
export const DAEMON_MAX_HUMAN_LINES = 40 as const;
export const DAEMON_MAX_HUMAN_BYTES = 8_192 as const;
export const DAEMON_MAX_EVIDENCE_BYTES = 512 as const;
export const DAEMON_DEFAULT_RESPONSE_TIMEOUT_MS = 2_000 as const;
export const DAEMON_DEFAULT_POLL_INTERVAL_MS = 60_000 as const;
export const DAEMON_DEFAULT_WATCH_POLL_INTERVAL_MS = 5_000 as const;
export const DAEMON_DEFAULT_HEARTBEAT_INTERVAL_MS = 5_000 as const;
export const DAEMON_DEFAULT_HEARTBEAT_CYCLE_MS = 60_000 as const;
export const DAEMON_DEFAULT_LOCK_STALENESS_MS = 30_000 as const;
export const DAEMON_DEFAULT_RECONCILE_MAX_LANES = 200 as const;
export const DAEMON_DEFAULT_COMMIT_LOG_CAP = 32 as const;

/* ------------------------------- records --------------------------------- */

/** The seven additive record kinds (Appendix D verbatim). */
export const DAEMON_INSTANCE_RECORD_KIND = "daemon.instance" as const;
export const DAEMON_HEARTBEAT_RECORD_KIND = "daemon.heartbeat" as const;
export const DAEMON_LANE_RECORD_KIND = "daemon.lane" as const;
export const DAEMON_RECONCILIATION_RECORD_KIND = "daemon.reconciliation" as const;
export const DAEMON_PREEMPTION_RECORD_KIND = "daemon.preemption" as const;
export const COMMAND_RECEIPT_RECORD_KIND = "command.receipt" as const;
export const OUTBOX_EFFECT_RECORD_KIND = "outbox.effect" as const;

/** The payload schema identifiers (Appendix D verbatim). */
export const DAEMON_INSTANCE_PAYLOAD_SCHEMA = "delivery.daemon.instance.v1" as const;
export const DAEMON_HEARTBEAT_PAYLOAD_SCHEMA = "delivery.daemon.heartbeat.v1" as const;
export const DAEMON_LANE_PAYLOAD_SCHEMA = "delivery.daemon.lane.v1" as const;
export const DAEMON_RECONCILIATION_PAYLOAD_SCHEMA = "delivery.daemon.reconciliation.v1" as const;
export const DAEMON_PREEMPTION_PAYLOAD_SCHEMA = "delivery.daemon.preemption.v1" as const;
export const COMMAND_RECEIPT_PAYLOAD_SCHEMA = "delivery.command.receipt.v1" as const;
export const OUTBOX_EFFECT_PAYLOAD_SCHEMA = "delivery.outbox.effect.v1" as const;

/** The store-scoped key prefixes (Appendix D verbatim). */
export const DAEMON_INSTANCE_RECORD_KEY = "daemon.instance" as const;
export const DAEMON_HEARTBEAT_RECORD_KEY = "daemon.heartbeat" as const;
export const DAEMON_LANE_KEY_PREFIX = "daemon.lanes:" as const;
export const DAEMON_RECONCILIATION_KEY_PREFIX = "daemon.reconciliations:" as const;
export const DAEMON_PREEMPTION_KEY_PREFIX = "daemon.preemptions:" as const;
export const COMMAND_RECEIPT_KEY_PREFIX = "command.receipts:" as const;
export const OUTBOX_EFFECT_KEY_PREFIX = "outbox.effects:" as const;

export const daemonLaneRecordKey = (ref: string): string => `${DAEMON_LANE_KEY_PREFIX}${ref}`;
export const daemonReconciliationRecordKey = (instanceId: string): string =>
  `${DAEMON_RECONCILIATION_KEY_PREFIX}${instanceId}`;
export const daemonPreemptionRecordKey = (ref: string): string =>
  `${DAEMON_PREEMPTION_KEY_PREFIX}${ref}`;
export const commandReceiptRecordKey = (effectId: string): string =>
  `${COMMAND_RECEIPT_KEY_PREFIX}${effectId}`;
export const outboxEffectRecordKey = (effectId: string): string =>
  `${OUTBOX_EFFECT_KEY_PREFIX}${effectId}`;

/* ------------------------------ instance --------------------------------- */

export const DAEMON_INSTANCE_OPERATIONS = [
  "acquired",
  "taken-over",
  "released",
  "immediate-stop",
] as const;
export type DaemonInstanceOperation = (typeof DAEMON_INSTANCE_OPERATIONS)[number];

export const DAEMON_RELEASE_REASONS = ["drain", "immediate", "shutdown"] as const;
export type DaemonReleaseReason = (typeof DAEMON_RELEASE_REASONS)[number];

/** The evidenced stale takeover (AC-F2-2). */
export type DaemonTakeoverEvidence = {
  readonly previousInstanceId: string;
  readonly previousLockToken: string;
  readonly lastHeartbeatAt: string;
  readonly heartbeatAgeMs: number;
  readonly takenOverAt: string;
};

export type DaemonInstanceRecord = {
  readonly schema: typeof DAEMON_INSTANCE_PAYLOAD_SCHEMA;
  readonly instanceId: string;
  readonly pid: number;
  readonly scope: string;
  readonly lockToken: string;
  readonly operation: DaemonInstanceOperation;
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
  readonly releaseReason?: DaemonReleaseReason;
  readonly takeover?: DaemonTakeoverEvidence;
  readonly recordedAt: string;
};

/* ------------------------------ heartbeat -------------------------------- */

export const DAEMON_LANE_COUNT_KEYS = ["delivering", "idle", "parked", "failed"] as const;
export type DaemonLaneCounts = Readonly<Record<(typeof DAEMON_LANE_COUNT_KEYS)[number], number>>;

export const DAEMON_HEARTBEAT_STATES = ["running", "stale", "stopped"] as const;
export type DaemonHeartbeatState = (typeof DAEMON_HEARTBEAT_STATES)[number];

export type DaemonHeartbeatRecord = {
  readonly schema: typeof DAEMON_HEARTBEAT_PAYLOAD_SCHEMA;
  readonly instanceId: string;
  readonly ordinal: number;
  readonly beatAt: string;
  readonly uptimeMs: number;
  readonly queueDepth: number;
  readonly laneCounts: DaemonLaneCounts;
  readonly currentSpawn?: { readonly ref: string; readonly sessionId: string };
  readonly cursor: number;
  readonly recordedAt: string;
};

/* -------------------------------- lanes ---------------------------------- */

export const DAEMON_LANE_STATES = [
  "delivering",
  "detached",
  "completed",
  "failed",
  "preempted",
] as const;
export type DaemonLaneState = (typeof DAEMON_LANE_STATES)[number];

export const DAEMON_LANE_CLASSIFICATIONS = ["alive", "interrupted", "crashed"] as const;
export type DaemonLaneClassification = (typeof DAEMON_LANE_CLASSIFICATIONS)[number];

export const DAEMON_LANE_LIVENESS_CLASSIFICATIONS = ["progressing", "stalled", "unknown"] as const;
export type DaemonLaneLivenessClassification =
  (typeof DAEMON_LANE_LIVENESS_CLASSIFICATIONS)[number];

export type DaemonLaneLiveness = {
  readonly classification: DaemonLaneLivenessClassification;
  readonly observedAt: string;
};

export type DaemonLaneLedgerPosition = { readonly lastCompletedPhase: string };

export type DaemonResumeIntent = {
  readonly questionId: string;
  readonly mode: "boundary-note" | "attach-continue" | "resume-prompt-reentry";
};

export type DaemonLaneRecord = {
  readonly schema: typeof DAEMON_LANE_PAYLOAD_SCHEMA;
  readonly ref: string;
  readonly state: DaemonLaneState;
  readonly harnessKind?: string;
  readonly sessionId?: string;
  readonly processId?: number;
  readonly ledgerPosition?: DaemonLaneLedgerPosition;
  readonly spawnOrdinal: number;
  readonly liveness?: DaemonLaneLiveness;
  readonly detachedAt?: string;
  readonly classification?: DaemonLaneClassification;
  readonly resumeIntent?: DaemonResumeIntent;
  readonly recordedAt: string;
};

/* --------------------------- reconciliation ------------------------------ */

export const DAEMON_RECONCILIATION_ACTIONS = [
  "reattach",
  "resume",
  "hold",
  "terminal-failed",
  "none",
] as const;
export type DaemonReconciliationAction = (typeof DAEMON_RECONCILIATION_ACTIONS)[number];

export const DAEMON_RECONCILIATION_REASONS = [
  "evidence-insufficient",
  "restart-budget-exhausted",
  "dispatch.restart-budget-exceeded",
  "dispatch.resume-uneconomical",
] as const;
export type DaemonReconciliationReason = (typeof DAEMON_RECONCILIATION_REASONS)[number];

export type DaemonReconciliationLane = {
  readonly ref: string;
  readonly classification?: DaemonLaneClassification;
  readonly action: DaemonReconciliationAction;
  readonly restarts: number;
  readonly reason?: DaemonReconciliationReason;
};

export type DaemonReconciliationRecord = {
  readonly schema: typeof DAEMON_RECONCILIATION_PAYLOAD_SCHEMA;
  readonly instanceId: string;
  readonly queue: { readonly entries: number; readonly edges: number; readonly parks: number };
  readonly lanes: readonly DaemonReconciliationLane[];
  readonly duplicates: number;
  readonly questions: readonly string[];
  readonly startedAt: string;
  readonly completedAt: string;
  readonly truncated: boolean;
  readonly recordedAt: string;
};

/* ----------------------------- preemption -------------------------------- */

export const DAEMON_PREEMPTION_STATES = ["pending", "applied", "withdrawn"] as const;
export type DaemonPreemptionState = (typeof DAEMON_PREEMPTION_STATES)[number];

export type DaemonPreemptionBoundary = { readonly phase: string; readonly observedAt: string };

export type DaemonPreemptionRecord = {
  readonly schema: typeof DAEMON_PREEMPTION_PAYLOAD_SCHEMA;
  readonly ref: string;
  readonly repository: string;
  readonly closeRef: string;
  readonly parkCause: "preempted-for-close-item";
  readonly conditionType: "preemption";
  readonly holder: string;
  readonly state: DaemonPreemptionState;
  readonly requestedAt: string;
  readonly appliedAt?: string;
  readonly boundary?: DaemonPreemptionBoundary;
  readonly evidence: readonly string[];
  readonly recordedAt: string;
};

/* ------------------------------ supervisor ------------------------------- */

export const DAEMON_SUPERVISOR_KINDS = ["systemd-user", "launchd", "windows-service"] as const;
export type DaemonSupervisorKind = (typeof DAEMON_SUPERVISOR_KINDS)[number];

export const DAEMON_SUPERVISOR_COMMAND_FORMS = ["foreground", "spawn-and-return"] as const;
export type DaemonSupervisorCommandForm = (typeof DAEMON_SUPERVISOR_COMMAND_FORMS)[number];

export const DAEMON_SUPERVISOR_SERVICE_TYPES = ["simple"] as const;
export type DaemonSupervisorServiceType = (typeof DAEMON_SUPERVISOR_SERVICE_TYPES)[number];

export const DAEMON_SUPERVISOR_RESTART_POLICIES = ["on-failure"] as const;
export type DaemonSupervisorRestartPolicy = (typeof DAEMON_SUPERVISOR_RESTART_POLICIES)[number];

export type DaemonSupervisorDescriptor = {
  readonly kind: DaemonSupervisorKind;
  readonly installed: boolean;
  readonly unit: string;
  readonly scope: string;
  readonly linger: boolean;
  readonly commandForm: DaemonSupervisorCommandForm;
  readonly serviceType: DaemonSupervisorServiceType;
  readonly restartPolicy: DaemonSupervisorRestartPolicy;
  readonly environment?: { readonly name: string; readonly value: string };
};

/* ---------------------------- degradation -------------------------------- */

export const DAEMON_DEGRADATION_MARKERS = [
  "daemon-unreachable",
  "daemon-heartbeat-stale",
  "daemon-socket-unreachable",
  "lane-executor-unavailable",
  "subscriber-overflow",
] as const;
export type DaemonDegradationMarker = (typeof DAEMON_DEGRADATION_MARKERS)[number];

/* ------------------------------- status ---------------------------------- */

export const DAEMON_MERGE_CODE_PATHS = ["absent", "present"] as const;
export type DaemonMergeCodePath = (typeof DAEMON_MERGE_CODE_PATHS)[number];

export const DAEMON_STATUS_TRANSPORTS = ["unix", "stdio"] as const;

export type DaemonStatusSocket = {
  readonly path: string;
  readonly transport: string;
  readonly reachable: boolean;
};

export type DaemonStatusRestart = {
  readonly ref: string;
  readonly count: number;
  readonly reason?: string;
  readonly classified: boolean;
};

export type DaemonStatusLane = {
  readonly ref: string;
  readonly state: string;
  readonly reason?: string;
  readonly harnessKind?: string;
  readonly sessionId?: string;
  readonly restarts?: number;
};

export type DaemonStatusHeartbeat = {
  readonly ageMs: number | null;
  readonly intervalMs: number;
  readonly state: DaemonHeartbeatState;
};

export type DaemonStatusInstance = {
  readonly instanceId: string;
  readonly pid: number;
  readonly scope: string;
  readonly acquiredAt: string;
  readonly mode: DaemonStartMode;
};

export type DaemonStatusData = {
  readonly instance: DaemonStatusInstance | null;
  readonly uptimeMs: number;
  readonly queueDepth: number;
  readonly lanes: readonly DaemonStatusLane[];
  readonly restarts: readonly DaemonStatusRestart[];
  readonly heartbeat: DaemonStatusHeartbeat;
  readonly socket: DaemonStatusSocket;
  readonly supervisor: DaemonSupervisorDescriptor;
  readonly reconciliation: DaemonReconciliationRecord | null;
  readonly mergeCodePath: DaemonMergeCodePath;
  readonly degraded: readonly DaemonDegradationMarker[];
  readonly truncated: boolean;
  readonly truncationReason?: string;
};

/* ---------------------------- command data ------------------------------- */

export const DAEMON_START_MODES = ["resident", "foreground", "supervise-only"] as const;
export type DaemonStartMode = (typeof DAEMON_START_MODES)[number];

export const DAEMON_STOP_RESULTS = ["stopped", "draining", "noop"] as const;
export type DaemonStopResult = (typeof DAEMON_STOP_RESULTS)[number];

export const DAEMON_STOP_MODES = ["drain", "immediate"] as const;
export type DaemonStopMode = (typeof DAEMON_STOP_MODES)[number];

export const DAEMON_INSTALL_RESULTS = ["installed", "noop"] as const;
export type DaemonInstallResult = (typeof DAEMON_INSTALL_RESULTS)[number];
export const DAEMON_UNINSTALL_RESULTS = ["uninstalled", "noop"] as const;
export type DaemonUninstallResult = (typeof DAEMON_UNINSTALL_RESULTS)[number];

export type DaemonStartData = {
  readonly instance: DaemonStatusInstance;
  readonly reconciliation: DaemonReconciliationRecord;
  readonly socket: DaemonStatusSocket;
  readonly heartbeat: { readonly intervalMs: number; readonly ageMs: number | null };
  readonly supervisor: DaemonSupervisorDescriptor;
  readonly degraded: readonly DaemonDegradationMarker[];
};

export type DaemonStopData = {
  readonly result: DaemonStopResult;
  readonly instance: DaemonStatusInstance | null;
  readonly detachedLanes: readonly string[];
  readonly degraded: readonly DaemonDegradationMarker[];
};

export type DaemonStatusEnvelopeData = DaemonStatusData & {
  readonly live?: boolean;
};

export type DaemonInstallData = {
  readonly result: DaemonInstallResult;
  readonly supervisor: DaemonSupervisorDescriptor;
  readonly degraded: readonly DaemonDegradationMarker[];
};

export type DaemonUninstallData = {
  readonly result: DaemonUninstallResult;
  readonly supervisor: DaemonSupervisorDescriptor;
  readonly degraded: readonly DaemonDegradationMarker[];
};

/* ------------------------------ settings --------------------------------- */

export const DAEMON_IMPLEMENTED_TRANSPORTS = ["unix", "stdio"] as const;
export type DaemonImplementedTransport = (typeof DAEMON_IMPLEMENTED_TRANSPORTS)[number];

export const DAEMON_DECLARED_TRANSPORTS = [
  "unix",
  "stdio",
  "tcp",
  "tls",
  "ssh",
  "container-pipe",
] as const;
export type DaemonDeclaredTransport = (typeof DAEMON_DECLARED_TRANSPORTS)[number];

/** The closed poll platform-id set (delivered read clients only). */
export const POLL_PLATFORMS = ["github", "gitlab", "jira"] as const;
export type PollPlatform = (typeof POLL_PLATFORMS)[number];

export type DaemonSettings = {
  readonly heartbeatIntervalMs: number;
  readonly heartbeatCycleMs: number;
  readonly lockStalenessMs: number;
  readonly pollIntervalMs: number;
  readonly watchPollIntervalMs: number;
  readonly responseTimeoutMs: number;
  readonly subscriptionBuffer: number;
  readonly frameMaxBytes: number;
  readonly reconcileMaxLanes: number;
  readonly transport: DaemonImplementedTransport;
  readonly socketPath: string;
};

export type PlatformPollSettings = {
  readonly baseIntervalMs: number;
  readonly maxIntervalMs: number;
  readonly minSpacingMs: number;
};

export type PollSettings = Readonly<Record<PollPlatform, PlatformPollSettings>>;

/* -------------------------------- ports ---------------------------------- */

/** The durable daemon lock (distinct from the state writer fence). */
export type DaemonLockRecord = {
  readonly lockToken: string;
  readonly instanceId: string;
  readonly pid: number;
  readonly scope: string;
  readonly acquiredAt: string;
  readonly heartbeatAt: string;
};

export type DaemonLockRead =
  | { readonly state: "absent" }
  | { readonly state: "held"; readonly record: DaemonLockRecord }
  | { readonly state: "unreadable"; readonly code: string; readonly path: string };

export type DaemonLockPort = {
  readonly read: () => DaemonLockRead;
  readonly acquire: (
    record: DaemonLockRecord,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly path: string };
  readonly heartbeat: (
    lockToken: string,
    heartbeatAt: string,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly path: string };
  readonly remove: (
    lockToken: string,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string; readonly path: string };
};

/** The injected clock; every interval, timeout, and backoff flows through it. */
export type DaemonClockPort = {
  readonly nowMs: () => number;
  readonly nowIso: () => string;
  /** A bounded, cancellable sleep; resolves early only on cancellation. */
  readonly sleep: (ms: number, signal?: { readonly cancelled: () => boolean }) => Promise<void>;
};

export type DaemonWakeKind = "poke" | "tail" | "timeout";

/** The wake source: a poke, the event-log tail, or the bounded poll fallback. */
export type DaemonWakePort = {
  readonly next: (timeoutMs: number) => Promise<DaemonWakeKind>;
};

/** The detached process supervisor (start/stop only; never a lane signal). */
export type DaemonProcessPort = {
  readonly spawnDetached: (request: {
    readonly entry: string;
    readonly args: readonly string[];
    readonly environment: Readonly<Record<string, string>>;
  }) => { readonly pid: number } | { readonly pid?: undefined; readonly code: string };
  readonly signal: (
    pid: number,
    signal: "SIGTERM" | "SIGINT",
  ) => { readonly ok: boolean; readonly detail?: string };
  readonly isAlive: (pid: number) => boolean;
};

/** The lane-executor availability fact; absence means supervise-only. */
export type LaneExecutorAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: "lane-executor-unavailable" | string };

export type LaneLaunchRequest = {
  readonly ref: string;
  readonly repository: string;
  readonly phaseId?: string;
  readonly weightClass: string;
};

export type LaneLaunchPlan = {
  readonly prompt: string;
  readonly environment: Readonly<Record<string, string>>;
};

/** The prompt/environment planning seam (M1-S9 owns the real planner). */
export type LaneLaunchPlanner = {
  readonly plan: (request: LaneLaunchRequest) => LaneLaunchPlan | undefined;
};

export type LaneHandle = {
  readonly sessionId: string;
  readonly harnessKind: string;
  readonly processId?: number;
};

export type LaneObservation = {
  readonly observable: boolean;
  readonly sessionId?: string;
  readonly processId?: number;
  readonly progress: "progressing" | "stalled" | "unknown";
  readonly completedPhase?: string;
  readonly failureReason?: string;
  readonly done: boolean;
};

export type LaneCollectOutcome = {
  readonly ok: boolean;
  readonly summary?: string;
  readonly detail?: string;
};

/** The injected lane executor: the daemon supervises, the owner delivers. */
export type LaneExecutorPort = {
  readonly availability: () => LaneExecutorAvailability;
  readonly start: (request: LaneLaunchRequest) => Promise<LaneHandle | undefined>;
  readonly observe: (handle: LaneHandle) => Promise<LaneObservation>;
  readonly collect: (handle: LaneHandle) => Promise<LaneCollectOutcome>;
  readonly resume: (request: {
    readonly handle: LaneHandle;
    readonly mode: DaemonResumeIntent["mode"];
    readonly questionId: string;
  }) => Promise<boolean>;
};

export type SupervisorInstallRequest = {
  readonly unit: string;
  readonly scope: string;
  readonly stateDirectory: string;
  readonly binary: string;
  readonly environmentName: string;
  readonly enableLinger: boolean;
};

export type SupervisorInspection =
  | { readonly supported: true; readonly descriptor: DaemonSupervisorDescriptor }
  | { readonly supported: false; readonly kind: DaemonSupervisorKind; readonly platform: string };

export type SupervisorInstallOutcome =
  | { readonly ok: true; readonly descriptor: DaemonSupervisorDescriptor }
  | {
      readonly ok: false;
      readonly code: string;
      readonly platform: string;
      readonly detail: string;
    };

/** The injected supervisor adapter seam; all filesystem/process calls are injected. */
export type SupervisorPort = {
  readonly kind: DaemonSupervisorKind;
  readonly platform: string;
  readonly inspect: () => SupervisorInspection;
  readonly install: (request: SupervisorInstallRequest) => SupervisorInstallOutcome;
  readonly uninstall: (request: {
    readonly unit: string;
  }) => { readonly removed: boolean } | { readonly code: string; readonly detail: string };
};

/** One bounded effect-state view for the daemon's detection duty. */
export type DaemonEffectView = {
  readonly effectId: string;
  readonly effectKind: "tracker-transition" | "tracker-comment" | "commit";
  readonly state: "accepted" | "in-flight" | "applied" | "failed" | "unknown";
  readonly changeRef?: string;
  readonly phase?: string;
  readonly baselineHead?: string;
  readonly stagedPaths?: readonly string[];
  readonly idempotencyKey: string;
  readonly recordedAt: string;
};

/** The daemon's state-medation read of intent queues (never a writer). */
export type DaemonStateView = {
  readonly entries: number;
  readonly edges: number;
  readonly parks: number;
  readonly lanes: readonly DaemonLaneRecord[];
  readonly restarts: Readonly<Record<string, number>>;
  readonly questions: readonly string[];
  readonly effects: readonly DaemonEffectView[];
};

/** One durable reconciliation append result. */
export type DaemonAppendOutcome =
  | { readonly ok: true; readonly sequence: number; readonly path: string }
  | { readonly ok: false; readonly code: string; readonly path: string };

/** A daemon record payload is state JSON; the record types are structural. */
export type DaemonRecordPayload = StateJsonValue;

/** The shared caller-principal field on intent records (C-2). */
export type CallerPrincipalField = { readonly callerPrincipal?: CallerPrincipal };

/* --------------------------- recovery ports ------------------------------ */

/** The injected restart/terminal persistence seam (state tier stays below app). */
export type DaemonRecoveryPort = {
  readonly readRestarts: (
    workItemRef: string,
  ) =>
    | { readonly ok: true; readonly records: readonly EconomicsRestartRecord[] }
    | { readonly ok: false; readonly code: string };
  readonly appendRestart: (
    record: EconomicsRestartRecord,
  ) =>
    | { readonly ok: true; readonly appended: boolean; readonly record: EconomicsRestartRecord }
    | { readonly ok: false; readonly code: string };
  readonly ensureExhaustion: (
    record: EconomicsExhaustionRecord,
  ) =>
    | { readonly ok: true; readonly appended: boolean; readonly record: EconomicsExhaustionRecord }
    | { readonly ok: false; readonly code: string };
  readonly raiseQuestion: (input: {
    readonly ref: string;
    readonly reason: "restart-budget-exhausted";
    readonly restarts: number;
  }) =>
    | { readonly ok: true; readonly questionId: string }
    | { readonly ok: false; readonly code: string };
};
