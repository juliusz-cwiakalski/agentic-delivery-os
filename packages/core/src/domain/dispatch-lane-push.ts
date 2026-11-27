/**
 * The pure lane-push rules (GH-416 F-1, F-3, F-5; DM-1..DM-5).
 *
 * The structural branch resolution (declaration cross-checked with the
 * delivered convention read), the act-outcome-to-record mapping, the
 * evidence-reference family, the newest-matching-record selection, and the
 * record-to-status projection. No I/O, no clock, no ambient state.
 */
import {
  DISPATCH_LANE_PUSH_VERDICTS,
  DISPATCH_PUSH_RECORDABLE_CAUSES,
  type DispatchLanePushActOutcome,
  type DispatchLanePushRecord,
  type DispatchLanePushVerdict,
  type DispatchPushRecordableCause,
  type DispatchStatusLanePushFact,
  dispatchLanePushCauseEvidenceRef,
  dispatchLanePushEvidenceRef,
} from "#contracts";
import type { CloseoutBranchSelection } from "./closeout.js";

/** The lane-push verdict pair, read from the closed set (never re-typed). */
const [PUSHED_VERDICT, FAILED_VERDICT] = DISPATCH_LANE_PUSH_VERDICTS;

/** The recordable child-act causes, read from the closed set (never re-typed). */
const [, , , , TIMED_OUT_CAUSE, , UNCLASSIFIED_CAUSE] = DISPATCH_PUSH_RECORDABLE_CAUSES;

/** The bounded detail length the refusal sentence obeys (single line). */
const REFUSAL_DETAIL_MAX_CHARS = 240;

/** The bounded single-line refusal detail. */
const bounded = (text: string): string => {
  const single = text.replace(/[\r\n]+/gu, " ").trim();
  return single.length <= REFUSAL_DETAIL_MAX_CHARS
    ? single
    : `${single.slice(0, REFUSAL_DETAIL_MAX_CHARS - 1)}…`;
};

/** The closed pre-act resolution refusal reasons (AC-F1-2, NFR-7). */
export type LanePushRefusalReason =
  | "declaration-mismatch"
  | "no-match"
  | "ambiguous"
  | "unsafe-branch"
  | "protected-ref";

/** The structural branch resolution: one resolved name or a typed refusal. */
export type LanePushResolution =
  | { readonly kind: "resolved"; readonly branch: string }
  | {
      readonly kind: "refused";
      readonly reason: LanePushRefusalReason;
      readonly detail: string;
    };

/**
 * Resolve the change branch from the delivered convention selection and the
 * change record's opaque `branch:` declaration (F-1, NFR-7).
 *
 * Exactly one rule: a unique convention match that agrees with the declaration
 * (when one exists) resolves. Every other state is a refusal naming what was
 * observed; nothing is guessed. The safe-ref and protected-name checks are the
 * last two guards; the protected check is defence in depth and unreachable
 * from a resolved convention match (R13).
 */
export const resolveLanePushBranch = (input: {
  readonly selection: CloseoutBranchSelection;
  readonly declaration?: string;
  readonly isSafe: (name: string) => boolean;
  readonly protectedNames: readonly string[];
}): LanePushResolution => {
  const { selection } = input;
  if (selection.kind === "none") {
    return {
      kind: "refused",
      reason: "no-match",
      detail: bounded("no local branch matches the work-item branch convention"),
    };
  }
  if (selection.kind === "ambiguous") {
    const candidates = selection.branches
      .map((branch) => branch.name)
      .sort()
      .join(", ");
    return {
      kind: "refused",
      reason: "ambiguous",
      detail: bounded(`more than one branch matches the convention: ${candidates}`),
    };
  }
  const name = selection.branch.name;
  if (input.declaration !== undefined && input.declaration !== name) {
    return {
      kind: "refused",
      reason: "declaration-mismatch",
      detail: bounded(
        `the change record declares branch ${input.declaration} but the branch read resolves ${name}`,
      ),
    };
  }
  if (!input.isSafe(name)) {
    return {
      kind: "refused",
      reason: "unsafe-branch",
      detail: bounded(`the resolved branch ${name} is not a safe ref`),
    };
  }
  if (input.protectedNames.includes(name)) {
    return {
      kind: "refused",
      reason: "protected-ref",
      detail: bounded(`the resolved branch ${name} is protected`),
    };
  }
  return { kind: "resolved", branch: name };
};

/** The act's verdict and, on a refusal, one closed recordable cause. */
export type LanePushActVerdict = {
  readonly verdict: DispatchLanePushVerdict;
  readonly cause?: DispatchPushRecordableCause;
};

const isRecordableCause = (value: string): value is DispatchPushRecordableCause =>
  (DISPATCH_PUSH_RECORDABLE_CAUSES as readonly string[]).includes(value);

/**
 * Map the seam's outcome to the lane-push verdict and cause (DM-4): an accepted
 * act is `pushed`; a timeout is `timed-out`; a rejection or spawn-level failure
 * carries the seam's closed cause (an unrecognised detail is `unclassified`).
 */
export const lanePushVerdictOfAct = (outcome: DispatchLanePushActOutcome): LanePushActVerdict => {
  if (outcome.outcome === "accepted") return { verdict: PUSHED_VERDICT };
  if (outcome.outcome === "timed-out") return { verdict: FAILED_VERDICT, cause: TIMED_OUT_CAUSE };
  const cause = isRecordableCause(outcome.detail) ? outcome.detail : UNCLASSIFIED_CAUSE;
  return { verdict: FAILED_VERDICT, cause };
};

/**
 * The newest lane-push record for one attempt: the repository filter is applied
 * first, then the exact attempt-identity match (F-3 "The read at
 * classification"). A record without an identity never matches.
 */
export const newestLanePushForAttempt = (
  records: readonly DispatchLanePushRecord[],
  repository: string,
  attemptId: string,
): DispatchLanePushRecord | undefined => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record === undefined) continue;
    if (record.repository !== repository) continue;
    if (record.attemptId !== attemptId) continue;
    return record;
  }
  return undefined;
};

/** The evidence references for one record (DM-2): one, or a failure plus its cause. */
export const lanePushEvidenceRefsOf = (record: DispatchLanePushRecord): readonly string[] => {
  if (record.verdict === PUSHED_VERDICT) {
    return [dispatchLanePushEvidenceRef(PUSHED_VERDICT)];
  }
  const cause = record.cause ?? UNCLASSIFIED_CAUSE;
  return [dispatchLanePushEvidenceRef(FAILED_VERDICT), dispatchLanePushCauseEvidenceRef(cause)];
};

/** The additive `lanePush` status fact: the record carried verbatim (DM-3). */
export const lanePushFactOf = (record: DispatchLanePushRecord): DispatchStatusLanePushFact => ({
  verdict: record.verdict,
  branch: record.branch,
  head: record.head,
  ...(record.cause === undefined ? {} : { cause: record.cause }),
  recordedAt: record.recordedAt,
});
