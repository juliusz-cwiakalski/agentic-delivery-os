/**
 * Ceremony run/step seeds for the metrics suites (GH-299 test plan §6).
 *
 * Runs and steps are appended through the delivered ceremony append path under
 * one fence, so the native fold reads records the runner could have produced.
 * Timings are literal milliseconds; the native ceremony share is run time over
 * the evidence window's elapsed time.
 */
import type {
  CeremonyRunRecord,
  CeremonyStepRecord,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { appendCeremonyRun, appendCeremonyStep } from "../../../packages/core/src/state/index";
import { NOW_MS, runRecord, stepRecord } from "../ceremony/state";
import { withinFence } from "../state/harness";

export { NOW_MS, runRecord, stepRecord };

export type CeremonySeedRun = {
  readonly ceremony: string;
  readonly runId: string;
  readonly startedAtMs: number;
  readonly durationsMs: readonly number[];
};

const stepFor = (
  run: CeremonySeedRun,
  entryIndex: number,
  stepIndex: number,
  startMs: number,
): CeremonyStepRecord =>
  stepRecord({
    runId: run.runId,
    index: stepIndex,
    phaseIndex: entryIndex,
    durationMs: run.durationsMs[entryIndex] ?? 0,
    startedAtMs: startMs,
    endedAtMs: startMs + (run.durationsMs[entryIndex] ?? 0),
  });

const runFor = (run: CeremonySeedRun): CeremonyRunRecord =>
  runRecord({
    ceremonyId: run.ceremony,
    runId: run.runId,
    startedAtMs: run.startedAtMs,
    phaseCount: run.durationsMs.length,
  });

/** Seed the declared runs and their step sets through the append path. */
export const seedCeremony = (store: StateStorePort, runs: readonly CeremonySeedRun[]): void => {
  withinFence(store, "metrics-ceremony-seed", (handle) => {
    let runTotal = 0;
    for (const run of runs) {
      runTotal += 1;
      const appended = appendCeremonyRun(store, handle, runFor(run), runTotal);
      if (!appended.ok) throw new Error(`ceremony run seed failed: ${appended.error.code}`);
      let start = run.startedAtMs;
      for (const [index, duration] of run.durationsMs.entries()) {
        const step = stepFor(run, index, index + 1, start);
        const outcome = appendCeremonyStep(store, handle, step, index + 1);
        if (!outcome.ok) throw new Error(`ceremony step seed failed: ${outcome.error.code}`);
        start += duration;
      }
    }
  });
};

/** The three in-window ceremonies with known step timings. */
export const inWindowCeremonies = (startedAtMs: number): readonly CeremonySeedRun[] => [
  {
    ceremony: "morning-brief",
    runId: "run-ceremony-0001",
    startedAtMs,
    durationsMs: [1_000, 2_000],
  },
  {
    ceremony: "morning-brief",
    runId: "run-ceremony-0002",
    startedAtMs: startedAtMs + 60_000,
    durationsMs: [3_000, 1_000],
  },
  {
    ceremony: "retro",
    runId: "run-ceremony-0003",
    startedAtMs: startedAtMs + 120_000,
    durationsMs: [500, 500, 1_000],
  },
];

/** Runs that fall before the evidence window. */
export const outOfWindowCeremonies = (): readonly CeremonySeedRun[] => [
  {
    ceremony: "morning-brief",
    runId: "run-ceremony-old",
    startedAtMs: NOW_MS - 400 * 86_400_000,
    durationsMs: [1_000, 1_000],
  },
];

/** The native ceremony share the fixture evidence yields (independent oracle). */
export const expectedCeremonyShare = (
  runs: readonly CeremonySeedRun[],
  windowFromMs: number,
  windowThroughMs: number,
): number => {
  const total = runs.reduce(
    (sum, run) => sum + run.durationsMs.reduce((inner, value) => inner + value, 0),
    0,
  );
  return total / Math.max(1, windowThroughMs - windowFromMs);
};
