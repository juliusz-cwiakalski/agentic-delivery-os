/**
 * Per-profile peak-window rule parsing and validation (GH-294 F-2, DM-3).
 *
 * Pure: consumes already-resolved configuration values and returns typed rule
 * data or a classified failure naming the offending field. No clock read, no
 * environment read, no I/O occurs here (TC-PAUSE-010 step 5) — window
 * evaluation against the injected clock lives in `./peak.ts`, which owns the
 * buffer-inclusive boundary helpers this schema feeds (one boundary truth, two
 * consumers: the profile-level F-6 gate and the lane-level watcher).
 *
 * Fail-closed and classified, matching the provider-profiles validation
 * discipline (GH-294 OQ-TP-1/OQ-TP-2 pins):
 *   - only a UTC designation validates; any non-UTC literal is a refusal
 *     naming the field — a zone that parses but can never be honored would be
 *     a silent-degradation channel (DEC-1);
 *   - an exact-duplicate window (same start AND end) on one profile refuses
 *     as ambiguous; distinct overlapping windows validate without
 *     arbitration — enforcement unions the intervals and multipliers are
 *     declared rule data never reconciled here (spec §7.3 stays deferred);
 *   - a `graceSeconds` default above the derived maximum is a validation
 *     error, never silently clamped (NFR-1, DEC-6).
 */
import {
  PROVIDER_PEAK_TIMEZONES,
  type ProviderProfilePeakRules,
  type ProviderProfilePeakWindow,
} from "#contracts";

/** The classified configuration identity the rule validation reuses. */
export const PEAK_RULES_ERROR_CODE = "provider.profile.invalid" as const;

/** The classified failure a malformed rule declaration produces. */
export type PeakRulesFailure = {
  readonly code: typeof PEAK_RULES_ERROR_CODE;
  readonly detail: string;
  readonly field: string;
};

/** The parse outcome for one profile's declared `peakWindows` branch. */
export type PeakRulesResult =
  | { readonly ok: true; readonly rules: ProviderProfilePeakRules }
  | { readonly ok: false; readonly failure: PeakRulesFailure };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const failure = (field: string, detail: string): PeakRulesResult => ({
  ok: false,
  failure: { code: PEAK_RULES_ERROR_CODE, detail, field },
});

const integer = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) ? value : undefined;

const nonNegativeInteger = (value: unknown): number | undefined => {
  const parsed = integer(value);
  return parsed !== undefined && parsed >= 0 ? parsed : undefined;
};

