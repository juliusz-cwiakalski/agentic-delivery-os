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

/** The verdict an action carries when its artifact does not earn one (F-9). */
export const CEREMONY_FOLLOW_THROUGH_UNVERIFIED = "unverified" as const;

/** One follow-through entry: the action, its earned verdict, its artifact (F-9). */
export type CeremonyFollowThroughItem = {
  readonly item: string;
  readonly verdict: string;
  readonly evidenceRef: string;
  readonly reason?: string;
};

const stringArray = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter(isNonEmptyString) : [];

/** The evidence references the delivered inputs carry for this step (F-9). */
export const ceremonyDeliveredEvidence = (
  facts: Readonly<Record<string, unknown>>,
): ReadonlySet<string> => {
  const refs = new Set<string>();
  for (const source of Object.keys(facts).sort()) {
    const entry = facts[source];
    if (!isRecord(entry)) continue;
    for (const ref of stringArray(entry.evidenceRefs)) refs.add(ref);
  }
  return refs;
};

type RecordedOpenAction = {
  readonly item: string;
  readonly verdict?: string;
  readonly verificationArtifact?: string;
};

/** The open actions the delivered inputs record for the scope, in source order. */
const recordedOpenActions = (
  facts: Readonly<Record<string, unknown>>,
): readonly RecordedOpenAction[] => {
  const actions: RecordedOpenAction[] = [];
  for (const source of Object.keys(facts).sort()) {
    const entry = facts[source];
    if (!isRecord(entry) || !Array.isArray(entry.openActions)) continue;
    for (const candidate of entry.openActions) {
      if (!isRecord(candidate) || !isNonEmptyString(candidate.item)) continue;
      actions.push({
        item: candidate.item,
        ...(isNonEmptyString(candidate.verdict) ? { verdict: candidate.verdict } : {}),
        ...(isNonEmptyString(candidate.verificationArtifact)
          ? { verificationArtifact: candidate.verificationArtifact }
          : {}),
      });
    }
  }
  return actions;
};

const isClosedFollowThroughVerdict = (value: string): boolean =>
  (CEREMONY_FOLLOW_THROUGH_VERDICTS as readonly string[]).includes(value);

/**
 * The follow-through entries, each earned from the delivered evidence (F-9,
 * AC-F9-3). An action earns `applied`, `partial`, or
 * `violated-with-consequence` only when it names its verification artifact and
 * that artifact is among the evidence the step read; a recorded owner status
 * claim is never a verdict, and an action with no artifact is `unverified`
 * rather than `applied`.
 */
export const ceremonyFollowThroughItems = (
  facts: Readonly<Record<string, unknown>>,
): readonly CeremonyFollowThroughItem[] => {
  const delivered = ceremonyDeliveredEvidence(facts);
  return recordedOpenActions(facts).map((action) => {
    const artifact = action.verificationArtifact;
    if (artifact === undefined) {
      return {
        item: action.item,
        verdict: CEREMONY_FOLLOW_THROUGH_UNVERIFIED,
        evidenceRef: "",
        reason: "the open action declares no verification artifact",
      };
    }
    if (!delivered.has(artifact)) {
      return {
        item: action.item,
        verdict: CEREMONY_FOLLOW_THROUGH_UNVERIFIED,
        evidenceRef: artifact,
        reason: `the verification artifact "${artifact}" is not among the delivered evidence`,
      };
    }
    if (action.verdict === undefined || !isClosedFollowThroughVerdict(action.verdict)) {
      return {
        item: action.item,
        verdict: CEREMONY_FOLLOW_THROUGH_UNVERIFIED,
        evidenceRef: artifact,
        reason: "the delivered evidence carries no closed-set verdict for the action",
      };
    }
    return { item: action.item, verdict: action.verdict, evidenceRef: artifact };
  });
};

/** Render the follow-through section (first retro phase, F-9). */
export const renderCeremonyFollowThrough = (facts: Readonly<Record<string, unknown>>): unknown => {
  const items = ceremonyFollowThroughItems(facts);
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
