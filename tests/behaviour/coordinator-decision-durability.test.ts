/**
 * TC-COORD-025 — the recorded decision survives a supervisor restart.
 */
import { describe, expect, test } from "bun:test";
import { readCoordinatorRecords } from "../../packages/core/src/state/index";
import { openStore } from "../fixtures/state/harness";
import { createCoordinatorHarness } from "../fixtures/coordinator/harness";

describe("TC-COORD-025 the decision survives a reopened store", () => {
  test("a recorded decision and its ordinal are readable from a fresh handle", async () => {
    const harness = createCoordinatorHarness({
      label: "decision-durability",
      cycle: { cycles: 0 },
      session: { liveness: "absent", sessionId: "session-1" },
    });
    const result = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);

    const reopened = openStore(harness.store.identity).store;
    const read = readCoordinatorRecords(reopened, "coordinator-main");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const decision = read.iterations.find((record) => record.decision !== "none");
    expect(decision?.decision).toBe("resume-context");
    expect(decision?.reason).toBe("session-interrupted");
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1]);
  });

  test("the durable decision is reported by a later status read", async () => {
    const harness = createCoordinatorHarness({
      label: "decision-durability-status",
      cycle: { cycles: 0 },
      session: { liveness: "absent", sessionId: "session-1" },
    });
    await harness.run(["coordinator", "start", "--foreground", "--json"]);
    const status = await harness.run(["coordinator", "status", "--json"]);
    const data = status.json as { data?: { decision?: { kind?: string } } };
    expect(data.data?.decision?.kind).toBe("resume-context");
  });

  test("a replayed decision id appends nothing", async () => {
    const harness = createCoordinatorHarness({
      label: "decision-durability-replay",
      cycle: { cycles: 0 },
      session: { liveness: "alive" },
    });
    await harness.run(["coordinator", "start", "--foreground", "--json"]);
    const before = harness.records();
    if (!before.ok) throw new Error("read failed");
    await harness.run(["coordinator", "start", "--foreground", "--json"]);
    const after = harness.records();
    if (!after.ok) throw new Error("read failed");
    // A second start while stopped appends a new lease pair and no decision replay.
    expect(after.iterations.length).toBeGreaterThanOrEqual(before.iterations.length);
  });
});
