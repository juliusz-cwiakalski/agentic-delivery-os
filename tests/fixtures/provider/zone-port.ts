/**
 * The shared counting zone port for the GH-350 zone suites (spec v1.4,
 * ADR-0013 `## Revision`). A step table's `fromMs` boundaries ARE the
 * transitions, so a transition lookup spends no hidden offset probe; the port
 * counts `offsetSecondsAt` and `nextTransitionAtOrAfter` separately so the
 * per-method probe budget (≤3 + ≤3) is assertable.
 */
import type {
  ProviderZoneFacts,
  ProviderZonePort,
} from "../../../packages/core/src/contracts/provider";

export type ZoneStep = {
  readonly fromMs: number;
  readonly offsetSeconds: number;
};

export type ZoneCounts = {
  offsetSecondsAt: number;
  nextTransitionAtOrAfter: number;
};

export type CountingZonePort = ProviderZonePort & {
  readonly counts: ZoneCounts;
  readonly reset: () => void;
};

export const createCountingZonePort = (
  zones: Readonly<Record<string, readonly ZoneStep[]>>,
): CountingZonePort => {
  const counts: ZoneCounts = { offsetSecondsAt: 0, nextTransitionAtOrAfter: 0 };
  const offsetAt = (zone: string, atMs: number): number => {
    const steps = zones[zone];
    if (steps === undefined || steps.length === 0) throw new Error(`unknown zone ${zone}`);
    let offsetSeconds = steps[0]?.offsetSeconds ?? 0;
    for (const step of steps) if (step.fromMs <= atMs) offsetSeconds = step.offsetSeconds;
    return offsetSeconds;
  };
  return {
    counts,
    reset: () => {
      counts.offsetSecondsAt = 0;
      counts.nextTransitionAtOrAfter = 0;
    },
    isKnownZone: (zone) => zones[zone] !== undefined,
    offsetSecondsAt: (zone, atMs) => {
      counts.offsetSecondsAt += 1;
      return offsetAt(zone, atMs);
    },
    nextTransitionAtOrAfter: (zone, atMs) => {
      counts.nextTransitionAtOrAfter += 1;
      const steps = zones[zone];
      if (steps === undefined) return undefined;
      for (let index = 1; index < steps.length; index += 1) {
        const step = steps[index];
        if (step !== undefined && step.fromMs >= atMs) return step.fromMs;
      }
      return undefined;
    },
  };
};

/** The definitional UTC facts (a fact, not host data). */
export const UTC_FACTS: ProviderZoneFacts = {
  offsetSecondsAt: () => 0,
  nextTransitionAtOrAfter: () => undefined,
};

export const BERLIN_STEPS: readonly ZoneStep[] = [
  { fromMs: Date.parse("2026-01-01T00:00:00.000Z"), offsetSeconds: 3_600 },
  { fromMs: Date.parse("2026-03-29T01:00:00.000Z"), offsetSeconds: 7_200 },
  { fromMs: Date.parse("2026-10-25T01:00:00.000Z"), offsetSeconds: 3_600 },
];

export const SYDNEY_STEPS: readonly ZoneStep[] = [
  { fromMs: Date.parse("2026-01-01T00:00:00.000Z"), offsetSeconds: 39_600 },
  { fromMs: Date.parse("2026-04-05T16:00:00.000Z"), offsetSeconds: 36_000 },
  { fromMs: Date.parse("2026-10-04T16:00:00.000Z"), offsetSeconds: 39_600 },
];

export const TOKYO_STEPS: readonly ZoneStep[] = [
  { fromMs: Date.parse("2026-01-01T00:00:00.000Z"), offsetSeconds: 32_400 },
];
