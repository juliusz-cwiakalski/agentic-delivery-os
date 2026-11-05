/**
 * TC-DPLAN-024 — replay is byte-identical and the committed goldens match.
 * Goldens are regenerated only by `bun run tests/golden/plan/regenerate.ts`.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  diffFixture,
  parseEnvelope,
  planRuntime,
  planWorld,
  runPlanCli,
} from "../fixtures/plan/harness/index";

const GOLDEN_DIR = join(import.meta.dir, "..", "golden", "plan");

type Case = {
  readonly golden: string;
  readonly argv: readonly string[];
  readonly world: ReturnType<typeof planWorld>;
};

const sequenceWorld = planWorld({
  "GH-306": "overlap/sequence/gh-306.yaml",
  "GH-307": "overlap/sequence/gh-307.yaml",
});
const parallelWorld = planWorld({
  "GH-306": "overlap/parallel/gh-306.yaml",
  "GH-307": "overlap/parallel/gh-307.yaml",
});

const cases: readonly Case[] = [
  {
    golden: "validate-baseline.json",
    argv: ["plan", "validate", "GH-306", "--json"],
    world: planWorld({ "GH-306": "valid/baseline.yaml" }),
  },
  {
    golden: "overlap-sequence.json",
    argv: ["plan", "overlap", "GH-306", "GH-307", "--json"],
    world: sequenceWorld,
  },
  {
    golden: "overlap-parallel.json",
    argv: ["plan", "overlap", "GH-306", "GH-307", "--json"],
    world: parallelWorld,
  },
  {
    golden: "diff-outside.json",
    argv: ["plan", "diff", "GH-308", "--json"],
    world: planWorld(
      { "GH-308": "diff/outside/plan.yaml" },
      { "GH-308": diffFixture("diff/outside").paths },
    ),
  },
];

const dataOf = async (entry: Case): Promise<string> => {
  const run = await runPlanCli(entry.argv, planRuntime(entry.world), {
    runId: "run-determinism",
  });
  return `${JSON.stringify(parseEnvelope(run.stdout).data, null, 2)}\n`;
};

describe("TC-DPLAN-024 byte-identical replay", () => {
  test.each(cases)("$golden matches its golden and replays identically", async (entry) => {
    const golden = readFileSync(join(GOLDEN_DIR, entry.golden), "utf8");
    const first = await dataOf(entry);
    const second = await dataOf(entry);
    expect(first).toBe(second);
    expect(first).toBe(golden);
  });

  test("shuffled scope declaration order emits the same validate data", async () => {
    const baseline = await dataOf({
      golden: "validate-baseline.json",
      argv: ["plan", "validate", "GH-306", "--json"],
      world: planWorld({ "GH-306": "valid/baseline.yaml" }),
    });
    const shuffled = await dataOf({
      golden: "validate-baseline.json",
      argv: ["plan", "validate", "GH-306", "--json"],
      world: planWorld({ "GH-306": "valid/shuffled-scope.yaml" }),
    });
    expect(shuffled).toBe(baseline);
  });
});
