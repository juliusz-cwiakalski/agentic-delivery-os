/**
 * TC-ACTION-027 — determinism and purity: byte-identical list, board, and report
 * renders over identical stored actions, injected clock, and injected run id;
 * zero model calls; deterministic refusals (NFR-1, NFR-3, AC-F1-1, AC-F6-2).
 */
import { describe, expect, test } from "bun:test";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { runActionCli, runBoardCli } from "../fixtures/action/run";
import { fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const seed = (store: ReturnType<typeof makeActionStore>["store"]) => {
  for (let index = 0; index < 6; index += 1) {
    expect(
      fileAction(store, conformingDraft({ window: `window-${String(index % 2)}` }), {
        actionId: `action-${String(index)}`,
        filedAt: FILING_MS,
      }).ok,
    ).toBe(true);
  }
};

describe("TC-ACTION-027 every surface is repeatable", () => {
  test("list, report, and board renders are byte-identical across repeated invocations", async () => {
    const fixture = makeActionStore("determinism");
    try {
      seed(fixture.store);
      for (const argv of [
        ["retro", "action", "list", "--json"],
        ["retro", "report", "--json"],
      ] as const) {
        const first = await runActionCli(argv, fixture.store);
        const second = await runActionCli(argv, fixture.store);
        expect(second.stdout, argv.join(" ")).toBe(first.stdout);
      }
      const board = await runBoardCli({
        repository: "example-repository",
        actions: [
          {
            actionId: "action-0",
            owner: "agent-role:reviewer",
            level: "change",
            age: 1000,
            agingState: "current",
            window: "window-0",
            windowOpenCount: 3,
            windowLimit: 3,
          },
        ],
      });
      const boardAgain = await runBoardCli({
        repository: "example-repository",
        actions: [
          {
            actionId: "action-0",
            owner: "agent-role:reviewer",
            level: "change",
            age: 1000,
            agingState: "current",
            window: "window-0",
            windowOpenCount: 3,
            windowLimit: 3,
          },
        ],
      });
      expect(boardAgain.stdout).toBe(board.stdout);
    } finally {
      fixture.cleanup();
    }
  });

  test("the same incomplete filing twice yields the identical refusal envelope", async () => {
    const fixture = makeActionStore("determinism-refusal");
    try {
      const argv = ["retro", "action", "file", "--owner-kind", "agent-role", "--json"] as const;
      const first = await runActionCli(argv, fixture.store);
      const second = await runActionCli(argv, fixture.store);
      expect(second.stdout).toBe(first.stdout);
      expect(first.exitCode).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  test("no model or network seam exists on the new paths (structural control)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const file of [
      "packages/core/src/domain/action-filing.ts",
      "packages/core/src/domain/action-aging.ts",
      "packages/core/src/domain/action-closure.ts",
    ]) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      for (const marker of ["fetch(", "http.", "model", "Date.now", "Math.random"]) {
        expect(text.includes(marker), `${file}: ${marker}`).toBe(false);
      }
    }
  });
});
