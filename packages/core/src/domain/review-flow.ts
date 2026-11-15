/**
 * Pure review flow over the declared member set (GH-310 F-6, DM-7, DEC-8, DEC-17).
 *
 * No I/O, no store, no command, no live call: the flow is a pure function of the
 * change ref, the declared member set, and injected `ReviewObservation` values.
 * `runId` is the stable identity of the sorted declared set, so an unchanged set
 * is the same run and adds no verdict entry.
 */
import type {
  CrossRepositoryReviewFlow,
  CrossRepositoryReviewFlowVerdict,
  PlanMemberDeclaration,
  ReviewObservation,
  VerifyGatesReviewVerdict,
} from "#contracts";
import { sha256Hex } from "./sha256.js";

/**
 * The run identity: a digest over the change ref and the sorted declared member
 * set, each element being `repoKey` plus its pull request or an explicit empty
 * marker when the member declares none (DEC-8).
 */
export const reviewRunId = (
  changeRef: string,
  members: readonly PlanMemberDeclaration[],
): string => {
  const elements = members
    .map((member) => [member.repoKey, member.pullRequest ?? ""] as const)
    .sort((left, right) =>
      left[0] === right[0] ? (left[1] < right[1] ? -1 : 1) : left[0] < right[0] ? -1 : 1,
    );
  return sha256Hex(JSON.stringify([changeRef, ...elements]));
};

const observationVerdict = (observation: ReviewObservation): VerifyGatesReviewVerdict => {
  if (observation.verdicts.length === 0) return "unreviewed";
  return observation.verdicts.every((verdict) => verdict === "pass") ? "pass" : "fail";
};

/** The one review run: one verdict per declared member, in declared order. */
export const reviewFlowFor = (input: {
  readonly changeRef: string;
  readonly members: readonly PlanMemberDeclaration[];
  readonly observations: readonly ReviewObservation[];
}): CrossRepositoryReviewFlow => {
  let complete = true;
  const verdicts: CrossRepositoryReviewFlowVerdict[] = input.members.map((member) => {
    const matched = input.observations.filter(
      (observation) =>
        observation.repoKey === member.repoKey &&
        member.pullRequest !== undefined &&
        observation.pullRequest === member.pullRequest,
    );
    if (matched.length !== 1) complete = false;
    const verdict: VerifyGatesReviewVerdict =
      matched.length === 1
        ? observationVerdict(matched[0] as ReviewObservation)
        : matched.length === 0
          ? "unreviewed"
          : "fail";
    return {
      repoKey: member.repoKey,
      ...(member.pullRequest === undefined ? {} : { pullRequest: member.pullRequest }),
      verdict,
    };
  });
  return { runId: reviewRunId(input.changeRef, input.members), complete, verdicts };
};
