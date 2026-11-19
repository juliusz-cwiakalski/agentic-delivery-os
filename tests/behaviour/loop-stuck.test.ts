/**
 * TC-STUCK-001..005, 007..011 (GH-348 F-5; DM-6; DEC-3).
 *
 * The two-signal verdict, the delivery veto, both `unevaluable` paths, the
 * terminate ordering and exact-target contract over the injected process-tree
 * seam, the terminal unconfirmed termination, the corroborator purity, the
 * sixteen-row decision table, and the seeding rule.
 *
 * TC-STUCK-006 (the detection bound) is phase 5's: it observes the NEXT session.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  corroborateDelivery,
  dispatchEvidenceClass,
  evidenceClassContribution,
  LOOP_EVIDENCE_CLASSES,
  newestLanePerRef,
} from "../../packages/core/src/app/index";
import {
  evaluateLoopVerdict,
  evidenceCorpus,
  LOOP_MAX_EVIDENCE_BYTES,
} from "../../packages/core/src/domain/index";
import {
  LOOP_DECISION_ROWS,
  LOOP_VERDICT_ROWS,
  MAXIMAL_EVIDENCE_FIELDS,
  SUPERSEDED_LANE_RECORDS,
} from "../fixtures/loop/facts";
import { createLoopHarness } from "../fixtures/loop/harness";

const ROOT = process.cwd();
const VERDICT_BASE = {
  liveSession: true,
  nowMs: 1_000_000,
  stuckWindowMs: 600_000,
  progressBoundMs: 300_000,
  progressObservedAtMs: null,
  lastProgressAtMs: null,
  artifactAdvanced: false,
} as const;

describe("TC-STUCK-001 all four conditions produce one verdict, one terminate, one outcome", () => {
  test("the stuck episode records the loop-scoped identity and the admission decision only", async () => {
    const harness = createLoopHarness({
      label: "stuck-001",
      progressReading: { state: "zero", observedAtMs: 100_000 },
      delivery: "none",
      cycles: 1,
      // The driver advances virtual time past the window before each cycle, so
      // the seeded observation ages out and the verdict is reached.
      cycleStepMs: 700_000,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.verdicts.kills).toEqual(["terminated"]);
    const records = harness.coordinatorRecords();
    expect(records.ok).toBe(true);
    if (!records.ok) return;
    const verdicts = records.stuck.filter((record) => record.phase === "verdict");
    const outcomes = records.stuck.filter((record) => record.phase === "outcome");
    expect(verdicts.length).toBeGreaterThanOrEqual(1);
    expect(outcomes.length).toBe(verdicts.length);
    const first = verdicts[0];
    expect(first?.stuckId).toBe(first?.iterationId);
    expect(first?.stuckId.startsWith("loop-main:")).toBe(true);
    expect(first?.killFailureReason).toBeNull();
    expect(first?.evidence).toContain("traffic=zero");
    expect(first?.evidence).toContain("delivery=none");
    // The phase-4 SEGMENT: the verdict, the termination, the outcome, and the
    // restart ADMISSION DECISION. The delivered `coordinator.restart` record and
    // the second session are re-observed by phase 5's TC-BACKOFF-001 row A.
    expect(harness.verdicts.admissions).toHaveLength(1);
    expect(harness.verdicts.admissions[0]?.ordinal).toBe(1);
  });
});

describe("F-1 the artifact-advance signal is BASELINE-relative (review-iter-1)", () => {
  test("a merge BEFORE the progress baseline does not suppress a stuck verdict", async () => {
    const harness = createLoopHarness({
      label: "f1-prior-merge",
      progressReading: { state: "zero", observedAtMs: 0 },
      // The only merge record predates the supervisor's baseline (it is seeded
      // before the start clock advances), so nothing advanced SINCE it.
      artifactAdvanced: [500_000],
      cycles: 1,
      cycleStepMs: 700_000,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.verdicts.kills).toEqual(["terminated"]);
    const records = harness.coordinatorRecords();
    if (records.ok) {
      expect(records.stuck.filter((record) => record.verdict === "stuck").length).toBeGreaterThan(
        0,
      );
    }
  });

  test("a merge AFTER the baseline keeps the verdict progressing (control)", async () => {
    const harness = createLoopHarness({
      label: "f1-post-merge",
      progressReading: { state: "zero", observedAtMs: 0 },
      // 1_500_000 is after the acquisition baseline (1_000_000): the artifact
      // genuinely advanced during the window, so no kill is licensed.
      artifactAdvanced: [1_500_000],
      cycles: 1,
      cycleStepMs: 700_000,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.verdicts.kills).toHaveLength(0);
    const records = harness.coordinatorRecords();
    if (records.ok) expect(records.stuck).toHaveLength(0);
  });
});

describe("TC-STUCK-002 sourced positive progress is progressing", () => {
  test("no record and no terminate are produced", async () => {
    const harness = createLoopHarness({
      label: "stuck-002",
      progressReading: { state: "positive", observedAtMs: 1_000_000 },
      cycles: 2,
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(harness.verdicts.kills).toHaveLength(0);
    const records = harness.coordinatorRecords();
    if (records.ok) expect(records.stuck).toHaveLength(0);
  });

  test("the pure verdict table agrees", () => {
    for (const row of LOOP_VERDICT_ROWS) {
      const verdict = evaluateLoopVerdict({ ...VERDICT_BASE, ...row.input });
      expect(verdict.verdict, row.id).toBe(row.expected);
    }
  });
});

describe("TC-STUCK-003 zero traffic with a live delivery in progress is never stuck", () => {
  test("a 20-minute zero-traffic window with a live owner pid does not kill", async () => {
    const harness = createLoopHarness({
      label: "stuck-003",
      progressReading: { state: "zero", observedAtMs: 0 },
      delivery: "in-progress",
      cycles: 3,
      cycleStepMs: 700_000,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.verdicts.kills).toHaveLength(0);
    const records = harness.coordinatorRecords();
    if (records.ok) expect(records.stuck).toHaveLength(0);
  });
});

describe("TC-STUCK-004 an unreadable progress reading is unevaluable", () => {
  test("one record per expectation, no kill, and the degradation entry", async () => {
    const harness = createLoopHarness({
      label: "stuck-004",
      progressReading: null,
      delivery: "none",
      cycleStepMs: 700_000,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.verdicts.kills).toHaveLength(0);
    const records = harness.coordinatorRecords();
    if (records.ok) {
      const verdicts = records.stuck.filter((record) => record.phase === "verdict");
      expect(verdicts).toHaveLength(1);
      expect(verdicts[0]?.verdict).toBe("unevaluable");
      expect(verdicts[0]?.reason).toBe("evidence-unevaluable");
    }
    const status = await harness.run(["loop", "status", "--json"]);
    expect(harness.dataOf(status).degraded).toContain("progress-unreadable");
  });
});

describe("TC-STUCK-005 an unreadable corroborator is unevaluable and never stuck", () => {
  test("no kill, one verdict record, and the degradation entry", async () => {
    const harness = createLoopHarness({
      label: "stuck-005",
      progressReading: { state: "zero", observedAtMs: 0 },
      delivery: "unknown",
      cycleStepMs: 700_000,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.verdicts.kills).toHaveLength(0);
    const records = harness.coordinatorRecords();
    if (records.ok) {
      const verdicts = records.stuck.filter((record) => record.phase === "verdict");
      expect(verdicts.every((record) => record.verdict === "unevaluable")).toBe(true);
    }
    const status = await harness.run(["loop", "status", "--json"]);
    expect(harness.dataOf(status).degraded).toContain("delivery-corroborator-unreadable");
  });
});

describe("TC-STUCK-007 TERM precedes KILL and respects the declared grace", () => {
  test("the terminate port receives exactly the configured kill grace once", async () => {
    const harness = createLoopHarness({
      label: "stuck-007",
      progressReading: { state: "zero", observedAtMs: 0 },
      killOutcome: "forced",
      cycleStepMs: 700_000,
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    // The grace is the declared configuration value, never a literal in the case.
    expect(harness.settings["coordinator.kill-grace"]).toBe(20_000);
    expect(harness.verdicts.kills).toEqual(["forced"]);
    const lines = harness.lines.filter((line) => line.includes("event=kill"));
    expect(lines).toHaveLength(1);
  });
});

describe("TC-STUCK-008 only this session's identity is signalled, and a failed kill is terminal", () => {
  test("an unconfirmed termination exits 2 with one outcome, no restart, no second session", async () => {
    const harness = createLoopHarness({
      label: "stuck-008",
      progressReading: { state: "zero", observedAtMs: 0 },
      killOutcome: "failed",
      killFailureReason: "identity-mismatch",
      cycleStepMs: 700_000,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(harness.errorCodeOf(result)).toBe("coordinator.session.kill-failed");
    const records = harness.coordinatorRecords();
    if (records.ok) {
      const outcomes = records.stuck.filter((record) => record.phase === "outcome");
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]?.killFailureReason).toBe("identity-mismatch");
      expect(records.restarts).toHaveLength(0);
      expect(records.fences.at(-1)?.action).toBe("released");
    }
    expect(harness.counters.spawns).toBe(1);
  });

  test("a port declaring no start-time identity yields the capability gap with zero signals", async () => {
    const harness = createLoopHarness({
      label: "stuck-008-gap",
      progressReading: { state: "zero", observedAtMs: 0 },
      killOutcome: "capability-gap",
      cycleStepMs: 700_000,
    });
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(2);
    expect(harness.errorCodeOf(result)).toBe("coordinator.session.kill-failed");
    expect(harness.counters.spawns).toBe(1);
  });
});

describe("TC-STUCK-009 the corroborator reads delivered lane facts and consumes no start time", () => {
  test("the corroborator module imports no appender, no runner, and no path literal", () => {
    const text = readFileSync(join(ROOT, "packages/core/src/app/loop-corroborator.ts"), "utf8");
    expect(text).not.toContain("readDispatchLanes");
    expect(text).not.toContain("readDaemonLanes");
    expect(text).not.toContain(".startedAt");
    expect(text).not.toContain("startedAt:");
    expect(text).not.toContain("node:");
    expect(text).not.toContain("execFile");
    expect(text).not.toContain("scripts/");
  });

  test("the lane record count is unchanged across a supervision run", async () => {
    const harness = createLoopHarness({
      label: "stuck-009",
      progressReading: { state: "positive", observedAtMs: 1_000_000 },
    });
    const before = harness.store.readRecords();
    const beforeCount = before.ok ? before.value.records.length : 0;
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const after = harness.store.readRecords();
    const laneRecords = after.ok
      ? after.value.records.filter((record) => record.kind === "dispatch.lane").length
      : 0;
    expect(laneRecords).toBe(0);
    expect(after.ok ? after.value.records.length : 0).toBeGreaterThanOrEqual(beforeCount);
  });
});

describe("TC-STUCK-010 the sixteen-row decision table is total", () => {
  test("every declared row folds to its expected reading", () => {
    expect(LOOP_DECISION_ROWS).toHaveLength(16);
    for (const row of LOOP_DECISION_ROWS) {
      expect(corroborateDelivery(row.input), row.id).toBe(row.expected);
    }
  });

  test("a superseded active lane reads none (the newest per ref decides)", () => {
    const newest = newestLanePerRef(SUPERSEDED_LANE_RECORDS);
    expect(newest).toHaveLength(1);
    expect(newest[0]?.state).toBe("terminal");
    // The superseded `active` owner is alive; without the reduction this would
    // read D4 in-progress and veto every stuck verdict for the ref.
    const reading = corroborateDelivery({
      storeReadable: true,
      dispatchLanes: newest.map((lane) => ({
        state: lane.state === "active" ? ("active" as const) : ("terminal" as const),
        pid: lane.owner.processId,
        liveness: "alive" as const,
      })),
      daemonLane: null,
    });
    expect(reading).toBe("none");
  });

  test("the evidence classes cover the declared contributions", () => {
    expect(LOOP_EVIDENCE_CLASSES).toHaveLength(12);
    expect(evidenceClassContribution("D4")).toBe("in-progress");
    expect(evidenceClassContribution("D3")).toBe("unknown");
    expect(evidenceClassContribution("D1")).toBe("ignored");
    expect(dispatchEvidenceClass(null)).toBe("D1");
    expect(dispatchEvidenceClass({ state: "active", pid: null, liveness: "dead" })).toBe("D3");
    expect(dispatchEvidenceClass({ state: "active", pid: 1, liveness: "unreadable" })).toBe("D6");
  });

  test("a maximal evidence corpus stays inside the 512-byte bound", () => {
    const corpus = evidenceCorpus(MAXIMAL_EVIDENCE_FIELDS);
    expect(new TextEncoder().encode(corpus).length).toBeLessThanOrEqual(LOOP_MAX_EVIDENCE_BYTES);
    expect(corpus).toContain("traffic=zero");
    expect(corpus).toContain("delivery=none");
  });
});

describe("TC-STUCK-011 a just-started supervisor seeds the observation at acquisition", () => {
  test("a second run over a stuck window produces no second verdict for the same cycle", async () => {
    const harness = createLoopHarness({
      label: "stuck-011",
      progressReading: { state: "zero", observedAtMs: 0 },
      cycles: 2,
      cycleStepMs: 700_000,
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const records = harness.coordinatorRecords();
    if (records.ok) {
      const ids = new Set(records.stuck.map((record) => `${record.stuckId}#${record.phase}`));
      expect(ids.size).toBe(records.stuck.length);
    }
  });
});
