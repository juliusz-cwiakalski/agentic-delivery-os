/**
 * TC-MERGE-017 — the owner-gate classification is readable from declared
 * policy data and is the authority merge consults; the GH-229 vocabulary is
 * consumed unchanged and proven live by mutation.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OWNER_GATE_CLASSES,
  OWNER_GATE_KINDS,
  OWNER_GATE_SLA_POLICY,
  type OwnerGateSlaPolicy,
} from "../../packages/core/src/contracts/index";
import { authorizeMergeWaiver } from "../../packages/core/src/domain/merge-waiver";
import {
  baseWorkItem,
  createMergeHarness,
  MERGE_CLOCK_MS,
  verificationRecord,
} from "../fixtures/merge/harness";

const ROOT = process.cwd();
const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const ownerEntry = {
  id: "owner-gate",
  recipe: "owner-gate" as const,
  surface: "battery" as const,
  class: "owner-review" as const,
};

const withAuthorization = (
  authorization: "owner-authored" | "defaultable",
): OwnerGateSlaPolicy => ({
  ...OWNER_GATE_SLA_POLICY,
  rows: OWNER_GATE_SLA_POLICY.rows.map((row) =>
    row.class === "owner-review" ? { ...row, waiverAuthorization: authorization } : row,
  ),
});

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

const gatedWorkItem = () =>
  baseWorkItem({ labels: ["change", "hand-back"], updatedAt: isoAt(-3 * MINUTE) });

describe("TC-MERGE-017 classification is policy data and merge authority", () => {
  test("the policy resolves a class and its authorization without evaluation logic", () => {
    const ownerReview = OWNER_GATE_SLA_POLICY.rows.find((row) => row.class === "owner-review");
    expect(ownerReview).toMatchObject({
      class: "owner-review",
      neverMerge: true,
      waiverAuthorization: "owner-authored",
    });
    const waiver = OWNER_GATE_SLA_POLICY.rows.find((row) => row.class === "waiver");
    expect(waiver).toMatchObject({ class: "waiver", defaultable: true });
    expect([...OWNER_GATE_KINDS]).toEqual(["owner-review", "waiver"]);
    expect([...OWNER_GATE_CLASSES]).toEqual(["owner-review", "waiver"]);
  });

  test("merge imports the same exported policy object (no fork, no duplicate literal)", () => {
    const edge = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    expect(edge).toContain("const policy = OWNER_GATE_SLA_POLICY;");
    for (const file of [
      "packages/core/src/domain/merge-waiver.ts",
      "packages/core/src/domain/merge-transaction.ts",
      "packages/core/src/domain/merge-gate-set.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text.includes('"owner-review"'), file).toBe(false);
      expect(text.includes('"waiver"'), file).toBe(false);
    }
  });

  test("a non-owner authorizer refuses a never-merge gate; the owner principal passes", () => {
    const nonOwner = authorizeMergeWaiver({
      declaration: { gateId: "owner-gate", authorizer: "someone-else" },
      changeRef: "GH-301",
      entry: ownerEntry,
      policy: OWNER_GATE_SLA_POLICY,
      ownerPrincipal: "owner-principal",
      authorizedAt: isoAt(0),
    });
    expect(nonOwner.ok).toBe(false);
    if (!nonOwner.ok) expect(nonOwner.reason).toBe("unauthorized-principal");
    const owner = authorizeMergeWaiver({
      declaration: { gateId: "owner-gate", authorizer: "owner-principal" },
      changeRef: "GH-301",
      entry: ownerEntry,
      policy: OWNER_GATE_SLA_POLICY,
      ownerPrincipal: "owner-principal",
      authorizedAt: isoAt(0),
    });
    expect(owner.ok).toBe(true);
  });

  test("mutating the authorization datum flips the observed merge outcome", async () => {
    const flippable = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
      policy: withAuthorization("defaultable"),
    });
    try {
      flippable.seedVerification(gatedRecord());
      const result = await flippable.run([
        flippable.ref,
        "--waive",
        "owner-gate",
        "--waived-by",
        "someone-else",
      ]);
      expect(result.exitCode).toBe(0);
    } finally {
      flippable.cleanup();
    }
    const restricted = createMergeHarness({
      workItem: gatedWorkItem(),
      ownerPrincipal: "owner-principal",
    });
    try {
      restricted.seedVerification(gatedRecord());
      const result = await restricted.run([
        restricted.ref,
        "--waive",
        "owner-gate",
        "--waived-by",
        "someone-else",
      ]);
      expect(result.exitCode).toBe(1);
      expect((result.envelope?.error as Record<string, unknown> | undefined)?.code).toBe(
        "merge.waiver-unauthorized",
      );
    } finally {
      restricted.cleanup();
    }
  });

  test("a gate with no class binding is never waivable and never defaults", () => {
    const verdict = authorizeMergeWaiver({
      declaration: { gateId: "ci-green", authorizer: "owner-principal" },
      changeRef: "GH-301",
      entry: { id: "ci-green", recipe: "ci-green", surface: "battery" },
      policy: OWNER_GATE_SLA_POLICY,
      ownerPrincipal: "owner-principal",
      authorizedAt: isoAt(0),
    });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toBe("non-waivable-gate");
  });
});
