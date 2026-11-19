/**
 * Zone-aware peak-window evaluation (GH-182 F-3, DM-3; GH-350 F-1, DM-1).
 *
 * Pure arithmetic over injected facts: the effective window is the half-open
 * `[max(0, start - buffer), end)` read in the declared zone's local seconds of
 * day; outside it the condition is clear. The expiry is the earliest instant at
 * or after the evaluation instant whose local reading is at or after the
 * declared local end, computed by one bounded transition-segment walk. No
 * vendor constant, ambient clock, `Intl`, or environment read enters this
 * module; zone facts arrive as an injected {@link ProviderZoneFacts} value.
 */
import type {
  ProviderConditionResult,
  ProviderPeakWindow,
  ProviderZoneFacts,
  ProviderZonePort,
} from "#contracts";
import {
  PROVIDER_DEFAULT_ZONE,
  PROVIDER_ZONE_NAME_MAX_LENGTH,
  PROVIDER_ZONE_NAME_PATTERN,
} from "#contracts";

const SECONDS_PER_DAY = 86_400;

const ZONE_NAME_PATTERN = new RegExp(PROVIDER_ZONE_NAME_PATTERN, "u");

/**
 * The declared zone grammar: `UTC`/`Etc/UTC` or an IANA name matching the
 * declared pattern, bounded by `PROVIDER_ZONE_NAME_MAX_LENGTH`. Grammar only;
 * existence is a separate edge decision.
 */
export const isZoneNameGrammar = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= PROVIDER_ZONE_NAME_MAX_LENGTH &&
  ZONE_NAME_PATTERN.test(value);

/** Normalise the `Etc/UTC` alias to the declared `UTC` default. */
export const normaliseZoneName = (zone: string): string =>
  zone === "Etc/UTC" ? PROVIDER_DEFAULT_ZONE : zone;

const secondsOfDay = (nowMs: number): number => {
  const seconds = Math.floor(nowMs / 1_000);
  return ((seconds % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
};

/** The UTC second-of-day for an instant (exported for parity assertions). */
export const utcSecondsOfDay = secondsOfDay;

/** The local second-of-day for an instant in a zone with the given offset. */
export const localSecondsOfDay = (nowMs: number, offsetSeconds: number): number =>
  (((Math.floor(nowMs / 1_000) + offsetSeconds) % SECONDS_PER_DAY) + SECONDS_PER_DAY) %
  SECONDS_PER_DAY;

/**
 * The definitional UTC facts (GH-350, ADR-0012 as revised). A fact about UTC,
 * not host tz data, so a `UTC` declaration needs no port.
 */
export const UTC_ZONE_FACTS: ProviderZoneFacts = {
  offsetSecondsAt: () => 0,
  nextTransitionAtOrAfter: () => undefined,
};

/** Bind the injected port to one declared zone (the one binder all surfaces use). */
export const bindZoneFacts = (zone: string, port: ProviderZonePort): ProviderZoneFacts => ({
  offsetSecondsAt: (atMs) => port.offsetSecondsAt(zone, atMs),
  nextTransitionAtOrAfter: (atMs) => port.nextTransitionAtOrAfter(zone, atMs),
});

/**
 * The buffer-inclusive open bound of a declared window, in seconds of day
 * (GH-294 F-3). One boundary truth shared by the profile-level gate and the
 * lane-level watcher: the window is observed open at or after this second,
 * never before it.
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

/** The end-rule shape the one expiry derivation consumes (same as `peakWindowEndSeconds`). */
export type PeakWindowEndRule = {
  readonly endSecondsOfDay: number;
  readonly bufferAfterSeconds: number;
};

/**
 * The one named expiry derivation (GH-350, ADR-0012 as revised): the earliest
 * instant at or after `nowMs` whose local reading is at or after the declared
 * local end. A bounded transition-segment walk, not a fixed-point loop.
 *
 * - Work at whole seconds; `LE(t) = t / 1000 + offsetSecondsAt(t)` is linear
 *   inside an offset segment and jumps at each transition.
 * - `target` is invariant across a repeated hour, so the first occurrence of a
 *   repeated reading falls out of the strict `t* < T` test.
 * - A skipped local second resolves to the transition instant exactly: the
 *   boundary test uses the post-transition offset at `T`.
 *
 * Probe budget per call: at most three `offsetSecondsAt` probes and at most
 * three `nextTransitionAtOrAfter` lookups; the segment-3 guard returns before a
 * fourth offset probe.
 */
export const peakWindowEndInstantMs = (
  nowMs: number,
  zoneFacts: ProviderZoneFacts,
  rule: PeakWindowEndRule,
): number => {
  const nowS = Math.floor(nowMs / 1_000) * 1_000;
  const endSecondsOfDay = peakWindowEndSeconds(rule);
  const initialOffset = zoneFacts.offsetSecondsAt(nowS);
  const localNow =
    (((nowS / 1_000 + initialOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  const target = nowS / 1_000 + initialOffset - localNow + endSecondsOfDay;
  let offset = initialOffset;
  let segmentStart = nowS;
  for (let segment = 1; segment <= 3; segment += 1) {
    const transition = zoneFacts.nextTransitionAtOrAfter(segmentStart + 1_000);
    const candidate = (target - offset) * 1_000;
    if (transition === undefined || candidate < transition) return candidate;
    if (segment === 3) return candidate;
    const nextOffset = zoneFacts.offsetSecondsAt(transition);
    if (transition / 1_000 + nextOffset >= target) return transition;
    offset = nextOffset;
    segmentStart = transition;
  }
  return (target - offset) * 1_000;
};

/**
 * Evaluate one declared peak window at `nowMs` on the declared zone's clock.
 * `zoneFacts` defaults to the definitional UTC facts, so a `UTC` declaration
 * needs no port; a non-UTC window must be evaluated with its bound facts.
 */
export const evaluatePeakWindow = (
  window: ProviderPeakWindow,
  nowMs: number,
  zoneFacts: ProviderZoneFacts = UTC_ZONE_FACTS,
): ProviderConditionResult => {
  const effectiveStart = peakWindowOpenSeconds({
    startSecondsOfDay: window.startSecondsOfDay,
    bufferBeforeSeconds: window.bufferSeconds,
  });
  const current = localSecondsOfDay(
    nowMs,
    zoneFacts.offsetSecondsAt(Math.floor(nowMs / 1_000) * 1_000),
  );
  if (current < effectiveStart || current >= window.endSecondsOfDay) return { status: "clear" };
  const expiresAtMs = peakWindowEndInstantMs(nowMs, zoneFacts, {
    endSecondsOfDay: window.endSecondsOfDay,
    bufferAfterSeconds: 0,
  });
  const waitSeconds = Math.floor((expiresAtMs - nowMs) / 1_000);
  return {
    status: "parked",
    kind: "peak-window",
    waitSeconds,
    expiresAtMs,
    announcementCode: "provider.peak.parked",
    evidence: { conditionKinds: ["peak-window"], waitSeconds, timezone: window.timezone },
  };
};
