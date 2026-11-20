/**
 * TC-MERGE-026 / TC-MERGE-027 / TC-F1-009 / TC-F1-010 / TC-SYNC-005 — a clean
 * pre-mutation abort is a retryable refusal that converges on re-run, and a
 * recorded landing replays idempotently from provider truth with zero landing
 * calls. The delivered local-landing counts are re-pointed at the one composed
 * provider landing call.
 */
import { describe, expect, test } from "bun:test";
import {
  baseRequest,
  baseWorkItem,
  createMergeHarness,
  MERGE_CLOCK_ISO,
  MERGE_CLOCK_MS,
  MERGE_LANDING_SHA,
  MERGE_RUN_ID,
  transactionRecord,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;
const dataOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.data as Record<string, unknown> | undefined;

const gatedWorkItem = () =>
  baseWorkItem({ labels: ["change", "hand-back"], updatedAt: isoAt(-3 * MINUTE) });

const gatedRecord = () =>
  verificationRecord({
    verifiedAt: isoAt(-2 * MINUTE),
    trackerPosture: { labels: ["change", "hand-back"], ownerLabels: ["hand-back"] },
    gates: [
      ...verificationRecord().gates.filter((gate) => gate.id !== "owner-gate"),
      {
        id: "owner-gate",
        verdict: "fail",
        reason: "owner-gate-present",
        citation: {
          sources: [],
          identity: { changeRef: "GH-301" },
          counts: [],
          names: [{ kind: "owner-labels", values: ["hand-back"], omitted: 0 }],
          reasons: ["owner-gate-present"],
        },
      },
    ],
  });

const mergedRequest = () => baseRequest({ reviewState: "merged", headSha: MERGE_LANDING_SHA });

describe("TC-MERGE-026 a clean pre-mutation abort converges", () => {
  test("a state failure before the landing aborts retryably with nothing landed", async () => {
    const harness = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
      appendWaiverFault: "state.lock.busy",
    });
    try {
      harness.seedVerification(gatedRecord());
      const result = await harness.run([
        harness.ref,
        "--waive",
        "owner-gate",
        "--waived-by",
        "owner-principal",
      ]);
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.transaction-aborted");
      expect(errorOf(result)?.retryable).toBe(true);
      expect(errorOf(result)?.consequence).toBe("not_landed");
      expect(harness.counts.landing).toBe(0);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.auditRecords).toHaveLength(1);
      expect(harness.auditRecords[0]?.exitCode).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("a provider refusal before any mutation aborts retryably and converges on re-run", async () => {
    let refuse = true;
    const harness = createMergeHarness({
      landing: () =>
        refuse
          ? ({ ok: false, code: "protection-rule" } as const)
          : ({ ok: true, requestState: "merged", mergeCommitSha: MERGE_LANDING_SHA } as const),
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const aborted = await harness.run();
      expect(aborted.exitCode).toBe(1);
      expect(errorOf(aborted)?.code).toBe("merge.transaction-aborted");
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.counts.landing).toBe(1);
      refuse = false;
      const converged = await harness.run();
      expect(converged.exitCode).toBe(0);
      expect(harness.transactions()).toHaveLength(1);
      expect(harness.counts.landing).toBe(2);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-026/027 append faults on convergence paths are declared, never swallowed", () => {
  test("a failed record-less replay append keeps merged and declares the cleanup failure", async () => {
    const harness = createMergeHarness({ appendTransactionFault: "state.write.failed" });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      harness.setRequest(mergedRequest());
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
      expect(dataOf(result)?.replayed).toBe(true);
      expect(dataOf(result)?.postLanding).toEqual([
        { id: "branch-deletion", status: "not-attempted" },
        { id: "closeout-ready", status: "failed" },
      ]);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.counts.landing).toBe(0);
      // A re-run after the write fault clears converges with one record and
      // still no landing.
      harness.setAppendTransactionFault(undefined);
      const replay = await harness.run();
      expect(replay.exitCode).toBe(0);
      expect(dataOf(replay)?.replayed).toBe(true);
      expect(harness.transactions()).toHaveLength(1);
      expect(harness.counts.landing).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("a failed landing-unverified outcome append is declared and re-runs re-verify", async () => {
    const squashSha = "c0ffee00a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const harness = createMergeHarness({
      landing: { ok: true, requestState: "closed", mergeCommitSha: squashSha },
      appendTransactionFault: "state.write.failed",
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(2);
      expect(errorOf(result)?.code).toBe("merge.landing-unverified");
      expect(errorOf(result)?.consequence).toBe("unknown");
      expect(String(errorOf(result)?.summary)).toContain("record-append-failed:state.write.failed");
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.counts.landing).toBe(1);
      // The provider now reports the landing; the re-run re-verifies and
      // converges without a second landing.
      harness.setRequest(mergedRequest());
      harness.setAppendTransactionFault(undefined);
      const replay = await harness.run();
      expect(replay.exitCode).toBe(0);
      expect(dataOf(replay)?.result).toBe("merged");
      expect(harness.counts.landing).toBe(1);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-027 a recorded landing replays from provider truth", () => {
  test("exit 0 with the same squash SHA, zero landing calls, and no duplicate records", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedTransaction(transactionRecord());
      harness.setRequest(mergedRequest());
      const result = await harness.run(undefined, { runId: "run-merge-replay" });
      expect(result.exitCode).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
      expect(dataOf(result)?.squashSha).toBe(MERGE_LANDING_SHA);
      expect(harness.counts.landing).toBe(0);
      expect(harness.transactions()).toHaveLength(1);
      expect(harness.auditRecords).toHaveLength(1);
      expect(harness.auditRecords[0]?.runId).toBe("run-merge-replay");
      expect(harness.auditRecords[0]?.runId).not.toBe(MERGE_RUN_ID);
    } finally {
      harness.cleanup();
    }
  });

  test("the replay does not require a fresh verification record", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedTransaction(transactionRecord());
      harness.setRequest(mergedRequest());
      expect(harness.verifications()).toHaveLength(0);
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("a provider that no longer asserts merged is landing-unverified, never a second landing", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedTransaction(transactionRecord());
      harness.setRequest(baseRequest({ reviewState: "open", headSha: MERGE_LANDING_SHA }));
      const result = await harness.run();
      expect(result.exitCode).toBe(2);
      expect(errorOf(result)?.code).toBe("merge.landing-unverified");
      expect(errorOf(result)?.consequence).toBe("unknown");
      expect(harness.counts.landing).toBe(0);
      expect(harness.transactions()).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("the recorded closeout-ready state is preserved on replay", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedTransaction(transactionRecord());
      harness.setRequest(mergedRequest());
      const result = await harness.run();
      const postLanding = dataOf(result)?.postLanding as readonly {
        id: string;
        status: string;
      }[];
      expect(postLanding).toEqual([
        { id: "branch-deletion", status: "ok" },
        { id: "closeout-ready", status: "ok" },
      ]);
    } finally {
      harness.cleanup();
    }
  });

  test("the replay emits no state-unverified", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedTransaction(transactionRecord({ recordedAt: MERGE_CLOCK_ISO }));
      harness.setRequest(mergedRequest());
      const result = await harness.run();
      expect(errorOf(result)?.code).not.toBe("merge.state-unverified");
    } finally {
      harness.cleanup();
    }
  });
});
