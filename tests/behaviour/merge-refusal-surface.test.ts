/**
 * TC-MERGE-012 / TC-MERGE-013 — every refusal names its condition with inline
 * evidence and a remediation hint; scripted mode renders the shipped failure
 * envelope (`error` + `runId`, no `data`).
 */
import { describe, expect, test } from "bun:test";
import { MERGE_DEFAULT_GATE_ENTRIES } from "../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../packages/core/src/domain/merge-gate-set";
import {
  type MergeFailure,
  renderMergeFailure,
} from "../../packages/core/src/domain/merge-transaction";
import {
  baseCheckRuns,
  baseRequest,
  baseWorkItem,
  createFakeGit,
  createMergeHarness,
  declaredGateSetWith,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  type MergeHarness,
  verificationFor,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

type Case = {
  readonly code: string;
  readonly exit: number;
  readonly harness: MergeHarness;
  readonly flags: readonly string[];
};

const cases = (): Case[] => {
  const stale = createMergeHarness();
  stale.seedVerification(verificationRecord({ verifiedAt: isoAt(-31 * MINUTE) }));

  const declared = declaredGateSetWith([
    ...MERGE_DEFAULT_GATE_ENTRIES,
    { id: "workspace-tests", recipe: "required-ci-job", surface: "both", job: "workspace-tests" },
  ]);
  const set = resolveMergeGateSet(declared);
  if (!set.ok) throw new Error("fixture invalid");
  const gateFailure = createMergeHarness({
    gateSet: declared,
    checkRuns: {
      items: [
        ...baseCheckRuns().items,
        {
          identity: { systemName: "github", entityId: "44899" },
          pipelineName: "workspace-tests",
          jobs: [{ jobName: "workspace-tests", jobState: "failed" }],
          traceEvidence: [],
        },
      ],
      pageItemCount: 3,
      sha: MERGE_HEAD,
    },
  });
  gateFailure.seedVerification(verificationFor(set.value, { verifiedAt: isoAt(-2 * MINUTE) }));

  const tracker = createMergeHarness({
    workItem: baseWorkItem({
      labels: ["change", "hand-back"],
      updatedAt: isoAt(-1 * MINUTE),
    }),
  });
  tracker.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));

  const ownerGatedRecord = verificationRecord({
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
  const ownerGatedWork = baseWorkItem({
    labels: ["change", "hand-back"],
    updatedAt: isoAt(-3 * MINUTE),
  });
  const unauthorized = createMergeHarness({ workItem: ownerGatedWork });
  unauthorized.seedVerification(ownerGatedRecord);
  const withoutWaiver = createMergeHarness({ workItem: ownerGatedWork });
  withoutWaiver.seedVerification(ownerGatedRecord);

  const conflictGit = createFakeGit({
    refresh: {
      outcome: "conflicted",
      paths: ["packages/core/src/a.ts", "packages/core/src/b.ts"],
    },
  });
  const conflict = createMergeHarness({
    request: baseRequest({ mergeableState: "conflicting" }),
    git: conflictGit,
  });
  conflict.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));

  const aborted = createMergeHarness({
    workItem: ownerGatedWork,
    ownerPrincipal: "owner-principal",
    appendWaiverFault: "state.lock.busy",
  });
  aborted.seedVerification(ownerGatedRecord);

  const unverified = createMergeHarness();

  return [
    { code: "merge.gates-stale", exit: 1, harness: stale, flags: [] },
    { code: "merge.gate.workspace-tests.failed", exit: 1, harness: gateFailure, flags: [] },
    { code: "merge.gate.tracker-freshness.failed", exit: 1, harness: tracker, flags: [] },
    {
      code: "merge.waiver-unauthorized",
      exit: 1,
      harness: unauthorized,
      flags: ["--waive", "owner-gate", "--waived-by", "someone-else"],
    },
    {
      code: "merge.owner-gate-override-without-waiver",
      exit: 1,
      harness: withoutWaiver,
      flags: [],
    },
    { code: "merge.rebase-conflict", exit: 1, harness: conflict, flags: [] },
    {
      code: "merge.transaction-aborted",
      exit: 1,
      harness: aborted,
      flags: ["--waive", "owner-gate", "--waived-by", "owner-principal"],
    },
    { code: "merge.state-unverified", exit: 2, harness: unverified, flags: [] },
  ];
};

