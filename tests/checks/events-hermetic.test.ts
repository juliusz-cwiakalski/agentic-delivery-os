/**
 * TC-EVT-015 (hermetic half) — the `events` surface imports no I/O, clock,
 * environment, adapter, or state module, so no lazy read can hide behind it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const MODULES = ["packages/cli/src/commands/events.ts", "packages/cli/src/output/events-text.ts"];

const FORBIDDEN_SPECIFIERS = [
  "node:",
  "bun:",
  "@delivery-os/adapters",
  "@delivery-os/core/state",
  "@delivery-os/core/branding",
  "@delivery-os/core/provider",
  "../daemon-compose",
  "../production",
  "../edge",
];

describe("TC-EVT-015 events surface hermeticity", () => {
  test("no forbidden import specifier is reachable from the surface modules", () => {
    const failures: string[] = [];
    for (const module of MODULES) {
      const source = ts.createSourceFile(
        module,
        readFileSync(join(ROOT, module), "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        const specifier = statement.moduleSpecifier.getText(source).replace(/["']/gu, "");
        if (FORBIDDEN_SPECIFIERS.some((forbidden) => specifier.includes(forbidden))) {
          failures.push(`${module}: ${specifier}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("no ambient global, network call, or write appears in the surface modules", () => {
    const failures: string[] = [];
    for (const module of MODULES) {
      const text = readFileSync(join(ROOT, module), "utf8");
      for (const token of ["process.env", "Bun.", "fetch(", "writeFile", "readFile", "spawn"]) {
        if (text.includes(token)) failures.push(`${module}: ${token}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
