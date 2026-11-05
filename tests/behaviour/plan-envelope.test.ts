/**
 * TC-DPLAN-022 — every plan outcome yields a valid envelope with the projected
 * exit; verdict data is present on negative verdicts and a classified error
 * appears where the invocation itself fails.
 */
import { describe, expect, test } from "bun:test";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  parseEnvelope,
  planRuntime,
  planWorld,
  runPlanCli,
  type PlanWorld,
} from "../fixtures/plan/harness/index";

type Case = {
  readonly id: string;
  readonly argv: readonly string[];
  readonly world: PlanWorld;
  readonly exitCode: number;
  readonly kind: "data" | "error";
};

const sequenceWorld = planWorld({
  "GH-306": "overlap/sequence/gh-306.yaml",
  "GH-307": "overlap/sequence/gh-307.yaml",
});

const cases: readonly Case[] = [
  {
    id: "valid",
    argv: ["plan", "validate", "GH-306", "--json"],
    world: planWorld({ "GH-306": "valid/baseline.yaml" }),
    exitCode: 0,
    kind: "data",
  },
  {
    id: "invalid-schema",
    argv: ["plan", "validate", "GH-308", "--json"],
    world: planWorld({ "GH-308": "invalid/phase-missing-scope.yaml" }),
    exitCode: 1,
    kind: "data",
  },
  {
    id: "sequence-verdict",
    argv: ["plan", "overlap", "GH-306", "GH-307", "--json"],
    world: sequenceWorld,
    exitCode: 1,
    kind: "data",
  },
  {
    id: "diff-findings",
    argv: ["plan", "diff", "GH-308", "--json"],
    world: planWorld(
      { "GH-308": "diff/outside/plan.yaml" },
      {
        "GH-308": ["packages/core/src/contracts/queue.ts", "packages/cli/src/commands/plan.ts"],
      },
    ),
    exitCode: 1,
    kind: "data",
  },
  {
    id: "missing-ref",
    argv: ["plan", "validate", "--json"],
    world: planWorld({}),
    exitCode: 1,
    kind: "error",
  },
  {
    id: "unknown-subcommand",
    argv: ["plan", "explode", "GH-306", "--json"],
    world: planWorld({ "GH-306": "valid/baseline.yaml" }),
    exitCode: 1,
    kind: "error",
  },
];

const run = async (
  testCase: Case,
): Promise<{ exitCode: number; envelope: Record<string, unknown>; stderr: string }> => {
  const result = await runPlanCli(testCase.argv, planRuntime(testCase.world), {
    runId: `run-${testCase.id}`,
    secrets: ["planted-fake-secret-0226"],
  });
  return {
    exitCode: result.exitCode,
    envelope: parseEnvelope(result.stdout),
    stderr: result.stderr,
  };
};

describe("TC-DPLAN-022 envelope contract", () => {
  test.each(cases)("$id yields a valid envelope and the projected exit", async (testCase) => {
    const result = await run(testCase);
    expect(assertEnvelopeContract(result.envelope)).toEqual([]);
    expect(result.exitCode).toBe(testCase.exitCode);
    expect(result.envelope.exitCode).toBe(testCase.exitCode);
    const hasData = Object.hasOwn(result.envelope, "data");
    const hasError = Object.hasOwn(result.envelope, "error");
    expect(hasData).toBe(testCase.kind === "data");
    expect(hasError).toBe(testCase.kind === "error");
  });

  test.each(cases)("$id carries no secret-shaped value", async (testCase) => {
    const result = await run(testCase);
    const text = JSON.stringify(result.envelope);
    expect(text).not.toContain("planted-fake-secret-0226");
  });

  test("negative verdicts keep data present, never an error object", async () => {
    for (const testCase of cases.filter((entry) => entry.kind === "data" && entry.exitCode === 1)) {
      const result = await run(testCase);
      expect(result.envelope.error).toBeUndefined();
      const data = result.envelope.data as { verdict?: string };
      expect(data.verdict).toBeDefined();
    }
  });

  test("invocation failures carry the contracted error fields", async () => {
    const missing = cases.find((entry) => entry.id === "missing-ref");
    if (missing === undefined) throw new Error("missing-ref case is absent");
    const result = await run(missing);
    const error = result.envelope.error as Record<string, unknown>;
    for (const key of ["code", "category", "retryable", "consequence", "remediationHint"]) {
      expect(error[key]).toBeDefined();
    }
    expect(["fallback.invocation", "input.value.rejected"]).toContain(error.code);
    expect(error.category).toBe("user");
  });
});

describe("TC-DPLAN-022 lint outcome classes", () => {
  test("lint non-conformant exits 1 with a valid envelope", async () => {
    const { planLintRuntime } = await import("../fixtures/plan/harness/index");
    const { runLint } = await import("./pm-notes-lint-command-support");
    const run = await runLint(
      planLintRuntime(planWorld({ "GH-308": "invalid/phase-missing-scope.yaml" })),
      ["plan", "GH-308"],
    );
    expect(run.exitCode).toBe(1);
    expect(assertEnvelopeContract(run.envelope)).toEqual([]);
    expect(run.envelope?.exitCode).toBe(1);
    expect(Object.hasOwn(run.envelope ?? {}, "data")).toBe(true);
  });

  test("lint unreadable exits 2 with a valid envelope", async () => {
    const { planLintRuntime } = await import("../fixtures/plan/harness/index");
    const { runLint } = await import("./pm-notes-lint-command-support");
    const run = await runLint(planLintRuntime({ artifacts: {}, unreadable: ["GH-310"] }), [
      "plan",
      "GH-310",
    ]);
    expect(run.exitCode).toBe(2);
    expect(assertEnvelopeContract(run.envelope)).toEqual([]);
    expect(run.envelope?.exitCode).toBe(2);
    expect(Object.hasOwn(run.envelope ?? {}, "data")).toBe(true);
  });
});
