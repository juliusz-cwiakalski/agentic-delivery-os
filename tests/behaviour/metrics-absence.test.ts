/**
 * TC-METRICS-070/072 — the composite absence posture: every section declares
 * its own evidence state, an all-absent report still exits 0, per-section
 * independence holds, and no numeric position ever fabricates a zero.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { fullBaseline } from "../fixtures/metrics/baseline";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { burnRateConfig } from "../fixtures/metrics/config";
import {
  DAY_MS,
  drawnWindow,
  entriesById,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  reportOf,
  runMetrics,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

/** The all-absent fixture: no log, no node, no telemetry, ceremony, or corpus. */
const allAbsent = (label: string): MetricsFixture => {
  const fixture = makeMetricsFixture({ label, activeRef: METRICS_REF });
  fixtures.push(fixture);
  fixture.setCorpusDocument("empty/chg-GH-299-pm-notes.yaml", "metrics_corpus: {}\n");
  return fixture;
};

const counter = (entry: Record<string, unknown> | undefined, key: string): unknown => {
  const sample = entry?.sample;
  if (typeof sample !== "object" || sample === null) return undefined;
  return (sample as Record<string, unknown>)[key];
};

describe("TC-METRICS-070 no section renders a zero for absent evidence", () => {
  test("the all-absent report exits 0 with every section classified", async () => {
    const fixture = allAbsent("all-absent");
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    const data = reportOf(run);
    expect(run.exitCode).toBe(0);
    const entries = entriesById(data);
    expect(Object.keys(entries).sort()).toEqual([
      "MET-CEREMONY-SHARE",
      "MET-CI-FAILURE-RATE",
      "MET-CYCLE-TIME",
      "escaped-defects",
    ]);
    for (const entry of Object.values(entries)) {
      expect(entry.status).toBe("UNAVAILABLE");
      expect(entry.value).toBeUndefined();
    }
    const dispatch = data.dispatch as Record<string, unknown>;
    expect(dispatch.telemetryState).toBe("absent");
    expect(dispatch.absenceReason).toBe("spend.telemetry-absent");
    expect(data.alarmEvaluation).toEqual({ kind: "burn-rate", status: "telemetry-absent" });
    expect(data.alarms).toEqual([]);
    expect(data.comparisons).toEqual([]);
    expect(data.omitted).toBe(0);
    expect(data.truncated).toBe(false);
  });

  test("the all-absent human digest prints absent values and never a zero figure", async () => {
    const fixture = allAbsent("all-absent-human");
    const human = await runMetrics(fixture, ["metrics"]);
    expect(human.exitCode).toBe(0);
    expect(human.human).toContain("value=absent");
    expect(human.human).not.toMatch(/value=0\b/u);
    expect(human.human).not.toContain("tokens=0");
  });

  test("each single-absence fixture changes only its own section", async () => {
    const noTelemetry = makeMetricsCase({ label: "single-no-telemetry", steps: [] });
    fixtures.push(noTelemetry);
    const noTelemetryData = reportOf(await runMetrics(noTelemetry, ["metrics", "--json"]));
    expect(noTelemetryData.dispatch).toMatchObject({ telemetryState: "absent" });
    expect(entriesById(noTelemetryData)["MET-CYCLE-TIME"]?.value).toBe(7);

    const noCeremony = makeMetricsCase({ label: "single-no-ceremony", ceremony: [] });
    fixtures.push(noCeremony);
    const noCeremonyData = reportOf(await runMetrics(noCeremony, ["metrics", "--json"]));
    expect(entriesById(noCeremonyData)["MET-CEREMONY-SHARE"]?.status).toBe("UNAVAILABLE");
    expect(entriesById(noCeremonyData)["MET-CYCLE-TIME"]?.value).toBe(7);
    expect(entriesById(noCeremonyData)["MET-CI-FAILURE-RATE"]?.value).toBeDefined();

    const noHistory = makeMetricsCase({ label: "single-no-history", history: [] });
    fixtures.push(noHistory);
    const noHistoryData = reportOf(await runMetrics(noHistory, ["metrics", "--json"]));
    expect(entriesById(noHistoryData)["MET-CYCLE-TIME"]?.status).toBe("UNAVAILABLE");
    expect(entriesById(noHistoryData)["MET-CEREMONY-SHARE"]?.value).toBeDefined();

    const noLog = makeMetricsCase({ label: "single-no-log" });
    fixtures.push(noLog);
    noLog.removeBaseline();
    const noLogData = reportOf(await runMetrics(noLog, ["metrics", "--json"]));
    expect(entriesById(noLogData)["MET-CYCLE-TIME"]?.status).toBe("UNAVAILABLE");
    expect(entriesById(noLogData)["MET-CI-FAILURE-RATE"]?.status).toBe("UNAVAILABLE");
    expect((noLogData.dispatch as { telemetryState: string }).telemetryState).toBe("present");
    expect(noLogData.comparisons).toEqual([]);

    const noNode = makeMetricsCase({ label: "single-no-node", omitConfig: true });
    fixtures.push(noNode);
    const noNodeData = reportOf(await runMetrics(noNode, ["metrics", "--json"]));
    expect(noNodeData.alarmEvaluation).toMatchObject({ status: "threshold-undeclared" });
    expect(entriesById(noNodeData)["MET-CYCLE-TIME"]?.value).toBe(7);

    const noCorpus = makeMetricsCase({ label: "single-no-corpus", ci: [], evidence: [] });
    fixtures.push(noCorpus);
    const noCorpusData = reportOf(await runMetrics(noCorpus, ["metrics", "--json"]));
    expect(entriesById(noCorpusData)["MET-CI-FAILURE-RATE"]?.status).toBe("UNAVAILABLE");
    expect(entriesById(noCorpusData)["MET-CYCLE-TIME"]?.value).toBe(7);
  });

  test("absence is never counted as omission and never borrows a refusal identity", async () => {
    const fixture = makeMetricsFixture({ label: "absence-counters", activeRef: METRICS_REF });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    const data = reportOf(run);
    expect(data.omitted).toBe(0);
    expect(data.truncated).toBe(false);
    expect(run.envelope?.error).toBeUndefined();
    for (const code of ["metrics.baseline-unreadable", "state.store.torn"]) {
      expect(JSON.stringify(data)).not.toContain(`"${code}"`);
    }
  });
});

