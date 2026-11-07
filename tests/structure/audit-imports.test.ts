/**
 * TC-GH223-032 (structure half) and TC-GH223-034 (imports half) — the audit
 * consumer composes the public state port and its own modules only; contracts
 * stay runtime-neutral; the state tier stays branding-free; no second
 * serialization path exists.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const AUDIT_CONSUMER = "packages/core/src/state/audit.ts";
const AUDIT_CONTRACTS = "packages/core/src/contracts/audit.ts";

const parse = (relative: string): ts.SourceFile =>
  ts.createSourceFile(
    relative,
    readFileSync(join(ROOT, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const specifiers = (relative: string): string[] => {
  const source = parse(relative);
  const values: string[] = [];
  for (const statement of source.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      values.push(statement.moduleSpecifier.text);
    }
  }
  return values;
};

const importedNames = (relative: string): string[] => {
  const source = parse(relative);
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportSpecifier(node)) names.push(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

const sourceText = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-GH223-034 audit consumer imports and tier boundaries", () => {
  test("the audit consumer imports only #contracts and its own modules", () => {
    const found = specifiers(AUDIT_CONSUMER);
    expect(found.sort()).toEqual(["#contracts", "./artifact-boundary.js"]);
    expect(found.some((specifier) => specifier.startsWith("node:"))).toBe(false);
    expect(found.some((specifier) => specifier.startsWith("bun:"))).toBe(false);
    expect(found.some((specifier) => specifier.includes("branding"))).toBe(false);
  });

  test("the audit contracts module is runtime-neutral", () => {
    const found = specifiers(AUDIT_CONTRACTS);
    expect(found.sort()).toEqual(["./result.js", "./state.js"]);
    const text = sourceText(AUDIT_CONTRACTS);
    expect(text).not.toContain("Date.now");
    expect(text).not.toContain("Math.random");
    expect(text).not.toContain("process.env");
    expect(text).not.toContain("Bun.env");
    expect(found.some((specifier) => specifier.startsWith("node:"))).toBe(false);
  });

  test("the runtime API confinement holds for the state tier's audit module", () => {
    const text = sourceText(AUDIT_CONSUMER);
    for (const marker of ["node:fs", "node:crypto", "node:path", "process.env", "Bun.env"]) {
      expect(text, marker).not.toContain(marker);
    }
    expect(text).not.toContain("Math.random");
    expect(text).not.toContain("Date.now");
  });

  test("no driver module or driver discriminant leaks into the consumer", () => {
    const text = sourceText(AUDIT_CONSUMER);
    expect(text).not.toContain("driver/");
    expect(text).not.toContain("StateDriverKind");
    expect(text).not.toContain("sqlite");
  });

  test("the audit identity is not wired into credentials, config, or policy", () => {
    for (const file of [
      "packages/core/src/contracts/credentials.ts",
      "packages/core/src/contracts/config.ts",
      "packages/core/src/config/index.ts",
    ]) {
      const text = sourceText(file);
      expect(text, file).not.toContain("agentIdentity");
      expect(text, file).not.toContain("AuditAgentIdentity");
    }
  });

  test("no chaining-key type is exported through the contracts surface", () => {
    const contracts = sourceText("packages/core/src/contracts/audit.ts");
    expect(contracts).not.toContain("ChainingKey");
    expect(contracts).not.toContain("chainKey:");
  });
});

describe("TC-GH223-032 no secondary serialization path", () => {
  test("the audit consumer imports no CLI serializer and writes no stream", () => {
    const text = sourceText(AUDIT_CONSUMER);
    expect(text).not.toContain("@delivery-os/cli");
    expect(text).not.toContain("output/serialize");
    expect(text).not.toMatch(/\.write\(/);
    expect(text).not.toContain("stdout");
    expect(text).not.toContain("stderr");
  });

  test("the sealed surface files have no raw audit serializer", () => {
    const found = importedNames(AUDIT_CONSUMER);
    expect(found).not.toContain("serializeEnvelope");
    expect(found).not.toContain("redact");
  });
});
