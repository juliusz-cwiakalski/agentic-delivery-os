/**
 * The single `Intl`-backed zone edge (GH-350 F-1, DM-1; ADR-0013 as revised).
 *
 * The only module in the workspace that reads zone data for provider policy:
 * `createIntlZonePort()` implements the three required `ProviderZonePort`
 * members over the runtime's own `Intl` data. No I/O, no network, and no
 * environment read beyond what `Intl` itself uses. The pure core never imports
 * this module; a composition binds it through `bindZoneFacts`.
 */
import type { ProviderZonePort } from "@delivery-os/core/contracts";

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (zone: string): Intl.DateTimeFormat => {
  const existing = formatters.get(zone);
  if (existing !== undefined) return existing;
  const created = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatters.set(zone, created);
  return created;
};

const wallClockMs = (zone: string, atMs: number): number => {
  const parts = formatterFor(zone).formatToParts(atMs);
  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((candidate) => candidate.type === type);
    return part === undefined ? 0 : Number(part.value);
  };
  // `Date.UTC` normalises hour 24 to the next midnight, which is the correct
  // wall-clock reading some ICU builds report for 00:00.
  return Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
};

/** The offset in seconds in effect at `atMs` (post-transition at a transition). */
const offsetSecondsAt = (zone: string, atMs: number): number => {
  const base = Math.floor(atMs / 1_000) * 1_000;
  return Math.round((wallClockMs(zone, base) - base) / 1_000);
};

const offsetChangesAt = (zone: string, atMs: number): boolean =>
  offsetSecondsAt(zone, atMs) !== offsetSecondsAt(zone, atMs - 1_000);

/**
 * The smallest instant `T >= atMs` at which the zone's offset changes, or
 * `undefined` when the runtime knows of none in the 26-hour horizon. Every
 * reported transition is verified with the offset-change test.
 */
const nextTransitionAtOrAfter = (zone: string, atMs: number): number | undefined => {
  const start = Math.floor(atMs / 1_000) * 1_000;
  if (offsetChangesAt(zone, start)) return start;
  const stepMs = 3_600_000;
  const horizon = start + 26 * stepMs;
  let previous = start;
  for (let cursor = start + stepMs; cursor <= horizon; cursor += stepMs) {
    if (offsetSecondsAt(zone, cursor) !== offsetSecondsAt(zone, previous)) {
      let low = previous;
      let high = cursor;
      while (high - low > 1_000) {
        const middle = Math.floor((low + high) / 2_000) * 1_000;
        if (middle <= low || middle >= high) break;
        if (offsetSecondsAt(zone, middle) === offsetSecondsAt(zone, previous)) low = middle;
        else high = middle;
      }
      if (offsetChangesAt(zone, high)) return high;
      // A rare double transition inside one step: locate it exactly.
      for (let probe = previous + 1_000; probe <= cursor; probe += 1_000) {
        if (offsetChangesAt(zone, probe)) return probe;
      }
      return undefined;
    }
    previous = cursor;
  }
  return undefined;
};

/** Build the single zone port over the runtime's own `Intl` data. */
export const createIntlZonePort = (): ProviderZonePort => ({
  isKnownZone: (zone: string): boolean => {
    try {
      formatterFor(zone);
      return true;
    } catch {
      return false;
    }
  },
  offsetSecondsAt,
  nextTransitionAtOrAfter,
});
