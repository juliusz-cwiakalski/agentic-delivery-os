/**
 * TC-BLK-004 — the blockers domain is a pure function of injected facts:
 * contracts-tier imports only, no I/O, clock, randomness, environment, network,
 * child process, or timers, and no audience literal branch in the delegation
 * resolver. The state-consumer half is added with the state module.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  buildBlockerListData,
  projectBlockerLaneResume,
  rankBlockerQuestions,
  resolveBlockerDelegation,
  validateBlockerPublish,
} from "../../packages/core/src/domain/blockers";
import { shippedPolicy } from "../fixtures/blockers/policy";
import { FIXED_MS, makeQuestion } from "../fixtures/blockers/records";

const ROOT = process.cwd();
const ENGINE = "packages/core/src/domain/blockers.ts";

const sourceOf = (relative: string): ts.SourceFile =>
  ts.createSourceFile(
    relative,
    readFileSync(join(ROOT, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const importSpecifiers = (source: ts.SourceFile): string[] => {
  const results: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      results.push(statement.moduleSpecifier.text);
    }
  }
  return results;
};

const purityViolations = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression)) {
        if (expression.text === "Date" && node.name.text === "now") violations.push("Date.now");
        if (expression.text === "Math" && node.name.text === "random")
          violations.push("Math.random");
        if (expression.text === "process" && node.name.text === "env")
          violations.push("process.env");
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "Date") violations.push("new Date");
    }
    if (ts.isIdentifier(node)) {
      if (
        ["fetch", "setTimeout", "setInterval", "setImmediate", "Bun", "process", "crypto"].includes(
          node.text,
        )
      ) {
        violations.push(node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...new Set(violations)];
};

const functionBodyText = (source: ts.SourceFile, name: string): string => {
  for (const statement of source.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name,
      )
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer !== undefined &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        ) {
          return declaration.initializer.body.getText(source);
        }
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
      return statement.body === undefined ? "" : statement.body.getText(source);
    }
  }
  throw new Error(`${name} is missing`);
};

describe("TC-BLK-004 pure blockers domain", () => {
  test("the domain imports only the contracts tier", () => {
    const specifiers = importSpecifiers(sourceOf(ENGINE));
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.every((specifier) => specifier === "#contracts")).toBe(true);
    expect(specifiers.some((specifier) => specifier.startsWith("node:"))).toBe(false);
    expect(specifiers.some((specifier) => specifier.startsWith("bun:"))).toBe(false);
    expect(specifiers.some((specifier) => specifier.includes("state"))).toBe(false);
    expect(specifiers.some((specifier) => specifier.includes("adapters"))).toBe(false);
  });

  test("no clock, randomness, environment, network, child process, or timer access exists", () => {
    expect(purityViolations(sourceOf(ENGINE))).toEqual([]);
  });

  test("runtime sentinels do not fire during evaluation", () => {
    const originalNow = Date.now;
    const originalRandom = Math.random;
    let fired = false;
    try {
      Date.now = () => {
        fired = true;
        return 0;
      };
      Math.random = () => {
        fired = true;
        return 0;
      };
      validateBlockerPublish({ type: "spec-ambiguity", lane: "L2", question: "Which spec?" });
      rankBlockerQuestions([makeQuestion({ id: "q-1", options: ["a"] })], [], FIXED_MS);
      buildBlockerListData([makeQuestion({ id: "q-1", options: ["a"] })], [], FIXED_MS);
      projectBlockerLaneResume({ resumeInjection: true, mode: "boundary-note" });
      resolveBlockerDelegation(shippedPolicy(), "owner", "coordinator");
      expect(fired).toBe(false);
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });

  test("identical facts rank identically; a changed now changes only the age", () => {
    const questions = [
      makeQuestion({
        id: "q-2",
        type: "external-wait",
        askedAt: "2026-11-06T10:00:00Z",
        options: [],
      }),
      makeQuestion({
        id: "q-1",
        type: "decision-needed",
        askedAt: "2026-11-06T11:00:00Z",
        options: ["a"],
      }),
    ];
    const first = rankBlockerQuestions(questions, [], FIXED_MS);
    const second = rankBlockerQuestions(questions, [], FIXED_MS);
    expect(second.open.map((item) => item.id)).toEqual(first.open.map((item) => item.id));
    expect(second.open.map((item) => item.rank)).toEqual(first.open.map((item) => item.rank));
    const later = rankBlockerQuestions(questions, [], FIXED_MS + 3_600_000);
    expect(later.open.map((item) => item.id)).toEqual(first.open.map((item) => item.id));
    expect(later.open[0]?.age).toBe((first.open[0]?.age ?? 0) + 3_600_000);
  });

  test("a planted process.env read fails the purity detector by name", () => {
    const planted = ts.createSourceFile(
      "planted.ts",
      "const x = process.env.HOME;\nconst y = Date.now();\n",
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const violations = purityViolations(planted);
    expect(violations).toContain("process.env");
    expect(violations).toContain("Date.now");
  });

  test("the delegation resolver has no audience literal branch", () => {
    const source = sourceOf(ENGINE);
    const body = functionBodyText(source, "resolveBlockerDelegation");
    expect(body.includes('"owner"')).toBe(false);
    expect(body.includes('"coordinator"')).toBe(false);
  });

  test("the domain module is registered in the inventory", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/domain/blockers.ts");
  });
});

const STATE_CONSUMER = "packages/core/src/state/blockers.ts";

describe("TC-BLK-005 state consumer confinement", () => {
  test("the state consumer imports only the contracts and state-boundary siblings", () => {
    const specifiers = importSpecifiers(sourceOf(STATE_CONSUMER));
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier === "#contracts" || specifier === "./artifact-boundary.js").toBe(true);
    }
    expect(specifiers.some((specifier) => specifier.startsWith("node:"))).toBe(false);
    expect(specifiers.some((specifier) => specifier.startsWith("bun:"))).toBe(false);
  });

  test("the state consumer declares no direct runtime API", () => {
    const violations = purityViolations(sourceOf(STATE_CONSUMER));
    expect(
      violations.filter((name) =>
        ["fetch", "setTimeout", "setInterval", "setImmediate", "crypto", "Bun"].includes(name),
      ),
    ).toEqual([]);
    const text = readFileSync(join(ROOT, STATE_CONSUMER), "utf8");
    expect(text.includes("node:fs")).toBe(false);
    expect(text.includes("process.env")).toBe(false);
  });

  test("the state consumer is registered in the inventory", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/state/blockers.ts");
  });
});
