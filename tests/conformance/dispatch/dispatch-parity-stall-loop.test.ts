/**
 * TC-TERM-001/002 (engine half)/003/004/005/006, TC-LOOP-001..005 and
 * TC-LANE-003 — stall termination, the in-process bounded loop, and the lane's
 * terminal shape (GH-347 F-5, F-6; DEC-4, DEC-5; TDR-0046, TDR-0047).
 *
 * The cases drive the real command path (D2) with the session port double from
 * `parity/terminate.ts`: the engine's stall decision, the loop, the lane and
 * attempt appends, and the economics records are the production ones.
 */
import { describe, expect, test } from "bun:test";
import {
  readDispatchAttempts,
  readDispatchLanes,
} from "../../../packages/core/src/app/dispatch-ledger";
import { readEconomicsRecords } from "../../../packages/core/src/state/index";
import { createCommandScenario, exitOf, readsFrom } from "../../fixtures/dispatch/golden/harness";
import {
  COMPLETED_EVIDENCE,
  PREMATURE_END_EVIDENCE,
  TOOL_FAILURE_EVIDENCE,
} from "../../fixtures/dispatch/harness";
import {
  createProcessTreeModel,
  createStallPort,
  type IterationScript,
  KILL,
  sourcedReadings,
  TERM,
} from "../../fixtures/dispatch/parity/terminate";
import {
  artifacts,
  prNone,
  prOpen,
  readFail,
  readOk,
  tracker,
} from "../../fixtures/dispatch/truth";

const STALL_LIVENESS = [
  sourcedReadings({ traffic: 1, worktree: 1, process: 1 }),
  sourcedReadings({ traffic: 1, worktree: 1, process: 1 }),
];
const CLEAN_LIVENESS = [
  sourcedReadings({ traffic: 1, worktree: 1, process: 1 }),
  sourcedReadings({ traffic: 5, worktree: 5, process: 5 }),
];

/** A decisive artifact OUTSIDE the terminal pre-restart set (never short-circuits). */
const outsideSetReads = () =>
  readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })) });

const stallScript = (): IterationScript => ({
  liveness: STALL_LIVENESS,
  evidence: COMPLETED_EVIDENCE,
});
const cleanScript = (evidence = COMPLETED_EVIDENCE): IterationScript => ({
  liveness: CLEAN_LIVENESS,
  evidence,
});

const failedEvidence = {
  completionMarker: true,
  exitStatus: 1,
  timedOut: false,
  spawnRefused: false,
  failureReported: true,
  toolFailure: false,
};

type Harness = ReturnType<typeof createCommandScenario>;

const build = (input: {
  readonly label: string;
  readonly iterations: readonly IterationScript[];
  readonly nowMs: () => number;
  readonly reads?: ReturnType<typeof readsFrom>;
  readonly readsSequence?: readonly ReturnType<typeof readsFrom>[];
  readonly restartBudget?: number;
  readonly restartCount?: number;
  readonly terminateCapable?: boolean;
  readonly title?: string;
  readonly advanceOnDelay?: (ms: number) => void;
}) => {
  const model = createProcessTreeModel({ nowMs: input.nowMs });
  const waits: { ms: number; reason: string }[] = [];
  const stallPort = createStallPort({
    model,
    iterations: input.iterations,
    delay: async (ms, reason) => {
      waits.push({ reason, ms });
      input.advanceOnDelay?.(ms);
    },
    ...(input.terminateCapable === undefined ? {} : { terminateCapable: input.terminateCapable }),
    ...(input.title === undefined ? {} : { title: input.title }),
  });
  const scenario = createCommandScenario({
    label: input.label,
    harnessPort: stallPort.port,
    ...(input.readsSequence === undefined
      ? { reads: input.reads ?? readsFrom() }
      : { readsSequence: [...input.readsSequence] }),
    livenessIntervalMs: 30_000,
    killGraceMs: 20_000,
    laneOwner: { processId: 4242, startedAt: "2026-11-08T10:00:00.000Z" },
    ...(input.restartBudget === undefined ? {} : { restartBudget: input.restartBudget }),
    ...(input.restartCount === undefined ? {} : { restartCount: input.restartCount }),
  });
  return { scenario, model, stallPort, waits };
};

const attemptsOf = (scenario: Harness) => {
  const read = readDispatchAttempts(scenario.state.store);
  if (!read.ok) throw new Error("attempt read failed");
  return read.records;
};

