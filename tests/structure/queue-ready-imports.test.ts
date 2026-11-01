/**
 * TC-QREADY-025 / TC-QREADY-026 (structure halves) — contracts data-only,
 * domain purity, single vocabulary home, brand-literal absence, and the
 * tests-only live literal. Every detector has a failing temp-copy fixture and
 * a clean control.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { QUEUE_READY_EVIDENCE_REASONS } from "../../packages/core/src/contracts/index";
import { SECRET_READ_ALLOWLIST } from "../../scripts/checks/secret-read-boundary";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/queue-ready.ts";
const DOMAIN = "packages/core/src/domain/queue-ready.ts";
const CI_RESULT = "packages/core/src/domain/ci-result.ts";
const COMMAND = "packages/cli/src/commands/queue.ts";
const BRAND_SEEDS = ["ados", "ADOS_", "~/.ados"];

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
    if (specifier.startsWith("node:") || specifier.startsWith("bun:")) {
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
    if (ts.isPropertyAccessExpression(node) && node.name.text === "env") {
      violations.push(`${label}: ambient environment read ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

export const brandLiteralViolations = (text: string, label: string): string[] => {
  const violations: string[] = [];
  for (const seed of BRAND_SEEDS) {
    if (text.includes(seed)) violations.push(`${label}: product literal ${seed}`);
  }
  return violations;
};

const listTypeScript = (directory: string): string[] => {
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

const VOCABULARY_NAMES = [
  "QUEUE_READY_CONDITION_ORDER",
  "QUEUE_READY_CONDITION_STATES",
  "QUEUE_READY_CLOSE_CLASSES",
  "QUEUE_READY_RANK_CLASS_ORDER",
  "QUEUE_READY_EVIDENCE_SOURCES",
  "QUEUE_READY_EVIDENCE_REASONS",
  "QUEUE_READY_REASON_ORDER",
  "QUEUE_READY_MAX_IDENTITY_CHARS",
  "QUEUE_READY_MAX_LABELS",
  "QUEUE_READY_MAX_RELATIONS",
];

export const singleVocabularyHomeFailures = (root: string): string[] => {
  const failures: string[] = [];
  const contract = join(root, CONTRACT);
  for (const file of listTypeScript(join(root, "packages"))) {
    if (file === contract) continue;
    const text = readFileSync(file, "utf8");
    const relative = file.slice(root.length + 1);
    for (const name of VOCABULARY_NAMES) {
      if (new RegExp(`(?:const|let|var|type)\\s+${name}\\b`).test(text)) {
        failures.push(`${relative}: redeclares ${name}`);
      }
    }
    const source = parse(relative, text);
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (initializer === undefined || !ts.isArrayLiteralExpression(initializer)) continue;
        const tokens = initializer.elements.filter((element): element is ts.StringLiteral =>
          ts.isStringLiteral(element),
        );
        const reasons = tokens.filter((token) =>
          QUEUE_READY_EVIDENCE_REASONS.includes(token.text as never),
        );
        if (reasons.length >= 10) {
          failures.push(`${relative}: redeclares the closed reason list`);
        }
      }
    }
  }
  return failures;
};

export const commandImportFailures = (text: string, label = COMMAND): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "@delivery-os/core" ||
      specifier === "@delivery-os/core/contracts" ||
      specifier === "./status.js" ||
      specifier === "../index.js" ||
      specifier.startsWith("./");
    if (!allowed) violations.push(`${label}: disallowed command import ${specifier}`);
  }
  return violations;
};

describe("TC-QREADY-025 queue-ready tier discipline", () => {
  test("the contracts module is data-only", () => {
    expect(contractsDataOnly(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
  });

  test("the domain modules are pure", () => {
    expect(domainPure(readFileSync(join(ROOT, DOMAIN), "utf8"))).toEqual([]);
    expect(domainPure(readFileSync(join(ROOT, CI_RESULT), "utf8"), CI_RESULT)).toEqual([]);
  });

  test("the vocabulary is declared once in contracts/queue-ready.ts", () => {
    expect(singleVocabularyHomeFailures(ROOT)).toEqual([]);
  });

  test("no product literal appears in the queue-ready modules", () => {
    for (const relative of [CONTRACT, DOMAIN, CI_RESULT]) {
      expect(brandLiteralViolations(readFileSync(join(ROOT, relative), "utf8"), relative)).toEqual(
        [],
      );
    }
  });

  test("no title is projected by the queue-ready modules", () => {
    for (const relative of [CONTRACT, DOMAIN]) {
      expect(readFileSync(join(ROOT, relative), "utf8").includes("title")).toBe(false);
    }
  });

  test("the new modules are inventory-registered", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    for (const relative of [
      "src/contracts/queue-ready.ts",
      "src/domain/queue-ready.ts",
      "src/domain/ci-result.ts",
    ]) {
      expect(inventory.core, relative).toContain(relative);
    }
  });

  test("a node import in the contracts module fails by name", () => {
    const mutated = `import "node:fs";\n${readFileSync(join(ROOT, CONTRACT), "utf8")}`;
    expect(contractsDataOnly(mutated).some((line) => line.includes("node:fs"))).toBe(true);
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
    const root = mkdtempSync(join(tmpdir(), "queue-ready-home-"));
    try {
      const contract = join(root, CONTRACT);
      mkdirSync(dirname(contract), { recursive: true });
      writeFileSync(contract, "export const QUEUE_READY_EVIDENCE_REASONS = [];\n");
      const domain = join(root, DOMAIN);
      mkdirSync(dirname(domain), { recursive: true });
      writeFileSync(
        domain,
        `export const QUEUE_READY_EVIDENCE_REASONS = [${QUEUE_READY_EVIDENCE_REASONS.map((reason) => `"${reason}"`).join(", ")}];\n`,
      );
      const failures = singleVocabularyHomeFailures(root);
      expect(
        failures.some((line) => line.includes("redeclares QUEUE_READY_EVIDENCE_REASONS")),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the command imports only core/contracts, the sibling status module, and local types", () => {
    expect(commandImportFailures(readFileSync(join(ROOT, COMMAND), "utf8"))).toEqual([]);
  });

  test("an adapter import in the command fails by name", () => {
    const mutated = `import "@delivery-os/adapters/github";\n${readFileSync(join(ROOT, COMMAND), "utf8")}`;
    expect(
      commandImportFailures(mutated).some((line) => line.includes("@delivery-os/adapters/github")),
    ).toBe(true);
  });

  test("the command reuses the sibling collectStatusFacts instead of duplicating reads", () => {
    const text = readFileSync(join(ROOT, COMMAND), "utf8");
    expect(text.includes("collectStatusFacts")).toBe(true);
    expect(text.includes("readPipelineRuns")).toBe(false);
    expect(text.includes("readWorkItems")).toBe(false);
  });

  test("the secret-read allowlist stays at four and names no queue-ready file", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(4);
    const paths = SECRET_READ_ALLOWLIST.map((entry) => entry.path);
    for (const relative of [CONTRACT, DOMAIN, CI_RESULT, COMMAND]) {
      expect(paths.some((path) => path.includes(relative.replace("packages/", "")))).toBe(false);
    }
  });
});
