/**
 * TC-QLC-081 (GH-292, AC-NFR-2) — one refused admission costs at most one
 * additional whole-store read, appends zero lease/attempt/lane/queue records,
 * and starts zero sessions.
 */
import { describe, expect, test } from "bun:test";
import { dispatchAdmissionRefusal } from "../../packages/core/src/app/index";
import {
  type SingleFlightStore,
  seedLease,
  singleFlightStore,
} from "../fixtures/queue/single-flight/harness";

const countingStore = (
  single: SingleFlightStore,
): { store: SingleFlightStore["store"]; reads: () => number } => {
  let reads = 0;
  const wrapped: SingleFlightStore["store"] = {
    ...single.store,
    readRecords: () => {
      reads += 1;
      return single.store.readRecords();
    },
  };
  return { store: wrapped, reads: () => reads };
};

describe("TC-QLC-081 refused-admission read cost", () => {
  test("a dispatch-family refusal costs exactly one whole-store read", () => {
    const single = singleFlightStore("read-cost");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const counted = countingStore(single);
      const refused = dispatchAdmissionRefusal(counted.store, {
        ref: "GH-241",
        nowMs: single.nowMs(),
      });
      expect(refused).toMatchObject({ code: "queue.single-flight", holder: "lane-1" });
      expect(counted.reads()).toBe(1);
    } finally {
      single.dispose();
    }
  });

  test("the refusal appends zero records of any kind", () => {
    const single = singleFlightStore("read-cost-purity");
    try {
      seedLease(single, { holder: "lane-1", ref: "GH-241" });
      const before = single.store.readRecords();
      expect(before.ok).toBe(true);
      dispatchAdmissionRefusal(single.store, { ref: "GH-241", nowMs: single.nowMs() });
      const after = single.store.readRecords();
      expect(after.ok).toBe(true);
      if (!before.ok || !after.ok) return;
      expect(after.value.records.length).toBe(before.value.records.length);
    } finally {
      single.dispose();
    }
  });
});
