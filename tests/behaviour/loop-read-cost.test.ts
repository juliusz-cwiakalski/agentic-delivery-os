/**
 * TC-CONTRACT-003 (GH-348 AC-F1-5, NFR-11): one evaluation read per cycle, and
 * zero extra appends or writes for the read-only verbs.
 */
import { describe, expect, test } from "bun:test";
import { createLoopHarness } from "../fixtures/loop/harness";

describe("TC-CONTRACT-003 read economy", () => {
  test("status and log append nothing and add no durable record", async () => {
    const harness = createLoopHarness({ label: "read-cost" });
    const before = harness.counters.appends;
    for (let index = 0; index < 3; index += 1) {
      await harness.run(["loop", "status", "--json"]);
      await harness.run(["loop", "log", "--json"]);
      await harness.run(["loop", "reset", "--json"]);
    }
    expect(harness.counters.appends).toBe(before);
    expect(harness.loopRecords().stops).toHaveLength(0);
  });

  test("a supervision run performs a bounded number of store reads", async () => {
    const harness = createLoopHarness({
      label: "read-cost-cycles",
      cycles: 4,
      progressReading: { state: "positive", observedAtMs: 1_000_000 },
    });
    const before = harness.counters.snapshots;
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const snapshots = harness.counters.snapshots - before;
    // Four fixed reads (the stop preflight, the claim, the session resolution,
    // the final projection) plus exactly ONE evaluation snapshot per cycle —
    // never one read per record or per verb.
    expect(snapshots).toBe(4 + 4);
    expect(snapshots).toBeGreaterThan(0);
  });
});
