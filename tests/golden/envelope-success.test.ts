/**
 * TC-RESULT-002 — success envelopes match their goldens byte-for-byte and carry
 * exactly the contracted fields.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  assertEnvelopeContract,
  loadGoldenCases,
} from "../../packages/testkit/src/result-conformance";
import { GOLDEN_ROOT, isSingleJsonDocument, ROOT, runCase } from "./helpers";

const cases = await loadGoldenCases(GOLDEN_ROOT);
const successCases = cases.filter(
  (entry) => entry.id === "success-data" || entry.id === "success-void",
);

describe("TC-RESULT-002 success envelope goldens", () => {
  test("the success cases are discovered", () => {
    expect(successCases.map((entry) => entry.id)).toEqual(["success-data", "success-void"]);
  });

  for (const testCase of successCases) {
    test(`${testCase.id} emits one valid envelope with exit code 0`, async () => {
      const run = await runCase(testCase);
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe(testCase.stdout);
      expect(run.stderr).toBe(testCase.stderr);
      expect(isSingleJsonDocument(run.stdout)).toBe(true);
      const envelope = JSON.parse(run.stdout) as Record<string, unknown>;
      expect(envelope.exitCode).toBe(0);
      expect(envelope.schemaVersion).toBe("delivery.result.v1");
      expect(envelope.runId).toBe(testCase.injected.runId);
      expect(envelope.timing).toEqual({
        totalMs: (testCase.injected.ticks[1] as number) - (testCase.injected.ticks[0] as number),
      });
      expect(Object.hasOwn(envelope, "error")).toBe(false);
      expect(assertEnvelopeContract(envelope)).toEqual([]);
    });
  }

  test("the data payload equals the fixture payload", async () => {
    const testCase = successCases.find((entry) => entry.id === "success-data");
    if (testCase === undefined) throw new Error("success-data fixture is missing");
    const run = await runCase(testCase);
    const envelope = JSON.parse(run.stdout) as { data: unknown };
    expect(envelope.data).toEqual({ message: "all good", count: 2 });
  });

  test("goldens carry no product token, absolute path, username, or timestamp", () => {
    for (const testCase of successCases) {
      const text = testCase.stdout;
      for (const token of [
        "a" + "dos",
        "A" + "DOS_",
        "~/" + "." + "ad" + "os",
        "/home/",
        "root@",
      ]) {
        expect(text.includes(token), `${testCase.id}: ${token}`).toBe(false);
      }
      expect(text).not.toMatch(/\b20\d\d-\d\d-\d\dT/);
    }
    expect(ROOT.length).toBeGreaterThan(0);
    expect(join(ROOT, "tests")).toContain("tests");
  });
});
