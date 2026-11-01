/**
 * The Jira read-slice client seed (GH-188 F-3).
 *
 * Direct REST via an injected, fetch-shaped transport; production composition
 * supplies the native-`fetch` transport. Credentials resolve exclusively through
 * the injected `CredentialPort` on every request — the client never stores or
 * logs secret material and never reads the ambient environment.
 */
import {
  CLOSEOUT_OPERATION_TIMEOUT_MS,
  type CloseoutReadObservation,
  type CredentialPort,
  type ExternalSystemInstance,
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
  computeJiraLabelTargetSet,
  type JiraNormalizationContext,
  jiraNormalizationContext,
  normalizeJiraDependentObservation,
  normalizeJiraIssue,
  normalizeJiraSearch,
  normalizeJiraWorkItemObservation,
} from "./normalize.js";
import { JIRA_WORKFLOW_MAP, nativeStatusForDeliveryState } from "./workflow-map.js";

/** Construction input for the Jira seed. */
export type JiraClientOptions = {
  readonly instance: ExternalSystemInstance;
  /** The injected credential port; the declared reference resolves per request. */
  readonly credentials: CredentialPort;
  /** The injected provider transport; defaults to native `fetch`. */
  readonly transport?: ProviderTransport;
};

/** One flat closeout work-item write input (DM-5). */
export type JiraWriteWorkItemInput = {
  readonly issueKey: string;
  readonly add?: readonly string[];
  readonly remove?: readonly string[];
  readonly assignee?: "none";
};

/** The read and closeout write operations the Jira client implements. */
export type JiraClient = {
  readonly readWorkItem: (issueKey: string) => Promise<ProviderReadResult<WorkItem>>;
  readonly searchWorkItems: (jql: string) => Promise<ProviderReadResult<readonly WorkItem[]>>;
  readonly readWorkItemObservation: (
    issueKey: string,
  ) => Promise<CloseoutReadObservation<WorkItem>>;
  readonly listBlockedByDependents: (input: {
    readonly issueKey: string;
    readonly limit: number;
  }) => Promise<CloseoutReadObservation<readonly WorkItem[]>>;
  readonly writeWorkItem: (input: JiraWriteWorkItemInput) => Promise<ProviderWriteResult>;
  readonly transitionWorkItem: (input: {
    readonly issueKey: string;
    readonly deliveryState: "done";
  }) => Promise<ProviderWriteResult>;
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

/**
 * Build the Jira read-slice client.
 *
 * The transport and credential port are construction inputs (testability
 * contract); the client is a factory result, never a module-level singleton.
 */
export const createJiraClient = (options: JiraClientOptions): JiraClient => {
  const baseUrl = trimBaseUrl(options.instance.baseUrl);
  const context: JiraNormalizationContext = jiraNormalizationContext(
    options.instance.instanceName,
    JIRA_WORKFLOW_MAP,
  );
  const transport = options.transport ?? nativeFetchTransport();

  const authorizedHeaders = (): ProviderReadResult<Readonly<Record<string, string>>> => {
    const auth = options.instance.authMethod;
    if (auth.mechanism === "anonymous") {
      return { ok: true, value: { Accept: "application/json" } };
    }
    const resolution = options.credentials.resolve(auth.reference);
    if (!resolution.ok) return resolution;
    return {
      ok: true,
      value: { Accept: "application/json", Authorization: `Bearer ${resolution.material.value}` },
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
        return providerPayloadFailure(`Jira returned HTTP ${response.status}`);
      }
      return { ok: true, value: response.body };
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : "unknown error";
      return providerPayloadFailure(`Jira request failed (${name})`);
    }
  };

  const request = async (
    method: ProviderRequest["method"],
    path: string,
    body?: unknown,
  ): Promise<
    { readonly ok: true; readonly status: number; readonly body: unknown } |
    { readonly ok: false; readonly code: string; readonly detail: string }
  > => {
    const headers = authorizedHeaders();
    if (!headers.ok) {
      return { ok: false, code: headers.code, detail: headers.code };
    }
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    try {
      const response = await transport.send({
        url: `${baseUrl}${path}`,
        method,
        headers:
          serialized === undefined
            ? headers.value
            : { ...headers.value, "Content-Type": "application/json" },
        ...(serialized === undefined ? {} : { body: serialized }),
        timeoutMs: CLOSEOUT_OPERATION_TIMEOUT_MS,
      });
      return { ok: true, status: response.status, body: response.body };
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : "unknown error";
      return { ok: false, code: "provider.payload.invalid", detail: `Jira request failed (${name})` };
    }
  };

  const readObservation = async (issueKey: string): Promise<CloseoutReadObservation<WorkItem>> => {
    const response = await request("GET", `/rest/api/2/issue/${encodeURIComponent(issueKey)}`);
    if (!response.ok) return { observation: "invalid", detail: response.detail };
    return normalizeJiraWorkItemObservation(response.body, context, response.status);
  };

  const writer = (
    response: Awaited<ReturnType<typeof request>>,
  ): ProviderWriteResult =>
    !response.ok
      ? { ok: false, code: "provider.payload.invalid", detail: response.detail }
      : response.status >= 200 && response.status < 300
        ? { ok: true, value: undefined }
        : providerPayloadFailure(`Jira returned HTTP ${response.status}`);

  return {
    readWorkItem: async (issueKey) => {
      const response = await get(`/rest/api/2/issue/${encodeURIComponent(issueKey)}`);
      if (!response.ok) return response;
      return normalizeJiraIssue(response.value, context);
    },
    searchWorkItems: async (jql) => {
      const response = await get(`/rest/api/2/search?jql=${encodeURIComponent(jql)}`);
      if (!response.ok) return response;
      return normalizeJiraSearch(response.value, context);
    },
    readWorkItemObservation: (issueKey) => readObservation(issueKey),
    listBlockedByDependents: async (input) => {
      const jql = `issue in linkedIssues("${input.issueKey}") AND statusCategory != Done ORDER BY key ASC`;
      const response = await request(
        "GET",
        `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${encodeURIComponent(String(input.limit))}`,
      );
      if (!response.ok) return { observation: "unavailable" };
      if (response.status === 404 || response.status === 410) return { observation: "unavailable" };
      if (response.status < 200 || response.status >= 300) return { observation: "unavailable" };
      return normalizeJiraDependentObservation(response.body, context);
    },
    writeWorkItem: async (input) => {
      const current = await readObservation(input.issueKey);
      if (current.observation !== "observed") {
        return providerPayloadFailure("Jira work-item labels are unavailable");
      }
      const labels = computeJiraLabelTargetSet(
        current.value.labels,
        input.add ?? [],
        input.remove ?? [],
      );
      const fields: Record<string, unknown> = { labels };
      if (input.assignee === "none") fields.assignee = null;
      return writer(
        await request("PUT", `/rest/api/2/issue/${encodeURIComponent(input.issueKey)}`, { fields }),
      );
    },
    transitionWorkItem: async (input) => {
      const nativeStatus = nativeStatusForDeliveryState(JIRA_WORKFLOW_MAP, input.deliveryState);
      if (nativeStatus === undefined) {
        return providerPayloadFailure("Jira has no declared done transition");
      }
      return writer(
        await request(
          "POST",
          `/rest/api/2/issue/${encodeURIComponent(input.issueKey)}/transitions`,
          { transition: { name: nativeStatus } },
        ),
      );
    },
  };
};
