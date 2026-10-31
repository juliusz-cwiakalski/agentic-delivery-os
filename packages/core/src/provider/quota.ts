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
  ProviderErrorCode,
  ProviderParkEvidence,
  QuotaEvaluation,
  QuotaLimit,
  QuotaSnapshot,
  QuotaTransportResult,
} from "#contracts";

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
      return failed("provider.outage", "provider.quota.malformed", "limits_nonarray", result.status);
    }
    const type = entry.type;
    const percentage = entry.percentage;
    if (typeof type !== "string") {
      return failed("provider.outage", "provider.quota.malformed", "limits_nonarray", result.status);
    }
    if (
      typeof percentage !== "number" ||
      !Number.isInteger(percentage) ||
      percentage < 0
    ) {
      return failed("provider.outage", "provider.quota.malformed", "pct_non_numeric", result.status);
    }
    const reset = entry.nextResetTime;
    const resetEpochMs =
      typeof reset === "number" && Number.isFinite(reset) ? reset : undefined;
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
  const anyReset = exhausted.some((limit) => {
    const reset = limit.resetEpochMs;
    return reset !== undefined && Number.isFinite(reset);
  });
  if (anyReset) {
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
