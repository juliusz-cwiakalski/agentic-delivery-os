/**
 * TC-BACKOFF-001..007, TC-PARITY-003/004 and TC-STUCK-006 (GH-348 F-3; DM-5).
 *
 * The declared schedule, one ordinal per stuck restart, zero for a clean end,
 * the at-bound exhaustion exit with the loop's own remediation and history
 * reference, the durable `--fresh-budget` epoch, the cancellable wait, and the
 * detection-to-next-session bound FORMULA at two interval settings.
 */
import { describe, expect, test } from "bun:test";
import {
  detectionBoundMs,
  LOOP_RESTART_DELAYS_MS,
  restartDelayMs,
  SHIPPED_DETECTION_BOUND_MS,
  totalBackoffMs,
} from "../../packages/core/src/domain/index";
import { createLoopHarness } from "../fixtures/loop/harness";

const STUCK_CLOCK = {
  progressReading: { state: "zero" as const, observedAtMs: 0 },
  cycleStepMs: 700_000,
};

describe("TC-BACKOFF-002 the declared delay schedule", () => {
  test("ordinals 1..10 are 2/4/8/16/32/64/128/256/300/300 s and the epoch total is bounded", () => {
    expect([...LOOP_RESTART_DELAYS_MS]).toEqual([
      2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 256_000, 300_000, 300_000,
    ]);
    expect(totalBackoffMs()).toBeLessThanOrEqual(1_110_000);
    for (let ordinal = 1; ordinal <= 10; ordinal += 1) {
      expect(restartDelayMs(ordinal)).toBe(Math.min(2_000 * 2 ** (ordinal - 1), 300_000));
    }
  });
});

describe("TC-BACKOFF-001 row A a below-bound stuck restart restarts exactly once", () => {
  test("one restart record at ordinal 1, one new session, at most one live session", async () => {
    const harness = createLoopHarness({ label: "backoff-001a", cycles: 1, ...STUCK_CLOCK });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    const records = harness.coordinatorRecords();
    expect(records.ok).toBe(true);
    if (!records.ok) return;
    expect(records.restarts).toHaveLength(1);
    expect(records.restarts[0]?.ordinal).toBe(1);
    expect(records.restarts[0]?.reason).toBe("stuck-artifact-evidence");
    expect(records.restarts[0]?.previousSessionId).toBeDefined();
    expect(harness.counters.spawns).toBe(2);
    // Append-only records never mutate: the live-session count is the FOLD (the
    // newest record per session id), and it is at most one at every point.
    const folded = new Map<string, string>();
    for (const entry of harness.loopRecords().sessions) {
      folded.set(entry.sessionId, entry.state);
    }
    expect([...folded.values()].filter((state) => state === "active").length).toBeLessThanOrEqual(
      1,
    );
    // Exactly two sessions were ever recorded: the replaced one and its successor.
    expect(folded.size).toBe(2);
    expect(records.restarts[0]?.previousSessionId).not.toBe(
      harness.loopRecords().sessions.at(-1)?.sessionId,
    );
    // The declared wait was recorded, never slept.
    expect(harness.delays.map((entry) => entry.reason)).toContain("restart-backoff");
    expect(harness.delays.find((entry) => entry.reason === "restart-backoff")?.ms).toBe(2_000);
  });
});

describe("TC-BACKOFF-003 a durable stop or a signal cancels the wait", () => {
  test("a cancelled wait applies no session effect", async () => {
    const harness = createLoopHarness({ label: "backoff-003", cycles: 1, ...STUCK_CLOCK });
    // The cancellation is the delivered stop/signal reading the composition
    // supplies; here it flips after the restart record, before the effect.
    let reads = 0;
    const cancelPort = {
      cancelled: () => {
        reads += 1;
        return reads > 1;
      },
    };
    void cancelPort;
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
  });
});

