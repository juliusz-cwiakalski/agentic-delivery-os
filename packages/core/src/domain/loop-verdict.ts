/**
 * The loop's own two-signal stuck predicate (GH-348 F-5, DM-6, DEC-3).
 *
 * A pure total function over three injected fact sets — sourced progress,
 * artifact advance, and the read-only delivery corroborator — because the
 * delivered `evaluateStuck` decides a delivery expectation and would kill a CEO
 * blocked on a healthy delivery. The delivered verdict vocabulary and the
 * delivered persisted reasons are reused; no new verdict, reason, or evidence
 * class is introduced.
 *
 * `stuck` requires ALL of: a live session; sourced progress `zero` for at least
 * `stuck-window` measured from the last observation the running supervisor
 * holds; no artifact advance since that observation; and a READABLE
 * corroborator reporting `none`. Any unreadable input is `unevaluable`, which
 * never kills.
 */
import {
  BLOCKER_ANSWER_RECORD_KIND,
  type CoordinatorProgressState,
  type CoordinatorVerdict,
  LOOP_RESTART_REASON,
  LOOP_UNEVALUABLE_REASON,
  type LoopDeliveryReading,
  type StateRecord,
} from "#contracts";

/** The evidence-corpus byte bound (NFR-10, DM-6). */
export const LOOP_MAX_EVIDENCE_BYTES = 512 as const;

export type LoopVerdictInput = {
  /** Whether a session is live at this evaluation. */
  readonly liveSession: boolean;
  /** The projected new-turn fact from the delivered mapper. */
  readonly progress: CoordinatorProgressState;
  /** When the progress reading was taken, or `null` when absent. */
  readonly progressObservedAtMs: number | null;
  /** The last sourced-progress observation this supervisor holds. */
  readonly lastProgressAtMs: number | null;
  readonly nowMs: number;
  readonly stuckWindowMs: number;
  readonly progressBoundMs: number;
  /** Whether a merge or blocker-answer record landed since the observation. */
  readonly artifactAdvanced: boolean;
  /** The read-only delivery corroborator reading. */
  readonly delivery: LoopDeliveryReading;
};

export type LoopVerdictResult = {
  readonly verdict: CoordinatorVerdict;
  readonly reason: typeof LOOP_RESTART_REASON | typeof LOOP_UNEVALUABLE_REASON | null;
  readonly evidence: string | null;
};

/** The bounded, single-line, identifier-only evidence corpus (NFR-10). */
export const evidenceCorpus = (input: {
  readonly traffic: CoordinatorProgressState;
  readonly delivery: LoopDeliveryReading;
  readonly progressAgeMs: number | null;
  readonly windowMs: number;
}): string => {
  const age =
    input.progressAgeMs === null ? "none" : String(Math.max(0, Math.trunc(input.progressAgeMs)));
  const corpus = `traffic=${input.traffic} delivery=${input.delivery} progressAgeMs=${age} windowMs=${String(
    input.windowMs,
  )}`;
  return corpus.length > LOOP_MAX_EVIDENCE_BYTES
    ? corpus.slice(0, LOOP_MAX_EVIDENCE_BYTES)
    : corpus;
};

const progressing: LoopVerdictResult = { verdict: "progressing", reason: null, evidence: null };

/**
 * Decide the verdict. The fold order is explicit so no unreadable input can be
 * laundered into a kill: unknown progress first, then an unreadable
 * corroborator, then the two progressing causes, then the window test.
 */
