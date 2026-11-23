/** TC-MERGE-036 / TC-MERGE-037 — byte-pinned merge success and refusal goldens. */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MERGE_COMPOSITION_EMITTABLE_CODES } from "../../packages/cli/src/production";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
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

  test("TC-MRG-044/046 the success golden renders the evaluated projection, never the battery list", () => {
    const data = JSON.parse(goldenText("success-data.json")) as {
      gates?: readonly { id: string; verdict: string }[];
    };
    // The evaluated merge-applicable projection: exactly two entries.
    expect((data.gates ?? []).map((gate) => gate.id)).toEqual(["ci-green", "tracker-freshness"]);
    const human = goldenText("success-human.txt");
    expect(human).toContain("gates=2/2 passed");
    expect(human).not.toContain("gates=5/5");
    expect(human).toContain("gate ci-green pass");
    expect(human).toContain("gate tracker-freshness pass");
    // The mutation control: the record's five-entry battery list substituted
    // for the projection fails the rendering contract by name.
    const battery = [
      "lifecycle-finalization",
      "ci-green",
      "push-parity",
      "owner-gate",
      "squash-preflight",
    ];
    expect(human).not.toContain(`gate ${battery[0]} pass reason=lifecycle-complete`);
    expect(battery).toHaveLength(5);
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
    "refusal-work-item",
    "refusal-branch",
    "refusal-request",
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

  test("every refusal golden renders the three dedicated fields beside its condition", () => {
    // The phase-2 rendering contract (DEC-11): the dedicated `command=merge`,
    // `ref=<ref>` and `operation=<token>` fields follow the condition line in
    // the human form and inside the scripted summary, drawn from the context
    // and the closed vocabulary — never from a summary substring.
    for (const name of cases) {
      const text = goldenText(`${name}-human.txt`);
      expect(text, name).toContain("command=merge");
      expect(text, name).toContain("ref=GH-301");
      expect(text, name).toMatch(
        /operation=(github-[a-z-]+|repository-[a-z-]+|delivery-registry|local-[a-z-]+|-)(\n|$)/,
      );
      const scripted = goldenText(`${name}-scripted.json`);
      expect(scripted, name).toContain("command=merge");
      expect(scripted, name).toContain("ref=GH-301");
      expect(scripted, name).toContain("operation=");
    }
  });

  test("a changed evidence field in a mutated golden fails", () => {
    const golden = goldenText("refusal-stale-human.txt");
    expect(golden.replace("verification-age=31m", "verification-age=30m")).not.toBe(golden);
  });
});

describe("TC-F1-014/TC-FLOOR-005 the merge golden set is exactly nineteen files", () => {
  /** The refusal set (ten moved, six added) and the success trio. */
  const EXPECTED = [
    "refusal-gate-human.txt",
    "refusal-gate-scripted.json",
    "refusal-override-human.txt",
    "refusal-override-scripted.json",
    "refusal-stale-human.txt",
    "refusal-stale-scripted.json",
    "refusal-tracker-human.txt",
    "refusal-tracker-scripted.json",
    "refusal-waiver-human.txt",
    "refusal-waiver-scripted.json",
    "refusal-work-item-human.txt",
    "refusal-work-item-scripted.json",
    "refusal-branch-human.txt",
    "refusal-branch-scripted.json",
    "refusal-request-human.txt",
    "refusal-request-scripted.json",
    "success-data.json",
    "success-human.txt",
    "success-scripted.json",
  ] as const;

  test("the directory holds the nineteen declared files and the retired pair is absent", () => {
    const present = readdirSync(GOLDEN).sort();
    expect(present).toEqual([...EXPECTED].sort());
    for (const retired of ["refusal-rebase-human.txt", "refusal-rebase-scripted.json"]) {
      expect(present).not.toContain(retired);
    }
    // The directory is never declared as a folder, so a third moved or retired
    // file is visible here rather than silently regenerated.
    expect(present).toHaveLength(19);
  });

  test("no golden carries the retired scenario's identity", () => {
    for (const file of presentGoldenFiles()) {
      expect(goldenText(file)).not.toContain("refusal-rebase");
    }
    expect(goldenScenarios()["refusal-rebase" as string]).toBeUndefined();
  });

  test("exactly the two declared goldens carry the attribution line", async () => {
    const human = await runScenario("refusal-gate", { json: false });
    const scripted = await runScenario("refusal-gate", { json: true, scripted: true });
    expect(goldenText("refusal-gate-human.txt")).toContain("attribution=probe");
    expect(textOf(human)).toBe(goldenText("refusal-gate-human.txt"));
    expect(goldenText("refusal-gate-scripted.json")).toContain("attribution=probe");
    expect(scripted.stdout).toBe(goldenText("refusal-gate-scripted.json"));
    // A blanket regeneration that moved a third file is visible here by name.
    for (const file of presentGoldenFiles()) {
      if (file === "refusal-gate-human.txt" || file === "refusal-gate-scripted.json") continue;
      expect(goldenText(file)).not.toContain("attribution=");
    }
  });

  test("the reserved merge.rebase-conflict identity is still declared and emittable", () => {
    // Retirement is of the scenario, never of the identity: the row stays in
    // the error table and in the composition's declared emittable set.
    expect(ERROR_TABLE.some((row) => row.code === "merge.rebase-conflict")).toBe(true);
    expect(MERGE_COMPOSITION_EMITTABLE_CODES as readonly string[]).toContain(
      "merge.rebase-conflict",
    );
  });

  test("the recorded attribution scenario renders its own value without a byte-pinned file", async () => {
    const scenario = goldenScenarios()["refusal-required-job-recorded"];
    if (scenario === undefined) throw new Error("refusal-required-job-recorded missing");
    const { harness, args } = scenario();
    try {
      const run = await harness.run(args, { json: false });
      expect(textOf(run)).toContain("attribution=recorded");
      expect(textOf(run)).not.toContain("attribution=probe");
    } finally {
      harness.cleanup();
    }
  });
});

const presentGoldenFiles = (): readonly string[] => readdirSync(GOLDEN);
