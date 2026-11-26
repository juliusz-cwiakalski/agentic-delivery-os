/**
 * The one-shot dispatch use case (GH-239 F-1, F-4, F-12; DM-1, DM-5; DEC-19).
 *
 * Orchestration only over injected ports: claim the repository lease, spawn or
 * resume through the harness session port, evaluate progress-based liveness,
 * classify through the shared classifier, derive truth, append exactly one
 * attempt record, and return the envelope data or a classified refusal. No I/O,
 * no exit literal, and no token literal lives here.
 */
import {
  type CommandFailureHarnessDetail,
  type CredentialFailureReason,
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultToken,
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  DISPATCH_LANE_PAYLOAD_SCHEMA,
  DISPATCH_MAX_ERROR_DETAIL_CHARS,
  DISPATCH_MAX_EVIDENCE_REFS,
  DISPATCH_MAX_LAST_MESSAGE_CHARS,
  type DispatchAttemptRecord,
  type DispatchDelay,
  type DispatchEnvelopeData,
  type DispatchEnvelopeError,
  type DispatchEnvelopePushBlock,
  type DispatchEpisodeFact,
  type DispatchEvidenceClass,
  type DispatchHandoverState,
  type DispatchPhaseLedger,
  type DispatchPushParityPort,
  type DispatchPushParityReading,
  type DispatchResumeMode,
  dispatchPushEvidenceRef,
  ERROR_TABLE,
  HARNESS_OUTCOMES,
  type HarnessEvidence,
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessFailure,
  type HarnessKind,
  type HarnessMode,
  type HarnessModeOrigin,
  type HarnessOutcome,
  type HarnessSeatBinding,
  type HarnessSessionHandle,
  type HarnessSessionPort,
  type HarnessVersionVerdict,
  type ProjectionClass,
  type ProviderProfilePeakRules,
  type ProviderZoneFacts,
  type QueueParkPreservation,
  type QueueParkRecord,
  type StateStorePort,
} from "#contracts";
import {
  buildComparisonRecord,
  buildCorroborationRecord,
  type CorroborationFacts,
  classifyFalseSuccess,
  dispatchFamilyOf,
  unreadableCorroborationSources,
} from "../domain/dispatch-comparison.js";
import {
  type DispatchLivenessReading,
  type DispatchLivenessVerdict,
  dispatchStallShortCircuit,
  dispatchStallUndecidable,
  evaluateDispatchLiveness,
} from "../domain/dispatch-liveness.js";
import {
  type DispatchArtifactFacts,
  type DispatchLedgerFacts,
  type DispatchRead,
  type DispatchTrackerFacts,
  deriveDispatchResult,
} from "../domain/dispatch-result.js";
import { admissionRefusalPair, admitDispatchRestart } from "../domain/dispatch-resume.js";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
  appendDispatchLane,
  foldDispatchDivergences,
  readDispatchDivergences,
} from "./dispatch-ledger.js";
import {
  type DispatchPeakObservation,
  type DispatchPeakResume,
  evaluateDispatchPeakResume,
  observeDispatchPeak,
} from "./dispatch-peak-pause.js";
import type { DispatchLeaseRenewalOutcome } from "./queue.js";

/** `f` failed, `su` state-unverified, `mr` max-restarts, `po` pr-open,
 * `pou` pr-open-unverified — the few tokens this module names. */
const [m, , po, pou, f, , mr, su] = DELIVERY_RESULT_TOKENS;
const O_FAILED = HARNESS_OUTCOMES[2];

/** A local short alias: keeps the payload field type recognizable. */
type DispatchToken = DeliveryResultToken;

/** One lease claim outcome through the scheduling engine. */
export type DispatchLeaseClaim =
  | { readonly ok: true; readonly leaseId: string; readonly heartbeatAt?: string }
  | {
      readonly ok: false;
      readonly code: string;
      readonly summary?: string;
      /** The live lease's holder on a `queue.single-flight` refusal (TDR-0027). */
      readonly holder?: string;
      /**
       * The declared error-table kind the refusal must preserve (GH-347 AC-F2-3,
       * DM-7): a `state.*` refusal keeps kind `state` and never becomes `queue`.
       */
      readonly kind?: "queue" | "state" | "input";
    };

/** One cancellable cadence wait; the composition owns the timer. */
export type DispatchCadenceWait = {
  readonly promise: Promise<void>;
  readonly cancel: () => void;
};

/**
 * The derived lease renewal cadence (GH-413 DEC-13, NFR-10):
 * `min(lane.liveness-interval, queue.lease-ttl / 2)`, so the heartbeat cannot
 * reach the TTL between renewals even when the liveness interval is at or above
 * it.
 */
export const dispatchRenewalCadenceMs = (livenessIntervalMs: number, leaseTtlMs: number): number =>
  Math.min(livenessIntervalMs, Math.floor(leaseTtlMs / 2));

/** The delivered terminal restart-budget exhaustion append (AC-F3-2). */
export type DispatchExhaustionRequest = {
  readonly ref: string;
  readonly runId: string;
  readonly restarts: number;
  readonly recordedAt: string;
};

/** The independently read truth the derivation and evidence consume. */
export type DispatchTruthReads = {
  readonly artifacts: DispatchRead<DispatchArtifactFacts>;
  readonly ledger: DispatchRead<DispatchLedgerFacts>;
  readonly tracker: DispatchRead<DispatchTrackerFacts>;
  readonly ci: DispatchRead<{ readonly verdict: "success" | "failure" }>;
  readonly verifyOutcome: DeliveryResultToken | null;
  /** The independently derived tracker truth token, when one was observed. */
  readonly trackerToken: DeliveryResultToken | null;
  readonly phasesComplete: boolean;
};

/** The admission decision computed before any spawn or resume. */
export type DispatchAdmission =
  | {
      readonly admitted: true;
      readonly resumeMode?: DispatchResumeMode;
      readonly prefillCostAcknowledged?: boolean;
      readonly restarts?: number;
    }
  | {
      readonly admitted: false;
      readonly code:
        | "dispatch.restart-budget-exceeded"
        | "dispatch.resume-uneconomical"
        | "dispatch.state-unverified";
      readonly terminal?: boolean;
      readonly escalation?: string;
      readonly resumeMode?: DispatchResumeMode;
    };

/**
 * The admission preflight refusal.
 *
 * `trustedRefusal` is the narrow marker the CLI classifier honours only for
 * `config.credential.missing`; it lets the bounded credential prose past the
 * untrusted-config suppression. Provider and input refusals carry no marker.
 * The optional projection members are the forwarded credential projection
 * (DEC-14): they ride beside the marker as projection data on the reified
 * refusal.
 */
export type DispatchPreflightError = {
  readonly kind: "input" | "config" | "provider";
  readonly code: string;
  readonly summary?: string;
  readonly trustedRefusal?: true;
  readonly source?: string;
  readonly reason?: CredentialFailureReason;
  readonly remedy?: string;
};

/**
 * The admission preflight result: admitted, or a typed pre-session refusal.
 *
 * Distinct from `DispatchAdmission`: a preflight refusal appends no record and
 * runs before `claimLease`, while an admission refusal still records a pair.
 */
export type DispatchPreflightResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: DispatchPreflightError };

/** The optional admission precondition; production always supplies it. */
export type DispatchPreflightPort = () => Promise<DispatchPreflightResult>;

/**
 * The harness resolution facts the four pre-session harness refusals disclose
 * (GH-335 F-1/F-2, TDR-0041). The composition resolves them once per dispatch.
 */
export type DispatchHarnessFacts = {
  readonly kind: HarnessKind;
  readonly observedVersion: string | null;
  readonly versionVerdict: HarnessVersionVerdict;
  readonly mode: HarnessMode;
  /** The mode origin: the delivered default or a declared value (DEC-2). */
  readonly modeOrigin?: HarnessModeOrigin;
};

/** One pre-session harness admission refusal, classified and recordless. */
export type DispatchHarnessAdmissionError = {
  readonly kind: "harness" | "config" | "provider";
  readonly code: string;
  readonly summary?: string;
  readonly field?: string;
  readonly harness?: CommandFailureHarnessDetail;
};

/** The pre-session harness admission result. */
export type DispatchHarnessAdmissionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: DispatchHarnessAdmissionError };

/**
 * The pre-session harness admission (GH-335 F-1, F-2; NFR-1): evaluated once,
 * before the lease claim and before any session. A refusal appends no attempt
 * record, claims no lease, and writes no telemetry.
 */
export type DispatchHarnessAdmissionPort = () => Promise<DispatchHarnessAdmissionResult>;

/**
 * The pre-session refusal identities that never append an attempt record
 * (GH-335): the four new harness refusals plus the invalid-identity and
 * unassigned-agent refusals the profile path produces.
 */
export const HARNESS_PRESESSION_REFUSAL_CODES = [
  "harness.version.unsupported",
  "harness.version.unknown",
  "harness.mode.unavailable",
  "harness.profile.model-unrepresentable",
  "provider.profile.invalid",
  "config.value.invalid",
] as const;

/**
 * The classified no-nomination refusal (GH-294 F-1, DEC-9; TDR-0028 D2).
 *
 * The refusal carries the resolve identity the provider-profile seam already
 * produced for the exact shape — never a new `dispatch.*` identity — and keeps
 * that identity's delivered exit projection. `unavailable` carries the
 * eligibility list the envelope renders in its refusal detail.
 */
export type DispatchNominationRefusal = {
  readonly code:
    | "provider.profile.absent"
    | "provider.profile.invalid"
    | "provider.profile.capability-denied"
    | "provider.profile.unavailable";
  readonly summary?: string;
  readonly eligibility?: readonly string[];
};

/** The nomination outcome: the admitted profile, or the classified refusal. */
export type DispatchNomination =
  | { readonly ok: true; readonly profile: string }
  | { readonly ok: false; readonly refusal: DispatchNominationRefusal };

/**
 * The nomination gate (TDR-0028 D1/D3): runs immediately after input
 * validation and before the credential preflight, the owner-hold gate, and the
 * lease/single-flight predicates. A refusal is a recordless, eventless,
 * spawnless pre-session refusal; an admission carries the profile that is
 * recorded on the attempt record. Resumes never re-nominate: the port is
 * consulted once per admission, never on the resume path of a recorded lane.
 */
export type DispatchNominatePort = () => DispatchNomination;

/** Everything the one-shot run consumes; every field is injected. */
/**
 * The one provision-after-lease outcome (GH-404 F-2, F-8, DEC-8): either the
 * lane runs in its provisioned worktree (`mode: "worktree"` — the physical
 * path recorded additively on the lane record, DM-1, and applied to the
 * spawn/resume working directory, F-3), or the lane runs in the invoking
 * checkout exactly as today (`mode: "in-checkout"` — the disable-worktrees
 * exception shape and the DEC-8 pre-change context-less shape; no worktree is
 * created or referenced), or the provisioning was refused — final, carrying
 * the step's identity and detail; the engine releases the lease and surfaces
 * it without retrying (NFR-1).
 */
