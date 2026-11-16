/**
 * Ceremony schedule evaluation and catch-up (GH-296 F-5; NFR-6; DEC-19).
 *
 * Schedule arithmetic is a pure function of the declaration, the injected clock,
 * and the recorded run windows. Missed windows are existence-based over the run
 * identity: a due window whose identity is already recorded is satisfied,
 * whichever trigger kind recorded it, and is never replayed. Catch-up replays at
 * most one missed window per ceremony per invocation (`maxMissedWindows: 1`).
 */
import {
  CEREMONY_CADENCE_WINDOW_DAYS,
  type CeremonyCadence,
  type CeremonyDeclaration,
  type CeremonyRunRecord,
  type CeremonyWindow,
} from "#contracts";
import { deriveCeremonyCadenceWindow } from "./ceremony-intake.js";
import {
  runCeremony,
  type CeremonyEngineFailure,
  type CeremonyRunData,
  type CeremonyRunEnvironment,
} from "./ceremony-run.js";

/** One ceremony target catch-up evaluates. */
export type CeremonyCatchUpTarget = {
  readonly declaration: CeremonyDeclaration;
  readonly scopeKey: string;
};

/** One ceremony without a live declaration but with readable history. */
export type CeremonyRemovedTarget = {
  readonly ceremonyId: string;
  readonly recordedRuns: number;
};

/** One catch-up request; time, port, and targets are injected. */
export type CeremonyCatchUpRequest = {
  readonly targets: readonly CeremonyCatchUpTarget[];
  readonly env: CeremonyRunEnvironment;
  readonly nowMs: number;
  readonly apply: boolean;
  readonly removed?: readonly CeremonyRemovedTarget[];
  /** Bounded look-back override; the declared default is one cadence period. */
  readonly lookbackWindows?: number;
};

/** The disposition of one ceremony in a catch-up report. */
export type CeremonyCatchUpDisposition =
  | "current"
  | "satisfied"
  | "caught-up"
  | "declared-gap"
  | "still-missed"
  | "unverified";

/** One ceremony's catch-up report. */
export type CeremonyCatchUpCeremony = {
  readonly ceremony: string;
  readonly disposition: CeremonyCatchUpDisposition;
  readonly missedWindows: readonly CeremonyWindow[];
  readonly satisfiedWindows: readonly CeremonyWindow[];
  readonly runId?: string;
  readonly window?: CeremonyWindow;
  readonly reason?: string;
};

/** The catch-up report data. */
export type CeremonyCatchUpReport = {
  readonly outcome: "nothing-missed" | "caught-up" | "declared-gap" | "unverified";
  readonly ceremonies: readonly CeremonyCatchUpCeremony[];
  readonly appendedRuns: number;
};

export type CeremonyCatchUpOutcome =
  | { readonly ok: true; readonly data: CeremonyCatchUpReport }
  | { readonly ok: false; readonly error: CeremonyEngineFailure };

/** The declared bounded look-back: one period of each cadence. */
export const CEREMONY_CATCH_UP_LOOKBACK: Readonly<Record<CeremonyCadence, number>> = {
  daily: 7,
  weekly: 4,
  iteration: 2,
  milestone: 2,
};

/** The declared cadence period in milliseconds. */
export const ceremonyCadencePeriodMs = (cadence: CeremonyCadence): number =>
  cadence === "daily"
    ? 86_400_000
    : cadence === "weekly"
      ? 7 * 86_400_000
      : CEREMONY_CADENCE_WINDOW_DAYS[cadence] * 86_400_000;