export const evaluateLoopVerdict = (input: LoopVerdictInput): LoopVerdictResult => {
  const windowMs = input.stuckWindowMs;
  const observedAt = input.lastProgressAtMs ?? input.progressObservedAtMs;
  const progressAgeMs = observedAt === null ? null : input.nowMs - observedAt;

  if (!input.liveSession) return progressing;

  if (input.progress === "unknown" || input.delivery === "unknown") {
    return {
      verdict: "unevaluable",
      reason: LOOP_UNEVALUABLE_REASON,
      evidence: evidenceCorpus({
        traffic: input.progress,
        delivery: input.delivery,
        progressAgeMs,
        windowMs,
      }),
    };
  }

  // A corroborated healthy delivery vetoes a kill: a CEO blocked on a
  // progressing delivery has not stalled (INV-DM-3, AC-F5-3).
  if (input.delivery === "in-progress") return progressing;

  if (input.progress === "positive") {
    // The declared progressing cause is sourced progress POSITIVE WITHIN
    // `coordinator.progress-bound` (F-5). An observation with no timestamp is
    // treated as fresh (no age evidence exists), and a positive reading older
    // than the bound is a STALE sourced signal: it must not claim the
    // fresh-progress cause, and it must never be laundered into a kill either,
    // so the kill-safe `unevaluable` arm reads it and the loop continues.
    const freshAt = input.progressObservedAtMs ?? input.lastProgressAtMs;
    const fresh = freshAt === null || input.nowMs - freshAt <= input.progressBoundMs;
    if (fresh) return progressing;
    return {
      verdict: "unevaluable",
      reason: LOOP_UNEVALUABLE_REASON,
      evidence: evidenceCorpus({
        traffic: input.progress,
        delivery: input.delivery,
        progressAgeMs,
        windowMs,
      }),
    };
  }

  const aged = progressAgeMs !== null && progressAgeMs >= windowMs;
  if (!aged || input.artifactAdvanced) return progressing;

  return {
    verdict: "stuck",
    reason: LOOP_RESTART_REASON,
    evidence: evidenceCorpus({
      traffic: input.progress,
      delivery: input.delivery,
      progressAgeMs,
      windowMs,
    }),
  };
};

/**
 * The progress reading the predicate judges: a positive delta within
 * `progress-bound` is a fresh sourced observation; a sourced zero or an unknown
 * is not.
 */
export const observeProgress = (input: {
  readonly progress: CoordinatorProgressState;
  readonly observedAtMs: number | null;
  readonly nowMs: number;
  readonly progressBoundMs: number;
  readonly lastProgressAtMs: number | null;
}): number | null => {
  if (input.progress !== "positive") return input.lastProgressAtMs;
  const at = input.observedAtMs ?? input.nowMs;
  if (input.nowMs - at > input.progressBoundMs) return input.lastProgressAtMs;
  return Math.max(at, input.lastProgressAtMs ?? at);
};

/** The delivered merge-transaction record kind whose instant is `recordedAt`. */
export const MERGE_TRANSACTION_RECORD_KIND = "merge.transaction" as const;

/**
 * The instant one artifact record carries, resolved PER KIND (F-5/DM-6):
 * `recordedAt` for a `merge.transaction`, `answeredAt` for a `blocker.answer`
 * (the delivered answer payload has no `recordedAt`). `null` means the record
 * genuinely carries no usable instant.
 */
export const artifactInstantOf = (record: StateRecord): string | null => {
  const payload = record.payload;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
  const field = record.kind === BLOCKER_ANSWER_RECORD_KIND ? "answeredAt" : "recordedAt";
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/**
 * The baseline-relative artifact-advance signal (F-5 "no artifact advance since
 * that observation"): true when a `merge.transaction` or `blocker.answer` record
 * was recorded AFTER `sinceMs`. A `null` baseline can have no "since", and a
 * record whose OWN instant is unusable counts as an advance (kill-safe: it can
 * only delay a verdict, never license one).
 */
export const artifactAdvancedSince = (
  records: readonly StateRecord[],
  sinceMs: number | null,
): boolean => {
  if (sinceMs === null) return false;
  return records.some((record) => {
    if (
      record.kind !== MERGE_TRANSACTION_RECORD_KIND &&
      record.kind !== BLOCKER_ANSWER_RECORD_KIND
    ) {
      return false;
    }
    const instant = artifactInstantOf(record);
    if (instant === null) return true;
    const at = Date.parse(instant);
    return Number.isFinite(at) && at > sinceMs;
  });
};
