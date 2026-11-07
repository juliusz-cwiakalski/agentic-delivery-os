/**
 * OpenAI subscription usage-window watch mapping (GH-234 F-5, DM-9, DM-10).
 *
 * Normalizes declared usage windows and percentages like quota limits; a
 * crossed threshold parks at the earliest future window end. Every malformed or
 * non-auth-HTTP class is an outage or credential condition, never clear.
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

type Window = {
  readonly name: string;
  readonly percentage: number;
  readonly resetEpochMs?: number;
};

const parseWindowEntry = (value: unknown): Window | undefined => {
  if (!isRecord(value)) return undefined;
  const name = value.name;
  if (typeof name !== "string" || name.length === 0) return undefined;
  const percentage = value.usedPercent;
  if (typeof percentage !== "number" || !Number.isInteger(percentage) || percentage < 0) {
    return undefined;
  }
  const reset = value.resetsAtMs;
  if (reset !== undefined && (typeof reset !== "number" || !Number.isFinite(reset))) {
    return undefined;
  }
  return { name, percentage, ...(reset === undefined ? {} : { resetEpochMs: reset }) };
};

export type OpenAiWatchInput = {
  readonly status: number;
  readonly bodyText: string;
  readonly nowMs: number;
  readonly thresholdPercent?: number;
};

/** Normalize the declared usage windows; the window end supplies park expiry. */
export const normalizeOpenAiUsage = (input: OpenAiWatchInput): ProviderWatchNormalization => {
  const http = httpFailure(input.status);
  if (http !== undefined) return http;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.bodyText);
  } catch {
    return malformed(input.status, "malformed_json");
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.windows) || parsed.windows.length === 0) {
    return malformed(input.status, "windows_absent");
  }
  const windows: Window[] = [];
  for (const entry of parsed.windows) {
    const window = parseWindowEntry(entry);
    if (window === undefined) return malformed(input.status, "window_malformed");
    windows.push(window);
  }
  const limits: QuotaLimit[] = windows.map((window) => ({
    type: `OPENAI_${window.name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_LIMIT`,
    percentage: window.percentage,
    ...(window.resetEpochMs === undefined ? {} : { resetEpochMs: window.resetEpochMs }),
  }));
  const snapshot = {
    mapping: "openai-usage-windows" as const,
    limits,
    sourceSummary: windows.map((window) => `${window.name} ${window.percentage}%`).join(", "),
  };
  const threshold = input.thresholdPercent ?? 100;
  const exhausted = limits.filter((limit) => limit.percentage >= threshold);
  if (exhausted.length === 0) return { status: "clear", snapshot };
  const everyHasReset = exhausted.every((limit) => limit.resetEpochMs !== undefined);
  const resets = exhausted
    .map((limit) => limit.resetEpochMs)
    .filter((reset): reset is number => reset !== undefined);
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
