/**
 * TC-DPLAN-023 — every verdict path performs exactly the declared reads and
 * zero writes, fences, mutations, spawns, credential reads, or network calls.
 */
import { describe, expect, test } from "bun:test";
import { twoMemberPlanYaml } from "../fixtures/cross-repository/plan";
import {
  createRecorder,
  expectReadOnly,
  markdownFixture,
  type PlanWorld,
  planRuntime,
  planWorld,
  runPlanCli,
} from "../fixtures/plan/harness/index";

type Path = {
  readonly id: string;
  readonly argv: readonly string[];
  readonly world: PlanWorld;
  readonly reads: readonly string[];
};

const validWorld = planWorld({ "GH-306": "valid/baseline.yaml" });
const invalidWorld = planWorld({ "GH-308": "invalid/phase-missing-scope.yaml" });
const legacyWorld: PlanWorld = {
  artifacts: { "GH-307": [markdownFixture("GH-307", "legacy/prose.md")] },
};
const absentWorld: PlanWorld = { artifacts: {}, absent: ["GH-310"] };
const sequenceWorld = planWorld({
  "GH-306": "overlap/sequence/gh-306.yaml",
  "GH-307": "overlap/sequence/gh-307.yaml",
});
const memberWorld: PlanWorld = {
  artifacts: {
    "GH-310": [
      {
        kind: "yaml",
        path: "chg-GH-310-plan.yaml",
        text: twoMemberPlanYaml(),
      },
    ],
  },
};
const parallelWorld = planWorld({
  "GH-306": "overlap/parallel/gh-306.yaml",
  "GH-307": "overlap/parallel/gh-307.yaml",
});

const paths: readonly Path[] = [
  {
    id: "validate-valid",
    argv: ["plan", "validate", "GH-306"],
    world: validWorld,
    reads: ["plan:GH-306"],
  },
  {
    id: "validate-invalid",
    argv: ["plan", "validate", "GH-308"],
    world: invalidWorld,
    reads: ["plan:GH-308"],
  },
  {
    id: "validate-legacy",
    argv: ["plan", "validate", "GH-307"],
    world: legacyWorld,
    reads: ["plan:GH-307"],
  },
  {
    id: "validate-member-plan",
    argv: ["plan", "validate", "GH-310"],
    world: memberWorld,
    reads: ["plan:GH-310"],
  },
  {
    id: "validate-absent",
    argv: ["plan", "validate", "GH-310"],
    world: absentWorld,
    reads: ["plan:GH-310"],
  },
  {
    id: "diff",
    argv: ["plan", "diff", "GH-308"],
    world: planWorld(
      { "GH-308": "diff/outside/plan.yaml" },
      { "GH-308": ["packages/core/src/contracts/queue.ts"] },
    ),
    reads: ["plan:GH-308", "diff:GH-308:main-tools"],
  },
  {
    id: "overlap-sequence",
    argv: ["plan", "overlap", "GH-306", "GH-307"],
    world: sequenceWorld,
    reads: ["plan:GH-306", "plan:GH-307"],
  },
  {
    id: "overlap-parallel",
    argv: ["plan", "overlap", "GH-306", "GH-307"],
    world: parallelWorld,
    reads: ["plan:GH-306", "plan:GH-307"],
  },
];

describe("TC-DPLAN-023 read-only posture", () => {
  test.each(paths)("$id performs exactly its declared reads", async (entry) => {
    const recorder = createRecorder();
    await runPlanCli(entry.argv, planRuntime(entry.world, recorder));
    expect(expectReadOnly(recorder, entry.reads)).toEqual([]);
  });

  test("a plan that requests writes in its content still performs none", async () => {
    const recorder = createRecorder();
    await runPlanCli(["plan", "validate", "GH-306"], planRuntime(validWorld, recorder));
    expect(recorder.writes).toBe(0);
    expect(recorder.fences).toBe(0);
    expect(recorder.mutations).toBe(0);
    expect(recorder.spawns).toBe(0);
    expect(recorder.credentialReads).toBe(0);
    expect(recorder.networkCalls).toBe(0);
    expect(recorder.configReads).toBe(0);
  });

  test("a member plan performs no configuration read (TC-XPLAN-005)", async () => {
    const recorder = createRecorder();
    await runPlanCli(["plan", "validate", "GH-310"], planRuntime(memberWorld, recorder));
    expect(recorder.configReads).toBe(0);
    expect(recorder.reads).toEqual(["plan:GH-310"]);
  });
});
