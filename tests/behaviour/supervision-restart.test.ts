/**
 * TC-SUP-060 / TC-SUP-061 / TC-SUP-062 — restart composition over the delivered
 * economics: admission appends the delivered restart record, exhaustion is
 * terminal and loud with one typed question, an unevaluable admission is the
 * declared unavailable outcome, and nothing is ever signalled (GH-295 AC-F7-1,
 * DEC-7).
 */
import { describe, expect, test } from "bun:test";
import {
  SUPERVISION_EXHAUSTION_QUESTION_OPTIONS,
  supervisionExhaustionQuestionId,
} from "../../packages/cli/src/production";
import { readQueueParks } from "../../packages/core/src/app/index";
import { readBlockerLedger } from "../../packages/core/src/state/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import { LANE_REF, stalledAndParked } from "../fixtures/supervise/records";

const restartRecords = (
  harness: ReturnType<typeof createSupervisionHarness>,
): readonly string[] => {
  const records = harness.store.readRecords();
  if (!records.ok) return [];
  return records.value.records
    .filter((record) => record.kind === "economics.restart")
    .map((record) => JSON.stringify(record.payload));
};

describe("TC-SUP-060 an admitted restart appends the delivered restart record", () => {
  test("one delivered record, the injected run identity, exit 0, nothing else written", async () => {
    const harness = createSupervisionHarness({ label: "restart-admitted" });
    try {
      stalledAndParked(harness.seed);
      let admissionCalls = 0;
      const runId = "run-restart-injected";
      const run = await harness.runCli(["supervise", "--json"], {
        runId,
        admitRestart: () => {
          admissionCalls += 1;
          return { outcome: "admit", restarts: 0 };
        },
      });
      expect(run.exitCode).toBe(0);
      expect(admissionCalls).toBe(1);
      const restarts = restartRecords(harness);
      expect(restarts).toHaveLength(1);
      expect(restarts[0]).toContain('"ordinal":1');
      expect(restarts[0]).toContain(`"runId":"${runId}"`);
      expect(restarts[0]).toContain(`"sessionId":"${runId}"`);
      expect(restarts[0]).not.toContain('"runId":"supervise"');
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      const actions = data.actions as readonly Record<string, unknown>[];
      expect(actions.map((action) => action.kind)).toEqual(["restart-admission"]);
      const evidence = (actions[0]?.evidence ?? []) as readonly {
        recordKind?: string;
        runId?: string;
      }[];
      expect(evidence.some((item) => item.recordKind === "economics.restart")).toBe(true);
      // The same identity is echoed in the action evidence.
      expect(evidence.some((item) => item.runId === runId)).toBe(true);
      // No queue requeue, no lease, no tracker write.
      const records = harness.store.readRecords();
      if (!records.ok) throw new Error("ledger read failed");
      const kinds = records.value.records.map((record) => record.kind);
      expect(kinds).not.toContain("queue.entry.reopened");
      expect(kinds).toContain("economics.restart");
      // Post-action delivered reads stay healthy (TC-SUP-104's tail).
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-061 exhaustion is terminal and loud exactly once", () => {
  test("two different run ids leave one terminal record and one ref-stable question", async () => {
    const harness = createSupervisionHarness({ label: "restart-exhausted" });
    try {
      stalledAndParked(harness.seed);
      const admission = { outcome: "exhausted" as const, restarts: 3 };
      const first = await harness.runCli(["supervise", "--json"], {
        runId: "run-invocation-1",
        admitRestart: () => admission,
      });
      expect(first.exitCode).toBe(0);
      const records = harness.store.readRecords();
      if (!records.ok) throw new Error("ledger read failed");
      const kinds = records.value.records.map((record) => record.kind);
      expect(kinds).toContain("economics.budget-exhaustion");
      expect(kinds).not.toContain("economics.restart");
      const exhaustion = records.value.records.find(
        (record) => record.kind === "economics.budget-exhaustion",
      );
      // The run id is record metadata, not identity.
      expect(JSON.stringify(exhaustion?.payload)).toContain('"runId":"run-invocation-1"');
      const ledger = readBlockerLedger(harness.store);
      if (!ledger.ok) throw new Error("blocker ledger read failed");
      expect(ledger.value.questions).toHaveLength(1);
      const question = ledger.value.questions[0];
      expect(question?.type).toBe("decision-needed");
      expect(question?.id).toBe(supervisionExhaustionQuestionId(LANE_REF));
      expect(question?.id).not.toContain("run-invocation-1");
      expect(question?.options).toEqual([...SUPERVISION_EXHAUSTION_QUESTION_OPTIONS]);
      const firstData = (JSON.parse(first.stdout) as { data?: Record<string, unknown> }).data;
      expect(
        ((firstData?.actions ?? []) as readonly Record<string, unknown>[]).map(
          (action) => action.kind,
        ),
      ).toEqual(["exhaustion-record"]);

      // A second run with a DIFFERENT injected run id must be inert.
      const second = await harness.runCli(["supervise", "--json"], {
        runId: "run-invocation-2",
        admitRestart: () => admission,
      });
      expect(second.exitCode).toBe(0);
      const secondData = (JSON.parse(second.stdout) as { data?: Record<string, unknown> }).data;
      expect(secondData?.actions ?? []).toEqual([]);
      const after = readBlockerLedger(harness.store);
      if (!after.ok) throw new Error("blocker ledger read failed");
      expect(after.value.questions).toHaveLength(1);
      expect(after.value.questions[0]?.id).toBe(question?.id);
      expect(after.value.questions[0]?.id).not.toContain("run-invocation-2");
      const repeated = harness.store.readRecords();
      if (!repeated.ok) throw new Error("ledger read failed");
      expect(
        repeated.value.records.filter((record) => record.kind === "economics.budget-exhaustion"),
      ).toHaveLength(1);
      // Post-action delivered reads stay healthy.
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-062 an unevaluable admission is the declared unavailable outcome", () => {
  test("the outcome rides actions with evidence and consumes no budget", async () => {
    const harness = createSupervisionHarness({ label: "restart-unavailable" });
    try {
      stalledAndParked(harness.seed);
      const run = await harness.runCli(["supervise", "--json"], {
        runId: "run-unavailable-injected",
        admitRestart: () => ({ outcome: "unavailable", restarts: 0, code: "state.store.torn" }),
      });
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      const actions = data.actions as readonly Record<string, unknown>[];
      expect(actions.map((action) => action.kind)).toEqual(["unavailable-outcome"]);
      const evidence = (actions[0]?.evidence ?? []) as readonly {
        code: string;
        runId?: string;
      }[];
      expect(evidence.some((item) => item.code === "restart-unavailable")).toBe(true);
      expect(evidence.some((item) => item.runId === "run-unavailable-injected")).toBe(true);
      expect(restartRecords(harness)).toEqual([]);
      const records = harness.store.readRecords();
      if (!records.ok) throw new Error("ledger read failed");
      expect(
        records.value.records.filter((record) => record.kind === "economics.budget-exhaustion"),
      ).toHaveLength(0);
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});
