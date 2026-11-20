/**
 * GH-348 — the loop mutation controls that must fail BY NAME.
 *
 * The 120-row register (§7.4) is a reviewer/fixer exercise; the permanent
 * non-vacuity proofs are the planted controls inside the owning cases. This
 * module holds the phase-1 control (M93, an ambient timer planted in a
 * temp-copied `loop-backoff.ts`) and grows one row group per delivery phase.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

/** The five declared pure domain modules; M93 mutates one of them. */
export const LOOP_DOMAIN_MODULES = [
  "packages/core/src/domain/loop-verdict.ts",
  "packages/core/src/domain/loop-backoff.ts",
  "packages/core/src/domain/loop-log.ts",
  "packages/core/src/domain/loop-status.ts",
  "packages/core/src/domain/loop-prompt.ts",
] as const;

const AMBIENT_CALLS = [
  "Date.now",
  "performance.now",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "queueMicrotask",
  "Math.random",
] as const;

const AMBIENT_MEMBERS = ["process.env", "process.cwd", "readFileSync", "writeFileSync"] as const;

const FORBIDDEN_IMPORT_PREFIXES = [
  "node:",
  "bun:",
  "#state",
  "#app",
  "#config",
  "#branding",
  "@delivery-os/adapters",
  "@delivery-os/cli",
] as const;

/** The ambient-fact rules one module violates, named so a mutant fails by name. */
export const ambientViolations = (file: string, text: string): readonly string[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const rules: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (
        FORBIDDEN_IMPORT_PREFIXES.some((prefix) => specifier.startsWith(prefix)) ||
        (specifier.startsWith(".") && !specifier.startsWith("./"))
      ) {
        rules.push(`import ${specifier}`);
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      for (const ambient of AMBIENT_CALLS) {
        if (callee === ambient) rules.push(`ambient ${ambient}`);
      }
      for (const member of AMBIENT_MEMBERS) {
        if (callee === member) rules.push(`ambient ${member}`);
      }
    }
    if (
      ts.isNewExpression(node) &&
      node.expression.getText(source) === "Date" &&
      (node.arguments === undefined || node.arguments.length === 0)
    ) {
      rules.push("ambient new Date()");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return rules;
};

/** Plant one fragment beside a real module in a temp tree and scan the copy. */
const planted = (relative: string, fragment: string): readonly string[] => {
  const base = join(ROOT, "tmp", "tmpdir");
  mkdirSync(base, { recursive: true });
  const root = mkdtempSync(join(base, "gh348-loop-mutant-"));
  try {
    const path = join(root, relative);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, `${readFileSync(join(ROOT, relative), "utf8")}\n${fragment}\n`);
    return ambientViolations(relative, readFileSync(path, "utf8"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe("M93 the ambient-timer control fails by name", () => {
  test("an ambient timer planted in loop-backoff.ts is reported by rule name", () => {
    const rules = planted(
      "packages/core/src/domain/loop-backoff.ts",
      "export const plantedTick = () => setInterval(() => undefined, 10);",
    );
    expect(rules).toContain("ambient setInterval");
  });

  test("an ambient clock read planted in loop-verdict.ts is reported by rule name", () => {
    const rules = planted(
      "packages/core/src/domain/loop-verdict.ts",
      "export const plantedNow = () => Date.now();",
    );
    expect(rules).toContain("ambient Date.now");
  });

  test("the unplanted modules stay clean, so the control is not vacuous", () => {
    for (const relative of LOOP_DOMAIN_MODULES) {
      expect(ambientViolations(relative, readFileSync(join(ROOT, relative), "utf8"))).toEqual([]);
    }
  });
});
