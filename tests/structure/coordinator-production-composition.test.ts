/**
 * TC-COORD-003 (production half) — the shipped composition registers the
 * coordinator family, so a real invocation reaches the handler (F-01).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { createProductionComposer } from "../../packages/cli/src/production";
import { makeTempRoot, removeRoot } from "../fixtures/state/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

describe("coordinator production composition", () => {
  test("the shipped composer registers coordinator and it is prompt-required", () => {
    const root = makeTempRoot("gh241-production-coordinator");
    try {
      // Compose over a temporary checkout, never this repository: an identity
      // marker is minted inside the git common directory on first use.
      const home = join(root, "home");
      const checkout = join(root, "checkout");
      mkdirSync(join(checkout, ".git"), { recursive: true });
      mkdirSync(home, { recursive: true });
      const composer = createProductionComposer({
        environment: { HOME: home },
        cwd: checkout,
        homeDirectory: home,
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
