/**
 * TC-ECON-056 — one gate, every path. Exactly one exported admission gate
 * decides restarts; every restart-event append is dominated by the gate's
 * admission result; both compositions reference the same gate; and no cached or
 * lane/session-scoped count exists.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const BUDGET = "packages/core/src/domain/economics-budget.ts";
const RESUME = "packages/core/src/domain/economics-resume.ts";

const listTypeScript = (relative: string): string[] => {
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
  walk(join(ROOT, relative));
  return results.sort();
};

/** The gate-home scan: exactly one exported admission gate declaration. */
export const gateDeclarations = (files: readonly string[]): string[] =>
  files.filter((file) => /export const evaluateRestartBudget\b/.test(readFileSync(file, "utf8")));

/** Append-before-gate is a bypass: the gate must precede any append call. */
export const gateOrderViolations = (text: string, label: string): string[] => {
  const appendIndex = text.indexOf("appendRestartEvent(");
  const gateIndex = text.indexOf("evaluateRestartBudget(");
  if (appendIndex < 0) return [];
  if (gateIndex < 0) return [`${label}: restart append without an admission gate call`];
  return appendIndex < gateIndex ? [`${label}: restart append precedes the admission gate`] : [];
};

const CACHED_COUNT_NAMES = ["cachedCount", "countCache", "restartCountCache", "cachedRestarts"];

describe("TC-ECON-056 one gate, every path: budget consumption has a single seam", () => {
  test("exactly one exported admission gate exists in packages", () => {
    const files = listTypeScript("packages");
    const declarations = gateDeclarations(files);
    expect(declarations).toHaveLength(1);
    expect(declarations[0]?.endsWith(BUDGET)).toBe(true);
  });

  test("every restart-event append is dominated by the gate's admission result", () => {
    const text = readFileSync(join(ROOT, RESUME), "utf8");
    expect(gateOrderViolations(text, RESUME)).toEqual([]);
    expect(text).toContain('if (gate.outcome === "refuse-budget")');
    expect(text).toContain("const record = restartRecordFor(deps, input, gate.nextOrdinal)");
  });

  test("both compositions reference the same imported gate through one evaluation", () => {
    const text = readFileSync(join(ROOT, RESUME), "utf8");
    const gateCalls = text.match(/evaluateRestartBudget\(/g) ?? [];
    expect(gateCalls).toHaveLength(1);
    expect(text).toContain("createSupervisedResumeComposition");
    expect(text).toContain("createOneShotResumeComposition");
    expect(text.match(/composition\("supervised", deps\)/g)).toHaveLength(1);
    expect(text.match(/composition\("one-shot", deps\)/g)).toHaveLength(1);
  });

  test("no module other than the gate composes restart admission", () => {
    const files = listTypeScript("packages").filter((file) => !file.endsWith(BUDGET));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/\bcount\s*>=\s*input\.bound\b/.test(text)) {
        throw new Error(
          `${file.slice(ROOT.length + 1)} composes restart admission outside the gate`,
        );
      }
    }
    expect(true).toBe(true);
  });

  test("the gate folds durable records and declares no cached or scoped count", () => {
    const budget = readFileSync(join(ROOT, BUDGET), "utf8");
    expect(budget).toContain("foldRestartRecords");
    expect(budget).not.toContain("#state");
    for (const name of CACHED_COUNT_NAMES) {
      expect(budget).not.toContain(name);
    }
    const resume = readFileSync(join(ROOT, RESUME), "utf8");
    for (const name of CACHED_COUNT_NAMES) {
      expect(resume).not.toContain(name);
    }
  });

  test("the bypass mutant (append before the gate) fails the order assertion naming the file", () => {
    const live = readFileSync(join(ROOT, RESUME), "utf8");
    const appendBefore = `deps.store.appendRestartEvent(record);\nconst gate = evaluateRestartBudget(input);\n`;
    expect(
      gateOrderViolations(appendBefore, "packages/core/src/domain/bypass.ts").join("\n"),
    ).toContain("packages/core/src/domain/bypass.ts: restart append precedes the admission gate");
    expect(
      gateOrderViolations("deps.store.appendRestartEvent(record);", "x.ts").join("\n"),
    ).toContain("restart append without an admission gate call");
    expect(gateOrderViolations(live, RESUME)).toEqual([]);

    const temp = mkdtempSync(join(tmpdir(), "gate-seam-"));
    try {
      mkdirSync(join(temp, "packages/core/src/domain"), { recursive: true });
      writeFileSync(
        join(temp, "packages/core/src/domain/bypass.ts"),
        "export const evaluateRestartBudget = () => 1;\n",
      );
      const declarations = gateDeclarations([join(temp, "packages/core/src/domain/bypass.ts")]);
      expect(declarations).toHaveLength(1);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
