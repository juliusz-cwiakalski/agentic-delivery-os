/**
 * The minimal GitHub read slice (GH-188 F-4).
 *
 * Direct REST via an injected, fetch-shaped transport; production composition
 * supplies the native-`fetch` transport. Credentials resolve exclusively through
 * the injected `CredentialPort` on every request.
 */
import {
  CLOSEOUT_MAX_DEPENDENTS,
  CLOSEOUT_OPERATION_TIMEOUT_MS,
  type CloseoutReadObservation,
  type CloseoutReverseDependentObservation,
  type CredentialPort,
  type DeliveryRequest,
  type ExternalSystemInstance,
  type PipelineRun,
  STATUS_SOURCE_PIPELINE_LIMIT,
  type WorkItem,
} from "@delivery-os/core/contracts";
import type {
  ProviderReadResult,
  ProviderRequest,
  ProviderTransport,
  ProviderWriteResult,
} from "../io/provider-transport.js";
import { providerPayloadFailure } from "../io/provider-transport.js";
import {
  normalizeCheckRuns,
  normalizeGithubIssue,
  normalizeGithubIssueList,
  normalizeGithubPullList,
  normalizeIssueDependencies,
  normalizeMergedDeliveryRequestList,
  normalizePullRequest,
  normalizeReviewThreads,
  normalizeThreadResolution,
  normalizeWorkItemObservation,
} from "./normalize.js";

/** The repository the read slice addresses (declared configuration data). */
export type GithubRepositoryRef = {
  readonly owner: string;
  readonly name: string;
};

/** Construction input for the GitHub read slice. */
export type GithubClientOptions = {
  readonly instance: ExternalSystemInstance;
  readonly credentials: CredentialPort;
  readonly repository: GithubRepositoryRef;
  /** The injected provider transport; defaults to native `fetch`. */
  readonly transport?: ProviderTransport;
  /** A short test override for the per-operation timeout; production omits it. */
  readonly timeoutMs?: number;
};

/** One flat closeout work-item write input (DM-5). */
export type GithubWriteWorkItemInput = {
  readonly entityId: string;
  readonly add?: readonly string[];
  readonly remove?: readonly string[];
  readonly assignee?: "none";
};

/** The read and closeout write operations the GitHub client implements. */
export type GithubClient = {
  readonly readWorkItem: (issueNumber: number) => Promise<ProviderReadResult<WorkItem>>;
  readonly readDeliveryRequest: (
    pullNumber: number,
  ) => Promise<ProviderReadResult<DeliveryRequest>>;
  readonly readPipelineRun: (
    commitSha: string,
    limit?: number,
  ) => Promise<
    ProviderReadResult<{ readonly items: readonly PipelineRun[]; readonly pageItemCount: number }>
  >;
  readonly listWorkItems: (
    limit: number,
  ) => Promise<
    ProviderReadResult<{ readonly items: readonly WorkItem[]; readonly pageItemCount: number }>
  >;
  readonly listDeliveryRequests: (limit: number) => Promise<
    ProviderReadResult<{
      readonly items: readonly DeliveryRequest[];
      readonly pageItemCount: number;
    }>
  >;
  readonly readWorkItemObservation: (
    entityId: string,
  ) => Promise<CloseoutReadObservation<WorkItem>>;
  readonly findMergedDeliveryRequest: (input: {
    readonly workItemRef: string;
    readonly limit: number;
  }) => Promise<CloseoutReadObservation<DeliveryRequest>>;
  readonly listBlockedByDependents: (input: {
    readonly entityId: string;
    readonly limit: number;
  }) => Promise<CloseoutReverseDependentObservation<readonly WorkItem[]>>;
  readonly writeWorkItem: (input: GithubWriteWorkItemInput) => Promise<ProviderWriteResult>;
  readonly transitionWorkItem: (input: {
    readonly entityId: string;
    readonly deliveryState: "done";
  }) => Promise<ProviderWriteResult>;
  readonly resolveDeliveryThread: (input: {
    readonly deliveryRequest: { readonly systemName: string; readonly entityId: string };
    readonly threadId: string;
  }) => Promise<ProviderWriteResult>;
};

const WORK_ITEM_REF_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;

