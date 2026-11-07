/**
 * Coding-plan subscription watch mapping (GH-234 F-5, DM-9).
 *
 * Normalizes the vendor's weekly and rolling window response into the engine's
 * secret-free snapshot vocabulary. Pure: no runtime API, no credential value,
 * and no raw body survives. Every malformed or non-auth-HTTP class is an outage
 * or credential condition, never clear.
 */
import type { ProviderWatchNormalization, QuotaLimit } from "@delivery-os/core/contracts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const failed = (
  errorCode: string,
  announcementCode: string,
  failureClass: string,
  httpStatus: number,
): ProviderWatchNormalization => ({
  status: "failed",
  errorCode,
  announcementCode,
  failureClass,
  httpStatus,
});

const httpFailure = (status: number): ProviderWatchNormalization | undefined => {
  if (status === 401 || status === 403) {
    return failed(
      "provider.auth.rejected",
      "provider.quota.auth_rejected",
      `http_${status}`,
      status,
    );
  }
  if (status < 200 || status >= 300) {
    return failed("provider.outage", "provider.quota.http_error", `http_${status}`, status);
  }
  return undefined;
};

const malformed = (status: number, failureClass: string): ProviderWatchNormalization =>
  failed("provider.outage", "provider.quota.malformed", failureClass, status);

const parseWindow = (value: unknown): { percentage: number; resetEpochMs?: number } | undefined => {
  if (!isRecord(value)) return undefined;
  const percentage = value.usedPercent;
  if (typeof percentage !== "number" || !Number.isInteger(percentage) || percentage < 0) {
    return undefined;
  }
  const reset = value.resetsAtMs;
  if (reset !== undefined && (typeof reset !== "number" || !Number.isFinite(reset))) {
    return undefined;
  }
  return { percentage, ...(reset === undefined ? {} : { resetEpochMs: reset }) };
};

export type CodingPlanWatchInput = {
  readonly status: number;
  readonly bodyText: string;
  readonly nowMs: number;
  readonly thresholdPercent?: number;
};

/**
 * Normalize the coding-plan weekly and rolling windows. Both windows stay
 * distinct; a crossed threshold parks at the earliest future reset.
 */
export const normalizeCodingPlanWindows = (
  input: CodingPlanWatchInput,
): ProviderWatchNormalization => {
  const http = httpFailure(input.status);
  if (http !== undefined) return http;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.bodyText);
  } catch {
    return malformed(input.status, "malformed_json");
  }
  if (!isRecord(parsed)) return malformed(input.status, "invalid_envelope");
  const weekly = parseWindow(parsed.weekly);
  const rolling = parseWindow(parsed.rolling);
  if (weekly === undefined || rolling === undefined)
    return malformed(input.status, "window_absent");
  const limits: QuotaLimit[] = [
    {
      type: "WEEKLY_LIMIT",
      percentage: weekly.percentage,
      ...(weekly.resetEpochMs === undefined ? {} : { resetEpochMs: weekly.resetEpochMs }),
    },
    {
      type: "ROLLING_LIMIT",
      percentage: rolling.percentage,
      ...(rolling.resetEpochMs === undefined ? {} : { resetEpochMs: rolling.resetEpochMs }),
    },
  ];
  const snapshot = {
    mapping: "coding-plan-windows" as const,
    limits,
    sourceSummary: `weekly ${weekly.percentage}%, rolling ${rolling.percentage}%`,
  };
  const threshold = input.thresholdPercent ?? 100;
  const exhausted = limits.filter((limit) => limit.percentage >= threshold);
  if (exhausted.length === 0) return { status: "clear", snapshot };
  const resets = exhausted
    .map((limit) => limit.resetEpochMs)
    .filter((reset): reset is number => reset !== undefined);
  const everyHasReset = exhausted.every((limit) => limit.resetEpochMs !== undefined);
  if (!everyHasReset || resets.length === 0) {
    return failed(
      "provider.quota.exceeded",
      "provider.quota.reset_missing",
      "reset_missing",
      input.status,
    );
  }
  const reset = Math.min(...resets);
  return {
    status: "parked",
    snapshot,
    cause: "quota-exhausted",
    condition: "quota-exhausted",
    waitSeconds: Math.max(0, Math.ceil((reset - input.nowMs) / 1000)),
    expiresAtMs: reset,
  };
};
