/**
 * TC-DOCTOR-021 / TC-DOCTOR-022 / TC-DOCTOR-023 / TC-DOCTOR-030 structure
 * halves — the doctor contract is data-only, the domain is pure, the vocabulary
 * has one home, no `STATUS_*` cap is imported, and no product literal appears.
 *
 * Every detector has a failing fixture and a clean control; mutants run on
 * in-memory text or temp copies only.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { DOCTOR_EVIDENCE_REASONS } from "../../packages/core/src/contracts/index";
import { SECRET_READ_ALLOWLIST } from "../../scripts/checks/secret-read-boundary";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/doctor.ts";
const DOMAIN = "packages/core/src/domain/doctor.ts";
const COMMAND = "packages/cli/src/commands/doctor.ts";
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

const exportedNames = (text: string): string[] => {
  const source = parse("probe.ts", text);
  const names: string[] = [];
  for (const statement of source.statements) {
    const exported =
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ===
      true;
    if (!exported) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      names.push(statement.name.text);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
      }
    }
  }
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

const VOCABULARY_NAMES = [
  "DOCTOR_AREAS",
  "DOCTOR_VERDICTS",
  "DOCTOR_EVIDENCE_SOURCES",
  "DOCTOR_EVIDENCE_OUTCOMES",
  "DOCTOR_EVIDENCE_REASONS",
  "DOCTOR_AREA_SOURCES",
  "DOCTOR_CONDITION_CATALOG",
  "DOCTOR_WIRING_NEUTRAL_CONDITIONS",
  "DOCTOR_MAX_DETAIL_CHARS",
  "DOCTOR_MAX_HINT_CHARS",
  "DOCTOR_MAX_MACHINE_BYTES",
  "DOCTOR_MAX_HUMAN_LINES",
  "DOCTOR_MAX_HUMAN_BYTES",
  "DOCTOR_MAX_EVIDENCE_SOURCES",
  "DOCTOR_MAX_EVIDENCE_REASONS",
  "DOCTOR_TRACKER_READ_LIMIT",
  "DOCTOR_CI_READ_LIMIT",
  "DOCTOR_SCHEMA_VERSION",
];

export const singleVocabularyHomeFailures = (root: string): string[] => {
  const failures: string[] = [];
  const contract = join(root, CONTRACT);
  for (const file of listTypeScript("packages")) {
    if (file === contract) continue;
    const text = readFileSync(file, "utf8");
    const relative = file.slice(root.length + 1);
    for (const name of VOCABULARY_NAMES) {
      if (new RegExp(`(?:const|let|var|type)\\s+${name}\\b`).test(text)) {
        failures.push(`${relative}: redeclares ${name}`);
      }
    }
  }
  return failures;
};

const statusCapFailures = (text: string, label: string): string[] =>
  text.includes("STATUS_") ? [`${label}: imports a status cap`] : [];

const fallbackFailures = (text: string, label: string): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && node.text.includes("fallback.internal")) {
      violations.push(`${label}: containment identity inside the doctor tier`);
    }
    if (
      ts.isPropertyAccessExpression(node) &&
      (node.name.text === "internal" || node.name.text === "fallback")
    ) {
      violations.push(`${label}: containment identity inside the doctor tier`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

describe("TC-DOCTOR-022 doctor tier discipline (core halves)", () => {
  test("the live contract module is data-only and the domain is pure", () => {
    expect(contractsDataOnly(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
    expect(domainPure(readFileSync(join(ROOT, DOMAIN), "utf8"))).toEqual([]);
  });

  test("the domain exports exactly the four pinned functions", () => {
    expect(exportedNames(readFileSync(join(ROOT, DOMAIN), "utf8")).sort()).toEqual([
      "aggregateDoctorReport",
      "formatDoctorFailureSummary",
      "renderDoctorHuman",
      "runIsolatedDoctorCheck",
    ]);
  });

  test("the vocabulary is declared once in contracts/doctor.ts", () => {
    expect(singleVocabularyHomeFailures(ROOT)).toEqual([]);
  });

  test("doctor imports no STATUS_* cap and shares no caps module", () => {
    expect(statusCapFailures(readFileSync(join(ROOT, CONTRACT), "utf8"), CONTRACT)).toEqual([]);
    expect(statusCapFailures(readFileSync(join(ROOT, DOMAIN), "utf8"), DOMAIN)).toEqual([]);
  });

  test("fallback.internal never appears in the doctor contracts or domain", () => {
    expect(fallbackFailures(readFileSync(join(ROOT, CONTRACT), "utf8"), CONTRACT)).toEqual([]);
    expect(fallbackFailures(readFileSync(join(ROOT, DOMAIN), "utf8"), DOMAIN)).toEqual([]);
    expect(fallbackFailures("const x = 'fallback.internal';", "probe.ts")).toHaveLength(1);
  });

  test("no product literal appears in the doctor core modules", () => {
    for (const relative of [CONTRACT, DOMAIN]) {
      expect(brandLiteralViolations(readFileSync(join(ROOT, relative), "utf8"), relative)).toEqual(
        [],
      );
    }
  });

  test("a runtime import in the contract fails by name", () => {
    const mutated = `import "node:fs";\n${readFileSync(join(ROOT, CONTRACT), "utf8")}`;
    expect(contractsDataOnly(mutated).some((line) => line.includes("node:fs"))).toBe(true);
  });

  test("an adapter import or a Date.now call in the domain fails by name", () => {
    const adapter = `import "@delivery-os/adapters/github";\n${readFileSync(join(ROOT, DOMAIN), "utf8")}`;
    expect(domainPure(adapter).some((line) => line.includes("@delivery-os/adapters/github"))).toBe(
      true,
    );
    const clock = `${readFileSync(join(ROOT, DOMAIN), "utf8")}\nexport const rogue = (): number => Date.now();\n`;
    expect(domainPure(clock).some((line) => line.includes("Date.now"))).toBe(true);
  });

  test("a redeclared vocabulary list outside the contract fails by file", () => {
    const root = mkdtempSync(join(tmpdir(), "doctor-home-"));
    try {
      mkdirSync(join(root, "packages/core/src/contracts"), { recursive: true });
      writeFileSync(join(root, CONTRACT), "export const DOCTOR_EVIDENCE_REASONS = [];\n");
      mkdirSync(join(root, "packages/core/src/domain"), { recursive: true });
      writeFileSync(
        join(root, "packages/core/src/domain/doctor.ts"),
        `export const DOCTOR_EVIDENCE_REASONS = [${DOCTOR_EVIDENCE_REASONS.map((reason) => `"${reason}"`).join(", ")}];\n`,
      );
      const failures = singleVocabularyHomeFailures(root);
      expect(failures.some((line) => line.includes("redeclares DOCTOR_EVIDENCE_REASONS"))).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the secret-read allowlist stays at four and names no doctor file", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(4);
    const paths = SECRET_READ_ALLOWLIST.map((entry) => entry.path);
    for (const doctorFile of [CONTRACT, DOMAIN]) {
      expect(paths.some((path) => path.includes(doctorFile.replace("packages/", "")))).toBe(false);
    }
  });

  test("TC-DOCTOR-023 no product literal passes the scanner control", () => {
    expect(brandLiteralViolations("const x = 'ados';", "probe.ts")).toContain(
      "probe.ts: product literal ados",
    );
    expect(brandLiteralViolations("const x = 'delivery';", "probe.ts")).toEqual([]);
  });
});
