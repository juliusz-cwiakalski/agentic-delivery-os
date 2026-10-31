/**
 * GitLab merge-status normalization (GH-188 OQ-D).
 *
 * The native-value → delivery-state table is declared, reviewable adapter data.
 * `detailed_merge_status` is authoritative when present and `merge_status` is
 * the fallback; asynchronous values map to non-terminal states only; a native
 * value outside the table fails visibly instead of silently flattening.
 */
import type { DeliveryRequestReviewState } from "@delivery-os/core/contracts";

/** One declared native merge-status row. */
export type GitLabMergeStatusRule = {
  readonly nativeValue: string;
  /** True only for a native value that already asserts a terminal delivery outcome. */
  readonly terminal: boolean;
  readonly reviewStateWhenOpen: DeliveryRequestReviewState;
};

/** The declared table for the observed provider value set. */
export const GITLAB_MERGE_STATUS_RULES: readonly GitLabMergeStatusRule[] = [
  { nativeValue: "checking", terminal: false, reviewStateWhenOpen: "open" },
  { nativeValue: "unchecked", terminal: false, reviewStateWhenOpen: "open" },
  { nativeValue: "ci_still_running", terminal: false, reviewStateWhenOpen: "open" },
  { nativeValue: "approvals_syncing", terminal: false, reviewStateWhenOpen: "open" },
  { nativeValue: "mergeable", terminal: false, reviewStateWhenOpen: "open" },
  { nativeValue: "can_be_merged", terminal: false, reviewStateWhenOpen: "open" },
  { nativeValue: "not_approved", terminal: false, reviewStateWhenOpen: "open" },
  {
    nativeValue: "discussions_not_resolved",
    terminal: false,
    reviewStateWhenOpen: "changes-requested",
  },
  { nativeValue: "cannot_be_merged", terminal: false, reviewStateWhenOpen: "changes-requested" },
  { nativeValue: "draft_status", terminal: false, reviewStateWhenOpen: "draft" },
];

/** The fields the merge-status rule consumes. */
export type GitLabMergeStatusInput = {
  readonly mrState: string;
  readonly draft: boolean;
  readonly approvals: number;
  readonly mergeStatus?: string;
  readonly detailedMergeStatus?: string;
};

/** A resolved review state plus whether the native value is terminal. */
export type GitLabMergeStatusResolution =
  | {
      readonly ok: true;
      readonly reviewState: DeliveryRequestReviewState;
      readonly terminal: boolean;
    }
  | { readonly ok: false; readonly detail: string };

/** Build a resolver over a rule table (production uses the declared table). */
export const createGitLabReviewStateResolver =
  (rules: readonly GitLabMergeStatusRule[]) =>
  (input: GitLabMergeStatusInput): GitLabMergeStatusResolution => {
    if (input.mrState === "merged") {
      return { ok: true, reviewState: "merged", terminal: true };
    }
    if (input.mrState === "closed" || input.mrState === "locked") {
      return { ok: true, reviewState: "closed", terminal: true };
    }
    if (input.draft) return { ok: true, reviewState: "draft", terminal: false };

    const native = input.detailedMergeStatus ?? input.mergeStatus;
    if (native === undefined) return { ok: true, reviewState: "open", terminal: false };

    const rule = rules.find((candidate) => candidate.nativeValue === native);
    if (rule === undefined) {
      return { ok: false, detail: `unmapped GitLab merge status "${native}"` };
    }
    const reviewState =
      input.approvals > 0 && rule.reviewStateWhenOpen === "open"
        ? "approved"
        : rule.reviewStateWhenOpen;
    return { ok: true, reviewState, terminal: rule.terminal };
  };

/** The production resolver over the declared table. */
export const resolveGitLabReviewState: (
  input: GitLabMergeStatusInput,
) => GitLabMergeStatusResolution = createGitLabReviewStateResolver(GITLAB_MERGE_STATUS_RULES);
