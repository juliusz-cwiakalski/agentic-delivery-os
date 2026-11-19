/**
 * Quota snapshot normalization and legacy-parity evaluation (GH-182 F-4, DM-9).
 *
 * Pure: the transport envelope is untrusted text; only a normalized snapshot
 * (limits, integer percentages, optional reset epochs) survives. Every
 * indeterminate class fails loud with a classified identity and announcement
 * code; no raw body is retained or returned.
 */
import type {
  AnnouncementCode,
  CredentialPort,
  CredentialReference,
  ProviderClock,
  ProviderConfiguration,
  ProviderErrorCode,
  ProviderParkEvidence,
  ProviderWatchConditionView,
  ProviderWatchMappingPort,
  ProviderWatchNormalization,
  ProviderWatchTarget,
  QuotaEvaluation,
  QuotaLimit,
  QuotaSnapshot,
  QuotaTransport,
  QuotaTransportResult,
} from "#contracts";
import { formatUtcIso } from "./parks.js";

export type QuotaNormalizationFailure = {
  readonly errorCode: ProviderErrorCode;
  readonly announcementCode: AnnouncementCode;
  readonly failureClass: string;
  readonly httpStatus: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const failed = (
  errorCode: ProviderErrorCode,
  announcementCode: AnnouncementCode,
  failureClass: string,
  httpStatus: number,
): QuotaNormalizationFailure => ({ errorCode, announcementCode, failureClass, httpStatus });

/** Classify transport/HTTP failures before parsing (Appendix C). */
export const classifyQuotaTransport = (
  result: QuotaTransportResult,
): QuotaNormalizationFailure | undefined => {
  if (result.status === 401 || result.status === 403) {
    return failed(
      "provider.auth.rejected",
      "provider.quota.auth_rejected",
      `http_${result.status}`,
      result.status,
    );
  }
  if (result.status < 200 || result.status >= 300) {
    return failed(
      "provider.outage",
      "provider.quota.http_error",
      `http_${result.status}`,
      result.status,
    );
  }
  return undefined;
};

/** Normalize a sanitized envelope body into a secret-free snapshot (DM-9). */
export const normalizeQuotaEnvelopeResult = (
  result: QuotaTransportResult,
): QuotaSnapshot | QuotaNormalizationFailure => {
  const transport = classifyQuotaTransport(result);
  if (transport !== undefined) return transport;
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.bodyText);
  } catch {
    return failed("provider.outage", "provider.quota.malformed", "malformed_json", result.status);
  }
  if (!isRecord(parsed)) {
    return failed("provider.outage", "provider.quota.malformed", "invalid_envelope", result.status);
  }
  if (parsed.code !== 200 || parsed.success !== true) {
    return failed("provider.outage", "provider.quota.malformed", "invalid_envelope", result.status);
  }
  const data = parsed.data;
  if (!isRecord(data) || !Array.isArray(data.limits)) {
    return failed("provider.outage", "provider.quota.malformed", "limits_absent", result.status);
  }
  const limits: QuotaLimit[] = [];
  for (const entry of data.limits) {
    if (!isRecord(entry)) {
      return failed(
        "provider.outage",
        "provider.quota.malformed",
        "limits_nonarray",
        result.status,
      );
    }
    const type = entry.type;
    const percentage = entry.percentage;
    if (typeof type !== "string") {
      return failed(
        "provider.outage",
        "provider.quota.malformed",
        "limits_nonarray",
        result.status,
      );
    }
    if (typeof percentage !== "number" || !Number.isInteger(percentage) || percentage < 0) {
      return failed(
        "provider.outage",
        "provider.quota.malformed",
        "pct_non_numeric",
        result.status,
      );
    }
    const reset = entry.nextResetTime;
    const resetEpochMs = typeof reset === "number" && Number.isFinite(reset) ? reset : undefined;
    limits.push({
      type,
      percentage,
      ...(resetEpochMs === undefined ? {} : { resetEpochMs }),
    });
  }
  return { limits };
};

