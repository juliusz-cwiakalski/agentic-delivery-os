/**
 * TC-PILOT-005 — two runs replay byte-identically after path canonicalization.
 */
import { describe, expect, test } from "bun:test";
import { createPilot, type PilotSnapshot } from "../../fixtures/pilot/harness";

const runOnce = async (iso?: string): Promise<PilotSnapshot> => {
  const pilot = await createPilot(iso === undefined ? {} : { iso });
  try {
    await pilot.runSequence();
    return pilot.snapshot();
  } finally {
    pilot.cleanup();
  }
};

const firstDifference = (left: string, right: string): string => {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      return `at byte ${String(index)}: ${JSON.stringify(left.slice(index, index + 40))} != ${JSON.stringify(right.slice(index, index + 40))}`;
    }
  }
  return left.length === right.length
    ? "identical"
    : `length ${String(left.length)} != ${String(right.length)}`;
};

describe("TC-PILOT-005 byte-identical replay", () => {
  test("two fresh roots with identical fixtures produce identical outputs and records", async () => {
    const first = await runOnce();
    const second = await runOnce();
    const left = JSON.stringify(first);
    const right = JSON.stringify(second);
    expect(firstDifference(left, right)).toBe("identical");
    expect(first.ledger).toBe(second.ledger);
    expect(first.baseHead).toBe(second.baseHead);
    expect(first.logSubjects).toEqual(second.logSubjects);
    expect(first.changeFolder).toEqual(second.changeFolder);
  });

  test("a deliberate clock change yields a different but still deterministic result", async () => {
    const baseline = await runOnce();
    const changed = await runOnce("2026-11-08T00:00:00Z");
    const changedAgain = await runOnce("2026-11-08T00:00:00Z");
    expect(changed.outputs[0]?.stdout).not.toBe(baseline.outputs[0]?.stdout);
    expect(firstDifference(JSON.stringify(changed), JSON.stringify(changedAgain))).toBe(
      "identical",
    );
  });
});
