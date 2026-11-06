/**
 * TC-RETRO-002 — tier, boundary, runtime confinement, inventory, and branding
 * conformance for the files this change introduces.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

const CHANGE_FILES = [
  "packages/core/src/contracts/retro.ts",
  "packages/core/src/domain/retro.ts",
  "packages/core/src/state/retro-sidecar.ts",
  "packages/core/src/state/retro-registry.ts",
  "packages/core/src/state/driver/runtime-edge.ts",
  "packages/cli/src/commands/retro.ts",
  "packages/cli/src/edge.ts",
] as const;

const specifiersOf = (relative: string): string[] => {
  const source = ts.createSourceFile(
    relative,
    readFileSync(join(ROOT, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
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

const textOf = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-RETRO-002 tier and runtime confinement", () => {
  test("contracts and domain import only contracts, domain, and own modules", () => {
    for (const file of [
      "packages/core/src/contracts/retro.ts",
      "packages/core/src/domain/retro.ts",
    ]) {
      for (const specifier of specifiersOf(file)) {
        expect(specifier.startsWith("node:"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("bun:"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/adapters"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/cli"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/mcp"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.startsWith("@delivery-os/opencode"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.includes("../state/"), `${file}: ${specifier}`).toBe(false);
      }
    }
  });

  test("contracts and domain contain no ambient globals or runtime calls", () => {
    for (const file of [
      "packages/core/src/contracts/retro.ts",
      "packages/core/src/domain/retro.ts",
    ]) {
      const text = textOf(file);
      for (const marker of ["Date.now", "Math.random", "process.", "Bun.", "fetch(", "setTimeout("]) {
        expect(text.includes(marker), `${file}: ${marker}`).toBe(false);
      }
    }
  });

  test("runtime APIs appear only at the admitted driver-edge and CLI locations", () => {
    for (const file of CHANGE_FILES) {
      const specifiers = specifiersOf(file);
      const hasRuntime = specifiers.some(
        (specifier) => specifier.startsWith("node:") || specifier.startsWith("bun:"),
      );
      if (file === "packages/core/src/state/driver/runtime-edge.ts") {
        expect(hasRuntime, file).toBe(true);
      } else if (file === "packages/cli/src/edge.ts") {
        // The CLI edge is an admitted runtime-aware composition root.
        expect(hasRuntime, file).toBe(true);
      } else {
        expect(hasRuntime, file).toBe(false);
      }
    }
  });

  test("the collector seam receives injected readers and no new package or subpath exists", () => {
    const domain = textOf("packages/core/src/domain/retro.ts");
    expect(domain).toContain("RetroCollectorRead");
    expect(domain).not.toContain('from "../state/');
    expect(domain).not.toContain("import { readAuditLedger");
    const coreManifest = JSON.parse(
      readFileSync(join(ROOT, "packages/core/package.json"), "utf8"),
    ) as { exports: Record<string, unknown>; dependencies: Record<string, string> };
    expect(Object.keys(coreManifest.exports).sort()).toEqual([
      ".",
      "./branding",
      "./contracts",
      "./provider",
      "./state",
    ]);
    expect(Object.keys(coreManifest.dependencies)).toEqual(["ajv"]);
  });

  test("the content inventory lists every new source file", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/contracts/retro.ts");
    expect(inventory.core).toContain("src/domain/retro.ts");
    expect(inventory.core).toContain("src/state/retro-sidecar.ts");
    expect(inventory.core).toContain("src/state/retro-registry.ts");
    expect(inventory.cli).toContain("src/commands/retro.ts");
  });

  test("no hardcoded product or binary name exists in the new source", () => {
    const tokens = ["a" + "dos", "A" + "DOS_", "~/" + "." + "ad" + "os"];
    for (const file of CHANGE_FILES) {
      const text = textOf(file);
      for (const token of tokens) expect(text.includes(token), `${file}: ${token}`).toBe(false);
    }
    expect(textOf("packages/cli/src/commands/retro.ts")).toContain("brand");
  });
});
