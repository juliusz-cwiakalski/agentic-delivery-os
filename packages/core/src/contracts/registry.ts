/**
 * Delivery registry record vocabulary (GH-179 C-5, PIN-3).
 *
 * Runtime-neutral and I/O-free: types and `as const` data only. The registry
 * contributes the record domain over the GH-174 state port; the store format
 * version and record kind are declared once here.
 */

/** The registry's store-format identifier (the single home, DM-4 precedent). */
export const REGISTRY_SCHEMA_VERSION = "delivery.registry.v1" as const;

/** The only record kind the registry appends for transition landings. */
export const PHASE_TRANSITION_KIND = "phase.transition" as const;

/** A landing transition's operation. */
export type PhaseTransitionOperation = "complete" | "reopen";

/** Only landings are recorded; no-op transitions append nothing. */
export type PhaseTransitionOutcome = "landed";

/**
 * The `phase.transition` payload. `reason` is present on reopen records only;
 * `timestamp` is the injected clock's ISO-8601 value.
 */
export type PhaseTransitionRecord = {
  readonly changeRef: string;
  readonly phaseId: string;
  readonly operation: PhaseTransitionOperation;
  readonly timestamp: string;
  readonly outcome: PhaseTransitionOutcome;
  readonly reason?: string;
};

/** One folded phase entry in the derived per-change projection. */
export type PhaseStateProjectionEntry = {
  readonly started: string | null;
  readonly completed: string | null;
};

/**
 * The derived projection shape: a pure fold of verified `phase.transition`
 * records. It carries no timestamp or non-fold field, so a rebuild is
 * byte-stable (PIN-3).
 */
export type PhaseStateProjection = {
  readonly schemaVersion: typeof REGISTRY_SCHEMA_VERSION;
  readonly changeRef: string;
  readonly phases: Readonly<Record<string, PhaseStateProjectionEntry>>;
};

/** Derived projection document naming: `phase-state.<REF>.json` (PIN-3). */
export const PHASE_STATE_DOCUMENT_PREFIX = "phase-state." as const;
export const PHASE_STATE_DOCUMENT_SUFFIX = ".json" as const;
export const PHASE_STATE_DOCUMENT_NAME_PATTERN = "phase-state.<REF>.json" as const;
