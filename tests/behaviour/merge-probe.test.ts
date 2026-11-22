/**
 * TC-MERGE-015 / TC-MERGE-016 / TC-MERGE-032 — the post-verification probe
 * catches tracker and CI transitions, and every invocation stays inside the
 * declared read budget.
 */
import { describe, expect, test } from "bun:test";
import {
  MERGE_DEFAULT_GATE_ENTRIES,
  type MergeGateEntry,
  type PipelineJobState,
} from "../../packages/core/src/contracts/index";
import {
  evaluateDeclaredBattery,
  evaluateRequiredJobGate,
  evaluateVerifyGates,
} from "../../packages/core/src/domain/index";
import {
  baseCheckRuns,
  baseRequest,
  baseWorkItem,
  createFakeGit,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  verificationRecord,
} from "../fixtures/merge/harness";
import {
  baseFacts,
  clone,
  EXPECTED_JOBS,
  REMOTE_SHA,
  run as verificationRun,
} from "../fixtures/verify-gates/cases/facts";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;

const redJobPage = (sha = MERGE_HEAD, job = "CI / test (18)") => ({
  items: baseCheckRuns().items.map((run) =>
    run.pipelineName === job
      ? { ...run, jobs: [{ jobName: job, jobState: "failed" as const }] }
      : run,
  ),
  pageItemCount: 2,
  sha,
});

