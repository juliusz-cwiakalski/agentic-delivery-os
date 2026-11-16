/**
 * The built-in ceremony folds and renderers (GH-296 F-3; Appendix E).
 *
 * Pure functions over the declaration contract and injected facts: the
 * follow-through set, the retro evidence/insights/actions documents, and the
 * per-schema conformance oracle the runner's read-back verification uses. No
 * model, network, ambient read, or per-ceremony branch lives here.
 */
import {
  CEREMONY_CARRY_OVER_REASONS,
  CEREMONY_CHECK_STATES,
  CEREMONY_FOLLOW_THROUGH_VERDICTS,
  CEREMONY_ASSESS_VERDICTS,
  type CeremonyNote,
} from "#contracts";

/** The follow-through section schema (F-9). */
export const CEREMONY_FOLLOW_THROUGH_SCHEMA = "delivery.ceremony.follow-through.v1" as const;

/** The retro evidence document schema (F-9). */
export const CEREMONY_RETRO_EVIDENCE_SCHEMA = "delivery.ceremony.retro-evidence.v1" as const;

/** The retro insights document schema (F-9). */
export const CEREMONY_RETRO_INSIGHTS_SCHEMA = "delivery.ceremony.retro-insights.v1" as const;

/** The retro action handoff schema (F-9, DEC-3). */
export const CEREMONY_RETRO_ACTIONS_SCHEMA = "delivery.ceremony.retro-actions.v1" as const;

/** The built-in schemas the domain renderers own. */
export const CEREMONY_BUILTIN_SCHEMAS = [
  CEREMONY_FOLLOW_THROUGH_SCHEMA,
  CEREMONY_RETRO_EVIDENCE_SCHEMA,
  CEREMONY_RETRO_INSIGHTS_SCHEMA,
  CEREMONY_RETRO_ACTIONS_SCHEMA,
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const noteRecord = (note: CeremonyNote): Record<string, unknown> =>
  note as unknown as Record<string, unknown>;

/** The follow-through entries: a supplied section, else the note's actions. */
export const ceremonyFollowThroughItems = (
  note: CeremonyNote | undefined,
): readonly { readonly item: string; readonly verdict: string; readonly evidenceRef: string }[] => {
  if (note === undefined) return [];
  const supplied = noteRecord(note).followThrough;
  if (Array.isArray(supplied)) {
    return supplied.filter(isRecord).map((entry, index) => {
      const verdict =
        typeof entry.verdict === "string" &&
        (CEREMONY_FOLLOW_THROUGH_VERDICTS as readonly string[]).includes(entry.verdict)
          ? entry.verdict
          : "partial";
      return {
        item: typeof entry.item === "string" ? entry.item : `action-${String(index)}`,
        verdict,
        evidenceRef:
          typeof entry.evidenceRef === "string"
            ? entry.evidenceRef
            : `note:action:${String(index)}`,
      };
    });
  }
  return (note.actions ?? []).map((action, index) => ({
    item: action,
    verdict: "applied",
    evidenceRef: `note:action:${String(index)}`,
  }));
};

/** Render the follow-through section (first retro phase, F-9). */
export const renderCeremonyFollowThrough = (note: CeremonyNote | undefined): unknown => {
  const items = ceremonyFollowThroughItems(note);
  return {
    schemaId: CEREMONY_FOLLOW_THROUGH_SCHEMA,
    items,
    verifiedEmpty: items.length === 0,
    ...(items.length === 0 ? { findingSet: [] } : {}),
  };
};

/** Render the read-only evidence fold (F-9). */
export const renderCeremonyRetroEvidence = (
  facts: Readonly<Record<string, unknown>>,
  note: CeremonyNote | undefined,
): unknown => ({
  schemaId: CEREMONY_RETRO_EVIDENCE_SCHEMA,
  level: note?.level,
  evidenceRefs: note?.evidenceRefs ?? [],
  facts: note?.facts ?? [],
  interpretations: note?.interpretations ?? [],
  consumed: Object.keys(facts).sort(),
  writeBack: false,
});

/** Render the insights note (facts with evidence refs, interpretations). */
export const renderCeremonyRetroInsights = (note: CeremonyNote | undefined): unknown => ({
  schemaId: CEREMONY_RETRO_INSIGHTS_SCHEMA,
  wins: note?.wins ?? [],
  gaps: note?.gaps ?? [],
  candidateLessons: note?.candidateLessons ?? [],
  findingSet: [],
  fabricated: false,
});

/** Render the action handoff section; filing stays M2-S10 (DEC-3). */
export const renderCeremonyRetroActions = (note: CeremonyNote | undefined): unknown => ({
  schemaId: CEREMONY_RETRO_ACTIONS_SCHEMA,
  actions: note?.actions ?? [],
  handoff: true,
  filed: false,
});

const arraysOf = (document: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.every((key) => Array.isArray(document[key]));

/** The built-in schema conformance oracle used by read-back verification. */
export const ceremonyBuiltinConforms = (
  schema: string,
  document: Record<string, unknown>,
): boolean => {
  if (schema === CEREMONY_FOLLOW_THROUGH_SCHEMA) {
    const items = document.items;
    if (!Array.isArray(items)) return false;
    if (items.length === 0) return document.verifiedEmpty === true;
    return items.every(
      (entry) =>
        isRecord(entry) &&
        isNonEmptyString(entry.item) &&
        typeof entry.verdict === "string" &&
        (CEREMONY_FOLLOW_THROUGH_VERDICTS as readonly string[]).includes(entry.verdict) &&
        isNonEmptyString(entry.evidenceRef),
    );
  }
  if (schema === CEREMONY_RETRO_EVIDENCE_SCHEMA) {
    return (
      arraysOf(document, ["evidenceRefs", "facts", "interpretations", "consumed"]) &&
      document.writeBack === false
    );
  }
  if (schema === CEREMONY_RETRO_INSIGHTS_SCHEMA) {
    return arraysOf(document, ["wins", "gaps", "candidateLessons", "findingSet"]);
  }
  if (schema === CEREMONY_RETRO_ACTIONS_SCHEMA) {
    return arraysOf(document, ["actions"]) && document.handoff === true && document.filed === false;
  }
  return false;
};

/** The declared carry-over reason set, re-exported for the rollover render. */
export const CEREMONY_ROLLOVER_REASONS = CEREMONY_CARRY_OVER_REASONS;

/** The declared night-watch check set, pinned once for the render oracle. */
export const CEREMONY_DECLARED_CHECKS = [
  "audit-ledger",
  "harness-telemetry",
  "lanes",
  "gates",
] as const;

/** The closed assessment verdict set, re-exported for the assess oracle. */
export const CEREMONY_ASSESSMENT_VERDICTS = CEREMONY_ASSESS_VERDICTS;

/** The closed night-watch check state set, re-exported for the render oracle. */
export const CEREMONY_CHECK_STATE_VALUES = CEREMONY_CHECK_STATES;
