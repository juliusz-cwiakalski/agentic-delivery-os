/**
 * TC-METRICS-010/011/015/016 — baseline consumption by ID and definition: the
 * committed `definitionRef`, the carried status/unit/direction, the parsed
 * log's own per-reason exclusion counts versus the entry's evaluated-basis
 * exclusions, basis-scoped values (a committed basis recomputes; a native basis
 * reads its declared source), partial-log row absence, and the untouched fourth
 * row.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readMetricsBaselineLog } from "../../packages/adapters/src/file/metrics-baseline";
import {
  BASELINE_SOURCE_COMMIT,
  BASELINE_WINDOW,
  baselineDocument,
  CEREMONY_ROW,
  CI_ROW,
  CYCLE_ROW,
  FALSE_SIGNAL_ROW,
  falseSignalOnlyBaseline,
  fullBaseline,
  legacyCounterBaseline,
  partialBaseline,
} from "../fixtures/metrics/baseline";
import { defaultBaseline, makeMetricsCase } from "../fixtures/metrics/case";
import {
  BASELINE_RELATIVE,
  documentText,
  entriesById,
  METRICS_REF,
  type MetricsFixture,
  makeMemoryProjectFs,
  runMetrics,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const report = async (fixture: MetricsFixture): Promise<Record<string, unknown>> => {
  fixtures.push(fixture);
  const run = await runMetrics(fixture, ["metrics", "--json"]);
  expect(run.exitCode).toBe(0);
  return run.envelope?.data as Record<string, unknown>;
};

const counter = (entry: Record<string, unknown> | undefined, key: string): unknown => {
  const sample = entry?.sample;
  if (typeof sample !== "object" || sample === null) return undefined;
  return (sample as Record<string, unknown>)[key];
};

/** Read one fixture document through the delivered adapter over an in-memory tree. */
const readDocument = (label: string, text: string) => {
  const root = `/metrics-baseline-${label}`;
  const fs = makeMemoryProjectFs(root);
  fs.set(BASELINE_RELATIVE, text);
  return readMetricsBaselineLog({ projectRoot: root, fs });
};

const definitionRef = {
  logPath: "doc/planning/oss-tooling/measurement-baseline.yaml",
  sourceCommit: BASELINE_SOURCE_COMMIT,
};

describe("TC-METRICS-010 each baseline entry cites its committed definition", () => {
  test("definitionRef, status, unit, direction, and limitation come from the committed rows", async () => {
    const data = await report(makeMetricsCase({ label: "baseline-provenance" }));
    const entries = entriesById(data);
    for (const row of [CEREMONY_ROW, CYCLE_ROW, CI_ROW]) {
      const entry = entries[row.id];
      if (entry === undefined) throw new Error(`missing entry ${row.id}`);
      expect(entry.definitionRef).toEqual(definitionRef);
      expect(entry.unit).toBe(row.unit);
      expect(entry.direction).toBe(row.direction);
      expect(String(entry.limitation)).toContain(row.limitation.slice(0, 40));
    }
    expect(entries["MET-CEREMONY-SHARE"]?.status).toBe("PARTIAL");
    expect(entries["MET-CI-FAILURE-RATE"]?.status).toBe("PARTIAL");
  });

  test("the parsed document counts per-change rows per reason and drops zero counts", () => {
    const read = readDocument("counts", fullBaseline());
    expect(read.ok).toBe(true);
    if (!read.ok || read.state !== "present") throw new Error("fixture log not present");
    // The committed shape is one `{ref, reason}` row per excluded change.
    const ci = read.document.rows.find((row) => row.id === "MET-CI-FAILURE-RATE");
    expect(ci?.excluded).toEqual([{ reason: "no_ci_observation", count: 1 }]);
    const cycle = read.document.rows.find((row) => row.id === "MET-CYCLE-TIME");
    expect(cycle?.excluded).toEqual([]);
  });

  test("the entry reports its own basis exclusions, not the log's listed totals", async () => {
    const listed = Array.from({ length: 19 }, (_, index) => ({
      ref: `GH-${index + 1}`,
      reason: "no_ci_observation",
    }));
    const data = await report(
      makeMetricsCase({
        label: "baseline-entry-exclusions",
        baseline: baselineDocument({
          rows: [{ ...CI_ROW, excluded: listed }, CEREMONY_ROW, CYCLE_ROW, FALSE_SIGNAL_ROW],
        }),
      }),
    );
    const entry = entriesById(data)["MET-CI-FAILURE-RATE"];
    const excluded = (entry?.excluded ?? []) as readonly {
      readonly reason: string;
      readonly count: number;
    }[];
    // The evaluated basis: one unobserved in-window row and one out-of-window row.
    expect(excluded).toEqual([
      { reason: "outside_window", count: 1 },
      { reason: "no_ci_observation", count: 1 },
    ]);
    expect(excluded.find((row) => row.reason === "no_ci_observation")?.count).not.toBe(19);
    for (const row of excluded) expect(row.count).toBeGreaterThan(0);
  });

  test("the sample block describes the fixture evidence, not the committed sample block", async () => {
    const data = await report(makeMetricsCase({ label: "baseline-samples" }));
    const entries = entriesById(data);
    expect(counter(entries["MET-CYCLE-TIME"], "n")).toBe(1);
    expect(counter(entries["MET-CI-FAILURE-RATE"], "n")).toBe(3);
    expect(counter(entries["MET-CEREMONY-SHARE"], "n")).toBe(3);
    expect(counter(entries["MET-CEREMONY-SHARE"], "n")).not.toBe(23);
  });

  test("the three entries appear in vocabulary order and no other row is surfaced", async () => {
    const data = await report(makeMetricsCase({ label: "baseline-order" }));
    const ids = (data.metrics as readonly { id: string }[]).map((entry) => entry.id);
    expect(ids).toEqual([
      "MET-CEREMONY-SHARE",
      "MET-CYCLE-TIME",
      "MET-CI-FAILURE-RATE",
      "escaped-defects",
    ]);
  });
});

