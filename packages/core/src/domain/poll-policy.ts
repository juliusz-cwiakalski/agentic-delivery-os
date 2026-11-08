/**
 * Per-platform polling policy as data (GH-238 F-14; DEC-11; DM-15).
 *
 * Exponential backoff from base to max on failure, reset to base on success, and
 * no interval below the minimum request spacing. The injected clock drives every
 * boundary; a one-shot read bypasses resident backoff state.
 */
import type { PlatformPollSettings } from "#contracts";

export type PollPolicyState = {
  readonly failures: number;
  readonly lastRequestAtMs?: number;
};

export const initialPollState: PollPolicyState = { failures: 0 };

/** The next delay: base * 2^failures capped at max and never below spacing. */
export const nextPollDelayMs = (settings: PlatformPollSettings, failures: number): number => {
  const exponent = Math.min(Math.max(0, Math.trunc(failures)), 30);
  const grown = settings.baseIntervalMs * 2 ** exponent;
  return Math.max(settings.minSpacingMs, Math.min(settings.maxIntervalMs, grown));
};

export const pollSuccess = (): PollPolicyState => ({ failures: 0 });

export const pollFailure = (state: PollPolicyState): PollPolicyState => ({
  ...state,
  failures: state.failures + 1,
});

/** Whether a request is permitted now under the minimum spacing. */
export const pollDue = (
  state: PollPolicyState,
  settings: PlatformPollSettings,
  nowMs: number,
): boolean =>
  state.lastRequestAtMs === undefined || nowMs - state.lastRequestAtMs >= settings.minSpacingMs;

/** Mark a request at the injected time (state does not read a clock). */
export const pollIssued = (state: PollPolicyState, nowMs: number): PollPolicyState => ({
  ...state,
  lastRequestAtMs: nowMs,
});

/** A one-shot read never carries resident backoff state. */
export const oneShotPollPlan = (settings: PlatformPollSettings): PlatformPollSettings => settings;
