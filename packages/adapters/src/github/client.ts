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
  }) => Promise<CloseoutReadObservation<readonly WorkItem[]>>;
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
      timeoutMs: CLOSEOUT_OPERATION_TIMEOUT_MS,
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
        timeoutMs: CLOSEOUT_OPERATION_TIMEOUT_MS,
      });
      return normalizeWorkItemObservation(response.body, context, response.status);
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
      return selected === undefined
        ? { observation: "unavailable" }
        : { observation: "observed", value: selected };
    },
    listBlockedByDependents: async (input) => {
      const response = await send(
        "GET",
        `${repositoryPath}/issues/${encodeURIComponent(input.entityId)}/dependencies?per_page=${encodeURIComponent(String(input.limit ?? CLOSEOUT_MAX_DEPENDENTS))}`,
      );
      if (!response.ok) {
        return { observation: "unavailable" };
      }
      return normalizeIssueDependencies(response.value, context);
    },
    writeWorkItem: async (input) => {
      let labels: readonly string[] | undefined;
      if (input.add !== undefined || input.remove !== undefined) {
        const current = await readObservation(input.entityId);
        if (current.observation !== "observed") {
          return providerPayloadFailure("GitHub work-item labels are unavailable");
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
