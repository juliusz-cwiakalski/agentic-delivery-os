/**
 * Transition-history fixtures for the phase mirror (F-5, API-6, TDR-0049).
 *
 * A history is a plain list of verified `phase.transition` records, so a fixture
 * states exactly what the ledger would hold. `reopenedThenRecompleted` is the
 * complete → reopen → re-complete sequence whose first completion differs from
 * the fold's; `preFixCompletionLookup` is the retired derivation a control
 * SUBSTITUTES into the repaired path (test plan M99) — no case executes pre-fix
 * code from an earlier commit.
 */
import {
  CANONICAL_PHASE_IDS,
  type PhaseTransitionRecord,
} from "../../../packages/core/src/contracts/index";

/** The change ref the fixtures describe. */
export const HISTORY_REF = "GH-349";

/** First completion, the reopen, and the second completion of the sequence. */
export const T1 = "2026-11-18T10:00:00Z";
export const REOPENED_AT = "2026-11-18T12:00:00Z";
export const T2 = "2026-11-19T10:00:00Z";

/** One completion record. */
export const completionRecord = (
  phaseId: string,
  timestamp: string,
  changeRef: string = HISTORY_REF,
): PhaseTransitionRecord => ({
  changeRef,
  phaseId,
  operation: "complete",
  timestamp,
  outcome: "landed",
});

/** One reopen record. */
export const reopenRecord = (
  phaseId: string,
  timestamp: string,
  changeRef: string = HISTORY_REF,
  reason = "scope reopened",
): PhaseTransitionRecord => ({
  changeRef,
  phaseId,
  operation: "reopen",
  timestamp,
  outcome: "landed",
  reason,
});

/** complete(T1) → reopen → complete(T2): the fold's completion is T2, not T1. */
export const reopenedThenRecompleted = (
  phaseId = "delivery",
  changeRef: string = HISTORY_REF,
): readonly PhaseTransitionRecord[] => [
  completionRecord(phaseId, T1, changeRef),
  reopenRecord(phaseId, REOPENED_AT, changeRef),
  completionRecord(phaseId, T2, changeRef),
];

/**
 * The retired derivation: the FIRST matching completion in the full history.
 * Used as a substitution control only — the repaired path never calls it.
 */
export const preFixCompletionLookup = (
  transitions: readonly PhaseTransitionRecord[],
  phaseId: string,
): string | null =>
  transitions.find((record) => record.phaseId === phaseId && record.operation === "complete")
    ?.timestamp ?? null;

export type PhaseEntry = {
  readonly started: string | null;
  readonly completed: string | null;
};

const yamlLiteral = (value: string | null): string => (value === null ? "null" : `"${value}"`);

/**
 * A full-variant pm-notes document text carrying the given per-phase entries;
 * every unlisted canonical phase is open (`started: null, completed: null`).
 */
export const phaseNotesText = (
  entries: Readonly<Partial<Record<string, PhaseEntry>>> = {},
): string => {
  const phaseLines = CANONICAL_PHASE_IDS.map((phaseId) => {
    const entry = entries[phaseId] ?? { started: null, completed: null };
    return `  ${phaseId}: { started: ${yamlLiteral(entry.started)}, completed: ${yamlLiteral(entry.completed)} }`;
  });
  return [
    "change_id: GH-310",
    'title: "phase mirror fixture"',
    "delivery_mode: interactive",
    "phases:",
    ...phaseLines,
    "decisions: []",
    "open_questions: []",
    "blockers: []",
    "notes: []",
    "",
  ].join("\n");
};

/**
 * A full-variant pm-notes document value carrying the given per-phase entries;
 * every unlisted canonical phase is open (`started: null, completed: null`).
 */
export const phaseNotesValue = (
  entries: Readonly<Partial<Record<string, PhaseEntry>>> = {},
): Record<string, unknown> => ({
  change_id: "GH-349",
  title: "phase divergence fixture",
  delivery_mode: "autonomous",
  phases: Object.fromEntries(
    CANONICAL_PHASE_IDS.map((phaseId) => [
      phaseId,
      entries[phaseId] ?? { started: null, completed: null },
    ]),
  ),
  decisions: [],
  open_questions: [],
  blockers: [],
  notes: [],
});

/** The document's completion for a phase, read from parsed pm-notes values. */
export const documentCompletedOf = (value: unknown, phaseId: string): string | null => {
  if (typeof value !== "object" || value === null) return null;
  const phases = (value as { readonly phases?: unknown }).phases;
  if (typeof phases !== "object" || phases === null) return null;
  const entry = (phases as Record<string, unknown>)[phaseId];
  if (typeof entry !== "object" || entry === null) return null;
  const completed = (entry as { readonly completed?: unknown }).completed;
  return typeof completed === "string" ? completed : null;
};

/** The document's `started` for a phase, read from parsed pm-notes values. */
export const documentStartedOf = (value: unknown, phaseId: string): string | null => {
  if (typeof value !== "object" || value === null) return null;
  const phases = (value as { readonly phases?: unknown }).phases;
  if (typeof phases !== "object" || phases === null) return null;
  const entry = (phases as Record<string, unknown>)[phaseId];
  if (typeof entry !== "object" || entry === null) return null;
  const started = (entry as { readonly started?: unknown }).started;
  return typeof started === "string" ? started : null;
};
