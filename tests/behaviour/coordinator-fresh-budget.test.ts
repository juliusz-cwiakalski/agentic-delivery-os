/**
 * TC-COORD-016 / TC-COORD-054 — `--fresh-budget` is a start-time option that
 * requires a stopped supervisor and opens a new epoch while history remains.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  dataOf,
  errorCodeOf,
  seedLease,
  seedRestart,
} from "../fixtures/coordinator/harness";

const withRestarts = (label: string) => {
  const harness = createCoordinatorHarness({
    label,
    cycle: { cycles: 0 },
    session: { liveness: "alive" },
  });
  for (let ordinal = 1; ordinal <= 3; ordinal += 1) seedRestart(harness, { ordinal });
  return harness;
};

describe("TC-COORD-016 --fresh-budget requires a stopped supervisor", () => {
  test("a live supervisor refuses the fresh-budget start", async () => {
    const harness = createCoordinatorHarness({
      label: "fresh-live",
      alive: { 4242: true },
      cycle: { cycles: 0 },
    });
    seedLease(harness, { action: "acquired", recordedAt: harness.clock.nowIso() });
    const result = await harness.run([
      "coordinator",
      "start",
      "--foreground",
      "--fresh-budget",
      "--json",
    ]);
    expect(result.code).toBe(2);
    expect(errorCodeOf(result)).toBe("coordinator.already-running");
  });

  test("the flag is only accepted on start", async () => {
    for (const argv of [
      ["coordinator", "stop", "--fresh-budget"],
      ["coordinator", "status", "--fresh-budget"],
      ["coordinator", "tick", "--fresh-budget"],
    ]) {
      const harness = createCoordinatorHarness({ label: "fresh-grammar" });
      const result = await harness.run([...argv, "--json"]);
      expect(result.code, argv.join(" ")).toBe(1);
      expect(errorCodeOf(result)).toBe("fallback.invocation");
    }
  });
});

describe("TC-COORD-054 --fresh-budget opens a new epoch and preserves history", () => {
  test("the new epoch starts at count 0 while the old epoch remains", async () => {
    const harness = withRestarts("fresh-budget");
    const result = await harness.run([
      "coordinator",
      "start",
      "--foreground",
      "--fresh-budget",
      "--json",
    ]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    expect(data.restarts.budgetEpochId).toBe("epoch-2");
    expect(data.restarts.count).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.restarts.filter((record) => record.budgetEpochId === "epoch-1")).toHaveLength(3);
  });

  test("the fresh epoch survives a later status, tick, and start (F-02 durability)", async () => {
    const harness = withRestarts("fresh-budget-durable");
    const started = dataOf(
      await harness.run(["coordinator", "start", "--foreground", "--fresh-budget", "--json"]),
    );
    expect(started.restarts.budgetEpochId).toBe("epoch-2");
    expect(started.restarts.count).toBe(0);

    const status = dataOf(await harness.run(["coordinator", "status", "--json"]));
    expect(status.restarts.budgetEpochId).toBe("epoch-2");
    expect(status.restarts.count).toBe(0);
    expect(`${status.restarts.count}/${status.restarts.bound}`).not.toBe("10/10");

    const ticked = dataOf(await harness.run(["coordinator", "tick", "--json"]));
    expect(ticked.restarts.budgetEpochId).toBe("epoch-2");
    expect(ticked.restarts.count).toBe(0);

    const restarted = dataOf(await harness.run(["coordinator", "start", "--foreground", "--json"]));
    expect(restarted.restarts.budgetEpochId).toBe("epoch-2");
    expect(restarted.restarts.count).toBe(0);
  });

  test("an exhausted epoch and its escalation remain after a fresh budget", async () => {
    const harness = createCoordinatorHarness({
      label: "fresh-budget-history",
      cycle: { cycles: 0 },
      session: { liveness: "alive" },
    });
    for (let ordinal = 1; ordinal <= 10; ordinal += 1) seedRestart(harness, { ordinal });
    await harness.run(["coordinator", "start", "--foreground", "--fresh-budget", "--json"]);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.restarts.filter((record) => record.budgetEpochId === "epoch-1")).toHaveLength(10);
  });
});
