/**
 * TC-LANE-001/002/004/005 and TC-RESUME-101/103/104 — the durable dispatch
 * lane and recorded-attempt resume (GH-347 F-1, F-3; DEC-2, DEC-3; TDR-0049).
 *
 * The lane cases drive the composed production program (D1); the append-failure
 * case drives the real engine (D2) through the delivered command harness with a
 * store that fails only `dispatch.lane` appends. The resume rows come from the
 * single registry.
 */
import { describe, expect, test } from "bun:test";
import { readDaemonLanes } from "../../../packages/core/src/app/daemon";
import {
  readDispatchAttempts,
  readDispatchLanes,
} from "../../../packages/core/src/app/dispatch-ledger";
import { DISPATCH_LANE_PAYLOAD_SCHEMA } from "../../../packages/core/src/contracts/index";
import { createCommandScenario, readsFrom } from "../../fixtures/dispatch/golden/harness";
import { parityCasesOf } from "../../fixtures/dispatch/parity/cases";
import { createParityHarness, PARITY_REPOSITORY } from "../../fixtures/dispatch/parity/harness";
import {
  attemptCountFor,
  daemonLanesOf,
  dispatchLanesOf,
  failLaneAppends,
  LANE_NOW,
  resumePromptReentryObservation,
  seedDaemonLane,
  seedDispatchLane,
} from "../../fixtures/dispatch/parity/lane";
import { artifacts, prOpen, readOk } from "../../fixtures/dispatch/truth";

const ACTIVE_KEYS = [
  "attemptId",
  "harnessKind",
  "iterationOrdinal",
  "owner",
  "recordedAt",
  "ref",
  "repository",
  "restartsConsumed",
  "schema",
  "sessionId",
  "state",
].sort();

const TERMINAL_KEYS = [...ACTIVE_KEYS, "lastOutcome", "lastToken"].sort();

describe("TC-LANE-001 an active lane is appended at acquisition with the full field set", () => {
  test("one active record exists before the attempt, with every DM-1 field", async () => {
    let attemptsWhenLaneLanded: number | undefined;
    const h = createParityHarness({
      label: "lane-001",
      onAppend: (record) => {
        if (record.kind === "dispatch.lane" && attemptsWhenLaneLanded === undefined) {
          attemptsWhenLaneLanded = attemptCountFor(h.store, "GH-347");
        }
      },
    });
    try {
      const result = await h.run();
      expect(result.exit).toBe(0);
      const lanes = dispatchLanesOf(h.store, "GH-347");
      const active = lanes.filter((lane) => lane.state === "active");
      expect(active).toHaveLength(1);
      const record = active[0];
      if (record === undefined) throw new Error("no active lane record");
      expect(Object.keys(record).sort()).toEqual(ACTIVE_KEYS);
      expect(record.schema).toBe(DISPATCH_LANE_PAYLOAD_SCHEMA);
      expect(record.repository).toBe(PARITY_REPOSITORY);
      expect(record.harnessKind).toBe("opencode");
      expect(record.owner).toEqual({ processId: 4242, startedAt: "2026-11-08T10:00:00.000Z" });
      expect(record.iterationOrdinal).toBe(1);
      expect(record.restartsConsumed).toBe(0);
      expect(record.recordedAt).toBe("2026-11-08T10:00:00.000Z");
      const attempts = readDispatchAttempts(h.store);
      if (!attempts.ok) throw new Error("attempt read failed");
      expect(attempts.records).toHaveLength(1);
      expect(record.attemptId).toBe(attempts.records[0]?.attemptId);
      expect(record.sessionId).toBe(attempts.records[0]?.sessionIds?.[0]);
      // The acquisition write precedes the classification write.
      expect(attemptsWhenLaneLanded).toBe(0);
    } finally {
      h.dispose();
    }
  });

  test("the terminal record carries the token and outcome and the exact key set", async () => {
    const h = createParityHarness({ label: "lane-001-terminal" });
    try {
      await h.run();
      const lanes = dispatchLanesOf(h.store, "GH-347");
      const terminal = lanes.filter((lane) => lane.state === "terminal");
      expect(terminal).toHaveLength(1);
      const record = terminal[0];
      if (record === undefined) throw new Error("no terminal lane record");
      expect(Object.keys(record).sort()).toEqual(TERMINAL_KEYS);
      expect(record.lastToken).toBe("finished");
      expect(record.lastOutcome).toBe("completed");
      expect(lanes.map((lane) => lane.state)).toEqual(["active", "terminal"]);
    } finally {
      h.dispose();
    }
  });
});

