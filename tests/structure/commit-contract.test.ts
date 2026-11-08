/**
 * TC-TIER-001 — the commit contracts are data-only, inventoried, and the
 * ambient guard covers the new file. Mutation controls prove non-vacuity.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  COMMIT_DEFAULT_TYPE,
  COMMIT_ERROR_CODES,
  COMMIT_INTENT_BASES,
  COMMIT_INTENTS,
  COMMIT_MAX_SUBJECT_CHARS,
  COMMIT_MESSAGE_SOURCES,
  COMMIT_PHASE_TYPES,
  COMMIT_TELEMETRY_RECORD_KEY_PREFIX,
  COMMIT_TELEMETRY_RECORD_KIND,
  COMMIT_TELEMETRY_SCHEMA_ID,
  COMMIT_TRANSPORTS,
  COMMIT_TYPES,
} from "../../packages/core/src/contracts/index";
import { scan, scopedFiles } from "../../scripts/checks/ambient-globals";

const ROOT = process.cwd();
const CONTRACTS_DIR = "packages/core/src/contracts";
const COMMIT_CONTRACT = `${CONTRACTS_DIR}/commit.ts`;
const inventory = JSON.parse(
  readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
) as Record<string, string[]>;

const ALLOWED_DECLARATIONS = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const declarationViolations = (root: string, relative: string): string[] => {
  const violations: string[] = [];
  const source = ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (!ALLOWED_DECLARATIONS.has(statement.kind)) {
      violations.push(`${relative}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  return violations;
};

const runtimeImportViolations = (root: string, relative: string): string[] => {
  const violations: string[] = [];
  const source = ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier.startsWith("node:") || specifier.startsWith("bun:")) {
      violations.push(`${relative}: runtime import ${specifier}`);
    }
  }
  return violations;
};

describe("TC-TIER-001 commit contracts are data-only and inventoried", () => {
  test("the contracts file is registered and contains no runtime behaviour", () => {
    expect(inventory.core).toContain("src/contracts/commit.ts");
    expect(declarationViolations(ROOT, COMMIT_CONTRACT)).toEqual([]);
    expect(runtimeImportViolations(ROOT, COMMIT_CONTRACT)).toEqual([]);
  });

  test("the closed vocabularies and tunable defaults are declared once", () => {
    expect([...COMMIT_INTENTS]).toEqual(["atomic", "record-only"]);
    expect([...COMMIT_INTENT_BASES]).toEqual([
      "opt-out-flag",
      "config-disabled",
      "skipped-no-pending-work",
    ]);
    expect([...COMMIT_MESSAGE_SOURCES]).toEqual(["model", "template"]);
    expect([...COMMIT_TRANSPORTS]).toEqual(["core-inference", "harness-one-shot", "none"]);
    expect([...COMMIT_TYPES]).toContain("feat");
    expect(COMMIT_PHASE_TYPES.delivery).toBe("feat");
    expect(COMMIT_PHASE_TYPES.review_fix).toBe("fix");
    expect(COMMIT_PHASE_TYPES.system_spec_update).toBe("docs");
    expect(COMMIT_DEFAULT_TYPE).toBe("chore");
    expect(COMMIT_MAX_SUBJECT_CHARS).toBe(72);
    expect(COMMIT_TELEMETRY_RECORD_KIND).toBe("commit.telemetry");
    expect(COMMIT_TELEMETRY_SCHEMA_ID).toBe("delivery.commit.telemetry.v1");
    expect(COMMIT_TELEMETRY_RECORD_KEY_PREFIX).toBe("commit.telemetry:");
    expect([...COMMIT_ERROR_CODES]).toHaveLength(5);
    expect([...COMMIT_ERROR_CODES]).not.toContain("commit.session.context-refused");
  });

  test("the ambient guard covers the new contracts file", () => {
    expect(scopedFiles(ROOT)).toContain(COMMIT_CONTRACT);
    expect(scan(ROOT)).toEqual([]);
  });

  test("a mutation introducing a runtime global is reported by name", () => {
    const root = mkdtempSync(join(tmpdir(), "commit-contract-probe-"));
    try {
      mkdirSync(join(root, CONTRACTS_DIR), { recursive: true });
      writeFileSync(join(root, COMMIT_CONTRACT), "export const value = Date.now();\n");
      const violations = scan(root);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]?.file).toBe(COMMIT_CONTRACT);
      expect(violations[0]?.detail).toContain("Date.now");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a mutation introducing a runtime import is reported by name", () => {
    const root = mkdtempSync(join(tmpdir(), "commit-contract-import-"));
    try {
      mkdirSync(join(root, CONTRACTS_DIR), { recursive: true });
      writeFileSync(join(root, COMMIT_CONTRACT), 'import { readFileSync } from "node:fs";\n');
      expect(runtimeImportViolations(root, COMMIT_CONTRACT)).toContain(
        `${COMMIT_CONTRACT}: runtime import node:fs`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("TC-SESS-005 no production branch returns the retired session refusal", () => {
    const retired = "commit.session.context-refused";
    const productionFiles = [
      COMMIT_CONTRACT,
      `${CONTRACTS_DIR}/error-table.ts`,
      "packages/cli/src/commands/commit.ts",
      "packages/cli/src/commands/phase.ts",
      "packages/cli/src/edge.ts",
    ];
    for (const file of productionFiles) {
      expect(readFileSync(join(ROOT, file), "utf8"), file).not.toContain(retired);
    }
    // The session-fact mechanism stays available; it no longer gates commit/phase.
    expect(readFileSync(join(ROOT, COMMIT_CONTRACT), "utf8")).toContain("CommitSessionFacts");
    expect(readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8")).not.toContain(
      "createDeliverySessionFacts",
    );
  });
});
