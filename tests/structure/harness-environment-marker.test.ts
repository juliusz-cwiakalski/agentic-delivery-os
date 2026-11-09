/**
 * TC-HDA-001 runtime half — the additive variable-only optional marker on the
 * harness environment contract, and the unchanged vocabulary.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  HARNESS_FAILURE_CODES,
  HARNESS_OUTCOMES,
  type HarnessEnvironmentCredential,
  type HarnessEnvironmentVariable,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const HARNESS_CONTRACT = "packages/core/src/contracts/harness.ts";

const source = (): string => readFileSync(join(ROOT, HARNESS_CONTRACT), "utf8");

const variableEntry = (optional?: boolean): HarnessEnvironmentVariable => ({
  kind: "variable",
  name: "SYNTHETIC_ENTRY",
  ...(optional === undefined ? {} : { optional }),
});

const credentialEntry: HarnessEnvironmentCredential = {
  kind: "credential",
  name: "SYNTHETIC_CREDENTIAL",
  reference: {
    referenceName: "synthetic-reference",
    sourceKey: { style: "literal", name: "SYNTHETIC_SOURCE_KEY" },
  },
};

const STATEMENT_ALLOWLIST = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
]);

describe("TC-HDA-001 additive, variable-only optional marker", () => {
  test("a variable entry's runtime key set gains only `optional` when present", () => {
    expect(Object.keys(variableEntry(true)).sort()).toEqual(["kind", "name", "optional"]);
    expect(Object.keys(variableEntry(false)).sort()).toEqual(["kind", "name", "optional"]);
    expect(Object.keys(variableEntry()).sort()).toEqual(["kind", "name"]);
    expect(Object.keys(credentialEntry).sort()).toEqual(["kind", "name", "reference"]);
  });

  test("the contract tier stays data-only and runtime-neutral", () => {
    const text = source();
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('from "node:');
    expect(text).not.toContain('from "bun:');
    const parsed = ts.createSourceFile(
      HARNESS_CONTRACT,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    for (const statement of parsed.statements) {
      expect(STATEMENT_ALLOWLIST.has(statement.kind)).toBe(true);
    }
  });

  test("the marker adds no failure code or outcome vocabulary", () => {
    expect([...HARNESS_FAILURE_CODES]).toHaveLength(9);
    expect([...HARNESS_OUTCOMES]).toEqual([
      "completed",
      "premature-end",
      "failed",
      "refused",
      "timed-out",
    ]);
  });
});
