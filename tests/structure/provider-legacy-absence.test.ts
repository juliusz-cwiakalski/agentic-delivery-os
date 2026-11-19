/**
 * GH-350 TC-INDEP-003 — no production module reads the legacy provider profile
 * directory, the pre-iteration hook, or an environment-variable convention as
 * provider policy input.
 *
 * The scan is a static AST pass over every workspace production source, and it
 * ships its own failing controls: a planted path construction and a planted
 * `process.env` read must each be detected by name, so a scan that never fires
 * fails rather than passes. The migration module is declared to be the only
 * reader of either path; until that module exists the reader set is empty, and
 * the filter that admits it is asserted with a planted migration source.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import type { CatalogField } from "../../packages/core/src/config/catalog";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";

const ROOT = process.cwd();
const PACKAGES = ["core", "adapters", "cli", "mcp", "opencode"] as const;

/** The two legacy policy paths and the legacy observation names, named once. */
const HOOK_SEGMENT = "pre-opencode-iteration";
const PROFILE_SEGMENT = "profiles";
const OBSERVED_NAMES = ["OC_ADOS_MODEL_PROFILE", "ZAI_API_KEY"] as const;
const OBSERVED_PREFIXES = ["OC_ADOS_AGENT_", "ADOS_ZAI_"] as const;

const isObserved = (name: string): boolean =>
  (OBSERVED_NAMES as readonly string[]).includes(name) ||
  OBSERVED_PREFIXES.some((prefix) => name.startsWith(prefix));

type Source = { readonly path: string; readonly text: string };

const productionSources = (): Source[] => {
  const sources: Source[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".ts")) {
        sources.push({ path: relative(ROOT, path), text: readFileSync(path, "utf8") });
      }
    }
  };
  for (const pkg of PACKAGES) walk(join(ROOT, "packages", pkg, "src"));
  return sources.sort((left, right) => left.path.localeCompare(right.path));
};

