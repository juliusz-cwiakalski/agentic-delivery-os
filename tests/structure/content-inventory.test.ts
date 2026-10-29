/**
 * TC-SCAFFOLD-006 — the committed source inventory equals the actual file set,
 * and every inventoried file is types-only (empty-but-enforced).
 */
import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];
const inventory = JSON.parse(
  readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
) as Record<string, string[]>;

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

test("actual source file set equals the committed inventory", () => {
  const failures: string[] = [];
  for (const packageName of PACKAGE_NAMES) {
    const actual = listTypeScriptFiles(join(ROOT, "packages", packageName));
    const expected = [...(inventory[packageName] ?? [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(
        `${packageName}: inventory ${JSON.stringify(expected)} != actual ${JSON.stringify(actual)}`,
      );
    }
  }
  expect(failures).toEqual([]);
});

test("inventoried files contain only type declarations, re-exports, and the createRuntime signature", () => {
  const allowed = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.TypeAliasDeclaration,
    ts.SyntaxKind.InterfaceDeclaration,
    ts.SyntaxKind.ImportDeclaration,
    ts.SyntaxKind.ExportDeclaration,
    ts.SyntaxKind.EndOfFileToken,
  ]);
  const violations: string[] = [];
  for (const packageName of PACKAGE_NAMES) {
    for (const relative of inventory[packageName] ?? []) {
      const file = join(ROOT, "packages", packageName, relative);
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      for (const statement of source.statements) {
        if (ts.isFunctionDeclaration(statement)) {
          const named = statement.name?.text === "createRuntime";
          const exported = (statement.modifiers ?? []).some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
          );
          if (!named || !exported || statement.body) {
            violations.push(
              `${packageName}/${relative}: ${named ? "createRuntime must be an exported declaration without a body" : `unexpected executable function ${statement.name?.text ?? "<anonymous>"}`}`,
            );
          }
          continue;
        }
        if (!allowed.has(statement.kind)) {
          violations.push(
            `${packageName}/${relative}: executable statement ${ts.SyntaxKind[statement.kind]} is not permitted at scaffold`,
          );
        }
      }
    }
  }
  expect(violations).toEqual([]);
});

test("no engine, driver, or command-registration markers exist", () => {
  const dependencyFields = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];
  const forbiddenDependency = /sqlite|confluence|@opencode-ai\/|cliffy|^commander$|^yargs$/i;
  const forbiddenSource = [
    "node:sqlite",
    "better-sqlite3",
    ".mcpb",
    "registerCommand",
    "program.command(",
  ];
  const violations: string[] = [];

  for (const packageName of PACKAGE_NAMES) {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "packages", packageName, "package.json"), "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    for (const field of dependencyFields) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (forbiddenDependency.test(dependency)) {
          violations.push(
            `${packageName}: forbidden scaffold dependency ${dependency} in ${field}`,
          );
        }
      }
    }
    for (const relative of inventory[packageName] ?? []) {
      const content = readFileSync(join(ROOT, "packages", packageName, relative), "utf8");
      for (const marker of forbiddenSource) {
        if (content.includes(marker)) {
          violations.push(`${packageName}/${relative}: forbidden marker ${marker}`);
        }
      }
    }
  }
  expect(violations).toEqual([]);
});
