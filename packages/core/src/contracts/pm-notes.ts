/**
 * pm-notes schema vocabulary (GH-179 C-1, C-2).
 *
 * Runtime-neutral and I/O-free: types and `as const` data only. The canonical
 * phase vocabulary, the pinned per-variant required phase sets, the required
 * top-level keys, and the five lint identities live here as data. Extra keys
 * remain opaque by construction: the document types describe declared keys
 * only and never close the shape (GH-179 D11).
 */

/** The declared change variants. Absence means the effective `full` variant. */
export const PM_NOTES_VARIANT_VALUES = ["full", "lite"] as const;

export type PmNotesVariant = (typeof PM_NOTES_VARIANT_VALUES)[number];

/** The effective variant when the optional `variant` key is absent. */
export const PM_NOTES_DEFAULT_VARIANT = "full" as const;

export type PmNotesEffectiveVariant = PmNotesVariant;

/** The canonical eleven lifecycle phases (the full variant's required set). */
export const CANONICAL_PHASE_IDS = [
  "clarify_scope",
  "specification",
  "test_planning",
  "delivery_planning",
  "dor_check",
  "delivery",
  "system_spec_update",
  "review_fix",
  "quality_gates",
  "dod_check",
  "pr_creation",
] as const;

export type PmNotesPhaseId = (typeof CANONICAL_PHASE_IDS)[number];

/** The pinned compressed variant's required phases (reversible schema data). */
export const LITE_REQUIRED_PHASES = [
  "clarify_scope",
  "specification",
  "delivery",
  "quality_gates",
  "dod_check",
  "pr_creation",
] as const;

export type PmNotesLitePhaseId = (typeof LITE_REQUIRED_PHASES)[number];

/** The required top-level keys; every other key is optional and opaque. */
export const PM_NOTES_REQUIRED_TOP_LEVEL_KEYS = [
  "change_id",
  "title",
  "delivery_mode",
  "phases",
] as const;

/** Optional top-level keys that are typed when present. */
export const PM_NOTES_OPTIONAL_STRING_KEYS = ["milestone", "story_code"] as const;

/** Optional typed collections; entries are validated only when present. */
export const PM_NOTES_COLLECTION_KEYS = [
  "decisions",
  "open_questions",
  "blockers",
  "notes",
] as const;

/** Per-variant required phase sets, pinned as data (GH-179 C-2). */
export const PM_NOTES_REQUIRED_PHASES_BY_VARIANT = {
  full: CANONICAL_PHASE_IDS,
  lite: LITE_REQUIRED_PHASES,
} as const satisfies Readonly<Record<PmNotesVariant, readonly PmNotesPhaseId[]>>;

/** The five additive lint identities (GH-179 C-6). */
export const PM_NOTES_LINT_CODES = [
  "lint.notes.malformed",
  "lint.keys.missing",
  "lint.variant.unknown",
  "lint.phases.incomplete",
  "lint.target.missing",
] as const;

export type PmNotesLintCode = (typeof PM_NOTES_LINT_CODES)[number];

/** A phase entry: `started` and `completed` are timestamps or null. */
export type PmNotesTimestamp = string | null;

/**
 * One applicable phase entry. Only `started` and `completed` are inspected;
 * any extra key is opaque and never validated (NG-4, GH-179 D11).
 */
export type PmNotesPhaseEntry = {
  readonly started: PmNotesTimestamp;
  readonly completed: PmNotesTimestamp;
  readonly [extra: string]: unknown;
};

/**
 * One collection entry. `text` is required; `type` and `date` are typed when
 * present; extra keys are opaque.
 */
export type PmNotesCollectionEntry = {
  readonly text: string;
  readonly type?: string;
  readonly date?: string;
  readonly [extra: string]: unknown;
};

/**
 * The canonical document shape. Required keys are declared; typed-when-present
 * keys are optional; every undeclared key remains opaque.
 */
export type PmNotesDocument = {
  readonly change_id: string;
  readonly title: string;
  readonly delivery_mode: string;
  readonly phases: Readonly<Record<string, PmNotesPhaseEntry>>;
  readonly milestone?: string;
  readonly story_code?: string;
  readonly variant?: PmNotesVariant;
  readonly decisions?: readonly PmNotesCollectionEntry[];
  readonly open_questions?: readonly PmNotesCollectionEntry[];
  readonly blockers?: readonly PmNotesCollectionEntry[];
  readonly notes?: readonly PmNotesCollectionEntry[];
  readonly [extra: string]: unknown;
};

/** A safe parse failure: a class plus a location, never carried file bytes. */
export type PmNotesParseFailure = {
  readonly class: "syntax";
  readonly location: string;
};

/** Parsed document values or a parse failure handed to the pure rules. */
export type PmNotesParseOutcome =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly parseFailure: PmNotesParseFailure };
