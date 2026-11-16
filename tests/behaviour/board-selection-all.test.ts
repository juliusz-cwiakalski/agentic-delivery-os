/**
 * TC-BOARD-011, TC-BOARD-012, TC-BOARD-016 — `--all` is the index union the
 * invoking checkout, ascending and unique, and the managed-set edge cells are
 * classified (AC-F3-1, AC-F8-2, AC-NFR5-1, SC-M2-S4-02).
 */
import { describe, expect, test } from "bun:test";
import { createSelectionHarness } from "../fixtures/board/selection";

describe("TC-BOARD-011/012/016 --all selection", () => {
  test("both keys listed once, ascending, one index read, no cap omission", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-b" }, { projectKey: "delivery-a" }],
      invokingKey: "delivery-a",
    });
    try {
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.selection).toBe("all");
      expect(run.data?.repositories).toEqual(["delivery-a", "delivery-b"]);
      expect(run.data?.omittedBySection).toMatchObject({ repositories: 0 });
      expect(run.data?.truncated).toBe(false);
      expect(harness.indexReads()).toBe(1);
      expect(harness.storesOpened).toHaveLength(2);
    } finally {
      harness.dispose();
    }
  });

  test("a vanished root is not a board repository", async () => {
    const harness = createSelectionHarness({
      repositories: [
        { projectKey: "delivery-a" },
        { projectKey: "delivery-gone", rootExists: false },
      ],
      invokingKey: "delivery-a",
    });
    try {
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.repositories).toEqual(["delivery-a"]);
      expect(harness.storesOpened).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });

  test("an absent index is not an error; an unreadable or unparseable one withholds", async () => {
    const absent = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }],
      invokingKey: "delivery-a",
      index: "absent",
    });
    try {
      const run = await absent.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.repositories).toEqual(["delivery-a"]);
    } finally {
      absent.dispose();
    }
    for (const index of ["unreadable", "unparseable"] as const) {
      const harness = createSelectionHarness({
        repositories: [{ projectKey: "delivery-a" }],
        invokingKey: "delivery-a",
        index,
      });
      try {
        const run = await harness.run(["board", "--all"]);
        expect(run.exitCode, index).toBe(2);
        expect(run.errorCode, index).toBe("board.state-unavailable");
        expect(run.data, index).toBeUndefined();
        expect(run.stderr).toContain("host index");
      } finally {
        harness.dispose();
      }
    }
  });
});
