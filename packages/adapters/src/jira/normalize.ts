/**
 * Jira issue normalization: native payload → the normalized `WorkItem` view.
 *
 * Provider-native types never leave this module. Absence is represented by
 * absence (ADR-0004/ADR-0006): `updatedAt` and `comments` keys are added only
 * when the provider actually supplied the corresponding payload.
 */
import type {
  CloseoutReadObservation,
  WorkflowMap,
  WorkItem,
  WorkItemComment,
  WorkItemRelation,
} from "@delivery-os/core/contracts";
import type { ProviderReadResult } from "../io/provider-transport.js";
import { providerPayloadFailure } from "../io/provider-transport.js";
import {
  applyJiraCustomFields,
  JIRA_CUSTOM_FIELD_MAPPINGS,
  type JiraCustomFieldMapping,
} from "./custom-fields.js";
import { stateMappingFor } from "./workflow-map.js";

/** The declared data a normalization run consumes. */
export type JiraNormalizationContext = {
  readonly systemName: string;
  readonly workflowMap: WorkflowMap;
  readonly customFieldMappings: readonly JiraCustomFieldMapping[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

const relationKindFor = (
  typeName: string,
  direction: "inward" | "outward",
): WorkItemRelation["relationKind"] | undefined => {
  const normalized = typeName.trim().toLowerCase();
  if (normalized === "blocks") return direction === "outward" ? "blocks" : "blocked-by";
  if (normalized === "relates" || normalized === "cloners" || normalized === "duplicate") {
    return "relates-to";
  }
  return undefined;
};

const commentFrom = (value: unknown): WorkItemComment | undefined => {
  if (!isRecord(value)) return undefined;
  const commentId = stringField(value, "id");
  const author = value.author;
  const authorAccount =
    (isRecord(author) &&
      (stringField(author, "displayName") ?? stringField(author, "accountId"))) ||
    undefined;
  const body = stringField(value, "body");
  if (commentId === undefined || body === undefined) return undefined;
  return { commentId, authorAccount: authorAccount ?? "unknown-account", body };
};

const relationsFrom = (
  fields: Readonly<Record<string, unknown>>,
  systemName: string,
): WorkItemRelation[] => {
  const rawLinks = fields.issuelinks;
  if (!Array.isArray(rawLinks)) return [];
  const relations: WorkItemRelation[] = [];
  for (const link of rawLinks) {
    if (!isRecord(link)) continue;
    const type = isRecord(link.type) ? link.type : undefined;
    const typeName = type !== undefined ? stringField(type, "name") : undefined;
    if (typeName === undefined) continue;
    for (const direction of ["outward", "inward"] as const) {
      const issue = link[`${direction}Issue`];
      if (!isRecord(issue)) continue;
      const targetKey = stringField(issue, "key") ?? stringField(issue, "id");
      if (targetKey === undefined) continue;
      const relationKind = relationKindFor(typeName, direction);
      if (relationKind === undefined) continue;
      relations.push({ relationKind, target: { systemName, entityId: targetKey } });
    }
  }
  return relations;
};

/**
 * Normalize one Jira issue.
 *
 * `comments` is present exactly when the read obtained a comment container; an
 * empty container yields a present empty array. `updatedAt` is copied verbatim
 * from the native `updated` field and omitted when the provider omits it.
 */
export const normalizeJiraIssue = (
  payload: unknown,
  context: JiraNormalizationContext,
): ProviderReadResult<WorkItem> => {
  if (!isRecord(payload)) return providerPayloadFailure("Jira issue payload is not an object");
  const fields = payload.fields;
  if (!isRecord(fields)) return providerPayloadFailure("Jira issue payload has no fields object");

  const entityId = stringField(payload, "key") ?? stringField(payload, "id");
  if (entityId === undefined) return providerPayloadFailure("Jira issue has no key or id");

  const title = stringField(fields, "summary");
  if (title === undefined) return providerPayloadFailure(`Jira issue ${entityId} has no summary`);

  const status = fields.status;
  const nativeStatus = isRecord(status) ? stringField(status, "name") : undefined;
  if (nativeStatus === undefined) {
    return providerPayloadFailure(`Jira issue ${entityId} has no native status`);
  }
  const mapping = stateMappingFor(context.workflowMap, nativeStatus);
  if (mapping === undefined) {
    return providerPayloadFailure(
      `Jira issue ${entityId} has unmapped native status "${nativeStatus}"`,
    );
  }

  const rawLabels = fields.labels;
  const nativeLabels = Array.isArray(rawLabels)
    ? rawLabels.filter((label): label is string => typeof label === "string")
    : [];
  const labels = [...nativeLabels, ...applyJiraCustomFields(fields, context.customFieldMappings)];

  const assigneeContainer = fields.assignee;
  const assignee = isRecord(assigneeContainer)
    ? (stringField(assigneeContainer, "displayName") ?? stringField(assigneeContainer, "accountId"))
    : undefined;

  const commentContainer = fields.comment;
  let comments: readonly WorkItemComment[] | undefined;
  if (isRecord(commentContainer) && Array.isArray(commentContainer.comments)) {
    comments = commentContainer.comments.flatMap((value) => {
      const comment = commentFrom(value);
      return comment === undefined ? [] : [comment];
    });
  }

  const updatedAt = stringField(fields, "updated");

  return {
    ok: true,
    value: {
      identity: { systemName: context.systemName, entityId },
      title,
      status: { nativeStatus, deliveryState: mapping.deliveryState },
      labels,
      ...(assignee !== undefined ? { assignee } : {}),
      relations: relationsFrom(fields, context.systemName),
      ...(comments !== undefined ? { comments } : {}),
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    },
  };
};

/** Normalize a Jira search-shaped response (`{ issues: [...] }`). */
export const normalizeJiraSearch = (
  payload: unknown,
  context: JiraNormalizationContext,
): ProviderReadResult<readonly WorkItem[]> => {
  if (!isRecord(payload) || !Array.isArray(payload.issues)) {
    return providerPayloadFailure("Jira search payload has no issues array");
  }
  const items: WorkItem[] = [];
  for (const issue of payload.issues) {
    const normalized = normalizeJiraIssue(issue, context);
    if (!normalized.ok) return normalized;
    items.push(normalized.value);
  }
  return { ok: true, value: items };
};

/** The production normalization context (declared data, no per-call state). */
export const jiraNormalizationContext = (
  systemName: string,
  workflowMap: WorkflowMap,
): JiraNormalizationContext => ({
  systemName,
  workflowMap,
  customFieldMappings: JIRA_CUSTOM_FIELD_MAPPINGS,
});


/**
 * Compute the full label array for a Jira replace: remove only the named
 * lifecycle labels, add the requested labels, and preserve every other label.
 * Order is the provider-asserted order followed by newly added labels.
 */
export const computeJiraLabelTargetSet = (
  current: readonly string[],
  add: readonly string[],
  remove: readonly string[],
): string[] => {
  const removed = new Set(remove);
  const kept = current.filter((label) => !removed.has(label));
  return [...kept, ...add.filter((label) => !kept.includes(label))];
};

/** Normalize the bounded reverse-dependent search response (F-7). */
export const normalizeJiraDependentObservation = (
  payload: unknown,
  context: JiraNormalizationContext,
): CloseoutReadObservation<readonly WorkItem[]> => {
  const normalized = normalizeJiraSearch(payload, context);
  return normalized.ok
    ? { observation: "observed", value: normalized.value }
    : {
        observation: "invalid",
        detail: "detail" in normalized ? normalized.detail : normalized.code,
      };
};

/**
 * Normalize one Jira work-item read into the discriminated observation (DM-11).
 *
 * An explicit 404 is `not-found`, a non-2xx response is `unavailable`, and a
 * malformed 2xx payload is `invalid`.
 */
export const normalizeJiraWorkItemObservation = (
  payload: unknown,
  context: JiraNormalizationContext,
  status: number,
): CloseoutReadObservation<WorkItem> => {
  if (status === 404) return { observation: "not-found" };
  if (status < 200 || status >= 300) return { observation: "unavailable" };
  const normalized = normalizeJiraIssue(payload, context);
  return normalized.ok
    ? { observation: "observed", value: normalized.value }
    : {
        observation: "invalid",
        detail: "detail" in normalized ? normalized.detail : normalized.code,
      };
};
