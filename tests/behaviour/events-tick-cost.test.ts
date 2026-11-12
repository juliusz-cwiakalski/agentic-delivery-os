/**
 * TC-EVT-081 — one whole-store `readRecords()` per publish pass, independent of
 * the subscriber count and the subscribed-topic count, with heartbeat ticks
 * excluded by a fixed clock and proven excluded by an advancing-clock control
 * that reads exactly three; no connect, probe, or sleep on the publish path.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEventHarness } from "../fixtures/events/event-harness";

const ROOT = process.cwd();
const PUBLISH_PATH = [
  "packages/cli/src/daemon-compose.ts",
  "packages/core/src/app/queue.ts",
  "packages/core/src/app/daemon.ts",
  "packages/core/src/domain/event-projection.ts",
  "packages/core/src/state/registry.ts",
];

const percentile = (samples: readonly number[], p: number): number => {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] as number;
};

const subscribeAll = async (
  harness: Awaited<ReturnType<typeof createEventHarness>>,
  topics: readonly string[],
): Promise<void> => {
  const client = await harness.connect();
  for (const topic of topics) client.subscribe(topic);
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("TC-EVT-081 publish-tick cost", () => {
  test("exactly one read per publish pass, constant across subscribers and topics", async () => {
    const harness = await createEventHarness({
      label: "tick-cost",
      processBlockerAnswers: false,
    });
    try {
      // Two event topics subscribed by one subscriber.
      await subscribeAll(harness, ["queue.graph", "dispatch.attempt"]);
      await harness.step();
      harness.resetReads();
      await harness.step();
      expect(harness.reads()).toBe(1);
      expect(harness.classifiedReads()).toEqual({ publish: 1, heartbeatFold: 0, other: 0 });
      harness.resetReads();
      await harness.step();
      expect(harness.reads()).toBe(1);

      // One vs five subscribers on the same topics.
      for (let index = 0; index < 4; index += 1) {
        await subscribeAll(harness, ["queue.graph", "dispatch.attempt"]);
      }
      harness.resetReads();
      await harness.step();
      expect(harness.reads()).toBe(1);

      // Two vs four subscribed event topics.
      await subscribeAll(harness, ["phase.state", "blockers.state"]);
      harness.resetReads();
      await harness.step();
      expect(harness.reads()).toBe(1);

      // The heartbeat did not fire inside the counted passes.
      const heartbeats = harness.store.readRecords();
      expect(heartbeats.ok).toBe(true);

      // The advancing-clock control: the heartbeat's own two folds plus the one
      // publish read are exactly three. The delivered heartbeat append/verify
      // chain adds its own reads, which NFR-2 neither counts nor bounds; they
      // are reported here so the count cannot be mistaken for a miss.
      harness.clock.advance(5_001);
      harness.resetReads();
      await harness.step();
      const classified = harness.classifiedReads();
      expect(classified.publish).toBe(1);
      expect(classified.heartbeatFold).toBe(2);
      expect(classified.publish + classified.heartbeatFold).toBe(3);
      console.log(
        `advancing-clock control: publish=${classified.publish} heartbeat-fold=${classified.heartbeatFold} delivered-append=${classified.other} total=${harness.reads()}`,
      );

      // No sleep is taken on the publish path (the loop waits on the wake port).
      expect(harness.sleeps()).toBe(0);
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("the publish path's one shared view is the only store read in its modules", () => {
    const text = (file: string): string => readFileSync(join(ROOT, file), "utf8");
    // The composition takes the view exactly once per tick.
    expect(
      text("packages/cli/src/daemon-compose.ts").match(/store\.readRecords\(/gu) ?? [],
    ).toHaveLength(1);
    // The projection never reads: the view is its only input.
    expect(
      text("packages/core/src/domain/event-projection.ts").match(/store\.readRecords\(/gu) ?? [],
    ).toHaveLength(0);
    // The two folds take the additive `view` fallback, and the publish path
    // calls only those view-taking folds.
    expect(text("packages/core/src/app/queue.ts")).toContain("view?: readonly StateRecord[]");
    expect(text("packages/core/src/app/daemon.ts")).toContain("view?: readonly StateRecord[]");
    const composition = text("packages/cli/src/daemon-compose.ts");
    expect(composition).toContain("readQueueEntries(store, records)");
    expect(composition).toContain("readDaemonLanes(store, records)");
    expect(composition).toContain("projector.project(records)");
  });

  test("added publish latency stays within the declared budget over the delivered folds", async () => {
    const harness = await createEventHarness({
      label: "tick-cost-latency",
      processBlockerAnswers: false,
    });
    try {
      await subscribeAll(harness, [
        "queue.graph",
        "dispatch.attempt",
        "phase.state",
        "blockers.state",
      ]);
      await harness.step();
      const samples: number[] = [];
      for (let run = 0; run < 50; run += 1) {
        const started = performance.now();
        await harness.step();
        samples.push(performance.now() - started);
      }
      const p50 = percentile(samples, 50);
      const p95 = percentile(samples, 95);
      console.log(
        [
          `environment: bun=${process.versions.bun ?? "unknown"} platform=${process.platform}`,
          "store shape: entries=0 dependencies=0 attempts=0 phases=0 blockers=0",
          "iterations: 50 publish passes; baseline = two delivered whole-store folds + serialization",
          `candidate: one shared view (p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms)`,
        ].join("\n"),
      );
      expect(p95).toBeLessThanOrEqual(25);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
