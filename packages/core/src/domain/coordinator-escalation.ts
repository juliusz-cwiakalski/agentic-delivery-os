/**
 * The owner-escalation projection and the reserved-slot predicate (GH-241 F-6,
 * DEC-5; AC-F6-1..3).
 *
 * The reserved-slot predicate is payload-only: type `decision-needed`, audience
 * `owner`, lane `coordinator`, and a `<coordinatorId>#<budgetEpochId>` ref with
 * exactly one `#` and both sides non-empty. Neither renderer reads coordinator
 * state for it, and the rendered bound stays eight with at most seven others.
 */
import {
  COORDINATOR_ESCALATION_STATES,
  COORDINATOR_OTHER_QUESTION_BOUND,
  COORDINATOR_RESERVED_ESCALATION_PREDICATE,
  COORDINATOR_RENDERED_QUESTION_BOUND,
  type CoordinatorEscalationState,
  type CoordinatorExhaustionOption,
} from "#contracts";

/** The minimum payload fields the predicate reads. */
export type CoordinatorEscalationPayload = {
  readonly type: string;
  readonly audience: string;
  readonly lane: string;
  readonly ref: string | null;
};

/** The `<coordinatorId>#<budgetEpochId>` ref shape check (payload only). */
export const isCoordinatorEscalationRef = (ref: string | null): boolean => {
  if (ref === null) return false;
  const separator = COORDINATOR_RESERVED_ESCALATION_PREDICATE.refSeparator;
  const parts = ref.split(separator);
  if (parts.length !== COORDINATOR_RESERVED_ESCALATION_PREDICATE.refParts) return false;
  return parts.every((part) => part.length > 0);
};

/** The pure payload predicate; it performs no read and widens no other rule. */
export const isReservedEscalationQuestion = (
  payload: CoordinatorEscalationPayload,
): boolean =>
  payload.type === COORDINATOR_RESERVED_ESCALATION_PREDICATE.type &&
  payload.audience === COORDINATOR_RESERVED_ESCALATION_PREDICATE.audience &&
  payload.lane === COORDINATOR_RESERVED_ESCALATION_PREDICATE.lane &&
  isCoordinatorEscalationRef(payload.ref);

/** One question slice the projection needs (no coordinator state). */
export type CoordinatorQuestionSlice = {
  readonly id: string;
  readonly index: number;
};

/**
 * Project the rendered questions with the reserved slot first.
 *
 * The reserved question (when present in the open set) renders at index 0, then
 * up to seven other questions in their existing rank order. When the open set is
 * larger than the bound the lowest-ranked question is the one displaced, and the
 * omitted count is the exact remainder. With no reserved question the ordinary
 * first-eight cap applies unchanged.
 */
export const projectReservedSlotQuestions = (
  ranked: readonly CoordinatorQuestionSlice[],
  reservedId: string | null,
): { readonly rendered: readonly CoordinatorQuestionSlice[]; readonly omitted: number } => {
  if (reservedId === null) {
    const rendered = ranked.slice(0, COORDINATOR_RENDERED_QUESTION_BOUND);
    return { rendered, omitted: ranked.length - rendered.length };
  }
  const reserved = ranked.find((question) => question.id === reservedId);
  if (reserved === undefined) {
    const rendered = ranked.slice(0, COORDINATOR_RENDERED_QUESTION_BOUND);
    return { rendered, omitted: ranked.length - rendered.length };
  }
  const others = ranked
    .filter((question) => question.id !== reservedId)
    .slice(0, COORDINATOR_OTHER_QUESTION_BOUND);
  const rendered = [reserved, ...others];
  return { rendered, omitted: ranked.length - rendered.length };
};

/** The derived escalation state the commands report. */
export const projectEscalationState = (input: {
  readonly terminal: boolean;
  readonly publishFailed: boolean;
}): CoordinatorEscalationState => {
  if (input.publishFailed) return "exhausted-escalation-failed";
  return input.terminal ? "exhausted-escalated" : "not-exhausted";
};

/** The declared recovery options, in declared order. */
export const escalationOptions = (): readonly CoordinatorExhaustionOption[] => [
  "restart-fresh-budget",
  "park-owner-review",
];

/** The declared escalation states as a runtime guard for persisted data. */
export const isEscalationState = (value: string): value is CoordinatorEscalationState =>
  (COORDINATOR_ESCALATION_STATES as readonly string[]).includes(value);
