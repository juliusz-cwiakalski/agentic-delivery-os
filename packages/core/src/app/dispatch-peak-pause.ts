/**
 * The dispatch-owned profile-window watch (GH-413 F-1..F-4, F-11; DEC-3,
 * DEC-5, DEC-11, DEC-13, DEC-20; TDR-0077).
 *
 * One-shot, per-observation orchestration over the delivered decision layer:
 * `decidePeakStops` decides whether the nominated profile's first open window
 * starts an episode, `runPeakWatch` writes the complete watcher-shaped park
 * frame, and the resume half re-uses the delivered preservation routing. This
 * module derives no window rule of its own: the rules, the zone facts, and the
 * clock are injected, so the dispatch watch and the daemon watch take the same
 * decision for the same profile and instant.
 */
import type {
  HarnessSessionHandle,
  ProviderProfilePeakRules,
  QueueParkPreservation,
  QueueParkRecord,
} from "#contracts";
import {
  decidePeakStops,
  type PeakRulesLookup,
  type PeakZoneFactsFor,
  peakWindowOpenAt,
  recoverInterruptedLane,
  runPeakWatch,
} from "../domain/daemon-peak-pause.js";
import { admitDispatchRestart } from "../domain/dispatch-resume.js";

/** The latest standing peak-window park for a reference, whatever its cause state. */
export const standingPeakPark = (
  parks: readonly QueueParkRecord[],
  ref: string,
): QueueParkRecord | undefined => {
  for (let index = parks.length - 1; index >= 0; index -= 1) {
    const park = parks[index];
    if (park === undefined || park.ref !== ref || park.cause !== "peak-window") continue;
    // Occupancy (DEC-23): a `parked` or `clear-observed` record still occupies
    // the reference; only a recovered or released record clears it.
    if (park.recoveryState === "parked" || park.recoveryState === "clear-observed") return park;
    return undefined;
  }
  return undefined;
};

/** One observation's outcome for the dispatch-owned watch. */
export type DispatchPeakObservation =
  | { readonly outcome: "none" }
  | { readonly outcome: "already-parked" }
  | { readonly outcome: "unconfirmed" }
  | { readonly outcome: "parked"; readonly park: QueueParkRecord }
  | { readonly outcome: "refused"; readonly code: string };

/**
 * Observe one lane at one instant (F-1, F-3, AC-F1-1, AC-F3-1, AC-F3-3):
 *
 * - a standing peak-window park is occupancy, so no second stop is decided;
 * - otherwise the delivered `decidePeakStops` decides on the single lane;
 * - a stop carries the composed grace (the smallest of the remaining profile
 *   grace, the delivered kill grace, and the time to the effective window end)
 *   to the one delivered terminate seam;
 * - `runPeakWatch` appends the complete watcher-shaped park frame so the
 *   delivered projection emits exactly one `stop`, one `parked`, and one
 *   `park-edge`.
 */
