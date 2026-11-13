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
import {
  admitDispatchRestart,
  evaluateDispatchResumeEconomics,
  planDispatchResume,
} from "./dispatch-resume.js";

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

/** The two delivered resume routes a parked lane can take at window end (TDR-0030 D3). */
export type PeakResumeRoute = "session-resume" | "interrupted-recovery";

/** One window-end resume decision: the expired episode and its delivered route. */
export type PeakResumeDecision = {
  readonly ref: string;
  readonly route: PeakResumeRoute;
  readonly episodeId?: string;
  /** The preserved session identity, carried for the session-resume route. */
  readonly sessionRef?: string;
  readonly preservation?: QueueParkPreservation;
};

/**
 * The owner-hold refusal while the hold is active (GH-294 DEC-8, DEC-12): the
 * window-end resume admission refuses with the delivered
 * `queue.precondition.unmet` classification, reason `owner-hold`, appending
 * nothing — the existing park record stays byte-unchanged and the lane stays
 * parked under it.
 */
export type PeakResumeRefusal = {
  readonly ref: string;
  readonly code: "queue.precondition.unmet";
  readonly reason: "owner-hold";
  readonly episodeId?: string;
};

/**
 * The window-end resume decisions for one watch pass (F-5): every active
 * `peak-window` park whose `until` the read-time observation has passed
 * resumes — automatically, with the decision derived solely from the
 * window-end observation (AMB-P2). A lane classified `preserved` resumes
 * through the session resume path; a lane classified
 * `session-state-not-preserved` routes to the delivered interrupted-lane
 * recovery. An active owner hold outranks the window: every decision becomes
 * a refusal for this pass, appending nothing.
 */
export const decidePeakResumes = (input: {
  readonly parks: readonly QueueParkRecord[];
  readonly nowMs: number;
  readonly holdActive: boolean;
}): {
  readonly resumes: readonly PeakResumeDecision[];
  readonly refusals: readonly PeakResumeRefusal[];
} => {
  const latest = new Map<string, QueueParkRecord>();
  for (const record of input.parks) {
    if (record.cause === "peak-window") latest.set(record.ref, record);
  }
  const resumes: PeakResumeDecision[] = [];
  const refusals: PeakResumeRefusal[] = [];
  for (const record of latest.values()) {
    if (record.recoveryState !== "parked") continue;
    const until = record.until === undefined ? undefined : Date.parse(record.until);
    if (until === undefined || !Number.isFinite(until) || input.nowMs < until) continue;
    if (input.holdActive) {
      refusals.push({
        ref: record.ref,
        code: "queue.precondition.unmet",
        reason: "owner-hold",
        ...(record.episodeId === undefined ? {} : { episodeId: record.episodeId }),
      });
      continue;
    }
    resumes.push({
      ref: record.ref,
      route: record.preservation === "preserved" ? "session-resume" : "interrupted-recovery",
      ...(record.episodeId === undefined ? {} : { episodeId: record.episodeId }),
      ...(record.sessionRef === undefined ? {} : { sessionRef: record.sessionRef }),
      ...(record.preservation === undefined ? {} : { preservation: record.preservation }),
    });
  }
  return { resumes, refusals };
};

/** The delivered interrupted-lane recovery admission (TDR-0030 D3/D4): ledger-position resume on the same branch, one restart ordinal, budget- and economics-governed. */
export type InterruptedRecoveryAdmission =
  | { readonly admitted: true; readonly ordinal: number }
  | {
      readonly admitted: false;
      readonly code:
        | "dispatch.restart-budget-exceeded"
        | "dispatch.resume-uneconomical"
        | "dispatch.state-unverified";
      readonly terminal: boolean;
    };

/**
 * Admit one interrupted-lane recovery through the delivered gates (DEC-11):
 * the ledger-position re-entry consumes exactly one restart ordinal under the
 * restart budget, and resume economics govern as delivered. Budget
 * exhaustion escalates verbatim — the terminal marker and the typed question
 * ride the refusal, never a silent requeue, never a fresh re-dispatch.
 */
export const recoverInterruptedLane = (input: {
  readonly restartCount: number;
  readonly restartBound: number;
  readonly economics: {
    readonly prefillCost: number | null;
    readonly uniqueProgress: number | null;
  };
}): InterruptedRecoveryAdmission => {
  // Ledger-position re-entry: the recovery consumes one ordinal, so the
  // delivered plan is the re-entry mode with its skip list honored.
  const plan = planDispatchResume({
    adapterSupportsResumeInjection: false,
    completedPhases: [],
  });
  const restart = admitDispatchRestart({
    count: input.restartCount,
    bound: input.restartBound,
  });
  if (!restart.admitted) {
    return {
      admitted: false,
      code: restart.reason,
      terminal: restart.terminal,
    };
  }
  const economics = evaluateDispatchResumeEconomics({
    mode: plan.mode,
    prefillCost: input.economics.prefillCost,
    uniqueProgress: input.economics.uniqueProgress,
  });
  if (!economics.admitted) {
    return { admitted: false, code: economics.code, terminal: false };
  }
  return { admitted: true, ordinal: restart.nextOrdinal };
};

