/**
 * TC-BOARD-064 — the repository list is capped at 128 with a deterministic
 * retained set and counted overflow (AC-F9-4, AC-F3-4, DM-11, DEC-13, RSK-9).
 */
import { describe, expect, test } from "bun:test";
import { BOARD_MAX_REPOSITORIES } from "../../packages/core/src/contracts/index";
import { createSelectionHarness } from "../fixtures/board/selection";

const keys = (count: number): readonly { readonly projectKey: string }[] =>
  Array.from({ length: count }, (_, index) => ({
    projectKey: `repository-${String(index).padStart(3, "0")}`,
  }));

describe("TC-BOARD-064 repository cap", () => {
  test("an at-cap set is listed whole with no omission", async () => {
    const harness = createSelectionHarness({
      repositories: keys(BOARD_MAX_REPOSITORIES),
      invokingKey: "repository-000",
    });
    try {
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      expect(((run.data?.repositories ?? []) as readonly string[]).length).toBe(
        BOARD_MAX_REPOSITORIES,
      );
      expect(run.data?.omittedBySection).toMatchObject({ repositories: 0 });
      expect(run.data?.truncated).toBe(false);
    } finally {
      harness.dispose();
    }
  }, 120_000);

  test("129 entries keep the invoking key, list 128, and count the overflow", async () => {
    const harness = createSelectionHarness({
      repositories: keys(BOARD_MAX_REPOSITORIES + 1),
      invokingKey: "repository-128",
    });
    try {
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      const repositories = run.data?.repositories as readonly string[];
      expect(repositories).toHaveLength(BOARD_MAX_REPOSITORIES);
      expect(repositories).toContain("repository-128");
      expect([...repositories]).toEqual([...repositories].sort());
      expect(new Set(repositories).size).toBe(repositories.length);
      expect(run.data?.omittedBySection).toMatchObject({ repositories: 1 });
      expect(run.data?.truncated).toBe(true);

      // A key beyond the ascending cap is still a valid --project target.
      const narrowed = await harness.run(["board", "--project", "repository-128"]);
      expect(narrowed.exitCode).toBe(0);
      expect(narrowed.data?.repositories).toEqual(["repository-128"]);
    } finally {
      harness.dispose();
    }
  }, 120_000);
});
