/**
 * Explicit golden regeneration for the plan family (TC-DPLAN-024).
 *
 * Run: `bun run tests/golden/plan/regenerate.ts`
 *
 * Volatile envelope fields are dropped: only the verdict `data` is stored, so
 * the diff stays human-reviewable and replay-stable.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  diffFixture,
  parseEnvelope,
  planRuntime,
  planWorld,
  runPlanCli,
} from "../../fixtures/plan/harness/index";

const ROOT = import.meta.dir;

type GoldenCase = {
  readonly file: string;
  readonly argv: readonly string[];
  readonly world: ReturnType<typeof planWorld>;
};

const cases: readonly GoldenCase[] = [
  {
    file: "validate-baseline.json",
    argv: ["plan", "validate", "GH-306", "--json"],
    world: planWorld({ "GH-306": "valid/baseline.yaml" }),
  },
  {
    file: "overlap-sequence.json",
    argv: ["plan", "overlap", "GH-306", "GH-307", "--json"],
    world: planWorld({
      "GH-306": "overlap/sequence/gh-306.yaml",
      "GH-307": "overlap/sequence/gh-307.yaml",
    }),
  },
  {
    file: "overlap-parallel.json",
    argv: ["plan", "overlap", "GH-306", "GH-307", "--json"],
    world: planWorld({
      "GH-306": "overlap/parallel/gh-306.yaml",
      "GH-307": "overlap/parallel/gh-307.yaml",
    }),
  },
  {
    file: "diff-outside.json",
    argv: ["plan", "diff", "GH-308", "--json"],
    world: planWorld(
      { "GH-308": "diff/outside/plan.yaml" },
      { "GH-308": diffFixture("diff/outside").paths },
    ),
  },
];

for (const golden of cases) {
  const run = await runPlanCli(golden.argv, planRuntime(golden.world), {
    runId: "run-golden-plan",
  });
  const envelope = parseEnvelope(run.stdout);
  const data = envelope.data;
  writeFileSync(join(ROOT, golden.file), `${JSON.stringify(data, null, 2)}\n`);
}