export type DispatchWorktreeProvisioning =
  | {
      readonly ok: true;
      readonly mode: "worktree";
      readonly worktreePath: string;
    }
  | { readonly ok: true; readonly mode: "in-checkout" }
  | { readonly ok: false; readonly code: string; readonly detail: string };

/**
 * The dispatch-owned profile-window watch composition (GH-413 F-1..F-4, F-11;
 * DEC-3, DEC-5, DEC-11, DEC-13, DEC-20; TDR-0077). Absent keeps the delivered
 * one-shot path with no watch byte-for-byte; `lane.disable-peak-pausing` true
 * composes none.
 */
export type DispatchPeakWatchPorts = {
  /** False when `lane.disable-peak-pausing` is true: no automatic stop observation. */
  readonly watchEnabled: boolean;
  readonly rulesFor: (profile: string) => ProviderProfilePeakRules | undefined;
  /** F-16: a fresh rule read at each resume-admission evaluation. */
  readonly resumeRulesFor?: (profile: string) => ProviderProfilePeakRules | undefined;
  readonly zoneFactsFor?: (zone: string) => ProviderZoneFacts | undefined;
  readonly parks: () => readonly QueueParkRecord[];
  /** `recoverQueueParks` bound over the composition's park context. */
  readonly recoverParks: () =>
    | { readonly ok: true }
    | {
        readonly ok: false;
        readonly kind: "queue" | "state";
        readonly code: string;
        readonly stuck?: readonly string[];
      };
  /** An un-expired standing peak-window park blocks a resume/re-dispatch at admission. */
  readonly unexpiredStandingPark: (
    ref: string,
  ) => { readonly cause: string; readonly until?: string } | undefined;
  readonly stop: (input: {
    readonly handle?: HarnessSessionHandle;
    readonly sessionId?: string;
    readonly graceMs: number;
  }) => Promise<QueueParkPreservation | { readonly confirmed: false }>;
  readonly appendPark: (record: QueueParkRecord) => boolean;
  readonly appendRecovery: (record: QueueParkRecord) => boolean;
  readonly holdActive: () => boolean;
  readonly newEpisodeId: (ref: string) => string;
  readonly branch: () => string;
  readonly resumeSession: (input: {
    readonly sessionRef: string;
    readonly branch: string;
  }) => Promise<boolean>;
  readonly reenter: (input: { readonly ref: string; readonly ordinal: number }) => Promise<boolean>;
  readonly restartCount: (ref: string) => number;
  readonly restartBound: () => number;
  readonly economics: (ref: string) => {
    readonly prefillCost: number | null;
    readonly uniqueProgress: number | null;
  };
  /** F-5a: production admits the automatic recovery by the restart budget only. */
  readonly recoveryAdmission?: "budget-only" | "budget-and-economics";
  readonly escalate: (input: {
    readonly code: string;
    readonly ref: string;
    readonly restarts: number;
  }) => void;
};

export type DispatchPorts = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly harness: HarnessSessionPort;
  readonly harnessKind: HarnessKind;
  readonly descriptor: HarnessExecutionEnvironmentDescriptor;
  readonly prompt: string;
  readonly ref: string;
  readonly evidenceClass: DispatchEvidenceClass;
  readonly repository: string;
  readonly handoverState: DispatchHandoverState;
  readonly nowIso: () => string;
  /**
   * The nomination gate (GH-294 F-1, TDR-0028): the first admission predicate.
   * Absent keeps the delivered no-nomination behavior for pre-change suites.
   */
  readonly nominate?: DispatchNominatePort;
  readonly newAttemptId: () => string;
  readonly newDivergenceId: () => string;
  readonly readTruth: () => Promise<DispatchTruthReads>;
  readonly claimLease: () => DispatchLeaseClaim | Promise<DispatchLeaseClaim>;
  readonly releaseLease: (cause: "completed" | "aborted", expectedHeartbeatAt?: string) => boolean;
  /**
   * The run-path lease renewal (GH-413 DEC-13, DM-9): the delivered same-holder
   * `renewed` arm keyed on the invocation's own last heartbeat write. Absent
   * keeps the delivered no-renewal one-shot path byte-for-byte.
   */
  readonly renewLease?: (input: {
    readonly ref: string;
    readonly repository: string;
    readonly expectedHeartbeatAt: string;
  }) => DispatchLeaseRenewalOutcome | Promise<DispatchLeaseRenewalOutcome>;
  /** The resolved `queue.lease-ttl` the renewal cadence derives from. */
  readonly leaseTtlMs?: number;
  /**
   * The dispatch-owned window watch (GH-413 F-1..F-4). Absent keeps the
   * delivered one-shot path; the production composition supplies it unless
   * `lane.disable-peak-pausing` is true.
   */
  readonly peak?: DispatchPeakWatchPorts;
  readonly phaseLedger: DispatchPhaseLedger;
  /**
   * The admission precondition: resolves the truth-read credential and performs
   * one bounded read. It runs after harness/input validation and before
   * `claimLease`, spawn, or resume, and appends no record of its own.
   */
  readonly preflight?: DispatchPreflightPort;
  readonly admission?: () => DispatchAdmission;
  readonly initialRestarts?: number;
  readonly restartBudget?: number;
  readonly livenessIntervalMs?: number;
  /**
   * The cancellable cadence wait the watcher polls on while `collect` is
   * pending. Composition supplies the real timer; a test supplies a fake.
   */
  readonly waitForCadence?: (cadenceMs: number) => DispatchCadenceWait;
  /**
   * The delivered terminal exhaustion append (`ensureEconomicsExhaustionRecord`)
   * invoked when restart admission refuses. Absent leaves the refusal recorded
   * without a terminal record; the composition owns the state write.
   */
  readonly ensureRestartExhaustion?: (input: DispatchExhaustionRequest) => boolean;
  readonly resumeAmplification?: string;
  readonly existingHandle?: HarnessSessionHandle;
  readonly resumePrompt?: string;
  readonly resumeMode?: DispatchResumeMode;
  readonly prefillCostAcknowledged?: boolean;
  /** The caller-supplied agent identity for this run (DEC-16); absent is role-less. */
  readonly harnessAgent?: string;
  /** The composition-resolved single-seat binding for this run (TDR-0040 A-4). */
  readonly harnessBinding?: HarnessSeatBinding;
  /**
   * The fresh-spawn title, supplied as a COMPOSITION fact (GH-347 DM-6,
   * TDR-0054). A role-less composition supplies none, so it stays role-less; a
   * resume never carries one.
   */
  readonly freshTitle?: string;
  /**
   * The advisory lane owner facts (GH-347 DM-1, TDR-0049): the composition's
   * process id and the declared start instant. Absent keeps the lane write off
   * (a direct composition that never gained a lane), never a fabricated owner.
   */
  readonly laneOwner?: {
    readonly processId: number;
    readonly startedAt: string;
  };
  /**
   * The resolved harness facts, read lazily: the admission writes them for the
   * run in flight, so a pre-session refusal discloses them and a success records
   * them on the attempt (GH-335 F-1/F-2, TDR-0041).
   */
  readonly harnessFacts?: () => DispatchHarnessFacts | undefined;
  /**
   * The one injected delay fact (GH-347 AC-F9-2, NFR-11). The admission fence
   * wait, the tracker ladder, and the terminate grace all go through it, so the
   * offline battery supplies a recorder and never waits on a wall clock.
   */
  readonly delay?: DispatchDelay;
  /** The pre-session harness admission; runs before the lease claim (NFR-1). */
  readonly harnessAdmission?: DispatchHarnessAdmissionPort;
  /**
   * The provision-after-lease port (GH-404 F-2, TC-WT-003): invoked exactly
   * once after the repository lease is claimed and before any phase, spawn, or
   * session, so the lease-first order is the engine's own sequence (NG-2).
   * Absent keeps the delivered in-checkout behaviour byte-for-byte — the
   * disable-worktrees exception shape (F-8, DEC-8); the escape hatch can never
   * lag the default because both bind at this one seam. A refusal is final:
   * the lease is released and the refusal surfaces — zero retries, zero
   * fallbacks, zero overrides (NFR-1).
   */
  readonly provisionWorktree?: () =>
    | DispatchWorktreeProvisioning
    | Promise<DispatchWorktreeProvisioning>;
  /**
   * The borrowed terminate grace (GH-347 DEC-4): `coordinator.kill-grace`
   * (20 000 ms default), reused rather than duplicated.
   */
  readonly killGraceMs?: number;
  /**
   * The delivered `economics.restart` append (GH-347 F-6): one record per
   * consumed ordinal with reason `watchdog.liveness-stalled`. Absent leaves the
   * ordinal consumed with no record; the composition owns the state write.
   */
  readonly appendRestart?: (input: {
    readonly ref: string;
    readonly runId: string;
    readonly sessionId: string;
    readonly ordinal: number;
    readonly reason: "watchdog.liveness-stalled" | "session-interrupted";
    readonly recordedAt: string;
  }) => boolean;
  /**
   * The one injected ensure-push capability (GH-386 F-1, DEC-1): post-session
   * and pre-classification, composed at the production edge over the adapters
   * push seam. Absent keeps the delivered no-act behavior for a composition
   * that declares no act (the daemon lane and pre-change compositions).
   */
  readonly pushParity?: DispatchPushParityPort;
};

/** The run result: classified data, or a pre-session/state refusal. */
export type DispatchRunResult =
  | {
      readonly ok: true;
      readonly data: DispatchEnvelopeData;
      readonly attempt: DispatchAttemptRecord;
      readonly projectionClass: ProjectionClass;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: "input" | "queue" | "state" | "harness" | "dispatch" | "provider" | "config";
        readonly code: string;
        readonly summary?: string;
        /** The live lease's holder on a `queue.single-flight` refusal (TDR-0027). */
        readonly holder?: string;
        /** The eligibility list on a `provider.profile.unavailable` nomination refusal (GH-294, TDR-0027 detail). */
        readonly eligibility?: readonly string[];
        /** The narrow credential-refusal marker; set only for `config.credential.missing`. */
        readonly trustedRefusal?: true;
        /**
         * The forwarded credential projection (DEC-14): the three fields ride
         * beside the marker as projection data on the reified refusal.
         */
        readonly source?: string;
        readonly reason?: CredentialFailureReason;
        readonly remedy?: string;
        /** The four pre-session harness facts (TDR-0041); the four refusals only. */
        readonly harness?: CommandFailureHarnessDetail;
      };
    };

/**
 * Map one pre-session refusal identity to its disclosed harness facts.
 *
 * Only the four new identities carry the member; the reused
 * `provider.profile.invalid` and the invalid-identity `config.value.invalid`
 * carry none (TDR-0040 A-2, TDR-0041).
 */