describe("TC-METRICS-011 the value is scoped by the entry's declared basis", () => {
  test("the committed-basis CI proxy recomputes and differs from the committed value", async () => {
    const data = await report(makeMetricsCase({ label: "basis-ci" }));
    const entry = entriesById(data)["MET-CI-FAILURE-RATE"];
    expect(entry?.measurementKind).toBe("proxy");
    expect(entry?.basis).toBe("committed-pm-notes-corpus");
    // Two red-or-mixed over three observed is 2/3; the committed value is 0.25.
    expect(Number(entry?.value)).toBeCloseTo(2 / 3, 10);
    expect(Number(entry?.value)).not.toBe(0.25);
  });

  test("the native cycle time and ceremony share read their declared sources", async () => {
    const data = await report(makeMetricsCase({ label: "basis-native" }));
    const cycle = entriesById(data)["MET-CYCLE-TIME"];
    expect(cycle?.measurementKind).toBe("native");
    expect(cycle?.basis).toBe("phase-transition-history");
    expect(Number(cycle?.value)).toBe(7);
    expect(Number(cycle?.value)).not.toBe(5.3);
    const ceremony = entriesById(data)["MET-CEREMONY-SHARE"];
    expect(ceremony?.measurementKind).toBe("native");
    expect(ceremony?.basis).toBe("ceremony-runner-fold");
    expect(Number(ceremony?.value)).not.toBe(0.406648);
  });

  test("the committed value is never restated inside the entry", async () => {
    const data = await report(makeMetricsCase({ label: "basis-restate" }));
    const entries = entriesById(data);
    const serialized = JSON.stringify(entries);
    // The committed cycle, ceremony, and CI values are distinguishable figures.
    expect(serialized).not.toContain("5.3");
    expect(serialized).not.toContain("0.406648");
    expect(serialized).not.toContain("0.25");
    for (const id of ["MET-CEREMONY-SHARE", "MET-CYCLE-TIME", "MET-CI-FAILURE-RATE"]) {
      expect(entries[id]?.definitionRef).toEqual(definitionRef);
    }
  });

  test("the evidence still records its scoped basis when the numbers coincide", async () => {
    const data = await report(
      makeMetricsCase({
        label: "basis-coincide",
        baseline: baselineDocument({
          rows: [{ ...CI_ROW, value: 2 / 3 }, CEREMONY_ROW, CYCLE_ROW],
          window: BASELINE_WINDOW,
        }),
      }),
    );
    const entry = entriesById(data)["MET-CI-FAILURE-RATE"];
    expect(entry?.basis).toBe("committed-pm-notes-corpus");
    expect(entry?.measurementKind).toBe("proxy");
    expect(counter(entry, "n")).toBe(3);
  });
});

describe("TC-METRICS-015 a partial log classifies only the missing row as row-absent", () => {
  test("the entry set stays complete and the missing row carries no value or definition", async () => {
    const data = await report(
      makeMetricsCase({ label: "partial-log", baseline: partialBaseline("MET-CYCLE-TIME") }),
    );
    const entries = entriesById(data);
    const cycle = entries["MET-CYCLE-TIME"];
    expect(cycle?.status).toBe("UNAVAILABLE");
    expect(cycle?.value).toBeUndefined();
    expect(cycle?.definitionRef).toBeUndefined();
    expect(String(cycle?.limitation)).toContain("Row-absent");
    expect(entries["MET-CEREMONY-SHARE"]?.value).toBeDefined();
    expect(entries["MET-CI-FAILURE-RATE"]?.value).toBeDefined();
    expect((data.metrics as readonly unknown[]).length).toBe(4);
    expect(data.omitted).toBe(0);
  });

  test("a log carrying only the excluded row leaves all three consumed entries row-absent", async () => {
    const data = await report(
      makeMetricsCase({ label: "only-fourth-row", baseline: falseSignalOnlyBaseline() }),
    );
    const entries = entriesById(data);
    for (const id of ["MET-CEREMONY-SHARE", "MET-CYCLE-TIME", "MET-CI-FAILURE-RATE"]) {
      expect(entries[id]?.status).toBe("UNAVAILABLE");
      expect(entries[id]?.value).toBeUndefined();
      expect(entries[id]?.definitionRef).toBeUndefined();
    }
    expect((data.metrics as readonly { id: string }[]).map((entry) => entry.id)).not.toContain(
      "MET-FALSE-SIGNAL-INCIDENTS",
    );
  });
});

