/**
 * TC-COORD-003 (production half) — the shipped composition registers the
 * coordinator family, so a real invocation reaches the handler (F-01).
 */
import { describe, expect, test } from "bun:test";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { createProductionComposer } from "../../packages/cli/src/production";
import { makeTempRoot, removeRoot } from "../fixtures/state/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

describe("coordinator production composition", () => {
  test("the shipped composer registers coordinator and it is prompt-required", () => {
    const root = makeTempRoot("gh241-production-coordinator");
    try {
      const composer = createProductionComposer({
        environment: { HOME: root },
        cwd: process.cwd(),
        homeDirectory: root,
        workingName: SYNTHETIC_BRAND.binaryName,
      });
      const program = composer(SYNTHETIC_BRAND);
      expect(program.commands.coordinator).toBeDefined();
      expect(PROMPT_REQUIRED_COMMANDS).toContain("coordinator");
      expect(program.commands.coordinator?.flags).toEqual([
        "--foreground",
        "--fresh-budget",
        "--live",
      ]);
    } finally {
      removeRoot(root);
    }
  });
});
