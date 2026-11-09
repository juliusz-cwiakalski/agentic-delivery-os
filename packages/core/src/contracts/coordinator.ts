/**
 * The coordinator-supervision vocabulary (GH-241 F-1..F-10; Appendix B/E/F/G).
 *
 * Runtime-neutral: types and `as const` data only. Every closed set, record
 * kind, payload schema, store key, bound, observation shape, regime descriptor,
 * capability declaration, and the two named state-fence rules are declared once
 * here. No clock, randomness, environment, filesystem, network, process, CPU,
 * or model call exists in this module.
 */

/* -------------------------------- bounds --------------------------------- */

/** Appendix G bounds. */
export const COORDINATOR_OBSERVATION_SCHEMA = "delivery.coordinator.v1" as const;
export const COORDINATOR_MAX_DATA_BYTES = 65_536 as const;
export const COORDINATOR_MAX_HUMAN_LINES = 32 as const;
export const COORDINATOR_MAX_EVIDENCE_BYTES = 512 as const;

/** The declared rendered-question bound and the reserved-slot occupancy. */
export const COORDINATOR_RENDERED_QUESTION_BOUND = 8 as const;
export const COORDINATOR_OTHER_QUESTION_BOUND = 7 as const;

/* ------------------------------- records --------------------------------- */

/** The six additive record kinds (EVT-1..EVT-5, EVT-7). */
export const COORDINATOR_ITERATION_RECORD_KIND = "coordinator.iteration" as const;
export const COORDINATOR_RESTART_RECORD_KIND = "coordinator.restart" as const;
export const COORDINATOR_STUCK_RECORD_KIND = "coordinator.stuck" as const;
export const COORDINATOR_EXHAUSTION_RECORD_KIND = "coordinator.exhaustion" as const;
export const COORDINATOR_WAKE_RECORD_KIND = "coordinator.wake" as const;
export const COORDINATOR_FENCE_RECORD_KIND = "coordinator.fence" as const;

export const COORDINATOR_RECORD_KINDS = [
  COORDINATOR_ITERATION_RECORD_KIND,
  COORDINATOR_RESTART_RECORD_KIND,
  COORDINATOR_STUCK_RECORD_KIND,
  COORDINATOR_EXHAUSTION_RECORD_KIND,
  COORDINATOR_WAKE_RECORD_KIND,
  COORDINATOR_FENCE_RECORD_KIND,
] as const;
export type CoordinatorRecordKind = (typeof COORDINATOR_RECORD_KINDS)[number];

/** The payload schema identifiers (Appendix E verbatim). */
export const COORDINATOR_ITERATION_PAYLOAD_SCHEMA =
  "delivery.coordinator.iteration.v1" as const;
export const COORDINATOR_RESTART_PAYLOAD_SCHEMA = "delivery.coordinator.restart.v1" as const;
export const COORDINATOR_STUCK_PAYLOAD_SCHEMA = "delivery.coordinator.stuck.v1" as const;
export const COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA =
  "delivery.coordinator.exhaustion.v1" as const;
export const COORDINATOR_WAKE_PAYLOAD_SCHEMA = "delivery.coordinator.wake.v1" as const;
export const COORDINATOR_FENCE_PAYLOAD_SCHEMA = "delivery.coordinator.fence.v1" as const;

/**
 * The store-scoped key prefixes. The restart namespace is exactly
 * `coordinator/<coordinatorId>` (AC-F5-1), disjoint from lane and economics.
 */
export const COORDINATOR_ITERATION_KEY_PREFIX = "coordinator.iterations:" as const;
export const COORDINATOR_RESTART_KEY_PREFIX = "coordinator/" as const;
export const COORDINATOR_STUCK_KEY_PREFIX = "coordinator.stuck:" as const;
export const COORDINATOR_EXHAUSTION_KEY_PREFIX = "coordinator.exhaustion:" as const;
export const COORDINATOR_WAKE_KEY_PREFIX = "coordinator.wake:" as const;
export const COORDINATOR_FENCE_KEY_PREFIX = "coordinator.fence:" as const;

/* ----------------------------- vocabularies ------------------------------ */

/** The closed lifecycle decisions (Appendix B). */
export const COORDINATOR_LIFECYCLE_DECISIONS = [
  "join-live",
  "resume-context",
  "spawn-fresh",
] as const;
export type CoordinatorLifecycleDecision = (typeof COORDINATOR_LIFECYCLE_DECISIONS)[number];

