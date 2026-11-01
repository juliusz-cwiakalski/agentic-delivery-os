/**
 * TC-PORT-002 — neutral-tier purity for the new contract modules.
 *
 * The ambient guard covers the whole contracts tier; this suite additionally
 * proves each new module declares types and `as const` data only, and that
 * injected ambient/clock/randomness/behaviour fails naming file and line.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { scan, scopedFiles } from "../../scripts/checks/ambient-globals";

const ROOT = process.cwd();
const CONTRACTS_DIR = "packages/core/src/contracts";
const NEW_MODULES = [
  "ports.ts",
  "adapter-capabilities.ts",
  "credentials.ts",
  "envelope.ts",
  "closeout.ts",
] as const;

const isAsConst = (node: ts.Expression | undefined): boolean => {
  if (node === undefined) return false;
  if (ts.isAsExpression(node)) return node.type.getText() === "const";
  if (ts.isSatisfiesExpression(node)) return isAsConst(node.expression);
  return false;
};

const declarationOnlyViolations = (relative: string, text: string): string[] => {
  const source = ts.createSourceFile(
    relative,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: string[] = [];
  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      violations.push(
        `${relative}:${lineOf(statement)} executable declaration ${statement.name?.text ?? "<anonymous>"}`,
      );
      continue;
    }
    if (ts.isExpressionStatement(statement) || ts.isIfStatement(statement)) {
      violations.push(`${relative}:${lineOf(statement)} top-level executable statement`);
      continue;
    }
    if (ts.isImportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;
      if (ts.isStringLiteral(specifier) && /^(node:|bun:)/.test(specifier.text)) {
        violations.push(`${relative}:${lineOf(statement)} runtime import ${specifier.text}`);
      }
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!isAsConst(declaration.initializer)) {
          violations.push(
            `${relative}:${lineOf(declaration)} non-\`as const\` data declaration ${declaration.name.getText(source)}`,
          );
        }
      }
    }
  }
  return violations;
};

const writeContractProbe = (content: string): string => {
  const root = mkdtempSync(join(tmpdir(), "port-neutrality-"));
  const path = join(root, CONTRACTS_DIR, "probe.ts");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return root;
};

describe("TC-PORT-002 neutral-tier purity", () => {
  test("the ambient guard reports zero violations over the contracts tier", () => {
    expect(scan(ROOT)).toEqual([]);
    expect(scopedFiles(ROOT).some((file) => file.startsWith(CONTRACTS_DIR))).toBe(true);
  });

  test("every new contract module is declarations plus `as const` data", () => {
    const violations: string[] = [];
    for (const module of NEW_MODULES) {
      violations.push(
        ...declarationOnlyViolations(
          `${CONTRACTS_DIR}/${module}`,
          readFileSync(join(ROOT, CONTRACTS_DIR, module), "utf8"),
        ),
      );
    }
    expect(violations).toEqual([]);
  });

  test("injected ambient, clock, randomness, and behaviour fail by file and line", () => {
    const root = writeContractProbe(
      [
        "export type Probe = { readonly value: string };",
        "export const probe = process.env.PROBE;",
        "export const stamp = Date.now();",
        "export const random = Math.random();",
        "export function rogue(): number {",
        "  return 1;",
        "}",
        "",
      ].join("\n"),
    );
    try {
      const violations = scan(root);
      const labels = violations.map(
        (violation) => `${violation.file}:${violation.line} ${violation.detail}`,
      );
      expect(
        labels.some((label) => label.includes("probe.ts") && label.includes("process.env")),
      ).toBe(true);
      expect(labels.some((label) => label.includes("Date.now"))).toBe(true);
      expect(labels.some((label) => label.includes("Math.random"))).toBe(true);
      const behavioural = declarationOnlyViolations(
        `${CONTRACTS_DIR}/probe.ts`,
        readFileSync(join(root, CONTRACTS_DIR, "probe.ts"), "utf8"),
      );
      expect(behavioural.some((message) => message.includes("rogue"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the clean control (a type plus `as const` data) passes", () => {
    const root = writeContractProbe(
      'export type Probe = { readonly value: string };\nexport const PROBE_KIND = "probe" as const;\n',
    );
    try {
      expect(scan(root)).toEqual([]);
      expect(
        declarationOnlyViolations(
          `${CONTRACTS_DIR}/probe.ts`,
          readFileSync(join(root, CONTRACTS_DIR, "probe.ts"), "utf8"),
        ),
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
