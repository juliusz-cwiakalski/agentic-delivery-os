/**
 * TC-SLA-025 — the SLA evaluator is a pure function of injected facts: it
 * imports only the contracts tier and contains no I/O, clock, randomness, or
 * ambient read.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { evaluateOwnerGateSla } from "../../packages/core/src/domain/owner-gate-sla";

const ROOT = process.cwd();
const ENGINE = "packages/core/src/domain/owner-gate-sla.ts";

const parse = (): ts.SourceFile =>
  ts.createSourceFile(
    ENGINE,
    readFileSync(join(ROOT, ENGINE), "utf8"),
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
        if (expression.text === "Date" && node.name.text === "now") {
          violations.push("Date.now");
        }
        if (expression.text === "Math" && node.name.text === "random") {
          violations.push("Math.random");
        }
        if (expression.text === "process" && node.name.text === "env") {
          violations.push("process.env");
        }
      }
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "Date") violations.push("new Date");
    }
    if (ts.isIdentifier(node)) {
      if (["fetch", "setTimeout", "setInterval", "setImmediate"].includes(node.text)) {
        violations.push(node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...new Set(violations)];
};

describe("TC-SLA-025 pure domain core", () => {
  test("the evaluator imports only the contracts tier", () => {
    const specifiers = importSpecifiers(parse());
    expect(specifiers.length).toBeGreaterThan(0);
    expect(specifiers.every((specifier) => specifier === "#contracts")).toBe(true);
    expect(specifiers.some((specifier) => specifier.startsWith("node:"))).toBe(false);
    expect(specifiers.some((specifier) => specifier.startsWith("bun:"))).toBe(false);
  });

  test("no clock, randomness, environment, network, child process, or timer access exists", () => {
    expect(purityViolations(parse())).toEqual([]);
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
      evaluateOwnerGateSla({
        audience: "owner",
        nowMs: 0,
        nowIso: "2026-11-06T12:00:00Z",
        policy: {
          comparator: ">=",
          escalationThresholdMs: 86_400_000,
          expiryThresholdMs: 259_200_000,
          rows: [],
        },
        gates: [],
        decisions: [],
      });
      expect(fired).toBe(false);
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });

  test("the module is registered in the inventory and the contracts module is data-only", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/domain/owner-gate-sla.ts");
    const contracts = readFileSync(
      join(ROOT, "packages/core/src/contracts/owner-gate-sla.ts"),
      "utf8",
    );
    expect(contracts).not.toContain("function ");
  });
});
