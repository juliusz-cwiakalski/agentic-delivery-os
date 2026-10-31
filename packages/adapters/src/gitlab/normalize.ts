/**
 * GitLab normalization: merge request → `DeliveryRequest`, pipelines per commit
 * → a truthful `PipelineRun` set.
 *
 * Provider-native types never leave this module. Pipeline multiplicity is
 * preserved: every pipeline the provider reports for the commit is returned;
 * nothing is collapsed to the newest entry. Job states and trace evidence are
 * normalized, never reduced to a bare status colour.
 */
import type {
  DeliveryRequest,
  DeliveryThread,
  PipelineJob,
  PipelineJobState,
  PipelineRun,
  TraceEvidenceRef,
} from "@delivery-os/core/contracts";
import type { ProviderReadResult } from "../io/provider-transport.js";
import { providerPayloadFailure } from "../io/provider-transport.js";
import { type GitLabMergeStatusInput, resolveGitLabReviewState } from "./merge-status.js";

/** The declared data a GitLab normalization run consumes. */
export type GitLabNormalizationContext = {
  readonly systemName: string;
};

const JOB_STATES: Readonly<Record<string, PipelineJobState>> = {
  created: "queued",
  pending: "queued",
  queued: "queued",
  running: "running",
  success: "succeeded",
  failed: "failed",
  canceled: "canceled",
  skipped: "skipped",
  manual: "queued",
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

const numberField = (
  record: Readonly<Record<string, unknown>>,
  key: string,
): number | undefined => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

const threadFrom = (value: unknown): DeliveryThread | undefined => {
  if (!isRecord(value)) return undefined;
  const threadId = identityField(value, "id");
  if (threadId === undefined) return undefined;
  const notes = value.notes;
  const commentCount = Array.isArray(notes) ? notes.length : numberField(value, "comment_count");
  if (commentCount === undefined) return undefined;
  return { threadId, resolved: value.resolved === true, commentCount };
};

const jobFrom = (value: unknown): PipelineJob | undefined => {
  if (!isRecord(value)) return undefined;
  const jobName = stringField(value, "name");
  const nativeStatus = stringField(value, "status");
  if (jobName === undefined || nativeStatus === undefined) return undefined;
  const jobState = JOB_STATES[nativeStatus];
  if (jobState === undefined) return undefined;
  return { jobName, jobState };
};

const traceFrom = (value: unknown): TraceEvidenceRef | undefined => {
  if (!isRecord(value)) return undefined;
  const evidenceName = stringField(value, "evidenceName");
  const location = stringField(value, "location");
  if (evidenceName === undefined || location === undefined) return undefined;
  return { evidenceName, location };
};

/** Normalize one GitLab merge request. */
export const normalizeMergeRequest = (
  payload: unknown,
  context: GitLabNormalizationContext,
): ProviderReadResult<DeliveryRequest> => {
  if (!isRecord(payload)) return providerPayloadFailure("GitLab MR payload is not an object");
  const entityId = identityField(payload, "iid") ?? identityField(payload, "id");
  if (entityId === undefined) return providerPayloadFailure("GitLab MR has no iid or id");
  const sourceRef = stringField(payload, "source_branch");
  const targetRef = stringField(payload, "target_branch");
  if (sourceRef === undefined || targetRef === undefined) {
    return providerPayloadFailure(`GitLab MR ${entityId} has no source/target branch`);
  }
  const mrState = stringField(payload, "state");
  if (mrState === undefined) {
    return providerPayloadFailure(`GitLab MR ${entityId} has no state`);
  }

  const mergeStatus = stringField(payload, "merge_status");
  const detailedMergeStatus = stringField(payload, "detailed_merge_status");
  const input: GitLabMergeStatusInput = {
    mrState,
    draft: payload.draft === true,
    approvals: numberField(payload, "approvals") ?? 0,
    ...(mergeStatus !== undefined ? { mergeStatus } : {}),
    ...(detailedMergeStatus !== undefined ? { detailedMergeStatus } : {}),
  };
  const resolution = resolveGitLabReviewState(input);
  if (!resolution.ok) {
    return providerPayloadFailure(`GitLab MR ${entityId}: ${resolution.detail}`);
  }

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
      reviewState: resolution.reviewState,
      threads,
    },
  };
};

/**
 * Normalize the pipelines the provider reports for one commit.
 *
 * Every pipeline whose `sha` matches is returned; a provider payload without a
 * jobs list fails visibly rather than inventing jobs.
 */
export const normalizePipelines = (
  payload: unknown,
  context: GitLabNormalizationContext,
  commitSha: string,
): ProviderReadResult<readonly PipelineRun[]> => {
  if (!isRecord(payload) || !Array.isArray(payload.pipelines)) {
    return providerPayloadFailure("GitLab pipeline payload has no pipelines array");
  }
  const runs: PipelineRun[] = [];
  for (const pipeline of payload.pipelines) {
    if (!isRecord(pipeline))
      return providerPayloadFailure("GitLab pipeline entry is not an object");
    const pipelineSha = stringField(pipeline, "sha");
    if (pipelineSha !== undefined && pipelineSha !== commitSha) continue;
    const entityId = identityField(pipeline, "id");
    if (entityId === undefined) {
      return providerPayloadFailure("GitLab pipeline has no id");
    }
    const rawJobs = pipeline.jobs;
    if (!Array.isArray(rawJobs)) {
      return providerPayloadFailure(`GitLab pipeline ${entityId} has no jobs list`);
    }
    const jobs: PipelineJob[] = [];
    for (const rawJob of rawJobs) {
      const job = jobFrom(rawJob);
      if (job === undefined) {
        return providerPayloadFailure(`GitLab pipeline ${entityId} has an unknown job state`);
      }
      jobs.push(job);
    }
    const trace = traceFrom(pipeline.trace);
    runs.push({
      identity: { systemName: context.systemName, entityId },
      pipelineName: `pipeline-${entityId}`,
      jobs,
      traceEvidence: trace === undefined ? [] : [trace],
    });
  }
  return { ok: true, value: runs };
};
