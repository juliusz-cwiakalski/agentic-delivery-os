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
  HARNESS_OUTCOMES,
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  DISPATCH_MAX_LAST_MESSAGE_CHARS,
  type DeliveryResultToken,
  type DispatchAttemptRecord,
  type DispatchEnvelopeData,
  type DispatchEvidenceClass,
  type DispatchHandoverState,
  type DispatchPhaseLedger,
  type DispatchResumeMode,
  type HarnessEvidence,
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessKind,
  type HarnessSessionHandle,
  type HarnessSessionPort,
  type ProjectionClass,
  type StateStorePort,
} from "#contracts";
import {
  buildComparisonRecord,
  buildCorroborationRecord,
  classifyFalseSuccess,
  dispatchFamilyOf,
} from "../domain/dispatch-comparison.js";
import { evaluateDispatchLiveness, type DispatchLivenessReading } from "../domain/dispatch-liveness.js";
import { admissionRefusalPair } from "../domain/dispatch-resume.js";
import {
  deriveDispatchResult,
  type DispatchArtifactFacts,
  type DispatchLedgerFacts,
  type DispatchRead,
  type DispatchTrackerFacts,
} from "../domain/dispatch-result.js";
import { appendDispatchAttempt, appendDispatchDivergence } from "./dispatch-ledger.js";

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

/** The independently read truth the derivation and evidence consume. */
export type DispatchTruthReads = {
  readonly artifacts: DispatchRead<DispatchArtifactFacts>;
  readonly ledger: DispatchRead<DispatchLedgerFacts>;
  readonly tracker: DispatchRead<DispatchTrackerFacts>;
  readonly ci: DispatchRead<{ readonly verdict: "success" | "failure" }>;
  readonly verifyOutcome: DeliveryResultToken | null;
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
  readonly admission?: () => DispatchAdmission;
  readonly initialRestarts?: number;
  readonly restartBudget?: number;
  readonly livenessIntervalMs?: number;
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
        readonly kind: "input" | "queue" | "state" | "harness" | "dispatch";
        readonly code: string;
        readonly summary?: string;
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

const errorOf = (
  derivation: { readonly lastMessage: string; readonly errorCode: string },
): NonNullable<DispatchEnvelopeData["error"]> => {
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
  };
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
    return buildComparisonRecord({
      kind: "tracker-truth",
      engineToken: input.token,
      trackerToken: input.token === pou ? po : input.token,
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
  phasesComplete: false,
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
 * appends no attempt record. A spawn failure, a spawn refusal, and an
 * unverifiable truth read are attempt-stage outcomes: they append exactly one
 * attempt record and return a classified envelope.
 */
export const runDispatch = async (ports: DispatchPorts): Promise<DispatchRunResult> => {
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
      readonly comparison: DispatchAttemptRecord["comparison"];
      readonly corroboration: DispatchAttemptRecord["corroboration"];
      readonly falseSuccess: boolean;
      readonly prUrl: string;
      readonly urlResolved: boolean;
      readonly lastMessage: string;
      readonly evidenceRefs: readonly string[];
      readonly divergenceRef?: string;
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
          : { error: errorOf({ lastMessage: input.lastMessage, errorCode: input.errorCode }) }),
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
        return record({
          token: pair.token,
          outcome: pair.outcome,
          errorCode: admission.code,
          comparison: comparisonFor({ token: pair.token, errorCode: admission.code, reads, urlResolved: false }),
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
            admission.terminal === true ? ["economics:exhaustion"] : [`attempt:${attemptId}`],
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
        comparison: comparisonFor({ token: f, errorCode: "dispatch.session.spawn-failed", reads, urlResolved: false }),
        corroboration: buildCorroborationRecord({ token: f }),
        falseSuccess: false,
        prUrl: "",
        urlResolved: false,
        lastMessage: "spawn failed before a session existed",
        evidenceRefs: ["harness:spawn-failed"],
      });
    }

    const evidenceResult = await ports.harness.collect({ handle: session.value });
    if (!evidenceResult.ok) {
      return { ok: false, error: { kind: "harness", code: evidenceResult.error.code } };
    }
    const evidence: HarnessEvidence = evidenceResult.value;
    const classification = ports.harness.classify(evidence);
    const harnessToken = classification.token;

    // Progress-based liveness: one observation cannot stall; a later phase
    // resumes the loop against the previous observation.
    try {
      const liveness = await ports.harness.liveness({ handle: session.value });
      if (liveness.ok) {
        evaluateDispatchLiveness({
          readings: livenessReadings(liveness.value.readings),
          cadenceMs: ports.livenessIntervalMs ?? 30_000,
        });
      }
    } catch {
      // A liveness read failure never fabricates progress or a stall.
    }

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
    if (comparison.outcome === "mismatch") {
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

    const corroboration = buildCorroborationRecord({
      token: derivedToken,
      facts: {
        "pm-notes": reads.phasesComplete ? "satisfied" : "unsatisfied",
        tracker: reads.tracker.ok ? "satisfied" : "unsatisfied",
        ci: reads.ci.ok && reads.ci.value.verdict === "success" ? "satisfied" : "unsatisfied",
      },
    });
    const falseSuccess = classifyFalseSuccess({
      token: derivedToken,
      comparison,
      corroboration,
    });

    return record({
      token: derivedToken,
      outcome: derivation.outcome,
      ...(derivation.errorCode === undefined ? {} : { errorCode: derivation.errorCode }),
      comparison,
      corroboration,
      falseSuccess,
      prUrl: derivation.prUrl,
      urlResolved: derivation.urlResolved,
      lastMessage: derivation.lastMessage,
      evidenceRefs: [`attempt:${attemptId}`],
      ...(divergenceRef === undefined ? {} : { divergenceRef }),
    });
  } finally {
    ports.releaseLease(releaseCause);
  }
};
