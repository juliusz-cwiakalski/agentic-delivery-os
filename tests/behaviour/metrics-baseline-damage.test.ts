/**
 * TC-METRICS-014 — a present-but-unparseable or invalid baseline log is
 * `metrics.baseline-unreadable` at exit 2 with no partial report; damage is
 * never re-projected as absence and the log is never repaired.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { damageDocuments, fullBaseline } from "../fixtures/metrics/baseline";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { documentText, type MetricsFixture, runMetrics } from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

describe("TC-METRICS-014 damaged canonical data is visible at exit 2", () => {
  const classes = damageDocuments();

  for (const [label, document] of Object.entries(classes)) {
    test(`${label} refuses metrics.baseline-unreadable with no partial report`, async () => {
      const fixture = makeMetricsCase({ label: `damage-${label}`, baseline: document });
      fixtures.push(fixture);
      const before = documentText(fixture, "doc/planning/oss-tooling/measurement-baseline.yaml");
      const run = await runMetrics(fixture, ["metrics", "--json"]);
      expect(run.exitCode).toBe(2);
      expect(run.envelope?.error?.code).toBe("metrics.baseline-unreadable");
      expect(run.envelope?.error?.category).toBe("platform");
      expect(run.envelope?.error?.retryable).toBe(false);
      expect(run.envelope?.error?.consequence).toBe("not_landed");
      const data = run.envelope?.data;
      expect(data).toBeUndefined();
      const serialized = JSON.stringify(run.envelope);
      expect(serialized).not.toContain("UNAVAILABLE");
      expect(serialized).not.toContain("row-absent");
      const after = documentText(fixture, "doc/planning/oss-tooling/measurement-baseline.yaml");
      expect(after).toBe(before);
    });
  }

  test("the valid control renders at exit 0 in the same fixture shape", async () => {
    const fixture = makeMetricsCase({ label: "damage-control", baseline: fullBaseline() });
    fixtures.push(fixture);
    const run = await runMetrics(fixture, ["metrics", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(run.envelope?.data).toBeDefined();
  });
});

describe("TC-METRICS-013 an absent baseline log is row-absent evidence at exit 0", () => {
  test("the report renders, the entries carry no value, and the control carries one", async () => {
    const absent = makeMetricsCase({ label: "absent-log" });
    fixtures.push(absent);
    absent.removeBaseline();
    const absentRun = await runMetrics(absent, ["metrics", "--json"]);
    expect(absentRun.exitCode).toBe(0);
    expect(absentRun.envelope?.error).toBeUndefined();
    const data = absentRun.envelope?.data as Record<string, unknown>;
    const entries = Object.fromEntries(
      (data.metrics as readonly Record<string, unknown>[]).map((entry) => [entry.id, entry]),
    );
    for (const id of ["MET-CEREMONY-SHARE", "MET-CYCLE-TIME", "MET-CI-FAILURE-RATE"]) {
      expect(entries[id]?.status, id).toBe("UNAVAILABLE");
      expect(entries[id]?.value, id).toBeUndefined();
      expect(entries[id]?.definitionRef, id).toBeUndefined();
      expect(String(entries[id]?.limitation), id).toContain("Row-absent");
    }
    expect(entries["escaped-defects"]?.status).toBe("UNAVAILABLE");
    expect((data.dispatch as { telemetryState: string }).telemetryState).toBe("present");
    expect((data.alarmEvaluation as { status: string }).status).toBe("evaluated");
    expect(JSON.stringify(absentRun.envelope)).not.toContain("metrics.baseline-unreadable");

    const control = makeMetricsCase({ label: "absent-log-control" });
    fixtures.push(control);
    const controlRun = await runMetrics(control, ["metrics", "--json"]);
    const controlData = controlRun.envelope?.data as Record<string, unknown>;
    const controlEntries = Object.fromEntries(
      (controlData.metrics as readonly Record<string, unknown>[]).map((entry) => [entry.id, entry]),
    );
    expect(controlEntries["MET-CYCLE-TIME"]?.value).toBe(7);
    expect(controlEntries["MET-CYCLE-TIME"]?.definitionRef).toBeDefined();
  });
});