/** An iteration record may carry `none` when it captures an expectation only. */
export const COORDINATOR_DECISION_KINDS = [...COORDINATOR_LIFECYCLE_DECISIONS, "none"] as const;
export type CoordinatorDecisionKind = (typeof COORDINATOR_DECISION_KINDS)[number];

/** The closed lifecycle decision reasons (DEC-7). */
export const COORDINATOR_DECISION_REASONS = [
  "context-pressure",
  "context-unknown",
  "session-interrupted",
  "initial-start",
  "clean-iteration-end",
] as const;
export type CoordinatorDecisionReason = (typeof COORDINATOR_DECISION_REASONS)[number];

/** The iteration reason carries the decision reasons plus the expectation marker. */
export const COORDINATOR_ITERATION_REASONS = [
  ...COORDINATOR_DECISION_REASONS,
  "expectation",
] as const;
export type CoordinatorIterationReason = (typeof COORDINATOR_ITERATION_REASONS)[number];

/** The closed restart reasons; each consumes exactly one ordinal (Appendix B). */
export const COORDINATOR_RESTART_REASONS = [
  "stuck-artifact-evidence",
  "session-interrupted",
  "context-pressure",
  "context-unknown",
] as const;
export type CoordinatorRestartReason = (typeof COORDINATOR_RESTART_REASONS)[number];

/** The closed iteration triggers (EVT-1). */
export const COORDINATOR_ITERATION_TRIGGERS = [
  "start",
  "collection",
  "wake",
  "stuck-restart",
] as const;
export type CoordinatorIterationTrigger = (typeof COORDINATOR_ITERATION_TRIGGERS)[number];

/** The closed stuck verdicts; only `stuck` and `unevaluable` are persisted. */
export const COORDINATOR_VERDICTS = ["progressing", "stuck", "unevaluable"] as const;
export type CoordinatorVerdict = (typeof COORDINATOR_VERDICTS)[number];

export const COORDINATOR_PERSISTED_VERDICTS = ["stuck", "unevaluable"] as const;
export type CoordinatorPersistedVerdict = (typeof COORDINATOR_PERSISTED_VERDICTS)[number];

/** The two record phases sharing one `stuckId` (EVT-3). */
export const COORDINATOR_STUCK_PHASES = ["verdict", "outcome"] as const;
export type CoordinatorStuckPhase = (typeof COORDINATOR_STUCK_PHASES)[number];

/** The closed stuck reasons, distinct from the restart reason (GAP-5). */
export const COORDINATOR_STUCK_REASONS = [
  "stuck-artifact-evidence",
  "evidence-unevaluable",
] as const;
export type CoordinatorStuckReason = (typeof COORDINATOR_STUCK_REASONS)[number];

/** The three artifact evidence classes (F-3). */
export const COORDINATOR_EVIDENCE_CLASSES = ["digest-consumed", "merge", "answer"] as const;
export type CoordinatorEvidenceClass = (typeof COORDINATOR_EVIDENCE_CLASSES)[number];

/** The three evidence-class states; `unknown` is never fabricated as `stale`. */
export const COORDINATOR_EVIDENCE_STATES = ["advanced", "stale", "unknown"] as const;
export type CoordinatorEvidenceState = (typeof COORDINATOR_EVIDENCE_STATES)[number];

/** The closed kill outcomes (EVT-3, F-4). */
export const COORDINATOR_KILL_OUTCOMES = [
  "terminated",
  "forced",
  "failed",
  "not-attempted",
] as const;
export type CoordinatorKillOutcome = (typeof COORDINATOR_KILL_OUTCOMES)[number];

/** The single kill failure reason (A2, AC-F4-4). */
export const COORDINATOR_KILL_FAILURE_REASONS = ["identity-mismatch"] as const;
export type CoordinatorKillFailureReason = (typeof COORDINATOR_KILL_FAILURE_REASONS)[number];

/** Only `woken` is persisted and consumes the one-wake-per-question lifetime. */
export const COORDINATOR_WAKE_PERSISTED_OUTCOMES = ["woken"] as const;
export type CoordinatorWakePersistedOutcome =
  (typeof COORDINATOR_WAKE_PERSISTED_OUTCOMES)[number];

