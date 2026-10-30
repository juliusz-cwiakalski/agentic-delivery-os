/**
 * TC-RESULT-004 — timing is present and measured on success, classified failure,
 * unknown failure, and broken invocation; a zero delta is a present zero.
 */
import { describe, expect, test } from "bun:test";
import { loadGoldenCases } from "../../packages/testkit/src/result-conformance";
import { GOLDEN_ROOT, runCase } from "./helpers";

const cases = await loadGoldenCases(GOLDEN_ROOT);
const selectedIds = [
  "success-data",
  "classified-user",
  "unknown-failure",
  "broken-unknown-command",
] as const;

const selected = selectedIds.map((id) => {
  const testCase = cases.find((entry) => entry.id === id);
  if (testCase === undefined) throw new Error(`golden case ${id} is missing`);
  return testCase;
});

const envelopeOf = (stdout: string): Record<string, unknown> =>
  JSON.parse(stdout) as Record<string, unknown>;

describe("TC-RESULT-004 timing on all four paths", () => {
  test("timing is present and equals the injected delta on every path", async () => {
    for (const testCase of selected) {
      const run = await runCase(testCase);
      const envelope = envelopeOf(run.stdout);
      const delta = (testCase.injected.ticks[1] as number) - (testCase.injected.ticks[0] as number);
      expect(envelope.timing).toEqual({ totalMs: delta });
      expect(Object.hasOwn(envelope, "timing")).toBe(true);
    }
  });

  test("a changed delta changes only timing", async () => {
    const testCase = selected[0];
    if (testCase === undefined) throw new Error("timing case is missing");
    const baseline = await runCase(testCase);
    const changed = await runCase(testCase, {
      ticks: [testCase.injected.ticks[0] as number, (testCase.injected.ticks[0] as number) + 21],
    });
    const baselineEnvelope = envelopeOf(baseline.stdout);
    const changedEnvelope = envelopeOf(changed.stdout);
    expect(changedEnvelope.timing).toEqual({ totalMs: 21 });
    delete baselineEnvelope.timing;
    delete changedEnvelope.timing;
    expect(changedEnvelope).toEqual(baselineEnvelope);
  });

  test("a zero delta is a present zero, never omitted or null", async () => {
    const testCase = selected.find((entry) => entry.id === "unknown-failure");
    if (testCase === undefined) throw new Error("unknown-failure case is missing");
    const run = await runCase(testCase);
    const envelope = envelopeOf(run.stdout);
    expect(envelope.timing).toEqual({ totalMs: 0 });
    expect(envelope.timing).not.toBeNull();
  });

  test("timing has the same shape on success and failure paths", async () => {
    for (const testCase of selected) {
      const envelope = envelopeOf((await runCase(testCase)).stdout);
      expect(typeof envelope.timing).toBe("object");
      expect(Object.keys(envelope.timing as object)).toEqual(["totalMs"]);
      expect(typeof (envelope.timing as { totalMs: unknown }).totalMs).toBe("number");
    }
  });
});