describe("TC-METRICS-072 the zero-fabrication sweep", () => {
  const numericKeys = ["value"] as const;

  test("every absent row has no numeric value and every measured row carries one", async () => {
    const matrix = [
      makeMetricsCase({ label: "sweep-full" }),
      makeMetricsCase({ label: "sweep-no-telemetry", steps: [] }),
      makeMetricsCase({ label: "sweep-no-ceremony", ceremony: [] }),
      makeMetricsCase({ label: "sweep-no-history", history: [] }),
      makeMetricsCase({ label: "sweep-partial-log" }),
      allAbsent("sweep-all-absent"),
    ];
    for (const fixture of matrix) fixtures.push(fixture);
    for (const fixture of matrix) {
      const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
      for (const entry of Object.values(entriesById(data))) {
        for (const key of numericKeys) {
          if (entry.status === "UNAVAILABLE") {
            expect(entry[key], `${fixture.root} ${String(entry.id)} ${key}`).toBeUndefined();
          } else {
            expect(typeof entry[key], `${fixture.root} ${String(entry.id)} ${key}`).toBe("number");
          }
        }
      }
      const dispatch = data.dispatch as Record<string, unknown>;
      if (dispatch.telemetryState === "absent") {
        expect(dispatch.tokensByClass).toBeUndefined();
        expect(dispatch.costTotals).toBeUndefined();
      } else {
        expect(dispatch.tokensByClass).toBeDefined();
      }
    }
  });

  test("counters are the declared exception: zero is legal only where the population is empty", async () => {
    const fixture = allAbsent("sweep-counter-exception");
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect(data.omitted).toBe(0);
    const escaped = entriesById(data)["escaped-defects"];
    expect(counter(escaped, "n")).toBe(0);
    expect(escaped?.value).toBeUndefined();
  });

  test("the human render never prints a numeric placeholder for an absent row", async () => {
    const fixture = allAbsent("sweep-human");
    const human = (await runMetrics(fixture, ["metrics"])).human;
    for (const line of human.split("\n")) {
      if (!/^( {2}MET-| {2}escaped-)/u.test(line)) continue;
      if (line.includes("UNAVAILABLE")) {
        expect(line, line).toContain("value=absent");
      }
    }
  });

  test("a measured window still reports its committed window and drawn bounds", async () => {
    const fixture = makeMetricsCase({ label: "sweep-window", baseline: fullBaseline() });
    fixtures.push(fixture);
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    expect(data.window).toEqual(drawnWindow(METRICS_NOW_MS));
    expect((data.comparisons as readonly unknown[]).length).toBe(3);
    expect((await runMetrics(fixture, ["metrics", "--json"])).envelope?.data).toEqual(data);
    expect(new Date(METRICS_NOW_MS - DAY_MS).toISOString()).toBe("2026-11-16T09:00:00.000Z");
    expect(burnRateConfig().length).toBeGreaterThan(0);
  });
});
