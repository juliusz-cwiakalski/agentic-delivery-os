/**
 * TC-BOARD-040 and TC-BOARD-043 — `board` is the twenty-first prompt-required
 * family (ceremony the twenty-second), composed by production, listed in root
 * help, and the mount changes no other family (AC-F7-1, F-7, DEC-10, RSK-5).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectPromptRequiredProgram } from "../../packages/cli/src/entrypoint";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { createProductionComposer } from "../../packages/cli/src/production";

const DELIVERED = [
  "status",
  "brief",
  "queue",
  "lanes",
  "blockers",
  "phase",
  "commit",
  "lint",
  "plan",
  "verify",
  "merge",
  "closeout",
  "spend",
  "retro",
  "dispatch",
  "coordinator",
  "daemon",
  "projects",
  "repos",
  "events",
] as const;

const composeProduction = () => {
  const root = mkdtempSync(join(tmpdir(), "board-mount-"));
  const composer = createProductionComposer({
    environment: { HOME: root, PATH: "/usr/bin" },
    cwd: root,
    homeDirectory: root,
    workingName: "example-product",
  });
  return {
    program: composer({
      productName: "example-product",
      binaryName: "example-product",
      packageScope: "@example-scope",
      environmentPrefix: "EXAMPLE_PRODUCT_",
      configDirectoryName: ".example-product",
      stateDirectoryName: ".example-product-state",
      mcpToolPrefix: "example-product_",
      telemetryNamespace: "delivery",
      docsBaseUrl: "https://example-scope.github.io/example-product/",
      repositoryUrl: "https://github.com/example-scope/example-product",
      releaseAssetPrefix: "example-product-",
      installPath: "~/.example-product/bin/example-product",
    }),
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

describe("TC-BOARD-040/043 mounting", () => {
  test("board is the twenty-first member, ceremony the twenty-second, and the delivered twenty keep their order", () => {
    expect([...PROMPT_REQUIRED_COMMANDS]).toHaveLength(22);
    expect([...PROMPT_REQUIRED_COMMANDS].slice(0, 20)).toEqual([...DELIVERED]);
    expect(PROMPT_REQUIRED_COMMANDS[20]).toBe("board");
    expect(PROMPT_REQUIRED_COMMANDS[21]).toBe("ceremony");
  });

  test("production composes board and the prompt-required selection keeps it", () => {
    const { program, dispose } = composeProduction();
    try {
      expect(program.commands.board).toBeDefined();
      const selected = selectPromptRequiredProgram(program);
      expect(Object.keys(selected.commands)).toHaveLength(22);
      expect(selected.commands.board).toBeDefined();
      for (const name of DELIVERED) expect(selected.commands[name]).toBeDefined();
    } finally {
      dispose();
    }
  });

  test("the unmounted mutant is detected by name", () => {
    const { program, dispose } = composeProduction();
    try {
      const withoutBoard: Record<string, unknown> = { ...program.commands };
      delete withoutBoard.board;
      expect(() => selectPromptRequiredProgram({ commands: withoutBoard as never })).toThrow(
        /prompt-required command "board" is not composed/u,
      );
    } finally {
      dispose();
    }
  });
});
