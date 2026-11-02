/** TC-VGATES-044/045/052/063 — committed goldens and replay equality. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/verify-gates/golden");

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

describe("TC-VGATES-044/045 golden success data and envelope", () => {
  test("the machine envelope is valid and matches the committed data golden", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(assertEnvelopeContract(result.envelope)).toEqual([]);
    const golden = JSON.parse(readFileSync(join(GOLDEN, "success-data.json"), "utf8")) as unknown;
    expect(result.envelope?.data).toEqual(golden);
    expect(JSON.stringify(result.envelope?.data).length).toBeLessThanOrEqual(65536);
  });

  test("the human report matches the committed golden exactly", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"], { json: false });
    expect(result.stdout).toBe(readFileSync(join(GOLDEN, "human-success.txt"), "utf8"));
  });
});

describe("TC-VGATES-042/052 failure summary golden and replay", () => {
  test("the failure summary matches the committed golden", async () => {
    const result = await runVerify(combinedRuntime({ facts: redFacts() }), ["gates", "GH-178"]);
    const summary = (result.envelope?.error as { summary?: string } | undefined)?.summary ?? "";
    expect(`${summary}\n`).toBe(readFileSync(join(GOLDEN, "failure-summary.txt"), "utf8"));
  });

  test("replaying the same facts is byte-identical", async () => {
    const first = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    const second = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(second.stdout).toBe(first.stdout);
    expect(second.stderr).toBe(first.stderr);
    expect(second.exitCode).toBe(first.exitCode);
  });

  test("TC-VGATES-063 verify change human output matches the pre-change golden", async () => {
    const result = await runVerify(combinedRuntime(), ["change", "GH-178"], { json: false });
    expect(result.stdout).toBe(readFileSync(join(GOLDEN, "verify-change-human.txt"), "utf8"));
  });
});
