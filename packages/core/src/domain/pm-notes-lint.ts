/**
 * Pure pm-notes conformance rules (GH-179 C-1..C-3, PIN-5).
 *
 * The rules operate on parsed values or a parse-failure input; they perform no
 * I/O, invoke no parser, and read no ambient state. Families run in the fixed
 * order parse -> keys -> value types -> variant -> phases, and the verdict
 * carries the first finding's single classified identity. Within a family all
 * offenders of that class are named. Only schema-declared keys are inspected:
 * extra keys stay opaque (NG-4, GH-179 D11).
 */
import {
  PM_NOTES_COLLECTION_KEYS,
  PM_NOTES_OPTIONAL_STRING_KEYS,
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT,
  PM_NOTES_REQUIRED_TOP_LEVEL_KEYS,
  PM_NOTES_VARIANT_VALUES,
  type PmNotesLintCode,
  type PmNotesParseOutcome,
  type PmNotesVariant,
} from "#contracts";

/** The safe location a finding names. */
export type PmNotesLintLocation =
  | { readonly kind: "document" }
  | { readonly kind: "top-level"; readonly key: string }
  | {
      readonly kind: "phase";
      readonly phaseId: string;
      readonly field?: "started" | "completed";
    }
  | {
      readonly kind: "collection";
      readonly collection: string;
      readonly index: number;
      readonly field?: "text" | "type" | "date";
    };

/** One classified finding: identity, named location, offenders, and detail. */
export type PmNotesLintFinding = {
  readonly code: PmNotesLintCode;
  readonly location: PmNotesLintLocation;
  readonly offenders: readonly string[];
  readonly detail: string;
};

/** The verdict: a clean effective variant or the first classified finding. */
export type PmNotesLintVerdict =
  | { readonly ok: true; readonly variant: PmNotesVariant }
  | { readonly ok: false; readonly finding: PmNotesLintFinding };

const REQUIRED_STRING_KEYS = ["change_id", "title", "delivery_mode"] as const;
const PHASE_FIELDS = ["started", "completed"] as const;
const COLLECTION_TYPED_FIELDS = ["type", "date"] as const;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTimestamp = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && TIMESTAMP.test(value));

const isKnownVariant = (value: string): value is PmNotesVariant =>
  (PM_NOTES_VARIANT_VALUES as readonly string[]).includes(value);

const failure = (
  code: PmNotesLintCode,
  location: PmNotesLintLocation,
  offenders: readonly string[],
  detail: string,
): PmNotesLintVerdict => ({ ok: false, finding: { code, location, offenders, detail } });

const firstPhaseLocation = (offender: string): PmNotesLintLocation => {
  const [phaseId = offender, field] = offender.split(".");
  return field === "started" || field === "completed"
    ? { kind: "phase", phaseId, field }
    : { kind: "phase", phaseId };
};

const requiredPhasesFor = (variant: PmNotesVariant): readonly string[] =>
  PM_NOTES_REQUIRED_PHASES_BY_VARIANT[variant];

/**
 * Validate one pm-notes input. A parse failure arrives as a value, never as a
 * thrown crash; the returned verdict is deterministic for identical input.
 */
