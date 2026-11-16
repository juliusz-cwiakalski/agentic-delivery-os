/**
 * TC-CEREMONY-050 (static half) and TC-CEREMONY-057 (static half) — every
 * ceremony contract/domain file is runtime-neutral: no `node:`/`bun:` import, no
 * package-tier import above contracts, no ambient clock/random/environment read,
 * and no new package or subpath. The live scan in Phase 10 completes the full
 * fold/render/verification/tier path set.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

const NEUTRAL_FILES = [
  "packages/core/src/contracts/ceremony.ts",
  "packages/core/src/contracts/ceremony-builtins.ts",
  "packages/core/src/domain/ceremony-declaration.ts",
  "packages/core/src/domain/ceremony-intake.ts",
  "packages/core/src/domain/ceremony-run.ts",
  "packages/core/src/domain/ceremony-resume.ts",
  "packages/core/src/domain/ceremony-schedule.ts",
  "packages/core/src/domain/ceremony-builtins.ts",
  "packages/core/src/domain/ceremony-retro.ts",
  "packages/core/src/domain/ceremony-mirror.ts",
  "packages/core/src/domain/ceremony-registry.ts",
  "packages/core/src/domain/ceremony-tier.ts",
  "packages/core/src/domain/ceremony-comparison.ts",
] as const;

const CEREMONY_FILES = [
  "packages/core/src/contracts/ceremony.ts",
  "packages/core/src/contracts/ceremony-builtins.ts",
  "packages/core/src/domain/ceremony-declaration.ts",
  "packages/core/src/domain/ceremony-intake.ts",
  "packages/core/src/domain/ceremony-run.ts",
  "packages/core/src/domain/ceremony-resume.ts",
  "packages/core/src/domain/ceremony-schedule.ts",
  "packages/core/src/domain/ceremony-builtins.ts",
  "packages/core/src/domain/ceremony-retro.ts",
  "packages/core/src/domain/ceremony-mirror.ts",
  "packages/core/src/domain/ceremony-registry.ts",
  "packages/core/src/domain/ceremony-tier.ts",
  "packages/core/src/domain/ceremony-comparison.ts",
  "packages/core/src/state/ceremony.ts",
  "packages/adapters/src/file/ceremony-artifacts.ts",
  "packages/adapters/src/file/ceremony-declarations.ts",
  "packages/cli/src/commands/ceremony.ts",
  "packages/cli/src/output/ceremony-text.ts",
] as const;

const specifiersOf = (relative: string): string[] => {
  const source = ts.createSourceFile(
    relative,
    readFileSync(join(ROOT, relative), "utf8"),
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

const textOf = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-CEREMONY-050 contracts and domain stay runtime-neutral", () => {
  test("no file imports a runtime API or a higher package tier", () => {
    for (const file of NEUTRAL_FILES) {
      for (const specifier of specifiersOf(file)) {
        expect(specifier.startsWith("node:"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("bun:"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/adapters"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/cli"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/mcp"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/opencode"), `${file}: ${specifier}`).toBe(false);
        if (
          file.startsWith("packages/core/src/contracts/") ||
          file.startsWith("packages/core/src/domain/")
        ) {
          expect(specifier.includes("../state/"), `${file}: ${specifier}`).toBe(false);
        }
      }
    }
  });

  test("no ambient clock, random, environment, network, or process token appears", () => {
    for (const file of NEUTRAL_FILES) {
      const text = textOf(file);
      for (const marker of [
        "Date.now",
        "Math.random",
        "process.",
        "Bun.",
        "Deno.",
        "fetch(",
        "setTimeout(",
        "setInterval(",
      ]) {
        expect(text.includes(marker), `${file}: ${marker}`).toBe(false);
      }
    }
  });

  test("no ceremony path names an inference client, model, or network module", () => {
    for (const file of CEREMONY_FILES) {
      const text = textOf(file).toLowerCase();
      for (const marker of [
        "openai",
        "anthropic",
        "gpt-",
        "claude-",
        "node:http",
        "node:https",
        "node:net",
        "node:child_process",
      ]) {
        expect(text.includes(marker), `${file}: ${marker}`).toBe(false);
      }
    }
  });

  test("the core package gains no new export subpath and no new dependency", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")) as {
      exports: Record<string, unknown>;
      dependencies: Record<string, string>;
    };
    expect(Object.keys(manifest.exports).sort()).toEqual([
      ".",
      "./branding",
      "./contracts",
      "./provider",
      "./state",
    ]);
    expect(Object.keys(manifest.dependencies)).toEqual(["ajv"]);
  });

  test("the committed inventory names both new source files", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/contracts/ceremony.ts");
    expect(inventory.core).toContain("src/domain/ceremony-declaration.ts");
  });
});
