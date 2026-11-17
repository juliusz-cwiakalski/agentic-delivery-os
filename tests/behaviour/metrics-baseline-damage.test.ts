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
