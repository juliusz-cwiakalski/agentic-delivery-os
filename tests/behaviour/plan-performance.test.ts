/**
 * TC-DPLAN-026 — a 30-phase plan validates within the local-read bound, with
 * exactly one plan read and no other port touched.
 *
 * The bound is p95 < 500 ms (spec NFR-2); the median is logged alongside it.
 * If shared CI ever needs a relaxation it is recorded in test-plan §10, never
 * silently deleted.
 */
import { describe, expect, test } from "bun:test";
import { validatePlan } from "../../packages/core/src/domain/plan-validate";
import {
  createRecorder,
  expectReadOnly,
  fixture,
  planRuntime,
  planWorld,
  runPlanCli,
  planYamlParser,
} from "../fixtures/plan/harness/index";

const READS = {
  ok: true as const,
  artifact: { kind: "yaml" as const, path: "chg-GH-306-plan.yaml" },
  text: fixture("valid/thirty-phases.yaml"),
};

const percentile = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index] as number;
};

describe("TC-DPLAN-026 latency and read bound", () => {
  test("median and p95 stay under 500 ms for 30 phases", () => {
    const invoke = () =>
      validatePlan({ workItemRef: "GH-306", read: READS, parseYaml: planYamlParser });
    const warm = invoke();
    expect(warm.verdict).toBe("valid");
    expect(warm.perPhase).toHaveLength(30);

    const samples: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      invoke();
      samples.push(performance.now() - started);
    }
    const sorted = [...samples].sort((left, right) => left - right);
    const median = percentile(sorted, 0.5);
    const p95 = percentile(sorted, 0.95);
    console.log(
      `TC-DPLAN-026: phases=30 median=${median.toFixed(2)}ms p95=${p95.toFixed(2)}ms ` +
        `bun=${Bun.version} platform=${process.platform}/${process.arch}`,
    );
    expect(median).toBeLessThan(500);
    expect(p95).toBeLessThan(500);
  });

  test("the invocation performs exactly one plan read and touches no other port", async () => {
    const recorder = createRecorder();
    const world = planWorld({ "GH-306": "valid/thirty-phases.yaml" });
    await runPlanCli(["plan", "validate", "GH-306"], planRuntime(world, recorder));
    expect(expectReadOnly(recorder, ["plan:GH-306"])).toEqual([]);
  });
});
