/** Label fixtures: all six lifecycle labels, the kept type label, a vendor label. */
import type { WorkItem } from "../../../packages/core/src/contracts/index";
import { BASE_REF, BRANCH_NAME, HEAD_SHA, MERGED_HEAD_SHA, SYSTEM_NAME } from "./harness";

export const LIFECYCLE_LABELS = [
  "planning",
  "spec-ready",
  "readiness-passed",
  "in-progress",
  "review",
  "blocked",
] as const;

export const VENDOR_LABEL = "vendor-label";

export const FULL_LABEL_SET = ["change", ...LIFECYCLE_LABELS, VENDOR_LABEL];

export const SWEPT_LABEL_SET = ["change", VENDOR_LABEL, "delivered"];

export const labelWorkItem = (labels: readonly string[]): WorkItem => ({
  identity: { systemName: SYSTEM_NAME, entityId: "183" },
  title: "Label fixture",
  status: { nativeStatus: "open", deliveryState: "in-review" },
  labels,
  assignee: "owner-placeholder",
  relations: [],
});

export const BRANCH_FIXTURE = { name: BRANCH_NAME, head: HEAD_SHA };
export const MERGED_FIXTURE = { name: BRANCH_NAME, head: MERGED_HEAD_SHA, baseRef: BASE_REF };