/** The windows of a cadence that are due strictly before now, oldest first. */
export const dueCeremonyWindows = (input: {
  readonly cadence: CeremonyCadence;
  readonly nowMs: number;
  readonly lookback?: number;
}): readonly CeremonyWindow[] => {
  const period = ceremonyCadencePeriodMs(input.cadence);
  const current = deriveCeremonyCadenceWindow(input.cadence, input.nowMs);
  const currentStart = Date.parse(current.start);
  const lookback = Math.max(0, input.lookback ?? CEREMONY_CATCH_UP_LOOKBACK[input.cadence]);
  const windows: CeremonyWindow[] = [];
  for (let offset = lookback; offset >= 1; offset -= 1) {
    const start = currentStart - offset * period;
    windows.push({
      start: new Date(start).toISOString(),
      end: new Date(start + period - 1).toISOString(),
    });
  }
  return windows;
};

/** The declared schedule trigger for one ceremony, when it declares one. */
const scheduleOf = (declaration: CeremonyDeclaration) =>
  declaration.triggers.find((trigger) => trigger.kind === "schedule");

/** Whether one recorded run occupies the given window identity. */
export const ceremonyWindowRecorded = (
  runs: readonly CeremonyRunRecord[],
  input: {
    readonly ceremonyId: string;
    readonly scopeKey: string;
    readonly window: CeremonyWindow;
  },
): boolean =>
  runs.some(
    (run) =>
      run.ceremonyId === input.ceremonyId &&
      run.scopeKey.value === input.scopeKey &&
      run.trigger.actualWindow.start === input.window.start &&
      run.trigger.actualWindow.end === input.window.end,
  );

/** Compute missed and satisfied windows for one declaration + recorded runs. */
export const evaluateCeremonySchedule = (input: {
  readonly declaration: CeremonyDeclaration;
  readonly scopeKey: string;
  readonly runs: readonly CeremonyRunRecord[];
  readonly nowMs: number;
  readonly lookback?: number;
}): {
  readonly missed: readonly CeremonyWindow[];
  readonly satisfied: readonly CeremonyWindow[];
  readonly eventTriggered: boolean;
} => {
  const schedule = scheduleOf(input.declaration);
  if (schedule === undefined || schedule.kind !== "schedule") {
    return { missed: [], satisfied: [], eventTriggered: true };
  }
  const due = dueCeremonyWindows({
    cadence: schedule.cadence,
    nowMs: input.nowMs,
    ...(input.lookback === undefined ? {} : { lookback: input.lookback }),
  });
  const missed: CeremonyWindow[] = [];
  const satisfied: CeremonyWindow[] = [];
  for (const window of due) {
    if (
      ceremonyWindowRecorded(input.runs, {
        ceremonyId: input.declaration.id,
        scopeKey: input.scopeKey,
        window,
      })
    ) {
      satisfied.push(window);
    } else {
      missed.push(window);
    }
  }
  return { missed, satisfied, eventTriggered: false };
};

/** The scope key a catch-up target resolves from its declaration derivation. */
export const catchUpScopeKey = (input: {
  readonly declaration: CeremonyDeclaration;
  readonly repositoryId: string;
}): string | undefined => {
  const derivation = input.declaration.scopeKey;
  if (derivation.kind === "repository") return input.repositoryId;
  if (derivation.kind === "literal") return derivation.value;
  return undefined;
};

const failure = (code: string, summary: string): CeremonyEngineFailure => ({ code, summary });