/** Evaluate a normalized snapshot against the configured threshold (DM-9). */
export const evaluateQuotaSnapshot = (
  snapshot: QuotaSnapshot,
  thresholdPercent: number,
  nowMs: number,
): QuotaEvaluation => {
  const tokens = snapshot.limits.filter((limit) => limit.type === "TOKENS_LIMIT");
  const exhausted = tokens.filter((limit) => limit.percentage >= thresholdPercent);
  if (exhausted.length === 0) return { status: "clear", snapshot };
  const futureResets = exhausted
    .map((limit) => limit.resetEpochMs)
    .filter(
      (reset): reset is number => reset !== undefined && Number.isFinite(reset) && reset > nowMs,
    );
  if (futureResets.length > 0) {
    const reset = Math.min(...futureResets);
    const waitSeconds = Math.ceil((reset - nowMs) / 1_000);
    const evidence: ProviderParkEvidence = {
      conditionKinds: ["quota-exhausted"],
      waitSeconds,
      resetEpochMs: reset,
    };
    return {
      status: "parked",
      waitSeconds,
      expiresAtMs: reset,
      snapshot,
      evidence,
    };
  }
  // A past reset clamps to zero only when the exhausted limits' only reset
  // evidence is past and no exhausted limit lacks a valid reset (DM-9). A
  // mixed past/absent case is indeterminate: never treat it as clear.
  const everyLimitHasReset = exhausted.every((limit) => {
    const reset = limit.resetEpochMs;
    return reset !== undefined && Number.isFinite(reset);
  });
  if (everyLimitHasReset) {
    return { status: "clear", snapshot };
  }
  return {
    status: "failed",
    errorCode: "provider.quota.exceeded",
    announcementCode: "provider.quota.reset_missing",
    failureClass: "reset_missing",
    httpStatus: 200,
  };
};

/** Normalize and evaluate one sanitized transport envelope. */
export const evaluateQuotaResponse = (
  result: QuotaTransportResult,
  thresholdPercent: number,
  nowMs: number,
): QuotaEvaluation => {
  const normalized = normalizeQuotaEnvelopeResult(result);
  if ("limits" in normalized) {
    return evaluateQuotaSnapshot(normalized, thresholdPercent, nowMs);
  }
  return {
    status: "failed",
    errorCode: normalized.errorCode,
    announcementCode: normalized.announcementCode,
    failureClass: normalized.failureClass,
    httpStatus: normalized.httpStatus,
  };
};

/* ------------------------------------------------------------------------- *
 * GH-234 — read-only watch condition view (F-5, DM-9, AC-F9-7).
 *
 * Authorization resolves only through the credential port; the material is
 * handed once to the transport and never cached or returned. The read path
 * performs zero state writes: no store is accepted.
 * ------------------------------------------------------------------------- */

export type ProviderWatchStatusRuntime = {
  readonly clock: ProviderClock;
  readonly credentialPort: CredentialPort;
  readonly transport: QuotaTransport;
  readonly mappings: ProviderWatchMappingPort;
};

export type ProviderWatchStatusInput = {
  readonly targets: Readonly<Record<string, ProviderWatchTarget>>;
  readonly credentials: ProviderConfiguration["credentials"];
  readonly providerName?: string;
  /**
   * The observation instant the readings stand for (GH-350 F-7). Absent means
   * the read instant, which is what the live composition supplies.
   */
  readonly observedAtMs?: number;
};

export type ProviderWatchStatusResult =
  | { readonly ok: true; readonly providers: readonly ProviderWatchConditionView[] }
  | { readonly ok: false; readonly code: string; readonly summary: string };

export type ProviderWatchStatusReader = {
  readonly status: (input: ProviderWatchStatusInput) => Promise<ProviderWatchStatusResult>;
};

/** The declared default observation bound, applied policy-side (GH-350 F-7). */
export const PROVIDER_WATCH_DEFAULT_MAX_AGE_SECONDS = 900 as const;

/**
 * The one freshness predicate's age input (GH-350 F-7, DM-8): whole seconds
 * between the injected clock and the supplied observation instant, floored and
 * clamped at zero so an observation from the future is fresh rather than
 * negative.
 */
export const watchObservationAgeSeconds = (input: {
  readonly nowMs: number;
  readonly observedAtMs: number;
}): number => Math.max(0, Math.floor((input.nowMs - input.observedAtMs) / 1_000));

/** Stale exactly at the bound: the first stale value is `maxAgeSeconds`. */
export const isWatchObservationStale = (input: {
  readonly ageSeconds: number;
  readonly maxAgeSeconds: number;
}): boolean => input.ageSeconds >= input.maxAgeSeconds;

/**
 * The evidence-bounded park rule (GH-350 F-7, AC-F7-3): a park derived from an
 * observation expires no later than `observedAt + maxAgeSeconds * 1000`, and
 * when that instant is not strictly in the future no park is created at all.
 *
 * This rule has no production consumer today, and that is deliberate: the
 * watch reader is read-only (`provider watch status` writes nothing), so no
 * surface currently derives a park from a watch observation. It is retained as
 * the declared rule a future watch-park path must satisfy — the freshness
 * predicate (`isWatchObservationStale`) is the gate that makes the bound
 * meaningful, and the phase-7 suite exercises the clamp directly — rather than
 * deleting the only statement of the property.
 */
export const clampWatchParkExpiry = (input: {
  readonly naturalExpiryMs: number;
  readonly observedAtMs: number;
  readonly maxAgeSeconds: number;
  readonly nowMs: number;
}): number | undefined => {
  const bound = input.observedAtMs + input.maxAgeSeconds * 1_000;
  const expiresAtMs = Math.min(input.naturalExpiryMs, bound);
  return expiresAtMs > input.nowMs ? expiresAtMs : undefined;
};

