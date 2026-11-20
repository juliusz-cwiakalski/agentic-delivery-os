/**
 * The declared restart-backoff schedule (GH-348 F-3, DM-5, DEC-4).
 *
 * Pure policy data: no clock, no timer, no configuration read. The delay before
 * the next session after ordinal `n` is
 * `restartDelayMs(n) = min(2 000 * 2^(n-1), 300 000)` for `n >= 1`; the wait
 * itself is injected by the composition, so a battery records rather than
 * sleeps (NFR-1).
 */
import { LOOP_BACKOFF_BASE_MS, LOOP_BACKOFF_CAP_MS, LOOP_BACKOFF_MAX_ORDINAL } from "#contracts";

/** The declared delay for one consumed ordinal, in milliseconds. */
export const restartDelayMs = (ordinal: number): number => {
  if (!Number.isFinite(ordinal) || ordinal < 1) return 0;
  const exponent = Math.min(Math.floor(ordinal) - 1, 30);
  return Math.min(LOOP_BACKOFF_BASE_MS * 2 ** exponent, LOOP_BACKOFF_CAP_MS);
};

/** The whole declared table for ordinals 1..10: 2, 4, 8, ... 300, 300 seconds. */
export const LOOP_RESTART_DELAYS_MS: readonly number[] = Array.from(
  { length: LOOP_BACKOFF_MAX_ORDINAL },
  (_unused, index) => restartDelayMs(index + 1),
);

/** The total delay of a full epoch's worth of ordinals, in milliseconds. */
export const totalBackoffMs = (maxOrdinal: number = LOOP_BACKOFF_MAX_ORDINAL): number => {
  let total = 0;
  for (let ordinal = 1; ordinal <= maxOrdinal; ordinal += 1) total += restartDelayMs(ordinal);
  return total;
};

/**
 * The detection-to-next-session bound FORMULA (NFR-5, AC-F5-5):
 * `stuck-window + collection-interval + kill-grace + first backoff`.
 *
 * The implementation holds the formula; 652 000 ms is only the shipped-default
 * value, never a literal (PM ruling R-09).
 */
export const detectionBoundMs = (input: {
  readonly stuckWindowMs: number;
  readonly collectionIntervalMs: number;
  readonly killGraceMs: number;
}): number =>
  input.stuckWindowMs + input.collectionIntervalMs + input.killGraceMs + restartDelayMs(1);

/** The shipped-default detection bound, derived from the formula. */
export const SHIPPED_DETECTION_BOUND_MS = detectionBoundMs({
  stuckWindowMs: 600_000,
  collectionIntervalMs: 30_000,
  killGraceMs: 20_000,
});

/** The at-bound history reference `epoch-<n>;restarts=<count>;seq=<n>` (R-20). */
export const historyReference = (input: {
  readonly budgetEpochId: string;
  readonly restarts: number;
  readonly sequence: number | null;
}): string =>
  `${input.budgetEpochId};restarts=${String(input.restarts)};seq=${
    input.sequence === null ? "0" : String(input.sequence)
  }`;
