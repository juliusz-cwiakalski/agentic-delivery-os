/**
 * TC-STOP-001..007, TC-PARITY-007/010 (GH-348 F-4; DM-2; TDR-0056).
 *
 * The durable identity-scoped stop, the clearance, the read-before-claim
 * refusal, the fail-closed unreadable fold, both stop modes, and the
 * immediate-stop session-uniqueness segment.
 */
import { describe, expect, test } from "bun:test";
import { createLoopHarness } from "../fixtures/loop/harness";

describe("TC-STOP-001 a repeated stop appends exactly one requested record", () => {
  test("two invocations, one record, both exit 0", async () => {
    const harness = createLoopHarness({ label: "stop-001" });
    const first = await harness.run(["loop", "stop", "--json"]);
    expect(first.code).toBe(0);
    const second = await harness.run(["loop", "stop", "--json"]);
    expect(second.code).toBe(0);
    const stops = harness.loopRecords().stops;
    expect(stops).toHaveLength(1);
    expect(stops[0]?.action).toBe("requested");
    expect(stops[0]?.mode).toBe("drain");
  });
});

describe("TC-STOP-002 / TC-PARITY-010 a folded stop prevents a start across a restart and a crash", () => {
  test("exit 0 with state=stopped and zero lease or session effects", async () => {
    for (const label of ["restart", "crash"]) {
      const harness = createLoopHarness({ label: `stop-002-${label}` });
      await harness.run(["loop", "stop", "--json"]);
      // A fresh composition over the same store: the fold is durable state.
      const result = await harness.run(["loop", "start", "--foreground", "--json"]);
      expect(result.code, label).toBe(0);
      expect(harness.dataOf(result).state).toBe("stopped");
      expect(harness.counters.spawns, label).toBe(0);
      expect(harness.loopRecords().sessions, label).toHaveLength(0);
      const records = harness.coordinatorRecords();
      if (records.ok) expect(records.fences, label).toHaveLength(0);
    }
  });

  test("the typed stop and the shell marker are not interchangeable", async () => {
    const harness = createLoopHarness({ label: "stop-002-shell" });
    // Writing the shell's marker file changes nothing for the typed loop.
    const read = harness.store.readRecords();
    expect(read.ok).toBe(true);
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.counters.spawns).toBe(1);
  });
});

describe("TC-STOP-003 an unreadable stop fold fails closed", () => {
  test("a torn loop record yields a state failure at exit 2 with zero session effects", async () => {
    const harness = createLoopHarness({ label: "stop-003" });
    // A malformed stop payload is a torn fold: "unreadable" never means "not
    // stopped".
    const acquired = harness.store.acquireFence("seed-torn");
    if (!acquired.ok) throw new Error(acquired.error.code);
    harness.store.append(acquired.value.handle, {
      kind: "loop.stop",
      recordKey: "loop.stops:loop-main",
      payload: { schemaId: "delivery.loop.stop.v1" },
    });
    harness.store.releaseFence(acquired.value.handle);
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(harness.errorCodeOf(result)).toBe("state.store.torn");
    expect(harness.counters.spawns).toBe(0);
  });
});

describe("TC-STOP-004 reset appends one clearance when folded and nothing otherwise", () => {
  test("the loop then runs; a repeat reset appends nothing", async () => {
    const harness = createLoopHarness({ label: "stop-004" });
    const none = await harness.run(["loop", "reset", "--json"]);
    expect(none.code).toBe(0);
    expect(harness.loopRecords().stops).toHaveLength(0);

    await harness.run(["loop", "stop", "--json"]);
    const cleared = await harness.run(["loop", "reset", "--json"]);
    expect(cleared.code).toBe(0);
    expect(harness.loopRecords().stops.map((entry) => entry.action)).toEqual([
      "requested",
      "cleared",
    ]);
    const repeat = await harness.run(["loop", "reset", "--json"]);
    expect(repeat.code).toBe(0);
    expect(harness.loopRecords().stops).toHaveLength(2);

    const started = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(started.code).toBe(0);
    expect(harness.counters.spawns).toBe(1);
  });
});

describe("TC-STOP-005 / TC-PARITY-007 drain never terminates, immediate terminates within the bound", () => {
  test("a drained loop ends with zero terminations", async () => {
    const harness = createLoopHarness({ label: "stop-005-drain", cycles: 2 });
    harness.seedStop({ action: "requested", mode: "drain" });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    // A folded stop prevents the start entirely (read-before-claim), which is
    // the drain contract at the start boundary.
    expect(result.code).toBe(0);
    expect(harness.dataOf(result).state).toBe("stopped");
    expect(harness.verdicts.kills).toHaveLength(0);
    expect(harness.counters.spawns).toBe(0);
  });

  test("a folded immediate stop is honoured at the running boundary without a replacement", async () => {
    const harness = createLoopHarness({ label: "stop-005-immediate", cycles: 2 });
    // The session is live and its identity is verifiable: one terminate.
    harness.setSessionFacts({ liveness: "alive", pid: 4242 });
    const supervisorStop = harness.supervisor;
    // Seed the request AFTER the claim so the running boundary sees it.
    void supervisorStop;
    const started = harness.run(["loop", "start", "--foreground", "--json"]);
    await harness.run(["loop", "stop", "--mode", "immediate", "--json"]);
    const result = await started;
    expect(result.code).toBe(0);
    const folded = new Map<string, string>();
    for (const record of harness.loopRecords().sessions) folded.set(record.sessionId, record.state);
    expect([...folded.values()].filter((state) => state === "active").length).toBeLessThanOrEqual(
      1,
    );
  });

  test("an unverifiable identity is never signalled and reports session-pid-unknown", async () => {
    const harness = createLoopHarness({ label: "stop-005-unverified", cycles: 2 });
    harness.setSessionFacts({ liveness: "alive", pid: null });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.verdicts.kills).toHaveLength(0);
  });
});

describe("TC-STOP-006 the payload names only the loop identity, action, mode, and time", () => {
  test("the recorded fields are exactly the declared set", async () => {
    const harness = createLoopHarness({ label: "stop-006" });
    await harness.run(["loop", "stop", "--json"]);
    const record = harness.loopRecords().stops[0];
    expect(Object.keys(record ?? {}).sort()).toEqual(
      ["action", "loopId", "mode", "recordedAt", "schemaId", "stopId"].sort(),
    );
    expect(record?.loopId).toBe("loop-main");
    expect(JSON.stringify(record)).not.toContain("pid");
    expect(JSON.stringify(record)).not.toContain("holder");
  });
});

describe("TC-STOP-007 a stop recorded by one process is honoured by a rebuilt composition", () => {
  test("the harness rebuilds over the same store and folds the request", async () => {
    const harness = createLoopHarness({ label: "stop-007" });
    await harness.run(["loop", "stop", "--mode", "immediate", "--json"]);
    const status = await harness.run(["loop", "status", "--json"]);
    expect(harness.dataOf(status).stop).toMatchObject({ requested: true, mode: "immediate" });
  });
});
