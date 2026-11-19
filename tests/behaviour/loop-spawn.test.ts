/**
 * TC-SPAWN-001/002/003/005/006 and TC-PARITY-008 (GH-348 F-2; DM-1, DM-3).
 *
 * D2 only at this boundary (the ENTRYPOINT RULE, Option B): `loop` is not
 * prompt-required until the phase-7 repin, so no case here runs through
 * `runEntrypoint`; the D1 halves are labelled phase-7 re-observations.
 */
import { describe, expect, test } from "bun:test";
import { createLoopHarness } from "../fixtures/loop/harness";
import { loopParityCasesOf } from "../fixtures/loop/parity/cases";

const TITLE = /^ceo-loop-\d{8}-\d{6}$/u;

describe("TC-SPAWN-001 a fresh spawn renders the CEO identity and one fixed invocation", () => {
  test("exactly one spawn, one deterministic title, and a prompt that names the primitives", async () => {
    const harness = createLoopHarness({ label: "spawn-001" });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.sessionPort.spawns).toHaveLength(1);
    const spawn = harness.sessionPort.spawns[0];
    expect(spawn?.title).toMatch(TITLE);
    // The declared prompt names the primitives the CEO drives and no shell path.
    for (const primitive of ["dispatch", "merge", "queue", "closeout"]) {
      expect(spawn?.prompt).toContain(primitive);
    }
    expect(spawn?.prompt).not.toContain(".sh");
    expect(spawn?.prompt).not.toContain("scripts/");
    expect(harness.sessionPort.resumes).toHaveLength(0);
    // The registry declares the same scenario, so no row is expressed twice.
    const rows = loopParityCasesOf("spawn");
    expect(rows.some((row) => row.id === "spawn-fresh-identity")).toBe(true);
  });
});

describe("TC-SPAWN-002 exactly one deterministic title, and a resume carries none", () => {
  test("the title is ceo-loop-<UTC yyyymmdd-hhmmss>, at most 64 characters", async () => {
    const harness = createLoopHarness({ label: "spawn-002" });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const spawn = harness.sessionPort.spawns[0];
    expect(spawn?.title).toBe("ceo-loop-19700101-001640");
    expect((spawn?.title ?? "").length).toBeLessThanOrEqual(64);
    const sessions = harness.loopRecords().sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.title).toBe(spawn?.title);
    expect(sessions[0]?.state).toBe("active");
  });

  test("the resume effect carries the recorded session id and no title", () => {
    const harness = createLoopHarness({ label: "spawn-002-resume" });
    harness.seedSession({ sessionId: "session-9", state: "ended" });
    // The port's resume signature has no title member; the recorded title stays
    // on the acquisition record and is never re-sent.
    expect(harness.loopRecords().sessions[0]?.sessionId).toBe("session-9");
  });
});

describe("TC-SPAWN-003 each pre-session refusal is its delivered identity", () => {
  const rows = [
    { code: "provider.profile.invalid", expected: 1 },
    { code: "config.value.invalid", expected: 1 },
    { code: "harness.profile.model-unrepresentable", expected: 1 },
  ] as const;

  for (const row of rows) {
    test(`${row.code} refuses at exit ${String(row.expected)} with no session and a released lease`, async () => {
      const harness = createLoopHarness({
        label: `spawn-003-${row.code}`,
        session: { spawnFailure: row.code },
      });
      const result = await harness.run(["loop", "start", "--foreground", "--json"]);
      expect(result.code).toBe(row.expected);
      expect(harness.errorCodeOf(result)).toBe(row.code);
      expect(harness.loopRecords().sessions).toHaveLength(0);
      expect(harness.sessionPort.spawns).toHaveLength(1);
      const records = harness.coordinatorRecords();
      expect(records.ok).toBe(true);
      if (records.ok) {
        expect(records.fences.at(-1)?.action).toBe("released");
      }
    });
  }
});

describe("TC-SPAWN-005 the additive handle pid is filled when supplied and absent otherwise", () => {
  test("a pid-present adapter records the pid and its start time", async () => {
    const harness = createLoopHarness({
      label: "spawn-005-present",
      session: { spawnPid: 4242, spawnStartTimeMs: 2_000 },
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const record = harness.loopRecords().sessions[0];
    expect(record?.pid).toBe(4242);
    expect(record?.processStartTimeMs).toBe(2_000);
  });

  test("a pid-absent adapter records null, never 0, and reports session-pid-unknown", async () => {
    const harness = createLoopHarness({
      label: "spawn-005-absent",
      session: { spawnPid: null, spawnStartTimeMs: null },
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const record = harness.loopRecords().sessions[0];
    expect(record?.pid).toBeNull();
    expect(record?.processStartTimeMs).toBeNull();
    expect(record?.pid).not.toBe(0);
  });

  test("a recorded ACTIVE pid-less session reports session-pid-unknown on status", async () => {
    const harness = createLoopHarness({ label: "spawn-005-degraded" });
    harness.seedSession({ pid: null, processStartTimeMs: null, state: "active" });
    const status = await harness.run(["loop", "status", "--json"]);
    expect(status.code).toBe(0);
    expect(harness.dataOf(status).degraded).toEqual(["session-pid-unknown"]);
  });
});

describe("TC-SPAWN-006 the session record carries the declared facts once per acquisition", () => {
  test("the record has exactly the declared fields and one acquisition append", async () => {
    const harness = createLoopHarness({ label: "spawn-006", cycles: 3 });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const sessions = harness.loopRecords().sessions;
    // One append per acquisition and one per state change — never one per cycle.
    expect(sessions).toHaveLength(2);
    expect(sessions.map((entry) => entry.state)).toEqual(["active", "ended"]);
    const record = sessions[0];
    expect(Object.keys(record ?? {}).sort()).toEqual(
      [
        "acquiredAt",
        "harnessKind",
        "loopId",
        "pid",
        "processStartTimeMs",
        "recordedAt",
        "schemaId",
        "sessionId",
        "sessionRecordId",
        "state",
        "title",
      ].sort(),
    );
    expect(record?.schemaId).toBe("delivery.loop.session.v1");
    expect(record?.loopId).toBe("loop-main");
    expect(record?.state).toBe("active");
    // A quiet multi-cycle run appends no further session record.
    expect(harness.counters.spawns).toBe(1);
    expect(harness.counters.cycles).toBe(3);
  });
});

describe("TC-PARITY-008 no pre-iteration hook runs and no hook path is read", () => {
  test("the declared prompt carries no hook instruction and exactly one spawn occurs", async () => {
    const harness = createLoopHarness({ label: "parity-008" });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const prompt = harness.sessionPort.spawns[0]?.prompt ?? "";
    expect(prompt.toLowerCase()).not.toContain("hook");
    expect(prompt).not.toContain("pre-opencode-iteration");
    expect(harness.sessionPort.spawns).toHaveLength(1);
  });
});