const positiveInteger = (value: unknown): number | undefined => {
  const parsed = integer(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
};

/**
 * Derive the profile's grace maximum from its declared buffers (DEC-6): the
 * smallest buffer across every declared window edge, so the applied grace is
 * bounded by each window's protection. The caller validates against it; no
 * runtime clamp exists.
 */
export const deriveGraceSecondsMax = (windows: readonly ProviderProfilePeakWindow[]): number => {
  let smallest = Number.POSITIVE_INFINITY;
  for (const window of windows) {
    if (window.bufferBeforeSeconds < smallest) smallest = window.bufferBeforeSeconds;
    if (window.bufferAfterSeconds < smallest) smallest = window.bufferAfterSeconds;
  }
  return Number.isFinite(smallest) ? smallest : 0;
};

/** Parse one declared rule window; the failure names the offending field. */
export const parseProfilePeakWindow = (
  value: unknown,
  field: string,
): PeakRulesResult | { readonly ok: true; readonly window: ProviderProfilePeakWindow } => {
  if (!isRecord(value)) return failure(field, `${field} must be an object`);
  const rawTimezone = value.timezone === undefined ? PROVIDER_PEAK_TIMEZONES[0] : value.timezone;
  if (
    typeof rawTimezone !== "string" ||
    !(PROVIDER_PEAK_TIMEZONES as readonly string[]).includes(rawTimezone)
  ) {
    return failure(
      `${field}.timezone`,
      `${field}.timezone must be UTC (GH-294 DEC-1: windows are declared and evaluated on the UTC basis only); refusing non-UTC literal ${String(value.timezone)}`,
    );
  }
  const startSecondsOfDay = integer(value.startSecondsOfDay);
  const endSecondsOfDay = integer(value.endSecondsOfDay);
  if (startSecondsOfDay === undefined || startSecondsOfDay < 0 || startSecondsOfDay > 86399) {
    return failure(`${field}.startSecondsOfDay`, `${field}.startSecondsOfDay must be 0..86399`);
  }
  if (endSecondsOfDay === undefined || endSecondsOfDay < 1 || endSecondsOfDay > 86399) {
    return failure(`${field}.endSecondsOfDay`, `${field}.endSecondsOfDay must be 1..86399`);
  }
  if (endSecondsOfDay <= startSecondsOfDay) {
    return failure(`${field}.endSecondsOfDay`, `${field}.endSecondsOfDay must be after start`);
  }
  const multiplier = value.multiplier;
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier) || multiplier < 1) {
    return failure(`${field}.multiplier`, `${field}.multiplier must be a finite number >= 1`);
  }
  const bufferBeforeSeconds = nonNegativeInteger(value.bufferBeforeSeconds);
  if (bufferBeforeSeconds === undefined) {
    return failure(
      `${field}.bufferBeforeSeconds`,
      `${field}.bufferBeforeSeconds is required and must be a non-negative integer (the buffers bound the grace)`,
    );
  }
  const bufferAfterSeconds = nonNegativeInteger(value.bufferAfterSeconds);
  if (bufferAfterSeconds === undefined) {
    return failure(
      `${field}.bufferAfterSeconds`,
      `${field}.bufferAfterSeconds is required and must be a non-negative integer (the buffers bound the grace)`,
    );
  }
  return {
    ok: true,
    window: {
      timezone: rawTimezone as (typeof PROVIDER_PEAK_TIMEZONES)[number],
      startSecondsOfDay,
      endSecondsOfDay,
      multiplier,
      bufferBeforeSeconds,
      bufferAfterSeconds,
    },
  };
};

/**
 * Parse one profile's declared `peakWindows` branch (GH-294 DM-3): a window
 * list with per-window multipliers and buffers, and a required
 * `graceSeconds` default bounded by the derived maximum. Absent at the
 * profile means no peak enforcement and delivered behavior; present-but-
 * malformed refuses the whole configuration branch fail-closed.
 */
export const parseProfilePeakWindows = (value: unknown, field = "peakWindows"): PeakRulesResult => {
  if (!isRecord(value)) return failure(field, `${field} must be an object`);
  const graceSecondsDefault = positiveInteger(value.graceSeconds);
  if (graceSecondsDefault === undefined) {
    return failure(
      `${field}.graceSeconds`,
      `${field}.graceSeconds is required and must be a positive integer (the declared profile grace default)`,
    );
  }
  if (!Array.isArray(value.windows)) {
    return failure(`${field}.windows`, `${field}.windows must be a list`);
  }
  if (value.windows.length === 0) {
    return failure(`${field}.windows`, `${field}.windows must not be empty`);
  }
  const windows: ProviderProfilePeakWindow[] = [];
  const seenSpans = new Set<string>();
  for (const [index, raw] of value.windows.entries()) {
    const windowField = `${field}.windows[${index}]`;
    const parsed = parseProfilePeakWindow(raw, windowField);
    if (!parsed.ok) return parsed;
    if (!("window" in parsed)) return parsed;
    const window = parsed.window;
    const span = `${window.startSecondsOfDay}:${window.endSecondsOfDay}`;
    if (seenSpans.has(span)) {
      return failure(
        `${windowField}`,
        `${windowField} duplicates an already-declared window span (${span}); exact-duplicate windows are ambiguous (GH-294 OQ-TP-2)`,
      );
    }
    seenSpans.add(span);
    windows.push(window);
  }
  const graceSecondsMax = deriveGraceSecondsMax(windows);
  if (graceSecondsDefault > graceSecondsMax) {
    return failure(
      `${field}.graceSeconds`,
      `${field}.graceSeconds ${graceSecondsDefault} exceeds the derived maximum ${graceSecondsMax} (the smallest declared window buffer); requesting a grace above the profile maximum is a validation error, never a clamp (GH-294 NFR-1, DEC-6)`,
    );
  }
  return { ok: true, rules: { windows, graceSecondsDefault, graceSecondsMax } };
};
