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
import type { CrossRepositoryVerifyGatesReport } from "../../packages/core/src/contracts/index";
import {
  readChangeTransitionsTolerant,
  readMergeGateVerifications,
} from "../../packages/core/src/state/index";
import { API_MEMBER, CHANGE_REF, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  memberGatesRuntime,
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import { createNoSpawnGuard } from "../fixtures/result/no-spawn-guard";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";
import {
  combinedRuntime,
  gatesRuntime,
  pmNotesValue,
  runVerify,
} from "../fixtures/verify-gates/cases/harness";
import { createNoNetworkGuard } from "../fixtures/verify-gates/cases/network-guard";
import {
  createVerifyGatesProductionHarness,
  VG_PROD_REF,
} from "../fixtures/verify-gates/production-composition";
import {
  appendLanding,
  createVerifyRecorder,
  createVerifyState,
  guardStore,
  type VerifyCallRecorder,
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

describe("TC-XCTR-006 per-member read budget", () => {
  test("one read bundle per declared member, zero retries, no out-of-set call", async () => {
    const readLog: string[] = [];
    const world = {
      members: [
        declaredMember(API_MEMBER, { gates: ["ci-green"] }),
        declaredMember(WEB_MEMBER, { gates: ["ci-green"] }),
      ],
      reads: {
        [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
        [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
      },
      landings: [landingObservation(API_MEMBER, true, 1), landingObservation(WEB_MEMBER, false)],
      readLog,
    };
    const spawnGuard = createNoSpawnGuard();
    const networkGuard = createNoNetworkGuard();
    try {
      spawnGuard.install();
      const result = await runMemberGates(world);
      expect(result.exitCode).toBe(0);
      expect(readLog).toEqual([API_MEMBER.repoKey, WEB_MEMBER.repoKey]);
      expect(new Set(readLog).size).toBe(readLog.length);

      const withoutLanding = await runMemberGates({ ...world, landings: undefined });
      expect(withoutLanding.exitCode).toBe(0);
      expect(readLog).toHaveLength(4);
      const firstData = JSON.parse(result.stdout) as {
        readonly data: CrossRepositoryVerifyGatesReport;
      };
      const secondData = JSON.parse(withoutLanding.stdout) as {
        readonly data: CrossRepositoryVerifyGatesReport;
      };
      expect(firstData.data.definitionOfDone.evidence).not.toEqual(
        secondData.data.definitionOfDone.evidence,
      );
      expect(spawnGuard.violations).toEqual([]);
      expect(networkGuard.calls).toEqual([]);

      // Exactly one gate-verification record per battery evaluation, whatever
      // the member count (DoD-12): the append seam is called once.
      let appends = 0;
      const counted = memberGatesRuntime(world);
      const countedGates = counted.gates;
      if (countedGates === undefined) throw new Error("missing gates runtime");
      const appended = await runVerify(
        {
          ...counted,
          gates: {
            ...countedGates,
            appendVerification: () => {
              appends += 1;
              return { ok: true as const };
            },
          },
        },
        ["gates", CHANGE_REF],
      );
      expect(appended.exitCode).toBe(0);
      expect(appends).toBe(1);
    } finally {
      networkGuard.restore();
      spawnGuard.restore();
    }
  });
});

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

import type { VerifySuiteMapRead } from "../../packages/core/src/contracts/index";
import {
  declaredRead,
  narrowedMap,
  REFERENCE_JOB,
  validEqualityMap,
} from "../fixtures/verify-gates/suite-map/cases";

const suiteMapBudgetFacts = () => {
  const facts = clone(baseFacts());
  const names = [...new Set([...EXPECTED_JOBS, REFERENCE_JOB])];
  facts.workflow = { outcome: "read", names };
  facts.checkRuns = {
    ok: true,
    value: { items: names.map((name) => run(name, "succeeded")), pageItemCount: names.length },
  };
  return facts;
};

const suiteMapBudget = () => {
  const reads: RecordedRead[] = [];
  const mapReads: string[] = [];
  const base = gatesRuntime({ facts: suiteMapBudgetFacts() });
  const record =
    <Args extends readonly unknown[], Result>(name: string, call: (...args: Args) => Result) =>
    (...args: Args): Result => {
      reads.push({ name, args });
      return call(...args);
    };
  const suiteFacts = suiteMapBudgetFacts();
  const runtime: VerifyGatesCommandRuntime = {
    ...base,
    readLifecycle: record("readLifecycle", base.readLifecycle),
    readRepository: record("readRepository", base.readRepository),
    readWorkflow: record("readWorkflow", base.readWorkflow),
    readOpenPullRequests: record("readOpenPullRequests", base.readOpenPullRequests),
    readDeliveryRequestDetail: record("readDeliveryRequestDetail", base.readDeliveryRequestDetail),
    readCheckRuns: record("readCheckRuns", base.readCheckRuns),
    readWorkItem: record("readWorkItem", base.readWorkItem),
  };
  return {
    reads,
    mapReads,
    runtime: (map: VerifySuiteMapRead): VerifyGatesCommandRuntime => ({
      ...runtime,
      readSuiteMap: () => {
        mapReads.push("readSuiteMap");
        return map;
      },
    }),
    facts: suiteFacts,
  };
};

describe("TC-SPAR-004 the map adds no source read and exactly one resolution attempt", () => {
  test("the seven enumerable source counts are identical with and without a map", async () => {
    const budget = suiteMapBudget();
    const withoutMap = await runVerify(
      {
        ...combinedRuntime({ facts: budget.facts }),
        gates: budget.runtime({ ok: true, declared: false }),
      },
      ["gates", "GH-300"],
    );
    expect(withoutMap.exitCode).toBe(0);
    const firstReads = budget.reads.map((entry) => entry.name);
    const firstCount = firstReads.length;
    budget.reads.length = 0;
    budget.mapReads.length = 0;

    const withMap = await runVerify(
      {
        ...combinedRuntime({ facts: budget.facts }),
        gates: budget.runtime(declaredRead(validEqualityMap())()),
      },
      ["gates", "GH-300"],
    );
    expect(withMap.exitCode).toBe(0);
    expect(budget.reads.map((entry) => entry.name)).toEqual(firstReads);
    expect(budget.reads.length).toBe(firstCount);
    expect(budget.mapReads).toEqual(["readSuiteMap"]);
  });

  test("the single workflow read feeds the CI gate and the corroboration", async () => {
    const budget = suiteMapBudget();
    await runVerify(
      {
        ...combinedRuntime({ facts: budget.facts }),
        gates: budget.runtime(declaredRead(validEqualityMap())()),
      },
      ["gates", "GH-300"],
    );
    expect(budget.reads.filter((entry) => entry.name === "readWorkflow")).toHaveLength(1);
    const provider = new Set([
      "readOpenPullRequests",
      "readDeliveryRequestDetail",
      "readCheckRuns",
      "readWorkItem",
    ]);
    for (const name of provider) {
      expect(budget.reads.filter((entry) => entry.name === name)).toHaveLength(1);
    }
  });

  test("a defective map performs zero enumerable source reads", async () => {
    const budget = suiteMapBudget();
    const result = await runVerify(
      {
        ...combinedRuntime({ facts: budget.facts }),
        gates: budget.runtime({ ok: false, code: "config.value.invalid" }),
      },
      ["gates", "GH-300"],
    );
    expect(result.exitCode).toBe(1);
    expect(budget.reads).toEqual([]);
    expect(budget.mapReads).toEqual(["readSuiteMap"]);
  });

  test("a narrowed member-less run reads the same seven sources as a non-narrowed run", async () => {
    const budget = suiteMapBudget();
    await runVerify(
      {
        ...combinedRuntime({ facts: budget.facts }),
        gates: budget.runtime({ ok: true, declared: false }),
      },
      ["gates", "GH-300"],
    );
    const control = budget.reads.map((entry) => entry.name);
    budget.reads.length = 0;
    const narrowed = await runVerify(
      {
        ...combinedRuntime({ facts: budget.facts }),
        gates: budget.runtime(declaredRead(narrowedMap())()),
      },
      ["gates", "GH-300"],
    );
    expect(narrowed.exitCode).toBe(1);
    expect(budget.reads.map((entry) => entry.name)).toEqual(control);
    expect(budget.reads).toHaveLength(control.length);
  });
});

describe("TC-VGATES-074 the production budget holds with the append wired", () => {
  /** Per-provider-source counts over one recorded transport (structural bounds, never wall-clock). */
  const sourceCounts = (urls: readonly string[]) => ({
    list: urls.filter((url) => url.includes("/pulls?")).length,
    detail: urls.filter((url) => url.includes("/pulls/") && !url.endsWith("/merge")).length,
    checks: urls.filter((url) => url.includes("/check-runs")).length,
    workItem: urls.filter((url) => url.includes("/issues/")).length,
    landing: urls.filter((url) => url.endsWith("/merge")).length,
  });

  test("the shipped verify gates pass cell performs exactly the delivered provider reads", async () => {
    const networkGuard = createNoNetworkGuard();
    const harness = createVerifyGatesProductionHarness({ label: "gh388-budget-pass" });
    try {
      const result = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      expect(result.exitCode).toBe(0);
      const counts = sourceCounts(harness.transportCalls);
      // At most one page or item per provider source, no pagination.
      expect(counts.list).toBe(1);
      expect(counts.detail).toBe(1);
      expect(counts.checks).toBe(1);
      expect(counts.workItem).toBe(1);
      expect(counts.landing).toBe(0);
      // No pagination: every outbound URL is unique.
      expect(new Set(harness.transportCalls).size).toBe(harness.transportCalls.length);
      expect(networkGuard.calls).toEqual([]);
    } finally {
      networkGuard.restore();
      harness.dispose();
    }
  });

  test("the fail and credential-unavailable cells add no provider reads", async () => {
    const networkGuard = createNoNetworkGuard();
    try {
      // The fail cell: the battery still reads each source once, then fails.
      const failHarness = createVerifyGatesProductionHarness({
        label: "gh388-budget-fail",
      });
      failHarness.setReply((url) => {
        if (url.includes("/check-runs")) {
          return {
            status: 200,
            body: {
              check_runs: ["CI / test", "CI / lint"].map((name, index) => ({
                id: 9001 + index,
                name,
                status: "completed",
                conclusion: "failure",
              })),
            },
          };
        }
        return failHarness.defaultReply(url);
      });
      try {
        const fail = await failHarness.run(["--json", "verify", "gates", VG_PROD_REF]);
        expect(fail.exitCode).toBe(1);
        const failCounts = sourceCounts(failHarness.transportCalls);
        expect(failCounts.list).toBe(1);
        expect(failCounts.detail).toBe(1);
        expect(failCounts.checks).toBe(1);
        expect(failCounts.workItem).toBe(1);
        expect(failCounts.landing).toBe(0);
      } finally {
        failHarness.dispose();
      }
      // The credential-unavailable refusal: no provider transport at all.
      const credentialHarness = createVerifyGatesProductionHarness({
        label: "gh388-budget-credential",
        credential: "missing",
      });
      try {
        const credential = await credentialHarness.run(["--json", "verify", "gates", VG_PROD_REF]);
        expect(credential.exitCode).toBe(1);
        expect(
          credentialHarness.transportCalls.filter((url) => url.includes("api.github")),
        ).toEqual([]);
      } finally {
        credentialHarness.dispose();
      }
      expect(networkGuard.calls).toEqual([]);
    } finally {
      networkGuard.restore();
    }
  });

  test("the merge consumption path keeps the delivered budget over a shipped record", async () => {
    const networkGuard = createNoNetworkGuard();
    const harness = createVerifyGatesProductionHarness({ label: "gh388-budget-merge" });
    try {
      const verify = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      expect(verify.exitCode).toBe(0);
      const merge = await harness.run(["--json", "merge", VG_PROD_REF]);
      expect(merge.exitCode).toBe(0);
      const counts = sourceCounts(harness.transportCalls);
      // Per source across the native sequence: the verify battery's one read
      // plus the merge's one read (resolution, tracker, probe, LF-1), and
      // exactly one landing call.
      expect(counts.list).toBe(2);
      expect(counts.detail).toBe(2);
      expect(counts.checks).toBe(2);
      expect(counts.workItem).toBe(2);
      expect(counts.landing).toBe(1);
      expect(networkGuard.calls).toEqual([]);
    } finally {
      networkGuard.restore();
      harness.dispose();
    }
  });

  test("the append contract's state reads are the append's own shape, never provider reads", async () => {
    const networkGuard = createNoNetworkGuard();
    const recorder: VerifyCallRecorder = { calls: [] };
    const harness = createVerifyGatesProductionHarness({
      label: "gh388-budget-append-shape",
      stateStoreWrap: (inner) => guardStore(inner, recorder, { throwOnMutation: false }).store,
    });
    try {
      const result = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      expect(result.exitCode).toBe(0);
      // The delivered fenced append contract per append: read-before,
      // acquireFence, append, read-after, releaseFence — counted and asserted
      // against the append's own shape, never conflated with provider or
      // configuration reads.
      const appends = recorder.calls.filter((call) => call === "append");
      expect(appends).toHaveLength(1);
      expect(recorder.calls.filter((call) => call === "acquireFence")).toHaveLength(1);
      expect(recorder.calls.filter((call) => call === "releaseFence")).toHaveLength(1);
      expect(recorder.calls.filter((call) => call === "readRecords")).toHaveLength(2);
      expect(recorder.calls.filter((call) => call === "replaceDocument")).toHaveLength(0);
      // The ledger gained exactly the one record.
      const read = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(read.ok && read.records).toHaveLength(1);
      expect(networkGuard.calls).toEqual([]);
    } finally {
      networkGuard.restore();
      harness.dispose();
    }
  });
});
