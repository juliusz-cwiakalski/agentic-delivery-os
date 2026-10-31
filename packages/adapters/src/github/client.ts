/**
 * The minimal GitHub read slice (GH-188 F-4).
 *
 * Direct REST via an injected, fetch-shaped transport; production composition
 * supplies the native-`fetch` transport. Credentials resolve exclusively through
 * the injected `CredentialPort` on every request.
 */
import type {
  CredentialPort,
  DeliveryRequest,
  ExternalSystemInstance,
  PipelineRun,
  WorkItem,
} from "@delivery-os/core/contracts";
import type {
  ProviderReadResult,
  ProviderRequest,
  ProviderTransport,
} from "../io/provider-transport.js";
import { providerPayloadFailure } from "../io/provider-transport.js";
import { normalizeCheckRuns, normalizeGithubIssue, normalizePullRequest } from "./normalize.js";

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

/** The read-slice operations the GitHub seed implements. */
export type GithubClient = {
  readonly readWorkItem: (issueNumber: number) => Promise<ProviderReadResult<WorkItem>>;
  readonly readDeliveryRequest: (
    pullNumber: number,
  ) => Promise<ProviderReadResult<DeliveryRequest>>;
  readonly readPipelineRun: (
    commitSha: string,
  ) => Promise<ProviderReadResult<readonly PipelineRun[]>>;
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
    readPipelineRun: async (commitSha) => {
      const response = await get(
        `${repositoryPath}/commits/${encodeURIComponent(commitSha)}/check-runs`,
      );
      if (!response.ok) return response;
      return normalizeCheckRuns(response.value, context, commitSha);
    },
  };
};
