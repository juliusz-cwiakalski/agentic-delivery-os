/**
 * TC-METRICS-001/002/006 — the bare report: the declared payload, the drawn
 * window, the closed entry order, the explicit selectors honoured and echoed,
 * and the inclusive bounds driven by the injected clock.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { inWindowCeremonies } from "../fixtures/metrics/ceremony";
import { corpusDocument } from "../fixtures/metrics/corpus";
import {
  DAY_MS,
  drawnWindow,
  entriesById,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  OTHER_REF,
  reportOf,
  runMetrics,
} from "../fixtures/metrics/harness";
import {
  fullyAttributableSteps,
  seedTelemetry,
  stepOf,
  tokens,
} from "../fixtures/metrics/telemetry";
import { completeHistory, seedHistory } from "../fixtures/metrics/transitions";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const counter = (entry: Record<string, unknown> | undefined, key: string): unknown => {
  const sample = entry?.sample;
  if (typeof sample !== "object" || sample === null) return undefined;
  return (sample as Record<string, unknown>)[key];
};

const fullCase = (label: string): MetricsFixture => {
  const fixture = makeMetricsCase({ label });
  fixtures.push(fixture);
  return fixture;
};

describe("TC-METRICS-001 the bare report carries the declared payload", () => {
  test("exit 0, the nine data keys, the drawn window, and the closed entry order", async () => {
    const fixture = fullCase("bare");
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    const data = reportOf(run);
    expect(run.exitCode).toBe(0);
    expect(Object.keys(data).sort()).toEqual(
      [
        "alarmEvaluation",
        "alarms",
        "comparisons",
        "dispatch",
        "metrics",
        "omitted",
        "ref",
        "truncated",
        "window",
      ].sort(),
    );
    expect(data.ref).toBe(METRICS_REF);
    expect(data.window).toEqual(drawnWindow(fixture.nowMs));
    expect((data.metrics as readonly { id: string }[]).map((entry) => entry.id)).toEqual([
      "MET-CEREMONY-SHARE",
      "MET-CYCLE-TIME",
      "MET-CI-FAILURE-RATE",
      "escaped-defects",
    ]);
    for (const entry of Object.values(entriesById(data))) {
      for (const key of [
        "status",
        "measurementKind",
        "basis",
        "unit",
        "direction",
        "sample",
        "limitation",
      ]) {
        expect(entry[key], `${String(entry.id)} ${key}`).toBeDefined();
      }
    }
    expect(entriesById(data)["escaped-defects"]?.definitionRef).toBeUndefined();
    expect(data.omitted).toBe(0);
    expect(data.truncated).toBe(false);
  });

  test("the human render names every declared section", async () => {
    const fixture = fullCase("bare-human");
    const run = await runMetrics(fixture, ["metrics"]);
    expect(run.exitCode).toBe(0);
    for (const label of ["Metrics:", "Dispatch:", "Alarm evaluation:", "Comparisons:"]) {
      expect(run.human).toContain(label);
    }
  });

  test("the bare report leaves every source byte-identical", async () => {
    const fixture = fullCase("bare-readonly");
    const before = fixture.snapshot();
    expect((await runMetrics(fixture, ["metrics", "--json"])).exitCode).toBe(0);
    expect(fixture.snapshot()).toBe(before);
  });
});

describe("TC-METRICS-002 explicit selectors are honoured and echoed", () => {
  test("--ref selects the named ref's evidence only", async () => {
    const control = fullCase("explicit-ref-control");
    const controlTokens = (
      reportOf(await runMetrics(control, ["metrics", "--json"])).dispatch as {
        tokensByClass: { input: number };
      }
    ).tokensByClass.input;
    const fixture = makeMetricsCase({
      label: "explicit-ref-other",
      activeRef: METRICS_REF,
      steps: [
        stepOf({
          ref: OTHER_REF,
          runId: "run-other",
          agentRole: "coder",
          model: "model-other",
          tokens: tokens({ input: 700 }),
          cost: 1,
          capturedAt: new Date(METRICS_NOW_MS - 2 * DAY_MS).toISOString(),
        }),
      ],
    });
    fixtures.push(fixture);
    seedHistory(fixture.store, OTHER_REF, completeHistory());
    // The metrics case seeds the active ref's history; the other ref's steps are
    // the only telemetry population, so a --ref selection must answer for it.
    const run = await runMetrics(fixture, ["metrics", "--ref", OTHER_REF, "--json"]);
    const data = reportOf(run);
    expect(data.ref).toBe(OTHER_REF);
    const dispatch = data.dispatch as { tokensByClass: { input: number } };
    expect(controlTokens).toBe(1000);
    expect(dispatch.tokensByClass.input).toBe(700);
    expect(JSON.stringify(dispatch)).not.toContain("1000");
  });

  test("explicit bounds are echoed verbatim into the comparison rows", async () => {
    const fixture = fullCase("explicit-window");
    const from = new Date(METRICS_NOW_MS - 7 * DAY_MS).toISOString();
    const through = new Date(METRICS_NOW_MS - 1 * DAY_MS).toISOString();
    const run = await runMetrics(fixture, [
      "metrics",
      "--from",
      from,
      "--through",
      through,
      "--json",
    ]);
    const data = reportOf(run);
    expect(data.window).toEqual({ from, through });
    for (const row of data.comparisons as readonly {
      after: { window: { from: string; through: string } };
    }[]) {
      expect(row.after.window).toEqual({ from, through });
    }
  });

  test("a shorter window shrinks the corpus and ceremony samples", async () => {
    const wide = fullCase("window-wide");
    const wideRun = await runMetrics(wide, ["metrics", "--json"]);
    const wideCeremony = entriesById(reportOf(wideRun))["MET-CEREMONY-SHARE"];
    const wideCi = entriesById(reportOf(wideRun))["MET-CI-FAILURE-RATE"];
    const narrow = makeMetricsCase({ label: "window-narrow" });
    fixtures.push(narrow);
    const from = new Date(METRICS_NOW_MS - 6 * 3_600_000).toISOString();
    const through = new Date(METRICS_NOW_MS - 5 * 3_600_000).toISOString();
    const narrowRun = await runMetrics(narrow, [
      "metrics",
      "--from",
      from,
      "--through",
      through,
      "--json",
    ]);
    const narrowCeremony = entriesById(reportOf(narrowRun))["MET-CEREMONY-SHARE"];
    const narrowCi = entriesById(reportOf(narrowRun))["MET-CI-FAILURE-RATE"];
    expect(counter(wideCeremony, "n")).toBe(3);
    expect(counter(narrowCeremony, "n")).toBe(0);
    expect(counter(wideCi, "n")).toBe(3);
    expect(counter(narrowCi, "n")).toBe(0);
  });

  test("the human digest is produced without --json and describes the same selection", async () => {
    const fixture = fullCase("human-selection");
    const run = await runMetrics(fixture, ["metrics", "--ref", METRICS_REF]);
    expect(run.exitCode).toBe(0);
    expect(run.envelope).toBeUndefined();
    expect(run.human).toContain(`ref ${METRICS_REF}`);
    expect(run.human).not.toContain('"schemaVersion"');
  });
});

describe("TC-METRICS-006 inclusive bounds and the injected clock", () => {
  test("records exactly at the bounds are included and neighbours are counted outside", async () => {
    const fixture = makeMetricsFixture({ label: "bounds", activeRef: METRICS_REF });
    fixtures.push(fixture);
    const from = METRICS_NOW_MS - 5 * DAY_MS;
    const through = METRICS_NOW_MS - 1 * DAY_MS;
    fixture.setConfig(
      "metrics:\n  burn-rate:\n    threshold: 1000\n    basis: tokens\n    window: 14d\n",
    );
    fixture.setBaseline((await import("../fixtures/metrics/baseline")).fullBaseline());
    fixture.setCorpusDocument(
      "x/chg-GH-299-pm-notes.yaml",
      corpusDocument({
        ci: [
          { ref: "GH-1", observed: true, outcome: "red", observedAt: new Date(from).toISOString() },
          {
            ref: "GH-2",
            observed: true,
            outcome: "green",
            observedAt: new Date(from - 1).toISOString(),
          },
          {
            ref: "GH-3",
            observed: true,
            outcome: "green",
            observedAt: new Date(through).toISOString(),
          },
          {
            ref: "GH-4",
            observed: true,
            outcome: "green",
            observedAt: new Date(through + 1).toISOString(),
          },
        ],
      }),
    );
    seedTelemetry(
      fixture.store,
      fullyAttributableSteps({ ref: METRICS_REF, capturedAt: new Date(from).toISOString() }),
    );
    seedHistory(fixture.store, METRICS_REF, completeHistory());
    const run = await runMetrics(fixture, [
      "metrics",
      "--from",
      new Date(from).toISOString(),
      "--through",
      new Date(through).toISOString(),
      "--json",
    ]);
    const data = reportOf(run);
    const ci = entriesById(data)["MET-CI-FAILURE-RATE"];
    expect(counter(ci, "n")).toBe(2);
    expect(ci?.excluded).toContainEqual({ reason: "outside_window", count: 2 });
    expect(Number(ci?.value)).toBeCloseTo(1 / 2, 12);
  });

  test("the ceremony window list is independent of the store's return order", () => {
    const runs = inWindowCeremonies(METRICS_NOW_MS - 3_600_000);
    expect(runs.map((run) => run.runId)).toEqual([
      "run-ceremony-0001",
      "run-ceremony-0002",
      "run-ceremony-0003",
    ]);
  });
});
