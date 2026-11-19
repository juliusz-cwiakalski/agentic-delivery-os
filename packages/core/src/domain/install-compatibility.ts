/**
 * The installed-artifact ↔ state-format compatibility verdict (F-7; DM-4).
 *
 * One equality over two already-delivered values: the artifact's accepted store
 * format identifier and each enumerated root's ledger header identifier. It is
 * never an ordering, never a payload decode, never a write, and an absent root
 * is `unchecked` rather than `accepted`.
 */
import {
  INSTALL_STATE_FORMAT_OUTCOMES,
  type InstallStateFormatVerdict,
  type InstallStateRootVerdict,
} from "../contracts/install.js";

/** One judged root's raw facts, read by the adapter and parsed here. */
export type StateRootObservation = {
  readonly root: string;
  readonly exists: boolean;
  /** Every header file's text, or `undefined` when unreadable. */
  readonly headerTexts: readonly (string | undefined)[];
  readonly unreadable: boolean;
};

const observedIdentifier = (text: string | undefined): string | undefined => {
  if (text === undefined) return undefined;
  try {
    const parsed = JSON.parse(text) as { readonly schemaVersion?: unknown };
    return typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : undefined;
  } catch {
    return undefined;
  }
};

/** Judge one root independently (a machine may mix compatible and incompatible roots). */
export const judgeStateRoot = (input: {
  readonly observation: StateRootObservation;
  readonly accepted: string;
}): InstallStateRootVerdict => {
  const { observation } = input;
  if (!observation.exists) {
    return {
      root: observation.root,
      observed: null,
      outcome: INSTALL_STATE_FORMAT_OUTCOMES[3],
      reason: "the root is absent and is never collapsed into accepted",
    };
  }
  if (observation.unreadable) {
    return {
      root: observation.root,
      observed: null,
      outcome: INSTALL_STATE_FORMAT_OUTCOMES[2],
      reason: "the header exists but cannot be read",
    };
  }
  if (observation.headerTexts.length === 0) {
    return {
      root: observation.root,
      observed: null,
      outcome: INSTALL_STATE_FORMAT_OUTCOMES[3],
      reason: "no ledger header exists at this root",
    };
  }
  const first = observedIdentifier(observation.headerTexts[0]);
  if (first === undefined) {
    return {
      root: observation.root,
      observed: null,
      outcome: INSTALL_STATE_FORMAT_OUTCOMES[2],
      reason: "the header exists but declares no readable format identifier",
    };
  }
  return first === input.accepted
    ? {
        root: observation.root,
        observed: first,
        outcome: INSTALL_STATE_FORMAT_OUTCOMES[0],
        reason: "the header declares the format this artifact accepts",
      }
    : {
        root: observation.root,
        observed: first,
        outcome: INSTALL_STATE_FORMAT_OUTCOMES[1],
        reason: `the header declares ${first}; this artifact accepts ${input.accepted}`,
      };
};

/** Fold the per-root verdicts into the declared payload group. */
export const judgeStateFormat = (input: {
  readonly accepted: string;
  readonly observations: readonly StateRootObservation[];
  readonly judged: number;
  readonly truncated: boolean;
}): InstallStateFormatVerdict => ({
  accepted: input.accepted,
  roots: input.observations.map((observation) =>
    judgeStateRoot({ observation, accepted: input.accepted }),
  ),
  judged: input.judged,
  truncated: input.truncated,
});

/** The typed incompatibility verdict behind `install status` (exit 1). */
export const incompatibleRoots = (
  verdict: InstallStateFormatVerdict,
): readonly InstallStateRootVerdict[] =>
  verdict.roots.filter((entry) => entry.outcome === INSTALL_STATE_FORMAT_OUTCOMES[1]);

/** The write-path advisory: one line per not-accepted root, exit unchanged. */
export const compatibilityAdvisories = (verdict: InstallStateFormatVerdict): readonly string[] =>
  verdict.roots
    .filter(
      (entry) =>
        entry.outcome === INSTALL_STATE_FORMAT_OUTCOMES[1] ||
        entry.outcome === INSTALL_STATE_FORMAT_OUTCOMES[2],
    )
    .map(
      (entry) =>
        `advisory: ${entry.root} declares ${entry.observed ?? "an unreadable format"}; this ` +
        `artifact accepts ${verdict.accepted} — install the artifact that matches the root if a ` +
        "command refuses it (the install surface stays able to install the fix; nothing was written)",
    );