const lanesOf = (scenario: Harness) => {
  const read = readDispatchLanes(scenario.state.store);
  if (!read.ok) throw new Error("lane read failed");
  return read.records.filter((lane) => lane.ref === "GH-301");
};

const restartsOf = (scenario: Harness) => {
  const read = readEconomicsRecords(scenario.state.store, "GH-301");
  if (!read.ok) throw new Error("economics read failed");
  return read.restarts;
};

describe("TC-TERM-001 a corroborated stall sends TERM first, KILL only after the grace", () => {
  test("signals ordered, grace honoured, evidence recorded, one session before the restart", async () => {
    let now = Date.parse("2026-11-08T10:00:00.000Z");
    const { scenario, model, stallPort } = build({
      label: "term-001",
      // The stall short-circuits on a tracker-done verdict, so the terminal
      // attempt carries the stall verdict and the termination result.
      iterations: [stallScript()],
      nowMs: () => now,
      advanceOnDelay: (ms) => {
        now += ms;
      },
      reads: readsFrom({ tracker: readOk(tracker({ state: "done" })) }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      const firstTerminate = stallPort.terminateCalls[0];
      expect(firstTerminate).toBeDefined();
      expect(firstTerminate?.graceMs).toBe(20_000);
      const pid = Number(firstTerminate?.handle.treeRoot);
      const signals = model.signalsFor(pid);
      expect(signals.map((signal) => signal.signal)).toEqual([TERM, KILL]);
      const killAt = signals[1]?.atMs ?? 0;
      const termAt = signals[0]?.atMs ?? 0;
      expect(killAt - termAt).toBeGreaterThanOrEqual(20_000);
      const attempt = attemptsOf(scenario)[0];
      expect(attempt?.evidenceRefs).toContain("liveness:stalled");
      expect(attempt?.evidenceRefs).toContain("terminate:terminated");
      expect(attempt?.evidenceRefs).toContain("terminate:escalated");
      // The reap reference is present exactly when the report says it reaped.
      const reported = "terminate:reaped";
      expect(attempt?.evidenceRefs.includes(reported)).toBe(false);
      expect(stallPort.acquisitions()).toBe(1);
      void now;
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-TERM-002 the engine invokes no terminate on a clean exit or a cleared stall", () => {
  test("a clean exit after an earlier mid-run stall terminates nothing and restarts nothing", async () => {
    const { scenario, stallPort } = build({
      label: "term-002-clean",
      iterations: [
        {
          // One advancing observation, one no-advance, then two advancing: the
          // stall is transient and cleared before collection resolves.
          liveness: [
            sourcedReadings({ traffic: 1, worktree: 1, process: 1 }),
            sourcedReadings({ traffic: 1, worktree: 1, process: 1 }),
            sourcedReadings({ traffic: 3, worktree: 3, process: 3 }),
            sourcedReadings({ traffic: 5, worktree: 5, process: 5 }),
          ],
          evidence: { ...COMPLETED_EVIDENCE, toolFailure: true },
        },
      ],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(stallPort.terminateCalls).toHaveLength(0);
      expect(restartsOf(scenario)).toHaveLength(0);
      const attempt = attemptsOf(scenario)[0];
      expect(attempt?.evidenceRefs).toContain("liveness:stalled");
      expect(attempt?.evidenceRefs).toContain("liveness:progressing");
      expect(stallPort.acquisitions()).toBe(1);
    } finally {
      scenario.dispose();
    }
  });

  test("a clean exit with no stall at all terminates nothing", async () => {
    const { scenario, stallPort } = build({
      label: "term-002-plain",
      iterations: [cleanScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(stallPort.terminateCalls).toHaveLength(0);
      expect(restartsOf(scenario)).toHaveLength(0);
      expect(stallPort.acquisitions()).toBe(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-TERM-003 a stall short-circuits on each terminal pre-restart verdict", () => {
  const rows = [
    {
      label: "tracker-done",
      reads: readsFrom({ tracker: readOk(tracker({ state: "done" })) }),
      token: "merged",
    },
    {
      label: "blocking",
      reads: readsFrom({ tracker: readOk(tracker({ state: "delivery-blocked", blocking: true })) }),
      token: "blocked",
    },
    {
      label: "open-pr",
      reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen() })) }),
      token: "pr-open",
    },
  ] as const;
  for (const row of rows) {
    test(`${row.label} short-circuits with no restart`, async () => {
      const { scenario, stallPort } = build({
        label: `term-003-${row.label}`,
        iterations: [stallScript()],
        nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
        reads: row.reads,
      });
      try {
        const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
        expect(run.envelope?.data?.result).toBe(row.token);
        expect(run.exit).toBe(exitOf(row.token as "merged"));
        expect(restartsOf(scenario)).toHaveLength(0);
        expect(stallPort.acquisitions()).toBe(1);
        expect(stallPort.terminateCalls).toHaveLength(1);
        expect(attemptsOf(scenario)[0]?.evidenceRefs).toContain("terminate:terminated");
      } finally {
        scenario.dispose();
      }
    });
  }
});

describe("TC-TERM-004 a decisive artifact outside the set does not stop a stall", () => {
  const rows = [
    {
      label: "finished",
      reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })) }),
    },
    {
      label: "partial",
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "incomplete" })),
      }),
    },
    {
      label: "nothing-to-do",
      reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })) }),
    },
  ] as const;
  for (const row of rows) {
    test(`${row.label}: one ordinal is consumed and a second iteration runs`, async () => {
      const { scenario, stallPort } = build({
        label: `term-004-${row.label}`,
        iterations: [stallScript(), cleanScript()],
        nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
        readsSequence: [row.reads, readsFrom()],
        restartBudget: 3,
        restartCount: 0,
      });
      try {
        await scenario.invoke(["dispatch", "GH-301", "--json"]);
        const restarts = restartsOf(scenario);
        expect(restarts).toHaveLength(1);
        expect(restarts[0]?.reason).toBe("watchdog.liveness-stalled");
        expect(stallPort.acquisitions()).toBe(2);
        expect(attemptsOf(scenario)).toHaveLength(1);
      } finally {
        scenario.dispose();
      }
    });
  }
});

