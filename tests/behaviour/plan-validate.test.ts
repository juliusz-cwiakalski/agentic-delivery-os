/**
 * TC-DPLAN-001 (domain half), TC-DPLAN-007, TC-DPLAN-008, TC-DPLAN-010 —
 * valid plans validate and echo their declared data; absent and unreadable
 * artifacts are classified rather than thrown.
 */
import { describe, expect, test } from "bun:test";
import { validatePlan } from "../../packages/core/src/domain/plan-validate";
import {
  planYamlParser,
  validateYamlFixture,
} from "../fixtures/plan/harness/index";

describe("TC-DPLAN-001 valid plan", () => {
  test("validates, is ready for development, and echoes the schema version", () => {
    const verdict = validateYamlFixture("GH-306", "valid/baseline.yaml");
    expect(verdict.verdict).toBe("valid");
    expect(verdict.readyForDevelopment).toBe(true);
    expect(verdict.errors).toEqual([]);
    expect(verdict.schemaVersion).toBe("delivery.plan.v1");
    expect(verdict.artifact).toEqual({
      kind: "yaml",
      path: "chg-GH-306-plan.yaml",
    });
    expect(verdict.perPhase.map((phase) => phase.id)).toEqual([1, 2]);
    expect(verdict.truncated).toBe(false);
  });
});

describe("TC-DPLAN-007 done-artifacts", () => {
  test("every delivery phase echoes all four typed slots", () => {
    const verdict = validateYamlFixture("GH-306", "valid/baseline.yaml");
    const delivery = verdict.perPhase.find((phase) => phase.id === 2);
    expect(delivery?.doneArtifacts).toEqual({
      mergeRequestUrl: "https://example.test/pr/306",
      pipelineId: "pipeline-306",
      deployedEnvironment: "staging",
      trackerTransition: "in-review",
    });
  });

  test("a planning phase reports no delivery artifacts and invents none", () => {
    const verdict = validateYamlFixture("GH-306", "valid/baseline.yaml");
    const planning = verdict.perPhase.find((phase) => phase.id === 1);
    expect(planning?.doneArtifacts).toBeUndefined();
  });
});

describe("TC-DPLAN-008 leases and weight", () => {
  test("planning is lease-free and delivery is lease-taking", () => {
    const verdict = validateYamlFixture("GH-306", "valid/baseline.yaml");
    expect(verdict.perPhase.map((phase) => [phase.id, phase.leaseClass])).toEqual([
      [1, "lease-free"],
      [2, "lease-taking"],
    ]);
  });

  test("leases and weight echo verbatim, with the plan default applied once", () => {
    const verdict = validateYamlFixture("GH-306", "valid/baseline.yaml");
    const planning = verdict.perPhase[0];
    const delivery = verdict.perPhase[1];
    expect(planning?.leases).toEqual(["repository"]);
    expect(planning?.weightClass).toBe("standard");
    expect(delivery?.leases).toEqual(["repository"]);
    expect(delivery?.weightClass).toBe("heavy");
  });

  test("an unknown weight class is opaque declared data", () => {
    const verdict = validateYamlFixture("GH-306", "valid/unknown-weight.yaml");
    expect(verdict.verdict).toBe("valid");
    expect(verdict.perPhase[0]?.weightClass).toBe("quantum-batch");
  });
});

describe("TC-DPLAN-010 missing artifact", () => {
  test("absence is classified with plan.artifact.missing and never crashes", () => {
    const verdict = validatePlan({
      workItemRef: "GH-310",
      read: { ok: false, reason: "absent", workItemRef: "GH-310" },
      parseYaml: planYamlParser,
    });
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    expect(verdict.errors).toHaveLength(1);
    const error = verdict.errors[0];
    expect(error?.code).toBe("plan.artifact.missing");
    expect(error?.field).toBe("artifact");
    expect(error?.detail).toContain("GH-310");
    expect(verdict.artifact).toBeUndefined();
  });

  test("an unreadable artifact is classified under plan.schema.invalid", () => {
    const verdict = validatePlan({
      workItemRef: "GH-310",
      read: {
        ok: false,
        reason: "unreadable",
        workItemRef: "GH-310",
        path: "chg-GH-310-plan.yaml",
      },
      parseYaml: planYamlParser,
    });
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    expect(verdict.errors[0]?.code).toBe("plan.schema.invalid");
    expect(verdict.errors[0]?.field).toBe("artifact");
    expect(verdict.artifact?.path).toBe("chg-GH-310-plan.yaml");
  });
});

describe("TC-DPLAN-001 bounded errors", () => {
  test("errors are sorted and counted deterministically", () => {
    const verdict = validatePlan({
      workItemRef: "GH-310",
      read: {
        ok: true,
        artifact: { kind: "yaml", path: "chg-GH-310-plan.yaml" },
        text: "phases: []\n",
      },
      parseYaml: planYamlParser,
    });
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.totalErrors).toBe(verdict.errors.length);
    expect(verdict.truncated).toBe(false);
    const fields = verdict.errors.map((error) => error.field);
    expect(fields).toEqual([...fields].sort());
  });
});

describe("TC-DPLAN-001 CLI edge and text mode", () => {
  test("the edge projects exit 0 and a valid envelope", async () => {
    const { parseEnvelope, planRuntime, planWorld, runPlanCli } = await import(
      "../fixtures/plan/harness/index"
    );
    const world = planWorld({ "GH-306": "valid/baseline.yaml" });
    const run = await runPlanCli(
      ["plan", "validate", "GH-306", "--json"],
      planRuntime(world),
      { runId: "run-plan-valid" },
    );
    expect(run.exitCode).toBe(0);
    const envelope = parseEnvelope(run.stdout);
    expect(envelope.exitCode).toBe(0);
    expect((envelope.data as { verdict: string }).verdict).toBe("valid");
  });

  test("text mode prints verdict and readiness", async () => {
    const { planRuntime, planWorld, runPlanCli } = await import(
      "../fixtures/plan/harness/index"
    );
    const world = planWorld({ "GH-306": "valid/baseline.yaml" });
    const run = await runPlanCli(["plan", "validate", "GH-306"], planRuntime(world));
    expect(run.stdout).toContain("verdict=valid");
    expect(run.stdout).toContain("readyForDevelopment=true");
  });
});
