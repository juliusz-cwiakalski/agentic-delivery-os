/**
 * TC-BOARD-010 — the default form is the invoking checkout: scope repository,
 * selection current, exactly its key, zero host-index reads (AC-F3-6,
 * AC-NFR5-1, DEC-14, C-15).
 */
import { describe, expect, test } from "bun:test";
import { createSelectionHarness } from "../fixtures/board/selection";

describe("TC-BOARD-010 default selection", () => {
  test("scope, selection, key set, zero index reads, and no foreign read", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }, { projectKey: "delivery-b" }],
      invokingKey: "delivery-a",
    });
    try {
      const run = await harness.run(["board"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.scope).toBe("repository");
      expect(run.data?.selection).toBe("current");
      expect(run.data?.repositories).toEqual(["delivery-a"]);
      expect(run.data?.omittedBySection).toMatchObject({ repositories: 0 });
      expect(run.data?.truncated).toBe(false);
      expect(harness.indexReads()).toBe(0);
      expect(harness.storesOpened).toHaveLength(1);
      expect(harness.storesOpened[0]).toContain("delivery-a");
    } finally {
      harness.dispose();
    }
  });
});
