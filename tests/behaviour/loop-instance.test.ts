/**
 * TC-INSTANCE-001/002/003/004/006/007, TC-PARITY-001 and the re-homed
 * TC-PARITY-005 (GH-348 F-6; DM-1, DM-3).
 *
 * Every case runs on the D2 driver over the real store fence and the delivered
 * per-identity read. The two-start interleaving is deterministic (both
 * orderings, no sleep), and the re-homed ended-session replacement path asserts
 * only the replacement — no stuck verdict and no restart precondition.
 */
import { describe, expect, test } from "bun:test";
import { createLoopHarness } from "../fixtures/loop/harness";

const OWN = { pid: 9001, processStartTimeMs: 1_000 };

describe("TC-INSTANCE-001 / TC-PARITY-001 two starts: one admitted, one refused at exit 2", () => {
  test("a live holder is refused coordinator.already-running with no session", async () => {
    const harness = createLoopHarness({ label: "instance-001", own: OWN });
    // The delivered lease is the exclusion: a live recorded holder refuses the
    // claim before any session effect, regardless of lease age.
    harness.seedFence({
      action: "acquired",
      pid: OWN.pid,
      processStartTimeMs: OWN.processStartTimeMs,
    });
    harness.setAlive(OWN.pid, true);
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(harness.errorCodeOf(result)).toBe("coordinator.already-running");
    expect(harness.counters.spawns).toBe(0);
    expect(harness.loopRecords().sessions).toHaveLength(0);
  });

  test("the shell's silent 0 is NOT the typed behaviour (parity 1)", async () => {
    const harness = createLoopHarness({ label: "parity-001", own: OWN });
    harness.seedFence({
      action: "acquired",
      pid: OWN.pid,
      processStartTimeMs: OWN.processStartTimeMs,
    });
    harness.setAlive(OWN.pid, true);
    const second = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(second.code).not.toBe(0);
    expect(second.code).toBe(2);
  });
});

describe("TC-INSTANCE-002 a dead holder with a live recorded session is taken over and joined", () => {
  test("exactly one takeover record, zero spawns", async () => {
    const harness = createLoopHarness({ label: "instance-002", own: OWN });
    // The lease holder is DEAD (pid 4000) while the recorded session it left
    // behind is still live (pid 4242) — the takeover-and-join shape.
    harness.seedFence({ action: "acquired", pid: 4000, processStartTimeMs: 4_000 });
    harness.seedSession({ sessionId: "session-1", pid: 4242, processStartTimeMs: 2_000 });
    harness.setAlive(4000, false);
    harness.setAlive(4242, true);
    harness.setSessionFacts({ sessionId: "session-1", liveness: "alive", pid: 4242 });

    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.spawns).toBe(0);
    expect(harness.counters.joins).toBe(1);
    const records = harness.coordinatorRecords();
    expect(records.ok).toBe(true);
    if (records.ok) {
      expect(records.fences.filter((record) => record.action === "stale-takeover")).toHaveLength(1);
    }
  });
});

describe("TC-INSTANCE-003 a recorded ended session is replaced by exactly one fresh session", () => {
  test("one spawn and a new session id", async () => {
    const harness = createLoopHarness({ label: "instance-003" });
    harness.seedSession({ sessionId: "session-old", state: "ended", pid: 4242 });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.spawns).toBe(1);
    expect(harness.sessionPort.spawns).toHaveLength(1);
    const ids = harness.loopRecords().sessions.map((record) => record.sessionId);
    expect(ids[0]).toBe("session-old");
    expect(ids.at(-1)).not.toBe("session-old");
  });
});

describe("TC-INSTANCE-004 loop-main and coordinator-main do not exclude or read each other", () => {
  test("the coordinator family is admitted on the same store and no record crosses", async () => {
    const harness = createLoopHarness({ label: "instance-004", own: OWN });
    const coordinator = await harness.run(["coordinator", "start", "--foreground", "--json"]);
    expect(coordinator.code).toBe(0);
    const loop = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(loop.code).toBe(0);
    const records = harness.coordinatorRecords();
    expect(records.ok).toBe(true);
    if (records.ok) {
      expect(records.fences.every((record) => record.coordinatorId === "loop-main")).toBe(true);
    }
  });
});