/** The declared tick results; they append no durable record (DEC-9). */
export const COORDINATOR_WAKE_TICK_RESULTS = [
  "already-woken",
  "answered-before-wake",
  "delivery-failed",
  "no-pickup",
] as const;
export type CoordinatorWakeTickResult = (typeof COORDINATOR_WAKE_TICK_RESULTS)[number];

export const COORDINATOR_WAKE_OUTCOMES = [
  ...COORDINATOR_WAKE_PERSISTED_OUTCOMES,
  ...COORDINATOR_WAKE_TICK_RESULTS,
] as const;
export type CoordinatorWakeOutcome = (typeof COORDINATOR_WAKE_OUTCOMES)[number];

/** The four instance-lease actions (EVT-7). */
export const COORDINATOR_FENCE_ACTIONS = [
  "acquired",
  "released",
  "stale-takeover",
  "stop-requested",
] as const;
export type CoordinatorFenceAction = (typeof COORDINATOR_FENCE_ACTIONS)[number];

/** The actions whose latest record still names a holder. */
export const COORDINATOR_LEASE_HELD_ACTIONS = [
  "acquired",
  "stale-takeover",
  "stop-requested",
] as const;
export type CoordinatorLeaseHeldAction = (typeof COORDINATOR_LEASE_HELD_ACTIONS)[number];

/** The closed liveness states; `alive(handle)` is decided before age. */
export const COORDINATOR_LEASE_LIVENESS_STATES = [
  "held",
  "takeover-eligible",
  "age-fallback-takeover",
  "unheld",
] as const;
export type CoordinatorLeaseLivenessState =
  (typeof COORDINATOR_LEASE_LIVENESS_STATES)[number];

/** `foreground` is the only v1 value; `detached` is reserved and never produced. */
export const COORDINATOR_SUPERVISOR_MODES = ["foreground", "detached"] as const;
export type CoordinatorSupervisorMode = (typeof COORDINATOR_SUPERVISOR_MODES)[number];
export const COORDINATOR_V1_SUPERVISOR_MODE = "foreground" as const;

/** The single external-unit value in v1. */
export const COORDINATOR_EXTERNAL_UNITS = ["absent"] as const;
export type CoordinatorExternalUnit = (typeof COORDINATOR_EXTERNAL_UNITS)[number];

/** The derived escalation states; `escalated` is never a value (RF-10). */
export const COORDINATOR_ESCALATION_STATES = [
  "not-exhausted",
  "exhausted-escalated",
  "exhausted-escalation-failed",
] as const;
export type CoordinatorEscalationState = (typeof COORDINATOR_ESCALATION_STATES)[number];

/** The declared exhaustion recovery options (EVT-4). */
export const COORDINATOR_EXHAUSTION_OPTIONS = [
  "restart-fresh-budget",
  "park-owner-review",
] as const;
export type CoordinatorExhaustionOption = (typeof COORDINATOR_EXHAUSTION_OPTIONS)[number];

/** The six config key paths (DM-6, DEC-10). */
export const COORDINATOR_CONFIG_KEYS = [
  "coordinator.stuck-window",
  "coordinator.kill-grace",
  "coordinator.restart-budget",
  "coordinator.resume-context-limit",
  "coordinator.collection-interval",
  "coordinator.progress-bound",
] as const;
export type CoordinatorConfigKey = (typeof COORDINATOR_CONFIG_KEYS)[number];

/** The declared leaf names of the `coordinator` config branch. */
export const COORDINATOR_BRANCH_KEYS = [
  "stuck-window",
  "kill-grace",
  "restart-budget",
  "resume-context-limit",
  "collection-interval",
  "progress-bound",
] as const;

/** The six declared coordinator error identities (DEC-11). */
export const COORDINATOR_ERROR_CODES = [
  "coordinator.already-running",
  "coordinator.restart-budget-exhausted",
  "coordinator.process.capability-gap",
  "coordinator.session.kill-failed",
  "coordinator.escalation.publish-failed",
  "coordinator.wake.delivery-failed",
] as const;
export type CoordinatorErrorCode = (typeof COORDINATOR_ERROR_CODES)[number];

/** The two two-segment coordinator identities joining the reserved allowlist. */
export const COORDINATOR_TWO_SEGMENT_CODES = [
  "coordinator.already-running",
  "coordinator.restart-budget-exhausted",
] as const;