describe("TC-LANE-002 every pre-session refusal appends no lane and no attempt", () => {
  const seeders: readonly {
    readonly label: string;
    readonly make: () => ReturnType<typeof createParityHarness>;
  }[] = [
    {
      label: "same-ref live lease",
      make: () => {
        const h = createParityHarness({ label: "lane-002-same-ref" });
        h.seedLease({ ref: "GH-347", holder: "lane-1" });
        return h;
      },
    },
    {
      label: "other-ref live lease",
      make: () => {
        const h = createParityHarness({ label: "lane-002-other-ref", extraRefs: ["GH-400"] });
        h.seedLease({ ref: "GH-400", holder: "lane-1" });
        return h;
      },
    },
    {
      label: "persistent state failure on the claim",
      make: () => {
        const h = createParityHarness({ label: "lane-002-state" });
        h.holdFence();
        return h;
      },
    },
  ];
  for (const seeder of seeders) {
    test(`${seeder.label}: zero lanes and zero attempts`, () => {
      const h = seeder.make();
      return h
        .run()
        .then(() => {
          expect(attemptCountFor(h.store, "GH-347")).toBe(0);
          expect(dispatchLanesOf(h.store, "GH-347")).toHaveLength(0);
        })
        .finally(() => h.dispose());
    });
  }
});

describe("TC-LANE-004 a lane append failure is disclosed, never silently claimed", () => {
  test("the token is unchanged, one attempt lands, and lane:append-failed is bounded", async () => {
    const scenario = createCommandScenario({
      label: "lane-004",
      store: (store) => failLaneAppends(store),
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen() })),
      }),
      laneOwner: { processId: 4242, startedAt: LANE_NOW },
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-347", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("pr-open");
      const attempts = readDispatchAttempts(scenario.state.store);
      if (!attempts.ok) throw new Error("attempt read failed");
      expect(attempts.records).toHaveLength(1);
      const attempt = attempts.records[0];
      expect(attempt?.evidenceRefs).toContain("lane:append-failed");
      expect(attempt?.evidenceRefs.length ?? 0).toBeLessThanOrEqual(16);
      for (const ref of attempt?.evidenceRefs ?? []) {
        expect(ref).not.toContain("\n");
        expect(ref.trim()).toBe(ref);
      }
      const lanes = readDispatchLanes(scenario.state.store);
      if (!lanes.ok) throw new Error("lane read failed");
      expect(lanes.records).toHaveLength(0);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-LANE-005 lane absence is classified; the daemon family never adopts a dispatch lane", () => {
  test("pre-change attempt records and daemon lanes read unchanged", () => {
    const h = createParityHarness({ label: "lane-005-reads" });
    try {
      seedDaemonLane(h.store, { ref: "GH-347", state: "delivering", sessionId: "ses-daemon" });
      const daemon = daemonLanesOf(h.store, "GH-347");
      expect(daemon).toHaveLength(1);
      expect(daemon[0]?.sessionId).toBe("ses-daemon");
      // A store with no dispatch lane yields none — the classified absence.
      expect(dispatchLanesOf(h.store, "GH-347")).toHaveLength(0);
    } finally {
      h.dispose();
    }
  });

  test("the daemon reader never returns a dispatch lane, and reconcile appends none", async () => {
    const h = createParityHarness({ label: "lane-005-daemon" });
    try {
      seedDispatchLane(h.store, { ref: "GH-347", sessionId: "ses-dispatch" });
      const before = JSON.stringify(dispatchLanesOf(h.store, "GH-347"));
      // The daemon family's own reader is kind-, schema-, and prefix-scoped.
      const daemonRead = readDaemonLanes(h.store);
      if (!daemonRead.ok) throw new Error("daemon lane read failed");
      expect(daemonRead.records).toHaveLength(0);
      const { reconcileDaemon } = await import("../../../packages/core/src/app/daemon-reconcile");
      const reconciled = reconcileDaemon({
        store: h.store,
        fenceToken: "reconcile-fence",
        instanceId: "reconcile-1",
        nowIso: h.clock.nowIso(),
        restartBound: 3,
        reconcileMaxLanes: 10,
        recover: () => {
          throw new Error("recover must not be called for a dispatch lane");
        },
      });
      expect(reconciled.ok).toBe(true);
      expect(JSON.stringify(dispatchLanesOf(h.store, "GH-347"))).toBe(before);
    } finally {
      h.dispose();
    }
  });
});

