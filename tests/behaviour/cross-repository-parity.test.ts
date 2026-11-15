/**
 * Member-less parity (GH-310 TC-XPAR-001/002/003, AC-F1-3, AC-F5-4, AC-F7-1,
 * F-7, NFR-8, C-1). Every member-less payload is compared against a committed
 * pre-change golden and no `members`/`definitionOfDone`/`blockingMembers`/
 * `reviewFlow` key appears at any depth; the cross-repository path is opt-in.
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
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";

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

const GATES_GOLDEN = join(import.meta.dir, "..", "fixtures", "verify-gates", "golden");

const redFacts = () => {
  const facts = clone(baseFacts());
  facts.checkRuns = {
    ok: true,
    value: {
      items: EXPECTED_JOBS.map((name) =>
        run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
      ),
      pageItemCount: 23,
    },
  };
  return facts;
};

const unknownFacts = () => {
  const facts = clone(baseFacts());
  facts.checkRuns = { ok: false, reason: "not-found" };
  return facts;
};

const CROSS_KEYS = [
  '"members"',
  '"definitionOfDone"',
  '"blockingMembers"',
  '"reviewFlow"',
] as const;

describe("TC-XPAR-003 member-less gate report is the delivered VerifyGatesReport", () => {
  test("pass report keeps the literal overall pass, no member, the success golden and exit 0", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(result.exitCode).toBe(0);
    const envelope = result.envelope as Record<string, unknown>;
    const data = envelope.data as Record<string, unknown>;
    expect(data.overall).toBe("pass");
    expect(data).toEqual(
      JSON.parse(readFileSync(join(GATES_GOLDEN, "success-data.json"), "utf8")) as unknown,
    );
    const gates = data.gates as readonly Record<string, unknown>[];
    expect(gates.length).toBeGreaterThan(0);
    for (const record of gates) expect(record).not.toHaveProperty("member");
    for (const key of CROSS_KEYS) expect(result.stdout).not.toContain(key);
    expect(result.stdout).not.toContain('"member"');

    const human = await runVerify(combinedRuntime(), ["gates", "GH-178"], { json: false });
    expect(human.stdout).toBe(readFileSync(join(GATES_GOLDEN, "human-success.txt"), "utf8"));
  });

  test("failure keeps the delivered envelope, summary golden, and exit 1", async () => {
    const result = await runVerify(combinedRuntime({ facts: redFacts() }), ["gates", "GH-178"]);
    expect(result.exitCode).toBe(1);
    const envelope = result.envelope as Record<string, unknown>;
    expect(envelope.data).toBeUndefined();
    const error = envelope.error as { readonly code?: string; readonly summary?: string };
    expect(error.code).toBe("verify.gates.failed");
    expect(`${error.summary ?? ""}\n`).toBe(
      readFileSync(join(GATES_GOLDEN, "failure-summary.txt"), "utf8"),
    );
    expect(result.stdout).not.toContain('"overall"');
  });

  test("classified unknown keeps verify.gates.unavailable at exit 2", async () => {
    const result = await runVerify(combinedRuntime({ facts: unknownFacts() }), ["gates", "GH-178"]);
    expect(result.exitCode).toBe(2);
    const envelope = result.envelope as Record<string, unknown>;
    expect(envelope.data).toBeUndefined();
    expect((envelope.error as { readonly code?: string }).code).toBe("verify.gates.unavailable");
    expect(result.stdout).not.toContain('"overall"');
    for (const key of CROSS_KEYS) expect(result.stdout).not.toContain(key);
  });
});

const QUEUE_ADD_GOLDEN = join(
  import.meta.dir,
  "..",
  "fixtures",
  "queue",
  "golden",
  "queue-add-memberless.json",
);

/** Only the envelope `runId` and `timing` are normalized (never a payload field). */
const normalizeEnvelope = (value: unknown): unknown => {
  const record = value as Record<string, unknown>;
  return { ...record, runId: "<runId>", timing: { totalMs: "<timing>" } };
};

describe("TC-XPAR-003 member-less queue add reads the 404e9bf8 golden unchanged", () => {
  test("the payload equals the pre-change golden with no members array and no extra edge", async () => {
    const harness = createQueueEdgeHarness("parity-add");
    const run = await harness.run(["queue", "add", "GH-310", "--json"]);
    expect(run.exitCode).toBe(0);
    const actual = JSON.parse(run.stdout) as unknown;
    const golden = JSON.parse(readFileSync(QUEUE_ADD_GOLDEN, "utf8")) as unknown;
    expect(JSON.stringify(normalizeEnvelope(actual))).toBe(
      JSON.stringify(normalizeEnvelope(golden)),
    );
    const data = (actual as { readonly data: Record<string, unknown> }).data;
    expect(Object.keys(data).sort()).toEqual(["degraded", "edges", "entry", "ref", "result"]);
    expect(data.members).toBeUndefined();
    expect(data.edges).toEqual([]);
    expect(run.stdout).not.toContain('"members"');
  });
});

describe("TC-XPAR-003 member-less queue and lane projections carry no member identity", () => {
  test("one bare-ref entry, no member ref, no member key in list/plan/lanes", async () => {
    const harness = createQueueEdgeHarness("parity-projections");
    expect((await harness.run(["queue", "add", "GH-310", "--json"])).exitCode).toBe(0);
    for (const argv of [
      ["queue", "list", "--json"],
      ["queue", "plan", "--json"],
      ["lanes", "list", "--json"],
    ] as const) {
      const run = await harness.run(argv);
      expect(run.exitCode, argv.join(" ")).toBe(0);
      expect(run.stdout, argv.join(" ")).not.toContain('"members"');
      expect(run.stdout, argv.join(" ")).not.toContain("@");
    }
    const listed = await harness.run(["queue", "list", "--json"]);
    const entries = (
      JSON.parse(listed.stdout) as {
        readonly data: { readonly entries: readonly { readonly ref: string }[] };
      }
    ).data.entries;
    expect(entries.map((entry) => entry.ref)).toEqual(["GH-310"]);
  });
});