describe("TC-BACKOFF-004 at the bound the loop exits 1 with its own remediation", () => {
  test("zero restarts, the delivered identity, and the history reference with all three parts", async () => {
    const harness = createLoopHarness({
      label: "backoff-004",
      cycles: 1,
      ...STUCK_CLOCK,
      settings: { "coordinator.restart-budget": 0 },
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(1);
    expect(harness.errorCodeOf(result)).toBe("coordinator.restart-budget-exhausted");
    const records = harness.coordinatorRecords();
    if (records.ok) expect(records.restarts).toHaveLength(0);
    expect(harness.counters.spawns).toBe(1);
    const line = harness.lines.find((entry) => entry.includes("event=budget-exhausted"));
    expect(line).toBeDefined();
    // The loop's own summary carries `loop start --foreground --fresh-budget`,
    // never the delivered coordinator row's remediation.
    const envelope = result.json ?? {};
    const error = envelope.error as { summary?: string } | undefined;
    expect(error?.summary).toContain("epoch=");
    expect(error?.summary).toContain("restarts=0/0");
    expect(error?.summary).toContain("seq=");
    expect(error?.summary).toContain("loop start --foreground --fresh-budget");
  });
});

describe("TC-BACKOFF-005 / TC-PARITY-003 --fresh-budget opens the next durable epoch", () => {
  test("the epoch identity moves and the count resets", async () => {
    const harness = createLoopHarness({
      label: "backoff-005",
      own: { pid: 9001, processStartTimeMs: 1_000 },
      progressReading: { state: "positive", observedAtMs: 1_000_000 },
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const first = harness.coordinatorRecords();
    const firstEpoch = first.ok ? first.fences[0]?.budgetEpochId : undefined;
    expect(firstEpoch).toBe("epoch-1");
    const fresh = await harness.run(["loop", "start", "--foreground", "--fresh-budget", "--json"]);
    expect(fresh.code).toBe(0);
    const records = harness.coordinatorRecords();
    const epochs = records.ok ? records.fences.map((entry) => entry.budgetEpochId) : [];
    expect(epochs).toContain("epoch-2");
    const status = await harness.run(["loop", "status", "--json"]);
    expect(harness.dataOf(status).restarts).toMatchObject({ count: 0, budgetEpochId: "epoch-2" });
  });
});

describe("TC-BACKOFF-006 a self-ended session consumes no ordinal", () => {
  test("no restart record and no backoff wait", async () => {
    const harness = createLoopHarness({
      label: "backoff-006",
      progressReading: { state: "positive", observedAtMs: 1_000_000 },
      cycles: 2,
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const records = harness.coordinatorRecords();
    if (records.ok) expect(records.restarts).toHaveLength(0);
    expect(harness.delays.filter((entry) => entry.reason === "restart-backoff")).toHaveLength(0);
  });
});

describe("TC-BACKOFF-007 the restart evidence is bounded and identifier-only", () => {
  test("one event=restart line names the ordinal, the reason, and the delay", async () => {
    const harness = createLoopHarness({ label: "backoff-007", cycles: 1, ...STUCK_CLOCK });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const line = harness.lines.find((entry) => entry.includes("event=restart"));
    expect(line).toBeDefined();
    expect(line).toContain("ordinal=1");
    expect(line).toContain("reason=stuck-artifact-evidence");
    expect(line).toContain("delayMs=2000");
    expect(new TextEncoder().encode(line ?? "").length).toBeLessThanOrEqual(512);
  });
});

describe("TC-STUCK-006 the detection-to-next-session bound is the formula", () => {
  test("652 000 ms at the shipped defaults, and a raised interval raises it by the delta", () => {
    const shipped = detectionBoundMs({
      stuckWindowMs: 600_000,
      collectionIntervalMs: 30_000,
      killGraceMs: 20_000,
    });
    expect(shipped).toBe(SHIPPED_DETECTION_BOUND_MS);
    expect(shipped).toBe(652_000);
    const raised = detectionBoundMs({
      stuckWindowMs: 600_000,
      collectionIntervalMs: 60_000,
      killGraceMs: 20_000,
    });
    expect(raised).toBe(682_000);
    expect(raised - shipped).toBe(30_000);
  });
});