describe("TC-MERGE-012 every refusal is legible and safe", () => {
  test("each refusal names its condition, evidence, and remediation, and never exits 0", async () => {
    for (const entry of cases()) {
      try {
        const result = await entry.harness.run([entry.harness.ref, ...entry.flags], {
          json: false,
        });
        expect(result.exitCode, entry.code).toBe(entry.exit);
        expect(result.stderr, entry.code).toContain("result=refused");
        expect(result.stderr, entry.code).toContain(`condition=${entry.code}`);
        expect(result.stderr, entry.code).toContain("remediation=");
        expect(result.stdout, entry.code).not.toContain("squash=");
        expect(entry.harness.transactions(), entry.code).toHaveLength(0);
      } finally {
        entry.harness.cleanup();
      }
    }
  });

  test("the unauthorized case names the gate, class, and authorizer; no waiver record exists", async () => {
    const harness = createMergeHarness({
      workItem: baseWorkItem({ labels: ["change", "hand-back"], updatedAt: isoAt(-3 * MINUTE) }),
    });
    try {
      const record = verificationRecord({
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
      harness.seedVerification(record);
      const result = await harness.run(
        [harness.ref, "--waive", "owner-gate", "--waived-by", "someone-else"],
        { json: false },
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("merge.waiver-unauthorized");
      expect(result.stderr).toContain("owner-review");
      expect(result.stderr).toContain("someone-else");
      expect(harness.waivers()).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("the success fixture keeps result=merged and squash= in text mode", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run(undefined, { json: false });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("result=merged");
      expect(result.stdout).toContain("squash=");
    } finally {
      harness.cleanup();
    }
  });

  test("removing the named gate from the evidence drops it by name (mutation control)", () => {
    const failure: MergeFailure = {
      code: "merge.gate.ci-green.failed",
      domainKind: "merge",
      exit: 1,
      evidence: { gateId: "ci-green", jobs: ["CI / test (18)"] },
    };
    expect(renderMergeFailure(failure)).toContain("gate=ci-green");
    expect(renderMergeFailure({ ...failure, evidence: {} })).not.toContain("gate=ci-green");
  });
});

describe("TC-MERGE-013 scripted refusals use the shipped failure envelope", () => {
  test("one minified line with error + runId, no data, no schemaVersion or timing", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-31 * MINUTE) }));
      const result = await harness.run(undefined, { json: true, mode: "scripted" });
      expect(result.exitCode).toBe(1);
      expect(result.stdout.trim().split("\n")).toHaveLength(1);
      const parsed = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
      expect(Object.keys(parsed).sort()).toEqual(["error", "runId"]);
      expect(Object.hasOwn(parsed, "data")).toBe(false);
      expect(Object.hasOwn(parsed, "schemaVersion")).toBe(false);
      expect(Object.hasOwn(parsed, "timing")).toBe(false);
      const error = parsed.error as Record<string, unknown>;
      expect(error.code).toBe("merge.gates-stale");
      expect(error.category).toBe("user");
      expect(error.retryable).toBe(false);
      expect(error.consequence).toBe("not_landed");
      expect(typeof error.remediationHint).toBe("string");
      expect(result.stdout).not.toContain('{"data":{"result":"refused"}}');
    } finally {
      harness.cleanup();
    }
  });

  test("text mode still carries result=refused while the machine identity is the code", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-31 * MINUTE) }));
      const result = await harness.run(undefined, { json: false });
      expect(result.stderr).toContain("result=refused");
      expect(result.stderr).toContain("merge.gates-stale");
    } finally {
      harness.cleanup();
    }
  });
});
