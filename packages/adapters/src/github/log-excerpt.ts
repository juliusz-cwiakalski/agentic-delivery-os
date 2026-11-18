/**
 * `@delivery-os/adapters/github` bounded failure-log excerpt (GH-338 F-4, DM-4).
 *
 * One bounded, adapter-local read outside the closed operation set: a faithful
 * byte prefix of the provider's log text, an explicit truncation flag as the
 * sole truncation authority, and the returned byte length. The cap is one fixed
 * constant with no caller-tunable override, the read performs one request with
 * no pagination and no retry, and nothing is persisted, rendered, or captured in
 * the conformance artifact by the adapter.
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

/** The single fixed excerpt cap, in UTF-8 bytes; never caller-tunable. */
export const GITHUB_LOG_EXCERPT_MAX_BYTES = 8192;

/** The repository the excerpt read addresses. */
export type LogExcerptRepository = {
  readonly owner: string;
  readonly name: string;
};

/** Construction input for the excerpt reader; there is no per-read cap option. */
export type GithubLogExcerptOptions = {
  readonly instance: ExternalSystemInstance;
  readonly credentials: CredentialPort;
  readonly repository: LogExcerptRepository;
  readonly transport: ProviderTransport;
  readonly timeoutMs?: number;
};

/** The closed excerpt shape (DM-4). */
export type GithubLogExcerpt = {
  readonly jobId: string;
  /** A faithful byte prefix; never re-encoded, trimmed, or re-ordered. */
  readonly excerpt: string;
  /** The sole truncation authority. */
  readonly truncated: boolean;
  /** The returned bytes (always equal to `Buffer.byteLength(excerpt)`). */
  readonly byteLength: number;
};

/** The one declared read; no archive, pagination, tail, or retry surface exists. */
export type GithubLogExcerptReader = {
  readonly readLogExcerpt: (jobId: string) => Promise<ProviderReadResult<GithubLogExcerpt>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The 2xx body as log text. The fixture-decided surface is a JSON envelope
 * (`{ "text": string }`); a raw string body is accepted too, so a text-yielding
 * transport need not invent an envelope.
 */
const logTextOf = (body: unknown): string | undefined => {
  if (typeof body === "string") return body;
  if (isRecord(body) && typeof body.text === "string") return body.text;
  return undefined;
};

/** Bound one text value into the closed excerpt shape without splitting a character. */
export const boundLogExcerpt = (jobId: string, text: string): GithubLogExcerpt => {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.byteLength <= GITHUB_LOG_EXCERPT_MAX_BYTES) {
    return { jobId, excerpt: text, truncated: false, byteLength: bytes.byteLength };
  }
  let end = GITHUB_LOG_EXCERPT_MAX_BYTES;
  // 0b10xxxxxx is a UTF-8 continuation byte: a sequence started before the cap.
  while (end > 0) {
    const byte = bytes.at(end);
    if (byte === undefined || (byte & 0xc0) !== 0x80) break;
    end -= 1;
  }
  const slice = bytes.subarray(0, end);
  return {
    jobId,
    excerpt: slice.toString("utf8"),
    truncated: true,
    byteLength: slice.byteLength,
  };
};

/** Build the one-read, fixed-cap excerpt reader. */
export const createGitHubLogExcerptReader = (
  options: GithubLogExcerptOptions,
): GithubLogExcerptReader => {
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
    readLogExcerpt: async (jobId) => {
      const headers = authorizedHeaders();
      if (!headers.ok) return headers;
      const request: ProviderRequest = {
        url: `${baseUrl}${repositoryPath}/actions/jobs/${encodeURIComponent(jobId)}/logs`,
        method: "GET",
        headers: headers.value,
        timeoutMs,
      };
      try {
        const response = await options.transport.send(request);
        if (response.status === 404) {
          return providerNotFoundFailure("GitHub job log was not found", 404);
        }
        if (response.status < 200 || response.status >= 300) {
          return providerPayloadFailure(`GitHub returned HTTP ${response.status}`, response.status);
        }
        const text = logTextOf(response.body);
        if (text === undefined) {
          return providerPayloadFailure("GitHub job log body has no text", response.status);
        }
        return { ok: true, value: boundLogExcerpt(jobId, text) };
      } catch (error: unknown) {
        const name = error instanceof Error ? error.name : "unknown error";
        return providerPayloadFailure(`GitHub request failed (${name})`);
      }
    },
  };
};
