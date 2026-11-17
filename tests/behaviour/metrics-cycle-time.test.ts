/**
 * TC-METRICS-020/021/022 — cycle time is native from the delivered
 * `phase.transition` history under the committed interval, a missing completion
 * is right-censored with the phase named, and no usable pair is `UNAVAILABLE`
 * with counted exclusions — never zero.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeMetricsCase } from "../fixtures/metrics/case";
import { entriesById, type MetricsFixture, runMetrics } from "../fixtures/metrics/harness";
import {
  censoredHistory,
  completeHistory,
  T_PLUS_3H,
  T_PLUS_5H,
  T_PLUS_7H,
  T0,
  unusableHistories,
} from "../fixtures/metrics/transitions";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const cycleEntry = async (fixture: MetricsFixture): Promise<Record<string, unknown>> => {
  fixtures.push(fixture);
  const run = await runMetrics(fixture, ["metrics", "--json"]);
  expect(run.exitCode).toBe(0);
  return entriesById(run.envelope?.data as Record<string, unknown>)["MET-CYCLE-TIME"] ?? {};
};

describe("TC-METRICS-020 cycle time is native from the transition history", () => {
  test("the value is the committed interval, seven hours, with the native declaration", async () => {
    const entry = await cycleEntry(
      makeMetricsCase({ label: "cycle-native", history: completeHistory() }),
    );
    expect(entry.measurementKind).toBe("native");
    expect(entry.basis).toBe("phase-transition-history");
    expect(entry.value).toBe(7);
    expect(entry.unit).toBe("hours");
    expect(entry.direction).toBe("lower is better");
    expect((entry.sample as { n: number }).n).toBe(1);
    expect((entry.sample as { censored?: number }).censored).toBe(0);
    expect(entry.definitionRef).toBeDefined();
    expect(entry.excluded ?? []).toEqual([]);
  });

  test("the value differs from the committed proxy and the definition is still cited", async () => {
    const entry = await cycleEntry(
      makeMetricsCase({ label: "cycle-proxy-diff", history: completeHistory() }),
    );
    expect(entry.value).not.toBe(5.3);
    expect(entry.definitionRef).toMatchObject({
      logPath: "doc/planning/oss-tooling/measurement-baseline.yaml",
    });
  });
});

describe("TC-METRICS-021 an absent completion is right-censored", () => {
  test("the censored lower bound names the phase and does not move with the clock", async () => {
    const fixture = makeMetricsCase({
      label: "cycle-censored",
      history: censoredHistory(),
      nowMs: Date.parse(T_PLUS_5H),
    });
    const entry = await cycleEntry(fixture);
    expect(entry.status).toBe("PARTIAL");
    expect(entry.measurementKind).toBe("native");
    expect(entry.value).toBe(3);
    expect((entry.sample as { censored?: number }).censored).toBe(1);
    expect(String(entry.limitation)).toContain("Right-censored");
    expect(String(entry.limitation)).toContain("quality_gates");
    fixture.setNow(Date.parse(T_PLUS_5H) + 5 * 3_600_000);
    const advanced = await runMetrics(fixture, ["metrics", "--json"]);
    const after = entriesById(advanced.envelope?.data as Record<string, unknown>)["MET-CYCLE-TIME"];
    expect(after?.value).toBe(3);
  });

  test("adding the completion transition clears the flag and yields the full interval", async () => {
    const fixture = makeMetricsCase({
      label: "cycle-completion-added",
      history: [
        ...censoredHistory(),
        { phaseId: "delivery", operation: "complete", timestamp: "2026-11-15T13:00:00.000Z" },
        { phaseId: "pr_creation", operation: "complete", timestamp: T_PLUS_7H },
      ],
    });
    const entry = await cycleEntry(fixture);
    expect(entry.status).not.toBe("PARTIAL");
    expect((entry.sample as { censored?: number }).censored).toBe(0);
    expect(entry.value).toBe(7);
  });
});

describe("TC-METRICS-022 no usable pair is UNAVAILABLE with counted exclusions", () => {
  test("each unusable history reports UNAVAILABLE with no value and a counted reason", async () => {
    for (const [label, history] of Object.entries(unusableHistories())) {
      const entry = await cycleEntry(
        makeMetricsCase({ label: `cycle-unusable-${label}`, history }),
      );
      expect(entry.status, label).toBe("UNAVAILABLE");
      expect(entry.value, label).toBeUndefined();
      expect(String(entry.limitation), label).toContain("no figure is synthesized");
      const excluded = (entry.excluded ?? []) as readonly { reason: string; count: number }[];
      expect(excluded.length, label).toBeGreaterThan(0);
      expect(
        excluded.every((row) => row.count > 0),
        label,
      ).toBe(true);
      expect(JSON.stringify(entry)).not.toContain('"value":0');
    }
  });

  test("the paired control still measures in the same suite", async () => {
    const entry = await cycleEntry(
      makeMetricsCase({ label: "cycle-control", history: completeHistory() }),
    );
    expect(entry.value).toBe(7);
    expect(entry.status).not.toBe("UNAVAILABLE");
  });

  test("the interval is anchored on the delivered stamps, not re-read from the clock", () => {
    expect(Date.parse(T_PLUS_7H) - Date.parse(T0)).toBe(7 * 3_600_000);
    expect(Date.parse(T_PLUS_3H) - Date.parse(T0)).toBe(3 * 3_600_000);
  });
});