/** The four three-segment coordinator identities (no allowlist entry). */
export const COORDINATOR_THREE_SEGMENT_CODES = [
  "coordinator.process.capability-gap",
  "coordinator.session.kill-failed",
  "coordinator.escalation.publish-failed",
  "coordinator.wake.delivery-failed",
] as const;

/** The two named state-fence handling rules (F-1, AC-F8-7). */
export const COORDINATOR_STATE_FENCE_RULES = ["claim-acquire", "non-claim-append"] as const;
export type CoordinatorStateFenceRule = (typeof COORDINATOR_STATE_FENCE_RULES)[number];

/**
 * The refusal identity each named rule maps a still-busy fence to. Claim acquire
 * is the coordinator identity; the non-claim append keeps the delivered one.
 */
export const COORDINATOR_STATE_FENCE_REFUSALS = {
  "claim-acquire": "coordinator.already-running",
  "non-claim-append": "state.lock.busy",
} as const;

/** The single stale-lock recovery attempt shared by both rules. */
export const COORDINATOR_STATE_FENCE_RECOVERY_ATTEMPTS = 1 as const;

/** The two declared process-progress sources (F-3, DEC-4). */
export const COORDINATOR_PROGRESS_SOURCES = ["token-delta", "session-traffic"] as const;
export type CoordinatorProgressSource = (typeof COORDINATOR_PROGRESS_SOURCES)[number];

/** Progress fact states; absence is `unknown`, never zero or stale. */
export const COORDINATOR_PROGRESS_STATES = ["positive", "zero", "unknown"] as const;
export type CoordinatorProgressState = (typeof COORDINATOR_PROGRESS_STATES)[number];

/** The three process-port capabilities the supervisor consumes (DM-7). */
export const COORDINATOR_PROCESS_CAPABILITIES = [
  "alive",
  "kill-with-grace",
  "start-time-identity",
] as const;
export type CoordinatorProcessCapability =
  (typeof COORDINATOR_PROCESS_CAPABILITIES)[number];

/** The three harness-session capabilities consumed as decision inputs (DEC-11). */
export const COORDINATOR_HARNESS_CAPABILITIES = ["resume", "spawn", "progress"] as const;
export type CoordinatorHarnessCapability = (typeof COORDINATOR_HARNESS_CAPABILITIES)[number];

/* ---------------------- reserved escalation slot ------------------------- */

/**
 * The payload-only reserved-slot predicate data (DEC-5, AC-F6-1). The matcher
 * in the domain reads these values; neither renderer reads coordinator state.
 */
export const COORDINATOR_RESERVED_ESCALATION_PREDICATE = {
  type: "decision-needed",
  audience: "owner",
  lane: "coordinator",
  refSeparator: "#",
  refParts: 2,
} as const;

/* ----------------------------- regime ------------------------------------ */

/** The shared supervisor-regime descriptor constants (DM-8, DEC-1/DEC-6). */
export const COORDINATOR_REGIME = {
  scope: "state-dir",
  processKind: "coordinator",
  budgetStore: "coordinator-restart",
  leaseKind: "append-only-instance-lease",
  supervisorMode: COORDINATOR_V1_SUPERVISOR_MODE,
  externalUnit: "absent",
  daemonInstallSeam: "M1-S18",
  collectionBoundMultiplier: 2,
} as const;

/* ------------------------ capability ownership --------------------------- */

/**
 * The four-way capability ownership declaration (DEC-11, TDR-0017 DC-3): which
 * layer owns which gap and which identity it raises. Harness resume absence is a
 * decision input, not an error; harness spawn failure is the delivered pair;
 * process-port gaps are the coordinator identity; progress absence is `unknown`.
 */
export const COORDINATOR_CAPABILITY_OWNERSHIP = {
  "harness-resume": {
    owner: "harness",
    absence: "decision-input",
    identity: null,
    decisionReason: "session-interrupted",
  },
  "harness-spawn": {
    owner: "harness",
    absence: "error",
    identity: "harness.capability.gap",
    exit: 1,
  },
  "process-port": {
    owner: "process-port",
    absence: "error",
    identity: "coordinator.process.capability-gap",
    exit: 2,
  },
  progress: { owner: "harness", absence: "unknown-evidence", identity: null },
} as const;

/* ------------------------------ records ---------------------------------- */