const watchStaleSource = (observedAt: string, maxAgeSeconds: number): string =>
  `observed at ${observedAt}; max age ${maxAgeSeconds}s`;

const conditionForFailure = (normalization: ProviderWatchNormalization): string => {
  if (normalization.status === "parked") return normalization.condition;
  if (normalization.status === "clear") return "clear";
  switch (normalization.errorCode) {
    case "provider.auth.rejected":
      return "credential-rejected";
    case "provider.quota.exceeded":
      return "quota-exhausted";
    case "provider.outage":
      return "provider-outage";
    default:
      return "provider-outage";
  }
};

const summaryForFailure = (normalization: ProviderWatchNormalization): string => {
  if (normalization.status === "failed") return normalization.failureClass;
  if (normalization.status === "parked") return normalization.snapshot.sourceSummary;
  return normalization.snapshot.sourceSummary;
};

const credentialReference = (
  credentials: ProviderConfiguration["credentials"],
  credentialRef: string,
): CredentialReference | undefined => {
  const declared = credentials[credentialRef];
  if (declared === undefined) return undefined;
  return { referenceName: credentialRef, sourceKey: declared.sourceKey };
};

/**
 * Build the read-only watch status reader over injected seams. The provider set
 * comes from the declared watch targets; no state is read or written.
 */
export const createProviderWatchStatus = (
  runtime: ProviderWatchStatusRuntime,
): ProviderWatchStatusReader => ({
  status: async (input: ProviderWatchStatusInput): Promise<ProviderWatchStatusResult> => {
    const names = Object.keys(input.targets).sort();
    if (input.providerName !== undefined) {
      if (input.targets[input.providerName] === undefined) {
        return {
          ok: false,
          code: "input.value.rejected",
          summary: `provider ${input.providerName} has no declared watch target`,
        };
      }
      names.length = 0;
      names.push(input.providerName);
    }
    for (const name of names) {
      const declared = input.targets[name]?.maxAgeSeconds;
      if (declared !== undefined && (!Number.isInteger(declared) || declared <= 0)) {
        return {
          ok: false,
          code: "config.value.invalid",
          summary: `provider.profiles.watch.${name}.maxAgeSeconds must be a positive integer`,
        };
      }
    }
    const nowMs = runtime.clock.nowMs();
    const checkedAt = formatUtcIso(nowMs);
    const observedAtMs = input.observedAtMs ?? nowMs;
    const observedAt = formatUtcIso(observedAtMs);
    const ageSeconds = watchObservationAgeSeconds({ nowMs, observedAtMs });
    const providers: ProviderWatchConditionView[] = [];
    for (const name of names) {
      const target = input.targets[name];
      if (target === undefined) continue;
      const maxAgeSeconds = target.maxAgeSeconds ?? PROVIDER_WATCH_DEFAULT_MAX_AGE_SECONDS;
      const observation = { observedAt, ageSeconds, maxAgeSeconds };
      if (isWatchObservationStale({ ageSeconds, maxAgeSeconds })) {
        // A stale reading has evidence; it is never probed, never coerced to
        // clear, and never reported as an outage.
        providers.push({
          name,
          condition: "watch-stale",
          source: watchStaleSource(observedAt, maxAgeSeconds),
          checkedAt,
          ...observation,
        });
        continue;
      }
      const reference = credentialReference(input.credentials, target.credentialRef);
      if (reference === undefined) {
        providers.push({
          name,
          condition: "credential-missing",
          source: `credential ${target.credentialRef} is not declared`,
          checkedAt,
          ...observation,
        });
        continue;
      }
      const resolved = runtime.credentialPort.resolve(reference);
      if (!resolved.ok) {
        providers.push({
          name,
          condition: "credential-missing",
          source: `credential ${target.credentialRef} did not resolve`,
          checkedAt,
          ...observation,
        });
        continue;
      }
      let result: QuotaTransportResult;
      try {
        result = await runtime.transport.send({
          endpoint: target.endpoint,
          method: "GET",
          timeoutMs: 15000,
          credential: resolved.material,
        });
      } catch {
        providers.push({
          name,
          condition: "provider-outage",
          source: "transport failure",
          checkedAt,
          ...observation,
        });
        continue;
      }
      const normalization = runtime.mappings.normalize({
        mapping: target.mapping,
        bodyText: result.bodyText,
        status: result.status,
        nowMs,
        ...(target.floor === undefined ? {} : { floor: target.floor }),
        ...(target.thresholdPercent === undefined
          ? {}
          : { thresholdPercent: target.thresholdPercent }),
      });
      providers.push({
        name,
        condition: conditionForFailure(normalization) as ProviderWatchConditionView["condition"],
        source: summaryForFailure(normalization),
        checkedAt,
        ...observation,
      });
    }
    return { ok: true, providers };
  },
});
