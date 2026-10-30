/**
 * TC-STATE-022 (tier half) — the state tier imports `./contracts` and its own
 * modules only, and runtime APIs appear only inside the state driver edge
 * (GH-174 D1/D8). The detector has synthetic negative and clean controls.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const STATE_ROOT = "packages/core/src/state";
const DRIVER_PREFIX = `${STATE_ROOT}/driver/`;

const isDynamicImport = (node: ts.CallExpression): boolean =>
  node.expression.kind === ts.SyntaxKind.ImportKeyword;

const isRequire = (node: ts.CallExpression): boolean =>
  ts.isIdentifier(node.expression) && node.expression.text === "require";

/**
 * Every static and dynamic module reference: `import`, `export ... from`, and
 * `import()`/`require()` calls. A re-export is an import channel, so a detector
 * that only reads import declarations would miss `export * from "#config"`.
 */
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
    } else if (ts.isCallExpression(node) && (isDynamicImport(node) || isRequire(node))) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) {
        specifiers.push(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return specifiers;
};

export const forbiddenStateImports = (source: string, relative: string): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source, relative)) {
    const own = specifier.startsWith("./") || specifier.startsWith("../");
    const isRuntime = specifier.startsWith("node:") || specifier.startsWith("bun:");
    if (specifier === "#contracts" || own) continue;
    if (isRuntime && relative.startsWith(DRIVER_PREFIX)) continue;
    violations.push(`${relative}: ${specifier}`);
  }
  return violations;
};

const stateFiles = (): string[] => {
  const results: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(join(ROOT, current), { withFileTypes: true })) {
      const next = `${current}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk(STATE_ROOT);
  return results.sort();
};

describe("TC-STATE-022 state-tier imports and runtime confinement", () => {
  test("the real state tier has no forbidden import", () => {
    const violations: string[] = [];
    for (const file of stateFiles()) {
      violations.push(...forbiddenStateImports(readFileSync(join(ROOT, file), "utf8"), file));
    }
    expect(violations).toEqual([]);
  });

  test("the detector flags branding, config, adapters, and runtime APIs outside the edge", () => {
    expect(
      forbiddenStateImports(
        [
          'import "#branding/index";',
          'import "#config/resolver";',
          'import "@delivery-os/adapters/file";',
          'import fs from "node:fs";',
        ].join("\n"),
        `${STATE_ROOT}/index.ts`,
      ),
    ).toEqual([
      `${STATE_ROOT}/index.ts: #branding/index`,
      `${STATE_ROOT}/index.ts: #config/resolver`,
      `${STATE_ROOT}/index.ts: @delivery-os/adapters/file`,
      `${STATE_ROOT}/index.ts: node:fs`,
    ]);

    // Re-exports and dynamic channels are imports too: a detector that only
    // reads import declarations would pass a `export * from "#config"` leak.
    expect(
      forbiddenStateImports(
        [
          'export * from "#config/resolver";',
          'export { branding } from "@delivery-os/core/branding";',
          'import("node:fs").then((fs) => fs);',
          'require("node:path");',
        ].join("\n"),
        `${STATE_ROOT}/ledger.ts`,
      ),
    ).toEqual([
      `${STATE_ROOT}/ledger.ts: #config/resolver`,
      `${STATE_ROOT}/ledger.ts: @delivery-os/core/branding`,
      `${STATE_ROOT}/ledger.ts: node:fs`,
      `${STATE_ROOT}/ledger.ts: node:path`,
    ]);

    expect(
      forbiddenStateImports('import fs from "node:fs";\n', `${STATE_ROOT}/driver/runtime-edge.ts`),
    ).toEqual([]);
    expect(
      forbiddenStateImports('import { x } from "#contracts";\n', `${STATE_ROOT}/ledger.ts`),
    ).toEqual([]);
    expect(
      forbiddenStateImports('export * from "./ledger.js";\n', `${STATE_ROOT}/index.ts`),
    ).toEqual([]);
  });

  test("the boundary fixtures cover the tightened runtime allowance", () => {
    const registry = JSON.parse(
      readFileSync(join(ROOT, "tests/boundaries/fixture-registry.json"), "utf8"),
    ) as Record<string, Array<{ id: string; path: string }>>;
    const cases = registry["runtime-apis-confinement"] ?? [];
    expect(cases.some((entry) => entry.path === "packages/core/src/state/probe.ts")).toBe(true);
    const driverControl = readFileSync(join(ROOT, "tests/boundaries/fixtures/cases.ts"), "utf8");
    expect(driverControl).toContain("packages/core/src/state/driver/probe.ts");
  });
});