/** EVT-1 — one recorded lifecycle decision or expectation. */
export type CoordinatorIterationRecord = {
  readonly schemaId: typeof COORDINATOR_ITERATION_PAYLOAD_SCHEMA;
  readonly iterationId: string;
  readonly coordinatorId: string;
  readonly trigger: CoordinatorIterationTrigger;
  readonly decision: CoordinatorDecisionKind;
  readonly reason: CoordinatorIterationReason;
  readonly sessionId: string | null;
  readonly contextTokens: number | null;
  readonly digestFingerprint: string;
  readonly expectationWindowMs: number;
  readonly recordedAt: string;
};

/** EVT-2 — one admitted restart in the coordinator restart namespace. */
export type CoordinatorRestartRecord = {
  readonly schemaId: typeof COORDINATOR_RESTART_PAYLOAD_SCHEMA;
  readonly restartId: string;
  readonly coordinatorId: string;
  readonly budgetEpochId: string;
  readonly sessionId: string | null;
  readonly ordinal: number;
  readonly reason: CoordinatorRestartReason;
  readonly previousSessionId: string | null;
  readonly recordedAt: string;
};

/** EVT-3 — one phase of a `stuck` or `unevaluable` verdict. */
export type CoordinatorStuckRecord = {
  readonly schemaId: typeof COORDINATOR_STUCK_PAYLOAD_SCHEMA;
  readonly stuckId: string;
  readonly coordinatorId: string;
  readonly iterationId: string;
  readonly verdict: CoordinatorPersistedVerdict;
  readonly phase: CoordinatorStuckPhase;
  readonly reason: CoordinatorStuckReason;
  readonly evidence: string;
  readonly killOutcome: CoordinatorKillOutcome;
  readonly killFailureReason: CoordinatorKillFailureReason | null;
  readonly recordedAt: string;
};

/** EVT-4 — the single terminal exhaustion receipt per epoch. */
export type CoordinatorExhaustionRecord = {
  readonly schemaId: typeof COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA;
  readonly exhaustionId: string;
  readonly coordinatorId: string;
  readonly budgetEpochId: string;
  readonly restarts: number;
  readonly historyRef: string;
  readonly escalationQuestionId: string;
  readonly options: readonly CoordinatorExhaustionOption[];
  readonly terminal: true;
  readonly recordedAt: string;
};

/** EVT-5 — one durable record per successful wake. */
export type CoordinatorWakeRecord = {
  readonly schemaId: typeof COORDINATOR_WAKE_PAYLOAD_SCHEMA;
  readonly wakeId: string;
  readonly coordinatorId: string;
  readonly questionId: string;
  readonly questionRank: number;
  readonly askedAt: string;
  readonly outcome: CoordinatorWakePersistedOutcome;
  readonly iterationId: string | null;
  readonly recordedAt: string;
};

/** EVT-7 — one instance-lease action (the append-only lease carrier). */
export type CoordinatorFenceRecord = {
  readonly schemaId: typeof COORDINATOR_FENCE_PAYLOAD_SCHEMA;
  readonly fenceId: string;
  readonly instanceId: string;
  readonly coordinatorId: string;
  readonly action: CoordinatorFenceAction;
  readonly holder: string;
  readonly pid: number;
  readonly processStartTimeMs: number;
  readonly supervisorMode: CoordinatorSupervisorMode;
  readonly externalUnit: CoordinatorExternalUnit;
  readonly previousHolder: string | null;
  readonly fenceAgeMs: number | null;
  readonly recordedAt: string;
};

/** Any coordinator record payload. */
export type CoordinatorRecord =
  | CoordinatorIterationRecord
  | CoordinatorRestartRecord
  | CoordinatorStuckRecord
  | CoordinatorExhaustionRecord
  | CoordinatorWakeRecord
  | CoordinatorFenceRecord;

/* --------------------------- observation --------------------------------- */

/** The declared regime projection carried in every command result. */
export type CoordinatorRegime = {
  readonly scope: typeof COORDINATOR_REGIME.scope;
  readonly stateDirectory: string;
  readonly unitIdentity: string;
  readonly processKind: typeof COORDINATOR_REGIME.processKind;
  readonly budgetStore: typeof COORDINATOR_REGIME.budgetStore;
  readonly supervisorMode: typeof COORDINATOR_V1_SUPERVISOR_MODE;
  readonly externalUnit: typeof COORDINATOR_REGIME.externalUnit;
  readonly daemonInstallSeam: typeof COORDINATOR_REGIME.daemonInstallSeam;
};

