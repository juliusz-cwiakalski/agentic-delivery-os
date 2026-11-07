/**
 * TC-GH223-029 (no unbounded dump path) and TC-GH223-034 (library-only, no CLI
 * audit command) — the read surface requires a bound and registers no command.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const AUDIT_CONTRACT = "packages/core/src/contracts/audit.ts";
const AUDIT_CONSUMER = "packages/core/src/state/audit.ts";

const parse = (root: string, relative: string): ts.SourceFile =>
  ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const exportedNames = (root: string, relative: string): string[] => {
  const source = parse(root, relative);
  const names: string[] = [];
  for (const statement of source.statements) {
    const exported = (statement.modifiers ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    }
    if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name
    ) {
      names.push(statement.name.text);
    }
  }
  return names.sort();
};

type FieldShape = { readonly name: string; readonly optional: boolean };

const queryFields = (root: string): FieldShape[] => {
  const source = parse(root, AUDIT_CONTRACT);
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== "AuditReadQuery") {
      continue;
    }
    if (!ts.isTypeLiteralNode(statement.type)) return [];
    return statement.type.members.filter(ts.isPropertySignature).map((member) => ({
      name: ts.isIdentifier(member.name) ? member.name.text : member.name.getText(source),
      optional: member.questionToken !== undefined,
    }));
  }
  return [];
};

const forbiddenDumpExports = (root: string): string[] =>
  exportedNames(root, AUDIT_CONSUMER).filter((name) =>
    ["readAll", "dump", "exportAll", "readEverything"].includes(name),
  );

describe("TC-GH223-029 no unbounded dump path", () => {
  test("the read query declares a required bound", () => {
    const fields = queryFields(ROOT);
    const limit = fields.find((field) => field.name === "limit");
    expect(limit).toBeDefined();
    expect(limit?.optional).toBe(false);
    expect(fields.some((field) => field.name === "limit" && field.optional)).toBe(false);
  });

  test("no unbounded dump export exists on the read surface", () => {
    expect(forbiddenDumpExports(ROOT)).toEqual([]);
    const names = exportedNames(ROOT, AUDIT_CONSUMER);
    expect(names).toContain("readAuditLedger");
    expect(names).toContain("verifyAuditChain");
    expect(names).not.toContain("readAll");
  });

  test("the detector fires on a temp copy adding an unbounded export", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-surface-"));
    mkdirSync(join(root, "packages/core/src/state"), { recursive: true });
    mkdirSync(join(root, "packages/core/src/contracts"), { recursive: true });
    const live = readFileSync(join(ROOT, AUDIT_CONSUMER), "utf8");
    writeFileSync(
      join(root, AUDIT_CONSUMER),
      `${live}\nexport const readAll = (store: unknown): unknown => store;\n`,
    );
    expect(forbiddenDumpExports(root)).toContain("readAll");
  });
});

describe("TC-GH223-034 library-only surface", () => {
  test("no CLI audit command is registered", () => {
    const commands = readdirSync(join(ROOT, "packages/cli/src/commands"));
    expect(commands.some((file) => file.includes("audit"))).toBe(false);
    const index = readFileSync(join(ROOT, "packages/cli/src/commands/index.ts"), "utf8");
    expect(index).not.toContain("audit");
  });

  test("the audit consumer exports no command definition", () => {
    const names = exportedNames(ROOT, AUDIT_CONSUMER);
    expect(names.some((name) => name.toLowerCase().includes("command"))).toBe(false);
    expect(names.some((name) => name.toLowerCase().includes("definition"))).toBe(false);
  });
});
