/**
 * TC-WATCHDOG-001 and TC-WATCHDOG-041 — the watchdog contract data has one
 * data-only home, and the verdict vocabulary is exact, ordered, and
 * contract-only. Every detector has a failing mutant; mutants live in temp
 * copies or in-memory strings, never the live tree.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  WATCHDOG_ERROR_CODES,
  WATCHDOG_SIGNAL_KEYS,
  WATCHDOG_VERDICTS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/watchdog.ts";
const RUNTIME_SPECIFIERS = ["node:", "bun:"];

const parse = (label: string, text: string): ts.SourceFile =>
  ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const DATA_ONLY = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

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

export const dataOnlyViolations = (text: string, label = CONTRACT): string[] => {
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

/** Exact set and order, no duplicate, no extra member. */
export const vocabularyViolations = (values: readonly string[]): string[] => {
  const expected = ["ok", "refused", "stalled", "progressing"];
  const violations: string[] = [];
  const unique = new Set(values);
  if (unique.size !== values.length) violations.push("vocabulary contains a duplicate member");
  if (values.length !== expected.length) {
    violations.push(`vocabulary length ${values.length} != ${expected.length}`);
  }
  for (const [index, value] of expected.entries()) {
    if (values[index] !== value) {
      violations.push(`vocabulary[${index}] ${String(values[index])} != ${value}`);
    }
  }
  for (const value of values) {
    if (!expected.includes(value)) violations.push(`vocabulary has extra member ${value}`);
  }
  return violations;
};

/** Exact declared signal keys, and no CPU field. */
export const signalShapeViolations = (keys: readonly string[]): string[] => {
  const expected = ["heartbeatAgeMs", "tokenDelta", "traffic"];
  const violations: string[] = [];
  if (keys.length !== expected.length) {
    violations.push(`signal keys length ${keys.length} != ${expected.length}`);
  }
  for (const [index, value] of expected.entries()) {
    if (keys[index] !== value)
      violations.push(`signal key[${index}] ${String(keys[index])} != ${value}`);
  }
  if (keys.some((key) => /cpu/i.test(key))) violations.push("signal keys declare a CPU field");
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
        results.push(path.endsWith("/") ? `${path}${entry.name}` : join(path, entry.name));
      }
    }
  };
  walk(directory);
  return results.sort();
};

/** No other package file redeclares the vocabulary or all four verdict values. */
export const singleVocabularyHomeFailures = (root: string): string[] => {
  const failures: string[] = [];
  const contract = join(root, CONTRACT);
  for (const file of listTypeScript(join(root, "packages"))) {
    const relative = file.slice(root.length + 1);
    if (file === contract) continue;
    const text = readFileSync(file, "utf8");
    if (/(?:const|let|var|type)\s+WATCHDOG_VERDICTS\b/.test(text)) {
      failures.push(`${relative}: redeclares WATCHDOG_VERDICTS`);
    }
    if (WATCHDOG_VERDICTS.every((verdict) => new RegExp(`"${verdict}"`).test(text))) {
      failures.push(`${relative}: redeclares the closed verdict list`);
    }
  }
  return failures;
};

const variableStatementText = (text: string, name: string): string | undefined => {
  const source = parse(CONTRACT, text);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        return statement.getText(source);
      }
    }
  }
  return undefined;
};

describe("TC-WATCHDOG-001 the contract data has one data-only home", () => {
  test("the live contract module is data-only and runtime-neutral", () => {
    expect(dataOnlyViolations(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
  });

  test("the verdict vocabulary is exact, ordered, and single-homed", () => {
    expect(WATCHDOG_VERDICTS).toEqual(["ok", "refused", "stalled", "progressing"]);
    expect(vocabularyViolations(WATCHDOG_VERDICTS)).toEqual([]);
    expect(singleVocabularyHomeFailures(ROOT)).toEqual([]);
  });

  test("the watchdog error codes are exactly the three delivered plus the sourced-stall identity", () => {
    expect(WATCHDOG_ERROR_CODES).toEqual([
      "watchdog.checkout-dirty",
      "watchdog.checkout-non-base",
      "watchdog.signals-absent",
      "watchdog.liveness-stalled",
    ]);
  });

  test("the signals shape declares exactly the three progress keys and no CPU field", () => {
    expect(WATCHDOG_SIGNAL_KEYS).toEqual(["heartbeatAgeMs", "tokenDelta", "traffic"]);
    expect(signalShapeViolations(WATCHDOG_SIGNAL_KEYS)).toEqual([]);
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    const shape = text.slice(text.indexOf("export type WatchdogSignals"));
    const body = shape.slice(0, shape.indexOf("};"));
    expect(body).not.toMatch(/cpu/i);
  });

  test("a runtime import or executable statement in a temp copy is rejected naming file and kind", () => {
    const live = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(
      dataOnlyViolations(`${live}\nimport "node:fs";\n`).some((message) =>
        message.includes("runtime import node:fs"),
      ),
    ).toBe(true);
    expect(
      dataOnlyViolations(`${live}\nexport function rogue(): number {\n  return 1;\n}\n`).some(
        (message) => message.includes("executable statement"),
      ),
    ).toBe(true);
  });
});

describe("TC-WATCHDOG-041 the verdict vocabulary is exact and contract-only", () => {
  test("the runtime list and the union derive from one `as const` declaration", () => {
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    const declaration = variableStatementText(text, "WATCHDOG_VERDICTS");
    expect(declaration).toBeDefined();
    expect(declaration ?? "").toContain("as const");
    expect(text).toContain("export type WatchdogVerdict = (typeof WATCHDOG_VERDICTS)[number];");
  });

  test("the declared vocabulary is reachable through the sourced command surface", () => {
    // GH-235: sourced signals make progressing/stalled reachable. The flip is a
    // sourcing plus stalled-projection change; corroboration is unchanged.
    expect(WATCHDOG_VERDICTS).toContain("stalled");
    expect(WATCHDOG_VERDICTS).toContain("progressing");
    const command = readFileSync(join(ROOT, "packages/cli/src/commands/watchdog.ts"), "utf8");
    expect(command).toContain('"stalled"');
    expect(command).toContain("watchdog.liveness-stalled");
    const edge = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    expect(edge).toContain("createSourcedWatchdogSignalSource");
    expect(singleVocabularyHomeFailures(ROOT)).toEqual([]);
  });

  test("a fifth value or a second declaration fails the mutant checks", () => {
    expect(vocabularyViolations([...WATCHDOG_VERDICTS, "zombie"]).join("\n")).toContain(
      "extra member zombie",
    );
    expect(vocabularyViolations(["ok", "ok", "stalled", "progressing"]).join("\n")).toContain(
      "duplicate",
    );
    const root = mkdtempSync(join(tmpdir(), "watchdog-home-"));
    try {
      mkdirSync(join(root, "packages/core/src/domain"), { recursive: true });
      writeFileSync(
        join(root, "packages/core/src/domain/rogue.ts"),
        'export const WATCHDOG_VERDICTS = ["ok", "refused", "stalled", "progressing"] as const;\n',
      );
      const failures = singleVocabularyHomeFailures(root).join("\n");
      expect(failures).toContain("redeclares WATCHDOG_VERDICTS");
      expect(failures).toContain("redeclares the closed verdict list");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
