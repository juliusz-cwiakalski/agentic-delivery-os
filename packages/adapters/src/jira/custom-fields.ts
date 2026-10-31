/**
 * The Jira custom-field mapping (GH-188 DM-8, ADR-0006).
 *
 * Declared, reviewable adapter data: which provider custom fields feed which
 * normalized field, and the type each value is read as at the boundary. Custom
 * fields that are not declared here are visibly unrepresented on `WorkItem` —
 * no raw `customfield_*` key and no unmapped value ever crosses the boundary.
 *
 * The destination is a normalized `WorkItem` field that is representable as a
 * label vocabulary: mapped values become declared `labelPrefix` entries. This
 * keeps the v1 contract unchanged (ADR-0006) while making the typing evidence
 * observable on the normalized view.
 */

/** The declared value type of a mapped custom field. */
export type JiraCustomFieldValueType = "number" | "select";

/** One declared custom-field mapping (DM-8). */
export type JiraCustomFieldMapping = {
  readonly fieldId: string;
  readonly declaredType: JiraCustomFieldValueType;
  readonly destination: "labels";
  readonly labelPrefix: string;
  readonly reason: string;
};

/** The mapping table the seed applies; everything else is unrepresented. */
export const JIRA_CUSTOM_FIELD_MAPPINGS: readonly JiraCustomFieldMapping[] = [
  {
    fieldId: "customfield_10020",
    declaredType: "select",
    destination: "labels",
    labelPrefix: "team:",
    reason: "Team select field: the declared select value names the owning team.",
  },
  {
    fieldId: "customfield_10021",
    declaredType: "number",
    destination: "labels",
    labelPrefix: "story-points:",
    reason: "Story points arrive as a numeric string and are read as a number.",
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Read one mapped value as its declared type. A value that does not match the
 * declared type is skipped (visibly unrepresented), never coerced.
 */
const readDeclaredValue = (mapping: JiraCustomFieldMapping, raw: unknown): string | undefined => {
  if (mapping.declaredType === "number") {
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
    if (typeof raw === "string" && /^-?\d+(?:\.\d+)?$/.test(raw.trim())) {
      return String(Number(raw.trim()));
    }
    return undefined;
  }
  if (typeof raw === "string") return raw;
  if (isRecord(raw) && typeof raw.value === "string") return raw.value;
  return undefined;
};

/** Apply the declared mappings to raw Jira fields, yielding normalized labels. */
export const applyJiraCustomFields = (
  fields: Readonly<Record<string, unknown>>,
  mappings: readonly JiraCustomFieldMapping[] = JIRA_CUSTOM_FIELD_MAPPINGS,
): readonly string[] => {
  const labels: string[] = [];
  for (const mapping of mappings) {
    if (!(mapping.fieldId in fields)) continue;
    const value = readDeclaredValue(mapping, fields[mapping.fieldId]);
    if (value === undefined) continue;
    labels.push(`${mapping.labelPrefix}${value}`);
  }
  return labels;
};
