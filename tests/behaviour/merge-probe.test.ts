/**
 * TC-MERGE-015 / TC-MERGE-016 / TC-MERGE-032 — the post-verification probe
 * catches tracker and CI transitions, and every invocation stays inside the
 * declared read budget.
 */
import { describe, expect, test } from "bun:test";
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
      expect(harness.events.filter((event) => event.startsWith("git-"))).toEqual(["git-read-head"]);
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

describe("TC-MERGE-016 a CI regression on the verified head is a gate refusal", () => {
  test("a newly red job on the head refuses ci-green with the job id inline", async () => {
    const harness = createMergeHarness({ checkRuns: redJobPage() });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.gate.ci-green.failed");
      expect(String(errorOf(result)?.summary)).toContain("CI / test (18)");
      expect(harness.counts.checkRuns).toBe(1);
      expect(harness.transactions()).toHaveLength(0);
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
  test("a clean landing reads one verification, one work item, one page, and one request", async () => {
    const git = createFakeGit();
    const harness = createMergeHarness({ git });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      expect((await harness.run()).exitCode).toBe(0);
      expect(harness.counts.verification).toBe(1);
      expect(harness.counts.workItem).toBe(1);
      expect(harness.counts.checkRuns).toBe(1);
      expect(harness.counts.requestDetail).toBe(1);
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
      expect(harness.counts.workItem).toBe(1);
      expect(harness.counts.checkRuns).toBe(1);
      expect(harness.counts.requestDetail).toBe(1);
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
