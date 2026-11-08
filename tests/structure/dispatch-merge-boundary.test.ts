/**
 * TC-MERGE-003 (phase 4) — the production tree has zero reachable merge imports
 * from a dispatch path, the boundary rule exists, and its failing fixtures are
 * registered.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const DISPATCH_MODULES = [
  "packages/core/src/app/dispatch.ts",
  "packages/core/src/app/dispatch-ledger.ts",
  "packages/core/src/domain/dispatch-authority.ts",
  "packages/core/src/domain/dispatch-comparison.ts",
  "packages/core/src/domain/dispatch-identity.ts",
  "packages/core/src/domain/dispatch-liveness.ts",
  "packages/core/src/domain/dispatch-result.ts",
  "packages/cli/src/commands/dispatch.ts",
  "packages/cli/src/output/dispatch-text.ts",
] as const;

const MERGE_IMPORT =
  /(?:domain\/merge-|state\/merge|commands\/merge|merge-(?:transaction|freshness|gate-set|probe|waiver))/;

describe("TC-MERGE-003 dispatch has no merge code path", () => {
  test("no dispatch production module imports a merge module", () => {
    for (const file of DISPATCH_MODULES) {
      expect(existsSync(join(ROOT, file)), file).toBe(true);
      const source = readFileSync(join(ROOT, file), "utf8");
      const imports = [...source.matchAll(/import[^;]*?from\s+"([^"]+)"/gs)].map(
        (match) => match[1] as string,
      );
      for (const imported of imports) {
        expect(MERGE_IMPORT.test(imported), `${file} imports ${imported}`).toBe(false);
      }
    }
  });

  test("the declared boundary rule and its failing fixtures exist", () => {
    const config = readFileSync(join(ROOT, ".dependency-cruiser.cjs"), "utf8");
    expect(config).toContain('name: "dispatch-merge-absence"');
    const registry = JSON.parse(
      readFileSync(join(ROOT, "tests/boundaries/fixture-registry.json"), "utf8"),
    ) as Record<string, readonly { readonly id: string }[]>;
    const cases = registry["dispatch-merge-absence"] ?? [];
    expect(cases.map((entry) => entry.id)).toEqual([
      "dispatch-core-app-merge",
      "dispatch-core-domain-merge",
      "dispatch-cli-merge",
    ]);
  });

  test("the fixture cases cover the app, domain, and CLI dispatch paths", () => {
    const cases = readFileSync(join(ROOT, "tests/boundaries/fixtures/cases.ts"), "utf8");
    for (const id of [
      "dispatch-core-app-merge",
      "dispatch-core-domain-merge",
      "dispatch-cli-merge",
    ]) {
      expect(cases).toContain(id);
    }
    expect(cases).toContain("dispatch-clean-contracts");
  });

  test("every dispatch module is listed in the committed inventory", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, readonly string[]>;
    const listed = new Set(
      Object.entries(inventory).flatMap(([pkg, files]) =>
        files.map((file) => `packages/${pkg}/${file}`),
      ),
    );
    for (const file of DISPATCH_MODULES) expect(listed.has(file), file).toBe(true);
  });
});