const isAdmissionRefusalCode = (
  code: string,
): code is
  | "dispatch.restart-budget-exceeded"
  | "dispatch.resume-uneconomical"
  | "dispatch.state-unverified" =>
  code === "dispatch.restart-budget-exceeded" ||
  code === "dispatch.resume-uneconomical" ||
  code === "dispatch.state-unverified";

export const harnessRefusalDetail = (
  code: string,
  facts: DispatchHarnessFacts | undefined,
): CommandFailureHarnessDetail | undefined => {
  if (facts === undefined) return undefined;
  switch (code) {
    case "harness.version.unsupported":
      return {
        kind: facts.kind,
        observedVersion: facts.observedVersion,
        versionVerdict: "outside",
      };
    case "harness.version.unknown":
      return { kind: facts.kind, observedVersion: null, versionVerdict: "indeterminate" };
    case "harness.mode.unavailable":
      return {
        kind: facts.kind,
        observedVersion: facts.observedVersion,
        versionVerdict: "inside",
        mode: facts.mode,
      };
    case "harness.profile.model-unrepresentable":
      return {
        kind: facts.kind,
        observedVersion: facts.observedVersion,
        versionVerdict: "inside",
        mode: facts.mode,
      };
    default:
      return undefined;
  }
};

const projectionOf = (value: DispatchToken): ProjectionClass => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === value);
  if (row === undefined) throw new Error("delivery-result token is not in the taxonomy");
  return row.projectionClass;
};

/** Bound, single-line, secret-free `last_message` (NFR-4, NFR-7). */
export const boundLastMessage = (message: string): string => {
  const single = message.replace(/[\r\n]+/gu, " ").trim();
  return single.length <= DISPATCH_MAX_LAST_MESSAGE_CHARS
    ? single
    : `${single.slice(0, DISPATCH_MAX_LAST_MESSAGE_CHARS)}…[truncated]`;
};

const errorOf = (derivation: {
  readonly lastMessage: string;
  readonly errorCode: string;
  readonly detail?: NonNullable<DispatchEnvelopeError["detail"]>;
}): NonNullable<DispatchEnvelopeData["error"]> => {
  const stateFailure = derivation.errorCode === "dispatch.state-unverified";
  return {
    code: derivation.errorCode,
    category: stateFailure ? "platform" : "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: stateFailure
      ? "Repair the named unreadable read and re-run the dispatch; a verdict requires readable truth."
      : "Resolve the named dispatch condition and retry; the attempt was recorded.",
    summary: boundLastMessage(derivation.lastMessage),
    ...(derivation.detail === undefined ? {} : { detail: derivation.detail }),
  };
};

/** The completed harness outcome; delivered evidence is evaluated at record time. */
const COMPLETED_OUTCOME = HARNESS_OUTCOMES[0];

/**
 * Build the envelope error from the declared table row. Used when the delivered
 * attempt must name an underlying state identity other than its derived token.
 */
const errorFromTable = (
  code: string,
  lastMessage: string,
): NonNullable<DispatchEnvelopeData["error"]> => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  if (row === undefined) return errorOf({ lastMessage, errorCode: code });
  return {
    code: row.code,
    category: row.category,
    retryable: row.retryable,
    consequence: row.consequence,
    remediationHint: row.remediationHint,
    summary: boundLastMessage(lastMessage),
  };
};

/**
 * Delivered evidence (F-4.1): the shared classifier outcome is `completed` at
 * record time and the phase ledger is readable with progress or a complete
 * total. The persisted attempt outcome is never an input.
 */
const isDeliveredEvidence = (input: {
  readonly outcome: HarnessOutcome;
  readonly ledger: DispatchRead<DispatchLedgerFacts>;
}): boolean => {
  if (input.outcome !== COMPLETED_OUTCOME) return false;
  if (!input.ledger.ok) return false;
  return (
    input.ledger.value.progressed ||
    (input.ledger.value.total > 0 && input.ledger.value.completed === input.ledger.value.total)
  );
};

/**
 * The failing read family of the delivered closed read set.
 *
 * Only `tracker` and `artifact` are reachable here: `isDeliveredEvidence`
 * already requires a readable ledger, and the derivation yields
 * `state-unverified` only from an unreadable ledger, tracker, or artifact read.
 * A `ci`-only failure is not a truth-read family (the spec forbids a `ci`
 * reason), so it contributes no reference instead of being mislabelled.
 */
const unreadableTruthReason = (reads: DispatchTruthReads): "tracker" | "artifact" | undefined => {
  if (!reads.tracker.ok) return "tracker";
  if (!reads.artifacts.ok) return "artifact";
  return undefined;
};

/** The delivered-evidence divergence shape used for per-work-item dedupe. */
const isDeliveredEvidenceDivergence = (
  record: {
    readonly state: string;
    readonly comparisonClass: string;
    readonly engineToken: string;
    readonly comparisonToken: string | null;
    readonly repository: string;
    readonly ref: string;
  },
  repository: string,
  ref: string,
): boolean =>
  record.state === "open" &&
  record.comparisonClass === "not-applicable" &&
  record.engineToken === su &&
  record.comparisonToken === null &&
  record.repository === repository &&
  record.ref === ref;

/**
 * The additive bounded detail for the pre-session spawn failure (DM-3, NFR-6):
 * identifiers only, single-line, and clamped to `DISPATCH_MAX_ERROR_DETAIL_CHARS`.
 */
const detailOf = (failure: HarnessFailure): NonNullable<DispatchEnvelopeError["detail"]> => {
  const singleLine = (value: string): string => value.replace(/[\r\n]+/gu, " ").trim();
  // The attempt-stage detail slot keeps its delivered two-value kind; a provider
  // identity reaches only the pre-session path, which carries no detail member.
  const kind: "harness" | "config" = failure.kind === "harness" ? "harness" : "config";
  let code = singleLine(failure.code);
  let field = failure.field === undefined ? undefined : singleLine(failure.field);
  const size = (): number =>
    JSON.stringify({ kind, code, ...(field === undefined ? {} : { field }) }).length;
  while (size() > DISPATCH_MAX_ERROR_DETAIL_CHARS && field !== undefined && field.length > 0) {
    field = field.slice(0, -1);
  }
  if (field !== undefined && field.length === 0) field = undefined;
  while (size() > DISPATCH_MAX_ERROR_DETAIL_CHARS && code.length > 0) {
    code = code.slice(0, -1);
  }
  return { kind, code, ...(field === undefined ? {} : { field }) };
};

const comparisonFor = (input: {
  readonly token: DispatchToken;
  readonly errorCode?: string;
  readonly reads: DispatchTruthReads;
  readonly urlResolved: boolean;
}) => {
  switch (input.errorCode) {
    case "dispatch.state-unverified":
    case "dispatch.session.spawn-failed":
    case "dispatch.resume-uneconomical":
      return buildComparisonRecord({
        kind: "dispatch-derived-failure",
        engineToken: f,
        reason: "comparison-source-unavailable",
      });
    case "dispatch.restart-budget-exceeded":
      return buildComparisonRecord({
        kind: "not-applicable",
        engineToken: mr,
        reason: "dispatch-session-family",
      });
    default:
      break;
  }
  const family = dispatchFamilyOf(input.token);
  if (family === "tracker-pr") {
    const independent = input.reads.trackerToken ?? (input.token === pou ? po : input.token);
    return buildComparisonRecord({
      kind: "tracker-truth",
      engineToken: input.token,
      trackerToken: independent,
      urlResolved: input.urlResolved,
    });
  }
  if (family === "verify") {
    return input.token === su
      ? buildComparisonRecord({
          kind: "dispatch-derived-failure",
          engineToken: f,
          reason: "comparison-source-unavailable",
        })
      : buildComparisonRecord({
          kind: "verify-change",
          engineToken: input.token,
          ledgerOutcome: input.reads.verifyOutcome,
        });
  }
  return buildComparisonRecord({
    kind: "not-applicable",
    engineToken: input.token,
    reason: "dispatch-session-family",
  });
};

const staleReads = (): DispatchTruthReads => ({
  artifacts: { ok: false, reason: "artifact" },
  ledger: { ok: false, reason: "ledger" },
  tracker: { ok: false, reason: "tracker" },
  ci: { ok: false, reason: "state" },
  verifyOutcome: null,
  trackerToken: null,
  phasesComplete: false,
});

/**
 * Append the delivered terminal exhaustion record through the composition's
 * state seam and name the evidence reference honestly: an absent or failed
 * append is recorded as unrecorded, never claimed as landed.
 */
const ensureExhaustion = (
  ports: DispatchPorts,
  runId: string,
  restarts: number,
  recordedAt: string,
): string => {
  const ensured =
    ports.ensureRestartExhaustion?.({
      ref: ports.ref,
      runId,
      restarts,
      recordedAt,
    }) ?? false;
  return ensured ? "economics:exhaustion" : "economics:exhaustion-unrecorded";
};

/** The corroboration facts derived from the truth reads (AC-F4-4). */
const corroborationFactsOf = (reads: DispatchTruthReads): CorroborationFacts => ({
  "pm-notes": reads.ledger.ok ? (reads.phasesComplete ? "satisfied" : "unsatisfied") : "unreadable",
  tracker: reads.tracker.ok ? "satisfied" : "unreadable",
  ci: reads.ci.ok
    ? reads.ci.value.verdict === "success"
      ? "satisfied"
      : "unsatisfied"
    : "unreadable",
});

/**
 * The adapter's own terminate-capability declaration (GH-347 F-5, DM-5,
 * AC-F5-4).
 *
 * A session port that carries a capability declaration is authoritative: an
 * absent `terminate` operation means the engine starts no second session. A
 * port that declares nothing keeps the delivered restart behaviour — the
 * default direction is never "incapable", which would silently stop restarting
 * on a capable adapter. That fail-open default is reachable only by an
 * explicitly undeclared double: every production adapter declares on its port
 * and the production composition never mounts an undeclared port, held by the
 * adapter-port declaration suite and the dispatch-composition wiring suite.
 */
const declaresTerminate = (port: HarnessSessionPort): boolean => {
  const operations = port.capabilities?.supportedOperations;
  return operations === undefined ? true : operations.includes("terminate");
};

/** Map the harness liveness report into the dispatch liveness readings. */
const livenessReadings = (
  readings: readonly {
    readonly kind: "session-traffic" | "worktree-activity" | "process";
    readonly status: "sourced" | "absent";
    readonly value?: number;
    readonly reason?: string;
  }[],
): readonly DispatchLivenessReading[] =>
  readings.map((reading) => {
    const signal =
      reading.kind === "session-traffic"
        ? ("session-traffic" as const)
        : reading.kind === "worktree-activity"
          ? ("worktree-activity" as const)
          : ("token-delta" as const);
    if (reading.status === "sourced") {
      return { signal, status: "sourced" as const, value: reading.value ?? 0 };
    }
    return {
      signal,
      status: "absent" as const,
      reason: reading.reason === "harness-unsupported" ? "harness-unsupported" : "not-observed",
    };
  });

