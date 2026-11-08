/**
 * The daemon-path classification and attempt-record producer (GH-239 F-10;
 * AC-F10-2; EVT-1).
 *
 * It shares the one shared classifier and the one truth derivation with the
 * one-shot path, so a daemon-driven attempt and a one-shot dispatch over the
 * same evidence agree field-for-field. Exactly one attempt record is appended
 * per daemon attempt that reaches classification; a replay appends none because
 * the attempt identity is deterministic.
 */
import {
  DELIVERY_RESULT_TOKENS,
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
  type DeliveryResultToken,
  type DispatchAttemptRecord,
  type DispatchDivergenceRecord,
  type DispatchEvidenceClass,
  type DispatchHandoverState,
  type HarnessEvidence,
  type HarnessKind,
  type HarnessOutcome,
  type StateStorePort,
} from "#contracts";
import { classifyHarnessEvidence } from "../domain/harness-classify.js";
import {
  buildComparisonRecord,
  buildCorroborationRecord,
  classifyFalseSuccess,
  dispatchFamilyOf,
} from "../domain/dispatch-comparison.js";
import { deriveDispatchResult } from "../domain/dispatch-result.js";
import type { DispatchTruthReads } from "./dispatch.js";
import { appendDispatchAttempt, appendDispatchDivergence } from "./dispatch-ledger.js";

/** A local short alias: keeps the verdict type recognizable. */
type DispatchToken = DeliveryResultToken;

/** `f` failed — the verify-class token a dispatch-derived failure reuses. */
const [, , , , f] = DELIVERY_RESULT_TOKENS;

/** The deterministic attempt identity of one daemon-driven lane attempt. */
export const daemonAttemptId = (ref: string, sessionId: string, spawnOrdinal: number): string =>
  `daemon-${ref}-${sessionId}-${spawnOrdinal}`;

/** Everything the daemon producer consumes. */
export type DaemonDispatchResultInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly ref: string;
  readonly repository: string;
  readonly sessionId: string;
  readonly spawnOrdinal: number;
  readonly harnessKind: HarnessKind;
  readonly evidenceClass: DispatchEvidenceClass;
  readonly handoverState: DispatchHandoverState;
  readonly evidence: HarnessEvidence;
  readonly collected: { readonly ok: boolean };
  readonly reads: DispatchTruthReads;
  readonly nowIso: string;
  readonly newDivergenceId: () => string;
  readonly resumeMode?: DispatchAttemptRecord["resumeMode"];
  readonly prefillCostAcknowledged?: boolean;
};

/** The producer verdict. */
export type DaemonDispatchResultOutcome =
  | {
      readonly ok: true;
      readonly attemptId: string;
      readonly token: DispatchToken;
      readonly outcome: HarnessOutcome;
      readonly appended: boolean;
    }
  | { readonly ok: false; readonly code: string };

/**
 * Derive and record one daemon-attempt verdict.
 *
 * The evidence class is a declared composition input (production default
 * `pilot`), never inferred from the outcome or read from a payload.
 */
export const recordDaemonDispatchResult = (
  input: DaemonDispatchResultInput,
): DaemonDispatchResultOutcome => {
  const evidence: HarnessEvidence = {
    ...input.evidence,
    failureReported: input.evidence.failureReported || !input.collected.ok,
  };
  const classification = classifyHarnessEvidence(evidence);
  const harnessToken = classification.token;
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
    artifacts: input.reads.artifacts,
    ledger: input.reads.ledger,
    tracker: input.reads.tracker,
    restarts: { count: 0, bound: 0 },
    handoverState: input.handoverState,
  });

  const attemptId = daemonAttemptId(input.ref, input.sessionId, input.spawnOrdinal);
  const derived = derivation.token;
  const family = dispatchFamilyOf(derived);
  const comparison =
    derivation.errorCode === "dispatch.state-unverified"
      ? buildComparisonRecord({
          kind: "dispatch-derived-failure",
          engineToken: f,
          reason: "comparison-source-unavailable",
        })
      : family === "tracker-pr"
        ? buildComparisonRecord({
            kind: "tracker-truth",
            engineToken: derived,
            trackerToken: input.reads.trackerToken ?? derived,
            urlResolved: derivation.urlResolved,
          })
        : family === "verify"
          ? buildComparisonRecord({
              kind: "verify-change",
              engineToken: derived,
              ledgerOutcome: input.reads.verifyOutcome,
            })
          : buildComparisonRecord({
              kind: "not-applicable",
              engineToken: derived,
              reason: "dispatch-session-family",
            });
  const corroboration = buildCorroborationRecord({
    token: derived,
    facts: {
      "pm-notes": input.reads.phasesComplete ? "satisfied" : "unsatisfied",
      tracker: input.reads.tracker.ok ? "satisfied" : "unsatisfied",
      ci: input.reads.ci.ok && input.reads.ci.value.verdict === "success" ? "satisfied" : "unsatisfied",
    },
  });
  const falseSuccess = classifyFalseSuccess({ token: derived, comparison, corroboration });

  let divergenceRef: string | undefined;
  if (comparison.outcome === "mismatch") {
    divergenceRef = input.newDivergenceId();
    const divergence: DispatchDivergenceRecord = {
      schema: DISPATCH_DIVERGENCE_PAYLOAD_SCHEMA,
      divergenceId: divergenceRef,
      repository: input.repository,
      ref: input.ref,
      attemptId,
      state: "open",
      comparisonClass: comparison.class,
      engineToken: derived,
      comparisonToken: comparison.token,
      evidenceRefs: [`attempt:${attemptId}`],
      recordedAt: input.nowIso,
    };
    appendDispatchDivergence(input.store, input.fenceToken, divergence);
  }

  const attempt: DispatchAttemptRecord = {
    schema: DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
    attemptId,
    repository: input.repository,
    ref: input.ref,
    harness: input.harnessKind,
    evidenceClass: input.evidenceClass,
    startedAt: input.nowIso,
    finishedAt: input.nowIso,
    handoverState: input.handoverState,
    outcome: derivation.outcome,
    token: derived,
    comparison,
    ...(divergenceRef === undefined ? {} : { divergenceRef }),
    falseSuccess,
    corroboration,
    ...(input.resumeMode === undefined ? {} : { resumeMode: input.resumeMode }),
    ...(input.prefillCostAcknowledged === undefined
      ? {}
      : { prefillCostAcknowledged: input.prefillCostAcknowledged }),
    evidenceRefs: [`attempt:${attemptId}`, "daemon:lane"],
    recordedAt: input.nowIso,
  };
  const appended = appendDispatchAttempt(input.store, input.fenceToken, attempt);
  if (!appended.ok) return { ok: false, code: appended.code };
  return {
    ok: true,
    attemptId,
    token: derived,
    outcome: derivation.outcome,
    appended: appended.appended,
  };
};
