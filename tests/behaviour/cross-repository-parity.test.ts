/**
 * Member-less parity (GH-310 TC-XPAR-001, AC-F1-3, F-7, NFR-8, C-1). Every
 * plan payload is compared against the committed pre-change golden and no
 * `members` key appears at any depth; the cross-repository path is opt-in.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLOSEOUT_STEP_IDS } from "../../packages/core/src/contracts/index";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import {
  diffFixture,
  parseEnvelope,
  planLintRuntime,
  planRuntime,
  planWorld,
  runLintCli,
  runPlanCli,
} from "../fixtures/plan/harness/index";

const GOLDEN_DIR = join(import.meta.dir, "..", "golden", "plan");

const golden = (name: string): string => readFileSync(join(GOLDEN_DIR, name), "utf8");

const dataOf = async (run: { readonly stdout: string }): Promise<string> =>
  `${JSON.stringify(parseEnvelope(run.stdout).data, null, 2)}\n`;

const sequenceWorld = planWorld({
  "GH-306": "overlap/sequence/gh-306.yaml",
  "GH-307": "overlap/sequence/gh-307.yaml",
});
const parallelWorld = planWorld({
  "GH-306": "overlap/parallel/gh-306.yaml",
  "GH-307": "overlap/parallel/gh-307.yaml",
});

const baselineWorld = planWorld({ "GH-306": "valid/baseline.yaml" });

describe("TC-XPAR-001 member-less plan surfaces are byte-identical", () => {
  test("plan validate data equals the pre-change golden and carries no members key", async () => {
    const run = await runPlanCli(
      ["plan", "validate", "GH-306", "--json"],
      planRuntime(baselineWorld),
    );
    expect(run.exitCode).toBe(0);
    expect(await dataOf(run)).toBe(golden("validate-baseline.json"));
    expect(run.stdout).not.toContain('"members"');
  });

  test("lint plan reports valid with no member key and the delivered exit", async () => {
    const run = await runLintCli(
      ["lint", "plan", "GH-306", "--json"],
      planLintRuntime(baselineWorld),
    );
    expect(run.exitCode).toBe(0);
    const data = parseEnvelope(run.stdout).data as {
      readonly target: string;
      readonly documents: readonly {
        readonly verdict: string;
        readonly errors: readonly unknown[];
      }[];
    };
    expect(data.target).toBe("plan");
    expect(data.documents[0]?.verdict).toBe("valid");
    expect(data.documents[0]?.errors).toEqual([]);
    expect(run.stdout).not.toContain('"members"');
  });

  test("plan overlap sequence and parallel match the pre-change goldens and exits", async () => {
    const sequence = await runPlanCli(
      ["plan", "overlap", "GH-306", "GH-307", "--json"],
      planRuntime(sequenceWorld),
    );
    expect(sequence.exitCode).toBe(1);
    expect(await dataOf(sequence)).toBe(golden("overlap-sequence.json"));

    const parallel = await runPlanCli(
      ["plan", "overlap", "GH-306", "GH-307", "--json"],
      planRuntime(parallelWorld),
    );
    expect(parallel.exitCode).toBe(0);
    expect(await dataOf(parallel)).toBe(golden("overlap-parallel.json"));
  });

  test("plan diff matches the pre-change golden and exit", async () => {
    const world = planWorld(
      { "GH-308": "diff/outside/plan.yaml" },
      { "GH-308": diffFixture("diff/outside").paths },
    );
    const run = await runPlanCli(["plan", "diff", "GH-308", "--json"], planRuntime(world));
    expect(run.exitCode).toBe(1);
    expect(await dataOf(run)).toBe(golden("diff-outside.json"));
    expect(run.stdout).not.toContain('"members"');
  });
});

describe("TC-XPAR-002 member-less closeout stays byte-identical", () => {
  const closeoutGolden: unknown = JSON.parse(
    readFileSync(
      join(import.meta.dir, "..", "fixtures", "closeout", "golden", "envelope-data.json"),
      "utf8",
    ),
  );

  test("plan mode carries no member key and equals the pre-change golden", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"]);
    expect(run.exitCode).toBe(0);
    const data = closeoutData(run.envelope);
    expect(data).toEqual(closeoutGolden);
    expect(data.members).toBeUndefined();
    expect(data.queueRemovals).toBeUndefined();
    expect(run.stdout).not.toContain('"members"');
    expect(data.steps.map((step) => step.stepId)).toEqual([...CLOSEOUT_STEP_IDS]);
  });

  test("apply mode carries no member key and keeps the delivered step outcomes", async () => {
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = closeoutData(run.envelope);
    expect(data.members).toBeUndefined();
    expect(data.queueRemovals).toBeUndefined();
    expect(data.steps.map((step) => step.stepId)).toEqual([...CLOSEOUT_STEP_IDS]);
  });
});
