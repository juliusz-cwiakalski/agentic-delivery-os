/**
 * TC-DPLAN-013 (domain half) — overlap answers sequence with every overlapping
 * path named and the declared producer first.
 */
import { describe, expect, test } from "bun:test";
import { computePlanOverlap } from "../../packages/core/src/domain/plan-overlap";
import { scopeCoversPath } from "../../packages/core/src/domain/plan-paths";
import { planDocumentFor } from "../fixtures/plan/harness/index";

const planA = planDocumentFor("GH-306", "overlap/sequence/gh-306.yaml");
const planB = planDocumentFor("GH-307", "overlap/sequence/gh-307.yaml");

describe("TC-DPLAN-013 sequence verdict", () => {
  test("names every shared path and orders the producer first", () => {
    const verdict = computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB });
    expect(verdict.verdict).toBe("run-in-sequence");
    expect(verdict.overlappingPaths).toEqual([
      "doc/spec/features/feature-scheduler.md",
      "packages/core/src/contracts/queue.ts",
    ]);
    expect(verdict.ordering).toBe("GH-306-before-GH-307");
    expect(verdict.reason).toBe("shared-contract-files");
  });

  test("the ordering is unchanged when the refs are reversed", () => {
    const verdict = computePlanOverlap({ refA: "GH-307", planA: planB, refB: "GH-306", planB: planA });
    expect(verdict.ordering).toBe("GH-306-before-GH-307");
    expect(verdict.verdict).toBe("run-in-sequence");
  });

  test("every listed path is present in both declared scopes", () => {
    const verdict = computePlanOverlap({ refA: "GH-306", planA, refB: "GH-307", planB });
    for (const path of verdict.overlappingPaths) {
      const inA = planA.phases.some((phase) => scopeCoversPath(phase.scope, path));
      const inB = planB.phases.some((phase) => scopeCoversPath(phase.scope, path));
      expect(inA, `${path} missing from GH-306`).toBe(true);
      expect(inB, `${path} missing from GH-307`).toBe(true);
    }
  });
});

describe("TC-DPLAN-013 CLI edge and text mode", () => {
  test("a sequence verdict exits 1 with the verdict carried in the envelope", async () => {
    const { parseEnvelope, planRuntime, planWorld, runPlanCli } = await import(
      "../fixtures/plan/harness/index"
    );
    const world = planWorld({
      "GH-306": "overlap/sequence/gh-306.yaml",
      "GH-307": "overlap/sequence/gh-307.yaml",
    });
    const run = await runPlanCli(
      ["plan", "overlap", "GH-306", "GH-307", "--json"],
      planRuntime(world),
      { runId: "run-plan-overlap" },
    );
    expect(run.exitCode).toBe(1);
    const envelope = parseEnvelope(run.stdout);
    const data = envelope.data as {
      verdict: string;
      overlappingPaths: readonly string[];
      ordering: string;
      reason: string;
    };
    expect(envelope.exitCode).toBe(1);
    expect(data.verdict).toBe("run-in-sequence");
    expect(data.overlappingPaths).toContain("packages/core/src/contracts/queue.ts");
    expect(data.ordering).toBe("GH-306-before-GH-307");
    expect(data.reason).toBe("shared-contract-files");
  });

  test("text mode prints verdict, overlapping path, and reason", async () => {
    const { planRuntime, planWorld, runPlanCli } = await import(
      "../fixtures/plan/harness/index"
    );
    const world = planWorld({
      "GH-306": "overlap/sequence/gh-306.yaml",
      "GH-307": "overlap/sequence/gh-307.yaml",
    });
    const run = await runPlanCli(["plan", "overlap", "GH-306", "GH-307"], planRuntime(world));
    expect(run.stdout).toContain("verdict=run-in-sequence");
    expect(run.stdout).toContain("overlapping=packages/core/src/contracts/queue.ts");
    expect(run.stdout).toContain("reason=shared-contract-files");
  });
});
