/** TC-VGATES-008..010, 069 — grammar before reads and five-record reporting. */
import { describe, expect, test } from "bun:test";
import {
  combinedRuntime,
  runVerify,
  throwingRuntime,
} from "../fixtures/verify-gates/cases/harness";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";

const errorCode = (result: { envelope?: Record<string, unknown> }): unknown =>
  (result.envelope?.error as { code?: unknown } | undefined)?.code;

describe("TC-VGATES-008 grammar is rejected before any read", () => {
  const cases: Array<[readonly string[], string]> = [
    [["gates"], "input.value.rejected"],
    [["gates", ""], "input.value.rejected"],
    [["wat", "GH-178"], "input.value.rejected"],
  ];
  for (const [args, code] of cases) {
    test(`rejects ${args.join(" ")} with ${code}`, async () => {
      const result = await runVerify(throwingRuntime(), args);
      expect(result.exitCode).toBe(1);
      expect(errorCode(result)).toBe(code);
      expect(result.envelope?.data).toBeUndefined();
    });
  }

  test("a third positional and an unknown flag are parser failures", async () => {
    for (const args of [
      ["gates", "GH-178", "extra"],
      ["gates", "GH-178", "--gate", "ci-green"],
    ]) {
      const result = await runVerify(throwingRuntime(), args);
      expect(result.exitCode).toBe(1);
      expect(errorCode(result)).toBe("fallback.invocation");
    }
  });

  test("plain verify is handler grammar; valid gates still reads", async () => {
    expect(errorCode(await runVerify(throwingRuntime(), []))).toBe("input.value.rejected");
    const accepted = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(accepted.exitCode).toBe(0);
  });
});

describe("TC-VGATES-009 accepted grammar and five records", () => {
  test("gates accepts one ref and returns the delivery.verify-gates.v1 report", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
    expect(result.exitCode).toBe(0);
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data).toMatchObject({
      schemaVersion: "delivery.verify-gates.v1",
      changeRef: "GH-178",
      target: "gates",
      overall: "pass",
      summary: { gates: 5, passed: 5, failed: 0, unknown: 0 },
    });
    expect((data.gates as unknown[]).length).toBe(5);
    expect(result.envelope?.error).toBeUndefined();
  });

  test("human mode prints exactly six lines", async () => {
    const result = await runVerify(combinedRuntime(), ["gates", "GH-178"], { json: false });
    const lines = result.stdout.trimEnd().split("\n");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain("verify gates GH-178");
    expect(lines[0]).toContain("pass");
  });

  test("change still accepts its grammar", async () => {
    const result = await runVerify(combinedRuntime(), ["change", "GH-178"]);
    expect(result.exitCode).toBe(0);
    expect((result.envelope?.data as { target?: string } | undefined)?.target).toBe("change");
  });
});

describe("TC-VGATES-010 failure preserves five records as five summary lines", () => {
  test("a red CI page fails overall with all five gate lines and no data", async () => {
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
    const result = await runVerify(combinedRuntime({ facts }), ["gates", "GH-178"]);
    expect(result.exitCode).toBe(1);
    expect(errorCode(result)).toBe("verify.gates.failed");
    expect(result.envelope?.data).toBeUndefined();
    const summary = (result.envelope?.error as { summary?: string } | undefined)?.summary ?? "";
    const lines = summary.split("\n");
    expect(lines).toHaveLength(6);
    expect(lines[0]).toContain("result=fail");
    expect(lines[1]).toContain("lifecycle-finalization");
    expect(lines[2]).toContain("ci-green");
    expect(lines[3]).toContain("push-parity");
    expect(lines[4]).toContain("owner-gate");
    expect(lines[5]).toContain("squash-preflight");
  });
});
