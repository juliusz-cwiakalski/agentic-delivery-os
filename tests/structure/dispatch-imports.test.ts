/**
 * TC-DISP-008 / TC-MERGE-003 (phase 4) — the dispatch production modules obey
 * the tier boundaries: the pure core modules import only the contracts home and
 * core-relative domain/app modules, and the CLI dispatch surface imports only
 * core and CLI-relative modules. No runtime or adapter edge is reachable.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const CORE_MODULES = [
  "packages/core/src/app/dispatch.ts",
  "packages/core/src/app/dispatch-ledger.ts",
  "packages/core/src/domain/dispatch-authority.ts",
  "packages/core/src/domain/dispatch-comparison.ts",
  "packages/core/src/domain/dispatch-identity.ts",
  "packages/core/src/domain/dispatch-liveness.ts",
  "packages/core/src/domain/dispatch-result.ts",
] as const;

const CLI_MODULES = [
  "packages/cli/src/commands/dispatch.ts",
  "packages/cli/src/output/dispatch-text.ts",
] as const;

const importsOf = (file: string): readonly string[] =>
  [...readFileSync(join(ROOT, file), "utf8").matchAll(/from\s+"([^"]+)"/g)].map(
    (match) => match[1] as string,
  );

describe("dispatch module boundaries", () => {
  test("core dispatch modules never import a surface, adapter, or runtime API", () => {
    for (const file of CORE_MODULES) {
      for (const imported of importsOf(file)) {
        expect(imported.startsWith("@delivery-os/adapters"), `${file} -> ${imported}`).toBe(false);
        expect(imported.startsWith("@delivery-os/cli"), `${file} -> ${imported}`).toBe(false);
        expect(imported.startsWith("node:"), `${file} -> ${imported}`).toBe(false);
        expect(imported.startsWith("bun:"), `${file} -> ${imported}`).toBe(false);
        expect(imported.startsWith("react"), `${file} -> ${imported}`).toBe(false);
      }
    }
  });

  test("the CLI dispatch surface imports only core, CLI-relative modules, and the contracts home", () => {
    for (const file of CLI_MODULES) {
      for (const imported of importsOf(file)) {
        const allowed =
          imported.startsWith("@delivery-os/core") ||
          imported.startsWith("../") ||
          imported.startsWith("./");
        expect(allowed, `${file} -> ${imported}`).toBe(true);
        expect(imported.startsWith("node:")).toBe(false);
      }
    }
  });

  test("no dispatch module carries a second token list or a hardcoded projection digit", () => {
    for (const file of [...CORE_MODULES, ...CLI_MODULES]) {
      const source = readFileSync(join(ROOT, file), "utf8");
      if (file.startsWith("packages/core")) {
        expect(source.includes("DELIVERY_RESULT_TOKENS = ["), file).toBe(false);
      }
      expect(/exitCode\s*[:=]\s*[0-9]/u.test(source), file).toBe(false);
    }
  });
});
