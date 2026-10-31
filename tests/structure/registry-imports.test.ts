/**
 * TC-BOUND-001 (state-tier half) — the delivery registry imports only the
 * contracts vocabulary and its own state modules, and runtime APIs stay inside
 * the state driver edge. Negative and clean controls keep the detector live.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const STATE_ROOT = "packages/core/src/state";
const REGISTRY = `${STATE_ROOT}/registry.ts`;
const DRIVER = `${STATE_ROOT}/driver/runtime-edge.ts`;

const specifiersOf = (source: string, name: string): string[] => {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
};

/**
 * Local copy of the state-tier import detector. The state-imports suite exports
 * its own copy; importing a `*.test.ts` module would register it twice, so this
 * suite keeps the detector independent and adds registry-specific controls.
 */
const forbiddenStateImports = (source: string, relative: string): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source, relative)) {
    const own = specifier.startsWith("./") || specifier.startsWith("../");
    const isRuntime = specifier.startsWith("node:") || specifier.startsWith("bun:");
    if (specifier === "#contracts" || own) continue;
    if (isRuntime && relative.startsWith(`${STATE_ROOT}/driver/`)) continue;
    violations.push(`${relative}: ${specifier}`);
  }
  return violations;
};

const stateFiles = (): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk(STATE_ROOT);
  return results.sort();
};

describe("TC-BOUND-001 registry tier and runtime confinement", () => {
  test("the registry imports only #contracts and state-relative modules", () => {
    const source = readFileSync(join(ROOT, REGISTRY), "utf8");
    expect(forbiddenStateImports(source, REGISTRY)).toEqual([]);
    for (const specifier of specifiersOf(source, REGISTRY)) {
      const allowed =
        specifier === "#contracts" || specifier.startsWith("./") || specifier.startsWith("../");
      expect(allowed).toBe(true);
    }
  });

  test("runtime APIs appear only in the state driver edge", () => {
    const runtimeImports = stateFiles().flatMap((file) =>
      specifiersOf(readFileSync(join(ROOT, file), "utf8"), file)
        .filter((specifier) => specifier.startsWith("node:") || specifier.startsWith("bun:"))
        .map((specifier) => `${file}: ${specifier}`),
    );
    expect(runtimeImports.every((entry) => entry.startsWith(`${DRIVER}:`))).toBe(true);
  });

  test("the detector flags forbidden imports in the registry path (negative control)", () => {
    const source = [
      'import "#branding/index";',
      'import "@delivery-os/adapters/file";',
      'import fs from "node:fs";',
      'export * from "#config/resolver";',
    ].join("\n");
    expect(forbiddenStateImports(source, REGISTRY)).toEqual([
      `${REGISTRY}: #branding/index`,
      `${REGISTRY}: @delivery-os/adapters/file`,
      `${REGISTRY}: node:fs`,
      `${REGISTRY}: #config/resolver`,
    ]);
  });

  test("the driver edge keeps its runtime allowance and a clean registry import passes", () => {
    expect(forbiddenStateImports('import fs from "node:fs";\n', DRIVER)).toEqual([]);
    expect(forbiddenStateImports('export * from "./ledger.js";\n', REGISTRY)).toEqual([]);
    expect(specifiersOf('import { x } from "#contracts";\n', REGISTRY)).toEqual(["#contracts"]);
  });
});