const matchesWorkItemRef = (sourceRef: string, workItemRef: string): boolean =>
  new RegExp(`^[a-z][a-z0-9-]*/${workItemRef}/.+$`).test(sourceRef) &&
  WORK_ITEM_REF_PATTERN.test(workItemRef);

const numericEntity = (entityId: string): number | undefined => {
  if (!/^\d+$/.test(entityId)) return undefined;
  const value = Number(entityId);
  return Number.isSafeInteger(value) ? value : undefined;
};

const REVIEW_THREADS_QUERY =
  "query ReviewThreads($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { reviewThreads(first: 100) { nodes { id isResolved comments { totalCount } } } } } }";

const selectMerged = (requests: readonly DeliveryRequest[]): DeliveryRequest | undefined => {
  let selected: DeliveryRequest | undefined;
  for (const request of requests) {
    if (selected === undefined) {
      selected = request;
      continue;
    }
    const left = numericEntity(request.identity.entityId);
    const right = numericEntity(selected.identity.entityId);
    if (left !== undefined && right !== undefined) {
      if (left > right) selected = request;
      continue;
    }
    if (request.identity.entityId > selected.identity.entityId) selected = request;
  }
  return selected;
};

const nativeFetchTransport = (): ProviderTransport => ({
  send: async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
      signal: AbortSignal.timeout(request.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS),
    });
    const body: unknown = await response.json();
    return { status: response.status, body };
  },
});

const trimBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

