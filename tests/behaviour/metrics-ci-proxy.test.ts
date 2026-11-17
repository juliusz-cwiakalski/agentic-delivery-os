/**
 * TC-METRICS-024/025 — the CI failure rate is a session-level proxy recomputed
 * under the committed definition over the committed corpus; unobserved rows are
 * excluded and counted, never assumed green.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { committedPath } from "../fixtures/metrics/corpus";
import {
  DAY_MS,
  entriesById,
  METRICS_NOW_MS,
  type MetricsFixture,
  runMetrics,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const ciEntry = async (fixture: MetricsFixture): Promise<Record<string, unknown>> => {
  fixtures.push(fixture);
  const run = await runMetrics(fixture, ["metrics", "--json"]);
  expect(run.exitCode).toBe(0);
  return entriesById(run.envelope?.data as Record<string, unknown>)["MET-CI-FAILURE-RATE"] ?? {};
};

const at = (daysAgo: number): string => new Date(METRICS_NOW_MS - daysAgo * DAY_MS).toISOString();

describe("TC-METRICS-024 the proxy is recomputed under the committed definition", () => {
  test("six observed with one red and one mixed yields 2/6 over the observed denominator", async () => {
    const entry = await ciEntry(
      makeMetricsCase({
        label: "ci-proxy",
        ci: [
          { ref: "GH-1", observed: true, outcome: "red", observedAt: at(1) },
          { ref: "GH-2", observed: true, outcome: "mixed", observedAt: at(2) },
          { ref: "GH-3", observed: true, outcome: "green", observedAt: at(3) },
          { ref: "GH-4", observed: true, outcome: "green", observedAt: at(4) },
          { ref: "GH-5", observed: true, outcome: "green", observedAt: at(5) },
          { ref: "GH-6", observed: true, outcome: "green", observedAt: at(6) },
          { ref: "GH-7", observed: false, outcome: null, observedAt: at(7) },
          { ref: "GH-8", observed: false, outcome: null, observedAt: at(8) },
          { ref: "GH-9", observed: false, outcome: null, observedAt: at(9) },
          { ref: "GH-10", observed: false, outcome: null, observedAt: at(10) },
          { ref: "GH-11", observed: false, outcome: null, observedAt: at(11) },
          { ref: "GH-12", observed: true, outcome: "red", observedAt: at(200) },
          { ref: "GH-13", observed: true, outcome: "red", observedAt: at(201) },
        ],
      }),
    );
    expect(entry.measurementKind).toBe("proxy");
    expect(entry.basis).toBe("committed-pm-notes-corpus");
    expect(Number(entry.value)).toBeCloseTo(2 / 6, 12);
    expect(String(entry.limitation)).toContain("session-level proxy");
    expect(String(entry.limitation)).toContain("not a per-run");
    expect(entry.excluded).toContainEqual({ reason: "outside_window", count: 2 });
    expect(entry.excluded).toContainEqual({ reason: "no_ci_observation", count: 5 });
    expect(Number(entry.value)).not.toBe(0.25);
  });

  test("a date-only row is excluded with its closed reason", async () => {
    const entry = await ciEntry(
      makeMetricsCase({
        label: "ci-date-only",
        ci: [
          { ref: "GH-1", observed: true, outcome: "red", observedAt: at(1) },
          {
            ref: "GH-2",
            path: committedPath("date-only.md"),
            observed: true,
            outcome: "green",
            observedAt: null,
          },
        ],
      }),
    );
    expect(Number(entry.value)).toBe(1);
    expect(entry.excluded).toContainEqual({ reason: "date_only_or_missing_time", count: 1 });
  });
});

describe("TC-METRICS-025 unobserved rows are excluded and never assumed green", () => {
  test("two observed and nine unobserved uses the observed denominator only", async () => {
    const entry = await ciEntry(
      makeMetricsCase({
        label: "ci-2-of-11",
        ci: [
          { ref: "GH-1", observed: true, outcome: "red", observedAt: at(1) },
          { ref: "GH-2", observed: true, outcome: "green", observedAt: at(2) },
          ...Array.from({ length: 9 }, (_, index) => ({
            ref: `GH-${String(index + 10)}`,
            observed: false,
            outcome: null,
            observedAt: at(index + 3),
          })),
        ],
      }),
    );
    expect((entry.sample as { n: number }).n).toBe(2);
    expect(Number(entry.value)).toBeCloseTo(1 / 2, 12);
    expect(entry.excluded).toContainEqual({ reason: "no_ci_observation", count: 9 });
  });

  test("an all-unobserved population is UNAVAILABLE with sample.n == 0, never a perfect score", async () => {
    const entry = await ciEntry(
      makeMetricsCase({
        label: "ci-all-unobserved",
        ci: Array.from({ length: 11 }, (_, index) => ({
          ref: `GH-${String(index + 1)}`,
          observed: false,
          outcome: null,
          observedAt: at(index + 1),
        })),
      }),
    );
    expect(entry.status).toBe("UNAVAILABLE");
    expect(entry.value).toBeUndefined();
    expect((entry.sample as { n: number }).n).toBe(0);
    expect(String(entry.limitation)).toContain("never assumed green");
  });

  test("an unobserved row's absence changes neither numerator nor denominator", async () => {
    const nineObserved = Array.from({ length: 9 }, (_, index) => ({
      ref: `GH-${String(index + 1)}`,
      observed: true,
      outcome: index === 8 ? ("red" as const) : ("green" as const),
      observedAt: at(index + 1),
    }));
    const withUnobserved = await ciEntry(
      makeMetricsCase({
        label: "ci-9-plus-1",
        ci: [...nineObserved, { ref: "GH-99", observed: false, outcome: null, observedAt: at(20) }],
      }),
    );
    const withoutUnobserved = await ciEntry(makeMetricsCase({ label: "ci-9", ci: nineObserved }));
    expect(Number(withUnobserved.value)).toBeCloseTo(Number(withoutUnobserved.value), 12);
    expect((withUnobserved.sample as { n: number }).n).toBe(9);
    expect(Number(withUnobserved.value)).toBeCloseTo(1 / 9, 12);
  });
});
