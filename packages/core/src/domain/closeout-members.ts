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
  CloseoutMemberCleanup,
  CloseoutMemberCleanupPlanOutcome,
  CloseoutMemberIssueClosure,
  CloseoutMemberIssuePlanOutcome,
  CloseoutMemberPlan,
  CloseoutMemberReport,
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
