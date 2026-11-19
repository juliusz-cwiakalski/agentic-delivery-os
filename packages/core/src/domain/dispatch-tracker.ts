/**
 * The bounded tracker retry ladder (GH-347 F-4, API-4; DM-8; DEC-7; TDR-0048).
 *
 * Declared policy constants and one pure wait function, plus a runner over an
 * injected read and the injected `delay(ms, reason)` fact. No configuration key,
 * no ambient timer, and no success-shaped value from a failed read.
 */
import type { DispatchDelay } from "#contracts";
import type { DispatchRead } from "./dispatch-result.js";

/** The declared attempt bound (5), the base wait (2 s), and the cap (30 s). */
export const DISPATCH_TRACKER_LADDER_ATTEMPTS = 5 as const;
export const DISPATCH_TRACKER_LADDER_BASE_MS = 2_000 as const;
export const DISPATCH_TRACKER_LADDER_CAP_MS = 30_000 as const;

/** The wait before attempt `n + 1`: `min(base * 2^(n-1), cap)`. */
export const dispatchTrackerLadderWait = (n: number): number => {
  if (n < 1) return 0;
  const raw = DISPATCH_TRACKER_LADDER_BASE_MS * 2 ** (n - 1);
  return Math.min(raw, DISPATCH_TRACKER_LADDER_CAP_MS);
};

/** The exhaustion identity the attempt carries when every attempt failed. */
export const DISPATCH_TRACKER_EXHAUSTED_IDENTITY = "tracker:exhausted" as const;

export type DispatchTrackerLadderOutcome<T> =
  | { readonly ok: true; readonly value: T; readonly attempts: number }
  | {
      readonly ok: false;
      readonly attempts: number;
      /** The bounded identity the caller records as evidence. */
      readonly identity: typeof DISPATCH_TRACKER_EXHAUSTED_IDENTITY;
    };

/**
 * Read the tracker through the ladder.
 *
 * A readable result is used immediately; a failed attempt waits the declared
 * interval and retries, up to five attempts. Exhaustion returns a bounded
 * failure identity — never a stale or invented tracker fact. The one injected
 * delay is the only time source, so the offline battery spends zero real time.
 */
export const runDispatchTrackerLadder = async <T>(input: {
  readonly read: () => Promise<DispatchRead<T>>;
  readonly delay?: DispatchDelay;
}): Promise<DispatchTrackerLadderOutcome<T>> => {
  for (let attempt = 1; attempt <= DISPATCH_TRACKER_LADDER_ATTEMPTS; attempt += 1) {
    const read = await input.read();
    if (read.ok) return { ok: true, value: read.value, attempts: attempt };
    if (attempt === DISPATCH_TRACKER_LADDER_ATTEMPTS) break;
    const ms = dispatchTrackerLadderWait(attempt);
    if (input.delay !== undefined) await input.delay(ms, "tracker-ladder");
  }
  return {
    ok: false,
    attempts: DISPATCH_TRACKER_LADDER_ATTEMPTS,
    identity: DISPATCH_TRACKER_EXHAUSTED_IDENTITY,
  };
};
