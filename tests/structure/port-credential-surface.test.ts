/**
 * TC-PORT-007 — the credential port exposes no implementation mode and no
 * environment-specific typing, and the sidecar path is documented as the
 * second-implementation constraint.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const PORT_CONTRACT = "packages/core/src/contracts/credentials.ts";
const IMPLEMENTATION = "packages/adapters/src/credentials/index.ts";
const FORBIDDEN = ["mode", "implementation", "mediated", "direct"];

/** Surface violations: implementation-mode discriminants and runtime typing. */
export const surfaceViolations = (text: string): string[] => {
  const source = ts.createSourceFile(
    PORT_CONTRACT,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const failures: string[] = [];
  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && FORBIDDEN.includes(node.text)) {
      failures.push(`${PORT_CONTRACT}:${lineOf(node)} forbidden discriminant ${node.text}`);
    }
    if (ts.isStringLiteral(node) && FORBIDDEN.includes(node.text)) {
      failures.push(`${PORT_CONTRACT}:${lineOf(node)} forbidden discriminant value ${node.text}`);
    }
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier) && /^(node:|bun:)/.test(specifier.text)) {
        failures.push(`${PORT_CONTRACT}:${lineOf(node)} runtime import ${specifier.text}`);
      }
    }
    if (ts.isIdentifier(node) && (node.text === "process" || node.text === "Bun")) {
      failures.push(`${PORT_CONTRACT}:${lineOf(node)} ambient global ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return failures;
};

describe("TC-PORT-007 no implementation mode", () => {
  test("the port contract has no mode discriminant and no runtime typing", () => {
    expect(surfaceViolations(readFileSync(join(ROOT, PORT_CONTRACT), "utf8"))).toEqual([]);
  });

  test("the environment-backed implementation lives outside the contracts tier", () => {
    expect(existsSync(join(ROOT, IMPLEMENTATION))).toBe(true);
    expect(IMPLEMENTATION.startsWith("packages/adapters/")).toBe(true);
  });

  test("the sidecar adoption path is documented as a second implementation", () => {
    const text = readFileSync(join(ROOT, PORT_CONTRACT), "utf8");
    expect(text).toContain("sidecar");
    expect(text).toContain("second implementation");
    expect(text).toContain("interface does not change");
  });

  test("injecting a mode discriminant is detectable", () => {
    const injected = readFileSync(join(ROOT, PORT_CONTRACT), "utf8").replace(
      "export type CredentialPort = {\n  readonly resolve:",
      'export type CredentialPort = {\n  readonly mode: "direct" | "mediated";\n  readonly implementation: string;\n  readonly resolve:',
    );
    const failures = surfaceViolations(injected);
    expect(failures.some((message) => message.includes("mode"))).toBe(true);
    expect(failures.some((message) => message.includes("implementation"))).toBe(true);
  });
});
