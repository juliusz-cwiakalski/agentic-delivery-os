/**
 * TC-MERGE-028 — `merge --dry-run` evaluates the merge-applicable battery,
 * appends exactly one verification record, lands nothing, and never claims a
 * merge or records a waiver.
 */
import { describe, expect, test } from "bun:test";
import {
  MERGE_DEFAULT_GATE_ENTRIES,
  OWNER_GATE_SLA_POLICY,
} from "../../packages/core/src/contracts/index";
import {
  baseCheckRuns,
  baseWorkItem,
  createMergeHarness,
  declaredGateSetWith,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const declaredWith = (jobState: "succeeded" | "failed") => {
  const declared = declaredGateSetWith([
    ...MERGE_DEFAULT_GATE_ENTRIES,
    { id: "workspace-tests", recipe: "required-ci-job", surface: "both", job: "workspace-tests" },
  ]);
  const base = baseCheckRuns();
  return {
    gateSet: declared,
    checkRuns: {
      items: [
        ...base.items,
        {
          identity: { systemName: "github", entityId: "44899" },
          pipelineName: "workspace-tests",
          jobs: [{ jobName: "workspace-tests", jobState }],
          traceEvidence: [],
        },
      ],
      pageItemCount: base.pageItemCount + 1,
      sha: MERGE_HEAD,
    },
  };
};

describe("TC-MERGE-028 dry-run records and lands nothing", () => {
  test("the passing dry run exits 0, records once, mutates nothing, and never claims a merge", async () => {
    const fixture = declaredWith("succeeded");
    const harness = createMergeHarness(fixture);
    try {
      const result = await harness.run([harness.ref, "--dry-run"], { json: false });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("result=verified");
      expect(result.stdout).not.toContain("result=merged");
      expect(result.stdout).not.toContain("squash=");
      expect(harness.verifications()).toHaveLength(1);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.waivers()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("a failing merge-applicable gate refuses at exit 1 and still records exactly once", async () => {
    const fixture = declaredWith("failed");
    const harness = createMergeHarness(fixture);
    try {
      const result = await harness.run([harness.ref, "--dry-run"]);
      expect(result.exitCode).toBe(1);
      expect((result.envelope?.error as Record<string, unknown> | undefined)?.code).toBe(
        "merge.gate.workspace-tests.failed",
      );
      expect(harness.verifications()).toHaveLength(1);
      expect(harness.transactions()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("the operator loop works: a dry-run record is consumable by a real merge", async () => {
    const harness = createMergeHarness();
    try {
      const dry = await harness.run([harness.ref, "--dry-run"]);
      expect(dry.exitCode).toBe(0);
      const real = await harness.run();
      expect(real.exitCode).toBe(0);
      expect((real.envelope?.data as { result?: string } | undefined)?.result).toBe("merged");
      expect(harness.verifications()).toHaveLength(1);
      expect(harness.transactions()).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("an authorized declaration is reported but records no waiver; the real merge records it", async () => {
    const harness = createMergeHarness({
      workItem: baseWorkItem({ labels: ["change", "hand-back"], updatedAt: isoAt(-3 * MINUTE) }),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(
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
        }),
      );
      const declaration = ["--waive", "owner-gate", "--waived-by", "owner-principal"];
      const dry = await harness.run([harness.ref, "--dry-run", ...declaration], { json: false });
      expect(dry.exitCode).toBe(0);
      expect(dry.stdout).toContain("waiver=owner-gate:authorized");
      expect(harness.waivers()).toHaveLength(0);
      const real = await harness.run([harness.ref, ...declaration]);
      expect(real.exitCode).toBe(0);
      expect(harness.waivers()).toHaveLength(1);
      expect(harness.waivers()[0]?.authorizer).toBe("owner-principal");
    } finally {
      harness.cleanup();
    }
  });

  test("an invalid invocation appends no record", async () => {
    const harness = createMergeHarness();
    try {
      const result = await harness.run([harness.ref, "--unknown-flag"]);
      expect(result.exitCode).toBe(1);
      expect(harness.verifications()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("the dry-run report carries the identity but never the transaction result", async () => {
    const harness = createMergeHarness();
    try {
      const result = await harness.run([harness.ref, "--dry-run"]);
      const data = result.envelope?.data as Record<string, unknown> | undefined;
      expect(data?.result).toBe("verified");
      expect(data?.headSha).toBe(MERGE_HEAD);
      expect(Object.hasOwn(data ?? {}, "squashSha")).toBe(false);
      expect(Object.hasOwn(data ?? {}, "transactions")).toBe(false);
    } finally {
      harness.cleanup();
    }
  });
});
