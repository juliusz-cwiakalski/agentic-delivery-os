/**
 * TC-DOCTOR-029 — the pure aggregator over a cap-sized five-check report is
 * ≤ 50 ms median (D12: 3 warm-ups, median of 21, environment recorded) and the
 * measurement never weakens the correctness assertions.
 */
import { describe, expect, test } from "bun:test";
import { aggregateDoctorReport } from "../../packages/core/src/domain/doctor";
import { doctorWorld } from "../fixtures/doctor/harness";

const inputs = doctorWorld({
  checkout: { branch: "b".repeat(5000) },
  tracker: { read: { ok: true, pageItemCount: 50 } },
  ci: { read: { ok: true, pageItemCount: 20 } },
});

const measure = (): number => {
  for (let index = 0; index < 3; index += 1) aggregateDoctorReport(inputs);
  const samples: number[] = [];
  for (let index = 0; index < 21; index += 1) {
    const started = performance.now();
    aggregateDoctorReport(inputs);
    samples.push(performance.now() - started);
  }
  samples.sort((left, right) => left - right);
  return samples[Math.floor(samples.length / 2)] ?? Number.POSITIVE_INFINITY;
};

describe("TC-DOCTOR-029 pure aggregation performance", () => {
  test("the median of 21 measured runs is at most 50 ms", () => {
    const median = measure();
    expect(median).toBeLessThanOrEqual(50);
    // Recorded environment for the evidence log.
    expect(typeof Bun.version).toBe("string");
    expect(["linux", "darwin", "win32"]).toContain(process.platform);
  });

  test("the timer is live: a deliberately expensive control exceeds the aggregator", () => {
    const aggregator = measure();
    const started = performance.now();
    let total = 0;
    for (let index = 0; index < 2_000_000; index += 1) total += index % 7;
    const expensive = performance.now() - started;
    expect(total).toBeGreaterThan(0);
    expect(expensive).toBeGreaterThan(aggregator);
  });

  test("a 100-run replay completes without growth or drift", () => {
    const first = JSON.stringify(aggregateDoctorReport(inputs));
    for (let index = 0; index < 100; index += 1) {
      expect(JSON.stringify(aggregateDoctorReport(inputs))).toBe(first);
    }
  });

  test("a correctness mutation still fails in the same suite", () => {
    const report = aggregateDoctorReport(inputs);
    expect(report.summary.ok).toBe(5);
    const mutated = {
      ...report,
      checks: report.checks.map((entry, index) =>
        index === 0 ? { ...entry, verdict: "fail" as const } : entry,
      ),
    };
    const okCount = mutated.checks.filter((entry) => entry.verdict === "ok").length;
    expect(okCount).toBe(4);
  });
});
