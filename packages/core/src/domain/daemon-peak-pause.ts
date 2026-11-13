/**
 * The daemon's profile-window watch and in-flight lane parking (GH-294 F-3,
 * DM-3, DM-4; TDR-0030 D1/D5; DEC-6, DEC-11; NFR-1, NFR-2).
 *
 * Pure decision + one orchestrated append path: when a profile's window is
 * open (buffer included) at the injected clock's UTC second-of-day, every
 * in-flight lane whose recorded nomination names that profile receives a
 * bounded-grace stop whose deadline is recorded, and lands parked exactly once
 * per episode — reason `peak-window`, the profile named, `until` at the
 * effective window end, and the closed-value preservation classification —
 * under one fence, with read-time expiry and no in-place record mutation.
 *
 * The applied grace is the profile's declared default, bounded by the derived
 * window buffer at configuration time (DEC-6): it is never clamped here and
 * never extended by a preservation failure (TDR-0030 D5) — a preservation
 * failure classifies the episode `session-state-not-preserved` and parks it
 * like any other. No window declared means no enforcement and the delivered
 * behavior. The stop composes with the delivered lane supervision contracts
 * through the injected stop seam and adds no signal, kill, or termination
 * path (NG-6).
 */

import type { ProviderProfilePeakRules } from "../contracts/provider-profile.js";
import {
  QUEUE_PARK_RECHECK_DEFAULTS,
  type QueueParkPreservation,
  type QueueParkRecord,
} from "../contracts/queue.js";
import { peakWindowEndSeconds, peakWindowOpenSeconds, utcSecondsOfDay } from "../provider/peak.js";

/** One in-flight lane the watch evaluates (its recorded nomination is the only join key). */
export type PeakWatchLane = {
  readonly ref: string;
  readonly providerProfile?: string;
  readonly sessionId?: string;
};

/** One stop decision: the lane, its window, and the recorded grace deadline. */
export type PeakStopDecision = {
  readonly ref: string;
  readonly sessionId?: string;
  readonly providerProfile: string;
  /** Absolute UTC instant the applied grace ends. */
  readonly graceDeadline: string;
  /** The applied grace in seconds: the profile's declared default, never clamped here. */
  readonly graceSeconds: number;
  /** Absolute UTC instant the lane resumes at (the effective window end). */
  readonly windowEnd: string;
  /** The episode identity joining the stop, the park record, and its events. */
  readonly episodeId: string;
};

/** The rule lookup the watch reads: one parsed rule set per declared profile. */
export type PeakRulesLookup = (profile: string) => ProviderProfilePeakRules | undefined;

/** The episode-id factory (injected; deterministic in tests). */
export type PeakEpisodeIdFactory = () => string;

const isoOf = (nowMs: number, secondsLater: number): string =>
  new Date(nowMs + secondsLater * 1_000).toISOString();

/**
 * The buffer-inclusive window decision for one profile at `nowMs` (F-3): the
 * window is open at or after `start - bufferBefore` and before the effective
 * end (`end + bufferAfter`), evaluated on the injected clock's UTC
 * second-of-day only (DEC-1, NFR-3).
 */
export const peakWindowOpenAt = (
  rules: ProviderProfilePeakRules,
  nowMs: number,
): { readonly open: boolean; readonly windowEnd: string } => {
  const second = utcSecondsOfDay(nowMs);
  for (const window of rules.windows) {
    const open = peakWindowOpenSeconds({
      startSecondsOfDay: window.startSecondsOfDay,
      bufferBeforeSeconds: window.bufferBeforeSeconds,
    });
    const end = peakWindowEndSeconds({
      endSecondsOfDay: window.endSecondsOfDay,
      bufferAfterSeconds: window.bufferAfterSeconds,
    });
    if (second >= open && second < end) {
      // The window end in absolute time: today's end when still ahead of the
      // clock's second-of-day (declared windows never wrap midnight — the
      // parser refuses end <= start).
      const endMsToday = Math.floor(nowMs / 1_000) * 1_000 + (end - second) * 1_000;
      return { open: true, windowEnd: new Date(endMsToday).toISOString() };
    }
  }
  return { open: false, windowEnd: "" };
};

/**
 * The stop decisions for one watch pass (F-3, F-4): exactly the in-flight
 * lanes whose recorded nomination names a profile whose window is open and
 * that has no active `peak-window` park yet. The park decision reads the
 * recorded nomination and that profile's window state only (F-4, RSK-3) — no
 * model-string, harness-kind, or config-proximity inference ever parks a lane,
 * and lanes on other providers are untouched. Zero rules declared means zero
 * decisions.
 */
