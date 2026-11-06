/**
 * TC-VGATES-051 — read budget, zero writes/spawns, and byte-identical replay.
 *
 * The runtime records every injected read seam and wraps the lifecycle registry
 * read in a store guard that throws on any mutation, fence, or repair call. The
 * no-spawn and no-network guards prove the invocation neither launches a child
 * process nor opens a socket; the provider seams prove at most four GETs with
 * one call each and no pagination.
 */
import { describe, expect, test } from "bun:test";
import type { VerifyGatesCommandRuntime } from "../../packages/cli/src/commands/verify-gates";
import { readChangeTransitionsTolerant } from "../../packages/core/src/state/index";
import { createNoSpawnGuard } from "../fixtures/result/no-spawn-guard";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, pmNotesValue, runVerify } from "../fixtures/verify-gates/cases/harness";
import { createNoNetworkGuard } from "../fixtures/verify-gates/cases/network-guard";
import {
  appendLanding,
  createVerifyRecorder,
  createVerifyState,
  guardStore,
} from "./verify-support";

type RecordedRead = { readonly name: string; readonly args: readonly unknown[] };

type BudgetRuntime = {
  readonly runtime: ReturnType<typeof combinedRuntime>;
  readonly reads: RecordedRead[];
  readonly storeCalls: readonly string[];
  cleanup(): void;
};

const providerReads = new Set([
  "readOpenPullRequests",
  "readDeliveryRequestDetail",
  "readCheckRuns",
  "readWorkItem",
]);

const createBudgetRuntime = (facts?: ReturnType<typeof baseFacts>): BudgetRuntime => {
  const state = createVerifyState();
  appendLanding(state, "delivery", "complete", "2026-10-31T05:00:00Z");
  const recorder = createVerifyRecorder();
  const guarded = guardStore(state.store, recorder);
  const reads: RecordedRead[] = [];
  const base = combinedRuntime();
  const gates = base.gates;
  if (gates === undefined) throw new Error("combined runtime is missing the gates member");

  const record =
    <Args extends readonly unknown[], Result>(name: string, call: (...args: Args) => Result) =>
    (...args: Args): Result => {
      reads.push({ name, args });
      return call(...args);
    };

  const recordedGates: VerifyGatesCommandRuntime = {
    ...gates,
    readLifecycle: record("readLifecycle", (changeRef: string) => {
      const read = readChangeTransitionsTolerant(guarded.store, changeRef);
      return {
        document: { ok: true as const, file: "fixture.yaml", text: "", value: pmNotesValue() },
        registry: read.ok
          ? {
              ok: true as const,
              present: read.value.present,
              verifiedEmpty: read.value.verifiedEmpty,
              transitions: read.value.transitions,
              recordCount: read.value.evidence.recordCount,
            }
          : { ok: false as const, error: read.error },
      };
    }),
    readRepository: record("readRepository", () => facts?.repository ?? gates.readRepository()),
    readWorkflow: record("readWorkflow", () => facts?.workflow ?? gates.readWorkflow()),
    readOpenPullRequests: record(
      "readOpenPullRequests",
      async (limit: number) => facts?.openPullRequests ?? gates.readOpenPullRequests(limit),
    ),
    readDeliveryRequestDetail: record(
      "readDeliveryRequestDetail",
      async (pullNumber: string) =>
        facts?.deliveryRequestDetail ?? gates.readDeliveryRequestDetail(pullNumber),
    ),
    readCheckRuns: record(
      "readCheckRuns",
      async (sha: string, limit: number) => facts?.checkRuns ?? gates.readCheckRuns(sha, limit),
    ),
    readWorkItem: record(
      "readWorkItem",
      async (changeRef: string) => facts?.workItem ?? gates.readWorkItem(changeRef),
    ),
  };

  return {
    runtime: { ...base, gates: recordedGates },
    reads,
    storeCalls: recorder.calls,
    cleanup: () => state.cleanup(),
  };
};

