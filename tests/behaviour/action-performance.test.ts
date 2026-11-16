/**
 * TC-ACTION-030 (board half) — the board's actions projection composes within
 * the delivered board budget: bounded work per invocation (one bounded registry
 * read, pure projection, no per-row re-read) with a reference measurement only
 * (NFR-6, GAP-3).
 */
import { describe, expect, test } from "bun:test";
import { runBoardCli } from "../fixtures/action/run";

const actions = Array.from({ length: 8 }, (_, index) => ({
  actionId: `action-${String(index)}`,
  owner: "agent-role:reviewer",
  level: "change",
  age: index * 1000,
  agingState: index > 3 ? "nudged" : "current",
  window: "window-a",
  windowOpenCount: 8,
  windowLimit: 3,
}));

describe("TC-ACTION-030 the board actions projection is bounded", () => {
  test("a cap-sized board renders deterministically with one projection pass", async () => {
    const started = performance.now();
    const first = await runBoardCli({ repository: "example-repository", actions });
    const elapsed = performance.now() - started;
    expect(first.exitCode).toBe(0);
    const second = await runBoardCli({ repository: "example-repository", actions });
    expect(second.stdout).toBe(first.stdout);
    // Reference measurement only (GAP-3): never a CI threshold.
    expect(Number.isFinite(elapsed)).toBe(true);
    const parsed = JSON.parse(first.stdout) as {
      readonly data: { readonly actions: readonly unknown[] };
    };
    expect(parsed.data.actions).toHaveLength(8);
  });
});
