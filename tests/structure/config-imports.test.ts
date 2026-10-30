/**
 * TC-CONFIG-023 — the pure config tier cannot reach runtime parsers, adapters,
 * branding, or Node helpers. The detector has a synthetic negative control and
 * is applied to the real core config sources.
 */
import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const CONFIG_ROOT = join(ROOT, "packages/core/src/config");
const FORBIDDEN_PREFIXES = [
  "node:",
  "@delivery-os/adapters",
  "#branding",
  "../branding",
  "../adapters",
];
const FORBIDDEN_MODULES = ["yaml", "js-yaml"];

export const forbiddenConfigImports = (source: string, name = "probe.ts"): string[] => {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const failures: string[] = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const specifier = statement.moduleSpecifier.text;
    if (
      FORBIDDEN_MODULES.includes(specifier) ||
      FORBIDDEN_PREFIXES.some((prefix) => specifier.startsWith(prefix))
    ) {
      failures.push(specifier);
    }
  }
  return failures;
};

test("the real core config tier imports only contracts, its own modules and the trusted validator", () => {
  const failures: string[] = [];
  for (const name of readdirSync(CONFIG_ROOT).filter((entry) => entry.endsWith(".ts"))) {
    failures.push(
      ...forbiddenConfigImports(readFileSync(join(CONFIG_ROOT, name), "utf8"), name).map(
        (specifier) => `${name}: ${specifier}`,
      ),
    );
  }
  expect(failures).toEqual([]);
});

test("the detector fails on a synthetic YAML/branding/adapter import", () => {
  expect(
    forbiddenConfigImports(
      'import YAML from "yaml";\nimport "#branding/index";\nimport "@delivery-os/adapters/file";\n',
    ),
  ).toEqual(["yaml", "#branding/index", "@delivery-os/adapters/file"]);
});
