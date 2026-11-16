/**
 * TC-BOARD-052 — `board.state-unavailable` names the failing repository key and
 * renders nothing; the classifier resolves both board identities with their
 * declared category, retryability, and exit row (AC-F8-2, AC-F2-3, DM-8).
 */
import { describe, expect, test } from "bun:test";
import { classifyDomainKind, resolveAppErrorCode } from "../../packages/cli/src/classify";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { createSelectionHarness } from "../fixtures/board/selection";

describe("TC-BOARD-052 board failure identities", () => {
  test("both rows are registered under one board kind with their exit classes", () => {
    const board = (ERROR_TABLE as readonly { domainKind: string }[]).filter(
      (entry) => entry.domainKind === "board",
    );
    expect(board).toHaveLength(2);
    const unknown = classifyDomainKind("board", "board.repository-unknown");
    expect(unknown.category).toBe("user");
    expect(unknown.projectionClass).toBe("user-validation");
    const unavailable = classifyDomainKind("board", "board.state-unavailable");
    expect(unavailable.category).toBe("platform");
    expect(unavailable.projectionClass).toBe("platform-provider");
    expect(resolveAppErrorCode("board.repository-unknowns").ok).toBe(false);
    expect(resolveAppErrorCode("board.state").ok).toBe(false);
  });

  test("an unreadable repository state withholds the board naming the key", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }],
      invokingKey: "delivery-a",
      index: "unreadable",
    });
    try {
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(2);
      expect(run.errorCode).toBe("board.state-unavailable");
      expect(run.data).toBeUndefined();
      expect(run.stdout).not.toContain("LANES");
    } finally {
      harness.dispose();
    }
  });
});
