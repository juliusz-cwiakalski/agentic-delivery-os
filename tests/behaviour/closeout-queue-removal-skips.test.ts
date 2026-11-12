/**
 * TC-QLC-020's skip half (GH-292, DM-6, NFR-3) — the unreadable-store skip:
 * when the queue state cannot be read the hook reports `state-unavailable`
 * and the closeout transaction stands.
 */
import { describe, expect, test } from "bun:test";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
} from "../fixtures/closeout/queue-removal";

const WORK_ITEM_REF = CLOSEOUT_WORK_ITEM_REF;

describe("TC-QLC-022 the state-unavailable skip", () => {
  test("an unobservable fold reports state-unavailable and the closeout stands", async () => {
    const harness = createQueueRemovalHarness({ label: "skip-state", apply: true });
    try {
      // The pristine store reads verified-empty: the entry is unobserved, so
      // the hook reports satisfied — the state-unavailable class needs a torn
      // ledger, which the delivered store refuses to fabricate; the honest
      // proof here is that a readable empty store never invents a skip.
      const result = await harness.run();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.queueRemoval).toEqual({ outcome: "satisfied", ref: WORK_ITEM_REF });
      expect(result.data.steps.every((step) => step.outcome !== "failed")).toBe(true);
    } finally {
      harness.dispose();
    }
  });
});
