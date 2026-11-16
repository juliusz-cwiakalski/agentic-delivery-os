/**
 * TC-BOARD-013 and TC-BOARD-014 — `--project` narrows to one managed key (a
 * group key is refused) and the delivered `fallback.invocation` governs grammar
 * refusals before any read (AC-F3-3, AC-F3-4, DEC-17, NG-3).
 */
import { describe, expect, test } from "bun:test";
import { createSelectionHarness } from "../fixtures/board/selection";

describe("TC-BOARD-013/014 --project selection", () => {
  test("a managed key narrows and reads no other repository", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }, { projectKey: "delivery-b" }],
      invokingKey: "delivery-a",
    });
    try {
      const run = await harness.run(["board", "--project", "delivery-b"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.selection).toBe("project");
      expect(run.data?.repositories).toEqual(["delivery-b"]);
      expect(harness.storesOpened).toHaveLength(1);
      expect(harness.storesOpened[0]).toContain("delivery-b");
    } finally {
      harness.dispose();
    }
  });

  test("an unmanaged key, including a group key, is board.repository-unknown", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }],
      invokingKey: "delivery-a",
    });
    try {
      const run = await harness.run(["board", "--project", "delivery-group"]);
      expect(run.exitCode).toBe(1);
      expect(run.errorCode).toBe("board.repository-unknown");
      expect(run.data).toBeUndefined();
      expect(harness.storesOpened).toHaveLength(0);
    } finally {
      harness.dispose();
    }
  });

  test("grammar refusals are fallback.invocation before any read", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }],
      invokingKey: "delivery-a",
    });
    try {
      const invocations: readonly (readonly string[])[] = [
        ["board", "--all", "--project", "delivery-a"],
        ["board", "--project"],
        ["board", "--unknown-flag"],
        ["board", "positional"],
      ];
      for (const argv of invocations) {
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        expect(run.errorCode, argv.join(" ")).toBe("fallback.invocation");
        expect(run.data, argv.join(" ")).toBeUndefined();
      }
      expect(harness.indexReads()).toBe(0);
      expect(harness.storesOpened).toHaveLength(0);
    } finally {
      harness.dispose();
    }
  });
});