export const decidePeakStops = (input: {
  readonly lanes: readonly PeakWatchLane[];
  readonly rulesFor: PeakRulesLookup;
  readonly nowMs: number;
  /** Refs holding an active `peak-window` park; already parked lanes are skipped (exactly once per episode). */
  readonly parkedRefs: readonly string[];
  readonly newEpisodeId: PeakEpisodeIdFactory;
}): readonly PeakStopDecision[] => {
  const parked = new Set(input.parkedRefs);
  const decisions: PeakStopDecision[] = [];
  const seenWindows = new Map<string, { readonly open: boolean; readonly windowEnd: string }>();
  for (const lane of input.lanes) {
    if (parked.has(lane.ref)) continue;
    const profile = lane.providerProfile;
    if (profile === undefined || profile.length === 0) continue;
    let window = seenWindows.get(profile);
    if (window === undefined) {
      const rules = input.rulesFor(profile);
      window =
        rules === undefined
          ? { open: false, windowEnd: "" }
          : (peakWindowOpenAt(rules, input.nowMs) ?? { open: false, windowEnd: "" });
      seenWindows.set(profile, window);
    }
    if (!window.open) continue;
    const rules = input.rulesFor(profile);
    if (rules === undefined) continue;
    decisions.push({
      ref: lane.ref,
      ...(lane.sessionId === undefined ? {} : { sessionId: lane.sessionId }),
      providerProfile: profile,
      graceDeadline: isoOf(input.nowMs, rules.graceSecondsDefault),
      graceSeconds: rules.graceSecondsDefault,
      windowEnd: window.windowEnd,
      episodeId: input.newEpisodeId(),
    });
  }
  return decisions;
};

/** The injected stop seam: requests the lane's bounded-grace stop and resolves with the preservation outcome. */
export type PeakStopPort = (input: {
  readonly ref: string;
  readonly sessionId?: string;
  readonly graceDeadline: string;
}) => Promise<QueueParkPreservation>;

/** The append path: the watch appends the park record through this port only. */
export type PeakParkAppendPort = (record: QueueParkRecord) => boolean;

/**
 * Run one watch pass (F-3): decide the stops, request each lane's bounded-
 * grace stop through the injected seam, and append exactly one park record
 * per episode under one fence. A preservation failure never refuses the park
 * and never extends the grace (TDR-0030 D1/D5): the episode lands parked with
 * the `session-state-not-preserved` classification and the same `until` and
 * grace deadline its success twin would carry.
 */
export const runPeakWatch = async (input: {
  readonly lanes: readonly PeakWatchLane[];
  readonly rulesFor: PeakRulesLookup;
  readonly nowMs: number;
  readonly parkedRefs: readonly string[];
  readonly newEpisodeId: PeakEpisodeIdFactory;
  readonly stop: PeakStopPort;
  readonly appendPark: PeakParkAppendPort;
  readonly nowIso: () => string;
  readonly repository?: string;
}): Promise<readonly QueueParkRecord[]> => {
  const decisions = decidePeakStops({
    lanes: input.lanes,
    rulesFor: input.rulesFor,
    nowMs: input.nowMs,
    parkedRefs: input.parkedRefs,
    newEpisodeId: input.newEpisodeId,
  });
  const appended: QueueParkRecord[] = [];
  for (const decision of decisions) {
    const preservation = await input.stop({
      ref: decision.ref,
      ...(decision.sessionId === undefined ? {} : { sessionId: decision.sessionId }),
      graceDeadline: decision.graceDeadline,
    });
    const record: QueueParkRecord = {
      schema: "delivery.queue.park.v1",
      ref: decision.ref,
      ...(input.repository === undefined ? {} : { repository: input.repository }),
      cause: "peak-window",
      conditionType: "provider-window",
      condition: { type: "provider-window", expiresAt: decision.windowEnd },
      recheckMs: QUEUE_PARK_RECHECK_DEFAULTS["provider-window"],
      evaluatedAt: input.nowIso(),
      recoveryState: "parked",
      recordedAt: input.nowIso(),
      providerProfile: decision.providerProfile,
      until: decision.windowEnd,
      graceDeadline: decision.graceDeadline,
      windowEnd: decision.windowEnd,
      stoppedAt: input.nowIso(),
      preservation,
      episodeId: decision.episodeId,
    };
    if (input.appendPark(record)) appended.push(record);
  }
  return appended;
};
