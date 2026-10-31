/**
 * TC-LINT-006 shape half / TC-BOUND-001 tier half — pm-notes vocabulary is
 * data-only and the pure rules stay in the neutral domain tier.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  CANONICAL_PHASE_IDS,
  LITE_REQUIRED_PHASES,
  PM_NOTES_REQUIRED_TOP_LEVEL_KEYS,
  PM_NOTES_VARIANT_VALUES,
} from "../../packages/core/src/contracts/index";
import { scan, scopedFiles } from "../../scripts/checks/ambient-globals";

const ROOT = process.cwd();
const CONTRACTS = "packages/core/src/contracts/pm-notes.ts";
const DOMAIN = "packages/core/src/domain/pm-notes-lint.ts";

const parse = (path: string, text: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const ALLOWED_DECLARATIONS = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const contractDeclarationViolations = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!ALLOWED_DECLARATIONS.has(statement.kind)) {
      violations.push(`executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  return violations;
};

const domainImportViolations = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const allowed =
      specifier === "#contracts" || specifier.startsWith("#domain/") || specifier.startsWith("./");
    if (!allowed) violations.push(`domain import ${specifier}`);
  }
  return violations;
};

describe("pm-notes vocabulary constants equal the pinned sets", () => {
  test("eleven canonical phases, six LITE phases, four required top-level keys", () => {
    expect([...CANONICAL_PHASE_IDS]).toEqual([
      "clarify_scope",
      "specification",
      "test_planning",
      "delivery_planning",
      "dor_check",
      "delivery",
      "system_spec_update",
      "review_fix",
      "quality_gates",
      "dod_check",
      "pr_creation",
    ]);
    expect([...LITE_REQUIRED_PHASES]).toEqual([
      "clarify_scope",
      "specification",
      "delivery",
      "quality_gates",
      "dod_check",
      "pr_creation",
    ]);
    expect([...PM_NOTES_REQUIRED_TOP_LEVEL_KEYS]).toEqual([
      "change_id",
      "title",
      "delivery_mode",
      "phases",
    ]);
    expect([...PM_NOTES_VARIANT_VALUES]).toEqual(["full", "lite"]);
  });

  test("the LITE set is a subset of the canonical eleven", () => {
    for (const phase of LITE_REQUIRED_PHASES) {
      expect(CANONICAL_PHASE_IDS).toContain(phase);
    }
    expect(LITE_REQUIRED_PHASES.length).toBeLessThan(CANONICAL_PHASE_IDS.length);
  });
});

describe("contracts are data-only and the domain tier stays pure", () => {
  test("pm-notes.ts declares only types, imports/exports, and as-const data", () => {
    const source = parse(CONTRACTS, readFileSync(join(ROOT, CONTRACTS), "utf8"));
    expect(contractDeclarationViolations(source)).toEqual([]);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
      expect(statement.moduleSpecifier.text.startsWith("node:")).toBe(false);
      expect(statement.moduleSpecifier.text.startsWith("bun:")).toBe(false);
    }
  });

  test("pm-notes-lint.ts imports only the contracts vocabulary", () => {
    const source = parse(DOMAIN, readFileSync(join(ROOT, DOMAIN), "utf8"));
    expect(domainImportViolations(source)).toEqual([]);
    const text = readFileSync(join(ROOT, DOMAIN), "utf8");
    expect(text.includes("readFileSync")).toBe(false);
    expect(text.includes("process.")).toBe(false);
    expect(text.includes("Date.now")).toBe(false);
    expect(text.includes("Math.random")).toBe(false);
  });

  test("both new paths are inside the ambient scan scope and scan clean", () => {
    const scoped = scopedFiles(ROOT);
    expect(scoped).toContain(CONTRACTS);
    expect(scoped).toContain(DOMAIN);
    expect(scan(ROOT)).toEqual([]);
  });

  test("a synthetic domain violation is caught live (control)", () => {
    const root = mkdtempSync(join(tmpdir(), "gh179-pm-notes-"));
    try {
      const directory = join(root, "packages/core/src/domain");
      mkdirSync(directory, { recursive: true });
      const violation = [
        'import { readFileSync } from "node:fs";',
        "export const probe = (): string => readFileSync('x', 'utf8');",
        "export const environment = process.env;",
      ].join("\n");
      const source = parse(DOMAIN, violation);
      expect(domainImportViolations(source)).toContain("domain import node:fs");
      writeFileSync(join(directory, "probe.ts"), `${violation}\n`);
      const ambient = scan(root);
      expect(ambient.some((entry) => entry.detail.includes("process.env"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
