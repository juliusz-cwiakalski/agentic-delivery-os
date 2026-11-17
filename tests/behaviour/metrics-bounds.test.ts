/**
 * TC-METRICS-063 (cap half) and TC-METRICS-104 — the per-array row caps count
 * every omission without truncating the measurement; the full byte/human cap
 * matrix lands with the phase-8 honesty battery.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeMetricsCase } from "../fixtures/metrics/case";
import type { EvidenceInput } from "../fixtures/metrics/corpus";
import {
  DAY_MS,
  entriesById,
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  reportOf,
  runMetrics,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const at = (daysAgo: number): string => new Date(METRICS_NOW_MS - daysAgo * DAY_MS).toISOString();

const incidentCase = (count: number): MetricsFixture => {
  const rows: EvidenceInput[] = Array.from({ length: count }, (_, index) => ({
    path: `doc/changes/2026-11/x/review/incident-${String(index)}.md`,
    anchor: `INCIDENT-${String(index)}`,
    class: "post-gate-review" as const,
    observedAt: at((index % 10) + 1),
    ref: METRICS_REF,
  }));
  const fixture = makeMetricsCase({ label: `bounds-incidents-${String(count)}`, evidence: rows });
  fixtures.push(fixture);
  for (let index = 0; index < count; index += 1) {
    fixture.project.set(
      `doc/changes/2026-11/x/review/incident-${String(index)}.md`,
      `INCIDENT-${String(index)} cited\n`,
    );
  }
  return fixture;
};

describe("TC-METRICS-063/104 the incidents row cap counts its omissions", () => {
  test("two, eight, and eleven incidents render 2, 8, and 8 rows with counted drops", async () => {
    const expectations: readonly (readonly [number, number, number, boolean])[] = [
      [2, 2, 0, false],
      [8, 8, 0, false],
      [11, 8, 3, true],
    ];
    for (const [count, rows, omitted, truncated] of expectations) {
      const fixture = incidentCase(count);
      const run = await runMetrics(fixture, ["metrics", "--json"]);
      const data = reportOf(run);
      expect(data.omitted, `count ${String(count)}`).toBe(omitted);
      expect(data.truncated, `count ${String(count)}`).toBe(truncated);
      const entry = entriesById(data)["escaped-defects"];
      const incidents = entry?.incidents;
      expect(Array.isArray(incidents) ? incidents.length : 0).toBe(rows);
      expect(entry?.value).toBe(count);
    }
  });

  test("the dropped incidents are not counted twice and the total is untouched", async () => {
    const fixture = incidentCase(11);
    const data = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const entry = entriesById(data)["escaped-defects"];
    const incidents = entry?.incidents;
    expect(data.omitted).toBe(Array.isArray(incidents) && incidents.length === 0 ? 11 : 3);
    const sample = (entry?.sample ?? {}) as Record<string, number>;
    expect(sample.n).toBe(11);
    const human = (await runMetrics(fixture, ["metrics"])).human;
    expect(human).toContain("truncated");
  });
});
