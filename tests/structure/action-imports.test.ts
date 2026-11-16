/**
 * TC-ACTION-027 (static half), TC-ACTION-032 (static half), TC-ACTION-036 —
 * tier, boundary, runtime confinement, inventory, and branding conformance for
 * the files this change introduces or extends.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

/** Every production file this change introduces or edits. */
const CHANGE_FILES = [
  "packages/core/src/contracts/action.ts",
  "packages/core/src/state/action-registry.ts",
  "packages/core/src/domain/action-filing.ts",
  "packages/core/src/domain/action-window.ts",
  "packages/core/src/domain/action-aging.ts",
  "packages/core/src/domain/action-closure.ts",
  "packages/cli/src/commands/retro.ts",
  "packages/cli/src/edge.ts",
] as const;

/** Files that must not import a runtime module. */
const NEUTRAL_FILES = [
  "packages/core/src/contracts/action.ts",
  "packages/core/src/state/action-registry.ts",
  "packages/core/src/domain/action-filing.ts",
  "packages/core/src/domain/action-window.ts",
  "packages/core/src/domain/action-aging.ts",
  "packages/core/src/domain/action-closure.ts",
  "packages/cli/src/commands/retro.ts",
] as const;

const textOf = (relative: string): string => {
  try {
    return readFileSync(join(ROOT, relative), "utf8");
  } catch {
    return "";
  }
};

const specifiersOf = (relative: string): string[] => {
  const source = ts.createSourceFile(
    relative,
    textOf(relative),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
};

describe("TC-ACTION-027 action files stay in their declared tiers", () => {
  test("neutral files import no runtime module and no sibling package", () => {
    for (const file of NEUTRAL_FILES) {
      for (const specifier of specifiersOf(file)) {
        expect(specifier.startsWith("node:"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("bun:"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/adapters"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/cli"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/mcp"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/opencode"), `${file}: ${specifier}`).toBe(false);
      }
    }
  });

  test("state and domain files never import the public core entry or the CLI tier", () => {
    for (const file of [
      "packages/core/src/state/action-registry.ts",
      "packages/core/src/domain/action-filing.ts",
      "packages/core/src/domain/action-window.ts",
      "packages/core/src/domain/action-aging.ts",
      "packages/core/src/domain/action-closure.ts",
    ]) {
      const text = textOf(file);
      if (text === "") continue;
      expect(text, file).not.toContain('from "@delivery-os/core"');
      expect(text, file).not.toContain('from "@delivery-os/core/index');
      expect(text, file).not.toContain("packages/cli");
    }
  });

  test("no ambient clock, randomness, environment, or network read exists on the new paths", () => {
    for (const file of NEUTRAL_FILES) {
      const text = textOf(file);
      for (const marker of ["Date.now", "Math.random", "process.env", "Bun.env", "fetch("]) {
        expect(text.includes(marker), `${file}: ${marker}`).toBe(false);
      }
    }
  });
});

describe("TC-ACTION-032 static hermetic posture", () => {
  test("no new suite declares a skip, socket, spawn, or live-tree read", () => {
    const suites = [
      "tests/behaviour/action-filing.test.ts",
      "tests/behaviour/action-aging.test.ts",
      "tests/behaviour/action-closure.test.ts",
      "tests/behaviour/action-wip-limit.test.ts",
      "tests/behaviour/action-store-boundary.test.ts",
      "tests/behaviour/action-follow-through.test.ts",
      "tests/behaviour/action-ceremony-handoff.test.ts",
      "tests/behaviour/action-cross-level.test.ts",
      "tests/behaviour/action-determinism.test.ts",
      "tests/behaviour/action-bounds.test.ts",
      "tests/behaviour/action-write-discipline.test.ts",
      "tests/behaviour/action-read-cost.test.ts",
      "tests/behaviour/action-performance.test.ts",
      "tests/behaviour/action-privacy.test.ts",
      "tests/behaviour/action-disclosure.test.ts",
      "tests/behaviour/action-audit.test.ts",
      "tests/checks/action-hermetic.test.ts",
      "tests/checks/action-mutants.test.ts",
    ];
    for (const suite of suites) {
      const text = textOf(suite);
      if (text === "") continue;
      for (const marker of [
        "test.skip(",
        "describe.skip(",
        "test.todo(",
        "Bun.spawn(",
        "spawnSync(",
        "net.connect(",
        "$HOME",
      ]) {
        expect(text.includes(marker), `${suite}: ${marker}`).toBe(false);
      }
    }
  });
});

describe("TC-ACTION-036 additive command surface and inventory", () => {
  test("the CLI keeps one command family and adds no prompt-required command", () => {
    const promptRequired = readFileSync(
      join(ROOT, "packages/cli/src/help/prompt-required-commands.ts"),
      "utf8",
    );
    expect(promptRequired).not.toContain("retro-action");
    expect(promptRequired).not.toContain("actions");
  });

  test("the content inventory lists every new source file", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/contracts/action.ts");
  });

  test("no hardcoded product or binary name exists in the new source", () => {
    const tokens = ["a" + "dos", "A" + "DOS_", "~/" + "." + "ad" + "os"];
    for (const file of CHANGE_FILES) {
      const text = textOf(file);
      for (const token of tokens) expect(text.includes(token), `${file}: ${token}`).toBe(false);
    }
  });
});
