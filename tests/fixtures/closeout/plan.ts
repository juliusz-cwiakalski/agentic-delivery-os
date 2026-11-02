/** Fixed plan fixtures shared by the planner and golden suites. */
import { CLOSEOUT_STEP_IDS } from "../../../packages/core/src/contracts/index";

export const EXPECTED_STEP_IDS = [...CLOSEOUT_STEP_IDS];

export const EXPECTED_PLAN_LABELS = [
  "ticket to done",
  "lifecycle label sweep",
  "unassign",
  "owed-flip sweep",
  "comment resolution",
  "checkout restore",
  "squash-safe local branch cleanup",
];

export const PLAN_MODES = ["plan", "applied"] as const;
