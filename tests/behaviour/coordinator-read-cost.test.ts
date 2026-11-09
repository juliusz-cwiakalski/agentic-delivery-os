/**
 * TC-COORD-088 (read-cost and bounds half) — one verified state read per tick,
 * machine data <= 64 KiB, and human text <= 32 lines.
 */
import { describe, expect, test } from "bun:test";
import {
  COORDINATOR_MAX_DATA_BYTES,
  COORDINATOR_MAX_HUMAN_LINES,
} from "../../packages/core/src/contracts/index";
import { createCoordinatorHarness, seedRestart } from "../fixtures/coordinator/harness";

describe("TC-COORD-088 read cost and output bounds", () => {
  test("a tick performs exactly one verified state read", async () => {
    const harness = createCoordinatorHarness({
      label: "read-cost",
      session: { liveness: "alive" },
    });
    for (let ordinal = 1; ordinal <= 5; ordinal += 1) seedRestart(harness, { ordinal });
    const before = harness.counters.reads;
    await harness.run(["coordinator", "tick", "--json"]);
    expect(harness.counters.reads - before).toBe(1);
  });

  test("a status performs exactly one verified state read", async () => {
    const harness = createCoordinatorHarness({ label: "read-cost-status" });
    const before = harness.counters.reads;
    await harness.run(["coordinator", "status", "--json"]);
    expect(harness.counters.reads - before).toBe(1);
  });

  test("machine data stays within 64 KiB", async () => {
    const harness = createCoordinatorHarness({
      label: "bounds-data",
      session: { liveness: "alive" },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    const data = (result.json as { data?: unknown }).data;
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
      COORDINATOR_MAX_DATA_BYTES,
    );
  });

  test("human text stays within 32 lines", async () => {
    const harness = createCoordinatorHarness({ label: "bounds-human" });
    const result = await harness.run(["coordinator", "status"]);
    const lines = result.stdout.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeLessThanOrEqual(COORDINATOR_MAX_HUMAN_LINES);
  });
});
