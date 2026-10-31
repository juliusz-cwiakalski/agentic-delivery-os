/**
 * GitHub normalization: PR → `DeliveryRequest`, check runs per SHA →
 * `PipelineRun` set, issue → `WorkItem`.
 *
 * Provider-native types never leave this module. Check runs are never collapsed
 * into a roll-up: every run is a job, so a failed run cannot hide behind a green
 * suite. Issues expose `updatedAt` verbatim and leave `comments` absent (this
 * slice does not fetch the comment set).
 */
import type {
  DeliveryRequest,
  DeliveryThread,
  PipelineJobState,
  PipelineRun,
  WorkItem,
  WorkItemRelation,
} from "@delivery-os/core/contracts";
import type { ProviderReadResult } from "../io/provider-transport.js";
import { providerPayloadFailure } from "../io/provider-transport.js";
import { resolveGithubReviewState, workItemStatusFor } from "./review-state.js";

/** The declared data a GitHub normalization run consumes. */
export type GithubNormalizationContext = {
  readonly systemName: string;
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

const identityField = (
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined => {
  const value = record[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const recordField = (
  record: Readonly<Record<string, unknown>>,
  key: string,
): Record<string, unknown> | undefined => {
  const value = record[key];
  return isRecord(value) ? value : undefined;
};

const threadFrom = (value: unknown): DeliveryThread | undefined => {
  if (!isRecord(value)) return undefined;
  const threadId = identityField(value, "id");
  if (threadId === undefined) return undefined;
  const notes = value.notes;
  const commentCount = Array.isArray(notes) ? notes.length : identityField(value, "comment_count");
  if (commentCount === undefined) return undefined;
  return { threadId, resolved: value.resolved === true, commentCount: Number(commentCount) };
};

const jobStateFor = (
  status: string,
  conclusion: string | undefined,
): PipelineJobState | undefined => {
  if (status === "queued" || status === "requested" || status === "waiting") return "queued";
  if (status === "in_progress") return "running";
  if (status !== "completed") return undefined;
  switch (conclusion) {
    case "success":
      return "succeeded";
    case "failure":
    case "timed_out":
    case "action_required":
      return "failed";
    case "cancelled":
      return "canceled";
    case "skipped":
    case "neutral":
    case "stale":
      return "skipped";
    default:
      return undefined;
  }
};

/** Normalize one GitHub pull request. */
export const normalizePullRequest = (
  payload: unknown,
  context: GithubNormalizationContext,
): ProviderReadResult<DeliveryRequest> => {
  if (!isRecord(payload)) return providerPayloadFailure("GitHub PR payload is not an object");
  const entityId = identityField(payload, "number");
  if (entityId === undefined) return providerPayloadFailure("GitHub PR has no number");
  const head = recordField(payload, "head");
  const base = recordField(payload, "base");
  const sourceRef = head !== undefined ? stringField(head, "ref") : undefined;
  const targetRef = base !== undefined ? stringField(base, "ref") : undefined;
  if (sourceRef === undefined || targetRef === undefined) {
    return providerPayloadFailure(`GitHub PR ${entityId} has no head/base ref`);
  }
  const state = stringField(payload, "state");
  if (state === undefined) return providerPayloadFailure(`GitHub PR ${entityId} has no state`);

  const reviewDecision = stringField(payload, "reviewDecision");
  const reviewState = resolveGithubReviewState({
    state,
    merged: payload.merged === true,
    draft: payload.draft === true,
    ...(reviewDecision !== undefined ? { reviewDecision } : {}),
  });

  const rawThreads = payload.review_threads;
  const threads = Array.isArray(rawThreads)
    ? rawThreads.flatMap((value) => {
        const thread = threadFrom(value);
        return thread === undefined ? [] : [thread];
      })
    : [];

  return {
    ok: true,
    value: {
      identity: { systemName: context.systemName, entityId },
      sourceRef,
      targetRef,
      reviewState,
      threads,
    },
  };
};

/** Normalize the check runs for one commit SHA. */
export const normalizeCheckRuns = (
  payload: unknown,
  context: GithubNormalizationContext,
  commitSha: string,
): ProviderReadResult<readonly PipelineRun[]> => {
  if (!isRecord(payload) || !Array.isArray(payload.check_runs)) {
    return providerPayloadFailure("GitHub check-runs payload has no check_runs array");
  }
  const runs: PipelineRun[] = [];
  for (const checkRun of payload.check_runs) {
    if (!isRecord(checkRun)) return providerPayloadFailure("GitHub check run is not an object");
    const runId = identityField(checkRun, "id");
    const name = stringField(checkRun, "name");
    const status = stringField(checkRun, "status");
    if (runId === undefined || name === undefined || status === undefined) {
      return providerPayloadFailure("GitHub check run is missing id/name/status");
    }
    const conclusion = stringField(checkRun, "conclusion");
    const jobState = jobStateFor(status, conclusion);
    if (jobState === undefined) {
      return providerPayloadFailure(`GitHub check run ${runId} has an unknown status pair`);
    }
    const detailsUrl = stringField(checkRun, "details_url");
    runs.push({
      identity: { systemName: context.systemName, entityId: `${commitSha}:${runId}` },
      pipelineName: name,
      jobs: [{ jobName: name, jobState }],
      traceEvidence:
        detailsUrl === undefined ? [] : [{ evidenceName: "check-run", location: detailsUrl }],
    });
  }
  return { ok: true, value: runs };
};

const relationKindFor = (nativeType: string): WorkItemRelation["relationKind"] | undefined => {
  switch (nativeType) {
    case "blocks":
      return "blocks";
    case "blocked-by":
      return "blocked-by";
    case "relates-to":
      return "relates-to";
    default:
      return undefined;
  }
};

const relationsFrom = (
  payload: Readonly<Record<string, unknown>>,
  systemName: string,
): WorkItemRelation[] => {
  const rawLinks = payload.issue_links;
  if (!Array.isArray(rawLinks)) return [];
  const relations: WorkItemRelation[] = [];
  for (const link of rawLinks) {
    if (!isRecord(link)) continue;
    const nativeType = stringField(link, "type");
    const target = identityField(link, "number");
    if (nativeType === undefined || target === undefined) continue;
    const relationKind = relationKindFor(nativeType);
    if (relationKind === undefined) continue;
    relations.push({ relationKind, target: { systemName, entityId: target } });
  }
  return relations;
};

/** Normalize one GitHub issue. */
export const normalizeGithubIssue = (
  payload: unknown,
  context: GithubNormalizationContext,
): ProviderReadResult<WorkItem> => {
  if (!isRecord(payload)) return providerPayloadFailure("GitHub issue payload is not an object");
  const entityId = identityField(payload, "number");
  if (entityId === undefined) return providerPayloadFailure("GitHub issue has no number");
  const title = stringField(payload, "title");
  if (title === undefined) return providerPayloadFailure(`GitHub issue ${entityId} has no title`);
  const nativeStatus = stringField(payload, "state");
  if (nativeStatus === undefined) {
    return providerPayloadFailure(`GitHub issue ${entityId} has no state`);
  }
  const deliveryState = workItemStatusFor(nativeStatus);
  if (deliveryState === undefined) {
    return providerPayloadFailure(`GitHub issue ${entityId} has unmapped state "${nativeStatus}"`);
  }

  const rawLabels = payload.labels;
  const labels = Array.isArray(rawLabels)
    ? rawLabels.flatMap((label) => {
        if (!isRecord(label)) return [];
        const name = stringField(label, "name");
        return name === undefined ? [] : [name];
      })
    : [];

  const assigneeContainer = payload.assignee;
  const assignee =
    isRecord(assigneeContainer) && stringField(assigneeContainer, "login") !== undefined
      ? stringField(assigneeContainer, "login")
      : undefined;

  const updatedAt = stringField(payload, "updated_at");

  return {
    ok: true,
    value: {
      identity: { systemName: context.systemName, entityId },
      title,
      status: { nativeStatus, deliveryState },
      labels,
      ...(assignee !== undefined ? { assignee } : {}),
      relations: relationsFrom(payload, context.systemName),
      ...(updatedAt !== undefined ? { updatedAt } : {}),
    },
  };
};