describe("TC-METRICS-016 the fourth log row is not surfaced", () => {
  test("the payload carries no false-signal entry and no quota-shaped key", async () => {
    const data = await report(
      makeMetricsCase({
        label: "fourth-row",
        baseline: baselineDocument({
          rows: [CEREMONY_ROW, CYCLE_ROW, CI_ROW, { ...FALSE_SIGNAL_ROW, value: 4 }],
        }),
      }),
    );
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("MET-FALSE-SIGNAL");
    expect(serialized.toLowerCase()).not.toContain("quota");
    expect((data.metrics as readonly unknown[]).length).toBe(4);
  });

  test("the log document is byte-unchanged by the exclusion", async () => {
    const fixture = makeMetricsCase({ label: "fourth-row-bytes" });
    fixtures.push(fixture);
    const before = documentText(fixture, "doc/planning/oss-tooling/measurement-baseline.yaml");
    expect(before).toBe(defaultBaseline());
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(0);
    const after = documentText(fixture, "doc/planning/oss-tooling/measurement-baseline.yaml");
    expect(after).toBe(before);
    expect(METRICS_REF).toBe("GH-299");
  });
});

describe("TC-METRICS-010 the real committed log is readable from the tree", () => {
  const root = resolve(import.meta.dir, "../..");
  const realLog = (): string => readFileSync(resolve(root, BASELINE_RELATIVE), "utf8");
  const realFs = {
    exists: (path: string) => existsSync(path),
    readText: (path: string) => readFileSync(path, "utf8"),
  };

  test("the adapter classifies the committed measurement-baseline.yaml as present", () => {
    const read = readMetricsBaselineLog({ projectRoot: root, fs: realFs });
    expect(read.ok).toBe(true);
    if (!read.ok || read.state !== "present") throw new Error("real log not present");
    expect(read.document.rows.map((row) => row.id)).toEqual([
      "MET-CEREMONY-SHARE",
      "MET-CYCLE-TIME",
      "MET-CI-FAILURE-RATE",
      "MET-FALSE-SIGNAL-INCIDENTS",
    ]);
    // The real per-change exclusion rows are counted per closed reason.
    const cycle = read.document.rows.find((row) => row.id === "MET-CYCLE-TIME");
    expect(cycle?.excluded).toEqual([{ reason: "missing_metric_input", count: 3 }]);
  });

  test("a report over the real committed log renders at exit 0", async () => {
    const fixture = makeMetricsCase({ label: "real-baseline", baseline: realLog() });
    fixtures.push(fixture);
    const machine = await runMetrics(fixture, ["metrics", "--json"]);
    expect(machine.exitCode).toBe(0);
    expect(machine.envelope?.error).toBeUndefined();
    const data = machine.envelope?.data as Record<string, unknown>;
    expect((data.metrics as readonly { id: string }[]).map((entry) => entry.id)).toEqual([
      "MET-CEREMONY-SHARE",
      "MET-CYCLE-TIME",
      "MET-CI-FAILURE-RATE",
      "escaped-defects",
    ]);
    expect(
      (data.metrics as readonly { definitionRef?: unknown }[])[0]?.definitionRef,
    ).toBeDefined();
    const human = await runMetrics(fixture, ["metrics"]);
    expect(human.exitCode).toBe(0);
    expect(human.human).toContain("metrics — delivery metrics");
    expect(human.human).toContain("MET-CYCLE-TIME");
  });
});

describe("the baseline adapter tolerates the legacy exclusion counter shape", () => {
  test("a `{reason, count}` row validates, keeps its count, and a zero count is dropped", () => {
    const read = readDocument("legacy-counters", legacyCounterBaseline());
    expect(read.ok).toBe(true);
    if (!read.ok || read.state !== "present") throw new Error("legacy log not present");
    const ci = read.document.rows.find((row) => row.id === "MET-CI-FAILURE-RATE");
    expect(ci?.excluded).toEqual([{ reason: "no_ci_observation", count: 7 }]);
  });

  test("a report over the legacy shape renders at exit 0 with basis-scoped exclusions", async () => {
    const data = await report(
      makeMetricsCase({ label: "legacy-counters-report", baseline: legacyCounterBaseline() }),
    );
    const entry = entriesById(data)["MET-CI-FAILURE-RATE"];
    expect(entry?.value).toBeCloseTo(2 / 3, 10);
    // The legacy counter is the log's listing, never the entry's evaluated basis.
    expect(entry?.excluded).toEqual([
      { reason: "outside_window", count: 1 },
      { reason: "no_ci_observation", count: 1 },
    ]);
  });
});
