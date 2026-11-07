/** TC-MERGE-036 / TC-MERGE-037 — byte-pinned merge success and refusal goldens. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { goldenScenarios } from "../fixtures/merge/golden-scenarios";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/merge/golden");

const goldenText = (name: string): string => readFileSync(join(GOLDEN, name), "utf8");

const runScenario = async (
  name: string,
  mode: { readonly json: boolean; readonly scripted?: boolean },
) => {
  const scenario = goldenScenarios()[name];
  if (scenario === undefined) throw new Error(`unknown scenario ${name}`);
  const { harness, args } = scenario();
  try {
    return await harness.run(args, {
      json: mode.json,
      ...(mode.scripted === true ? { mode: "scripted" as const } : {}),
    });
  } finally {
    harness.cleanup();
  }
};

const textOf = (run: { stdout: string; stderr: string }): string =>
  run.stdout.length > 0 ? run.stdout : run.stderr;

describe("TC-MERGE-036 the merge success golden is byte-pinned", () => {
  test("the machine data equals the committed golden and validates", async () => {
    const run = await runScenario("success", { json: true });
    expect(assertEnvelopeContract(run.envelope)).toEqual([]);
    expect(run.envelope?.data).toEqual(JSON.parse(goldenText("success-data.json")));
    expect(JSON.stringify(run.envelope?.data).length).toBeLessThanOrEqual(65_536);
  });

  test("the human output equals the committed golden exactly", async () => {
    const run = await runScenario("success", { json: false });
    expect(textOf(run)).toBe(goldenText("success-human.txt"));
    expect(textOf(run)).toContain("result=merged");
    expect(textOf(run)).toContain("squash=");
    expect(textOf(run)).toContain("gate ci-green pass");
  });

  test("a mutated golden fails the comparison", () => {
    const golden = goldenText("success-human.txt");
    expect(golden.replace("result=merged", "result=landed")).not.toBe(golden);
  });
});

describe("TC-MERGE-037 every refusal golden is pinned in text, scripted, and trimmed form", () => {
  const cases = [
    "refusal-stale",
    "refusal-gate",
    "refusal-tracker",
    "refusal-waiver",
    "refusal-override",
    "refusal-rebase",
  ] as const;

  for (const name of cases) {
    test(`${name}: text refusal matches its committed golden`, async () => {
      const run = await runScenario(name, { json: false });
      expect(textOf(run)).toBe(goldenText(`${name}-human.txt`));
      expect(textOf(run)).toContain("result=refused");
      expect(textOf(run)).not.toContain("squash=");
    });

    test(`${name}: scripted refusal matches its committed one-line golden`, async () => {
      const run = await runScenario(name, { json: true, scripted: true });
      expect(run.stdout).toBe(goldenText(`${name}-scripted.json`));
      expect(run.stdout.trim().split("\n")).toHaveLength(1);
      const parsed = JSON.parse(run.stdout.trim()) as Record<string, unknown>;
      expect(Object.keys(parsed).sort()).toEqual(["error", "runId"]);
      expect(Object.hasOwn(parsed, "data")).toBe(false);
      expect(Object.hasOwn(parsed, "schemaVersion")).toBe(false);
      expect(Object.hasOwn(parsed, "timing")).toBe(false);
      expect((parsed.error as { code?: string }).code).toBeDefined();
    });
  }

  test("the stale evidence golden carries age, bound, and the new red job", () => {
    const text = goldenText("refusal-stale-human.txt");
    expect(text).toContain("verification-age=31m");
    expect(text).toContain("bound=30m");
    expect(text).toContain("CI / test (18)");
  });

  test("the tracker evidence golden carries the transition and its age", () => {
    const text = goldenText("refusal-tracker-human.txt");
    expect(text).toContain("owner-transition=");
    expect(text).toContain("hand-back");
    expect(text).toContain("age=1m");
  });

  test("a changed evidence field in a mutated golden fails", () => {
    const golden = goldenText("refusal-stale-human.txt");
    expect(golden.replace("verification-age=31m", "verification-age=30m")).not.toBe(golden);
  });
});
