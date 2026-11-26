/**
 * GH-413 peak-window rule fixtures (F-2, DEC-12, TC-PEAK-001/004/005/006).
 *
 * Declared rule data only: the dispatch watch and the daemon watch read the
 * same parsed shape, and the tests never derive a window of their own.
 */
import type { ProviderProfilePeakRules } from "../../../../packages/core/src/contracts/provider-profile";

const utcMs = (hour: number, minute = 0, day = 12): number =>
  Date.parse(
    `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`,
  );

const window = (startHour: number, endHour: number, bufferBefore = 0, bufferAfter = 0) => ({
  timezone: "UTC",
  startSecondsOfDay: startHour * 3_600,
  endSecondsOfDay: endHour * 3_600,
  multiplier: 2,
  bufferBeforeSeconds: bufferBefore,
  bufferAfterSeconds: bufferAfter,
});

export const SINGLE_WINDOW_RULES: ProviderProfilePeakRules = {
  windows: [window(6, 10)],
  graceSecondsDefault: 20,
  graceSecondsMax: 60,
};

/** A window whose remaining time can be smaller than the delivered kill grace. */
export const SMALL_BUFFER_RULES: ProviderProfilePeakRules = {
  windows: [window(6, 7, 0, 5)],
  graceSecondsDefault: 20,
  graceSecondsMax: 60,
};

/** A profile grace longer than one observation cadence. */
export const GRACE_ABOVE_CADENCE_RULES: ProviderProfilePeakRules = {
  windows: [window(6, 10)],
  graceSecondsDefault: 120,
  graceSecondsMax: 300,
};

/** Two windows overlapping in effect (06-10 and 09-11). */
export const OVERLAPPING_WINDOW_RULES: ProviderProfilePeakRules = {
  windows: [window(6, 10), window(9, 11)],
  graceSecondsDefault: 20,
  graceSecondsMax: 60,
};

/** A profile with no `peakWindows` branch: no lane-watch enforcement. */
export const NO_WINDOW_RULES: ProviderProfilePeakRules | undefined = undefined;

export const RULES_BY_PROFILE: Readonly<Record<string, ProviderProfilePeakRules>> = {
  delivery: SINGLE_WINDOW_RULES,
  small: SMALL_BUFFER_RULES,
  "grace-above-cadence": GRACE_ABOVE_CADENCE_RULES,
  overlapping: OVERLAPPING_WINDOW_RULES,
};

export const atUtcHour = utcMs;