/**
 * Run one dispatch.
 *
 * A pre-session refusal (conflicting lease before a spawn) returns an error and
 * appends no attempt record. A spawn failure, a spawn refusal, a post-spawn
 * `collect` failure, and an unverifiable truth read are attempt-stage outcomes:
 * they append exactly one attempt record and return a classified envelope.
 */
export const runDispatch = async (ports: DispatchPorts): Promise<DispatchRunResult> => {
  // Nomination gate (GH-294 F-1, TDR-0028 D1): the first admission predicate —
  // before the credential preflight, the owner-hold gate, and the lease claim.
  // A refusal here is pre-session: no lease, attempt, lane, or queue record, no
  // event, no spawn.
  let nomination: { readonly profile: string } | undefined;
  if (ports.nominate !== undefined) {
    const nominated = ports.nominate();
    if (!nominated.ok) {
      return {
        ok: false,
        error: {
          kind: "provider",
          code: nominated.refusal.code,
          ...(nominated.refusal.summary === undefined
            ? {}
            : { summary: nominated.refusal.summary }),
          ...(nominated.refusal.eligibility === undefined
            ? {}
            : { eligibility: nominated.refusal.eligibility }),
        },
      };
    }
    nomination = { profile: nominated.profile };
  }

  // Admission precondition: a refusal here is pre-session. It runs before the
  // lease claim and before any spawn, resume, attempt, or divergence record.
  if (ports.preflight !== undefined) {
    const preflight = await ports.preflight();
    if (!preflight.ok) return { ok: false, error: preflight.error };
  }

  // The harness admission (GH-335 F-1/F-2, NFR-1): the version gate and the
  // mode availability are evaluated once, before the lease claim and before any
  // session-bearing child process. A refusal claims no lease, appends no
  // attempt record, and writes no telemetry.
  if (ports.harnessAdmission !== undefined) {
    const admitted = await ports.harnessAdmission();
    if (!admitted.ok) {
      return {
        ok: false,
        error: {
          kind: admitted.error.kind,
          code: admitted.error.code,
          ...(admitted.error.summary === undefined ? {} : { summary: admitted.error.summary }),
          ...(admitted.error.field === undefined ? {} : { field: admitted.error.field }),
          ...(admitted.error.harness === undefined ? {} : { harness: admitted.error.harness }),
        },
      };
    }
  }

  // GH-413 DEC-22, AC-F3-4: an un-expired standing peak-window park is a
  // pre-session refusal at resume/re-dispatch admission, beside the other
  // admission refusals and before any session, lease claim, or record. It
  // writes nothing; `lanes` and `board` keep showing the lane parked.
  if (ports.peak !== undefined) {
    const standing = ports.peak.unexpiredStandingPark(ports.ref);
    if (standing !== undefined) {
      return {
        ok: false,
        error: {
          kind: "dispatch",
          code: "dispatch.resume-parked",
          summary: `standing ${standing.cause} park${
            standing.until === undefined ? "" : ` until ${standing.until}`
          }; resume after it ends`,
        },
      };
    }
  }

  const claimed = await ports.claimLease();
  if (!claimed.ok) {
    return {
      ok: false,
      error: {
        // The claim's declared kind is preserved (GH-347 AC-F2-3): a state
        // failure stays `state` at exit 2 and is never relabelled `queue`.
        kind: claimed.kind ?? "queue",
        code: claimed.code,
        ...(claimed.summary === undefined ? {} : { summary: claimed.summary }),
        ...(claimed.holder === undefined ? {} : { holder: claimed.holder }),
      },
    };
  }

  let releaseCause: "completed" | "aborted" = "aborted";
  let leaseHeartbeatAt = claimed.heartbeatAt;
  let leaseLost = false;
  let leaseRenewalFailure: string | undefined;
  let peakEpisode: DispatchEpisodeFact | undefined;
  let pendingRecovery: QueueParkRecord | undefined;
  let pendingResumeAt: string | undefined;
  let pendingPreservation: "preserved" | "session-state-not-preserved" | undefined;
  let peakRecoveryAppendFailed = false;
  /** The one episode sentence appended to the delivered summary (GH-413 DM-5). */
  const episodeSummary = (): string => {
    if (peakEpisode === undefined) return "";
    const base = ` (${peakEpisode.cause}: paused until ${peakEpisode.until}`;
    if (peakEpisode.refusal !== undefined) {
      return `${base}; recovery refused: ${peakEpisode.refusal})`;
    }
    if (peakEpisode.resumedAt !== undefined) {
      return `${base}; resumed at ${peakEpisode.resumedAt})`;
    }
    return `${base})`;
  };
  let lastRenewalAtMs =
    claimed.heartbeatAt === undefined
      ? Date.parse(ports.nowIso())
      : Date.parse(claimed.heartbeatAt);
  const renewalCadenceMs = dispatchRenewalCadenceMs(
    ports.livenessIntervalMs ?? 30_000,
    ports.leaseTtlMs ?? 90_000,
  );
  /**
   * Renew at most once per renewal cadence through the delivered path
   * (DEC-13): a no-op when the live lease's latest heartbeat is not this
   * invocation's own last write, and never an acquire, takeover, or displace.
   */
  const maybeRenewLease = async (): Promise<void> => {
    const renew = ports.renewLease;
    if (renew === undefined || leaseHeartbeatAt === undefined || leaseLost) return;
    const nowMs = Date.parse(ports.nowIso());
    if (!Number.isFinite(nowMs)) return;
    if (Number.isFinite(lastRenewalAtMs) && nowMs - lastRenewalAtMs < renewalCadenceMs) return;
    lastRenewalAtMs = nowMs;
    const outcome = await renew({
      ref: ports.ref,
      repository: ports.repository,
      expectedHeartbeatAt: leaseHeartbeatAt,
    });
    if (outcome.ok) {
      leaseHeartbeatAt = outcome.heartbeatAt;
      return;
    }
    if ("result" in outcome) {
      leaseLost = true;
      return;
    }
    // A renewal failure is retried at the next cadence and surfaced as bounded
    // lease evidence; the run does not silently continue on a stale lease.
    leaseRenewalFailure = outcome.code;
  };
  try {
    // The lane's worktree provisioning (GH-404 F-2, TC-WT-003): strictly after
    // the lease claim — the lease-first order is this engine's own sequence
    // (NG-2) — and before the first phase, spawn, or session. Absent keeps the
    // in-checkout shape byte-for-byte (F-8); a refusal releases the lease and
    // surfaces as a refusal, never a retry or fallback (NFR-1).
    const provisioned =
      ports.provisionWorktree === undefined ? undefined : await ports.provisionWorktree();
    if (provisioned !== undefined && !provisioned.ok) {
      return {
        ok: false,
        error: {
          kind: "dispatch",
          code: "dispatch.session.spawn-failed",
          summary: `the lane worktree could not be provisioned (${provisioned.code}): ${provisioned.detail}`,
        },
      };
    }
    const provisionedWorktree =
      provisioned === undefined || !provisioned.ok || provisioned.mode !== "worktree"
        ? undefined
        : provisioned;
    const laneWorktreePath = provisionedWorktree?.worktreePath;
    // The worktree-scoped descriptor (GH-404 F-3): a provisioned lane's
    // working directory IS its worktree, for the fresh spawn and every restart
    // resume. Absent keeps the delivered descriptor byte-for-byte (F-8).
    const laneDescriptor =
      provisionedWorktree === undefined
        ? ports.descriptor
        : { ...ports.descriptor, workDirectory: provisionedWorktree.worktreePath };
    const now = ports.nowIso();
    const attemptId = ports.newAttemptId();
    let restarts = ports.initialRestarts ?? 0;
    // The persisted total after this dispatch (the recorded count plus the
    // ordinals this invocation consumes); the envelope reports it.
    const persistedRestarts = restarts;
    let laneAppendFailed = false;
    // The 1-based iteration ordinal within this dispatch; phase 5 increments it
    // per consumed restart.
    let iterationOrdinal = 1;
    /**
     * The stalled iterations' liveness/termination evidence, carried forward so
     * a restarted stall stays durable on the terminal attempt (GH-347 F-5,
     * AC-F5-1, §10).
     */
    const carriedStallRefs: string[] = [];
    let heldSession: HarnessSessionHandle | undefined;
    const budget = ports.restartBudget ?? 0;
    let resumeMode = ports.resumeMode;
    let prefillCostAcknowledged = ports.prefillCostAcknowledged;
    // The one session identity this attempt held, set by a successful
    // spawn/resume (GH-335 DM-8). A pre-session refusal leaves it unset.
    let heldSessionId: string | undefined;

    const record = (input: {
      readonly token: DispatchToken;
      readonly outcome: DispatchAttemptRecord["outcome"];
      readonly errorCode?: string;
      /** An identity the envelope must name instead of the derived token's row. */
      readonly envelopeErrorCode?: string;
      readonly comparison: DispatchAttemptRecord["comparison"];
      readonly corroboration: DispatchAttemptRecord["corroboration"];
      readonly falseSuccess: boolean;
      readonly prUrl: string;
      readonly urlResolved: boolean;
      readonly lastMessage: string;
      readonly evidenceRefs: readonly string[];
      /** A disclosure reference reserved ahead of the 16-slice (GH-386 DM-1). */
      readonly pushRef?: string;
      /** The additive optional envelope push block (GH-386 DM-2). */
      readonly push?: DispatchEnvelopePushBlock;
      readonly divergenceRef?: string;
      readonly detail?: NonNullable<DispatchEnvelopeError["detail"]>;
    }): DispatchRunResult => {
      // The terminal lane record (GH-347 AC-F1-2): appended only when this
      // dispatch held a session, and never rewritten. A failed append leaves
      // the token unchanged and is disclosed as bounded evidence (AC-F1-3).
      if (heldSession !== undefined && ports.laneOwner !== undefined && !leaseLost) {
        const terminal = appendDispatchLane(ports.store, ports.fenceToken, {
          schema: DISPATCH_LANE_PAYLOAD_SCHEMA,
          ref: ports.ref,
          repository: ports.repository,
          attemptId,
          sessionId: heldSession.sessionId,
          harnessKind: ports.harnessKind,
          owner: ports.laneOwner,
          iterationOrdinal,
          restartsConsumed: restarts - persistedRestarts,
          state: "terminal",
          ...(laneWorktreePath === undefined ? {} : { worktreePath: laneWorktreePath }),
          lastToken: input.token,
          lastOutcome: input.outcome,
          recordedAt: now,
        });
        if (!terminal.ok) laneAppendFailed = true;
      }
      // Disclosure refs are RESERVED ahead of the 16-slice (GH-347 AC-F1-3,
      // NFR-7): a resumability disclosure is never silently truncated away.
      // GH-386 joins the push parity verdict to the same reservation, beside
      // the lane-append disclosure, so parity evidence is never truncated.
      const attemptEvidenceRefs = [
        ...(laneAppendFailed ? ["lane:append-failed"] : []),
        ...(leaseLost ? ["lease:not-owned"] : []),
        ...(leaseRenewalFailure === undefined ? [] : ["lease:renewal-failed"]),
        ...(peakRecoveryAppendFailed ? ["park:recovery-append-failed"] : []),
        ...(input.pushRef === undefined ? [] : [input.pushRef]),
        ...input.evidenceRefs,
      ].slice(0, DISPATCH_MAX_EVIDENCE_REFS);
      const attempt: DispatchAttemptRecord = {
        schema: DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
        attemptId,
        repository: ports.repository,
        ref: ports.ref,
        harness: ports.harnessKind,
        evidenceClass: ports.evidenceClass,
        startedAt: now,
        finishedAt: now,
        handoverState: ports.handoverState,
        outcome: input.outcome,
        token: input.token,
        comparison: input.comparison,
        ...(input.divergenceRef === undefined ? {} : { divergenceRef: input.divergenceRef }),
        falseSuccess: input.falseSuccess,
        corroboration: input.corroboration,
        ...(resumeMode === undefined ? {} : { resumeMode }),
        ...(prefillCostAcknowledged === undefined ? {} : { prefillCostAcknowledged }),
        ...(nomination === undefined ? {} : { providerProfile: nomination.profile }),
        ...(heldSessionId === undefined ? {} : { sessionIds: [heldSessionId] }),
        ...(ports.harnessBinding === undefined ? {} : { binding: ports.harnessBinding }),
        // GH-335 F-1/F-2: the recorded outcome facts this run actually holds.
        ...(ports.harnessFacts === undefined
          ? {}
          : (() => {
              const facts = ports.harnessFacts?.();
              if (facts === undefined) return {};
              return {
                harnessVersion: facts.observedVersion,
                versionVerdict: facts.versionVerdict,
                mode: facts.mode,
                ...(facts.modeOrigin === undefined ? {} : { modeOrigin: facts.modeOrigin }),
              };
            })()),
        evidenceRefs: attemptEvidenceRefs,
        recordedAt: now,
      };
      const appended = appendDispatchAttempt(ports.store, ports.fenceToken, attempt);
      if (!appended.ok) {
        return { ok: false, error: { kind: "state", code: appended.code } };
      }
      const data: DispatchEnvelopeData = {
        result: input.token,
        prUrl: input.prUrl,
        phaseLedger: ports.phaseLedger,
        restarts,
        resumeAmplification: ports.resumeAmplification ?? "none",
        harness: ports.harnessKind,
        handoverState: ports.handoverState,
        outcome: input.outcome,
        ...(input.errorCode === undefined
          ? {}
          : {
              error:
                input.envelopeErrorCode === undefined
                  ? errorOf({
                      lastMessage: input.lastMessage,
                      errorCode: input.errorCode,
                      ...(input.detail === undefined ? {} : { detail: input.detail }),
                    })
                  : {
                      ...errorFromTable(input.envelopeErrorCode, input.lastMessage),
                      ...(input.detail === undefined ? {} : { detail: input.detail }),
                    },
            }),
        lastMessage: boundLastMessage(`${input.lastMessage}${episodeSummary()}`),
        ...(input.push === undefined ? {} : { push: input.push }),
        ...(peakEpisode === undefined ? {} : { episode: peakEpisode }),
      };
      releaseCause = "completed";
      return { ok: true, data, attempt, projectionClass: projectionOf(input.token) };
    };

    if (ports.admission !== undefined) {
      let admission: DispatchAdmission;
      try {
        admission = ports.admission();
      } catch {
        admission = { admitted: false, code: "dispatch.state-unverified" };
      }
      if (!admission.admitted) {
        const pair = admissionRefusalPair(admission.code);
        if (admission.resumeMode !== undefined) resumeMode = admission.resumeMode;
        const reads = staleReads();
        const exhaustionRef =
          admission.code === "dispatch.restart-budget-exceeded"
            ? ensureExhaustion(ports, ports.existingHandle?.sessionId ?? attemptId, restarts, now)
            : undefined;
        return record({
          token: pair.token,
          outcome: pair.outcome,
          errorCode: admission.code,
          comparison: comparisonFor({
            token: pair.token,
            errorCode: admission.code,
            reads,
            urlResolved: false,
          }),
          corroboration: buildCorroborationRecord({ token: pair.token }),
          falseSuccess: false,
          prUrl: "",
          urlResolved: false,
          lastMessage:
            admission.code === "dispatch.restart-budget-exceeded"
              ? `restart budget exhausted at ${restarts} of ${budget}`
              : admission.code === "dispatch.resume-uneconomical"
                ? "resume refused: the prefill re-pay is uneconomical"
                : "resume admission could not read its token or cost facts",
          evidenceRefs:
            admission.terminal === true
              ? [exhaustionRef ?? "economics:exhaustion"]
              : [`attempt:${attemptId}`],
        });
      }
      if (admission.resumeMode !== undefined) resumeMode = admission.resumeMode;
      if (admission.prefillCostAcknowledged !== undefined) {
        prefillCostAcknowledged = admission.prefillCostAcknowledged;
      }
      if (admission.restarts !== undefined) restarts = admission.restarts;
    }

    // GH-347 F-6, DEC-5, TDR-0052 — the in-process bounded loop. One dispatch
    // owns one or more iterations; a clean session exit is ALWAYS terminal, and
    // only a corroborated liveness stall or a harness-reported timeout is
    // restart-eligible. Each restarted iteration appends its active lane record
    // and one `economics.restart`, never an attempt record.
    // GH-413 F-3, DEC-23: before the first stop decision, close any standing
    // peak-window park through the delivered mutating park pass. An expired,
    // orphaned, refused, or budget-exhausted park is recovered; the pass only
    // ever meets an expired park or none because an un-expired one was refused
    // at admission. A pass that cannot recover refuses the run with no new
    // episode and no park written.
    if (ports.peak !== undefined) {
      const recovery = ports.peak.recoverParks();
      if (!recovery.ok) {
        const reads = staleReads();
        return record({
          token: su,
          outcome: O_FAILED,
          errorCode: recovery.code,
          comparison: comparisonFor({
            token: su,
            errorCode: recovery.code,
            reads,
            urlResolved: false,
          }),
          corroboration: buildCorroborationRecord({ token: su }),
          falseSuccess: false,
          prUrl: "",
          urlResolved: false,
          lastMessage: `the standing park could not be recovered (${recovery.code})${
            recovery.stuck === undefined || recovery.stuck.length === 0
              ? ""
              : `; stuck: ${recovery.stuck.join(", ")}`
          }`,
          evidenceRefs: ["park:recovery-refused"],
        });
      }
    }

    let handle: HarnessSessionHandle | undefined = ports.existingHandle;
    let spawnPrompt: string | undefined = ports.resumePrompt;
    for (let iteration = 1; ; iteration += 1) {
      iterationOrdinal = iteration;
      const session = await (async () => {
        const propagation = {
          ...(ports.harnessAgent === undefined ? {} : { agent: ports.harnessAgent }),
          ...(ports.harnessBinding === undefined ? {} : { binding: ports.harnessBinding }),
        };
        if (handle !== undefined) {
          // A restart resumes the recorded session (a fresh spawn only when no
          // session was ever recorded). An operator resume keeps its text; an
          // automatic restart re-enters with the lifecycle prompt.
          return ports.harness.resume({
            handle,
            prompt: ports.resumePrompt ?? ports.prompt,
            descriptor: laneDescriptor,
            streamContext: { attemptId, iterationOrdinal },
            ...propagation,
          });
        }
        // A supplied resume prompt over "no lane" is an EXPLICIT fresh spawn
        // with the operator's text (GH-347 AC-F3-3), never a fabricated resume.
        return ports.harness.spawn({
          workItemRef: ports.ref,
          prompt: spawnPrompt ?? ports.prompt,
          descriptor: laneDescriptor,
          streamContext: { attemptId, iterationOrdinal },
          ...(ports.freshTitle === undefined ? {} : { title: ports.freshTitle }),
          ...propagation,
        });
      })();

      if (!session.ok) {
        // A pre-session harness refusal appends no attempt record (GH-335 NFR-1):
        // the envelope carries the typed identity and its disclosed facts.
        if ((HARNESS_PRESESSION_REFUSAL_CODES as readonly string[]).includes(session.error.code)) {
          const detail = harnessRefusalDetail(session.error.code, ports.harnessFacts?.());
          return {
            ok: false,
            error: {
              kind: session.error.kind,
              code: session.error.code,
              ...(session.error.summary === undefined ? {} : { summary: session.error.summary }),
              ...(session.error.field === undefined ? {} : { field: session.error.field }),
              ...(detail === undefined ? {} : { harness: detail }),
            },
          };
        }
        const reads = staleReads();
        return record({
          token: f,
          outcome: O_FAILED,
          errorCode: "dispatch.session.spawn-failed",
          detail: detailOf(session.error),
          comparison: comparisonFor({
            token: f,
            errorCode: "dispatch.session.spawn-failed",
            reads,
            urlResolved: false,
          }),
          corroboration: buildCorroborationRecord({ token: f }),
          falseSuccess: false,
          prUrl: "",
          urlResolved: false,
          lastMessage: "spawn failed before a session existed",
          evidenceRefs: ["harness:spawn-failed"],
        });
      }

      heldSessionId = session.value.sessionId;
      heldSession = session.value;
      // The active lane record at acquisition (GH-347 AC-F1-1, DM-1): written
      // as the handle is acquired, before any outcome is known. A pre-session
      // refusal never reaches this point, so it appends none.
      if (ports.laneOwner !== undefined) {
        const active = appendDispatchLane(ports.store, ports.fenceToken, {
          schema: DISPATCH_LANE_PAYLOAD_SCHEMA,
          ref: ports.ref,
          repository: ports.repository,
          attemptId,
          sessionId: session.value.sessionId,
          harnessKind: ports.harnessKind,
          owner: ports.laneOwner,
          iterationOrdinal,
          restartsConsumed: restarts - persistedRestarts,
          state: "active",
          ...(laneWorktreePath === undefined ? {} : { worktreePath: laneWorktreePath }),
          ...(nomination === undefined ? {} : { providerProfile: nomination.profile }),
          recordedAt: now,
        });
        if (!active.ok) laneAppendFailed = true;
      }
      // F-5(c): the recovery record is appended only after the real session
      // acquisition succeeded, never before a resume that might fail.
      if (pendingRecovery !== undefined && ports.peak !== undefined) {
        // F-5: the resume instant is claimed only after the session is acquired,
        // so a failed resume reports the pause and the failure, not "resumed at".
        const base = peakEpisode ?? {
          episodeId: "",
          cause: "peak-window" as const,
          until: "",
        };
        peakEpisode = {
          ...base,
          ...(pendingResumeAt === undefined ? {} : { resumedAt: pendingResumeAt }),
          ...(pendingPreservation === undefined ? {} : { preservation: pendingPreservation }),
        };
        if (!ports.peak.appendRecovery(pendingRecovery)) peakRecoveryAppendFailed = true;
        pendingRecovery = undefined;
        pendingResumeAt = undefined;
        pendingPreservation = undefined;
      }
      const collectPromise = ports.harness.collect({ handle: session.value });

      // Progress-based liveness (NFR-2, DEC-9): poll at the
      // `lane.liveness-interval` cadence while `collect` is pending, carrying
      // the previous observation so a stall needs two consecutive sourced
      // no-advance readings. The verdict trail is recorded as attempt evidence;
      // a stall still current when collection resolves is the restart-eligible
      // one, while any later progress clears it.
      const verdicts: DispatchLivenessVerdict[] = [];
      let stalled = false;
      let previousReadings: readonly DispatchLivenessReading[] | undefined;
      const observeLiveness = (readings: readonly DispatchLivenessReading[]): void => {
        const evaluation = evaluateDispatchLiveness({
          readings,
          ...(previousReadings === undefined ? {} : { previous: previousReadings }),
          cadenceMs: ports.livenessIntervalMs ?? 30_000,
        });
        if (!verdicts.includes(evaluation.verdict)) verdicts.push(evaluation.verdict);
        // A stall is a current-state verdict, not a latch: any later advancing
        // observation clears it, so a transient mid-run stall is recorded as
        // liveness evidence and the collected evidence still classifies
        // normally.
        if (evaluation.verdict === "progressing") stalled = false;
        else if (evaluation.verdict === "stalled") stalled = true;
        previousReadings = readings;
      };

      let watching = false;
      let stopWatching = (): void => {};
      let watcherDone: Promise<void> = Promise.resolve();
      let peakPark: QueueParkRecord | undefined;
      let peakObserveRefusal: string | undefined;
      if (ports.waitForCadence !== undefined && ports.livenessIntervalMs !== undefined) {
        watching = true;
        const livenessMs = ports.livenessIntervalMs;
        let stopped = false;
        let cancelWait: (() => void) | undefined;
        let lastObservedAtMs: number | undefined;
        const observationDue = (): boolean => {
          // Without a renewal port every wake observes exactly as delivered.
          if (ports.renewLease === undefined) return true;
          const nowMs = Date.parse(ports.nowIso());
          return (
            lastObservedAtMs === undefined ||
            !Number.isFinite(nowMs) ||
            nowMs - lastObservedAtMs >= livenessMs
          );
        };
        watcherDone = (async () => {
          while (!stopped) {
            // F-2: observe BEFORE any await that can let the post-collection
            // stop intervene; apply the verdict even if `stopped` turns true
            // while the read is in flight. F-12: observations keep the
            // configured liveness interval even when the renewal cadence is
            // shorter, because the wake is the earlier of the two due times.
            if (observationDue()) {
              const peak = ports.peak;
              if (peak !== undefined && peak.watchEnabled && peakPark === undefined) {
                const observed: DispatchPeakObservation = await observeDispatchPeak({
                  ref: ports.ref,
                  handle: session.value,
                  sessionId: session.value.sessionId,
                  ...(nomination === undefined ? {} : { providerProfile: nomination.profile }),
                  repository: ports.repository,
                  rulesFor: peak.rulesFor,
                  ...(peak.zoneFactsFor === undefined ? {} : { zoneFactsFor: peak.zoneFactsFor }),
                  nowMs: Date.parse(ports.nowIso()),
                  nowIso: ports.nowIso,
                  killGraceMs: ports.killGraceMs ?? 20_000,
                  parks: peak.parks,
                  newEpisodeId: () => peak.newEpisodeId(ports.ref),
                  stop: peak.stop,
                  appendPark: peak.appendPark,
                });
                if (observed.outcome === "parked") {
                  peakPark = observed.park;
                  peakEpisode = {
                    episodeId: observed.park.episodeId ?? "",
                    cause: "peak-window",
                    until: observed.park.until ?? "",
                  };
                  stopped = true;
                  return;
                }
                if (observed.outcome === "refused") {
                  peakObserveRefusal = observed.code;
                  stopped = true;
                  return;
                }
                // An unconfirmed stop is not an episode: keep observing and
                // renewing so the next observation retries under occupancy.
              }
              let report: Awaited<ReturnType<HarnessSessionPort["liveness"]>>;
              try {
                report = await ports.harness.liveness({ handle: session.value });
              } catch {
                return;
              }
              if (report.ok) observeLiveness(livenessReadings(report.value.readings));
              const nowMs = Date.parse(ports.nowIso());
              if (Number.isFinite(nowMs)) lastObservedAtMs = nowMs;
              if (stopped) return;
            }
            await maybeRenewLease();
            if (stopped) return;
            const nowMs = Date.parse(ports.nowIso());
            const observedAt = lastObservedAtMs ?? nowMs;
            const observationWait = Number.isFinite(nowMs)
              ? Math.max(1, livenessMs - (nowMs - observedAt))
              : livenessMs;
            const renewalWait =
              ports.renewLease === undefined || !Number.isFinite(nowMs)
                ? livenessMs
                : Math.max(1, renewalCadenceMs - (nowMs - lastRenewalAtMs));
            const waitMs = Math.max(1, Math.min(observationWait, renewalWait));
            const wait = ports.waitForCadence?.(waitMs);
            if (wait === undefined) return;
            cancelWait = wait.cancel;
            await wait.promise;
          }
        })();
        stopWatching = () => {
          stopped = true;
          cancelWait?.();
        };
      }

      let evidenceResult: Awaited<ReturnType<HarnessSessionPort["collect"]>>;
      try {
        evidenceResult = await collectPromise;
      } finally {
        if (watching) {
          stopWatching();
          await watcherDone;
        }
      }

      // F-4: after ANY session end, before the withhold and any derivation, an
      // invocation that lost the lease returns one classified result naming the
      // lost lease and performs no owner act (no push parity, no terminal lane
      // record over the successor's active record).
      if (leaseLost) {
        return record({
          token: su,
          outcome: O_FAILED,
          errorCode: "dispatch.state-unverified",
          comparison: comparisonFor({
            token: su,
            errorCode: "dispatch.state-unverified",
            reads: staleReads(),
            urlResolved: false,
          }),
          corroboration: buildCorroborationRecord({ token: su }),
          falseSuccess: false,
          prUrl: "",
          urlResolved: false,
          lastMessage: `the lease was no longer this invocation's${
            peakEpisode === undefined ? "" : `; the park stands until ${peakEpisode.until}`
          }`,
          evidenceRefs: ["lease:not-owned"],
        });
      }

      // GH-413 F-9/DEC-15: the owning invocation withholds terminal
      // classification for at least the applied grace plus one observation
      // cadence after collection resolves, then re-reads the park record. A
      // separately invoked `dispatch stop` writes the park only after its
      // terminate call awaits the whole grace, so a one-cadence re-read could
      // miss it; the withhold spans the grace. It applies whether or not
      // automatic pausing is enabled, because it is the run path's own
      // post-collection rule.
      if (ports.peak !== undefined && peakPark === undefined && !leaseLost) {
        const withholdMs = (ports.killGraceMs ?? 20_000) + (ports.livenessIntervalMs ?? 30_000);
        // R3: step at the renewal cadence so the heartbeat never reaches the
        // TTL, including when the liveness interval is at or above the TTL.
        const cadence = renewalCadenceMs;
        if (cadence > 0) {
          const steps = Math.max(1, Math.ceil(withholdMs / cadence));
          for (let step = 0; step < steps; step += 1) {
            // F-9: renew inside the withhold, so the heartbeat never reaches
            // the TTL across a session end.
            await maybeRenewLease();
            // The delivered injected delay seam advances the clock instantly in
            // the battery and binds a real timer in production.
            if (ports.delay !== undefined) await ports.delay(cadence, "terminate-grace");
            else {
              const wait = ports.waitForCadence?.(cadence);
              if (wait === undefined) break;
              await wait.promise;
            }
          }
        }
        const latestPark = [...ports.peak.parks()]
          .reverse()
          .find((park) => park.ref === ports.ref && park.cause === "peak-window");
        const openPark =
          latestPark !== undefined &&
          (latestPark.recoveryState === "parked" ||
            latestPark.recoveryState === "clear-observed") &&
          // Only a park that landed during/after this invocation is the
          // cross-process stop hand-off; a standing park from before the run
          // was occupancy at the first observation, not a new episode.
          Date.parse(latestPark.recordedAt) >= Date.parse(now)
            ? latestPark
            : undefined;
        if (openPark !== undefined) {
          peakPark = openPark;
          peakEpisode = {
            episodeId: openPark.episodeId ?? "",
            cause: "peak-window",
            until: openPark.until ?? "",
          };
        }
      }

      // R4: a lease lost inside the withhold returns the same classified
      // result, before the derivation and any terminal lane record.
      if (leaseLost) {
        return record({
          token: su,
          outcome: O_FAILED,
          errorCode: "dispatch.state-unverified",
          comparison: comparisonFor({
            token: su,
            errorCode: "dispatch.state-unverified",
            reads: staleReads(),
            urlResolved: false,
          }),
          corroboration: buildCorroborationRecord({ token: su }),
          falseSuccess: false,
          prUrl: "",
          urlResolved: false,
          lastMessage: "the lease was no longer this invocation's during the post-session withhold",
          evidenceRefs: ["lease:not-owned"],
        });
      }

      // GH-413 F-3/F-4: a dispatch-owned park happened. Wait on the renewal
      // cadence, renew the lease, and resume at the recorded end by the
      // preservation classification; a refused recovery returns one classified
      // result and a lost lease performs no owner act.
      if (peakObserveRefusal !== undefined) {
        const reads = staleReads();
        return record({
          token: su,
          outcome: O_FAILED,
          errorCode: peakObserveRefusal,
          comparison: comparisonFor({
            token: su,
            errorCode: peakObserveRefusal,
            reads,
            urlResolved: false,
          }),
          corroboration: buildCorroborationRecord({ token: su }),
          falseSuccess: false,
          prUrl: "",
          urlResolved: false,
          lastMessage: `the window-open stop could not be issued (${peakObserveRefusal})`,
          evidenceRefs: ["peak:stop-refused"],
        });
      }
      if (peakPark !== undefined) {
        const peak = ports.peak;
        const waitOutcome: DispatchPeakResume | { readonly outcome: "lease-lost" } =
          peak === undefined
            ? { outcome: "none" }
            : await (async () => {
                for (;;) {
                  if (leaseLost) return { outcome: "lease-lost" } as const;
                  await maybeRenewLease();
                  if (leaseLost) return { outcome: "lease-lost" } as const;
                  const outcome = await evaluateDispatchPeakResume({
                    ref: ports.ref,
                    parks: peak.parks,
                    rulesFor: peak.resumeRulesFor ?? peak.rulesFor,
                    ...(peak.zoneFactsFor === undefined ? {} : { zoneFactsFor: peak.zoneFactsFor }),
                    nowMs: Date.parse(ports.nowIso()),
                    nowIso: ports.nowIso,
                    holdActive: peak.holdActive,
                    ...(session.value.sessionId === undefined
                      ? {}
                      : { sessionRef: session.value.sessionId }),
                    branch: peak.branch(),
                    restartCount: peak.restartCount(ports.ref),
                    restartBound: budget,
                    ...(peak.recoveryAdmission === undefined
                      ? {}
                      : { admission: peak.recoveryAdmission }),
                    economics: peak.economics(ports.ref),
                    resumeSession: peak.resumeSession,
                    reenter: ({ ordinal }) => peak.reenter({ ref: ports.ref, ordinal }),
                    escalate: peak.escalate,
                  });
                  if (outcome.outcome !== "waiting") return outcome;
                  const wait = ports.waitForCadence?.(renewalCadenceMs);
                  if (wait === undefined) return { outcome: "none" } as const;
                  await wait.promise;
                }
              })();
        if (waitOutcome.outcome === "resumed") {
          pendingResumeAt = waitOutcome.resumedAt;
          pendingRecovery = waitOutcome.recoveryRecord;
          peakPark = undefined;
          handle = session.value;
          spawnPrompt = undefined;
          continue;
        }
        if (waitOutcome.outcome === "recovered") {
          pendingResumeAt = ports.nowIso();
          pendingPreservation = "session-state-not-preserved";
          pendingRecovery = waitOutcome.recoveryRecord;
          restarts += 1;
          const restartRecorded =
            ports.appendRestart === undefined ||
            ports.appendRestart({
              ref: ports.ref,
              runId: attemptId,
              sessionId: session.value.sessionId,
              ordinal: restarts,
              reason: "session-interrupted",
              recordedAt: now,
            });
          if (!restartRecorded) {
            return record({
              token: su,
              outcome: O_FAILED,
              errorCode: "dispatch.state-unverified",
              comparison: comparisonFor({
                token: su,
                errorCode: "dispatch.state-unverified",
                reads: staleReads(),
                urlResolved: false,
              }),
              corroboration: buildCorroborationRecord({ token: su }),
              falseSuccess: false,
              prUrl: "",
              urlResolved: false,
              lastMessage: "the interrupted-lane recovery record could not be appended",
              evidenceRefs: ["economics:restart-failed", "park:recovery"],
            });
          }
          peakPark = undefined;
          handle = session.value;
          spawnPrompt = undefined;
          continue;
        }
        if (waitOutcome.outcome === "refused") {
          const exhaustionRef = waitOutcome.terminal
            ? ensureExhaustion(ports, session.value.sessionId, restarts, now)
            : undefined;
          const base = peakEpisode ?? {
            episodeId: "",
            cause: "peak-window" as const,
            until: "",
          };
          peakEpisode = { ...base, refusal: waitOutcome.code };
          const pair = admissionRefusalPair(
            isAdmissionRefusalCode(waitOutcome.code)
              ? waitOutcome.code
              : "dispatch.state-unverified",
          );
          const reads = await ports.readTruth();
          const parkEnd = waitOutcome.parkEnd;
          return record({
            token: pair.token,
            outcome: pair.outcome,
            errorCode: waitOutcome.code,
            comparison: comparisonFor({
              token: pair.token,
              errorCode: waitOutcome.code,
              reads,
              urlResolved: false,
            }),
            corroboration: buildCorroborationRecord({ token: pair.token }),
            falseSuccess: false,
            prUrl: "",
            urlResolved: false,
            lastMessage: `parked until ${parkEnd || "an unrecorded end"}; the window-end recovery refused (${waitOutcome.code})`,
            evidenceRefs: [
              ...(exhaustionRef === undefined ? [] : [exhaustionRef]),
              "park:recovery-refused",
              ...(waitOutcome.episodeId === undefined ? [] : [`episode:${waitOutcome.episodeId}`]),
            ],
          });
        }
        if (waitOutcome.outcome === "none") {
          return record({
            token: su,
            outcome: O_FAILED,
            errorCode: "dispatch.state-unverified",
            comparison: comparisonFor({
              token: su,
              errorCode: "dispatch.state-unverified",
              reads: staleReads(),
              urlResolved: false,
            }),
            corroboration: buildCorroborationRecord({ token: su }),
            falseSuccess: false,
            prUrl: "",
            urlResolved: false,
            lastMessage: "the standing park was no longer present; no owner act was taken",
            evidenceRefs: ["park:standing"],
          });
        }
        // A lost lease while parked returns one classified result with the park
        // standing and releases the lease; the successor's lease is untouched.
        const reads = staleReads();
        return record({
          token: su,
          outcome: O_FAILED,
          errorCode: "dispatch.state-unverified",
          comparison: comparisonFor({
            token: su,
            errorCode: "dispatch.state-unverified",
            reads,
            urlResolved: false,
          }),
          corroboration: buildCorroborationRecord({ token: su }),
          falseSuccess: false,
          prUrl: "",
          urlResolved: false,
          lastMessage: `the lease was no longer this invocation's while parked until ${
            peakPark.until ?? "an unrecorded end"
          }`,
          evidenceRefs: ["lease:not-owned", "park:standing"],
        });
      }
      if (evidenceResult.ok) {
        // With no composed cadence the session cannot be watched while it runs;
        // one post-collect observation is still taken and never fabricated.
        if (!watching) {
          try {
            const liveness = await ports.harness.liveness({ handle: session.value });
            if (liveness.ok) observeLiveness(livenessReadings(liveness.value.readings));
          } catch {
            // A liveness read failure never fabricates progress or a stall.
          }
        }
      }
      const livenessRefs = verdicts.map((verdict) => `liveness:${verdict}`);
      if (!evidenceResult.ok) {
        // A session existed but its evidence could not be read (Appendix G): the
        // attempt is recorded as unevaluable at exit 2, never returned unrecorded.
        const reads = staleReads();
        return record({
          token: su,
          outcome: O_FAILED,
          errorCode: "dispatch.state-unverified",
          comparison: comparisonFor({
            token: su,
            errorCode: "dispatch.state-unverified",
            reads,
            urlResolved: false,
          }),
          corroboration: buildCorroborationRecord({ token: su }),
          falseSuccess: false,
          prUrl: "",
          urlResolved: false,
          lastMessage: `harness evidence unreadable (${evidenceResult.error.code})`,
          evidenceRefs: ["harness:collect-failed", ...livenessRefs],
        });
      }

      // GH-347 F-5/F-6, Appendix F(D): a stall is a current-state liveness
      // verdict or a harness-reported timeout. A clean exit is never a stall.
      const timedOut = evidenceResult.value.timedOut;
      const stall = stalled || timedOut;
      if (stall) {
        // GH-413 DEC-13, NFR-10: an invocation that no longer holds the lease
        // performs no owner act on the lane. Its session has ended with the
        // stall evidence; it does not terminate, restart, or resume, and it
        // returns one classified result carrying the lost-lease evidence.
        if (leaseLost) {
          return record({
            token: su,
            outcome: O_FAILED,
            errorCode: "dispatch.state-unverified",
            comparison: comparisonFor({
              token: su,
              errorCode: "dispatch.state-unverified",
              reads: staleReads(),
              urlResolved: false,
            }),
            corroboration: buildCorroborationRecord({ token: su }),
            falseSuccess: false,
            prUrl: "",
            urlResolved: false,
            lastMessage: "the lease was no longer this invocation's; no owner act was taken",
            evidenceRefs: ["lease:not-owned", ...livenessRefs],
          });
        }
        const reads = await ports.readTruth();
        // Terminate BEFORE any restart decision on a capable adapter; an
        // incapable adapter is never asked and (per AC-F5-4) never causes a
        // second session.
        const terminate = ports.harness.terminate;
        const terminateCapable = declaresTerminate(ports.harness);
        const terminationRefs: string[] = [];
        // A composed terminate operation must CONFIRM the termination before a
        // restart (F-5). A capable composition that composes no operation keeps
        // the delivered restart, which is a composition gap and not capability
        // dishonesty.
        const confirmationRequired = terminate !== undefined && terminateCapable;
        let terminationConfirmed = !confirmationRequired;
        if (terminate !== undefined && terminateCapable) {
          try {
            const terminated = await terminate({
              handle: session.value,
              graceMs: ports.killGraceMs ?? 20_000,
            });
            if (!terminated.ok || !terminated.value.terminated) {
              // An unconfirmed termination never claims success (F-5: no second
              // session starts until the first is confirmed terminated).
              terminationRefs.push("terminate:failed");
            } else {
              terminationConfirmed = true;
              terminationRefs.push("terminate:terminated");
              if (terminated.value.escalated) terminationRefs.push("terminate:escalated");
              if (terminated.value.reaped) terminationRefs.push("terminate:reaped");
            }
          } catch {
            terminationRefs.push("terminate:failed");
          }
        }
        const stallRefs = [...carriedStallRefs, ...livenessRefs, ...terminationRefs];
        const shortCircuit = dispatchStallShortCircuit({
          tracker: reads.tracker,
          artifacts: reads.artifacts,
        });
        if (shortCircuit !== undefined) {
          const arm =
            shortCircuit === m && reads.tracker.ok && reads.tracker.value.state === "done"
              ? ("tracker-done-merged" as const)
              : undefined;
          const facts = corroborationFactsOf(reads);
          const comparison = comparisonFor({ token: shortCircuit, reads, urlResolved: false });
          const prUrl =
            shortCircuit === po && reads.artifacts.ok ? (reads.artifacts.value.pr.url ?? "") : "";
          return record({
            token: shortCircuit,
            outcome: evidenceResult.value.completionMarker
              ? ports.harness.classify(evidenceResult.value).outcome
              : O_FAILED,
            comparison,
            corroboration: buildCorroborationRecord({
              token: shortCircuit,
              facts,
              ...(arm === undefined ? {} : { arm }),
            }),
            falseSuccess: false,
            prUrl,
            urlResolved: prUrl.length > 0,
            lastMessage: `liveness stalled; the terminal pre-restart verdict is ${shortCircuit}`,
            evidenceRefs: stallRefs,
          });
        }
        if (dispatchStallUndecidable({ tracker: reads.tracker, artifacts: reads.artifacts })) {
          return record({
            token: su,
            outcome: O_FAILED,
            errorCode: "dispatch.state-unverified",
            comparison: comparisonFor({
              token: su,
              errorCode: "dispatch.state-unverified",
              reads,
              urlResolved: false,
            }),
            corroboration: buildCorroborationRecord({ token: su }),
            falseSuccess: false,
            prUrl: "",
            urlResolved: false,
            lastMessage: "liveness stalled; truth is undecidable",
            evidenceRefs: stallRefs,
          });
        }
        // GH-347 AC-F5-4, F-5: on an adapter that declares no terminate
        // capability the engine starts NO second session. The terminal
        // pre-restart verdict already had its chance above; the only remaining
        // honest verdict is a terminal `state-unverified` at exit 2 with the
        // stall evidence. No ordinal is consumed and no iteration follows.
        if (!terminateCapable || !terminationConfirmed) {
          return record({
            token: su,
            outcome: O_FAILED,
            errorCode: "dispatch.state-unverified",
            comparison: comparisonFor({
              token: su,
              errorCode: "dispatch.state-unverified",
              reads,
              urlResolved: false,
            }),
            corroboration: buildCorroborationRecord({ token: su }),
            falseSuccess: false,
            prUrl: "",
            urlResolved: false,
            lastMessage: terminateCapable
              ? "liveness stalled; termination was not confirmed"
              : "liveness stalled; the adapter declares no terminate capability",
            evidenceRefs: stallRefs,
          });
        }
        // The LOOP keeps the budget-consulting scope (AC-F6-2/AC-F6-6): at or
        // above the bound it records `max-restarts` with the exhaustion record.
        // A composition with NO positive bound composes no restart policy, so
        // the loop never restarts automatically (it would otherwise spin on a
        // permanently stalled session); the delivery stays the delivered
        // `max-restarts` classification for the timeout.
        const decision =
          budget > 0
            ? admitDispatchRestart({ count: restarts, bound: budget })
            : {
                admitted: false as const,
                reason: "dispatch.restart-budget-exceeded" as const,
                count: restarts,
                bound: budget,
                terminal: true as const,
                escalation: "restart-budget-exhausted" as const,
              };
        if (!decision.admitted) {
          const exhaustionRef = ensureExhaustion(ports, session.value.sessionId, restarts, now);
          return record({
            token: mr,
            outcome: O_FAILED,
            errorCode: "dispatch.restart-budget-exceeded",
            comparison: comparisonFor({
              token: mr,
              errorCode: "dispatch.restart-budget-exceeded",
              reads,
              urlResolved: false,
            }),
            corroboration: buildCorroborationRecord({ token: mr }),
            falseSuccess: false,
            prUrl: "",
            urlResolved: false,
            lastMessage: `liveness stalled; restart budget exhausted at ${restarts} of ${budget}`,
            evidenceRefs: [exhaustionRef ?? "economics:exhaustion", ...stallRefs],
          });
        }
        // Below the bound: exactly one ordinal, exactly one delivered
        // `economics.restart` with reason `watchdog.liveness-stalled`, then the
        // recorded session is resumed for the next iteration.
        restarts += 1;
        const restartRecorded =
          ports.appendRestart === undefined ||
          ports.appendRestart({
            ref: ports.ref,
            runId: attemptId,
            sessionId: session.value.sessionId,
            ordinal: restarts,
            reason: "watchdog.liveness-stalled",
            recordedAt: now,
          });
        if (!restartRecorded) {
          return record({
            token: su,
            outcome: O_FAILED,
            errorCode: "dispatch.state-unverified",
            comparison: comparisonFor({
              token: su,
              errorCode: "dispatch.state-unverified",
              reads,
              urlResolved: false,
            }),
            corroboration: buildCorroborationRecord({ token: su }),
            falseSuccess: false,
            prUrl: "",
            urlResolved: false,
            lastMessage: "liveness stalled; the restart record could not be appended",
            evidenceRefs: ["economics:restart-failed", ...stallRefs],
          });
        }
        handle = session.value;
        spawnPrompt = undefined;
        // The stalled iteration appends no attempt of its own (Appendix F(E)),
        // so its verdict and termination result are carried onto the terminal
        // attempt (GH-347 F-5, AC-F5-1, §10).
        carriedStallRefs.push(...livenessRefs, ...terminationRefs);
        continue;
      }

      const evidence: HarnessEvidence = evidenceResult.value;
      const classification = ports.harness.classify(evidence);
      const harnessToken = classification.token;

      const reads = await ports.readTruth();
      const derivationInput = {
        harness: {
          ok: true as const,
          value: {
            outcome: classification.outcome,
            token: harnessToken,
            exitStatus: evidence.exitStatus,
            spawnRefused: evidence.spawnRefused,
          },
        },
        artifacts: reads.artifacts,
        ledger: reads.ledger,
        tracker: reads.tracker,
        restarts: { count: restarts, bound: budget },
        handoverState: ports.handoverState,
      };
      // GH-386 F-1: the ensure-push act runs post-session and pre-classification,
      // exactly when the first derivation pass reaches the resolved open-PR arm.
      // The ladder is deterministic over unchanged injected reads, so the second
      // pass re-enters the same arm and the precondition binds every
      // classification, fresh or resumed. A composition without the capability
      // never evaluates the precondition (the daemon lane keeps its own path).
      let derivation = deriveDispatchResult(derivationInput);
      let pushParityReading: DispatchPushParityReading | undefined;
      if (ports.pushParity !== undefined && derivation.token === po && derivation.urlResolved) {
        pushParityReading = await ports.pushParity({ ref: ports.ref });
        derivation = deriveDispatchResult({ ...derivationInput, pushParity: pushParityReading });
      }

      const derivedToken = derivation.token;
      // The typed push failure is dispatch-derived, not a truth disagreement:
      // its comparison is not applicable with the one new declared reason
      // (GH-386 DM-3), overriding the failed token's delivered verify pairing.
      const comparison =
        derivation.push !== undefined && derivedToken === f
          ? buildComparisonRecord({
              kind: "dispatch-derived-failure",
              engineToken: f,
              reason: "push-parity-unmet",
            })
          : comparisonFor({
              token: derivedToken,
              ...(derivation.errorCode === undefined ? {} : { errorCode: derivation.errorCode }),
              reads,
              urlResolved: derivation.urlResolved,
            });

      let divergenceRef: string | undefined;
      let truthRef: string | undefined;
      let appendFailureCode: string | undefined;
      const delivered =
        derivation.token === su &&
        isDeliveredEvidence({
          outcome: classification.outcome,
          ledger: reads.ledger,
        });
      const truthReason = delivered ? unreadableTruthReason(reads) : undefined;
      if (delivered && truthReason !== undefined) {
        truthRef = `truth:unreadable:${truthReason}`;
        const ledger = readDispatchDivergences(ports.store);
        const folded = ledger.ok ? foldDispatchDivergences(ledger.records) : [];
        // A replayed attempt is already represented by its own divergence,
        // resolved or not; never open a second record for it.
        const recordedAttempt = folded.some(
          (entry) =>
            entry.attemptId === attemptId &&
            entry.repository === ports.repository &&
            entry.ref === ports.ref &&
            entry.comparisonClass === "not-applicable" &&
            entry.engineToken === su &&
            entry.comparisonToken === null,
        );
        if (!recordedAttempt) {
          const existing = folded.find((entry) =>
            isDeliveredEvidenceDivergence(entry, ports.repository, ports.ref),
          );
          if (existing !== undefined) {
            divergenceRef = existing.divergenceId;
          } else {
            const candidate = ports.newDivergenceId();
            const appended = appendDispatchDivergence(ports.store, ports.fenceToken, {
              schema: DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
              divergenceId: candidate,
              repository: ports.repository,
              ref: ports.ref,
              attemptId,
              state: "open",
              comparisonClass: "not-applicable",
              engineToken: su,
              comparisonToken: null,
              evidenceRefs: [`attempt:${attemptId}`, truthRef],
              recordedAt: now,
            });
            if (appended.ok) divergenceRef = candidate;
            else appendFailureCode = appended.code;
          }
        }
      } else if (comparison.outcome === "mismatch") {
        divergenceRef = ports.newDivergenceId();
        appendDispatchDivergence(ports.store, ports.fenceToken, {
          schema: DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
          divergenceId: divergenceRef,
          repository: ports.repository,
          ref: ports.ref,
          attemptId,
          state: "open",
          comparisonClass: comparison.class,
          engineToken: derivedToken,
          comparisonToken: comparison.token,
          evidenceRefs: [`attempt:${attemptId}`],
          recordedAt: now,
        });
      }

      const facts = corroborationFactsOf(reads);
      // The arm is the derivation's own decision (GH-347 DEC-6): the one
      // derivation decides it; both evaluation sites pass it unchanged.
      const corroborationArm = derivation.corroborationArm;
      const corroboration = buildCorroborationRecord({
        token: derivedToken,
        facts,
        ...(corroborationArm === undefined ? {} : { arm: corroborationArm }),
      });
      const unreadable = unreadableCorroborationSources(facts);
      const falseSuccess = classifyFalseSuccess({
        token: derivedToken,
        comparison,
        corroboration,
        ...(unreadable.length === 0 ? {} : { unreadable }),
        ...(corroborationArm === undefined ? {} : { arm: corroborationArm }),
      });

      const trackerExhausted =
        !reads.tracker.ok && reads.tracker.identity === "tracker:exhausted"
          ? ["tracker:exhausted"]
          : [];
      const parityUnreadable = pushParityReading !== undefined && !pushParityReading.ok;
      const evidenceRefs = [
        ...trackerExhausted,
        `attempt:${attemptId}`,
        ...(parityUnreadable ? ["truth:unreadable:state"] : []),
        ...(truthRef === undefined ? [] : [truthRef]),
        ...(appendFailureCode === undefined ? [] : ["divergence:append-failed"]),
        ...livenessRefs,
        ...carriedStallRefs,
      ].slice(0, DISPATCH_MAX_EVIDENCE_REFS);
      const lastMessage =
        appendFailureCode === undefined
          ? derivation.lastMessage
          : `delivered-evidence divergence append failed (${appendFailureCode}); the attempt was recorded without a divergence reference`;

      return record({
        token: derivedToken,
        outcome: derivation.outcome,
        ...(derivation.errorCode === undefined ? {} : { errorCode: derivation.errorCode }),
        ...(appendFailureCode === undefined ? {} : { envelopeErrorCode: appendFailureCode }),
        comparison,
        corroboration,
        falseSuccess,
        prUrl: derivation.prUrl,
        urlResolved: derivation.urlResolved,
        lastMessage,
        evidenceRefs,
        ...(derivation.push === undefined
          ? {}
          : { pushRef: dispatchPushEvidenceRef(derivation.push.verdict), push: derivation.push }),
        ...(divergenceRef === undefined ? {} : { divergenceRef }),
      });
    }
  } finally {
    // F-3: release only the lease this invocation still owns. A lost lease is
    // the successor's; the release matches on holder, so releasing it would
    // delete the successor's live claim.
    if (!leaseLost) ports.releaseLease(releaseCause, leaseHeartbeatAt);
  }
};
