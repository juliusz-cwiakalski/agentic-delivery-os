/**
 * Shared structural scan checkers (GH-233 F-4, NFR-8).
 *
 * The structure suites and the non-vacuity mutant meta-check import the same
 * callable checkers: a mutant written into a scanned directory must be returned
 * by the checker by name, so a "passing" mutant cannot be a self-text check.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

export type ScanViolation = {
  readonly file: string;
  readonly message: string;
};

/** List TypeScript source files under a repository-relative directory. */
export const listTypeScriptFiles = (relative: string): string[] => {
  const results: string[] = [];
  const walk = (next: string): void => {
    for (const entry of readdirSync(join(ROOT, next), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(`${next}/${entry.name}`);
      } else if (entry.name.endsWith(".ts")) {
        results.push(`${next}/${entry.name}`);
      }
    }
  };
  walk(relative);
  return results.sort();
};

export const AMBIENT_READ_PATTERNS = [
  "process.env",
  "Bun.env",
  "Deno.env",
  "globalThis.process",
] as const;

/** Return every ambient-environment read, naming file and line. */
export const ambientReadViolations = (files: readonly string[]): ScanViolation[] => {
  const violations: ScanViolation[] = [];
  for (const file of files) {
    const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const pattern of AMBIENT_READ_PATTERNS) {
        if (line.includes(pattern)) {
          violations.push({ file, message: `${file}:${index + 1}: ${pattern}` });
        }
      }
    });
  }
  return violations;
};

export const RESULT_TOKEN_LITERALS = [
  "finished",
  "partial",
  "max-restarts",
  "noop-lane-permission",
  "noop-lane-nothing-to-do",
] as const;

/** Return every adapter-local classification or result-token literal. */
export const adapterNormalizationViolations = (files: readonly string[]): ScanViolation[] => {
  const violations: ScanViolation[] = [];
  for (const file of files) {
    const text = readFileSync(join(ROOT, file), "utf8");
    if (text.includes("classifyHarnessEvidence")) {
      violations.push({ file, message: `${file}: classification reference` });
    }
    for (const token of RESULT_TOKEN_LITERALS) {
      if (text.includes(`"${token}"`)) {
        violations.push({ file, message: `${file}: result token "${token}"` });
      }
    }
    for (const comparison of ['=== "opencode"', '=== "claude-code"']) {
      if (text.includes(comparison)) {
        violations.push({ file, message: `${file}: harness-kind comparison ${comparison}` });
      }
    }
  }
  return violations;
};

/** Core files allowed to carry harness-name literals (closed vocabulary/config). */
export const HARNESS_LITERAL_ALLOWED = new Set([
  "packages/core/src/contracts/harness.ts",
  "packages/core/src/config/defaults.ts",
  "packages/core/src/config/catalog.ts",
  "packages/core/src/config/harness.ts",
]);

/** Return every harness-name literal outside the declared allowance. */
export const harnessLiteralViolations = (files: readonly string[]): ScanViolation[] => {
  const violations: ScanViolation[] = [];
  for (const file of files) {
    if (HARNESS_LITERAL_ALLOWED.has(file)) continue;
    const text = readFileSync(join(ROOT, file), "utf8");
    for (const literal of ['"opencode"', '"claude-code"']) {
      if (text.includes(literal)) {
        violations.push({ file, message: `${file}: harness literal ${literal}` });
      }
    }
  }
  return violations;
};
