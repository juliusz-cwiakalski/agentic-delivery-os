/**
 * `@delivery-os/adapters/github` bounded review-thread discussion read
 * (GH-338 F-5, DM-3, TDR-0033).
 *
 * One bounded, adapter-local read outside the closed operation set: one thread's
 * resolution state, the provider's asserted comment total, and at most 50
 * oldest-first comments with at most 4096 UTF-8 bytes per body. Bodies are
 * evidence: no lifecycle or closeout decision may be taken from them, no write
 * path imports this module, and nothing is persisted, rendered, or captured in
 * the conformance artifact by the adapter. `DeliveryThread` keeps its field set.
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

/** The fixed comment cap per thread; never caller-tunable. */
export const GITHUB_THREAD_DISCUSSION_MAX_COMMENTS = 50;

/** The fixed per-body cap, in UTF-8 bytes; never caller-tunable. */
export const GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES = 4096;

/** Construction input for the discussion reader; there is no per-read cap option. */
export type GithubThreadDiscussionOptions = {
  readonly instance: ExternalSystemInstance;
  readonly credentials: CredentialPort;
  readonly transport: ProviderTransport;
  readonly timeoutMs?: number;
};

/** One bounded discussion comment (DM-3). */
export type GithubThreadComment = {
  readonly commentId: string;
  readonly authorLogin?: string;
  readonly authorKind?: "human" | "non-human" | "unknown";
  readonly authorAssociation?: string;
  /** A faithful byte prefix, bounded per body. */
  readonly body: string;
  /** True exactly when the provider body exceeded the per-body cap. */
  readonly bodyTruncated: boolean;
};

/** The closed thread-discussion shape (DM-3). */
export type GithubThreadDiscussion = {
  readonly threadId: string;
  readonly resolved: boolean;
  /** The provider-asserted total, preserved even when the list is capped. */
  readonly commentCount: number;
  readonly comments: readonly GithubThreadComment[];
  /** True when comments were dropped or any body was truncated. */
  readonly truncated: boolean;
};

/** The one declared read; no pagination, reply, or write surface exists. */
export type GithubThreadDiscussionReader = {
  readonly readThreadDiscussion: (
    threadId: string,
  ) => Promise<ProviderReadResult<GithubThreadDiscussion>>;
};

const THREAD_DISCUSSION_QUERY =
  "query ThreadDiscussion($threadId: ID!) { node(id: $threadId) { ... on PullRequestReviewThread { isResolved comments(first: 100) { totalCount nodes { id author { login __typename } authorAssociation body } } } } }";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const identityOf = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const authorKindOf = (
  author: Readonly<Record<string, unknown>> | undefined,
): GithubThreadComment["authorKind"] => {
  if (author === undefined) return undefined;
  const type = author.__typename;
  if (type === "Bot" || type === "App") return "non-human";
  if (type === "User") return "human";
  return "unknown";
};

/** Bound one body without splitting a multi-byte character at the cap. */
const boundBody = (body: string): { readonly body: string; readonly bodyTruncated: boolean } => {
  const bytes = Buffer.from(body, "utf8");
  if (bytes.byteLength <= GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES) {
    return { body, bodyTruncated: false };
  }
  let end = GITHUB_THREAD_DISCUSSION_MAX_BODY_BYTES;
  while (end > 0) {
    const byte = bytes.at(end);
    if (byte === undefined || (byte & 0xc0) !== 0x80) break;
    end -= 1;
  }
  return { body: bytes.subarray(0, end).toString("utf8"), bodyTruncated: true };
};

const commentFrom = (value: unknown): GithubThreadComment | undefined => {
  if (!isRecord(value)) return undefined;
  const commentId = identityOf(value.id);
  if (commentId === undefined) return undefined;
  if (typeof value.body !== "string") return undefined;
  const author = isRecord(value.author) ? value.author : undefined;
  const login =
    author !== undefined && typeof author.login === "string" && author.login.length > 0
      ? author.login
      : undefined;
  const kind = authorKindOf(author);
  const association =
    typeof value.authorAssociation === "string" && value.authorAssociation.length > 0
      ? value.authorAssociation
      : undefined;
  const bounded = boundBody(value.body);
  return {
    commentId,
    ...(login === undefined ? {} : { authorLogin: login }),
    ...(kind === undefined ? {} : { authorKind: kind }),
    ...(association === undefined ? {} : { authorAssociation: association }),
    body: bounded.body,
    bodyTruncated: bounded.bodyTruncated,
  };
};

/** Normalize one GraphQL thread node into the closed discussion shape. */
export const normalizeThreadDiscussion = (
  node: unknown,
  threadId: string,
  httpStatus?: number,
): ProviderReadResult<GithubThreadDiscussion> => {
  if (!isRecord(node)) {
    return providerPayloadFailure("GitHub thread discussion is not an object", httpStatus);
  }
  if (typeof node.isResolved !== "boolean") {
    return providerPayloadFailure("GitHub thread discussion has no resolution flag", httpStatus);
  }
  const comments = node.comments;
  if (!isRecord(comments)) {
    return providerPayloadFailure("GitHub thread discussion has no comments container", httpStatus);
  }
  const total = comments.totalCount;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) {
    return providerPayloadFailure("GitHub thread discussion has no comment total", httpStatus);
  }
  if (!Array.isArray(comments.nodes)) {
    return providerPayloadFailure("GitHub thread discussion has no comment list", httpStatus);
  }
  const bounded: GithubThreadComment[] = [];
  for (const raw of comments.nodes.slice(0, GITHUB_THREAD_DISCUSSION_MAX_COMMENTS)) {
    const comment = commentFrom(raw);
    if (comment === undefined) {
      return providerPayloadFailure("GitHub thread discussion has a malformed comment", httpStatus);
    }
    bounded.push(comment);
  }
  return {
    ok: true,
    value: {
      threadId,
      resolved: node.isResolved,
      commentCount: total,
      comments: bounded,
      truncated: bounded.length < total || bounded.some((comment) => comment.bodyTruncated),
    },
  };
};

/** Build the one-read discussion reader. */
export const createGitHubThreadDiscussionReader = (
  options: GithubThreadDiscussionOptions,
): GithubThreadDiscussionReader => {
  const baseUrl = options.instance.baseUrl.replace(/\/+$/, "");
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
    readThreadDiscussion: async (threadId) => {
      const headers = authorizedHeaders();
      if (!headers.ok) return headers;
      const request: ProviderRequest = {
        url: `${baseUrl}/graphql`,
        method: "POST",
        headers: { ...headers.value, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: THREAD_DISCUSSION_QUERY,
          variables: { threadId },
        }),
        timeoutMs,
      };
      try {
        const response = await options.transport.send(request);
        if (response.status === 404) {
          return providerNotFoundFailure("GitHub review thread was not found", 404);
        }
        if (response.status < 200 || response.status >= 300) {
          return providerPayloadFailure(`GitHub returned HTTP ${response.status}`, response.status);
        }
        if (!isRecord(response.body)) {
          return providerPayloadFailure(
            "GitHub thread-discussion payload is not an object",
            response.status,
          );
        }
        const data = response.body.data;
        if (!isRecord(data)) {
          return providerPayloadFailure(
            "GitHub thread-discussion payload has no data",
            response.status,
          );
        }
        if (data.node === null) return providerNotFoundFailure("GitHub review thread is absent");
        return normalizeThreadDiscussion(data.node, threadId, response.status);
      } catch (error: unknown) {
        const name = error instanceof Error ? error.name : "unknown error";
        return providerPayloadFailure(`GitHub request failed (${name})`);
      }
    },
  };
};
