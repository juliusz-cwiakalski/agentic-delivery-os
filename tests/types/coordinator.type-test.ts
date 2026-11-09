/**
 * TC-COORD-001 type probe — the coordinator vocabularies are closed unions and
 * the observation/record shapes carry the declared literals.
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; the root
 * `pnpm typecheck` compiles it through `tests/types/tsconfig.json`.
 */
import type {
  CoordinatorConfigKey,
  CoordinatorDecisionKind,
  CoordinatorDecisionReason,
  CoordinatorErrorCode,
  CoordinatorEscalationState,
  CoordinatorEvidenceClass,
  CoordinatorEvidenceState,
  CoordinatorFenceAction,
  CoordinatorFenceRecord,
  CoordinatorInstance,
  CoordinatorKillResult,
  CoordinatorLeaseLivenessState,
  CoordinatorLifecycleDecision,
  CoordinatorObservation,
  CoordinatorPersistedVerdict,
  CoordinatorProcessPortCapabilities,
  CoordinatorRestartReason,
  CoordinatorStuckPhase,
  CoordinatorStuckReason,
  CoordinatorSupervisorMode,
  CoordinatorTickVerdict,
  CoordinatorVerdict,
  CoordinatorWakeOutcome,
} from "../../packages/core/src/contracts/coordinator";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

type WideStringIsRejected = Expect<Equal<string extends CoordinatorDecisionKind ? true : false, false>>;
type UnknownDecisionIsRejected = Expect<
  Equal<"spawn-hot" extends CoordinatorLifecycleDecision ? true : false, false>
>;
type DecisionUnion = Expect<
  Equal<CoordinatorLifecycleDecision, "join-live" | "resume-context" | "spawn-fresh">
>;
type IterationDecisionIncludesNone = Expect<Equal<CoordinatorDecisionKind extends CoordinatorLifecycleDecision | "none" ? true : false, true>>;
type ReasonUnion = Expect<
  Equal<
    CoordinatorDecisionReason,
    "context-pressure" | "context-unknown" | "session-interrupted" | "initial-start" | "clean-iteration-end"
  >
>;
type RestartReasonUnion = Expect<
  Equal<
    CoordinatorRestartReason,
    "stuck-artifact-evidence" | "session-interrupted" | "context-pressure" | "context-unknown"
  >
>;
type VerdictUnion = Expect<Equal<CoordinatorVerdict, "progressing" | "stuck" | "unevaluable">>;
type PersistedVerdictUnion = Expect<Equal<CoordinatorPersistedVerdict, "stuck" | "unevaluable">>;
type PhaseUnion = Expect<Equal<CoordinatorStuckPhase, "verdict" | "outcome">>;
type StuckReasonUnion = Expect<
  Equal<CoordinatorStuckReason, "stuck-artifact-evidence" | "evidence-unevaluable">
>;
type EvidenceClassUnion = Expect<
  Equal<CoordinatorEvidenceClass, "digest-consumed" | "merge" | "answer">
>;
type EvidenceStateUnion = Expect<Equal<CoordinatorEvidenceState, "advanced" | "stale" | "unknown">>;
type FenceActionUnion = Expect<
  Equal<CoordinatorFenceAction, "acquired" | "released" | "stale-takeover" | "stop-requested">
>;
type SupervisorModeUnion = Expect<Equal<CoordinatorSupervisorMode, "foreground" | "detached">>;
type LivenessUnion = Expect<
  Equal<
    CoordinatorLeaseLivenessState,
    "held" | "takeover-eligible" | "age-fallback-takeover" | "unheld"
  >
>;
type EscalationUnion = Expect<
  Equal<
    CoordinatorEscalationState,
    "not-exhausted" | "exhausted-escalated" | "exhausted-escalation-failed"
  >
>;
type WakeOutcomeUnion = Expect<
  Equal<
    CoordinatorWakeOutcome,
    "woken" | "already-woken" | "answered-before-wake" | "delivery-failed" | "no-pickup"
  >
>;
type ConfigKeyUnion = Expect<
  Equal<
    CoordinatorConfigKey,
    | "coordinator.stuck-window"
    | "coordinator.kill-grace"
    | "coordinator.restart-budget"
    | "coordinator.resume-context-limit"
    | "coordinator.collection-interval"
    | "coordinator.progress-bound"
  >
>;
type ErrorCodeUnion = Expect<
  Equal<
    CoordinatorErrorCode,
    | "coordinator.already-running"
    | "coordinator.restart-budget-exhausted"
    | "coordinator.process.capability-gap"
    | "coordinator.session.kill-failed"
    | "coordinator.escalation.publish-failed"
    | "coordinator.wake.delivery-failed"
  >
>;

/** `progressing` never persists, so a tick verdict may carry null phase/reason. */
type TickVerdictNullable = Expect<
  Equal<CoordinatorTickVerdict["phase"], CoordinatorStuckPhase | null>
>;
type TickVerdictEvidenceNullable = Expect<Equal<CoordinatorTickVerdict["evidence"], string | null>>;

/** The instance is folded from the lease; supervisor mode is the closed union. */
type InstanceMode = Expect<Equal<CoordinatorInstance["supervisorMode"], CoordinatorSupervisorMode>>;
type InstanceExternalUnit = Expect<Equal<CoordinatorInstance["externalUnit"], "absent">>;

/** The observation carries the declared schema and the null-able instance. */
type ObservationSchema = Expect<
  Equal<CoordinatorObservation["schemaVersion"], "delivery.coordinator.v1">
>;
type ObservationInstance = Expect<Equal<CoordinatorObservation["instance"], CoordinatorInstance | null>>;
type ObservationTickVerdict = Expect<
  Equal<CoordinatorObservation["tickVerdict"], CoordinatorTickVerdict | null>
>;

/** The fence record carries both phases of the lease identity. */
type FenceHolder = Expect<Equal<CoordinatorFenceRecord["holder"], string>>;
type FencePreviousHolder = Expect<Equal<CoordinatorFenceRecord["previousHolder"], string | null>>;
type FenceAge = Expect<Equal<CoordinatorFenceRecord["fenceAgeMs"], number | null>>;

/** A capability declaration is three booleans, never a widened record. */
type CapabilityShape = Expect<
  Equal<keyof CoordinatorProcessPortCapabilities, "alive" | "killWithGrace" | "startTimeIdentity">
>;

/** The kill result is closed over the declared outcomes. */
type KillOutcome = Expect<
  Equal<CoordinatorKillResult["outcome"], "terminated" | "forced" | "failed" | "capability-gap">
>;

export type Probes = [
  WideStringIsRejected,
  UnknownDecisionIsRejected,
  DecisionUnion,
  IterationDecisionIncludesNone,
  ReasonUnion,
  RestartReasonUnion,
  VerdictUnion,
  PersistedVerdictUnion,
  PhaseUnion,
  StuckReasonUnion,
  EvidenceClassUnion,
  EvidenceStateUnion,
  FenceActionUnion,
  SupervisorModeUnion,
  LivenessUnion,
  EscalationUnion,
  WakeOutcomeUnion,
  ConfigKeyUnion,
  ErrorCodeUnion,
  TickVerdictNullable,
  TickVerdictEvidenceNullable,
  InstanceMode,
  InstanceExternalUnit,
  ObservationSchema,
  ObservationInstance,
  ObservationTickVerdict,
  FenceHolder,
  FencePreviousHolder,
  FenceAge,
  CapabilityShape,
  KillOutcome,
];
