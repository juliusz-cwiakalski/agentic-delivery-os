/**
 * `@delivery-os/adapters/provider-quota` — the production quota transport
 * (GH-182 PD-C) and the three first-iteration watch mappings (GH-234 F-5).
 *
 * This is the only admitted runtime-API edge for provider network I/O. The
 * fetch implementation is injectable; the production default is the runtime's
 * native `fetch`. Credential material is handed in once per request, used to
 * build the authorization header in memory, and never stored. The coding-plan,
 * DeepSeek-balance, and OpenAI-usage normalizers are pure text mappings.
 */
import type {
  ProviderWatchMappingPort,
  QuotaTransport,
  QuotaTransportRequest,
  QuotaTransportResult,
} from "@delivery-os/core/contracts";
import { normalizeCodingPlanWindows } from "./coding-plan.js";
import { normalizeDeepseekBalance } from "./deepseek.js";
import { normalizeOpenAiUsage } from "./openai.js";

/** The minimal response surface the transport consumes. */
export type QuotaFetchResponse = {
  readonly status: number;
  text(): Promise<string>;
};

/** The injectable fetch-like function (native fetch is the production default). */
export type QuotaFetch = (
  input: string,
  init: {
    readonly method: "GET";
    readonly headers: Readonly<Record<string, string>>;
    readonly redirect: "manual";
    readonly signal: AbortSignal;
  },
) => Promise<QuotaFetchResponse>;

export type ProviderQuotaTransportOptions = {
  readonly fetch?: QuotaFetch;
};

/**
 * Create the quota transport over an injected fetch-like function.
 *
 * One bounded GET per call; redirects are not followed with credentials; the
 * authorization header is assembled in memory and never retained.
 */
export const createProviderQuotaTransport = (
  options: ProviderQuotaTransportOptions = {},
): QuotaTransport => {
  const fetchImpl: QuotaFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  return {
    send: async (request: QuotaTransportRequest): Promise<QuotaTransportResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), request.timeoutMs);
      try {
        const response = await fetchImpl(request.endpoint, {
          method: "GET",
          headers: { authorization: `Bearer ${request.credential.value}` },
          redirect: "manual",
          signal: controller.signal,
        });
        return { status: response.status, bodyText: await response.text() };
      } finally {
        clearTimeout(timer);
      }
    },
  };
};

/**
 * Bind the closed watch mapping kinds to their normalizers. The mapping kinds
 * themselves are declared in core contracts; this factory is the single
 * adapter-side registration point.
 */
export const createProviderWatchMappings = (): ProviderWatchMappingPort => ({
  normalize: (input) => {
    switch (input.mapping) {
      case "coding-plan-windows":
        return normalizeCodingPlanWindows({
          status: input.status,
          bodyText: input.bodyText,
          nowMs: input.nowMs,
          ...(input.thresholdPercent === undefined
            ? {}
            : { thresholdPercent: input.thresholdPercent }),
        });
      case "deepseek-balance":
        return normalizeDeepseekBalance({
          status: input.status,
          bodyText: input.bodyText,
          floor: input.floor ?? 0,
        });
      case "openai-usage-windows":
        return normalizeOpenAiUsage({
          status: input.status,
          bodyText: input.bodyText,
          nowMs: input.nowMs,
          ...(input.thresholdPercent === undefined
            ? {}
            : { thresholdPercent: input.thresholdPercent }),
        });
    }
  },
});

export { normalizeCodingPlanWindows } from "./coding-plan.js";
export { normalizeDeepseekBalance } from "./deepseek.js";
export { normalizeOpenAiUsage } from "./openai.js";
