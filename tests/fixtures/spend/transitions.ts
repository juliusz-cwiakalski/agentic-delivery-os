/**
 * The phase-attribution fixture histories P-01..P-14 (test plan §4.4).
 *
 * Every history is a literal `PhaseTransitionRecord` array; the suites seed it
 * through the delivered registry append path. `T0 < T1 < T2 < T3` are absolute
 * literal stamps so no assertion depends on the ambient clock.
 */
import type { PhaseTransitionRecord } from "../../../packages/core/src/contracts/index";

export const T0 = "2026-11-01T10:00:00.000Z";
export const T1 = "2026-11-01T11:00:00.000Z";
export const T2 = "2026-11-01T12:00:00.000Z";
export const T2A = "2026-11-01T12:30:00.000Z";
export const T3 = "2026-11-01T13:00:00.000Z";

const transition = (phaseId: string, operation: "complete" | "reopen", timestamp: string) => ({
  changeRef: "GH-236",
  phaseId,
  operation,
  timestamp,
  outcome: "landed" as const,
  ...(operation === "reopen" ? { reason: "evidence-gap" } : {}),
});

/** P-01..P-04: clarify complete T0, specification complete T1, planning complete T2. */
export const P01: readonly PhaseTransitionRecord[] = [
  transition("clarify_scope", "complete", T0),
  transition("specification", "complete", T1),
  transition("delivery_planning", "complete", T2),
];

/** P-05: planning complete T2 then reopen T2a. */
export const P05: readonly PhaseTransitionRecord[] = [
  transition("clarify_scope", "complete", T0),
  transition("specification", "complete", T1),
  transition("delivery_planning", "complete", T2),
  transition("delivery_planning", "reopen", T2A),
];

/** P-06: planning complete T2, reopen T2a, complete T3. */
export const P06: readonly PhaseTransitionRecord[] = [
  transition("clarify_scope", "complete", T0),
  transition("specification", "complete", T1),
  transition("delivery_planning", "complete", T2),
  transition("delivery_planning", "reopen", T2A),
  transition("delivery_planning", "complete", T3),
];

/** P-05 variant: a `complete` and a `reopen` sharing one stamp (the reopen wins). */
export const P_SHARED_STAMP: readonly PhaseTransitionRecord[] = [
  transition("clarify_scope", "complete", T0),
  transition("specification", "complete", T1),
  transition("delivery_planning", "complete", T2),
  transition("delivery_planning", "reopen", T2),
];

/** The P-01 history with a following canonical phase for `--phase` scoping. */
export const P12: readonly PhaseTransitionRecord[] = [
  transition("clarify_scope", "complete", T0),
  transition("specification", "complete", T1),
  transition("delivery_planning", "complete", T2),
  transition("delivery", "complete", T3),
];

/** A history whose single window precedes every record (P-09). */
export const P09: readonly PhaseTransitionRecord[] = [transition("clarify_scope", "complete", T0)];

/** Ground-truth stamps used by the attribution matrix. */
export const STAMPS = {
  beforeFirst: "2026-11-01T09:00:00.000Z",
  afterClarify: "2026-11-01T10:30:00.000Z",
  atSpecificationComplete: T1,
  afterFinal: "2026-11-01T12:30:00.000Z",
  atReopen: T2A,
  afterReopen: "2026-11-01T12:45:00.000Z",
} as const;
