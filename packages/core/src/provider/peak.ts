/**
 * UTC peak-window evaluation (GH-182 F-3, DM-3, DEC-10).
 *
 * Pure arithmetic over the injected clock: the effective window is the
 * half-open `[max(0, start - buffer), end)`; outside it the condition is clear.
 * No vendor constant or ambient clock enters this module.
 */
import type { ProviderConditionResult, ProviderPeakWindow } from "#contracts";

const SECONDS_PER_DAY = 86_400;

const secondsOfDay = (nowMs: number): number => {
  const seconds = Math.floor(nowMs / 1_000);
  return ((seconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
};

/** Evaluate one declared peak window at `nowMs`. */
export const evaluatePeakWindow = (
  window: ProviderPeakWindow,
  nowMs: number,
): ProviderConditionResult => {
  const effectiveStart = peakWindowOpenSeconds({
    startSecondsOfDay: window.startSecondsOfDay,
    bufferBeforeSeconds: window.bufferSeconds,
  });
  const current = secondsOfDay(nowMs);
  if (current < effectiveStart || current >= window.endSecondsOfDay) return { status: "clear" };
  const waitSeconds = window.endSecondsOfDay - current;
  const expiresAtMs = Math.floor(nowMs / 1_000) * 1_000 + waitSeconds * 1_000;
  return {
    status: "parked",
    kind: "peak-window",
    waitSeconds,
    expiresAtMs,
    announcementCode: "provider.peak.parked",
    evidence: { conditionKinds: ["peak-window"], waitSeconds },
  };
};

/** The UTC second-of-day for an instant (exported for parity assertions). */
export const utcSecondsOfDay = secondsOfDay;

/**
 * The buffer-inclusive open bound of a declared window, in seconds of day
 * (GH-294 F-3). One boundary truth shared by the profile-level F-6 gate and
 * the lane-level watcher: the window is observed open at or after this
 * second, never before it.
 */
export const peakWindowOpenSeconds = (window: {
  readonly startSecondsOfDay: number;
  readonly bufferBeforeSeconds: number;
}): number => Math.max(0, window.startSecondsOfDay - window.bufferBeforeSeconds);

/**
 * The buffer-inclusive effective end of a declared window, in seconds of day
 * (GH-294 F-5). The watch observes the window closed — and window-end resume
 * admission opens — at or after this second. With no after-buffer this is the
 * declared end, matching the delivered provider-window expiry semantics.
 */
export const peakWindowEndSeconds = (window: {
  readonly endSecondsOfDay: number;
  readonly bufferAfterSeconds: number;
}): number => Math.min(SECONDS_PER_DAY, window.endSecondsOfDay + window.bufferAfterSeconds);
