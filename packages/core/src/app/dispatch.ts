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
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultToken,
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  DISPATCH_MAX_ERROR_DETAIL_CHARS,
  DISPATCH_MAX_EVIDENCE_REFS,
  DISPATCH_MAX_LAST_MESSAGE_CHARS,
  type DispatchAttemptRecord,
  type DispatchEnvelopeData,
  type DispatchEnvelopeError,
  type DispatchEvidenceClass,
  type DispatchHandoverState,
  type DispatchPhaseLedger,
  type DispatchResumeMode,
  ERROR_TABLE,
  HARNESS_OUTCOMES,
  type HarnessEvidence,
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessFailure,
  type HarnessKind,
  type HarnessOutcome,
  type HarnessSessionHandle,
  type HarnessSessionPort,
  type ProjectionClass,
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
  foldDispatchDivergences,
  readDispatchDivergences,
} from "./dispatch-ledger.js";

/** `f` failed, `su` state-unverified, `mr` max-restarts, `po` pr-open,
 * `pou` pr-open-unverified — the few tokens this module names. */
const [, , po, pou, f, , mr, su] = DELIVERY_RESULT_TOKENS;
const O_FAILED = HARNESS_OUTCOMES[2];

/** A local short alias: keeps the payload field type recognizable. */
type DispatchToken = DeliveryResultToken;

/** One lease claim outcome through the scheduling engine. */
export type DispatchLeaseClaim =
  | { readonly ok: true; readonly leaseId: string }
  | { readonly ok: false; readonly code: string };

/** One cancellable cadence wait; the composition owns the timer. */
export type DispatchCadenceWait = {
  readonly promise: Promise<void>;
  readonly cancel: () => void;
};

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
 */
export type DispatchPreflightError = {
  readonly kind: "input" | "config" | "provider";
  readonly code: string;
  readonly summary?: string;
  readonly trustedRefusal?: true;
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

/** Everything the one-shot run consumes; every field is injected. */
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
  readonly newAttemptId: () => string;
  readonly newDivergenceId: () => string;
  readonly readTruth: () => Promise<DispatchTruthReads>;
  readonly claimLease: () => DispatchLeaseClaim;
  readonly releaseLease: (cause: "completed" | "aborted") => boolean;
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
        /** The narrow credential-refusal marker; set only for `config.credential.missing`. */
        readonly trustedRefusal?: true;
      };
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
  const kind = failure.kind;
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
  // Admission precondition: a refusal here is pre-session. It runs before the
  // lease claim and before any spawn, resume, attempt, or divergence record.
  if (ports.preflight !== undefined) {
    const preflight = await ports.preflight();
    if (!preflight.ok) return { ok: false, error: preflight.error };
  }

  const claimed = ports.claimLease();
  if (!claimed.ok) {
    return { ok: false, error: { kind: "queue", code: claimed.code } };
  }

  let releaseCause: "completed" | "aborted" = "aborted";
  try {
    const now = ports.nowIso();
    const attemptId = ports.newAttemptId();
    let restarts = ports.initialRestarts ?? 0;
    const budget = ports.restartBudget ?? 0;
    let resumeMode = ports.resumeMode;
    let prefillCostAcknowledged = ports.prefillCostAcknowledged;

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
      readonly divergenceRef?: string;
      readonly detail?: NonNullable<DispatchEnvelopeError["detail"]>;
    }): DispatchRunResult => {
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
        evidenceRefs: input.evidenceRefs,
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
        lastMessage: boundLastMessage(input.lastMessage),
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

    const session = await (async () => {
      if (ports.resumePrompt !== undefined && ports.existingHandle !== undefined) {
        return ports.harness.resume({
          handle: ports.existingHandle,
          prompt: ports.resumePrompt,
          descriptor: ports.descriptor,
        });
      }
      return ports.harness.spawn({
        workItemRef: ports.ref,
        prompt: ports.prompt,
        descriptor: ports.descriptor,
      });
    })();

    if (!session.ok) {
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

    const collectPromise = ports.harness.collect({ handle: session.value });

    // Progress-based liveness (NFR-2, DEC-9): poll at the `lane.liveness-interval`
    // cadence while `collect` is pending, carrying the previous observation so a
    // stall needs two consecutive sourced no-advance readings. The verdict trail
    // is recorded as attempt liveness evidence; a stall that is still current
    // when collection resolves is routed through restart admission below, while
    // any later progress clears it.
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
      // liveness evidence and the collected evidence still classifies normally.
      if (evaluation.verdict === "progressing") stalled = false;
      else if (evaluation.verdict === "stalled") stalled = true;
      previousReadings = readings;
    };

    let watching = false;
    let stopWatching = (): void => {};
    let watcherDone: Promise<void> = Promise.resolve();
    if (ports.waitForCadence !== undefined && ports.livenessIntervalMs !== undefined) {
      watching = true;
      let stopped = false;
      let cancelWait: (() => void) | undefined;
      watcherDone = (async () => {
        while (!stopped) {
          let report: Awaited<ReturnType<HarnessSessionPort["liveness"]>>;
          try {
            report = await ports.harness.liveness({ handle: session.value });
          } catch {
            return;
          }
          if (stopped) return;
          if (report.ok) observeLiveness(livenessReadings(report.value.readings));
          const wait = ports.waitForCadence?.(ports.livenessIntervalMs ?? 0);
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

    const evidenceResult = await collectPromise;
    if (watching) {
      stopWatching();
      await watcherDone;
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
    if (stalled) {
      // A corroborated terminal stall consults the one restart-admission gate. At
      // or above the bound the attempt is the Appendix G restart-budget refusal;
      // below the bound the delivered port cannot kill a live session, so the
      // stall is recorded and left to lane supervision instead of leaking a
      // silent second spawn.
      const decision = admitDispatchRestart({ count: restarts, bound: budget });
      if (!decision.admitted) {
        const reads = staleReads();
        const exhaustionRef = ensureExhaustion(
          ports,
          ports.existingHandle?.sessionId ?? attemptId,
          restarts,
          now,
        );
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
          evidenceRefs: [exhaustionRef ?? "economics:exhaustion", ...livenessRefs],
        });
      }
    }
    const evidence: HarnessEvidence = evidenceResult.value;
    const classification = ports.harness.classify(evidence);
    const harnessToken = classification.token;

    const reads = await ports.readTruth();
    const derivation = deriveDispatchResult({
      harness: {
        ok: true,
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
    });

    const derivedToken = derivation.token;
    const comparison = comparisonFor({
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
    const corroboration = buildCorroborationRecord({ token: derivedToken, facts });
    const unreadable = unreadableCorroborationSources(facts);
    const falseSuccess = classifyFalseSuccess({
      token: derivedToken,
      comparison,
      corroboration,
      ...(unreadable.length === 0 ? {} : { unreadable }),
    });

    const evidenceRefs = [
      `attempt:${attemptId}`,
      ...(truthRef === undefined ? [] : [truthRef]),
      ...(appendFailureCode === undefined ? [] : ["divergence:append-failed"]),
      ...livenessRefs,
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
      ...(divergenceRef === undefined ? {} : { divergenceRef }),
    });
  } finally {
    ports.releaseLease(releaseCause);
  }
};