describe("TC-TERM-005 a terminate-incapable adapter starts no second session", () => {
  test("a terminal verdict short-circuits with one acquisition and no terminate member", async () => {
    const { scenario, stallPort } = build({
      label: "term-005-verdict",
      iterations: [stallScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
      reads: readsFrom({ tracker: readOk(tracker({ state: "done" })) }),
      terminateCapable: false,
    });
    try {
      expect(stallPort.port.terminate).toBeUndefined();
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.envelope?.data?.result).toBe("merged");
      expect(run.exit).toBe(0);
      expect(restartsOf(scenario)).toHaveLength(0);
      expect(stallPort.acquisitions()).toBe(1);
      expect(stallPort.violations).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("undecidable truth is state-unverified with the stall evidence and no second session", async () => {
    const { scenario, stallPort } = build({
      label: "term-005-unverified",
      iterations: [stallScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
      reads: readsFrom({
        tracker: readFail("tracker", "tracker.read-unreadable"),
        artifacts: readFail("artifact", "artifact.read-unreadable"),
      }),
      terminateCapable: false,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(run.exit).toBe(2);
      expect(attemptsOf(scenario)[0]?.evidenceRefs).toContain("liveness:stalled");
      expect(restartsOf(scenario)).toHaveLength(0);
      expect(stallPort.acquisitions()).toBe(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-TERM-006 terminate is idempotent and reaps only the exact identity", () => {
  test("TERM reaches only the tree; the escaped runtimes are reaped; unrelated pids are untouched", async () => {
    let now = Date.parse("2026-11-08T10:00:00.000Z");
    const model = createProcessTreeModel({ nowMs: () => now });
    const waits: { ms: number; reason: string }[] = [];
    const port = createStallPort({
      model,
      iterations: [stallScript()],
      delay: async (ms, reason) => {
        waits.push({ reason, ms });
        now += ms;
      },
      title: "ticket-GH-301",
    });
    // The escaped runtimes and three unrelated processes.
    model.addProcess({ pid: 9101, escaped: true, sessionId: "ses-loop-1" });
    model.addProcess({ pid: 9102, escaped: true, title: "ticket-GH-301" });
    model.addProcess({ pid: 9103, sessionId: "ses-999", title: "ticket-GH-348" });
    model.addProcess({ pid: 9104, title: "ticket-GH-348" });
    model.addProcess({ pid: 9105 });

    const spawned = await port.port.spawn({
      workItemRef: "GH-301",
      prompt: "synthetic",
      descriptor: { kind: "host", workDirectory: "/synthetic", environment: [] },
    });
    if (!spawned.ok) throw new Error("spawn failed");
    const first = await port.port.terminate?.({ handle: spawned.value, graceMs: 20_000 });
    expect(first?.ok).toBe(true);
    if (first?.ok === true) {
      expect(first.value).toEqual({ terminated: true, escalated: true, reaped: true });
    }
    expect(waits).toEqual([{ reason: "terminate-grace", ms: 20_000 }]);
    const signalsBefore = JSON.stringify(model.signals);
    const second = await port.port.terminate?.({ handle: spawned.value, graceMs: 20_000 });
    expect(second?.ok).toBe(true);
    if (second?.ok === true) expect(second.value.terminated).toBe(true);
    // The second call signals nothing further.
    expect(JSON.stringify(model.signals)).toBe(signalsBefore);
    for (const pid of [9103, 9104, 9105]) {
      expect(model.signalsFor(pid), `pid ${pid}`).toHaveLength(0);
    }
    const reaped = model.processes
      .filter((process) => process.reaped)
      .map((process) => process.pid);
    expect(reaped).toContain(9101);
    expect(reaped).toContain(9102);
    expect(reaped).not.toContain(9103);
    expect(reaped).not.toContain(9104);
    expect(reaped).not.toContain(9105);
  });
});

describe("TC-LOOP-001 a below-bound stall consumes one ordinal and one economics restart", () => {
  test("spawn then resume, one restart record, one attempt, lane active/active/terminal", async () => {
    const { scenario, stallPort } = build({
      label: "loop-001",
      iterations: [stallScript(), cleanScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
      readsSequence: [outsideSetReads(), readsFrom()],
      restartBudget: 3,
      restartCount: 0,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("pr-open");
      expect(run.envelope?.data?.restarts).toBe(1);
      expect(stallPort.calls.filter((call) => call === "spawn")).toHaveLength(1);
      expect(stallPort.calls.filter((call) => call === "resume")).toHaveLength(1);
      const restarts = restartsOf(scenario);
      expect(restarts).toHaveLength(1);
      expect(restarts[0]?.reason).toBe("watchdog.liveness-stalled");
      expect(attemptsOf(scenario)).toHaveLength(1);
      const states = lanesOf(scenario).map((lane) => lane.state);
      expect(states).toEqual(["active", "active", "terminal"]);
      expect(lanesOf(scenario).map((lane) => lane.iterationOrdinal)).toEqual([1, 2, 2]);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-LOOP-002 at the bound the loop produces max-restarts with the exhaustion record", () => {
  test("four iterations (spawn + three resumes), three restarts, one attempt, exhaustion", async () => {
    const { scenario, stallPort } = build({
      label: "loop-002",
      iterations: [stallScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
      reads: outsideSetReads(),
      restartBudget: 3,
      restartCount: 0,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.result).toBe("max-restarts");
      expect(run.envelope?.data?.restarts).toBe(3);
      expect(stallPort.calls.filter((call) => call === "spawn")).toHaveLength(1);
      expect(stallPort.calls.filter((call) => call === "resume")).toHaveLength(3);
      expect(restartsOf(scenario)).toHaveLength(3);
      expect(attemptsOf(scenario)).toHaveLength(1);
      expect(scenario.calls.exhaustions).toHaveLength(1);
      expect(stallPort.terminateCalls).toHaveLength(4);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-LOOP-003 an unverified stall consumes no ordinal and starts no second session", () => {
  test("state-unverified with the stall and exhaustion evidence, zero restarts", async () => {
    const { scenario, stallPort } = build({
      label: "loop-003",
      iterations: [stallScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
      restartBudget: 3,
      restartCount: 0,
      reads: readsFrom({
        tracker: readFail("tracker", "tracker:exhausted"),
        artifacts: readFail("artifact", "artifact.read-unreadable"),
      }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(restartsOf(scenario)).toHaveLength(0);
      expect(run.envelope?.data?.restarts).toBe(0);
      expect(stallPort.acquisitions()).toBe(1);
      expect(attemptsOf(scenario)).toHaveLength(1);
      expect(stallPort.terminateCalls).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-LOOP-004 a clean exit is always terminal", () => {
  const matrix = [
    { label: "completed", evidence: COMPLETED_EVIDENCE, token: "pr-open" },
    { label: "failure-reported", evidence: failedEvidence, token: "finished" },
    { label: "tool-failure", evidence: TOOL_FAILURE_EVIDENCE, token: "partial" },
    { label: "premature-end", evidence: PREMATURE_END_EVIDENCE, token: "partial" },
  ] as const;
  for (const count of [0, 3]) {
    for (const row of matrix) {
      test(`${row.label} at persisted count ${count}: one iteration, no restart, no terminate`, async () => {
        const { scenario, stallPort } = build({
          label: `loop-004-${row.label}-${count}`,
          iterations: [cleanScript(row.evidence)],
          nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
          restartBudget: 3,
          restartCount: count,
          // A decisive artifact so the completed row is pr-open; the failure
          // rows use the classifier (Appendix F(C)(9)).
          reads: readsFrom(),
        });
        try {
          const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
          expect(stallPort.acquisitions()).toBe(1);
          expect(restartsOf(scenario)).toHaveLength(0);
          expect(stallPort.terminateCalls).toHaveLength(0);
          expect(attemptsOf(scenario)).toHaveLength(1);
          expect(run.envelope?.data?.result).not.toBe("max-restarts");
          if (row.label === "completed") expect(run.envelope?.data?.result).toBe("pr-open");
        } finally {
          scenario.dispose();
        }
      });
    }
  }
});

describe("TC-LOOP-005 the envelope restarts is the persisted total and one attempt per dispatch", () => {
  test("clean 0, one restart 1, pre-session refusal 0; the pinned bound is honoured", async () => {
    const clean = build({
      label: "loop-005-clean",
      iterations: [cleanScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
      restartBudget: 3,
      restartCount: 0,
    });
    try {
      const run = await clean.scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.envelope?.data?.restarts).toBe(0);
      expect(attemptsOf(clean.scenario)).toHaveLength(1);
    } finally {
      clean.scenario.dispose();
    }

    const one = build({
      label: "loop-005-one",
      iterations: [stallScript(), cleanScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
      readsSequence: [outsideSetReads(), readsFrom()],
      restartBudget: 1,
      restartCount: 0,
    });
    try {
      const run = await one.scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.envelope?.data?.restarts).toBe(1);
      expect(attemptsOf(one.scenario)).toHaveLength(1);
    } finally {
      one.scenario.dispose();
    }

    const refused = createCommandScenario({
      label: "loop-005-refused",
      claim: { ok: false, code: "queue.single-flight", holder: "other" },
    });
    try {
      const run = await refused.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(attemptsOf(refused)).toHaveLength(0);
    } finally {
      refused.dispose();
    }
  });
});

describe("TC-LANE-003 the terminal lane, append-only latest-wins, and a restarted iteration", () => {
  test("active(1), active(2, restartsConsumed 1), exactly one terminal; a second run appends a new pair", async () => {
    const { scenario } = build({
      label: "lane-003",
      iterations: [stallScript(), cleanScript(), cleanScript()],
      nowMs: () => Date.parse("2026-11-08T10:00:00.000Z"),
      readsSequence: [outsideSetReads(), readsFrom()],
      restartBudget: 3,
      restartCount: 0,
    });
    try {
      const first = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(first.exit).toBe(0);
      const lanes = lanesOf(scenario);
      expect(lanes.map((lane) => lane.state)).toEqual(["active", "active", "terminal"]);
      expect(lanes.map((lane) => lane.iterationOrdinal)).toEqual([1, 2, 2]);
      expect(lanes.map((lane) => lane.restartsConsumed)).toEqual([0, 1, 1]);
      const terminal = lanes.filter((lane) => lane.state === "terminal");
      expect(terminal).toHaveLength(1);
      expect(terminal[0]?.lastToken).toBe("pr-open");
      expect(terminal[0]?.lastOutcome).toBe("completed");
      // No terminal record between the two active records.
      expect(lanes[1]?.state).toBe("active");
      const prefix = JSON.stringify(lanes);
      const second = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(second.exit).toBe(0);
      const after = lanesOf(scenario);
      expect(JSON.stringify(after.slice(0, lanes.length))).toBe(prefix);
      expect(after.length).toBeGreaterThan(lanes.length);
      expect(after[after.length - 1]?.state).toBe("terminal");
    } finally {
      scenario.dispose();
    }
  });
});
