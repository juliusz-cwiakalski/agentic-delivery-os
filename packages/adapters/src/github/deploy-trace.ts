/**
 * `@delivery-os/adapters/github` bounded deploy-trace read (GH-225 F-6, NG-5).
 *
 * One bounded read per invocation: the deploy job's execution trace (executed
 * steps with outcomes and produced artifacts). No log bodies, no retries, no
 * pagination, and no trigger/re-run/schedule/cancel capability exists on this
 * surface.
 */
import {
  CLOSEOUT_OPERATION_TIMEOUT_MS,
  type CredentialPort,
  type ExternalSystemInstance,
} from "@delivery-os/core/contracts";
import type {
  ProviderReadResult,
  ProviderRequest,
  ProviderTransport,
} from "../io/provider-transport.js";
import { providerNotFoundFailure, providerPayloadFailure } from "../io/provider-transport.js";

/** The repository the trace read addresses. */
export type DeployTraceRepository = {
  readonly owner: string;
  readonly name: string;
};

/** Construction input for the deploy-trace reader. */
export type GithubDeployTraceOptions = {
  readonly instance: ExternalSystemInstance;
  readonly credentials: CredentialPort;
  readonly repository: DeployTraceRepository;
  readonly transport: ProviderTransport;
  readonly timeoutMs?: number;
};

/** One executed step in the provider trace. */
export type GithubDeployStep = {
  readonly name: string;
  readonly status: "succeeded" | "failed" | "skipped" | "unknown";
};

/** One produced artifact in the provider trace. */
export type GithubDeployArtifact = {
  readonly name: string;
};

/** The provider-neutral deploy trace. */
export type GithubDeployTrace = {
  readonly jobId: string;
  readonly pipelineName: string;
  readonly headSha?: string;
  readonly status?: string;
  readonly located: boolean;
  readonly steps: readonly GithubDeployStep[];
  readonly artifacts: readonly GithubDeployArtifact[];
};

/** The one declared read operation; no trigger capability exists. */
export type GithubDeployTraceReader = {
  readonly readDeployTrace: (
    jobId: string,
    pipelineName?: string,
  ) => Promise<ProviderReadResult<GithubDeployTrace>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stepStatus = (value: unknown): GithubDeployStep["status"] => {
  if (value === "success" || value === "succeeded") return "succeeded";
  if (value === "failure" || value === "failed") return "failed";
  if (value === "skipped") return "skipped";
  return "unknown";
};

/** Normalize the provider job payload into the closed trace shape. */
export const normalizeDeployTrace = (
  payload: unknown,
  jobId: string,
  pipelineName: string,
): ProviderReadResult<GithubDeployTrace> => {
  if (!isRecord(payload)) return providerPayloadFailure("GitHub deploy trace is not an object");
  const rawSteps = Array.isArray(payload.steps) ? payload.steps : [];
  const steps: GithubDeployStep[] = [];
  for (const raw of rawSteps) {
    if (!isRecord(raw) || typeof raw.name !== "string" || raw.name.length === 0) continue;
    steps.push({ name: raw.name, status: stepStatus(raw.status ?? raw.conclusion) });
  }
  const rawArtifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
  const artifacts: GithubDeployArtifact[] = [];
  for (const raw of rawArtifacts) {
    if (typeof raw === "string") {
      artifacts.push({ name: raw });
      continue;
    }
    if (isRecord(raw) && typeof raw.name === "string" && raw.name.length > 0) {
      artifacts.push({ name: raw.name });
    }
  }
  return {
    ok: true,
    value: {
      jobId,
      pipelineName:
        typeof payload.name === "string" && payload.name.length > 0 ? payload.name : pipelineName,
      ...(typeof payload.head_sha === "string" ? { headSha: payload.head_sha } : {}),
      ...(typeof payload.status === "string" ? { status: payload.status } : {}),
      located: true,
      steps,
      artifacts,
    },
  };
};

/** Build the one-read deploy-trace reader. */
export const createGitHubDeployTraceReader = (
  options: GithubDeployTraceOptions,
): GithubDeployTraceReader => {
  const baseUrl = options.instance.baseUrl.replace(/\/+$/, "");
  const repositoryPath = `/repos/${encodeURIComponent(options.repository.owner)}/${encodeURIComponent(options.repository.name)}`;
  const timeoutMs = options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS;

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

  return {
    readDeployTrace: async (jobId, pipelineName = "deploy") => {
      const headers = authorizedHeaders();
      if (!headers.ok) return headers;
      const request: ProviderRequest = {
        url: `${baseUrl}${repositoryPath}/actions/jobs/${encodeURIComponent(jobId)}`,
        method: "GET",
        headers: headers.value,
        timeoutMs,
      };
      try {
        const response = await options.transport.send(request);
        if (response.status === 404) return providerNotFoundFailure("GitHub deploy job not found");
        if (response.status < 200 || response.status >= 300) {
          return providerPayloadFailure(`GitHub returned HTTP ${response.status}`);
        }
        return normalizeDeployTrace(response.body, jobId, pipelineName);
      } catch (error: unknown) {
        const name = error instanceof Error ? error.name : "unknown error";
        return providerPayloadFailure(`GitHub request failed (${name})`);
      }
    },
  };
};
