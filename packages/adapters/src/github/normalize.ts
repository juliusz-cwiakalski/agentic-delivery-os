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
  CloseoutReadObservation,
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
  const headSha = head !== undefined ? stringField(head, "sha") : undefined;
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
      ...(headSha === undefined ? {} : { headSha }),
    },
  };
};

/** Normalize the check runs for one commit SHA, reporting the raw page size. */
export const normalizeCheckRuns = (
  payload: unknown,
  context: GithubNormalizationContext,
  commitSha: string,
): ProviderReadResult<{
  readonly items: readonly PipelineRun[];
  readonly pageItemCount: number;
}> => {
  if (!isRecord(payload) || !Array.isArray(payload.check_runs)) {
    return providerPayloadFailure("GitHub check-runs payload has no check_runs array");
  }
  const pageItemCount = payload.check_runs.length;
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
  return { ok: true, value: { items: runs, pageItemCount } };
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

/**
 * Normalize one bounded GitHub issue-list page.
 *
 * Pull-request objects are filtered before normalization, while the raw page
 * size is preserved so the caller can derive the source-at-limit signal even
 * when filtering reduces the normalized count.
 */
export const normalizeGithubIssueList = (
  payload: unknown,
  context: GithubNormalizationContext,
): ProviderReadResult<{ readonly items: readonly WorkItem[]; readonly pageItemCount: number }> => {
  if (!Array.isArray(payload)) {
    return providerPayloadFailure("GitHub issue list payload is not an array");
  }
  const items: WorkItem[] = [];
  for (const entry of payload) {
    if (isRecord(entry) && Object.hasOwn(entry, "pull_request")) continue;
    const normalized = normalizeGithubIssue(entry, context);
    if (!normalized.ok) return normalized;
    items.push(normalized.value);
  }
  return { ok: true, value: { items, pageItemCount: payload.length } };
};

/** Normalize one bounded GitHub pull-request-list page; any bad entry fails the read. */
export const normalizeGithubPullList = (
  payload: unknown,
  context: GithubNormalizationContext,
): ProviderReadResult<{
  readonly items: readonly DeliveryRequest[];
  readonly pageItemCount: number;
}> => {
  if (!Array.isArray(payload)) {
    return providerPayloadFailure("GitHub pull-request list payload is not an array");
  }
  const items: DeliveryRequest[] = [];
  for (const entry of payload) {
    const normalized = normalizePullRequest(entry, context);
    if (!normalized.ok) return normalized;
    items.push(normalized.value);
  }
  return { ok: true, value: { items, pageItemCount: payload.length } };
};


/** Normalize a bounded merged-PR page, keeping only merged requests (F-12). */
export const normalizeMergedDeliveryRequestList = (
  payload: unknown,
  context: GithubNormalizationContext,
): ProviderReadResult<readonly DeliveryRequest[]> => {
  const list = normalizeGithubPullList(payload, context);
  if (!list.ok) return list;
  return {
    ok: true,
    value: list.value.items.filter((request) => request.reviewState === "merged"),
  };
};

/** Normalize the bounded reverse-dependent issue page (F-7). */
export const normalizeIssueDependencies = (
  payload: unknown,
  context: GithubNormalizationContext,
): CloseoutReadObservation<readonly WorkItem[]> => {
  if (!Array.isArray(payload)) {
    return { observation: "invalid", detail: "GitHub issue-dependencies payload is not an array" };
  }
  const items: WorkItem[] = [];
  for (const entry of payload) {
    if (isRecord(entry) && Object.hasOwn(entry, "pull_request")) continue;
    const normalized = normalizeGithubIssue(entry, context);
    if (!normalized.ok) {
      return {
        observation: "invalid",
        detail: "detail" in normalized ? normalized.detail : normalized.code,
      };
    }
    items.push(normalized.value);
  }
  return { observation: "observed", value: items };
};

/** Normalize a GraphQL `resolveReviewThread` payload (F-8). */
export const normalizeThreadResolution = (
  payload: unknown,
): ProviderReadResult<{ readonly resolved: boolean }> => {
  if (!isRecord(payload)) {
    return providerPayloadFailure("GitHub GraphQL payload is not an object");
  }
  const data = recordField(payload, "data");
  const mutation = data === undefined ? undefined : recordField(data, "resolveReviewThread");
  if (mutation === undefined) {
    return providerPayloadFailure("GitHub GraphQL payload has no resolveReviewThread");
  }
  const thread = recordField(mutation, "thread");
  if (thread === undefined || typeof thread.isResolved !== "boolean") {
    return providerPayloadFailure("GitHub GraphQL resolveReviewThread has no thread state");
  }
  return { ok: true, value: { resolved: thread.isResolved } };
};

/**
 * Normalize one work-item read into the discriminated observation (DM-11).
 *
 * An explicit HTTP 404 is `not-found`; a non-2xx response is `unavailable`; and
 * a malformed 2xx payload is `invalid`. None is collapsed into another.
 */
export const normalizeWorkItemObservation = (
  payload: unknown,
  context: GithubNormalizationContext,
  status: number,
): CloseoutReadObservation<WorkItem> => {
  if (status === 404) return { observation: "not-found" };
  if (status < 200 || status >= 300) return { observation: "unavailable" };
  const normalized = normalizeGithubIssue(payload, context);
  return normalized.ok
    ? { observation: "observed", value: normalized.value }
    : {
        observation: "invalid",
        detail: "detail" in normalized ? normalized.detail : normalized.code,
      };
};
