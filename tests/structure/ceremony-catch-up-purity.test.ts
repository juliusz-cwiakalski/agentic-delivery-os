/**
 * TC-CEREMONY-029 (purity half) — catch-up schedule evaluation is a pure
 * function of the declaration, the injected clock, and the recorded runs. The
 * only time input is the clock value the caller passes; a planted `Date.now`
 * mutation fails the same scan.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import type { CeremonyDeclaration } from "../../packages/core/src/contracts/index";
import { evaluateCeremonySchedule } from "../../packages/core/src/domain/index";
import { NOW_MS } from "../fixtures/ceremony/state";

const ROOT = process.cwd();
const FILE = "packages/core/src/domain/ceremony-schedule.ts";

const MARKERS = [
  "node:",
  "bun:",
  "@delivery-os/adapters",
  "@delivery-os/cli",
  "../state/",
  "Date.now",
  "Math.random",
  "process.",
  "Bun.",
  "Deno.",
  "fetch(",
  "setTimeout(",
  "setInterval(",
] as const;

/** The declared purity scan over one source text. */
export const purityViolations = (text: string): readonly string[] => {
  const violations: string[] = [];
  for (const marker of MARKERS) {
    if (text.includes(marker)) violations.push(marker);
  }
  return violations;
};

const specifiersOf = (text: string): readonly string[] => {
  const source = ts.createSourceFile(FILE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
};

const liveText = (): string => readFileSync(join(ROOT, FILE), "utf8");

describe("TC-CEREMONY-029 schedule evaluation is pure over the injected clock", () => {
  test("the live module carries no runtime, ambient, or adapter marker", () => {
    const text = liveText();
    expect(purityViolations(text)).toEqual([]);
    for (const specifier of specifiersOf(text)) {
      expect(
        specifier === "#contracts" ||
          specifier === "./ceremony-intake.js" ||
          specifier === "./ceremony-run.js",
        specifier,
      ).toBe(true);
    }
  });

  test("a planted Date.now mutation fails the same scan", () => {
    const mutated = `${liveText()}\nconst planted = Date.now();\n`;
    expect(purityViolations(mutated)).toContain("Date.now");
  });

  test("identical inputs yield identical windows; a different clock differs", () => {
    const declaration = JSON.parse(
      readFileSync(
        join(ROOT, "tests/fixtures/ceremony/declarations/valid-note-less-scheduled.json"),
        "utf8",
      ),
    ) as CeremonyDeclaration;
    const input = {
      declaration,
      scopeKey: "repo",
      runs: [],
      nowMs: NOW_MS,
      lookback: 1,
    } as const;
    const first = evaluateCeremonySchedule(input);
    const second = evaluateCeremonySchedule(input);
    expect(second).toEqual(first);
    const other = evaluateCeremonySchedule({ ...input, nowMs: NOW_MS - 86_400_000 });
    expect(other.missed).not.toEqual(first.missed);
  });

  test("an already-recorded window is satisfied, and the arithmetic is existence-based", () => {
    const declaration = JSON.parse(
      readFileSync(
        join(ROOT, "tests/fixtures/ceremony/declarations/valid-note-less-scheduled.json"),
        "utf8",
      ),
    ) as CeremonyDeclaration;
    const window = {
      start: "2026-11-15T00:00:00.000Z",
      end: "2026-11-15T23:59:59.999Z",
    };
    const recorded = [
      {
        schemaId: "delivery.ceremony.run.v1",
        ceremonyId: declaration.id,
        runId: "run-recorded",
        origin: "built-in",
        declarationDigest: "0",
        trigger: {
          kind: "explicit",
          resolution: "declaration",
          declaredWindow: window,
          actualWindow: window,
        },
        scopeKey: { value: "repo", derivation: "repository" },
        tier: { effectiveTier: "full", phaseSetSize: 11, escalations: [] },
        startedAtMs: NOW_MS,
        phaseCount: 1,
      },
    ] as const;
    const evaluation = evaluateCeremonySchedule({
      declaration,
      scopeKey: "repo",
      runs: recorded,
      nowMs: NOW_MS,
      lookback: 1,
    });
    expect(evaluation.missed).toEqual([]);
    expect(evaluation.satisfied).toEqual([window]);
  });
});