export const observeDispatchPeak = async (input: {
  readonly ref: string;
  readonly handle?: HarnessSessionHandle;
  readonly sessionId?: string;
  readonly providerProfile?: string;
  readonly repository?: string;
  readonly rulesFor: PeakRulesLookup;
  readonly zoneFactsFor?: PeakZoneFactsFor;
  readonly nowMs: number;
  readonly nowIso: () => string;
  readonly killGraceMs: number;
  readonly parks: () => readonly QueueParkRecord[];
  readonly newEpisodeId: () => string;
  readonly stop: (input: {
    readonly handle?: HarnessSessionHandle;
    readonly sessionId?: string;
    readonly graceMs: number;
  }) => Promise<QueueParkPreservation | { readonly confirmed: false }>;
  readonly appendPark: (record: QueueParkRecord) => boolean;
}): Promise<DispatchPeakObservation> => {
  if (standingPeakPark(input.parks(), input.ref) !== undefined) {
    return { outcome: "already-parked" };
  }
  const lane = {
    ref: input.ref,
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    ...(input.providerProfile === undefined ? {} : { providerProfile: input.providerProfile }),
  };
  const decisions = decidePeakStops({
    lanes: [lane],
    rulesFor: input.rulesFor,
    ...(input.zoneFactsFor === undefined ? {} : { zoneFactsFor: input.zoneFactsFor }),
    nowMs: input.nowMs,
    parkedRefs: [],
    newEpisodeId: input.newEpisodeId,
  });
  const decision = decisions[0];
  if (decision === undefined) return { outcome: "none" };
  const remainingProfileGraceMs = Date.parse(decision.graceDeadline) - input.nowMs;
  const timeToWindowEndMs = Date.parse(decision.windowEnd) - input.nowMs;
  const graceMs = Math.max(
    0,
    Math.min(remainingProfileGraceMs, input.killGraceMs, timeToWindowEndMs),
  );
  let preservation: QueueParkPreservation | { readonly confirmed: false };
  try {
    preservation = await input.stop({
      ...(input.handle === undefined ? {} : { handle: input.handle }),
      ...(decision.sessionId === undefined ? {} : { sessionId: decision.sessionId }),
      graceMs,
    });
  } catch {
    return { outcome: "refused", code: "dispatch.state-unverified" };
  }
  if (typeof preservation !== "string") {
    // No confirmed terminate: never append a park for a stop that did not
    // happen. The watcher keeps observing and renewing so the next
    // observation retries under the occupancy rule.
    return { outcome: "unconfirmed" };
  }
  const appended = await runPeakWatch({
    lanes: [lane],
    rulesFor: input.rulesFor,
    ...(input.zoneFactsFor === undefined ? {} : { zoneFactsFor: input.zoneFactsFor }),
    nowMs: input.nowMs,
    parkedRefs: [],
    newEpisodeId: input.newEpisodeId,
    // The stop already ran with the composed grace; re-use its classification.
    stop: async () => preservation,
    appendPark: input.appendPark,
    nowIso: input.nowIso,
    ...(input.repository === undefined ? {} : { repository: input.repository }),
  });
  const park = appended[0];
  return park === undefined ? { outcome: "none" } : { outcome: "parked", park };
};

/** One window-end observation's outcome. */
export type DispatchPeakResume =
  | { readonly outcome: "none" }
  | { readonly outcome: "waiting" }
  | {
      readonly outcome: "resumed";
      readonly resumedAt: string;
      readonly episodeId?: string;
      readonly parkEnd: string;
      /** The recovery record to append only after the real session resume succeeds. */
      readonly recoveryRecord: QueueParkRecord;
    }
  | {
      readonly outcome: "recovered";
      readonly ordinal: number;
      readonly episodeId?: string;
      readonly parkEnd: string;
      readonly recoveryRecord: QueueParkRecord;
    }
  | {
      readonly outcome: "refused";
      readonly code: string;
      readonly terminal: boolean;
      readonly parkEnd: string;
      readonly episodeId?: string;
    };

/**
 * Observe one parked lane at one instant (F-4, F-11; DEC-11, DEC-18, DEC-20,
 * DEC-23):
 *
 * - a recorded end in the future is a wait;
 * - resume admission re-evaluates the nominated profile's window rules and
 *   never resumes into an observed open window (RSK-6);
 * - an active owner hold refuses the window-end resume and appends nothing;
 * - a `preserved` episode resumes the preserved session on the same branch and
 *   records the delivered recovery record (one `resumed` projection);
 * - a `session-state-not-preserved` episode routes to the delivered
 *   interrupted-lane recovery, consuming one restart ordinal under the
 *   delivered budget/economics, and emits no `resumed`;
 * - a non-terminal refusal returns one classified refusal outcome; a terminal
 *   one escalates the delivered exhaustion.
 */
