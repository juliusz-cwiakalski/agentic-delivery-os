/**
 * The boundary routes the steer read derives from the delivered phase fold
 * (GH-298 DEC-5): no record, every entry completed, an entry in progress, and a
 * reordered complete fold.
 */
import type { SteerPhaseFoldView } from "../../../packages/core/src/contracts/index";

export const NO_PHASE_RECORD: SteerPhaseFoldView = { present: false, entries: [] };

export const THREE_COMPLETED: SteerPhaseFoldView = {
  present: true,
  entries: [
    {
      phaseId: "delivery",
      started: "2026-11-16T08:00:00.000Z",
      completed: "2026-11-16T09:00:00.000Z",
    },
    {
      phaseId: "review_fix",
      started: "2026-11-16T09:00:00.000Z",
      completed: "2026-11-16T10:00:00.000Z",
    },
    {
      phaseId: "quality_gates",
      started: "2026-11-16T10:00:00.000Z",
      completed: "2026-11-16T11:00:00.000Z",
    },
  ],
};

export const REOPENED_THEN_COMPLETED: SteerPhaseFoldView = {
  present: true,
  entries: [
    {
      phaseId: "delivery",
      started: "2026-11-16T08:00:00.000Z",
      completed: "2026-11-16T09:00:00.000Z",
    },
    {
      phaseId: "review_fix",
      started: "2026-11-16T09:00:00.000Z",
      completed: "2026-11-16T10:00:00.000Z",
    },
    {
      phaseId: "quality_gates",
      started: "2026-11-16T10:00:00.000Z",
      completed: "2026-11-16T11:00:00.000Z",
    },
  ],
};

export const LAST_ENTRY_IN_PROGRESS: SteerPhaseFoldView = {
  present: true,
  entries: [
    {
      phaseId: "delivery",
      started: "2026-11-16T08:00:00.000Z",
      completed: "2026-11-16T09:00:00.000Z",
    },
    { phaseId: "review_fix", started: "2026-11-16T09:30:00.000Z", completed: null },
  ],
};

export const reorder = (fold: SteerPhaseFoldView): SteerPhaseFoldView => ({
  present: fold.present,
  entries: [...fold.entries].reverse(),
});
