/**
 * The Jira read-slice client seed (GH-188 F-3).
 *
 * Direct REST via an injected, fetch-shaped transport; production composition
 * supplies the native-`fetch` transport. Credentials resolve exclusively through
 * the injected `CredentialPort` on every request — the client never stores or
 * logs secret material and never reads the ambient environment.
 */
import type { CredentialPort, ExternalSystemInstance, WorkItem } from "@delivery-os/core/contracts";
import type {
  ProviderReadResult,
  ProviderRequest,
  ProviderTransport,
} from "../io/provider-transport.js";
import { providerPayloadFailure } from "../io/provider-transport.js";
import {
  type JiraNormalizationContext,
  jiraNormalizationContext,
  normalizeJiraIssue,
  normalizeJiraSearch,
} from "./normalize.js";
import { JIRA_WORKFLOW_MAP } from "./workflow-map.js";

/** Construction input for the Jira seed. */
export type JiraClientOptions = {
  readonly instance: ExternalSystemInstance;
  /** The injected credential port; the declared reference resolves per request. */
  readonly credentials: CredentialPort;
  /** The injected provider transport; defaults to native `fetch`. */
  readonly transport?: ProviderTransport;
};

/** The read-slice operations the Jira seed implements. */
export type JiraClient = {
  readonly readWorkItem: (issueKey: string) => Promise<ProviderReadResult<WorkItem>>;
  readonly searchWorkItems: (jql: string) => Promise<ProviderReadResult<readonly WorkItem[]>>;
};

const nativeFetchTransport = (): ProviderTransport => ({
  send: async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
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
  };
};
