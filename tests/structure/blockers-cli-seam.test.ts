/**
 * TC-BLK-006 — the blockers handler is a pure data/failure producer over the
 * exact three-subcommand grammar; rejections happen before any state read.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createBlockersHarness } from "../fixtures/blockers/harness";

const ROOT = process.cwd();
const COMMAND = "packages/cli/src/commands/blockers.ts";

const forbiddenSourceViolations = (text: string): string[] => {
  const violations: string[] = [];
  if (text.includes("console.")) violations.push("console");
  if (text.includes("process.exit")) violations.push("process.exit");
  if (text.includes("stdout")) violations.push("stdout");
  if (text.includes("stderr")) violations.push("stderr");
  if (/from\s+"node:/.test(text)) violations.push("node runtime import");
  if (/\bexitCode\s*:/.test(text)) violations.push("exit literal");
  return violations;
};

describe("TC-BLK-006 CLI handler purity and grammar", () => {
  test("the handler source has no stream write, console, exit literal, or runtime import", () => {
    const text = readFileSync(join(ROOT, COMMAND), "utf8");
    expect(forbiddenSourceViolations(text)).toEqual([]);
  });

  test("a planted console.log/process.exit control fails the detector by name", () => {
    const violations = forbiddenSourceViolations("console.log('leak');\nprocess.exit(0);\n");
    expect(violations).toContain("console");
    expect(violations).toContain("process.exit");
  });

  test("the grammar is exactly list, answer, and publish", async () => {
    const harness = createBlockersHarness();
    try {
      const list = await harness.run(["list"]);
      expect(list.exitCode).toBe(0);
      const publish = await harness.run([
        "publish",
        "spec-ambiguity",
        "--lane",
        "L2",
        "which spec?",
      ]);
      expect(publish.exitCode).toBe(0);
      const answer = await harness.run(["answer", "q-fixture-1", "--text", "the first spec"]);
      expect(answer.exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });

  test("malformed invocations fail fallback.invocation before any state read", async () => {
    const harness = createBlockersHarness();
    try {
      const cases: readonly (readonly string[])[] = [
        [],
        ["list", "extra"],
        ["list", "--bogus"],
        ["frobnicate"],
        ["publish", "decision-needed", "question without lane"],
        ["publish", "decision-needed", "--lane", "L2"],
        ["answer"],
        ["answer", "q-1", "extra"],
      ];
      for (const argv of cases) {
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        expect(run.envelope?.error, argv.join(" ")).toMatchObject({
          code: "fallback.invocation",
        });
      }
      expect(harness.recorder.calls.filter((call) => call === "readRecords")).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  test("machine mode emits exactly one JSON document and human mode uses the renderer", async () => {
    const harness = createBlockersHarness();
    try {
      const machine = await harness.run(["list"]);
      expect(machine.exitCode).toBe(0);
      expect(machine.stderr).toBe("");
      expect(machine.stdout.trim().split("\n")[0]).toBe("{");
      const human = await harness.run(["list"], { json: false });
      expect(human.exitCode).toBe(0);
      expect(human.stdout).toContain("example-product blockers");
      expect(human.stdout.startsWith("{")).toBe(false);
    } finally {
      harness.cleanup();
    }
  });
});