/** Evaluate and (at most once per ceremony) replay missed windows. */
export const catchUpCeremonies = (request: CeremonyCatchUpRequest): CeremonyCatchUpOutcome => {
  const before = request.env.records.readRuns();
  if (before.verdict === "torn" || before.verdict === "unknown") {
    return {
      ok: false,
      error: failure(
        before.verdict === "torn" ? "state.store.torn" : "state.store.unknown",
        before.detail ?? "ceremony run records are unreadable",
      ),
    };
  }
  const runs = before.records;
  const ceremonies: CeremonyCatchUpCeremony[] = [];
  let appendedRuns = 0;
  for (const target of request.targets) {
    const declaration = target.declaration;
    const scopeKey = catchUpScopeKey({
      declaration,
      repositoryId: request.env.repositoryId,
    });
    if (scopeKey === undefined) {
      ceremonies.push({
        ceremony: declaration.id,
        disposition: "declared-gap",
        missedWindows: [],
        satisfiedWindows: [],
        reason: "the declaration derives its scope key from a note, which catch-up does not supply",
      });
      continue;
    }
    const evaluation = evaluateCeremonySchedule({
      declaration,
      scopeKey,
      runs,
      nowMs: request.nowMs,
      ...(request.lookbackWindows === undefined ? {} : { lookback: request.lookbackWindows }),
    });
    if (evaluation.eventTriggered) {
      ceremonies.push({
        ceremony: declaration.id,
        disposition: "declared-gap",
        missedWindows: [],
        satisfiedWindows: [],
        reason: "event-triggered declaration has no due window to replay",
      });
      continue;
    }
    if (evaluation.missed.length === 0) {
      ceremonies.push({
        ceremony: declaration.id,
        disposition: evaluation.satisfied.length === 0 ? "current" : "satisfied",
        missedWindows: [],
        satisfiedWindows: evaluation.satisfied,
      });
      continue;
    }
    if (declaration.catchUp.mode === "none") {
      const [first] = evaluation.missed;
      ceremonies.push({
        ceremony: declaration.id,
        disposition: "declared-gap",
        missedWindows: evaluation.missed,
        satisfiedWindows: evaluation.satisfied,
        ...(first === undefined ? {} : { window: first }),
        reason: "catchUp.mode is none; the missed window is a declared gap",
      });
      continue;
    }
    const [replay] = evaluation.missed;
    if (replay === undefined) continue;
    const executionWindow =
      scheduleOf(declaration) === undefined
        ? replay
        : deriveCeremonyCadenceWindow(
            scheduleOf(declaration)?.kind === "schedule"
              ? (scheduleOf(declaration)?.cadence ?? "daily")
              : "daily",
            request.nowMs,
          );
    const run = runCeremony({
      declaration,
      env: request.env,
      noteSupplied: false,
      window: replay,
      apply: request.apply,
      catchUp: { missedWindow: replay, executionWindow },
    });
    if (run.ok && !run.data.reused) appendedRuns += 1;
    if (!run.ok) {
      ceremonies.push({
        ceremony: declaration.id,
        disposition: "unverified",
        missedWindows: evaluation.missed,
        satisfiedWindows: evaluation.satisfied,
        window: replay,
        reason: run.error.summary,
      });
      continue;
    }
    const remaining = evaluation.missed.slice(1);
    ceremonies.push({
      ceremony: declaration.id,
      disposition:
        run.data.verdict === "unverified"
          ? "unverified"
          : remaining.length > 0
            ? "still-missed"
            : "caught-up",
      missedWindows: remaining,
      satisfiedWindows: evaluation.satisfied,
      runId: run.data.runId,
      window: replay,
      ...(remaining.length > 0
        ? { reason: `${String(remaining.length)} further missed window(s) remain` }
        : {}),
    });
  }
  for (const removed of request.removed ?? []) {
    ceremonies.push({
      ceremony: removed.ceremonyId,
      disposition: "declared-gap",
      missedWindows: [],
      satisfiedWindows: [],
      reason: `the declaration was removed; ${String(removed.recordedRuns)} recorded run(s) remain readable`,
    });
  }
  const hasUnverified = ceremonies.some((entry) => entry.disposition === "unverified");
  const hasGap = ceremonies.some((entry) => entry.disposition === "declared-gap");
  const hasCaughtUp = ceremonies.some(
    (entry) => entry.disposition === "caught-up" || entry.disposition === "still-missed",
  );
  const outcome = hasUnverified
    ? "unverified"
    : hasCaughtUp
      ? "caught-up"
      : hasGap
        ? "declared-gap"
        : "nothing-missed";
  return {
    ok: true,
    data: { outcome, ceremonies, appendedRuns },
  };
};

/** The run data a catch-up replay produced, when one executed. */
export type CeremonyCatchUpRunData = CeremonyRunData;
