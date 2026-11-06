/**
 * TC-MERGE-026 / TC-MERGE-027 — a clean pre-mutation abort is a retryable
 * refusal that converges on re-run, and a recorded contained landing replays
 * idempotently without a second landing.
 */
import { describe, expect, test } from "bun:test";
import {
  baseCheckRuns,
  baseRequest,
  baseWorkItem,
  createFakeGit,
  createMergeHarness,
  MERGE_CLOCK_ISO,
  MERGE_CLOCK_MS,
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

describe("TC-MERGE-026 a clean pre-mutation abort converges", () => {
  test("a state failure before mutation aborts retryably with nothing landed", async () => {
    const git = createFakeGit();
    const harness = createMergeHarness({
      git,
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
      expect(git.operations).not.toContain("squash-land:feat/GH-301/merge");
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.auditRecords).toHaveLength(1);
      expect(harness.auditRecords[0]?.exitCode).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("a git refusal before mutation aborts retryably and converges on re-run", async () => {
    const baseGit = createFakeGit();
    let fail = true;
    const git = {
      ...baseGit,
      land: (input: Parameters<typeof baseGit.land>[0]) =>
        fail ? Promise.resolve({ ok: false as const, code: "squash-failed" }) : baseGit.land(input),
    };
    const harness = createMergeHarness({ git });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const aborted = await harness.run();
      expect(aborted.exitCode).toBe(1);
      expect(errorOf(aborted)?.code).toBe("merge.transaction-aborted");
      expect(harness.transactions()).toHaveLength(0);
      fail = false;
      const converged = await harness.run();
      expect(converged.exitCode).toBe(0);
      expect(harness.transactions()).toHaveLength(1);
      expect(harness.events.filter((event) => event === "git-squash-land")).toHaveLength(2);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-026/027 append faults on convergence paths are declared, never swallowed", () => {
  test("a failed record-less replay append keeps merged and declares the cleanup failure", async () => {
    const git = createFakeGit({ contained: true });
    const harness = createMergeHarness({ git, appendTransactionFault: "state.write.failed" });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      harness.setRequest(
        baseRequest({
          reviewState: "merged",
          headSha: "b1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
        }),
      );
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
      expect(dataOf(result)?.replayed).toBe(true);
      expect(dataOf(result)?.postLanding).toEqual([
        { id: "branch-deletion", status: "not-attempted" },
        { id: "closeout-ready", status: "failed" },
      ]);
      expect(harness.transactions()).toHaveLength(0);
      expect(git.operations).not.toContain("squash-land:feat/GH-301/merge");
      // A re-run after the write fault clears converges with one record and
      // still no second landing.
      harness.setAppendTransactionFault(undefined);
      const replay = await harness.run();
      expect(replay.exitCode).toBe(0);
      expect(dataOf(replay)?.replayed).toBe(true);
      expect(harness.transactions()).toHaveLength(1);
      expect(
        git.operations.filter((operation) => operation.startsWith("squash-land:")),
      ).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("a failed landing-unverified outcome append is declared and re-runs re-verify", async () => {
    const squashSha = "c0ffee00a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const git = createFakeGit({
      land: { ok: true, squashSha, requestState: "open", containedOnBase: true },
    });
    const harness = createMergeHarness({ git, appendTransactionFault: "state.write.failed" });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(2);
      expect(errorOf(result)?.code).toBe("merge.landing-unverified");
      expect(errorOf(result)?.consequence).toBe("unknown");
      expect(String(errorOf(result)?.summary)).toContain("record-append-failed:state.write.failed");
      expect(harness.transactions()).toHaveLength(0);
      expect(
        git.operations.filter((operation) => operation.startsWith("squash-land:")),
      ).toHaveLength(1);
      // The provider now reports the landing; the re-run re-verifies and
      // converges without a second landing.
      harness.setRequest(baseRequest({ reviewState: "merged", headSha: squashSha }));
      harness.setAppendTransactionFault(undefined);
      const replay = await harness.run();
      expect(replay.exitCode).toBe(0);
      expect(dataOf(replay)?.result).toBe("merged");
      expect(
        git.operations.filter((operation) => operation.startsWith("squash-land:")),
      ).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-027 a recorded contained landing replays idempotently", () => {
  test("exit 0 with the same squash SHA, zero git mutations, and no duplicate records", async () => {
    const git = createFakeGit({ contained: true });
    const harness = createMergeHarness({ git });
    try {
      harness.seedTransaction(transactionRecord());
      const result = await harness.run(undefined, { runId: "run-merge-replay" });
      expect(result.exitCode).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
      expect(dataOf(result)?.squashSha).toBe("b1b2c3d4e5f60718293a4b5c6d7e8f9012345678");
      expect(git.operations).toEqual(["read-base-containment"]);
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
      expect(harness.verifications()).toHaveLength(0);
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("a SHA no longer contained is landing-unverified, never a second landing", async () => {
    const git = createFakeGit({ contained: false });
    const harness = createMergeHarness({ git });
    try {
      harness.seedTransaction(transactionRecord());
      const result = await harness.run();
      expect(result.exitCode).toBe(2);
      expect(errorOf(result)?.code).toBe("merge.landing-unverified");
      expect(errorOf(result)?.consequence).toBe("unknown");
      expect(git.operations).not.toContain("squash-land:feat/GH-301/merge");
      expect(harness.transactions()).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("the recorded closeout-ready state is preserved on replay", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedTransaction(transactionRecord());
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
      const result = await harness.run();
      expect(errorOf(result)?.code).not.toBe("merge.state-unverified");
      expect(baseRequest().reviewState).toBe("open");
      expect(baseCheckRuns().items.length).toBeGreaterThan(0);
    } finally {
      harness.cleanup();
    }
  });
});
