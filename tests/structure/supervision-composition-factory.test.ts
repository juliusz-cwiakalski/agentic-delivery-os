/**
 * TC-SUP-105 (structure half) — production and the harness obtain their
 * economics/append closures from ONE factory (GH-295 F-4v2, §22).
 *
 * A second implementation in the fixtures — a re-declared schema id, option
 * list, or question-id format — is a structure failure naming the symbol.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PRODUCTION = "packages/cli/src/production.ts";
const HARNESS = "tests/fixtures/supervise/harness.ts";
const FIXTURE_DIR = "tests/fixtures/supervise";

const textOf = (file: string): string => readFileSync(join(ROOT, file), "utf8");

/** Symbols that betray a second closure implementation. */
const closureViolations = (text: string): readonly string[] => {
  const violations: string[] = [];
  for (const symbol of [
    "appendRestart: (",
    "ensureExhaustion: (",
    "raiseQuestion: (",
    "delivery.economics.restart.v1",
    "delivery.economics.exhaustion.v1",
    "delivery.blocker.question.v1",
    "supervise-exhaustion-",
  ]) {
    if (text.includes(symbol)) violations.push(symbol);
  }
  for (const match of text.matchAll(/exhaustion-\$\{ref\}-\$\{/gu)) {
    violations.push(match[0]);
  }
  return violations;
};

describe("TC-SUP-105 one shared closure factory", () => {
  test("production authors the factory and mounts it", () => {
    const production = textOf(PRODUCTION);
    expect(production).toContain("export const createSupervisionEconomicsWritePort");
    expect(production).toContain("economicsWrite: createSupervisionEconomicsWritePort(");
    expect(production).toContain("export const supervisionExhaustionQuestionId");
    expect(production).toContain("export const SUPERVISION_EXHAUSTION_QUESTION_OPTIONS");
  });

  test("the harness imports the factory instead of re-implementing it", () => {
    const harness = textOf(HARNESS);
    expect(harness).toContain("createSupervisionEconomicsWritePort");
    expect(harness).toContain('from "../../../packages/cli/src/production"');
    expect(closureViolations(harness)).toEqual([]);
  });

  test("no fixture re-declares the closure vocabulary", () => {
    const violations: string[] = [];
    for (const entry of readdirSync(join(ROOT, FIXTURE_DIR))) {
      if (!entry.endsWith(".ts")) continue;
      if (`${FIXTURE_DIR}/${entry}` === HARNESS) continue;
      const found = closureViolations(textOf(`${FIXTURE_DIR}/${entry}`));
      for (const symbol of found) violations.push(`${entry}: ${symbol}`);
    }
    expect(violations).toEqual([]);
  });

  test("the duplication mutant fails naming the symbol", () => {
    const mutant = `${textOf(HARNESS)}\nconst appendRestart = (): void => { schemaId: "delivery.economics.restart.v1" };\n`;
    expect(closureViolations(mutant)).toContain("delivery.economics.restart.v1");
  });
});
