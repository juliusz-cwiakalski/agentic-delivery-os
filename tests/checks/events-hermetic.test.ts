/**
 * TC-EVT-015 (hermetic half) — the `events` surface reaches no I/O, clock,
 * environment, adapter, or state module.
 *
 * The assertion is over the surface modules' relative-import closure, not only
 * their direct declarations: every relative import is resolved and followed, so a
 * re-export or a helper module cannot hide a forbidden dependency one hop away.
 * The one documented boundary is the CLI runner (`packages/cli/src/index.ts`) the
 * definitions are registered into: the surface receives `CommandDefinition` from
 * it, and the runner's own wiring is out of scope for this test because it is
 * delivered, not added by this change.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const MODULES = ["packages/cli/src/commands/events.ts", "packages/cli/src/output/events-text.ts"];

/** The runner the surface definitions are registered into; its wiring is delivered. */
const RUNNER_MODULE = "packages/cli/src/index.ts";

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

const AMBIENT_TOKENS = ["process.env", "Bun.", "fetch(", "writeFile", "readFile", "spawn"];

type ModuleImport = { readonly statement: ts.ImportDeclaration; readonly specifier: string };

const importsOf = (file: string): readonly ModuleImport[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: ModuleImport[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier.getText(source).replace(/["']/gu, "");
    imports.push({ statement, specifier });
  }
  return imports;
};

/** Resolve a relative `.js` specifier to the TypeScript source that produced it. */
const resolveRelative = (from: string, specifier: string): string | undefined => {
  if (!specifier.startsWith(".")) return undefined;
  const base = normalize(join(dirname(from), specifier)).replace(/\.js$/u, ".ts");
  return existsSync(join(ROOT, base)) ? base : undefined;
};

/** The surface's own relative-import closure, excluding the runner boundary. */
const closureOf = (): readonly string[] => {
  const seen = new Set<string>();
  const pending = [...MODULES];
  while (pending.length > 0) {
    const file = pending.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const entry of importsOf(file)) {
      const resolved = resolveRelative(file, entry.specifier);
      if (resolved === undefined || resolved === RUNNER_MODULE) continue;
      pending.push(resolved);
    }
  }
  return [...seen].sort();
};

describe("TC-EVT-015 events surface hermeticity", () => {
  test("the closure is the two surface modules plus any relative helper they import", () => {
    const closure = closureOf();
    // Stated exactly so a new relative import is a reviewed change, not a silent
    // widening of what this test covers.
    expect(closure).toEqual([...MODULES].sort());
    expect(closure).not.toContain(RUNNER_MODULE);
  });

  test("no forbidden import specifier appears in any module of the closure", () => {
    const failures: string[] = [];
    for (const module of closureOf()) {
      for (const { specifier } of importsOf(module)) {
        if (FORBIDDEN_SPECIFIERS.some((forbidden) => specifier.includes(forbidden))) {
          failures.push(`${module}: ${specifier}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("no ambient global, network call, or write appears in any module of the closure", () => {
    const failures: string[] = [];
    for (const module of closureOf()) {
      const text = readFileSync(join(ROOT, module), "utf8");
      for (const token of AMBIENT_TOKENS) {
        if (text.includes(token)) failures.push(`${module}: ${token}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the runner boundary is a relative import, not a bare or aliased dependency", () => {
    // The exclusion is only honest while the surface reaches the runner through a
    // relative specifier it must resolve; a package specifier would smuggle the
    // whole wiring in behind a name this test does not look at.
    const events = importsOf(MODULES[0] as string);
    const runnerImport = events.find(
      (entry) => (resolveRelative(MODULES[0] as string, entry.specifier) ?? "") === RUNNER_MODULE,
    );
    expect(runnerImport?.specifier).toBe("../index.js");
    for (const { specifier } of events) {
      if (specifier === "../index.js") continue;
      expect(specifier.startsWith(".") || specifier.startsWith("@delivery-os/core/")).toBe(true);
    }
  });
});
