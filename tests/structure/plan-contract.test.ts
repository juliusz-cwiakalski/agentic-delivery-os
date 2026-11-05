/**
 * TC-DPLAN-027 (structure half) and TC-DPLAN-028 — the plan vocabulary is
 * data-first, additive error identities are registered and synced, and no
 * built-in default phase set exists.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyDomainKind, resolveAppErrorCode } from "../../packages/cli/src/classify";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  LINT_DOCUMENT_UNREADABLE_CODE,
  PLAN_DONE_ARTIFACT_SLOTS,
  PLAN_ERROR_CODES,
  PLAN_FILE_PREFIX,
  PLAN_KNOWN_TIERS,
  PLAN_LEASE_CLASSES,
  PLAN_MAX_PHASES,
  PLAN_OVERLAP_REASONS,
  PLAN_PHASE_KINDS,
  PLAN_SCHEMA_VERSION,
  PLAN_SUPPORTED_SCHEMA_VERSIONS,
  type PlanDocument,
  leaseClassForPhaseKind,
  planArtifactPath,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const entries = ERROR_TABLE as readonly ErrorTableEntry[];

const PLAN_DOCUMENT = {
  schemaVersion: PLAN_SCHEMA_VERSION,
  workItemRef: "GH-306",
  tier: { name: "full", phases: [1, 2], escalationTriggers: ["owner-approval"] },
  defaultLeases: ["repo"],
  defaultWeightClass: "standard",
  phases: [
    {
      id: 1,
      title: "Planning",
      kind: "planning",
      scope: { files: ["doc/changes/plan.md"] },
      interactions: [
        { kind: "contract-file", target: "packages/core/src/contracts/queue.ts", role: "producer" },
      ],
    },
    {
      id: 2,
      title: "Delivery",
      kind: "delivery",
      scope: { packages: ["packages/core/src/contracts/**"] },
      doneArtifacts: {
        mergeRequestUrl: "https://example.test/pr/1",
        pipelineId: "pipeline-1",
        deployedEnvironment: "staging",
        trackerTransition: "done",
      },
    },
  ],
} as const satisfies PlanDocument;

describe("TC-DPLAN-028 plan error identities", () => {
  test("every plan identity is a registered, synced, exit-1 row", () => {
    for (const code of PLAN_ERROR_CODES) {
      const resolution = resolveAppErrorCode(code);
      expect(resolution.ok).toBe(true);
      if (!resolution.ok) continue;
      expect(resolution.entry.domainKind).toBe("plan");
      expect(resolution.entry.category).toBe("user");
      expect(resolution.entry.retryable).toBe(false);
      expect(resolution.entry.projectionClass).toBe("user-validation");
      expect(resolution.entry.remediationHint.length).toBeGreaterThan(0);
      expect(classifyDomainKind("plan", code)).toEqual(resolution.entry);
    }
    expect(entries.filter((entry) => entry.domainKind === "plan")).toHaveLength(
      PLAN_ERROR_CODES.length,
    );
  });

  test("the lint unreadable class projects to exit 2, distinct from non-conformance", () => {
    const resolution = resolveAppErrorCode(LINT_DOCUMENT_UNREADABLE_CODE);
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.entry.domainKind).toBe("lint");
    expect(resolution.entry.projectionClass).toBe("platform-provider");
  });

  test("a referenced-but-unregistered plan code stays unresolvable", () => {
    expect(resolveAppErrorCode("plan.schema.unknown").ok).toBe(false);
  });
});

describe("TC-DPLAN-027 plan vocabulary shape", () => {
  test("the schema version and supported set are declared once", () => {
    expect(PLAN_SCHEMA_VERSION).toBe("delivery.plan.v1");
    expect(PLAN_SUPPORTED_SCHEMA_VERSIONS).toEqual([PLAN_SCHEMA_VERSION]);
    expect(PLAN_FILE_PREFIX).toBe("chg-");
    expect(planArtifactPath("GH-226", "yaml")).toBe("chg-GH-226-plan.yaml");
    expect(planArtifactPath("GH-226", "markdown")).toBe("chg-GH-226-plan.md");
  });

  test("tier vocabulary is an identifier set, not a default phase set", () => {
    expect([...PLAN_KNOWN_TIERS]).toEqual(["full", "lite"]);
    expect(PLAN_MAX_PHASES).toBeGreaterThanOrEqual(30);
    const source = readFileSync(join(ROOT, "packages/core/src/contracts/plan.ts"), "utf8");
    expect(source).toContain("never a default phase set");
    expect(source).not.toMatch(/PLAN_DEFAULT_TIER|PLAN_DEFAULT_PHASE_SET/);
  });

  test("phase kinds, lease classes, artifact slots, and reasons are closed sets", () => {
    expect([...PLAN_PHASE_KINDS]).toEqual(["planning", "delivery"]);
    expect([...PLAN_LEASE_CLASSES]).toEqual(["lease-free", "lease-taking"]);
    expect([...PLAN_DONE_ARTIFACT_SLOTS]).toEqual([
      "mergeRequestUrl",
      "pipelineId",
      "deployedEnvironment",
      "trackerTransition",
    ]);
    expect([...PLAN_OVERLAP_REASONS]).toEqual(["shared-contract-files", "shared-paths"]);
  });

  test("lease class is derived from the phase kind, never guessed", () => {
    expect(leaseClassForPhaseKind("planning")).toBe("lease-free");
    expect(leaseClassForPhaseKind("delivery")).toBe("lease-taking");
  });

  test("wildcard and folder-boundary semantics are documented on the types", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/contracts/plan.ts"), "utf8");
    expect(source).toContain("no prefix bleed");
    expect(source).toContain("src/plan/a.ts");
    expect(source).toContain("src/planner/a.ts");
    expect(source).toContain("`**` crosses segments");
  });

  test("the sample document is the declared shape", () => {
    expect(PLAN_DOCUMENT.phases).toHaveLength(2);
    expect(PLAN_DOCUMENT.tier.escalationTriggers).toEqual(["owner-approval"]);
  });
});