export const evaluateDispatchPeakResume = async (input: {
  readonly ref: string;
  readonly parks: () => readonly QueueParkRecord[];
  readonly rulesFor: PeakRulesLookup;
  readonly zoneFactsFor?: PeakZoneFactsFor;
  readonly nowMs: number;
  readonly nowIso: () => string;
  readonly holdActive: () => boolean;
  readonly sessionRef?: string;
  readonly branch: string;
  readonly restartCount: number;
  readonly restartBound: number;
  /** F-5a: production admits the automatic recovery by the restart budget only. */
  readonly admission?: "budget-only" | "budget-and-economics";
  readonly economics: {
    readonly prefillCost: number | null;
    readonly uniqueProgress: number | null;
  };
  readonly resumeSession: (input: {
    readonly sessionRef: string;
    readonly branch: string;
  }) => Promise<boolean>;
  readonly reenter: (input: { readonly ordinal: number }) => Promise<boolean>;
  readonly escalate: (input: { readonly code: string }) => void;
}): Promise<DispatchPeakResume> => {
  const park = standingPeakPark(input.parks(), input.ref);
  if (park === undefined) return { outcome: "none" };
  const parkEnd = park.until ?? "";
  const untilMs = Date.parse(parkEnd);
  if (!Number.isFinite(untilMs) || input.nowMs < untilMs) return { outcome: "waiting" };
  // Resume admission re-checks the same rules; safety outranks punctuality.
  const profile = park.providerProfile;
  if (profile !== undefined) {
    const rules: ProviderProfilePeakRules | undefined = input.rulesFor(profile);
    if (rules !== undefined) {
      const zoneFactsFor: PeakZoneFactsFor | undefined = input.zoneFactsFor;
      const window =
        zoneFactsFor === undefined
          ? peakWindowOpenAt(rules, input.nowMs)
          : peakWindowOpenAt(rules, input.nowMs, zoneFactsFor);
      if (window.open) return { outcome: "waiting" };
    }
  }
  if (input.holdActive()) return { outcome: "waiting" };
  const nowIso = input.nowIso();
  const recovery = (): QueueParkRecord => ({
    ...park,
    recoveryState: "recovered",
    evaluatedAt: nowIso,
    recordedAt: nowIso,
    clearedAt: nowIso,
    recoveredAt: nowIso,
  });
  if (park.preservation === "preserved") {
    const sessionRef = park.sessionRef ?? input.sessionRef;
    if (sessionRef === undefined || sessionRef.length === 0) return { outcome: "waiting" };
    const resumed = await input.resumeSession({ sessionRef, branch: input.branch });
    if (!resumed) return { outcome: "waiting" };
    return {
      outcome: "resumed",
      resumedAt: nowIso,
      parkEnd,
      recoveryRecord: { ...recovery(), sessionRef, branch: input.branch },
      ...(park.episodeId === undefined ? {} : { episodeId: park.episodeId }),
    };
  }
  const budgetOnly = input.admission === undefined || input.admission === "budget-only";
  let ordinal: number;
  if (budgetOnly) {
    const restart = admitDispatchRestart({
      count: input.restartCount,
      bound: input.restartBound,
      scope: "budget-consulting",
    });
    if (!restart.admitted) {
      if (restart.terminal) input.escalate({ code: restart.reason });
      return {
        outcome: "refused",
        code: restart.reason,
        terminal: restart.terminal,
        parkEnd,
        ...(park.episodeId === undefined ? {} : { episodeId: park.episodeId }),
      };
    }
    ordinal = restart.nextOrdinal;
  } else {
    const recovery = recoverInterruptedLane({
      restartCount: input.restartCount,
      restartBound: input.restartBound,
      economics: input.economics,
    });
    if (!recovery.admitted) {
      if (recovery.terminal) input.escalate({ code: recovery.code });
      return {
        outcome: "refused",
        code: recovery.code,
        terminal: recovery.terminal,
        parkEnd,
        ...(park.episodeId === undefined ? {} : { episodeId: park.episodeId }),
      };
    }
    ordinal = recovery.ordinal;
  }
  const reentered = await input.reenter({ ordinal });
  if (!reentered) return { outcome: "waiting" };
  return {
    outcome: "recovered",
    ordinal,
    parkEnd,
    recoveryRecord: recovery(),
    ...(park.episodeId === undefined ? {} : { episodeId: park.episodeId }),
  };
};

/** The nominated profile's rules lookup the composition binds. */
export type DispatchPeakRulesLookup = PeakRulesLookup;
/** The zone facts binder the composition binds. */
export type DispatchPeakZoneFactsFor = PeakZoneFactsFor;