const redFacts = () => {
  const facts = clone(baseFacts());
  facts.checkRuns = {
    ok: true,
    value: {
      items: EXPECTED_JOBS.map((name) =>
        run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
      ),
      pageItemCount: 23,
    },
  };
  return facts;
};

describe("TC-VGATES-051 read-only composition and read budget", () => {
  test("one invocation performs exactly four provider reads, one each, with no writes or spawns", async () => {
    const budget = createBudgetRuntime();
    const spawnGuard = createNoSpawnGuard();
    const networkGuard = createNoNetworkGuard();
    try {
      spawnGuard.install();
      const result = await runVerify(budget.runtime, ["gates", "GH-178"]);
      expect(result.exitCode).toBe(0);

      expect(budget.reads.map((entry) => entry.name)).toEqual([
        "readRepository",
        "readLifecycle",
        "readWorkflow",
        "readOpenPullRequests",
        "readDeliveryRequestDetail",
        "readCheckRuns",
        "readWorkItem",
      ]);
      const outbound = budget.reads.filter((entry) => providerReads.has(entry.name));
      expect(outbound).toHaveLength(4);
      for (const name of providerReads) {
        expect(outbound.filter((entry) => entry.name === name)).toHaveLength(1);
      }

      const listCall = budget.reads.find((entry) => entry.name === "readOpenPullRequests");
      expect(listCall?.args).toEqual([100]);
      const checkRunCall = budget.reads.find((entry) => entry.name === "readCheckRuns");
      expect(checkRunCall?.args).toHaveLength(2);
      expect(checkRunCall?.args[1]).toBe(100);
      expect(checkRunCall?.args[0]).toMatch(/^[0-9a-f]{40}$/);

      expect(budget.storeCalls).toContain("read");
      for (const writeCall of [
        "append",
        "replaceDocument",
        "acquireFence",
        "releaseFence",
        "recoverFence",
        "repairTornTail",
      ]) {
        expect(budget.storeCalls).not.toContain(writeCall);
      }
      expect(spawnGuard.violations).toEqual([]);
      expect(networkGuard.calls).toEqual([]);
    } finally {
      networkGuard.restore();
      spawnGuard.restore();
      budget.cleanup();
    }
  });

  test("the guard fixtures reject their forbidden calls", async () => {
    const spawnGuard = createNoSpawnGuard();
    try {
      spawnGuard.install();
      expect(spawnGuard.exerciseForbiddenCall()).toBe(true);
      expect(spawnGuard.violations).toContain("Bun.spawn");
    } finally {
      spawnGuard.restore();
    }
    const networkGuard = createNoNetworkGuard();
    try {
      await expect(globalThis.fetch("https://api.github.example.com")).rejects.toThrow(
        /must not perform a live network call/,
      );
      expect(networkGuard.calls).toHaveLength(1);
    } finally {
      networkGuard.restore();
    }
  });

  test("report, summary, human text, and exit are byte-identical on replay", async () => {
    const first = createBudgetRuntime();
    const second = createBudgetRuntime();
    try {
      const reportA = await runVerify(first.runtime, ["gates", "GH-178"]);
      const reportB = await runVerify(second.runtime, ["gates", "GH-178"]);
      expect(reportB.stdout).toBe(reportA.stdout);
      expect(reportB.exitCode).toBe(reportA.exitCode);

      const humanA = await runVerify(first.runtime, ["gates", "GH-178"], { json: false });
      const humanB = await runVerify(second.runtime, ["gates", "GH-178"], { json: false });
      expect(humanB.stdout).toBe(humanA.stdout);

      const failFirst = createBudgetRuntime(redFacts());
      const failSecond = createBudgetRuntime(redFacts());
      try {
        const failA = await runVerify(failFirst.runtime, ["gates", "GH-178"]);
        const failB = await runVerify(failSecond.runtime, ["gates", "GH-178"]);
        expect(failB.stdout).toBe(failA.stdout);
        expect(failB.exitCode).toBe(failA.exitCode);
      } finally {
        failFirst.cleanup();
        failSecond.cleanup();
      }
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });
});
