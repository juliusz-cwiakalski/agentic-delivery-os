/**
 * The GitLab client seed (GH-188 F-2).
 *
 * Direct REST via an injected, fetch-shaped transport; production composition
 * supplies the native-`fetch` transport. Credentials resolve exclusively through
 * the injected `CredentialPort` on every request.
 */
import {
  CLOSEOUT_OPERATION_TIMEOUT_MS,
  type CredentialPort,
  type DeliveryRequest,
  type ExternalSystemInstance,
  type PipelineRun,
} from "@delivery-os/core/contracts";
import type {
  ProviderReadResult,
  ProviderRequest,
  ProviderTransport,
} from "../io/provider-transport.js";
import { providerPayloadFailure } from "../io/provider-transport.js";
import { normalizeMergeRequest, normalizePipelines } from "./normalize.js";

/** Construction input for the GitLab seed. */
export type GitLabClientOptions = {
  readonly instance: ExternalSystemInstance;
  readonly credentials: CredentialPort;
  /** The project path the read slice addresses (declared configuration data). */
  readonly projectPath: string;
  /** The injected provider transport; defaults to native `fetch`. */
  readonly transport?: ProviderTransport;
};

/** The read-slice operations the GitLab seed implements. */
export type GitLabClient = {
  readonly readDeliveryRequest: (
    mergeRequestIid: number,
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
      ...(request.body === undefined ? {} : { body: request.body }),
      signal: AbortSignal.timeout(request.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS),
    });
    const body: unknown = await response.json();
    return { status: response.status, body };
  },
});

const trimBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, "");

/** Build the GitLab read-slice client. */
export const createGitLabClient = (options: GitLabClientOptions): GitLabClient => {
  const baseUrl = trimBaseUrl(options.instance.baseUrl);
  const project = encodeURIComponent(options.projectPath);
  const transport = options.transport ?? nativeFetchTransport();
  const context = { systemName: options.instance.instanceName };

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
        return providerPayloadFailure(`GitLab returned HTTP ${response.status}`);
      }
      return { ok: true, value: response.body };
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : "unknown error";
      return providerPayloadFailure(`GitLab request failed (${name})`);
    }
  };

  return {
    readDeliveryRequest: async (mergeRequestIid) => {
      const response = await get(
        `/api/v4/projects/${project}/merge_requests/${encodeURIComponent(String(mergeRequestIid))}`,
      );
      if (!response.ok) return response;
      return normalizeMergeRequest(response.value, context);
    },
    readPipelineRun: async (commitSha) => {
      const response = await get(
        `/api/v4/projects/${project}/pipelines?sha=${encodeURIComponent(commitSha)}`,
      );
      if (!response.ok) return response;
      return normalizePipelines(response.value, context, commitSha);
    },
  };
};
