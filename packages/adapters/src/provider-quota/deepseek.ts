/**
 * DeepSeek balance watch mapping (GH-234 F-5, DM-9).
 *
 * Normalizes the balance API and compares it to a configured floor. Above the
 * floor is clear; below the floor is the engine's exhaustion class with an
 * honest recovery condition (operator top-up, never a fabricated reset). Pure:
 * no runtime API and no secret survives.
 */
import type { ProviderWatchNormalization } from "@delivery-os/core/contracts";

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

export type DeepseekWatchInput = {
  readonly status: number;
  readonly bodyText: string;
  readonly floor: number;
};

/** Normalize the balance response and compare it to the configured floor. */
export const normalizeDeepseekBalance = (input: DeepseekWatchInput): ProviderWatchNormalization => {
  const http = httpFailure(input.status);
  if (http !== undefined) return http;
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.bodyText);
  } catch {
    return failed("provider.outage", "provider.quota.malformed", "malformed_json", input.status);
  }
  if (!isRecord(parsed)) {
    return failed("provider.outage", "provider.quota.malformed", "invalid_envelope", input.status);
  }
  const balance = parsed.balance;
  if (typeof balance !== "number" || !Number.isFinite(balance) || balance < 0) {
    return failed("provider.outage", "provider.quota.malformed", "balance_absent", input.status);
  }
  const snapshot = {
    mapping: "deepseek-balance" as const,
    limits: [],
    sourceSummary: `balance ${balance.toFixed(2)} vs floor ${input.floor.toFixed(2)}`,
  };
  if (balance >= input.floor) return { status: "clear", snapshot };
  // Below floor: the engine's exhaustion class. The recovery condition is
  // operator top-up; no reset instant is invented.
  return failed(
    "provider.quota.exceeded",
    "provider.quota.reset_missing",
    "below-floor:top-up",
    input.status,
  );
};
