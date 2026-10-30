/**
 * TC-PORT-008 contract half — the reference-to-source-key mapping is declarative
 * data, derives brand prefixes from the seam, and carries no product token.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { matchSeedLiteral } from "../../scripts/checks/forbidden-literals";

const ROOT = process.cwd();
const PORT_CONTRACT = "packages/core/src/contracts/credentials.ts";
const IMPLEMENTATION = "packages/adapters/src/credentials/index.ts";
const SEEDS = ["ados", "ADOS_", "~/.ados"];

const identifierSet = (text: string, functionName: string): Set<string> => {
  const source = ts.createSourceFile(
    IMPLEMENTATION,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== functionName) continue;
      const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node)) names.add(node.text);
        ts.forEachChild(node, visit);
      };
      if (declaration.initializer !== undefined) visit(declaration.initializer);
    }
  }
  return names;
};

describe("TC-PORT-008 declared reference and brand-neutral key", () => {
  test("the mapping is declarative data, not an ambient-environment algorithm", () => {
    const identifiers = identifierSet(
      readFileSync(join(ROOT, IMPLEMENTATION), "utf8"),
      "resolveCredentialSourceKey",
    );
    for (const forbidden of ["process", "Bun", "Deno", "referenceName"]) {
      expect(identifiers.has(forbidden), forbidden).toBe(false);
    }
    expect(identifiers.has("environmentPrefix")).toBe(true);
    expect(identifiers.has("sourceKey")).toBe(true);
  });

  test("the declared key styles are enumerable data on the contract", () => {
    const text = readFileSync(join(ROOT, PORT_CONTRACT), "utf8");
    expect(text).toContain('readonly style: "literal"');
    expect(text).toContain('readonly style: "environment-prefixed"');
  });

  test("no product token appears in the credential contract or implementation", () => {
    for (const file of [PORT_CONTRACT, IMPLEMENTATION]) {
      expect(matchSeedLiteral(readFileSync(join(ROOT, file), "utf8"), SEEDS), file).toBeUndefined();
    }
  });

  test("replacing the seam prefix with a literal token fails the literal scan", () => {
    const mutated = readFileSync(join(ROOT, IMPLEMENTATION), "utf8").replace(
      "brand.environmentPrefix",
      `"${SEEDS[1]}"`,
    );
    expect(matchSeedLiteral(mutated, SEEDS)).toBe(SEEDS[1]);
  });
});
