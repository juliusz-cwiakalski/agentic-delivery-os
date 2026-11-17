/**
 * TC-METRICS-100 (static half) / TC-METRICS-105 (ambient-clock half) — tier,
 * purity, and inventory confinement: the contracts module is data-only, the
 * domain modules import only their own pure tier vocabulary, no ambient global
 * appears, and a planted violation fails by name.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { scan } from "../../scripts/checks/ambient-globals";

const ROOT = process.cwd();

/** The metrics modules this change introduces or extends. */
export const METRICS_MODULES = [
  "packages/core/src/contracts/metrics.ts",
  "packages/core/src/domain/metrics.ts",
  "packages/core/src/domain/metrics-text.ts",
  "packages/core/src/state/metrics-reads.ts",
  "packages/adapters/src/file/metrics-baseline.ts",
  "packages/adapters/src/file/metrics-config.ts",
  "packages/adapters/src/file/metrics-corpus.ts",
] as const;

const AMBIENT_MEMBERS = [
  "Date.now",
  "Math.random",
  "process.env",
  "process.cwd",
  "process.exit",
  "fetch(",
  "setTimeout",
  "setInterval",
  "new Date()",
] as const;

type Specifier = { readonly text: string; readonly typeOnly: boolean };

const specifiersOf = (source: string, name: string): readonly Specifier[] => {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const specifiers: Specifier[] = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    specifiers.push({
      text: statement.moduleSpecifier.text,
      typeOnly: statement.importClause?.isTypeOnly === true,
    });
  }
  return specifiers;
};

/** The admitted relative siblings per tier. */
const ADMITTED_RELATIVES: Readonly<Record<string, readonly RegExp[]>> = {
  contracts: [/^\.\/(state|telemetry|spend)\.js$/u],
  domain: [/^\.\/metrics(-text)?\.js$/u],
  state: [/^\.\/(ceremony|spend-reads)\.js$/u],
  adapters: [/^\.\/(config-source|yaml-parser)\.js$/u],
};

const tierOf = (relative: string): keyof typeof ADMITTED_RELATIVES => {
  if (relative.startsWith("packages/core/src/contracts/")) return "contracts";
  if (relative.startsWith("packages/core/src/domain/")) return "domain";
  if (relative.startsWith("packages/core/src/state/")) return "state";
  return "adapters";
};

/** Every import a metrics module may declare, per tier. */
export const metricsImportViolations = (source: string, relative: string): string[] => {
  const violations: string[] = [];
  const tier = tierOf(relative);
  for (const { text, typeOnly } of specifiersOf(source, relative)) {
    if (text === "#contracts") {
      if (tier === "contracts" || tier === "adapters") {
        violations.push(`${relative}: ${tier} may not import #contracts`);
      }
      continue;
    }
    if (text === "@delivery-os/core/contracts") {
      if (tier !== "adapters") violations.push(`${relative}: ${tier} may not import the package`);
      continue;
    }
    if (text.startsWith("./")) {
      if (!ADMITTED_RELATIVES[tier].some((pattern) => pattern.test(text))) {
        violations.push(`${relative}: cross-module relative import ${text}`);
      }
      if (tier === "contracts" && !typeOnly) {
        violations.push(`${relative}: runtime import ${text} in a contracts module`);
      }
      continue;
    }
    violations.push(`${relative}: forbidden import ${text}`);
  }
  for (const ambient of AMBIENT_MEMBERS) {
    if (source.includes(ambient)) violations.push(`${relative}: ambient access ${ambient}`);
  }
  return violations;
};

/** The detector over the live tree. */
export const metricsImportViolationsOfTree = (root: string): string[] => {
  const violations: string[] = [];
  for (const relative of METRICS_MODULES) {
    const text = readFileSync(join(root, relative), "utf8");
    violations.push(...metricsImportViolations(text, relative));
  }
  return violations;
};

describe("TC-METRICS-100 tier and purity confinement", () => {
  test("the metrics modules import only their own tier's vocabulary", () => {
    expect(metricsImportViolationsOfTree(ROOT)).toEqual([]);
  });

  test("the contracts module declares type-level imports only", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/contracts/metrics.ts"), "utf8");
    expect(source).not.toContain('from "node:');
    expect(source).not.toContain('from "bun:');
    expect(source).not.toContain("@delivery-os/");
    expect(source).toContain("import type {");
  });

  test("the pure domain performs no I/O, no store read, and no ambient clock read", () => {
    for (const relative of [
      "packages/core/src/domain/metrics.ts",
      "packages/core/src/domain/metrics-text.ts",
    ]) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      for (const forbidden of ["readRecords", "readFileSync", "node:fs", "Bun."]) {
        expect(source, `${relative} ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  test("the ambient-globals guard reports no wall-clock read in the new modules", () => {
    expect(scan(ROOT)).toEqual([]);
  });

  test("the inventory carries every metrics module", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core ?? []).toContain("src/contracts/metrics.ts");
    expect(inventory.core ?? []).toContain("src/domain/metrics.ts");
    expect(inventory.core ?? []).toContain("src/domain/metrics-text.ts");
    expect(inventory.core ?? []).toContain("src/state/metrics-reads.ts");
    expect(inventory.adapters ?? []).toContain("src/file/metrics-baseline.ts");
    expect(inventory.adapters ?? []).toContain("src/file/metrics-config.ts");
    expect(inventory.adapters ?? []).toContain("src/file/metrics-corpus.ts");
  });
});

describe("the planted-violation arms are proven", () => {
  test("a runtime import in the contracts copy fails by name", () => {
    const directory = mkdtempSync(join(tmpdir(), "metrics-import-probe-"));
    try {
      const relative = "packages/core/src/contracts/metrics.ts";
      const path = join(directory, relative);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(
        path,
        `${readFileSync(join(ROOT, relative), "utf8")}\nimport { readFileSync } from "node:fs";\n`,
      );
      const violations = metricsImportViolations(readFileSync(path, "utf8"), relative);
      expect(violations.some((entry) => entry.includes("node:fs"))).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("a planted adapter import in the domain copy fails by name", () => {
    const relative = "packages/core/src/domain/metrics.ts";
    const source = `${readFileSync(join(ROOT, relative), "utf8")}\nimport { createHarnessStore } from "@delivery-os/adapters/harness";\n`;
    const violations = metricsImportViolations(source, relative);
    expect(violations.some((entry) => entry.includes("@delivery-os/adapters/harness"))).toBe(true);
  });

  test("a planted wall-clock read in a domain copy fails by name", () => {
    const relative = "packages/core/src/domain/metrics.ts";
    const violations = metricsImportViolations(
      "const now = Date.now();\nconst stamp = new Date().toISOString();\n",
      relative,
    );
    expect(violations.some((entry) => entry.includes("Date.now"))).toBe(true);
    expect(violations.some((entry) => entry.includes("new Date()"))).toBe(true);
  });
});
