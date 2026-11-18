/**
 * TC-COORD-037 (mutant half) — temp-copy mutants of the artifact-evidence and
 * lifecycle domain modules must trip the purity oracle, and a fabricated-stale
 * mutant must trip the behavioural oracle.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  evaluateStuck,
  type CoordinatorEvidenceFacts,
  type CoordinatorStuckEvaluation,
} from "../../packages/core/src/domain/index";
import { staleBaseline } from "../fixtures/coordinator/evidence";

const ROOT = process.cwd();
const DOMAIN = "packages/core/src/domain";
const MUTANTS = [
  "coordinator-evidence.ts",
  "coordinator-lifecycle.ts",
  "coordinator-fence.ts",
  "coordinator-wake.ts",
];

const CLOCK_MARKERS = ["Date.now", "new Date", "performance.now", "process.hrtime", "setTimeout"];

const clockViolations = (root: string, file: string): string[] => {
  const path = join(root, DOMAIN, file);
  const text = readFileSync(path, "utf8");
  return CLOCK_MARKERS.filter((marker) => text.includes(marker)).map(
    (marker) => `${file}: ambient clock/timer ${marker}`,
  );
};

const withMutant = (
  file: string,
  mutate: (text: string) => string,
  body: (root: string) => void,
): void => {
  const root = mkdtempSync(join(tmpdir(), "coordinator-mutant-"));
  mkdirSync(join(root, DOMAIN), { recursive: true });
  for (const entry of MUTANTS) cpSync(join(ROOT, DOMAIN, entry), join(root, DOMAIN, entry));
  const path = join(root, DOMAIN, file);
  writeFileSync(path, mutate(readFileSync(path, "utf8")));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe("TC-COORD-037 temp-copy mutants trip the purity oracle", () => {
  test("the unmutated copy is clean (control)", () => {
    for (const file of MUTANTS) expect(clockViolations(ROOT, file)).toEqual([]);
  });

  test("an ambient clock mutant is detected", () => {
    withMutant(
      "coordinator-fence.ts",
      (text) => `${text}\nexport const stamp = Date.now();\n`,
      (root) => {
        expect(clockViolations(root, "coordinator-fence.ts")).toEqual([
          "coordinator-fence.ts: ambient clock/timer Date.now",
        ]);
      },
    );
  });

  test("a wall-clock timer mutant is detected", () => {
    withMutant(
      "coordinator-wake.ts",
      (text) => `${text}\nexport const delay = (ms: number) => setTimeout(() => ms, ms);\n`,
      (root) => {
        expect(clockViolations(root, "coordinator-wake.ts")).toEqual([
          "coordinator-wake.ts: ambient clock/timer setTimeout",
        ]);
      },
    );
  });

  test("a fabricated-stale mutant is caught by the all-unknown oracle", () => {
    const fabricateStale = (_facts: CoordinatorEvidenceFacts): CoordinatorStuckEvaluation =>
      // The mutant collapses `unknown` into `stale` and always reports stuck.
      ({
        verdict: "stuck",
        reason: "stuck-artifact-evidence",
        evidence: "",
        classes: { "digest-consumed": "stale", merge: "stale", answer: "stale" },
      });
    const allUnknown = staleBaseline({
      newTurn: "unknown",
      merge: "unknown",
      answer: "unknown",
    });
    expect(evaluateStuck(allUnknown).verdict).toBe("unevaluable");
    expect(fabricateStale(allUnknown).verdict).toBe("stuck");
  });

  test("the source of the real module contains no fabricated-stale branch", () => {
    const source = ts.createSourceFile(
      "coordinator-evidence.ts",
      readFileSync(join(ROOT, DOMAIN, "coordinator-evidence.ts"), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    expect(source.getText()).toContain("allUnknown");
    expect(source.getText()).toContain('"evidence-unevaluable"');
  });
});

/**
 * TC-COORD-002 / TC-COORD-085 (phase-8 mutants, GH-241): a node:fs import in the
 * contracts tier, an ambient clock in the domain tier, and an OS-signal call in
 * the domain tier must each trip their tier's oracle.
 */
const AMBIENT_MARKERS = [
  "node:",
  "bun:",
  "Date.now",
  "new Date",
  "process.env",
  "process.kill",
  "child_process",
  "execSync",
  "fetch(",
];

const ambientViolations = (root: string, relative: string): string[] => {
  const text = readFileSync(join(root, relative), "utf8");
  return AMBIENT_MARKERS.filter((marker) => text.includes(marker)).map(
    (marker) => `${relative}: ${marker}`,
  );
};

const withTierMutant = (
  relative: string,
  mutate: (text: string) => string,
  body: (root: string) => void,
): void => {
  const root = mkdtempSync(join(tmpdir(), "coordinator-tier-mutant-"));
  const target = join(root, relative);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, mutate(readFileSync(join(ROOT, relative), "utf8")));
  try {
    body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe("GH-241 phase-8 tier mutants trip their oracles", () => {
  test("the unmutated coordinator contracts and domain are clean (control)", () => {
    expect(ambientViolations(ROOT, "packages/core/src/contracts/coordinator.ts")).toEqual([]);
    expect(ambientViolations(ROOT, "packages/core/src/domain/coordinator-evidence.ts")).toEqual([]);
  });

  test("a node:fs import in the contracts tier is caught", () => {
    withTierMutant(
      "packages/core/src/contracts/coordinator.ts",
      (text) => `import { readFileSync } from "node:fs";\n${text}`,
      (root) => {
        expect(ambientViolations(root, "packages/core/src/contracts/coordinator.ts")).toEqual([
          "packages/core/src/contracts/coordinator.ts: node:",
        ]);
      },
    );
  });

  test("an ambient clock in the domain tier is caught", () => {
    withTierMutant(
      "packages/core/src/domain/coordinator-evidence.ts",
      (text) => `${text}\nexport const now = Date.now();\n`,
      (root) => {
        expect(ambientViolations(root, "packages/core/src/domain/coordinator-evidence.ts")).toEqual(
          ["packages/core/src/domain/coordinator-evidence.ts: Date.now"],
        );
      },
    );
  });

  test("an OS-signal call in the domain tier is caught", () => {
    withTierMutant(
      "packages/core/src/domain/coordinator-fence.ts",
      (text) => `${text}\nexport const kill = (pid: number) => process.kill(pid, "SIGTERM");\n`,
      (root) => {
        expect(ambientViolations(root, "packages/core/src/domain/coordinator-fence.ts")).toEqual([
          "packages/core/src/domain/coordinator-fence.ts: process.kill",
        ]);
      },
    );
  });
});
