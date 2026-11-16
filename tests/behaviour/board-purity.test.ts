/**
 * TC-BOARD-062 — no LLM, no non-GET request, no timer or daemon, and no
 * hardcoded product literal in the board path (AC-F9-3, NFR-7, DoD-12).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BoardData } from "../../packages/core/src/contracts/index";
import { renderBoardHuman } from "../../packages/core/src/domain/owner-gate-sla";
import { createBoardHarness } from "../fixtures/board/harness";
import { allFourRepository } from "../fixtures/board/sections";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const BOARD_MODULES = [
  "packages/core/src/contracts/owner-gate-sla.ts",
  "packages/core/src/domain/owner-gate-sla.ts",
  "packages/cli/src/commands/board.ts",
] as const;

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const FORBIDDEN = [
  "setTimeout(",
  "setInterval(",
  "setImmediate(",
  "child_process",
  "Bun.spawn",
  "execFile",
  "fetch(",
  "createDaemon",
  "createCoordinator",
];

describe("TC-BOARD-062 purity and brand", () => {
  test("no timer, spawn, network write, or daemon composition in the board modules", () => {
    for (const file of BOARD_MODULES) {
      const text = read(file);
      for (const token of FORBIDDEN) {
        expect(text, `${file}: ${token}`).not.toContain(token);
      }
    }
  });

  test("no hardcoded product or binary literal appears in the board modules", () => {
    for (const file of BOARD_MODULES) {
      const text = read(file);
      for (const literal of ["jaiship", "agentic-delivery-os"]) {
        expect(text.toLowerCase(), `${file}: ${literal}`).not.toContain(literal);
      }
      // `@delivery-os/...` is the workspace package scope, not a product name;
      // any other occurrence of the working name would be a hardcoded literal.
      for (const line of text.split("\n")) {
        if (line.includes("@delivery-os/")) continue;
        expect(line.toLowerCase(), file).not.toContain("delivery-os");
      }
    }
  });

  test("the header name comes from the brand seam only", async () => {
    const board = createBoardHarness({ repositories: [allFourRepository()] });
    try {
      const run = await board.run([], { json: true });
      const data = run.envelope?.data as BoardData;
      const first = renderBoardHuman(data, SYNTHETIC_BRAND);
      const second = renderBoardHuman(data, {
        ...SYNTHETIC_BRAND,
        binaryName: "other-binary",
      });
      expect(first.split("\n")[0]?.startsWith(SYNTHETIC_BRAND.binaryName)).toBe(true);
      expect(second.split("\n")[0]?.startsWith("other-binary")).toBe(true);
      expect(first).not.toContain("other-binary");
    } finally {
      board.cleanup();
    }
  });
});