/** The append path for a recovered park record (the episode's resume marker). */
export type PeakRecoveryAppendPort = (record: QueueParkRecord) => boolean;

/** The delivered session resume path: attach-and-continue on the preserved session, same branch, no fresh spawn. */
export type PeakSessionResumePort = (input: {
  readonly ref: string;
  readonly sessionRef: string;
  readonly branch: string;
}) => Promise<boolean>;

/** The delivered interrupted-lane re-entry: resume from the ledger position at the admitted ordinal. */
export type PeakReentryPort = (input: {
  readonly ref: string;
  readonly ordinal: number;
}) => Promise<boolean>;

/** The delivered exhaustion escalation: the terminal record and the typed question (TDR-0030 D4). */
export type PeakExhaustionPort = (input: { readonly ref: string; readonly code: string }) => void;

/**
 * Run one window-end resume pass (F-5): decide the expired episodes, refuse
 * while an owner hold is active (appending nothing), resume `preserved` lanes
 * through the session resume path on the same branch (no restart ordinal,
 * no fresh spawn), and route `session-state-not-preserved` lanes through the
 * delivered interrupted-lane recovery — one restart ordinal, budget- and
 * economics-governed, exhaustion escalating verbatim. Each recovered episode
 * appends exactly one recovered park record; the park family is never mutated
 * in place.
 */
export const runPeakResume = async (input: {
  readonly parks: readonly QueueParkRecord[];
  readonly nowMs: number;
  readonly nowIso: () => string;
  readonly holdActive: boolean;
  readonly sessionRefOf: (ref: string) => string | undefined;
  readonly branchOf: () => string;
  readonly restartCountOf: (ref: string) => number;
  readonly restartBound: () => number;
  readonly economicsOf: (ref: string) => {
    readonly prefillCost: number | null;
    readonly uniqueProgress: number | null;
  };
  readonly appendRecovery: PeakRecoveryAppendPort;
  readonly resumeSession: PeakSessionResumePort;
  readonly reenterLane: PeakReentryPort;
  readonly escalateExhaustion: PeakExhaustionPort;
}): Promise<{
  readonly resumed: readonly string[];
  readonly recovered: readonly string[];
  readonly refusals: readonly PeakResumeRefusal[];
  readonly exhausted: readonly string[];
}> => {
  const { resumes, refusals } = decidePeakResumes({
    parks: input.parks,
    nowMs: input.nowMs,
    holdActive: input.holdActive,
  });
  const resumed: string[] = [];
  const recovered: string[] = [];
  const exhausted: string[] = [];
  for (const decision of resumes) {
    const latest = input.parks
      .filter((record) => record.ref === decision.ref && record.cause === "peak-window")
      .at(-1);
    if (latest === undefined) continue;
    if (decision.route === "session-resume") {
      const sessionRef = decision.sessionRef ?? input.sessionRefOf(decision.ref) ?? "";
      const branch = input.branchOf();
      const resumedOk = await input.resumeSession({
        ref: decision.ref,
        sessionRef,
        branch,
      });
      if (!resumedOk) continue;
      input.appendRecovery({
        ...latest,
        recoveryState: "recovered",
        evaluatedAt: input.nowIso(),
        recordedAt: input.nowIso(),
        clearedAt: input.nowIso(),
        recoveredAt: input.nowIso(),
        sessionRef,
        branch,
      });
      resumed.push(decision.ref);
      recovered.push(decision.ref);
      continue;
    }
    const admission = recoverInterruptedLane({
      restartCount: input.restartCountOf(decision.ref),
      restartBound: input.restartBound(),
      economics: input.economicsOf(decision.ref),
    });
    if (!admission.admitted) {
      if (admission.terminal) {
        input.escalateExhaustion({ ref: decision.ref, code: admission.code });
        exhausted.push(decision.ref);
      }
      // A non-terminal refusal (uneconomical, unevaluable) leaves the lane
      // parked; the next window-end observation re-evaluates.
      continue;
    }
    const reentered = await input.reenterLane({
      ref: decision.ref,
      ordinal: admission.ordinal,
    });
    if (!reentered) continue;
    input.appendRecovery({
      ...latest,
      recoveryState: "recovered",
      evaluatedAt: input.nowIso(),
      recordedAt: input.nowIso(),
      clearedAt: input.nowIso(),
      recoveredAt: input.nowIso(),
    });
    recovered.push(decision.ref);
  }
  return { resumed, recovered, refusals, exhausted };
};
