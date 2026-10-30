/**
 * TC-STATE-023 (structure half) — the foundation story ships no CLI command and
 * no configuration coupling in the state tier. The consumer scan completes in
 * Phase 7 with a synthetic public-port consumer and seeded-violation controls.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const STATE_ROOT = "packages/core/src/state";

const listFiles = (relative: string): string[] => {
  const results: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(join(ROOT, current), { withFileTypes: true })) {
      const next = `${current}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk(relative);
  return results.sort();
};

const importSpecifiers = (source: string): string[] => {
  const file = ts.createSourceFile(
    "probe.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
};

describe("TC-STATE-023 foundation scope", () => {
  test("no state CLI command is registered or implemented", () => {
    const commands = readFileSync(join(ROOT, "packages/cli/src/commands/index.ts"), "utf8");
    expect(commands).not.toMatch(/["']state["']\s*:/);
    expect(commands).not.toContain("createStateCommandDefinition");
    const files = readdirSync(join(ROOT, "packages/cli/src/commands"));
    expect(files).not.toContain("state.ts");
  });

  test("the state tier imports contracts and its own modules only", () => {
    const failures: string[] = [];
    for (const file of listFiles(STATE_ROOT)) {
      for (const specifier of importSpecifiers(readFileSync(join(ROOT, file), "utf8"))) {
        const own = specifier.startsWith("./") || specifier.startsWith("../");
        // Runtime APIs are confined to the declared driver edge (D1/D8); the
        // full AST enforcement ships with `state-imports.test.ts` in Phase 7.
        const runtimeEdge =
          file.startsWith(`${STATE_ROOT}/driver/`) && specifier.startsWith("node:");
        const allowed = specifier === "#contracts" || own || runtimeEdge;
        if (!allowed) failures.push(`${file}: ${specifier}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the detector flags a synthetic branding or config import", () => {
    const offenders = importSpecifiers(
      'import "#branding/index";\nimport "@delivery-os/core/config";\n',
    ).filter((specifier) => !(specifier === "#contracts" || specifier.startsWith("./")));
    expect(offenders).toEqual(["#branding/index", "@delivery-os/core/config"]);
  });

  test("no configuration import appears anywhere in the state tier", () => {
    for (const file of listFiles(STATE_ROOT)) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text, file).not.toContain("#config");
      expect(text, file).not.toContain("resolveConfig");
    }
  });
});
