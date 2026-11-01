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
  type CloseoutReverseDependentObservation,
  type CredentialPort,
  type ExternalSystemInstance,
  type WorkItem,
} from "@delivery-os/core/contracts";
import type {
  ProviderReadFailure,
  ProviderReadResult,
  ProviderRequest,
  ProviderTransport,
  ProviderWriteResult,
} from "../io/provider-transport.js";
import { providerPayloadFailure } from "../io/provider-transport.js";
import {
  computeJiraLabelTargetSet,
  type JiraNormalizationContext,
  jiraNativeLabels,
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
  }) => Promise<CloseoutReverseDependentObservation<readonly WorkItem[]>>;
  readonly writeWorkItem: (input: JiraWriteWorkItemInput) => Promise<ProviderWriteResult>;
  readonly transitionWorkItem: (input: {
    readonly issueKey: string;
    readonly deliveryState: "done";
  }) => Promise<ProviderWriteResult>;
};

/** Parse a response body only when one is present (Jira PUT/POST reply 204). */
const responseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.trim().length === 0) return undefined;
  return JSON.parse(text);
};

const nativeFetchTransport = (): ProviderTransport => ({
  send: async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: request.body }),
      signal: AbortSignal.timeout(request.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS),
    });
    return { status: response.status, body: await responseBody(response) };
  },
});

const trimBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Select the transition id whose destination matches the workflow-mapped
 * native status. Zero or multiple matches are ambiguous and never guessed.
 */
const unambiguousTransitionId = (payload: unknown, nativeStatus: string): string | undefined => {
  if (!isRecord(payload) || !Array.isArray(payload.transitions)) return undefined;
  const ids: string[] = [];
  for (const transition of payload.transitions) {
    if (!isRecord(transition)) continue;
    const id = transition.id;
    const to = transition.to;
    if (typeof id !== "string" || !isRecord(to)) continue;
    if (typeof to.name === "string" && to.name === nativeStatus) ids.push(id);
  }
  return ids.length === 1 ? ids[0] : undefined;
};

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
    { readonly ok: true; readonly status: number; readonly body: unknown } | ProviderReadFailure
  > => {
    const headers = authorizedHeaders();
    if (!headers.ok) return headers;
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
      return {
        ok: false,
        code: "provider.payload.invalid",
        detail: `Jira request failed (${name})`,
      };
    }
  };

  const readObservation = async (issueKey: string): Promise<CloseoutReadObservation<WorkItem>> => {
    const response = await request("GET", `/rest/api/2/issue/${encodeURIComponent(issueKey)}`);
    if (!response.ok) {
      // A credential/config resolution failure keeps its own identity; only
      // payload/HTTP/transport failures become the invalid observation.
      return {
        observation: "invalid",
        detail: "detail" in response ? response.detail : response.code,
        ...(response.code === "provider.payload.invalid" ? {} : { code: response.code }),
      };
    }
    return normalizeJiraWorkItemObservation(response.body, context, response.status);
  };

  const writer = (response: Awaited<ReturnType<typeof request>>): ProviderWriteResult =>
    !response.ok
      ? response
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
      // The link-type argument restricts the search to the `blocks` link type;
      // the second filter keeps only issues this ticket blocks (the dependent
      // carries the inward `blocked-by` relation to this ticket), so a
      // relates-to or a ticket that blocks this one is never treated as a
      // dependent.
      const jql = `issue in linkedIssues("${input.issueKey}", "blocks") AND statusCategory != Done ORDER BY key ASC`;
      const response = await request(
        "GET",
        `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${encodeURIComponent(String(input.limit))}`,
      );
      if (!response.ok) return { observation: "unavailable" };
      // A missing search surface is a provider-level gap; an existing surface
      // whose current read fails is a signal-level skip (AC-F7-6).
      if (response.status === 404 || response.status === 410) {
        return { observation: "no-surface" };
      }
      if (response.status < 200 || response.status >= 300) return { observation: "unavailable" };
      const normalized = normalizeJiraDependentObservation(response.body, context);
      if (normalized.observation !== "observed") return normalized;
      const dependents = normalized.value.filter((candidate) =>
        candidate.relations.some(
          (relation) =>
            relation.relationKind === "blocked-by" && relation.target.entityId === input.issueKey,
        ),
      );
      return { observation: "observed", value: dependents };
    },
    writeWorkItem: async (input) => {
      const current = await request(
        "GET",
        `/rest/api/2/issue/${encodeURIComponent(input.issueKey)}`,
      );
      if (!current.ok) return current;
      if (current.status < 200 || current.status >= 300) {
        return providerPayloadFailure(`Jira returned HTTP ${current.status}`);
      }
      // The replace input is the provider's native label array only. Custom
      // fields (`team:*`, `story-points:*`) are read-only projections on the
      // normalized view and must never be persisted as real labels.
      const fields = isRecord(current.body) ? current.body.fields : undefined;
      const nativeLabels = jiraNativeLabels(fields);
      if (nativeLabels === undefined) {
        // A full-array replace computed from a collapsed empty set would erase
        // the provider's real labels; refuse instead.
        return providerPayloadFailure("Jira label signal is unavailable");
      }
      const labels = computeJiraLabelTargetSet(nativeLabels, input.add ?? [], input.remove ?? []);
      const updateFields: Record<string, unknown> = { labels };
      if (input.assignee === "none") updateFields.assignee = null;
      return writer(
        await request("PUT", `/rest/api/2/issue/${encodeURIComponent(input.issueKey)}`, {
          fields: updateFields,
        }),
      );
    },
    transitionWorkItem: async (input) => {
      const nativeStatus = nativeStatusForDeliveryState(JIRA_WORKFLOW_MAP, input.deliveryState);
      if (nativeStatus === undefined) {
        return providerPayloadFailure("Jira has no declared done transition");
      }
      const available = await request(
        "GET",
        `/rest/api/2/issue/${encodeURIComponent(input.issueKey)}/transitions`,
      );
      if (!available.ok) return available;
      if (available.status < 200 || available.status >= 300) {
        return providerPayloadFailure(`Jira returned HTTP ${available.status}`);
      }
      const transitionId = unambiguousTransitionId(available.body, nativeStatus);
      if (transitionId === undefined) {
        return providerPayloadFailure(`Jira has no unambiguous transition to "${nativeStatus}"`);
      }
      return writer(
        await request(
          "POST",
          `/rest/api/2/issue/${encodeURIComponent(input.issueKey)}/transitions`,
          { transition: { id: transitionId } },
        ),
      );
    },
  };
};