export const lintPmNotes = (input: PmNotesParseOutcome): PmNotesLintVerdict => {
  if (!input.ok) {
    return failure(
      "lint.notes.malformed",
      { kind: "document" },
      [],
      `the pm-notes document is not parseable at ${input.parseFailure.location}`,
    );
  }
  const document = input.value;
  if (!isRecord(document)) {
    return failure(
      "lint.notes.malformed",
      { kind: "document" },
      [],
      "the pm-notes document root is not a map",
    );
  }

  const missingTopLevel = PM_NOTES_REQUIRED_TOP_LEVEL_KEYS.filter(
    (key) => !Object.hasOwn(document, key),
  );
  if (missingTopLevel.length > 0) {
    const first = missingTopLevel[0] as string;
    return failure(
      "lint.keys.missing",
      missingTopLevel.length === 1 ? { kind: "top-level", key: first } : { kind: "document" },
      missingTopLevel,
      `missing required top-level key(s): ${missingTopLevel.join(", ")}`,
    );
  }

  const rawVariant = document.variant;
  const variantDeclared = rawVariant !== undefined;
  const variantKnown = typeof rawVariant === "string" && isKnownVariant(rawVariant);
  const variantDecidable = !variantDeclared || variantKnown;
  const effectiveVariant: PmNotesVariant = rawVariant === "lite" ? "lite" : "full";
  const requiredPhases = requiredPhasesFor(effectiveVariant);
  const rawPhases = document.phases;
  const phaseMap = isRecord(rawPhases) ? rawPhases : undefined;

  // Family: required-key presence (top-level, applicable phase entries, text).
  const missingKeys: string[] = [];
  if (phaseMap !== undefined && variantDecidable) {
    for (const phaseId of requiredPhases) {
      const entry = phaseMap[phaseId];
      if (!isRecord(entry)) continue;
      for (const field of PHASE_FIELDS) {
        if (!Object.hasOwn(entry, field)) missingKeys.push(`${phaseId}.${field}`);
      }
    }
  }
  const missingCollectionText: string[] = [];
  for (const collection of PM_NOTES_COLLECTION_KEYS) {
    const entries = document[collection];
    if (!Array.isArray(entries)) continue;
    entries.forEach((entry, index) => {
      if (isRecord(entry) && !Object.hasOwn(entry, "text")) {
        missingCollectionText.push(`${collection}[${index}].text`);
      }
    });
  }
  if (missingKeys.length > 0) {
    return failure(
      "lint.keys.missing",
      firstPhaseLocation(missingKeys[0] as string),
      missingKeys,
      `missing required phase entry key(s): ${missingKeys.join(", ")}`,
    );
  }
  if (missingCollectionText.length > 0) {
    return failure(
      "lint.keys.missing",
      { kind: "document" },
      missingCollectionText,
      `missing required collection key(s): ${missingCollectionText.join(", ")}`,
    );
  }

  // Family: value-type conformance of schema-declared keys only.
  const wrongTypes: string[] = [];
  for (const key of REQUIRED_STRING_KEYS) {
    if (typeof document[key] !== "string") wrongTypes.push(key);
  }
  for (const key of PM_NOTES_OPTIONAL_STRING_KEYS) {
    if (document[key] !== undefined && typeof document[key] !== "string") wrongTypes.push(key);
  }
  if (rawVariant !== undefined && typeof rawVariant !== "string") wrongTypes.push("variant");
  if (phaseMap === undefined) {
    wrongTypes.push("phases");
  } else if (variantDecidable) {
    for (const phaseId of requiredPhases) {
      const entry = phaseMap[phaseId];
      if (entry === undefined) continue;
      if (!isRecord(entry)) {
        wrongTypes.push(`phases.${phaseId}`);
        continue;
      }
      for (const field of PHASE_FIELDS) {
        if (Object.hasOwn(entry, field) && !isTimestamp(entry[field])) {
          wrongTypes.push(`${phaseId}.${field}`);
        }
      }
    }
  }
  for (const collection of PM_NOTES_COLLECTION_KEYS) {
    const entries = document[collection];
    if (entries === undefined) continue;
    if (!Array.isArray(entries)) {
      wrongTypes.push(collection);
      continue;
    }
    entries.forEach((entry, index) => {
      const label = `${collection}[${index}]`;
      if (!isRecord(entry)) {
        wrongTypes.push(label);
        return;
      }
      if (Object.hasOwn(entry, "text") && typeof entry.text !== "string") {
        wrongTypes.push(`${label}.text`);
      }
      for (const field of COLLECTION_TYPED_FIELDS) {
        if (Object.hasOwn(entry, field) && typeof entry[field] !== "string") {
          wrongTypes.push(`${label}.${field}`);
        }
      }
    });
  }
  if (wrongTypes.length > 0) {
    return failure(
      "lint.notes.malformed",
      { kind: "document" },
      wrongTypes,
      `non-conforming value type(s): ${wrongTypes.join(", ")}`,
    );
  }

  // Family: variant value.
  if (variantDeclared && typeof rawVariant === "string" && !variantKnown) {
    return failure(
      "lint.variant.unknown",
      { kind: "top-level", key: "variant" },
      [rawVariant],
      `unknown variant "${rawVariant}"; expected one of ${PM_NOTES_VARIANT_VALUES.join(", ")}`,
    );
  }

  // Family: effective-variant required phase presence.
  if (phaseMap !== undefined) {
    const missingPhases = requiredPhases.filter((phaseId) => !Object.hasOwn(phaseMap, phaseId));
    if (missingPhases.length > 0) {
      return failure(
        "lint.phases.incomplete",
        { kind: "top-level", key: "phases" },
        missingPhases,
        `missing required phase(s) for the ${effectiveVariant} variant: ${missingPhases.join(", ")}`,
      );
    }
  }

  return { ok: true, variant: effectiveVariant };
};

/** Re-exported for the value-type fixture controls that inspect collections. */
export type { PmNotesLintCode };
