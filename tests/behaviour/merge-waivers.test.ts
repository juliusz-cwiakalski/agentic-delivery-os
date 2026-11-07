/**
 * TC-MERGE-018 / TC-MERGE-019 / TC-MERGE-021 — waivers are verified before
 * recording, recorded before landing, durable across a later refusal, and the
 * missing-declaration refusal is its own identity.
 */
import { describe, expect, test } from "bun:test";
import { MERGE_WAIVER_SCHEMA, type PipelineRun } from "../../packages/core/src/contracts/index";
import { authorizeMergeWaiver } from "../../packages/core/src/domain/merge-waiver";
import {
  baseCheckRuns,
  baseWorkItem,
  createMergeHarness,
  MERGE_CLOCK_ISO,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

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

const authorizedFlags = ["--waive", "owner-gate", "--waived-by", "owner-principal"];

const redPage = (): { items: PipelineRun[]; pageItemCount: number; sha: string } => ({
  items: baseCheckRuns().items.map((run) =>
    run.pipelineName === "CI / test (18)"
      ? { ...run, jobs: [{ jobName: run.pipelineName, jobState: "failed" as const }] }
      : run,
  ),
  pageItemCount: 2,
  sha: MERGE_HEAD,
});

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;

describe("TC-MERGE-018 an authorized waiver is recorded before landing and persists", () => {
  test("the waiver record precedes the first git mutation and the gate passes under it", async () => {
    const harness = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(gatedRecord());
      const result = await harness.run([harness.ref, ...authorizedFlags]);
      expect(result.exitCode).toBe(0);
      expect(harness.waivers()).toHaveLength(1);
      const waiver = harness.waivers()[0];
      expect(waiver?.schema).toBe(MERGE_WAIVER_SCHEMA);
      expect(waiver?.gateId).toBe("owner-gate");
      expect(waiver?.gateClass).toBe("owner-review");
      expect(waiver?.changeRef).toBe("GH-301");
      expect(waiver?.authorizer).toBe("owner-principal");
      expect(waiver?.authorizedAt).toBe(MERGE_CLOCK_ISO);
      const waiverIndex = harness.events.indexOf("append-waiver");
      const landIndex = harness.events.indexOf("git-squash-land");
      expect(waiverIndex).toBeGreaterThanOrEqual(0);
      expect(landIndex).toBeGreaterThan(waiverIndex);
      expect(harness.transactions()[0]?.waiverRefs).toEqual(["owner-gate"]);
      expect(harness.waivers()).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("a later gate refusal leaves the waiver record durable and lands nothing", async () => {
    const harness = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
      checkRuns: redPage(),
    });
    try {
      harness.seedVerification(gatedRecord());
      const result = await harness.run([harness.ref, ...authorizedFlags]);
      expect(result.exitCode).toBe(1);
      expect(harness.waivers()).toHaveLength(1);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.events).not.toContain("git-squash-land");
    } finally {
      harness.cleanup();
    }
  });

  test("the authorization decision is deterministic per record and policy", () => {
    const input = {
      declaration: { gateId: "owner-gate", authorizer: "owner-principal", reason: "  over  " },
      changeRef: "GH-301",
      entry: {
        id: "owner-gate",
        recipe: "owner-gate" as const,
        surface: "battery" as const,
        class: "owner-review" as const,
      },
      policy: {
        comparator: ">=" as const,
        escalationThresholdMs: 1,
        expiryThresholdMs: 2,
        rows: [
          {
            kind: "owner-review" as const,
            class: "owner-review" as const,
            neverMerge: true,
            defaultable: false,
            default: null,
            waiverAuthorization: "owner-authored" as const,
          },
        ],
      },
      ownerPrincipal: "owner-principal",
      authorizedAt: isoAt(0),
    };
    expect(authorizeMergeWaiver(input)).toEqual(authorizeMergeWaiver(input));
  });
});

describe("TC-MERGE-019 an unauthorized or unresolvable authorizer records no waiver", () => {
  const variants = [
    {
      id: "unauthorized",
      owner: "owner-principal",
      authorizer: "someone-else",
      flags: ["--waive", "owner-gate", "--waived-by", "someone-else"],
    },
    { id: "unresolvable", owner: undefined, authorizer: "owner-principal", flags: authorizedFlags },
    {
      id: "non-waivable",
      owner: "owner-principal",
      authorizer: "owner-principal",
      flags: ["--waive", "ci-green", "--waived-by", "owner-principal"],
    },
  ];

  for (const variant of variants) {
    test(`${variant.id}: refused at exit 1 with no waiver and an audited attempt`, async () => {
      const harness = createMergeHarness({
        workItem: gatedWorkItem(),
        ...(variant.owner === undefined ? {} : { ownerPrincipal: variant.owner }),
      });
      try {
        harness.seedVerification(gatedRecord());
        const result = await harness.run([harness.ref, ...variant.flags], { json: false });
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("merge.waiver-unauthorized");
        expect(result.stderr).toContain(variant.authorizer);
        expect(harness.waivers()).toHaveLength(0);
        expect(harness.transactions()).toHaveLength(0);
        expect(harness.events).not.toContain("git-squash-land");
        expect(harness.auditRecords).toHaveLength(1);
        expect(harness.auditRecords[0]?.exitCode).toBe(1);
      } finally {
        harness.cleanup();
      }
    });
  }

  test("the principal is rendered as an identity reference, never a credential", async () => {
    const harness = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(gatedRecord());
      const result = await harness.run(
        [harness.ref, "--waive", "owner-gate", "--waived-by", "someone-else"],
        { json: false },
      );
      expect(result.stderr).toContain("authorizer=someone-else");
      expect(result.stderr).not.toContain("token=");
    } finally {
      harness.cleanup();
    }
  });

  test("the authorized principal passes through the same declaration grammar", async () => {
    const harness = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(gatedRecord());
      expect((await harness.run([harness.ref, ...authorizedFlags])).exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-021 the missing declaration is its own identity", () => {
  test("an owner-gate failure with no declaration refuses override-without-waiver", async () => {
    const harness = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(gatedRecord());
      const result = await harness.run([harness.ref], { json: false });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("merge.owner-gate-override-without-waiver");
      expect(result.stderr).toContain("override=");
      expect(result.stderr).not.toContain("merge.waiver-unauthorized");
      expect(harness.waivers()).toHaveLength(0);
      expect(harness.transactions()).toHaveLength(0);
      expect(harness.events).not.toContain("git-squash-land");
    } finally {
      harness.cleanup();
    }
  });

  test("adding the authorized declaration changes the outcome to a landing", async () => {
    const harness = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(gatedRecord());
      const refused = await harness.run([harness.ref], { json: false });
      expect(refused.stderr).toContain("merge.owner-gate-override-without-waiver");
      const landed = await harness.run([harness.ref, ...authorizedFlags]);
      expect(landed.exitCode).toBe(0);
      expect(harness.waivers()).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("the two waiver identities are mutually exclusive", async () => {
    const missing = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
    });
    const unauthorized = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
    });
    try {
      missing.seedVerification(gatedRecord());
      unauthorized.seedVerification(gatedRecord());
      const a = await missing.run([missing.ref]);
      const b = await unauthorized.run([
        unauthorized.ref,
        "--waive",
        "owner-gate",
        "--waived-by",
        "someone-else",
      ]);
      expect(errorOf(a)?.code).toBe("merge.owner-gate-override-without-waiver");
      expect(errorOf(b)?.code).toBe("merge.waiver-unauthorized");
    } finally {
      missing.cleanup();
      unauthorized.cleanup();
    }
  });
});
