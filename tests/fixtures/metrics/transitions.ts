/**
 * Transition-history seeds for the metrics suites (GH-299 test plan §6).
 *
 * The delivered `phase.transition` append path is reused, so the fold reads
 * only records a production writer could have produced. The shapes cover a
 * complete pair, a right-censored ref, and the unusable-set cells.
 */
import type { StateStorePort } from "../../../packages/core/src/contracts/index";
import { appendTransitions, type TransitionSeed } from "../spend/harness";

export { appendTransitions, type TransitionSeed };

export const T0 = "2026-11-15T09:00:00.000Z";
export const T_PLUS_3H = "2026-11-15T12:00:00.000Z";
export const T_PLUS_5H = "2026-11-15T14:00:00.000Z";
export const T_PLUS_7H = "2026-11-15T16:00:00.000Z";

/** The committed interval: clarify_scope.started to pr_creation.completed (7h). */
export const completeHistory = (): readonly TransitionSeed[] => [
  { phaseId: "clarify_scope", operation: "complete", timestamp: T0 },
  { phaseId: "specification", operation: "complete", timestamp: "2026-11-15T10:00:00.000Z" },
  { phaseId: "delivery", operation: "complete", timestamp: "2026-11-15T14:30:00.000Z" },
  { phaseId: "quality_gates", operation: "complete", timestamp: "2026-11-15T15:30:00.000Z" },
  { phaseId: "pr_creation", operation: "complete", timestamp: T_PLUS_7H },
];

/** An in-flight ref: no pr_creation completion; quality_gates anchors the bound. */
export const censoredHistory = (): readonly TransitionSeed[] => [
  { phaseId: "clarify_scope", operation: "complete", timestamp: T0 },
  { phaseId: "quality_gates", operation: "complete", timestamp: T_PLUS_3H },
];

/** No usable pair: an empty, reopen-only, completion-only, or unparseable set. */
export const unusableHistories = (): Readonly<Record<string, readonly TransitionSeed[]>> => ({
  empty: [],
  reopenOnly: [
    { phaseId: "clarify_scope", operation: "reopen", timestamp: T0, reason: "scope changed" },
  ],
  completionOnly: [{ phaseId: "quality_gates", operation: "complete", timestamp: T_PLUS_3H }],
  reopenedStart: [
    {
      phaseId: "clarify_scope",
      operation: "reopen",
      timestamp: T0,
      reason: "owner changed scope",
    },
    { phaseId: "quality_gates", operation: "complete", timestamp: T_PLUS_3H },
  ],
});

/** Seed one history into the fixture store. */
export const seedHistory = (
  store: StateStorePort,
  ref: string,
  transitions: readonly TransitionSeed[],
): void => {
  appendTransitions(store, ref, transitions);
};
