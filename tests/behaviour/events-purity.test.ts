/**
 * TC-EVT-015, TC-EVT-080 — every reference invocation is pure, deterministic,
 * inside the latency budget, and inside the human output bounds.
 */
import { describe, expect, test } from "bun:test";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";

const probe = createSurfaceHarness();
const FORMS: readonly (readonly string[])[] = [
  ["events", "list"],
  ["events", "list", "--json"],
  ["events", "describe", "queue.graph"],
  ["events", "describe", "queue.graph", "--json"],
];

const percentile = (samples: readonly number[], p: number): number => {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] as number;
};

describe("TC-EVT-015 reference-surface purity", () => {
  test("every form is byte-identical across twenty runs", async () => {
    for (const argv of FORMS) {
      const outputs = new Set<string>();
      const payloads = new Set<string>();
      for (let run = 0; run < 20; run += 1) {
        const result = await probe.run(argv);
        // The machine envelope carries the per-invocation runId and timing; the
        // surface itself is compared by its human bytes and its data payload.
        outputs.add(argv.includes("--json") ? JSON.stringify(result.data) : result.stdout);
        payloads.add(JSON.stringify(result.data));
      }
      expect(outputs.size, argv.join(" ")).toBe(1);
      expect(payloads.size, argv.join(" ")).toBe(1);
    }
  });

  test("the pure surface needs no environment: output is identical with and without one", async () => {
    const first = await probe.run(["events", "list"]);
    const saved = process.env.EXAMPLE_PRODUCT_STATE_DIR;
    delete process.env.EXAMPLE_PRODUCT_STATE_DIR;
    try {
      expect((await probe.run(["events", "list"])).stdout).toBe(first.stdout);
    } finally {
      if (saved !== undefined) process.env.EXAMPLE_PRODUCT_STATE_DIR = saved;
    }
  });
});

describe("TC-EVT-080 latency and output budgets", () => {
  test("p95 stays under 100 ms for every form and the measurement is recorded", async () => {
    const measurements: string[] = [];
    for (const argv of FORMS) {
      for (let warm = 0; warm < 5; warm += 1) await probe.run(argv);
      const samples: number[] = [];
      for (let run = 0; run < 50; run += 1) {
        const started = performance.now();
        await probe.run(argv);
        samples.push(performance.now() - started);
      }
      const p50 = percentile(samples, 50);
      const p95 = percentile(samples, 95);
      measurements.push(`${argv.join(" ")}: p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms`);
      expect(p95, argv.join(" ")).toBeLessThanOrEqual(100);
    }
    console.log(
      [
        `environment: bun=${process.versions.bun ?? "unknown"} platform=${process.platform} cpus=${navigator.hardwareConcurrency}`,
        "iterations: 5 warm-up + 50 measured per form",
        ...measurements,
      ].join("\n"),
    );
  });

  test("human pages stay inside 40 lines and 8 192 bytes; machine output inside its ceiling", async () => {
    for (const topic of ["queue.graph", "lanes"]) {
      const run = await probe.run(["events", "describe", topic]);
      expect(run.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
      expect(new TextEncoder().encode(run.stdout).length).toBeLessThanOrEqual(8_192);
    }
    const list = await probe.run(["events", "list"]);
    expect(list.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
    expect(new TextEncoder().encode(list.stdout).length).toBeLessThanOrEqual(8_192);
    const scripted = await createSurfaceHarness({ mode: "scripted" }).run([
      "events",
      "list",
      "--json",
    ]);
    expect(new TextEncoder().encode(scripted.stdout).length).toBeLessThanOrEqual(8_192);
  });
});
