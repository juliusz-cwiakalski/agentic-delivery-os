/**
 * TC-SLA-019 — identical injected facts, clock, policy, brand, and run id
 * produce byte-identical output in both modes; fact and policy permutations do
 * not change the bytes; a changed fact does.
 */
import { describe, expect, test } from "bun:test";
import { createBoardHarness } from "../fixtures/board/harness";
import {
  asPolicy,
  clonePolicy,
  gateFact,
  HOUR_MS,
  ownerReviewGate,
  shippedPolicy,
  waiverGate,
} from "../fixtures/board/matrix";

const GATES = [
  ownerReviewGate("GH-1101", 10 * HOUR_MS),
  ownerReviewGate("GH-1102", 26 * HOUR_MS),
  waiverGate("GH-1103", 72 * HOUR_MS),
  gateFact({ id: "GH-1104", absent: "missing" }),
  gateFact({ id: "GH-1105", activityAt: "not-a-date" }),
  ownerReviewGate("GH-1106", 100 * HOUR_MS, { waivedBy: "owner" }),
  ownerReviewGate("GH-1107", 73 * HOUR_MS),
  ownerReviewGate("GH-1108", 2 * HOUR_MS),
];

const runOnce = async (
  mode: "json" | "text",
  gates = GATES,
  policy = shippedPolicy(),
): Promise<string> => {
  const board = createBoardHarness({ gates, policy });
  try {
    const run = await board.run([], { json: mode === "json" });
    return run.stdout;
  } finally {
    board.cleanup();
  }
};

describe("TC-SLA-019 determinism", () => {
  test("machine output is byte-identical across identical runs", async () => {
    expect(await runOnce("json")).toBe(await runOnce("json"));
  });

  test("human output is byte-identical across identical runs", async () => {
    expect(await runOnce("text")).toBe(await runOnce("text"));
  });

  test("reversed collector facts produce identical gate order and bytes", async () => {
    expect(await runOnce("json", [...GATES].reverse())).toBe(await runOnce("json"));
  });

  test("reversed policy iteration order produces identical bytes", async () => {
    const reversed = clonePolicy();
    reversed.rows.reverse();
    expect(await runOnce("json", GATES, asPolicy(reversed))).toBe(await runOnce("json"));
  });

  test("50 iterations in one process produce a single hash", async () => {
    const hashes = new Set<string>();
    for (let index = 0; index < 50; index += 1) {
      hashes.add(await runOnce("json"));
    }
    expect(hashes.size).toBe(1);
  });

  test("a changed fact crossing a threshold produces different bytes", async () => {
    const before = await runOnce("json", [ownerReviewGate("GH-1109", 24 * HOUR_MS - 1)]);
    const after = await runOnce("json", [ownerReviewGate("GH-1109", 24 * HOUR_MS)]);
    expect(before).not.toBe(after);
    const stateOf = (text: string): unknown =>
      (JSON.parse(text) as { data: { gates: { slaState: string }[] } }).data.gates[0]?.slaState;
    expect(stateOf(before)).toBe("fresh");
    expect(stateOf(after)).toBe("escalated");
  });

  test("gate ids are stable across forward and reversed facts", async () => {
    const forward = await runOnce("json");
    const reversed = await runOnce("json", [...GATES].reverse());
    const ids = (text: string): string[] =>
      (JSON.parse(text) as { data: { gates: { id: string }[] } }).data.gates.map((gate) => gate.id);
    expect(ids(forward)).toEqual(ids(reversed));
  });
});
