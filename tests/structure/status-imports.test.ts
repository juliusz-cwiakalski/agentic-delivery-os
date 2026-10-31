/**
 * TC-STATUS-026 (contracts/domain halves) and TC-STATUS-027 (structure half) —
 * data-only contracts, pure domain imports, a single vocabulary home, and
 * brand-literal absence. Every detector has a failing fixture and a clean
 * control; mutants live in temp copies only.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { STATUS_EVIDENCE_REASONS } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/status.ts";
const DOMAIN = "packages/core/src/domain/status.ts";
const COMMAND = "packages/cli/src/commands/status.ts";
const BRAND_SEEDS = ["ados", "ADOS_", "~/.ados"];
const RUNTIME_SPECIFIERS = ["node:", "bun:"];

const parse = (path: string, text: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const specifiersOf = (source: ts.SourceFile): string[] => {
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
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const callNames = (source: ts.SourceFile): string[] => {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) names.push(node.expression.text);
      if (ts.isPropertyAccessExpression(node.expression)) {
        names.push(`${node.expression.expression.getText(source)}.${node.expression.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

const DATA_ONLY = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

export const contractsDataOnly = (text: string, label = CONTRACT): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!DATA_ONLY.has(statement.kind)) {
      violations.push(`${label}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  for (const specifier of specifiersOf(source)) {
    if (RUNTIME_SPECIFIERS.some((prefix) => specifier.startsWith(prefix))) {
      violations.push(`${label}: runtime import ${specifier}`);
    }
  }
  return violations;
};

export const domainPure = (text: string, label = DOMAIN): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "#contracts" || specifier.startsWith("#domain/") || specifier.startsWith("./");
    if (!allowed) violations.push(`${label}: domain import ${specifier}`);
  }
  for (const name of callNames(source)) {
    if (
      [
        "Date.now",
        "Math.random",
        "performance.now",
        "process.env",
        "Bun.env",
        "fetch",
        "readFileSync",
      ].includes(name)
    ) {
      violations.push(`${label}: impure call ${name}`);
    }
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "env" &&
      ts.isIdentifier(node.expression) &&
      ["process", "Bun"].includes(node.expression.text)
    ) {
      violations.push(`${label}: ambient environment read ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

export const commandCoreOnly = (text: string, label = COMMAND): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "@delivery-os/core" ||
      specifier === "@delivery-os/core/contracts" ||
      specifier.startsWith("./") ||
      specifier.startsWith("../");
    if (!allowed) violations.push(`${label}: non-core command import ${specifier}`);
  }
  return violations;
};

export const brandLiteralViolations = (text: string, label: string): string[] => {
  const violations: string[] = [];
  for (const seed of BRAND_SEEDS) {
    if (text.includes(seed)) violations.push(`${label}: product literal ${seed}`);
  }
  return violations;
};

const listTypeScript = (relative: string): string[] => {
  const directory = join(ROOT, relative);
  const results: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(join(path, entry.name));
      } else if (entry.name.endsWith(".ts")) {
        results.push(join(path, entry.name));
      }
    }
  };
  walk(directory);
  return results.sort();
};

export const singleVocabularyHomeFailures = (root: string): string[] => {
  const failures: string[] = [];
  const contract = join(root, CONTRACT);
  for (const file of listTypeScript("packages")) {
    if (file === contract) continue;
    const text = readFileSync(file, "utf8");
    const relative = file.slice(root.length + 1);
    for (const name of [
      "STATUS_SECTION_ORDER",
      "STATUS_SECTION_STATES",
      "STATUS_EVIDENCE_REASONS",
      "STATUS_EVIDENCE_SOURCES",
      "STATUS_EVIDENCE_OUTCOMES",
      "STATUS_SECTION_TITLES",
    ]) {
      if (new RegExp(`(?:const|let|var|type)\\s+${name}\\b`).test(text)) {
        failures.push(`${relative}: redeclares ${name}`);
      }
    }
    if (STATUS_EVIDENCE_REASONS.every((reason) => text.includes(`"${reason}"`))) {
      failures.push(`${relative}: redeclares the closed reason list`);
    }
  }
  return failures;
};

describe("TC-STATUS-026 contracts/domain tier discipline", () => {
  test("the live contracts module is data-only", () => {
    expect(contractsDataOnly(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
  });

  test("the live domain module is pure", () => {
    expect(domainPure(readFileSync(join(ROOT, DOMAIN), "utf8"))).toEqual([]);
  });

  test("the vocabulary is declared once in contracts/status.ts", () => {
    expect(singleVocabularyHomeFailures(ROOT)).toEqual([]);
  });

  test("the command module imports only core/contracts and local types", () => {
    expect(commandCoreOnly(readFileSync(join(ROOT, COMMAND), "utf8"))).toEqual([]);
  });

  test("an adapter import in the command fails by name", () => {
    const mutated = `import "@delivery-os/adapters/github";\n${readFileSync(join(ROOT, COMMAND), "utf8")}`;
    expect(
      commandCoreOnly(mutated).some((line) => line.includes("@delivery-os/adapters/github")),
    ).toBe(true);
  });

  test("no product literal appears in the status modules", () => {
    for (const relative of [CONTRACT, DOMAIN, COMMAND]) {
      expect(brandLiteralViolations(readFileSync(join(ROOT, relative), "utf8"), relative)).toEqual(
        [],
      );
    }
  });

  test("a runtime import in the contracts module fails by name", () => {
    const mutated = `import "node:fs";\n${readFileSync(join(ROOT, CONTRACT), "utf8")}`;
    expect(contractsDataOnly(mutated).some((line) => line.includes("node:fs"))).toBe(true);
  });

  test("a node import in the domain fails by name", () => {
    const mutated = `import "node:fs";\n${readFileSync(join(ROOT, DOMAIN), "utf8")}`;
    expect(domainPure(mutated).some((line) => line.includes("node:fs"))).toBe(true);
  });

  test("a Date.now call in the domain fails by name", () => {
    const mutated = `${readFileSync(join(ROOT, DOMAIN), "utf8")}\nexport const rogue = (): number => Date.now();\n`;
    expect(domainPure(mutated).some((line) => line.includes("Date.now"))).toBe(true);
  });

  test("a product literal fails the brand scan", () => {
    expect(brandLiteralViolations("const x = 'ados';", "probe.ts")).toContain(
      "probe.ts: product literal ados",
    );
    expect(brandLiteralViolations("const x = 'delivery';", "probe.ts")).toEqual([]);
  });

  test("a redeclared vocabulary list outside the contract fails by file", () => {
    const root = mkdtempSync(join(tmpdir(), "status-home-"));
    try {
      mkdirSync(join(root, "packages/core/src/contracts"), { recursive: true });
      writeFileSync(join(root, CONTRACT), "export const STATUS_EVIDENCE_REASONS = [];\n");
      mkdirSync(join(root, "packages/core/src/domain"), { recursive: true });
      writeFileSync(
        join(root, "packages/core/src/domain/status.ts"),
        `export const STATUS_EVIDENCE_REASONS = [${STATUS_EVIDENCE_REASONS.map((reason) => `"${reason}"`).join(", ")}];\n`,
      );
      const failures = singleVocabularyHomeFailures(root);
      expect(failures.some((line) => line.includes("redeclares STATUS_EVIDENCE_REASONS"))).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
