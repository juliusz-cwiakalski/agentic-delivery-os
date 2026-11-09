/**
 * TC-COORD-013 — `status [--live]` reports the full state (persisted stuck,
 * `tickVerdict: null`) and degrades honestly.
 */
import { describe, expect, test } from "bun:test";
import {
  createCoordinatorHarness,
  dataOf,
  seedStuckVerdict,
} from "../fixtures/coordinator/harness";

describe("TC-COORD-013 status reports the full state and never mutates", () => {
  test("a fresh state dir reports a stopped coordinator with the declared schema", async () => {
    const harness = createCoordinatorHarness({ label: "status-fresh" });
    const result = await harness.run(["coordinator", "status", "--json"]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    expect(data.schemaVersion).toBe("delivery.coordinator.v1");
    expect(data.instance).toBeNull();
    expect(data.tickVerdict).toBeNull();
    expect(data.escalation.state).toBe("not-exhausted");
    expect(data.regime.supervisorMode).toBe("foreground");
    expect(data.regime.externalUnit).toBe("absent");
    expect(data.regime.daemonInstallSeam).toBe("M1-S18");
  });

  test("status never mutates state and performs no evaluation", async () => {
    const harness = createCoordinatorHarness({ label: "status-readonly" });
    await harness.run(["coordinator", "status", "--json"]);
    const before = harness.records();
    if (!before.ok) throw new Error("read failed");
    expect(before.verifiedEmpty).toBe(true);
    const second = await harness.run(["coordinator", "status", "--json"]);
    expect(second.code).toBe(0);
    expect(harness.driver.boundaries).toBe(0);
    expect(harness.process.progressReads).toBe(0);
  });

  test("status reports the persisted stuck verdict with tickVerdict null", async () => {
    const harness = createCoordinatorHarness({ label: "status-stuck" });
    seedStuckVerdict(harness);
    const result = await harness.run(["coordinator", "status", "--json"]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    expect(data.stuck).not.toBeNull();
    expect(data.stuck?.verdict).toBe("stuck");
    expect(data.stuck?.phase).toBe("verdict");
    expect(data.stuck?.reason).toBe("stuck-artifact-evidence");
    expect(data.stuck?.evidence.length).toBeGreaterThan(0);
    expect(data.tickVerdict).toBeNull();
  });

  test("a running supervisor is reported from the lease fold", async () => {
    const harness = createCoordinatorHarness({
      label: "status-running",
      alive: { 9001: true },
      session: { liveness: "alive" },
    });
    const ticked = await harness.run(["coordinator", "tick", "--json"]);
    expect(ticked.code).toBe(0);
    const status = await harness.run(["coordinator", "status", "--json"]);
    expect(status.code).toBe(0);
    const data = dataOf(status);
    expect(data.instance).toBeNull();
    expect(data.fence?.action).toBe("released");
    expect(data.restarts.count).toBe(0);
  });

  test("--live declares unknown rather than fabricating live facts", async () => {
    const harness = createCoordinatorHarness({ label: "status-live" });
    harness.process.setAlive(4242, null);
    const result = await harness.run(["coordinator", "status", "--live", "--json"]);
    expect(result.code).toBe(0);
    const data = dataOf(result);
    expect(data.degradation).toContain("live-facts-unknown");
  });

  test("the human status block is deterministic, bounded, and ANSI-free", async () => {
    const harness = createCoordinatorHarness({ label: "status-text" });
    const result = await harness.run(["coordinator", "status"]);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("\u001b[");
    expect(result.stdout.split("\n").length).toBeLessThanOrEqual(32);
    expect(result.stdout).toContain("coordinator coordinator-main");
  });

  test("a tick populates tickVerdict while status keeps it null", async () => {
    const harness = createCoordinatorHarness({ label: "status-split" });
    const ticked = await harness.run(["coordinator", "tick", "--json"]);
    expect(ticked.code).toBe(0);
    expect(dataOf(ticked).tickVerdict).not.toBeNull();
    const status = await harness.run(["coordinator", "status", "--json"]);
    expect(dataOf(status).tickVerdict).toBeNull();
  });
});
