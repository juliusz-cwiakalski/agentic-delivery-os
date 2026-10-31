/**
 * TC-SCAFFOLD-005 — `createRuntime` is declared exactly once, in the core `.`
 * entry module, with the `{ config, adapters, store, clock }` parameter shape.
 */
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];

type Declaration = { file: string; exported: boolean; parameterNames: string[] };

const findCreateRuntimeDeclarations = (): Declaration[] => {
  const found: Declaration[] = [];
  for (const packageName of PACKAGE_NAMES) {
    const packageDir = join(ROOT, "packages", packageName);
    for (const relative of listTypeScriptFiles(packageDir)) {
      const file = join(packageDir, relative);
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      for (const statement of source.statements) {
        const name = ts.isFunctionDeclaration(statement)
          ? statement.name?.text
          : ts.isVariableStatement(statement)
            ? statement.declarationList.declarations[0]?.name.getText(source)
            : undefined;
        if (name !== "createRuntime") continue;
        const exported = (statement.modifiers ?? []).some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        );
        const parameterNames: string[] = [];
        if (ts.isFunctionDeclaration(statement) && statement.parameters[0]) {
          const typeNode = statement.parameters[0].type;
          if (typeNode && ts.isTypeLiteralNode(typeNode)) {
            for (const member of typeNode.members) {
              if (ts.isPropertySignature(member) && member.name) {
                parameterNames.push(member.name.getText(source));
              }
            }
          }
        }
        found.push({ file, exported, parameterNames });
      }
    }
  }
  return found;
};

const listTypeScriptFiles = (packageDir: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(packageDir, relative), { withFileTypes: true })) {
      const next = relative.length > 0 ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk("");
  return results.sort();
};

test("exactly one createRuntime declaration exists and it is the core `.` entry", () => {
  const declarations = findCreateRuntimeDeclarations();
  expect(declarations).toHaveLength(1);
  const [declaration] = declarations;
  expect(declaration?.file.endsWith("packages/core/src/index.ts")).toBe(true);
  expect(declaration?.exported).toBe(true);
});

test("createRuntime accepts { config, adapters, store, clock }", () => {
  const [declaration] = findCreateRuntimeDeclarations();
  expect(declaration?.parameterNames).toEqual(["config", "adapters", "store", "clock"]);
});
