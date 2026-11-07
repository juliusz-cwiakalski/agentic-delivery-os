/**
 * TC-VGATES-002 / TC-VGATES-062 — contracts are data-only, the domain is pure,
 * and the gate ordering comes from contract arrays.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/verify-gates.ts";
const DOMAIN = "packages/core/src/domain/verify-gates.ts";

const parse = (file: string): ts.SourceFile =>
  ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const specifiers = (source: ts.SourceFile): string[] => {
  const result: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      result.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
};

const calls = (source: ts.SourceFile): string[] => {
  const result: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) result.push(node.expression.text);
      if (ts.isPropertyAccessExpression(node.expression)) {
        result.push(`${node.expression.expression.getText(source)}.${node.expression.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return result;
};

const contractStatements = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

describe("TC-VGATES-002 contracts data-only and domain purity", () => {
  test("contracts contain data/type declarations and no runtime imports", () => {
    const source = parse(CONTRACT);
    for (const statement of source.statements) {
      expect(contractStatements.has(statement.kind), ts.SyntaxKind[statement.kind]).toBe(true);
    }
    for (const specifier of specifiers(source)) {
      expect(specifier.startsWith("node:") || specifier.startsWith("bun:")).toBe(false);
    }
  });

  test("the domain imports only contracts and the verify-change domain module", () => {
    const source = parse(DOMAIN);
    for (const specifier of specifiers(source)) {
      expect(["#contracts", "./verify-change.js", "./merge-probe.js"]).toContain(specifier);
    }
  });

  test("the domain has no ambient, clock, randomness, network, file, or spawn access", () => {
    const source = parse(DOMAIN);
    const banned = [
      "process",
      "Bun",
      "Date.now",
      "Math.random",
      "crypto",
      "fetch",
      "setTimeout",
      "node:fs",
      "node:child_process",
    ];
    for (const call of calls(source)) {
      expect(banned).not.toContain(call);
    }
    const text = readFileSync(join(ROOT, DOMAIN), "utf8");
    for (const token of banned) expect(text).not.toContain(token);
  });

  test("contract-array ordering drives the gate report and the wrapper is not a gate dependency", () => {
    const source = readFileSync(join(ROOT, DOMAIN), "utf8");
    expect(source).toContain("VERIFY_GATES_GATE_ORDER.map");
    expect(source).not.toContain("classifyVerifyChange(");
    expect(source).not.toContain("formatVerifySummary(");
  });

  test("negative control: a temp snippet with ambient reads is detected", () => {
    const violations = (text: string): string[] =>
      ["process.env", "Date.now", "Math.random"].filter((token) => text.includes(token));
    expect(
      violations(
        "export const x = process.env.X; export const y = Date.now(); export const z = Math.random();",
      ),
    ).toHaveLength(3);
    expect(violations(readFileSync(join(ROOT, DOMAIN), "utf8"))).toEqual([]);
  });
});
