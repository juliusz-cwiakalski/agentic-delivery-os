/**
 * The GH-233 review-deferral record (GH-240 F-10, DEC-13).
 *
 * F-8 (Claude Code file-read budget) and F-11 (store-scoped orphan/invalid
 * disclosure) are resolved on the closeout path. F-9 (host-runner semantics) is
 * explicitly re-deferred: the host runner is not on the closeout extraction
 * path, and the first production consumer arrives with dispatch (M1-S9).
 */
export type HarnessReviewDeferral = {
  readonly finding: "F-8" | "F-9" | "F-11";
  readonly status: "resolved" | "re-deferred";
  readonly reason: string;
  readonly ownerStory: string;
  readonly revisitTrigger: string;
};

export const HARNESS_REVIEW_DEFERRALS: readonly HarnessReviewDeferral[] = [
  {
    finding: "F-8",
    status: "resolved",
    reason:
      "The Claude Code reader checks the declared byte cap before the read and reads at most that many encoded bytes.",
    ownerStory: "GH-240",
    revisitTrigger: "a new transcript format or a changed per-file cap",
  },
  {
    finding: "F-11",
    status: "resolved",
    reason:
      "Parentless sessions without a work-item port are a bounded store-level warning; only the capturing delivery's own unattributable/invalid sessions are failed sessions.",
    ownerStory: "GH-240",
    revisitTrigger: "a store that exposes a delivery port for parentless sessions",
  },
  {
    finding: "F-9",
    status: "re-deferred",
    reason:
      "The host runner is not on the closeout extraction path and no production consumer exists until dispatch (M1-S9).",
    ownerStory: "M1-S9",
    revisitTrigger: "the dispatch path or any runner consumer joins the closeout path",
  },
] as const;