describe("TC-RESUME-101/103/104 recorded-attempt resume", () => {
  const row = (id: string) => {
    const entry = parityCasesOf("resume").find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`registry row ${id} is missing`);
    return entry;
  };

  test("a recorded pr-open lane resumes (zero spawns, one resume of the recorded session)", async () => {
    const observation = await row("resume-pr-open-lane").scenario();
    expect(observation.results[0]?.exit).toBe(0);
    expect(observation.spawns).toBe(0);
    expect(observation.resumes).toBe(1);
    const attempts = observation.attempts;
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.resumeMode).toBe("attach-continue");
    expect(attempts[0]?.sessionIds).toEqual(["ses-347"]);
    const lanes = observation.lanes.filter((lane) => lane.ref === "GH-347");
    // The seeded terminal record stays byte-identical; the acquisition appends
    // one active record for the resumed session and the classification appends
    // its own terminal record. Records are append-only, never rewritten.
    expect(lanes.map((lane) => lane.state)).toEqual(["terminal", "active", "terminal"]);
    expect(lanes[0]).toMatchObject({ sessionId: "ses-347", lastToken: "pr-open" });
    const resumed = lanes.filter((lane) => lane.state === "active");
    expect(resumed).toHaveLength(1);
    expect(resumed[0]?.sessionId).toBe("ses-347");
    expect(resumed[0]?.iterationOrdinal).toBe(1);
  });

  test("no recorded lane is an explicit fresh spawn carrying the operator text", async () => {
    const observation = await row("resume-no-lane").scenario();
    expect(observation.results[0]?.exit).toBe(0);
    expect(observation.spawns).toBe(1);
    expect(observation.resumes).toBe(0);
    expect(observation.attempts[0]?.resumeMode).toBeUndefined();
    const spawn = observation.invocations.find((invocation) => invocation.stdin !== undefined);
    expect(spawn?.stdin).toBe("start over");
    expect(observation.violations).toEqual([]);
  });

  test("an unknown session is a classified failure with exactly one attempt and no spawn", async () => {
    const observation = await row("resume-unknown-session").scenario();
    expect(observation.results[0]?.exit).toBe(1);
    expect(observation.attempts).toHaveLength(1);
    expect(observation.attempts[0]?.token).toBe("failed");
    expect(observation.attempts[0]?.falseSuccess).toBe(false);
    expect(observation.spawns).toBe(0);
    expect(observation.resumes).toBe(1);
  });
});

/* ------------------------------------------------------------------------- */
/* TC-RESUME-102 — the operator resume in BOTH modes at counts 3 and 4.       */
/* ------------------------------------------------------------------------- */

describe("TC-RESUME-102 an operator resume consumes no ordinal in either mode", () => {
  for (const count of [3, 4]) {
    test(`attach-continue at persisted count ${count} is admitted with no ordinal`, async () => {
      const h = createParityHarness({ label: `resume-102-attach-${count}` });
      try {
        h.seedRestarts(count);
        seedDispatchLane(h.store, {
          ref: "GH-347",
          sessionId: "ses-347",
          state: "terminal",
          lastToken: "pr-open",
        });
        const run = await h.run(["dispatch", "GH-347", "--resume-prompt", "go", "--json"]);
        expect(run.exit).toBe(0);
        expect(run.envelope?.data?.error?.code).toBeUndefined();
        expect(run.envelope?.data?.restarts).toBe(count);
        const observation = h.observe();
        expect(observation.attempts).toHaveLength(1);
        expect(observation.attempts[0]?.resumeMode).toBe("attach-continue");
        // No prefill cost is acknowledged on attach-continue (the delivered
        // plan carries the explicit false rather than an absent member).
        expect(observation.attempts[0]?.prefillCostAcknowledged).not.toBe(true);
        // No restart record was appended; the persisted total is unchanged.
        expect(observation.economicsRestarts).toBe(count);
        expect(observation.resumes).toBe(1);
        expect(observation.spawns).toBe(0);
      } finally {
        h.dispose();
      }
    });

    test(`resume-prompt-reentry at persisted count ${count} is admitted and charges nothing`, async () => {
      const observation = await resumePromptReentryObservation({
        restartCount: count,
        label: `resume-102-reentry-${count}`,
      });
      expect(observation.exit).toBe(0);
      expect(observation.results[0]?.envelope?.data?.error?.code).toBeUndefined();
      expect(observation.attempts).toHaveLength(1);
      expect(observation.attempts[0]?.resumeMode).toBe("resume-prompt-reentry");
      expect(observation.attempts[0]?.prefillCostAcknowledged).toBe(true);
      expect(observation.economicsRestarts).toBe(0);
      expect(observation.resumes).toBe(1);
      expect(observation.spawns).toBe(0);
      expect(observation.results[0]?.envelope?.data?.restarts).toBe(count);
    });
  }
});
