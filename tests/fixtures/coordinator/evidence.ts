/**
 * Artifact-evidence fixtures (GH-241): the total 3x3x3 evidence matrix, the
 * fingerprint/new-turn couples, and the progress-bound windows.
 */
import type {
  CoordinatorEvidenceState,
  CoordinatorProgressState,
} from "../../../packages/core/src/contracts/index";
import type {
  CoordinatorEvidenceFacts,
  CoordinatorStuckEvaluation,
} from "../../../packages/core/src/domain/index";

export const STUCK_WINDOW_MS = 600_000;
export const PROGRESS_BOUND_MS = 300_000;
export const NOW_MS = 10_000_000;

export type MatrixCell = {
  readonly digest: CoordinatorEvidenceState;
  readonly merge: CoordinatorEvidenceState;
  readonly answer: CoordinatorEvidenceState;
  readonly expected: CoordinatorStuckEvaluation["verdict"];
};

const STATES: readonly CoordinatorEvidenceState[] = ["advanced", "stale", "unknown"];

/** The full 3x3x3 matrix (27 cells) evaluated with an expired window. */
export const EVIDENCE_MATRIX: readonly MatrixCell[] = STATES.flatMap((digest) =>
  STATES.flatMap((merge) =>
    STATES.map((answer) => {
      const states = [digest, merge, answer];
      const expected: CoordinatorStuckEvaluation["verdict"] = states.includes("advanced")
        ? "progressing"
        : states.every((state) => state === "unknown")
          ? "unevaluable"
          : "stuck";
      return { digest, merge, answer, expected };
    }),
  ),
);

/** Facts for one matrix cell; digest is expressed through the couple. */
export const factsForCell = (cell: MatrixCell): CoordinatorEvidenceFacts => ({
  nowMs: NOW_MS,
  expectedAtMs: NOW_MS - STUCK_WINDOW_MS - 1_000,
  stuckWindowMs: STUCK_WINDOW_MS,
  progressBoundMs: PROGRESS_BOUND_MS,
  fingerprintAdvanced: cell.digest === "advanced",
  newTurn: cell.digest === "advanced" ? "positive" : cell.digest === "unknown" ? "unknown" : "zero",
  progressObservedAtMs: null,
  merge: cell.merge,
  answer: cell.answer,
});

/** A plain stale/stale/stale baseline with an expired window. */
export const staleBaseline = (
  overrides: Partial<CoordinatorEvidenceFacts> = {},
): CoordinatorEvidenceFacts => ({
  nowMs: NOW_MS,
  expectedAtMs: NOW_MS - STUCK_WINDOW_MS - 1_000,
  stuckWindowMs: STUCK_WINDOW_MS,
  progressBoundMs: PROGRESS_BOUND_MS,
  fingerprintAdvanced: false,
  newTurn: "zero",
  progressObservedAtMs: null,
  merge: "stale",
  answer: "stale",
  ...overrides,
});

/** The fingerprint/new-turn couples: only both together consume the digest. */
export const FINGERPRINT_COUPLES: readonly {
  readonly id: string;
  readonly fingerprintAdvanced: boolean;
  readonly newTurn: CoordinatorProgressState;
  readonly digestConsumed: boolean;
}[] = [
  { id: "advanced-and-turn", fingerprintAdvanced: true, newTurn: "positive", digestConsumed: true },
  {
    id: "advanced-without-turn",
    fingerprintAdvanced: true,
    newTurn: "zero",
    digestConsumed: false,
  },
  {
    id: "advanced-with-unknown-turn",
    fingerprintAdvanced: true,
    newTurn: "unknown",
    digestConsumed: false,
  },
  {
    id: "turn-without-advance",
    fingerprintAdvanced: false,
    newTurn: "positive",
    digestConsumed: false,
  },
  { id: "neither", fingerprintAdvanced: false, newTurn: "zero", digestConsumed: false },
];

/** Progress-window fixtures for the corroborator veto. */
export const PROGRESS_WINDOWS: readonly {
  readonly id: string;
  readonly ageMs: number;
  readonly vetoes: boolean;
}[] = [
  { id: "fresh-progress", ageMs: 0, vetoes: true },
  { id: "inside-bound", ageMs: PROGRESS_BOUND_MS - 1, vetoes: true },
  { id: "at-bound", ageMs: PROGRESS_BOUND_MS, vetoes: true },
  { id: "past-bound", ageMs: PROGRESS_BOUND_MS + 1, vetoes: false },
];