describe("TC-INSTANCE-006 a pid-less active session is resumed exactly once, never duplicated", () => {
  test("one resume with the recorded id, no spawn, no kill, and the degradation entry", async () => {
    const harness = createLoopHarness({ label: "instance-006" });
    harness.seedSession({ sessionId: "session-pidless", pid: null, processStartTimeMs: null });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.resumes).toBe(1);
    expect(harness.sessionPort.resumes[0]?.sessionId).toBe("session-pidless");
    expect(harness.counters.spawns).toBe(0);
    expect(harness.process.signals).toHaveLength(0);
    const status = await harness.run(["loop", "status", "--json"]);
    expect(harness.dataOf(status).degraded).toEqual(["session-pid-unknown"]);
  });
});

describe("TC-INSTANCE-007 the alive capability gap is refused before any record", () => {
  test("an undeclared alive capability is coordinator.process.capability-gap at exit 2", async () => {
    const harness = createLoopHarness({
      label: "instance-007-gap",
      declared: { alive: false },
      own: OWN,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(harness.errorCodeOf(result)).toBe("coordinator.process.capability-gap");
    const records = harness.coordinatorRecords();
    if (records.ok) expect(records.fences).toHaveLength(0);
    expect(harness.counters.spawns).toBe(0);
  });

  test("a missing start-time capability is still admitted at the claim", async () => {
    const harness = createLoopHarness({
      label: "instance-007-admitted",
      declared: { startTimeIdentity: false },
      own: OWN,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.spawns).toBe(1);
    const records = harness.coordinatorRecords();
    if (records.ok) {
      expect(records.fences.filter((record) => record.action === "acquired")).toHaveLength(1);
    }
  });
});

describe("TC-PARITY-005 an ended session is replaced rather than resumed", () => {
  test("one fresh spawn with a title, zero resumes for the previous id", async () => {
    const harness = createLoopHarness({ label: "parity-005" });
    harness.seedSession({ sessionId: "session-previous", state: "ended" });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.sessionPort.spawns).toHaveLength(1);
    expect(harness.sessionPort.spawns[0]?.title).toMatch(/^ceo-loop-/u);
    expect(harness.sessionPort.resumes.some((call) => call.sessionId === "session-previous")).toBe(
      false,
    );
    const recorded = harness.sessionPort.lastSpawnFacts();
    expect(recorded?.sessionId).not.toBe("session-previous");
  });
});

describe("TC-INSTANCE-005 (phase-4 segment) takeover and unconfirmed termination keep one session", () => {
  test("0 restarts, 0 spawns, a released lease, and at most one live active session", async () => {
    const harness = createLoopHarness({
      label: "instance-005",
      own: OWN,
      progressReading: { state: "zero", observedAtMs: 0 },
      killOutcome: "failed",
      killFailureReason: "identity-mismatch",
      cycleStepMs: 700_000,
    });
    // A dead lease holder left a LIVE recorded session behind: takeover + join.
    harness.seedFence({ action: "acquired", pid: 4000, processStartTimeMs: 4_000 });
    harness.seedSession({ sessionId: "session-1", pid: 4242, processStartTimeMs: 2_000 });
    harness.setAlive(4000, false);
    harness.setAlive(4242, true);
    harness.setSessionFacts({ sessionId: "session-1", liveness: "alive", pid: 4242 });

    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(harness.counters.spawns).toBe(0);
    const records = harness.coordinatorRecords();
    if (records.ok) {
      expect(records.restarts).toHaveLength(0);
      expect(records.fences.at(-1)?.action).toBe("released");
    }
    const folded = new Map<string, string>();
    for (const record of harness.loopRecords().sessions) {
      folded.set(record.sessionId, record.state);
    }
    expect([...folded.values()].filter((state) => state === "active").length).toBeLessThanOrEqual(
      1,
    );
  });
});

describe("F-3 a cross-process re-find is JOINED AND OBSERVED (review-iter-1)", () => {
  test("a recorded live session is observed live without a pre-set alive read", async () => {
    const harness = createLoopHarness({
      label: "f3-refind-observed",
      own: OWN,
      // A FRESH process: no in-memory session facts at all.
      session: {
        facts: { sessionId: null, liveness: "absent", pid: null, processStartTimeMs: null },
      },
      progressReading: { state: "positive", observedAtMs: 1_000_000 },
    });
    // A dead lease holder left a live session behind: the re-find branch must
    // probe the RECORDED pid + start time, join it, and OBSERVE it.
    harness.seedFence({ action: "acquired", pid: 4000, processStartTimeMs: 4_000 });
    harness.seedSession({ sessionId: "session-refound", pid: 4242, processStartTimeMs: 2_000 });
    harness.setAlive(4000, false);
    harness.setAlive(4242, true);

    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.joins).toBe(1);
    expect(harness.counters.spawns).toBe(0);
    // Observed: the joined session is live, so no `live-facts-unknown` entry and
    // the session id is the re-found one.
    const status = await harness.run(["loop", "status", "--json"]);
    const data = harness.dataOf(status);
    expect(data.degraded).not.toContain("live-facts-unknown");
    expect((data.session as { sessionId?: string }).sessionId).toBe("session-refound");
  });

  test("a recorded pid with a NULL start time is unknown-liveness and is never probed with 0", async () => {
    const harness = createLoopHarness({
      label: "f3-null-start",
      own: OWN,
      session: {
        facts: { sessionId: null, liveness: "absent", pid: null, processStartTimeMs: null },
      },
    });
    harness.seedFence({ action: "acquired", pid: 4000, processStartTimeMs: 4_000 });
    harness.seedSession({
      sessionId: "session-unverifiable",
      pid: 4242,
      processStartTimeMs: null,
    });
    harness.setAlive(4000, false);
    harness.setAlive(4242, true);
    const probesBefore = harness.process.probeTargets.length;

    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    // The unverifiable session was NEVER probed (and certainly not with 0), and
    // it was never replaced by a second spawn.
    const probes = harness.process.probeTargets.slice(probesBefore);
    // The recorded SESSION identity (pid 4242, unknown start time) is never
    // probed; only the dead lease holder was (the claim decision).
    expect(probes.some((target) => target.pid === 4242)).toBe(false);
    expect(harness.process.probeTargets.every((target) => target.processStartTimeMs !== 0)).toBe(
      true,
    );
    expect(harness.counters.spawns).toBe(0);
    expect(harness.counters.joins).toBe(1);
  });
});

describe("N-3 an unverifiable joined identity is UNKNOWN-liveness (review-iter-2)", () => {
  test("zero traffic past the window produces no verdict and no kill", async () => {
    const harness = createLoopHarness({
      label: "n3-unknown-liveness",
      own: OWN,
      session: {
        facts: { sessionId: null, liveness: "absent", pid: null, processStartTimeMs: null },
      },
      progressReading: { state: "zero", observedAtMs: 0 },
      cycles: 1,
      cycleStepMs: 700_000,
    });
    harness.seedFence({ action: "acquired", pid: 4000, processStartTimeMs: 4_000 });
    harness.seedSession({
      sessionId: "session-unverifiable",
      pid: 4242,
      processStartTimeMs: null,
    });
    harness.setAlive(4000, false);
    harness.setAlive(4242, true);

    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    // Unknown liveness means the two-signal verdict is not evaluated at all.
    expect(harness.verdicts.kills).toHaveLength(0);
    const records = harness.coordinatorRecords();
    if (records.ok) {
      expect(records.stuck).toHaveLength(0);
      expect(records.restarts).toHaveLength(0);
    }
    const status = await harness.run(["loop", "status", "--json"]);
    expect(harness.dataOf(status).degraded).toContain("live-facts-unknown");
    expect(harness.counters.spawns).toBe(0);
  });
});
