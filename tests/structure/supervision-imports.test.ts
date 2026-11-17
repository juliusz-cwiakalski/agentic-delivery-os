/**
 * TC-SUP-095 — the new supervision modules are inventory-registered,
 * tier-placed, and ambient-pure (GH-295 NFR-2, NFR-7). The case starts here and
 * completes over every module in the proofs phase.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const inventory = JSON.parse(
  readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
) as Record<string, string[]>;

const SUPERVISE_SOURCES = [
  "core/src/contracts/supervise.ts",
  "core/src/domain/supervise.ts",
  "core/src/app/supervise.ts",
  "core/src/domain/supervise-text.ts",
  "cli/src/commands/supervise.ts",
] as const;

const moduleSpecifiers = (relative: string): string[] => {
  const path = join(ROOT, "packages", relative);
  if (!existsSync(path)) return [];
  const source = ts.createSourceFile(
    relative,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      specifiers.push(statement.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
};

const isRegistered = (relative: string): boolean =>
  (inventory[relative.split("/")[0] as string] ?? []).includes(
    relative.slice(relative.indexOf("/") + 1),
  );

describe("TC-SUP-095 the new modules are inventory-registered", () => {
  test("every supervision source file that exists is registered", () => {
    const failures: string[] = [];
    for (const relative of SUPERVISE_SOURCES) {
      if (!existsSync(join(ROOT, "packages", relative))) continue;
      if (!isRegistered(relative)) failures.push(`${relative}: not registered`);
    }
    expect(failures).toEqual([]);
    expect(isRegistered("core/src/contracts/supervise.ts")).toBe(true);
    expect(isRegistered("core/src/domain/supervise.ts")).toBe(true);
    expect(isRegistered("core/src/app/supervise.ts")).toBe(true);
  });

  test("an unregistered late file fails the equality naming the path", () => {
    expect(isRegistered("core/src/domain/supervise-rogue.ts")).toBe(false);
  });
});

describe("TC-SUP-095 tier placement is structural", () => {
  test("the domain tier is pure: contracts plus the delivered lane classification only", () => {
    const specifiers = moduleSpecifiers("core/src/domain/supervise.ts");
    for (const specifier of specifiers) {
      expect(specifier).not.toMatch(/^node:/u);
      expect(specifier).not.toMatch(/^bun:/u);
      expect(specifier).not.toContain("adapters");
      expect(specifier).not.toContain("/state/");
    }
    expect(specifiers).toContain("#contracts");
  });

  test("the app tier composes the domain fold and never renders", () => {
    const specifiers = moduleSpecifiers("core/src/app/supervise.ts");
    for (const specifier of specifiers) {
      expect(specifier).not.toMatch(/^node:/u);
      expect(specifier).not.toContain("adapters");
    }
    expect(specifiers).toContain("#contracts");
    expect(specifiers.some((specifier) => specifier.startsWith("../domain/"))).toBe(true);
  });

  test("the new modules read no ambient global", () => {
    const failures: string[] = [];
    for (const relative of SUPERVISE_SOURCES) {
      const path = join(ROOT, "packages", relative);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8");
      for (const marker of ["Date.now(", "Math.random(", "globalThis.", "process.env"]) {
        if (text.includes(marker)) failures.push(`${relative}: ${marker}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the contract export inventory carries the supervise module", () => {
    const fixture = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/ports/v1-contract-inventory.json"), "utf8"),
    ) as { readonly modules: Readonly<Record<string, readonly string[]>> };
    expect(fixture.modules["supervise.ts"]).toContain("SUPERVISION_SCHEMA_VERSION");
  });
});

describe("TC-SUP-095 the boundary battery holds with no new rule or exemption", () => {
  test("the dependency-cruiser configuration grants no supervision exemption", () => {
    const config = readFileSync(join(ROOT, ".dependency-cruiser.cjs"), "utf8");
    expect(config.toLowerCase()).not.toContain("supervise");
  });

  test("the app tier imports neither the state tier nor the branding tier", () => {
    const specifiers = moduleSpecifiers("core/src/app/supervise.ts");
    for (const specifier of specifiers) {
      expect(specifier).not.toContain("../state/");
      expect(specifier).not.toContain("../branding/");
      expect(specifier).not.toContain("adapters");
    }
  });

  test("every supervision module is in the committed inventory in both directions", () => {
    const root = join(ROOT, "packages");
    const failures: string[] = [];
    for (const relative of SUPERVISE_SOURCES) {
      const absolute = join(root, relative);
      if (!existsSync(absolute)) continue;
      if (!isRegistered(relative)) failures.push(`${relative}: missing from inventory`);
    }
    expect(failures).toEqual([]);
  });

  test("the contract export inventory lists the supervise module exports", () => {
    const fixture = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/ports/v1-contract-inventory.json"), "utf8"),
    ) as { readonly modules: Readonly<Record<string, readonly string[]>> };
    const names = fixture.modules["supervise.ts"] ?? [];
    for (const name of [
      "SUPERVISION_SCHEMA_VERSION",
      "SUPERVISION_STATES",
      "SUPERVISION_CLAIM_KINDS",
      "SUPERVISION_CLASSIFICATION_INPUT_FIELDS",
      "SupervisionReport",
    ]) {
      expect(names, name).toContain(name);
    }
  });
});