const parse = (source: Source): ts.SourceFile =>
  ts.createSourceFile(source.path, source.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** `join(<legacy home>, "…", "config", "profiles")` and any `/profiles` template. */
export const legacyPathHits = (sources: readonly Source[]): string[] => {
  const hits: string[] = [];
  for (const source of sources) {
    const file = parse(source);
    const report = (node: ts.Node, detail: string): void => {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      hits.push(`${source.path}:${line + 1}: ${detail}`);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) && node.text.includes(HOOK_SEGMENT)) {
        report(node, HOOK_SEGMENT);
      }
      if (ts.isTemplateExpression(node) && node.head.text.includes(`/${PROFILE_SEGMENT}`)) {
        report(node, PROFILE_SEGMENT);
      }
      if (ts.isCallExpression(node)) {
        const literals = node.arguments
          .filter((argument): argument is ts.StringLiteral => ts.isStringLiteral(argument))
          .map((argument) => argument.text);
        if (literals.includes(PROFILE_SEGMENT) && literals.includes("config")) {
          report(node, `config/${PROFILE_SEGMENT}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return hits;
};

/** `process.env.X`, `process.env["X"]`, `Bun.env.X` and `Deno.env.get("X")` reads. */
export const observedEnvironmentHits = (sources: readonly Source[]): string[] => {
  const hits: string[] = [];
  for (const source of sources) {
    const file = parse(source);
    const report = (node: ts.Node, name: string): void => {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      hits.push(`${source.path}:${line + 1}: ${name}`);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const container = node.expression;
        if (ts.isIdentifier(container.expression) && container.name.text === "env") {
          const owner = container.expression.text;
          if (owner === "process" || owner === "Bun" || owner === "Deno") {
            if (owner !== "Deno" && isObserved(node.name.text)) report(node, node.name.text);
          }
        }
      }
      if (
        ts.isElementAccessExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.name.text === "env" &&
        (node.expression.expression.text === "process" || node.expression.expression.text === "Bun")
      ) {
        const argument = node.argumentExpression;
        if (ts.isStringLiteral(argument) && isObserved(argument.text)) report(node, argument.text);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "get" &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.name.text === "env" &&
        ts.isIdentifier(node.expression.expression.expression) &&
        node.expression.expression.expression.text === "Deno"
      ) {
        const [argument] = node.arguments;
        if (argument !== undefined && ts.isStringLiteral(argument) && isObserved(argument.text)) {
          report(node, argument.text);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return hits;
};

/** The declared migration module is the only admitted reader of either path. */
const isMigrationModule = (path: string): boolean =>
  /(^|\/)migrat[^/]*\.ts$/u.test(path) || /(^|\/)provider[^/]*migrat[^/]*\.ts$/u.test(path);

describe("TC-INDEP-003 no production module reads a legacy policy path", () => {
  test("the real tree holds zero legacy-path constructions and zero observed-name reads", () => {
    const sources = productionSources();
    expect(sources.length).toBeGreaterThan(100);
    expect(legacyPathHits(sources)).toEqual([]);
    expect(observedEnvironmentHits(sources)).toEqual([]);
  });

  test("planted legacy constructions and environment reads are detected by name", () => {
    const planted: readonly Source[] = [
      {
        path: "packages/cli/src/planted.ts",
        text: [
          'import { join } from "node:path";',
          'const profiles = join("/home/x", ".delivery-os", "config", "profiles");',
          'const hook = "/home/x/.delivery-os/hooks/pre-opencode-iteration";',
          "export { profiles, hook };",
        ].join("\n"),
      },
      {
        path: "packages/cli/src/planted-env.ts",
        text: [
          "export const a = process.env.OC_ADOS_MODEL_PROFILE;",
          'export const b = process.env["OC_ADOS_AGENT_PM_MODEL"];',
          'export const c = Deno.env.get("ADOS_ZAI_ANTHROPIC_BASE_URL");',
          "export const d = process.env.PATH;",
        ].join("\n"),
      },
    ];
    const paths = legacyPathHits(planted);
    expect(paths.some((hit) => hit.includes(HOOK_SEGMENT))).toBe(true);
    expect(paths.some((hit) => hit.includes(`config/${PROFILE_SEGMENT}`))).toBe(true);

    const names = observedEnvironmentHits(planted);
    expect(names.map((hit) => hit.split(": ")[1])).toEqual([
      "OC_ADOS_MODEL_PROFILE",
      "OC_ADOS_AGENT_PM_MODEL",
      "ADOS_ZAI_ANTHROPIC_BASE_URL",
    ]);
    expect(names.some((hit) => hit.endsWith(": PATH"))).toBe(false);
  });

  test("the migration module is the only admitted reader of either path", () => {
    const sources = productionSources();
    const readers = legacyPathHits(sources).map((hit) => hit.split(":")[0] ?? "");
    expect(readers.filter((path) => !isMigrationModule(path))).toEqual(readers);
    // The filter admits the declared reader, so "no readers" is not a broken filter.
    const planted: readonly Source[] = [
      {
        path: "packages/core/src/provider/migrate.ts",
        text: 'export const hook = "pre-opencode-iteration";\n',
      },
    ];
    const hits = legacyPathHits(planted);
    expect(hits).toHaveLength(1);
    expect(isMigrationModule(hits[0]?.split(":")[0] ?? "")).toBe(true);
  });

  test("the credential reference shape names a key and stores no value", () => {
    const provider = PRODUCTION_CATALOG.provider;
    if (provider.type !== "object") throw new Error("the provider branch is not an object");
    const credentials = provider.fields.credentials;
    if (credentials === undefined || credentials.type !== "record") {
      throw new Error("provider.credentials is not a record");
    }
    const sourceKey = credentials.value;
    if (sourceKey.type !== "object") throw new Error("the credential value is not an object");
    expect(Object.keys(sourceKey.fields).sort()).toEqual(["sourceKey"]);
    const key = sourceKey.fields.sourceKey;
    if (key === undefined || key.type !== "object") {
      throw new Error("credentials.<name>.sourceKey is not an object");
    }
    expect(Object.keys(key.fields).sort()).toEqual(["name", "style", "suffix"]);

    const names: string[] = [];
    const walk = (field: CatalogField, path: string): void => {
      names.push(path);
      if (field.type === "object") {
        for (const [child, nested] of Object.entries(field.fields)) {
          walk(nested, `${path}.${child}`);
        }
      }
      if (field.type === "record") walk(field.value, `${path}.<name>`);
      if (field.type === "array") walk(field.items, `${path}[]`);
    };
    walk(credentials.value, "provider.credentials.<name>");
    // No leaf of the credential declaration can hold a credential value.
    expect(names.filter((path) => /\.(value|token|secret|password)$/u.test(path))).toEqual([]);
  });
});
