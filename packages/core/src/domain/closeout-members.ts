/**
 * Pure per-member closeout report projection (GH-310 F-5, DM-5, DM-8, DEC-12).
 *
 * One entry per declared member in declared order. `cleanup` and
 * `issueClosure` follow the exact mode-scoped columns and are derived from the
 * member's injected observation plus that member's own closeout operations —
 * never by parsing free-form step `detail`. `landed` is boolean merge truth
 * read from the observation only.
 */
import type {
  CloseoutApplyOutcome,
  CloseoutMemberCleanup,
  CloseoutMemberCleanupPlanOutcome,
  CloseoutMemberIssueClosure,
  CloseoutMemberIssuePlanOutcome,
  CloseoutMemberPlan,
  CloseoutMemberReport,
  CloseoutOutcome,
  CloseoutPlanOutcome,
  CrossRepositoryCloseoutObservation,
} from "#contracts";
import { QUEUE_MEMBER_REF_SEPARATOR } from "#contracts";

/** The observed execution outcome of one member operation. */
export type CloseoutMemberOperationOutcome = "applied" | "satisfied" | "failed";

/** The executed-outcome index keyed by operation id (apply mode only). */
export type CloseoutMemberOutcomeIndex = Readonly<
  Record<string, CloseoutMemberOperationOutcome | undefined>
>;

/** The data mode a member report is projected for. */
export type CloseoutMemberReportMode = "plan" | "applied";

/** The delivered member-ref form shared with the queue identity (GH-310 DEC-2). */
export const closeoutMemberRef = (changeRef: string, repoKey: string): string =>
  `${changeRef}${QUEUE_MEMBER_REF_SEPARATOR}${repoKey}`;

const executed = (value: CloseoutMemberOperationOutcome | undefined): "applied" | "satisfied" =>
  value === "applied" ? "applied" : "satisfied";

/**
 * The DEC-23 fold tiers, worst first. An operation-level `failed` and a safety
 * `refused` share the top tier; `would-refuse` stands in for a plan-mode
 * refusal and `would-apply` for a plan-mode application.
 */
export const CLOSEOUT_MEMBER_FOLD_PRECEDENCE = [
  "failed|refused",
  "skipped-gap",
  "applied|would-apply",
  "satisfied",
  "skipped-noop",
] as const;

/** One closed fold tier (DEC-23). */
export type CloseoutMemberFoldTier = (typeof CLOSEOUT_MEMBER_FOLD_PRECEDENCE)[number];

const tierOf = (value: CloseoutOutcome): CloseoutMemberFoldTier => {
  switch (value) {
    case "failed":
    case "refused":
    case "would-refuse":
      return "failed|refused";
    case "skipped-gap":
      return "skipped-gap";
    case "applied":
    case "would-apply":
      return "applied|would-apply";
    case "satisfied":
      return "satisfied";
    default:
      return "skipped-noop";
  }
};

/**
 * Fold one mode's per-member (and, for `ticket-to-done`, change-level) outcomes
 * into the aggregate step outcome (GH-310 DEC-23).
 *
 * The fold is the deterministic worst case over the supplied values in the
 * given order: the highest-precedence tier present wins, so the aggregate never
 * claims a better outcome than its worst input and no single value rewrites it.
 * Within the top tier an operation-level `failed` is preserved when present,
 * otherwise the tier projects to the mode's refusal value. Plan values are
 * folded only in plan mode and apply values only in apply mode, and an empty
 * input set folds to `satisfied` (nothing to do).
 */
export function foldCloseoutMemberOutcomes(
  values: readonly CloseoutOutcome[],
  mode: "plan",
): CloseoutPlanOutcome;
export function foldCloseoutMemberOutcomes(
  values: readonly CloseoutOutcome[],
  mode: "applied",
): CloseoutApplyOutcome;
export function foldCloseoutMemberOutcomes(
  values: readonly CloseoutOutcome[],
  mode: CloseoutMemberReportMode,
): CloseoutOutcome {
  return foldMemberOutcomeTiers(values, mode);
}

const foldMemberOutcomeTiers = (
  values: readonly CloseoutOutcome[],
  mode: CloseoutMemberReportMode,
): CloseoutOutcome => {
  if (values.length === 0) return "satisfied";
  let worst = tierOf(values[0] as CloseoutOutcome);
  for (const value of values) {
    const tier = tierOf(value);
    if (
      CLOSEOUT_MEMBER_FOLD_PRECEDENCE.indexOf(tier) < CLOSEOUT_MEMBER_FOLD_PRECEDENCE.indexOf(worst)
    ) {
      worst = tier;
    }
  }
  switch (worst) {
    case "failed|refused":
      return values.includes("failed") ? "failed" : mode === "plan" ? "would-refuse" : "refused";
    case "skipped-gap":
      return "skipped-gap";
    case "applied|would-apply":
      return mode === "plan" ? "would-apply" : "applied";
    case "satisfied":
      return "satisfied";
    default:
      return "skipped-noop";
  }
};

/** Project one member's mode-scoped cleanup value (DM-5, DEC-12). */
export const projectCloseoutMemberCleanup = (
  planned: CloseoutMemberCleanupPlanOutcome,
  mode: CloseoutMemberReportMode,
  outcome: CloseoutMemberOperationOutcome | undefined,
): CloseoutMemberCleanup => {
  if (planned === "satisfied" || planned === "skipped-gap") return planned;
  if (planned === "would-refuse") return mode === "plan" ? "would-refuse" : "refused";
  if (mode === "plan") return "would-apply";
  return outcome === "applied" || outcome === "satisfied" ? executed(outcome) : "skipped-gap";
};

/** Project one member's mode-scoped issue-closure value (DM-5, DEC-12). */
export const projectCloseoutMemberIssueClosure = (
  planned: CloseoutMemberIssuePlanOutcome,
  mode: CloseoutMemberReportMode,
  outcome: CloseoutMemberOperationOutcome | undefined,
): CloseoutMemberIssueClosure => {
  if (planned === "satisfied" || planned === "skipped-noop" || planned === "skipped-gap") {
    return planned;
  }
  if (mode === "plan") return "would-apply";
  return outcome === "applied" || outcome === "satisfied" ? executed(outcome) : "skipped-gap";
};

/** Project one declared member's report entry in declared order (DM-5). */
export const projectCloseoutMember = (
  member: CloseoutMemberPlan,
  mode: CloseoutMemberReportMode,
  outcomes: CloseoutMemberOutcomeIndex,
): CloseoutMemberReport => {
  const observation: CrossRepositoryCloseoutObservation = member.observation;
  const cleanupOutcome =
    member.cleanupOperationId === undefined ? undefined : outcomes[member.cleanupOperationId];
  const issueOutcome =
    member.issueOperationId === undefined ? undefined : outcomes[member.issueOperationId];
  return {
    repoKey: observation.repoKey,
    branch: observation.branch,
    cleanup: projectCloseoutMemberCleanup(member.cleanup, mode, cleanupOutcome),
    pullRequest: observation.pullRequest,
    issueClosure: projectCloseoutMemberIssueClosure(member.issueClosure, mode, issueOutcome),
    landed: observation.merged,
  };
};

/** Project every declared member in declared order (DM-5). */
export const projectCloseoutMembers = (
  members: readonly CloseoutMemberPlan[],
  mode: CloseoutMemberReportMode,
  outcomes: CloseoutMemberOutcomeIndex,
): readonly CloseoutMemberReport[] =>
  members.map((member) => projectCloseoutMember(member, mode, outcomes));
