/**
 * GitHub pull-request review-state mapping (GH-188 F-4).
 *
 * A declared, reviewable table. The review state derives from the PR's merged /
 * state / draft flags first (terminal truth wins) and then the native review
 * decision; a `reviewDecision` that disagrees with the PR state never hides a
 * merged or closed PR.
 *
 * Issue-status mapping is not declared here: it comes from the one injected
 * `WorkflowMap` (`workflow-map.ts`), so read normalization and transition
 * writes cannot disagree.
 */
import type { DeliveryRequestReviewState } from "@delivery-os/core/contracts";

/** One declared native review-decision row. */
export type GithubReviewDecisionRule = {
  readonly nativeDecision: string;
  readonly reviewState: DeliveryRequestReviewState;
};

/**
 * The declared review-decision table for the closed native decision set.
 *
 * GitHub returns APPROVED, CHANGES_REQUESTED, or REVIEW_REQUIRED. A value
 * outside this table is not a known native decision; `resolveGithubReviewState`
 * resolves it to `GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK` ("open") instead of
 * failing visibly. The fallback is safe because merged/closed/draft terminal
 * truth is decided before the table, so a non-terminal PR can only be open. It
 * is also a named marker rather than a silent default: callers can tell an
 * unknown native decision apart from the known `REVIEW_REQUIRED` → `open` row.
 * The GitLab merge-status table keeps its own fail-visible discipline; this
 * declaration records the intentional asymmetry.
 */
export const GITHUB_REVIEW_DECISION_STATES: readonly GithubReviewDecisionRule[] = [
  { nativeDecision: "APPROVED", reviewState: "approved" },
  { nativeDecision: "CHANGES_REQUESTED", reviewState: "changes-requested" },
  { nativeDecision: "REVIEW_REQUIRED", reviewState: "open" },
];

/** The declared review state for a native decision outside the table. */
export const GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK = "open" as const;

/** The fields the review-state rule consumes. */
export type GithubReviewStateInput = {
  readonly state: string;
  readonly merged: boolean;
  readonly draft: boolean;
  readonly reviewDecision?: string;
};

/** Resolve one PR's delivery review state from its native fields. */
export const resolveGithubReviewState = (
  input: GithubReviewStateInput,
): DeliveryRequestReviewState => {
  if (input.merged) return "merged";
  if (input.state === "closed") return "closed";
  if (input.draft) return "draft";
  const decision =
    input.reviewDecision === undefined
      ? undefined
      : GITHUB_REVIEW_DECISION_STATES.find((rule) => rule.nativeDecision === input.reviewDecision);
  return decision?.reviewState ?? GITHUB_UNKNOWN_REVIEW_DECISION_FALLBACK;
};
