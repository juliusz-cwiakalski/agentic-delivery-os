/**
 * TC-BOARD-015 — an unbound or identity-underivable invoking checkout resolves
 * the declared `unbound` scope: empty board, one warning, exit 0, no index
 * fallback (AC-F3-5, AC-F3-6, DEC-14).
 */
import { describe, expect, test } from "bun:test";
import { createSelectionHarness } from "../fixtures/board/selection";

describe("TC-BOARD-015 unbound scope", () => {
  test("an underivable invoking checkout renders an honestly labelled empty board", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }],
      invokingKey: undefined,
    });
    try {
      const run = await harness.run(["board"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.scope).toBe("unbound");
      expect(run.data?.selection).toBe("current");
      expect(run.data?.repositories).toEqual([]);
      expect(run.data?.lanes).toEqual([]);
      expect(run.data?.gates).toEqual([]);
      expect(run.data?.asks).toEqual([]);
      expect(run.data?.parked).toEqual([]);
      expect(harness.indexReads()).toBe(0);
      expect(harness.storesOpened).toHaveLength(0);
    } finally {
      harness.dispose();
    }
  });

  test("--all and --project report scope repository even with an empty set", async () => {
    const harness = createSelectionHarness({
      repositories: [],
      invokingKey: undefined,
      index: "absent",
    });
    try {
      for (const argv of [
        ["board", "--all"],
        ["board", "--project", "delivery-a"],
      ]) {
        const run = await harness.run(argv);
        if (argv.includes("--project")) {
          expect(run.exitCode).toBe(1);
          expect(run.errorCode).toBe("board.repository-unknown");
          continue;
        }
        expect(run.exitCode).toBe(0);
        expect(run.data?.scope).toBe("repository");
        expect(run.data?.repositories).toEqual([]);
      }
    } finally {
      harness.dispose();
    }
  });
});
