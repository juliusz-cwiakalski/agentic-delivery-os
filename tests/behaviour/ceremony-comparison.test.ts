/**
 * TC-CEREMONY-041 (comparison completeness; before equals the committed
 * baseline) and TC-CEREMONY-042 (below the sample minimum: insufficient-sample
 * with the observed n and no trend).
 */
import { describe, expect, test } from "bun:test";
import {
  buildCeremonyComparison,
  foldCeremonyMeasurement,
} from "../../packages/core/src/domain/index";
import {
  AFTER_WINDOW,
  BEFORE,
  ceremonyShareRow,
  LIMITATION,
  LOG_PATH,
} from "../fixtures/ceremony/comparison/baseline";
import { stepRecord } from "../fixtures/ceremony/state";

const measurement = () =>
  foldCeremonyMeasurement([
    {
      ceremony: "morning-brief",
      runId: "run-1",
      steps: [
        stepRecord({
          runId: "run-1",
          index: 1,
          phaseIndex: 0,
          startedAtMs: 0,
          endedAtMs: 60,
          durationMs: 60,
        }),
        stepRecord({
          runId: "run-1",
          index: 2,
          phaseIndex: 1,
          startedAtMs: 60,
          endedAtMs: 100,
          durationMs: 40,
        }),
      ],
    },
    {
      ceremony: "morning-brief",
      runId: "run-2",
      steps: [
        stepRecord({
          runId: "run-2",
          index: 1,
          phaseIndex: 0,
          startedAtMs: 0,
          endedAtMs: 200,
          durationMs: 200,
        }),
      ],
    },
  ]);

const build = (samples: readonly { changeRef: string; value: number }[]) =>
  buildCeremonyComparison({
    logPath: LOG_PATH,
    sourceCommit: "75b4e7602ad89bd26f96912ac06ed8bfcb72a5ae",
    before: BEFORE,
    afterWindow: AFTER_WINDOW,
    samples,
    measurement: measurement(),
    limitation: LIMITATION,
  });

describe("TC-CEREMONY-041 the comparison record is complete and the before value is committed", () => {
  test("every DM-8 member is present and before equals the committed row", () => {
    const row = ceremonyShareRow();
    const record = build([]);
    expect(record.metricId).toBe("MET-CEREMONY-SHARE");
    expect(record.definitionRef).toEqual({
      logPath: LOG_PATH,
      sourceCommit: "75b4e7602ad89bd26f96912ac06ed8bfcb72a5ae",
    });
    expect(record.before.value).toBe(row.value);
    expect(record.before.value).toBe(0.406648);
    expect(record.before.sampleSize).toBe(23);
    expect(record.before.status).toBe("PARTIAL");
    expect(record.sampleMinimum).toBe(5);
    expect(record.after.window).toEqual(AFTER_WINDOW);
    expect(record.after.samples).toEqual([]);
    expect(record.after.sampleSize).toBe(0);
    expect(record.nativeBasis.statement).toContain("not interchangeable");
    expect(record.disclosure).toContain("sample minimum is 5");
    expect(record.disclosure).toContain("pm-notes-self-reported");
  });

  test("the native basis is a fold over verified runs, not a second stored figure", () => {
    const fold = measurement();
    expect(fold.runs).toBe(2);
    expect(fold.steps).toBe(3);
    expect(fold.perRun.map((run) => run.durationMs)).toEqual([100, 200]);
    expect(fold.perCeremony).toEqual([
      { ceremony: "morning-brief", runs: 2, meanMs: 150, p90Ms: 200 },
    ]);
  });
});

describe("TC-CEREMONY-042 below the minimum is insufficient-sample with the observed n", () => {
  test("four changes never produce a trend verdict", () => {
    const record = build([
      { changeRef: "GH-1", value: 0.3 },
      { changeRef: "GH-2", value: 0.3 },
      { changeRef: "GH-3", value: 0.3 },
      { changeRef: "GH-4", value: 0.3 },
    ]);
    expect(record.verdict).toBe("insufficient-sample");
    expect(record.after.sampleSize).toBe(4);
    expect(record.after.samples).toHaveLength(4);
  });

  test("five changes compute improved, regressed, and flat from the same definition", () => {
    const samples = (value: number) =>
      Array.from({ length: 5 }, (_, index) => ({
        changeRef: `GH-${String(index + 1)}`,
        value,
      }));
    expect(build(samples(0.3)).verdict).toBe("improved");
    expect(build(samples(0.5)).verdict).toBe("regressed");
    expect(build(samples(0.406648)).verdict).toBe("flat");
  });
});
