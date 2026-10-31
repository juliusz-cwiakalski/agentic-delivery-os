/**
 * TC-POLICY-005 (shared-module half) / TC-POLICY-006 (definitions) — the one
 * committed generic rule set is pure, dependency-free, and defined exactly once;
 * the file check and the emitter policy both consume it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import {
  PRIVACY_CAPS,
  PRIVACY_RULE_IDS,
  PRIVACY_RULES,
  PRIVACY_SUPPRESSION_CLASSES,
} from "../../packages/adapters/src/io/privacy-rules.js";

const ROOT = process.cwd();
const MODULE_PATH = "packages/adapters/src/io/privacy-rules.ts";
const REGISTRY_PATH = "scripts/checks/privacy-literals.registry.json";
const BANNED_GLOBALS = new Set([
  "process",
  "Bun",
  "Deno",
  "fetch",
  "performance",
  "crypto",
  "setTimeout",
  "setInterval",
  "require",
]);

const listTypeScriptFiles = (relativeDir: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) {
        results.push(next);
      }
    }
  };
  walk(relativeDir);
  return results.sort();
};

const isSkippedIdentifier = (node: ts.Identifier): boolean => {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) || ts.isImportClause(parent)) return true;
  if (ts.isQualifiedName(parent) && parent.right === node) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;
  return false;
};

/** Return every purity violation in a module source (no imports, no ambient). */
export const purityViolations = (fileName: string, text: string): string[] => {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      violations.push(`${fileName}: module import is not permitted`);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      violations.push(`${fileName}: re-export from a module is not permitted`);
    }
    if (ts.isImportEqualsDeclaration(node)) {
      violations.push(`${fileName}: import-equals is not permitted`);
    }
    if (ts.isIdentifier(node) && !isSkippedIdentifier(node) && BANNED_GLOBALS.has(node.text)) {
      violations.push(`${fileName}: ambient global ${node.text}`);
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ((node.expression.text === "Math" && node.name.text === "random") ||
        (node.expression.text === "Date" && node.name.text === "now"))
    ) {
      violations.push(`${fileName}: clock/randomness ${node.expression.text}.${node.name.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

const exportedExecutableNames = (text: string): string[] => {
  const source = ts.createSourceFile(
    "privacy-rules.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names: string[] = [];
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) names.push(statement.name.text);
    if (ts.isClassDeclaration(statement)) names.push(statement.name?.text ?? "<class>");
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    }
  }
  return names;
};

describe("privacy rule definition set", () => {
  test("the enabled registry ids equal the seven committed ids", () => {
    const registry = JSON.parse(readFileSync(join(ROOT, REGISTRY_PATH), "utf8")) as {
      enabledRuleIds: string[];
    };
    expect(new Set(registry.enabledRuleIds)).toEqual(new Set(PRIVACY_RULE_IDS));
    expect(PRIVACY_RULE_IDS.length).toBe(7);
    expect(new Set(PRIVACY_RULE_IDS).size).toBe(7);
  });

  test("each rule id is defined exactly once in production sources", () => {
    const files = [...listTypeScriptFiles("packages"), ...listTypeScriptFiles("scripts/checks")];
    for (const id of PRIVACY_RULE_IDS) {
      const definitions = files.flatMap((file) => {
        const text = readFileSync(join(ROOT, file), "utf8");
        const count = text.split(`id: "${id}"`).length - 1;
        return count > 0 ? [{ file, count }] : [];
      });
      expect(definitions, id).toEqual([{ file: MODULE_PATH, count: 1 }]);
    }
  });

  test("every rule carries an id, recognizer class, severity, pattern, flags, and threshold", () => {
    for (const rule of PRIVACY_RULES) {
      expect(typeof rule.id).toBe("string");
      expect(rule.id.length).toBeGreaterThan(0);
      expect(typeof rule.recognizerClass).toBe("string");
      expect(rule.severity).toBe("error");
      expect(typeof rule.patternSource).toBe("string");
      expect(rule.patternSource.length).toBeGreaterThan(0);
      expect(rule.flags.length).toBeGreaterThan(0);
      expect(rule.minimumMatchLength).toBeGreaterThan(0);
      expect(() => new RegExp(rule.patternSource, rule.flags)).not.toThrow();
    }
  });

  test("suppression classes are committed data, not path inference", () => {
    expect(PRIVACY_SUPPRESSION_CLASSES.length).toBeGreaterThan(0);
    for (const suppressionClass of PRIVACY_SUPPRESSION_CLASSES) {
      expect(suppressionClass.id.length).toBeGreaterThan(0);
      expect(suppressionClass.markers.length).toBeGreaterThan(0);
    }
    expect(PRIVACY_CAPS.minLength).toBe(4);
    expect(PRIVACY_CAPS.maxLength).toBe(512);
    expect(PRIVACY_CAPS.digestHexLength).toBe(64);
  });
});

describe("shared rule module purity", () => {
  test("the live module has zero imports and zero ambient references", () => {
    const text = readFileSync(join(ROOT, MODULE_PATH), "utf8");
    expect(purityViolations(MODULE_PATH, text)).toEqual([]);
  });

  test("the module exports only data and pure functions", () => {
    const text = readFileSync(join(ROOT, MODULE_PATH), "utf8");
    const source = ts.createSourceFile(
      MODULE_PATH,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    for (const statement of source.statements) {
      const allowed =
        ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isFunctionDeclaration(statement) ||
        ts.isVariableStatement(statement) ||
        ts.isExportDeclaration(statement) ||
        statement.kind === ts.SyntaxKind.EndOfFileToken;
      expect(allowed, ts.SyntaxKind[statement.kind]).toBe(true);
    }
    expect(exportedExecutableNames(text).length).toBeGreaterThan(0);
  });

  test("a seeded node:fs import in a temp copy fails the purity assertion", () => {
    const text = readFileSync(join(ROOT, MODULE_PATH), "utf8");
    const root = mkdtempSync(join(tmpdir(), "privacy-purity-"));
    try {
      const path = join(root, "privacy-rules.ts");
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `import "node:fs";\n${text}`);
      const violations = purityViolations("privacy-rules.ts", readFileSync(path, "utf8"));
      expect(violations.some((message) => message.includes("module import"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