/** Build the GitHub read-slice client. */
export const createGitHubClient = (options: GithubClientOptions): GithubClient => {
  const baseUrl = trimBaseUrl(options.instance.baseUrl);
  const repositoryPath = `/repos/${encodeURIComponent(options.repository.owner)}/${encodeURIComponent(options.repository.name)}`;
  const transport = options.transport ?? nativeFetchTransport();
  const timeoutMs = options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS;
  const context = { systemName: options.instance.instanceName };

  const authorizedHeaders = (): ProviderReadResult<Readonly<Record<string, string>>> => {
    const auth = options.instance.authMethod;
    if (auth.mechanism === "anonymous") {
      return { ok: true, value: { Accept: "application/vnd.github+json" } };
    }
    const resolution = options.credentials.resolve(auth.reference);
    if (!resolution.ok) return resolution;
    return {
      ok: true,
      value: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${resolution.material.value}`,
      },
    };
  };

  const get = async (path: string): Promise<ProviderReadResult<unknown>> => {
    const headers = authorizedHeaders();
    if (!headers.ok) return headers;
    const request: ProviderRequest = {
      url: `${baseUrl}${path}`,
      method: "GET",
      headers: headers.value,
      timeoutMs,
    };
    try {
      const response = await transport.send(request);
      if (response.status < 200 || response.status >= 300) {
        return providerPayloadFailure(`GitHub returned HTTP ${response.status}`);
      }
      return { ok: true, value: response.body };
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : "unknown error";
      return providerPayloadFailure(`GitHub request failed (${name})`);
    }
  };

  const send = async (
    method: ProviderRequest["method"],
    path: string,
    body?: unknown,
  ): Promise<ProviderReadResult<unknown>> => {
    const headers = authorizedHeaders();
    if (!headers.ok) return headers;
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    const request: ProviderRequest = {
      url: `${baseUrl}${path}`,
      method,
      headers:
        serialized === undefined
          ? headers.value
          : { ...headers.value, "Content-Type": "application/json" },
      ...(serialized === undefined ? {} : { body: serialized }),
      timeoutMs,
    };
    try {
      const response = await transport.send(request);
      if (response.status < 200 || response.status >= 300) {
        return providerPayloadFailure(`GitHub returned HTTP ${response.status}`);
      }
      return { ok: true, value: response.body };
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : "unknown error";
      return providerPayloadFailure(`GitHub request failed (${name})`);
    }
  };

  const withDependencyRelations = async (
    entityId: string,
    normalized: CloseoutReadObservation<WorkItem>,
    headers: Readonly<Record<string, string>>,
  ): Promise<CloseoutReadObservation<WorkItem>> => {
    if (normalized.observation !== "observed") return normalized;
    try {
      const response = await transport.send({
        url: `${baseUrl}${repositoryPath}/issues/${encodeURIComponent(entityId)}/dependencies/blocked_by?per_page=${encodeURIComponent(String(CLOSEOUT_MAX_DEPENDENTS))}`,
        method: "GET",
        headers,
        timeoutMs,
      });
      if (response.status < 200 || response.status >= 300) {
        return {
          ...normalized,
          signals: { ...(normalized.signals ?? {}), relations: "unavailable" },
        };
      }
      const dependencies = normalizeIssueDependencies(response.body, context);
      if (dependencies.observation !== "observed") {
        return {
          ...normalized,
          signals: { ...(normalized.signals ?? {}), relations: "unavailable" },
        };
      }
      // The dependency read is authoritative: each returned issue is a blocker
      // of this issue. The REST issue payload itself never carries links.
      const relations = dependencies.value.map((blocker) => ({
        relationKind: "blocked-by" as const,
        target: blocker.identity,
      }));
      return {
        ...normalized,
        value: { ...normalized.value, relations },
        signals: { ...(normalized.signals ?? {}), relations: "observed" },
      };
    } catch {
      return {
        ...normalized,
        signals: { ...(normalized.signals ?? {}), relations: "unavailable" },
      };
    }
  };

  const readObservation = async (entityId: string): Promise<CloseoutReadObservation<WorkItem>> => {
    const headers = authorizedHeaders();
    if (!headers.ok) {
      return { observation: "invalid", detail: headers.code };
    }
    try {
      const response = await transport.send({
        url: `${baseUrl}${repositoryPath}/issues/${encodeURIComponent(entityId)}`,
        method: "GET",
        headers: headers.value,
        timeoutMs,
      });
      const normalized = normalizeWorkItemObservation(response.body, context, response.status);
      return normalized.observation === "observed"
        ? withDependencyRelations(entityId, normalized, headers.value)
        : normalized;
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : "unknown error";
      return { observation: "invalid", detail: `GitHub request failed (${name})` };
    }
  };

  const writer = (result: ProviderReadResult<unknown>): ProviderWriteResult =>
    result.ok ? { ok: true, value: undefined } : result;

  return {
    readWorkItem: async (issueNumber) => {
      const response = await get(
        `${repositoryPath}/issues/${encodeURIComponent(String(issueNumber))}`,
      );
      if (!response.ok) return response;
      return normalizeGithubIssue(response.value, context);
    },
    readDeliveryRequest: async (pullNumber) => {
      const response = await get(
        `${repositoryPath}/pulls/${encodeURIComponent(String(pullNumber))}`,
      );
      if (!response.ok) return response;
      return normalizePullRequest(response.value, context);
    },
    readPipelineRun: async (commitSha, limit = STATUS_SOURCE_PIPELINE_LIMIT) => {
      const response = await get(
        `${repositoryPath}/commits/${encodeURIComponent(commitSha)}/check-runs?per_page=${encodeURIComponent(String(limit))}`,
      );
      if (!response.ok) return response;
      return normalizeCheckRuns(response.value, context, commitSha);
    },
    listWorkItems: async (limit) => {
      const response = await get(
        `${repositoryPath}/issues?state=open&per_page=${encodeURIComponent(String(limit))}&sort=updated&direction=desc`,
      );
      if (!response.ok) return response;
      return normalizeGithubIssueList(response.value, context);
    },
    listDeliveryRequests: async (limit) => {
      const response = await get(
        `${repositoryPath}/pulls?state=open&per_page=${encodeURIComponent(String(limit))}&sort=updated&direction=desc`,
      );
      if (!response.ok) return response;
      return normalizeGithubPullList(response.value, context);
    },
    readWorkItemObservation: (entityId) => readObservation(entityId),
    findMergedDeliveryRequest: async (input) => {
      const response = await get(
        `${repositoryPath}/pulls?state=closed&per_page=${encodeURIComponent(String(input.limit))}&sort=updated&direction=desc`,
      );
      if (!response.ok) {
        return response.code === "provider.payload.invalid"
          ? { observation: "invalid", detail: response.detail }
          : { observation: "unavailable" };
      }
      const normalized = normalizeMergedDeliveryRequestList(response.value, context);
      if (!normalized.ok) {
        return {
          observation: "invalid",
          detail: "detail" in normalized ? normalized.detail : normalized.code,
        };
      }
      const matching = normalized.value.filter((request) =>
        matchesWorkItemRef(request.sourceRef, input.workItemRef),
      );
      const selected = selectMerged(matching);
      if (selected === undefined) return { observation: "unavailable" };
      // The REST pull-request list has no review threads, so the selected PR is
      // re-read through GraphQL. A failed thread read keeps the request observed
      // but marks the thread signal unavailable, never an observed empty set.
      const pullNumber = numericEntity(selected.identity.entityId);
      if (pullNumber === undefined) {
        return {
          observation: "observed",
          value: { ...selected, threads: [] },
          signals: { threads: "unavailable" },
        };
      }
      const threadsResponse = await send("POST", "/graphql", {
        query: REVIEW_THREADS_QUERY,
        variables: {
          owner: options.repository.owner,
          name: options.repository.name,
          number: pullNumber,
        },
      });
      if (!threadsResponse.ok) {
        return {
          observation: "observed",
          value: { ...selected, threads: [] },
          signals: { threads: "unavailable" },
        };
      }
      const threads = normalizeReviewThreads(threadsResponse.value);
      return threads.ok
        ? {
            observation: "observed",
            value: { ...selected, threads: threads.value },
            signals: { threads: "observed" },
          }
        : {
            observation: "observed",
            value: { ...selected, threads: [] },
            signals: { threads: "unavailable" },
          };
    },
    listBlockedByDependents: async (input) => {
      const headers = authorizedHeaders();
      if (!headers.ok) return { observation: "invalid", detail: headers.code };
      try {
        const response = await transport.send({
          url: `${baseUrl}${repositoryPath}/issues/${encodeURIComponent(input.entityId)}/dependencies/blocking?per_page=${encodeURIComponent(String(input.limit ?? CLOSEOUT_MAX_DEPENDENTS))}`,
          method: "GET",
          headers: headers.value,
          timeoutMs,
        });
        // A missing endpoint means the provider has no bounded reverse-read
        // surface: that is a provider-level gap, never an empty observed set.
        if (response.status === 404 || response.status === 410) {
          return { observation: "no-surface" };
        }
        // An existing surface whose current read is unavailable (auth outage,
        // server failure, transport error) is a signal-level skip.
        if (response.status < 200 || response.status >= 300) {
          return { observation: "unavailable" };
        }
        return normalizeIssueDependencies(response.body, context);
      } catch {
        return { observation: "unavailable" };
      }
    },
    writeWorkItem: async (input) => {
      let labels: readonly string[] | undefined;
      if (input.add !== undefined || input.remove !== undefined) {
        const current = await readObservation(input.entityId);
        if (current.observation !== "observed") {
          return providerPayloadFailure("GitHub work-item labels are unavailable");
        }
        if (current.signals?.labels === "unavailable") {
          // Never synthesize a replacement from a collapsed empty set.
          return providerPayloadFailure("GitHub label signal is unavailable");
        }
        const remove = new Set(input.remove ?? []);
        const add = input.add ?? [];
        labels = [
          ...current.value.labels.filter((label) => !remove.has(label)),
          ...add.filter((label) => !current.value.labels.includes(label)),
        ];
      }
      const body: Record<string, unknown> = {};
      if (labels !== undefined) body.labels = labels;
      if (input.assignee === "none") body.assignee = null;
      return writer(
        await send("PATCH", `${repositoryPath}/issues/${encodeURIComponent(input.entityId)}`, body),
      );
    },
    transitionWorkItem: async (input) =>
      writer(
        await send("PATCH", `${repositoryPath}/issues/${encodeURIComponent(input.entityId)}`, {
          state: "closed",
        }),
      ),
    resolveDeliveryThread: async (input) => {
      const response = await send("POST", "/graphql", {
        query:
          "mutation ResolveReviewThread($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } } }",
        variables: { threadId: input.threadId },
      });
      if (!response.ok) return response;
      const normalized = normalizeThreadResolution(response.value);
      return normalized.ok ? { ok: true, value: undefined } : normalized;
    },
  };
};