/** The instance identity folded from the latest lease record. */
export type CoordinatorInstance = {
  readonly instanceId: string;
  readonly pid: number;
  readonly holder: string;
  readonly startedAt: string;
  readonly supervisorMode: CoordinatorSupervisorMode;
  readonly externalUnit: CoordinatorExternalUnit;
};

/** The persisted stuck verdict (`phase`, `reason`, and `evidence` non-null). */
export type CoordinatorStuckView = {
  readonly verdict: CoordinatorPersistedVerdict;
  readonly phase: CoordinatorStuckPhase;
  readonly reason: CoordinatorStuckReason;
  readonly evidence: string;
  readonly evaluatedAt: string;
};

/**
 * The tick-specific verdict. `phase`, `reason`, and `evidence` are nullable
 * when the verdict is `progressing`, because `progressing` is never persisted.
 */
export type CoordinatorTickVerdict = {
  readonly verdict: CoordinatorVerdict;
  readonly phase: CoordinatorStuckPhase | null;
  readonly reason: CoordinatorStuckReason | null;
  readonly evidence: string | null;
};

/** The last-wake projection; `outcome` may be a durable or a tick-result value. */
export type CoordinatorWakeView = {
  readonly outcome: CoordinatorWakeOutcome;
  readonly questionId: string | null;
  readonly questionRank: number | null;
  readonly askedAt: string | null;
  readonly iterationId: string | null;
};

/** The restart-count and bound projection. */
export type CoordinatorRestarts = {
  readonly count: number;
  readonly bound: number;
  readonly budgetEpochId: string;
  readonly historyRef: string;
  readonly terminal: boolean;
};

/** The last recorded lifecycle decision projection. */
export type CoordinatorDecisionView = {
  readonly kind: CoordinatorDecisionKind;
  readonly reason: CoordinatorIterationReason;
  readonly iterationId: string;
  readonly recordedAt: string;
};

/** The session projection. */
export type CoordinatorSession = {
  readonly sessionId: string | null;
  readonly liveness: "alive" | "absent" | "unknown";
  readonly contextTokens: number | null;
  readonly harnessKind: string;
};

/** The lease projection carried in command data. */
export type CoordinatorFenceView = {
  readonly holder: string | null;
  readonly action: CoordinatorFenceAction | null;
  readonly previousHolder: string | null;
  readonly fenceAgeMs: number | null;
  readonly recordedAt: string | null;
};

/** The escalation projection; `questionId` is null when not exhausted. */
export type CoordinatorEscalationView = {
  readonly state: CoordinatorEscalationState;
  readonly questionId: string | null;
};

/** The bounded `delivery.coordinator.v1` machine payload (Appendix G). */
export type CoordinatorObservation = {
  readonly schemaVersion: typeof COORDINATOR_OBSERVATION_SCHEMA;
  readonly coordinatorId: string;
  readonly instance: CoordinatorInstance | null;
  readonly regime: CoordinatorRegime;
  readonly session: CoordinatorSession;
  readonly decision: CoordinatorDecisionView | null;
  readonly restarts: CoordinatorRestarts;
  readonly stuck: CoordinatorStuckView | null;
  readonly tickVerdict: CoordinatorTickVerdict | null;
  readonly wake: CoordinatorWakeView | null;
  readonly escalation: CoordinatorEscalationView;
  readonly fence: CoordinatorFenceView | null;
  readonly degradation: readonly string[];
};

/* -------------------- additive process-port capabilities ----------------- */

/** The process-port capability declaration (DM-7, DEC-3). */
export type CoordinatorProcessPortCapabilities = {
  readonly alive: boolean;
  readonly killWithGrace: boolean;
  readonly startTimeIdentity: boolean;
};

/** The harness-session capability declaration (DEC-11). */
export type CoordinatorHarnessCapabilities = {
  readonly resume: boolean;
  readonly spawn: boolean;
  readonly progress: boolean;
};

/** The recorded process identity a kill verifies before signalling. */
export type CoordinatorProcessIdentity = {
  readonly pid: number;
  readonly processStartTimeMs: number;
};

/** The closed kill-request outcome the adapter returns (no record, no append). */
export type CoordinatorKillResult =
  | { readonly outcome: "terminated" | "forced" }
  | { readonly outcome: "failed"; readonly failureReason: CoordinatorKillFailureReason | null }
  | { readonly outcome: "capability-gap"; readonly missing: CoordinatorProcessCapability };