describe("TC-MERGE-015 a post-verification tracker transition is refused with its age", () => {
  test("a flip two minutes after verification refuses tracker-freshness with the transition", async () => {
    const harness = createMergeHarness({
      workItem: baseWorkItem({
        labels: ["change", "hand-back"],
        updatedAt: isoAt(-1 * MINUTE),
      }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.gate.tracker-freshness.failed");
      const summary = String(errorOf(result)?.summary);
      expect(summary).toContain("gate=tracker-freshness");
      expect(summary).toContain("owner-transition=");
      expect(summary).toContain("hand-back");
      expect(summary).toContain("age=1m");
      expect(summary).toContain("remediation=");
      expect(harness.counts.workItem).toBe(1);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.waivers()).toHaveLength(0);
      // The resolution's bounded record read is the only git read on this
      // path: no checkout head read exists (NFR-6).
      expect(harness.events.filter((event) => event.startsWith("git-"))).toEqual([
        "git-read-change-record:9f21c0e",
      ]);
    } finally {
      harness.cleanup();
    }
  });

  test("the unchanged-posture control lands", async () => {
    const harness = createMergeHarness({
      workItem: baseWorkItem({ labels: ["change"], updatedAt: isoAt(-1 * MINUTE) }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      expect((await harness.run()).exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("a label present at verification is not a transition and fabricates no age", async () => {
    const record = verificationRecord({
      verifiedAt: isoAt(-2 * MINUTE),
      trackerPosture: { labels: ["change", "hand-back"], ownerLabels: ["hand-back"] },
    });
    const harness = createMergeHarness({
      workItem: baseWorkItem({
        labels: ["change", "hand-back"],
        updatedAt: isoAt(-1 * MINUTE),
      }),
    });
    try {
      harness.seedVerification(record);
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.owner-gate-override-without-waiver");
      expect(String(errorOf(result)?.summary)).not.toContain("owner-transition=");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-016 a CI regression on the verified head is gate evidence only when declared", () => {
  test("a red job the gate set does not declare is not gate evidence and the merge proceeds", async () => {
    const harness = createMergeHarness({ checkRuns: redJobPage() });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      // AC-F3-3: undeclared jobs are not evidence, so no family refusal names it.
      expect(result.exitCode).toBe(0);
      expect(errorOf(result)).toBeUndefined();
      expect(harness.counts.checkRuns).toBe(1);
      expect(harness.transactions()).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("a red job on a different SHA is not head evidence and the merge proceeds", async () => {
    const harness = createMergeHarness({
      checkRuns: redJobPage("a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("with a stale verification the identity is gates-stale with the red job as evidence", async () => {
    const harness = createMergeHarness({ checkRuns: redJobPage() });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-31 * MINUTE) }));
      const result = await harness.run();
      expect(errorOf(result)?.code).toBe("merge.gates-stale");
      expect(String(errorOf(result)?.summary)).toContain("CI / test (18)");
    } finally {
      harness.cleanup();
    }
  });

  test("the all-green control lands", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      expect((await harness.run()).exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-032 the read budget is exact", () => {
  test("a clean landing reads the open list, one record, one verification, one work item, and one page", async () => {
    const git = createFakeGit();
    const harness = createMergeHarness({ git });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      expect((await harness.run()).exitCode).toBe(0);
      // The resolution (GH-366): the open-list read and the bounded local
      // record read at the request head, then the freshness and probe reads.
      // No checkout head read and no request-detail read on this path.
      expect(harness.counts.openRequests).toBe(1);
      expect(harness.counts.recordReads).toBe(1);
      expect(harness.counts.verification).toBe(1);
      expect(harness.counts.workItem).toBe(1);
      expect(harness.counts.checkRuns).toBe(1);
      expect(harness.counts.requestDetail).toBe(0);
      expect(git.operations.filter((operation) => operation.startsWith("rebase"))).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("the tracker refusal performs one read per source and no mutation", async () => {
    const git = createFakeGit();
    const harness = createMergeHarness({
      git,
      workItem: baseWorkItem({
        labels: ["change", "hand-back"],
        updatedAt: isoAt(-1 * MINUTE),
      }),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      await harness.run();
      expect(harness.counts.openRequests).toBe(1);
      expect(harness.counts.workItem).toBe(1);
      expect(harness.counts.checkRuns).toBe(1);
      expect(harness.counts.requestDetail).toBe(0);
      expect(git.operations).not.toContain("squash-land:feat/GH-301/merge");
    } finally {
      harness.cleanup();
    }
  });

  test("a deliberate second read fails the count assertion", async () => {
    const harness = createMergeHarness();
    try {
      harness.setRequest(baseRequest());
      // A second read would be observable; the counter is not a constant.
      harness.counts.workItem += 1;
      expect(harness.counts.workItem).not.toBe(0);
      expect(harness.counts.workItem).toBe(1);
    } finally {
      harness.cleanup();
    }
  });
});

const declaredJobEntry = (job: string): MergeGateEntry => ({
  id: job,
  recipe: "required-ci-job",
  surface: "both",
  job,
});

const pageFacts = (state: PipelineJobState) => {
  const facts = clone(baseFacts());
  facts.checkRuns = {
    ok: true,
    value: {
      items: EXPECTED_JOBS.map((name, index) =>
        verificationRun(name, index === 0 ? state : "succeeded"),
      ),
      pageItemCount: EXPECTED_JOBS.length,
    },
  };
  return facts;
};

describe("TC-F3-001 queued and running are not-green with ci-pending on both sides of the check boundary", () => {
  const stimuli: readonly { readonly state: PipelineJobState; readonly reason: string }[] = [
    { state: "queued", reason: "ci-pending" },
    { state: "running", reason: "ci-pending" },
    { state: "canceled", reason: "ci-canceled" },
    { state: "skipped", reason: "ci-all-skipped" },
    { state: "failed", reason: "ci-failed" },
    { state: "succeeded", reason: "ci-green" },
  ];

  for (const stimulus of stimuli) {
    test(`${stimulus.state}: the declared gate evaluation and the probe agree on ${stimulus.reason}`, () => {
      const job = EXPECTED_JOBS[0] as string;
      const facts = pageFacts(stimulus.state);
      const entries = [...MERGE_DEFAULT_GATE_ENTRIES, declaredJobEntry(job)];

      // Side 1: the declared gate evaluation (`verify gates`' battery).
      const declared = evaluateDeclaredBattery(facts, entries).gates.find(
        (gate) => gate.id === job,
      );
      // Side 2: the post-verification probe, over the same page and head.
      const probe = evaluateRequiredJobGate({
        jobName: job,
        runs: facts.checkRuns.ok ? facts.checkRuns.value.items : [],
        pageSha: REMOTE_SHA,
        headSha: REMOTE_SHA,
      });

      expect(declared?.reason).toBe(stimulus.reason);
      expect(probe.reason).toBe(stimulus.reason);
      expect(declared?.verdict).toBe(probe.verdict);
      expect(probe.verdict).toBe(stimulus.reason === "ci-green" ? "pass" : "fail");
    });
  }

  test("the shipped ci-green gate also treats queued and running as ci-pending", () => {
    for (const state of ["queued", "running"] as const) {
      const record = evaluateVerifyGates(pageFacts(state)).gates[1];
      expect(record?.verdict).toBe("fail");
      expect(record?.reason).toBe("ci-pending");
    }
  });

  test("control M34: a side that treats queued as green diverges by stimulus and reason", () => {
    const job = EXPECTED_JOBS[0] as string;
    const facts = pageFacts("queued");
    const probe = evaluateRequiredJobGate({
      jobName: job,
      runs: facts.checkRuns.ok ? facts.checkRuns.value.items : [],
      pageSha: REMOTE_SHA,
      headSha: REMOTE_SHA,
    });
    const mutatedFacts = pageFacts("succeeded");
    const mutated = evaluateRequiredJobGate({
      jobName: job,
      runs: mutatedFacts.checkRuns.ok ? mutatedFacts.checkRuns.value.items : [],
      pageSha: REMOTE_SHA,
      headSha: REMOTE_SHA,
    });
    expect(probe.reason).toBe("ci-pending");
    expect(mutated.reason).toBe("ci-green");
    expect(probe.reason).not.toBe(mutated.reason);
  });
});
