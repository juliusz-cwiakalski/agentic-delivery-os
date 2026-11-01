/** The BR-01..BR-12 safety matrix fixtures (test-plan §4.6). */
import { BRANCH_NAME, MERGED_HEAD_SHA } from "./harness";

export type BranchCase = {
  readonly id: string;
  readonly branchName: string;
  readonly localHead: string;
  readonly mergedHeadSha?: string;
  readonly mergedObserved: boolean;
  readonly sourceRef?: string;
  readonly checkedOutElsewhere: boolean;
  readonly restoreRequired?: boolean;
  readonly restoreSucceeded?: boolean;
  readonly expected: "eligible" | "refuse" | "protected" | "absent" | "ambiguous";
  readonly reason?: string;
};

export const BRANCH_CASES: readonly BranchCase[] = [
  {
    id: "BR-01",
    branchName: BRANCH_NAME,
    localHead: MERGED_HEAD_SHA,
    mergedHeadSha: MERGED_HEAD_SHA,
    mergedObserved: true,
    sourceRef: BRANCH_NAME,
    checkedOutElsewhere: false,
    expected: "eligible",
  },
  {
    id: "BR-02",
    branchName: BRANCH_NAME,
    localHead: "3333333333333333333333333333333333333333",
    mergedHeadSha: MERGED_HEAD_SHA,
    mergedObserved: true,
    sourceRef: BRANCH_NAME,
    checkedOutElsewhere: false,
    expected: "refuse",
    reason: "merged-head-mismatch",
  },
  {
    id: "BR-03",
    branchName: "main-tools",
    localHead: MERGED_HEAD_SHA,
    mergedHeadSha: MERGED_HEAD_SHA,
    mergedObserved: true,
    sourceRef: "main-tools",
    checkedOutElsewhere: false,
    expected: "protected",
    reason: "protected-ref",
  },
  {
    id: "BR-04",
    branchName: BRANCH_NAME,
    localHead: MERGED_HEAD_SHA,
    mergedHeadSha: MERGED_HEAD_SHA,
    mergedObserved: true,
    sourceRef: BRANCH_NAME,
    checkedOutElsewhere: true,
    expected: "refuse",
    reason: "foreign-worktree",
  },
  {
    id: "BR-06",
    branchName: BRANCH_NAME,
    localHead: "4444444444444444444444444444444444444444",
    mergedHeadSha: MERGED_HEAD_SHA,
    mergedObserved: true,
    sourceRef: BRANCH_NAME,
    checkedOutElsewhere: false,
    expected: "ambiguous",
  },
  {
    id: "BR-07",
    branchName: BRANCH_NAME,
    localHead: MERGED_HEAD_SHA,
    mergedObserved: true,
    sourceRef: BRANCH_NAME,
    checkedOutElsewhere: false,
    expected: "refuse",
    reason: "merged-head-unknown",
  },
  {
    id: "BR-09",
    branchName: BRANCH_NAME,
    localHead: MERGED_HEAD_SHA,
    mergedHeadSha: MERGED_HEAD_SHA,
    mergedObserved: true,
    sourceRef: BRANCH_NAME,
    checkedOutElsewhere: false,
    restoreRequired: true,
    restoreSucceeded: false,
    expected: "refuse",
    reason: "restore-refused",
  },
];
