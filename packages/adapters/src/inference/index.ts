/**
 * `@delivery-os/adapters/inference` — the core-owned inference transport
 * implementer (GH-227 F-4, DEC-3, ADR-0005 C-2).
 *
 * This is the declared network-I/O edge for the commit primitive. It consumes
 * provisioned availability facts, the credential port, and the shared
 * `ProviderTransport` HTTP seam; it never reads the environment, never caches a
 * credential, and never calls `fetch` directly. A classified failure is data,
 * never a throw across the transport port.
 */
import type {
  CommitMessageDraft,
  CommitTokenSpend,
  CommitTransportOutcome,
  CommitTransportPort,
  CommitTransportRequest,
  CredentialPort,
  CredentialReference,
} from "@delivery-os/core/contracts";
import type { ProviderTransport } from "../io/provider-transport.js";

/** The constrained response schema the request declares. */
export const COMMIT_MESSAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "breaking"],
  properties: {
    subject: { type: "string", maxLength: 72 },
    body: { type: "string" },
    breaking: { type: "boolean" },
  },
} as const;

/** The production-shaped inference transport construction input. */
export type InferenceTransportOptions = {
  readonly endpoint: string;
  readonly model: string;
  readonly credentials: CredentialPort;
  readonly credentialRef: CredentialReference;
  readonly transport: ProviderTransport;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const messageFrom = (value: unknown): CommitMessageDraft | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.subject !== "string" || value.subject.length === 0) return undefined;
  if (typeof value.breaking !== "boolean") return undefined;
  if (value.body !== undefined && typeof value.body !== "string") return undefined;
  return {
    subject: value.subject,
    ...(value.body === undefined ? {} : { body: value.body }),
    breaking: value.breaking,
  };
};

const spendFrom = (value: unknown): CommitTokenSpend => {
  if (!isRecord(value)) return { inputTokens: 0, outputTokens: 0 };
  const input = typeof value.prompt_tokens === "number" ? value.prompt_tokens : 0;
  const output = typeof value.completion_tokens === "number" ? value.completion_tokens : 0;
  return { inputTokens: input, outputTokens: output };
};

const contentFrom = (body: unknown): unknown => {
  if (!isRecord(body)) return undefined;
  const choices = body.choices;
  if (!Array.isArray(choices)) return undefined;
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return undefined;
  const content = first.message.content;
  if (typeof content !== "string") return undefined;
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return undefined;
  }
};

const failure = (code: string, detail?: string): CommitTransportOutcome => ({
  ok: false,
  transport: "core-inference",
  code,
  ...(detail === undefined ? {} : { detail }),
});

/** Build the core-owned inference transport over injected I/O seams. */
export const createInferenceTransport = (
  options: InferenceTransportOptions,
): CommitTransportPort => ({
  generate: async (request: CommitTransportRequest): Promise<CommitTransportOutcome> => {
    const credential = options.credentials.resolve(options.credentialRef);
    if (!credential.ok) return failure("config.credential.missing");
    const payload = {
      model: options.model,
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: "commit_message", schema: COMMIT_MESSAGE_SCHEMA, strict: true },
      },
      messages: [
        {
          role: "system",
          content:
            "Return one JSON object with subject, optional body, and breaking. The subject must be a conventional header using the computed type and ref.",
        },
        {
          role: "user",
          content: JSON.stringify({
            skeleton: request.skeleton,
            bundle: request.bundle,
            validationErrors: request.validationErrors ?? [],
          }),
        },
      ],
    };
    let response: Awaited<ReturnType<ProviderTransport["send"]>>;
    try {
      response = await options.transport.send({
        url: options.endpoint,
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${credential.material.value}`,
          ...(options.headers ?? {}),
        },
        body: JSON.stringify(payload),
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      });
    } catch {
      return failure("provider.outage");
    }
    if (response.status === 401 || response.status === 403) {
      return failure("provider.auth.rejected");
    }
    if (response.status < 200 || response.status >= 300) {
      return failure("provider.outage", `HTTP ${response.status}`);
    }
    const message = messageFrom(contentFrom(response.body));
    if (message === undefined) {
      return failure("provider.payload.invalid");
    }
    const usage = isRecord(response.body) ? response.body.usage : undefined;
    return {
      ok: true,
      message,
      transport: "core-inference",
      tokenSpend: spendFrom(usage),
    };
  },
});
