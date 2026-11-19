/**
 * Divergence fixtures for the both-target lint rule (F-5, API-5, TC-F5-004/005).
 *
 * Each fixture pairs a parsed pm-notes document with the verified fold the ledger
 * would produce for the same change, so a case states the two facts the rule
 * compares — including a null document value, an equal pair, a document-only
 * completion and a ledger-less phase.
 */
import type {
  PhaseStateProjection,
  PhaseTransitionRecord,
} from "../../../packages/core/src/contracts/index";
import { foldPhaseState } from "../../../packages/core/src/state/index";
import { HISTORY_REF, type PhaseEntry, phaseNotesValue } from "../phase/history";

/** A paired document value and verified fold for one change ref. */
export type DivergencePair = {
  readonly document: unknown;
  readonly fold: PhaseStateProjection;
};

/**
 * Pair the document's per-phase entries with the fold of the given transitions.
 * Both sides are real: the document is the parsed shape the lint command reads,
 * the fold is `foldPhaseState` over the records.
 */
export const divergencePair = (
  entries: Readonly<Partial<Record<string, PhaseEntry>>>,
  transitions: readonly PhaseTransitionRecord[],
  changeRef: string = HISTORY_REF,
): DivergencePair => ({
  document: phaseNotesValue(entries),
  fold: foldPhaseState(changeRef, transitions),
});
