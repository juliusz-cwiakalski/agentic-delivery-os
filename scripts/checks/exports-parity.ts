/**
 * GH-172 CI parity — exports gate: every publishable package must pass
 * `attw --pack . --profile esm-only` against its built `dist`, the way the
 * ts-exports job runs it. Catches declaration files whose relative imports do
 * not resolve inside the packed tarball under node16 ESM while the workspace
 * (unpacked) tree still resolves them.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { PRODUCTION_SCHEMA } from "../../packages/core/src/config/schema";
import { PUBLISHABLE } from "./exports-discipline";

const PROFILE = "esm-only";
const DETAIL_MARKERS = ["💀", "🥴", "⚠️"];
const DETAIL_LINE_LIMIT = 8;
const DEFAULT_SOURCE = "packages/core/src/config/defaults.ts";
const DISPLAY_SOURCE = "core/src/config/defaults.ts";
const ARTIFACT_DIR = "packages/core/dist/config";
const schemaSources = ["packages/core/src/config/schema.ts", "packages/core/src/config/catalog.ts"];
const hashSource = (text: string): string => createHash("sha256").update(text).digest("hex");

/** Extract actual declarations; source hash also detects insertions with zero defaults. */
export const configArtifacts = (root: string): Record<string, string> => {
  const text = readFileSync(join(root, DEFAULT_SOURCE), "utf8");
  const source = ts.createSourceFile(DEFAULT_SOURCE, text, ts.ScriptTarget.Latest, true);
  const positions: Record<string, number> = {};
  let found = false;
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== "PRODUCTION_DEFAULTS")
        continue;
      let literal: ts.Expression | undefined = declaration.initializer;
      while (literal && (ts.isAsExpression(literal) || ts.isSatisfiesExpression(literal))) {
        literal = literal.expression;
      }
      if (!ts.isObjectLiteralExpression(literal))
        throw new Error("PRODUCTION_DEFAULTS must be an object literal");
      found = true;
      for (const property of literal.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
          throw new Error("unsupported default declaration");
        }
        positions[property.name.text] =
          source.getLineAndCharacterOfPosition(property.initializer.getStart(source)).line + 1;
      }
    }
  }
  if (!found) throw new Error("PRODUCTION_DEFAULTS declaration missing");
  return {
    "config.schema.json": `${JSON.stringify(PRODUCTION_SCHEMA, null, 2)}\n`,
    "defaults-positions.json": `${JSON.stringify({ source: DISPLAY_SOURCE, sourceHash: hashSource(text), positions }, null, 2)}\n`,
    "schema-sources.json": `${JSON.stringify(Object.fromEntries(schemaSources.map((path) => [path, hashSource(readFileSync(join(root, path), "utf8"))])), null, 2)}\n`,
  };
};

export const generateConfigArtifacts = (root: string): void => {
  const directory = join(root, ARTIFACT_DIR);
  if (!existsSync(directory)) throw new Error("build core TypeScript before artifact generation");
  for (const [file, content] of Object.entries(configArtifacts(root))) {
    writeFileSync(join(directory, file), content);
  }
};

export const checkConfigArtifacts = (root: string): string[] => {
  try {
    return Object.entries(configArtifacts(root)).flatMap(([name, expected]) => {
      const path = join(root, ARTIFACT_DIR, name);
      if (!existsSync(path)) return [`${ARTIFACT_DIR}/${name}: missing packed config artifact`];
      return readFileSync(path, "utf8") === expected
        ? []
        : [`${ARTIFACT_DIR}/${name}: source/artifact drift`];
    });
  } catch {
    return [`${DEFAULT_SOURCE}: cannot derive trusted config artifacts`];
  }
};

const detailExcerpt = (output: string): string => {
  const lines = output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  const marked = lines.filter((line) => DETAIL_MARKERS.some((marker) => line.includes(marker)));
  const excerpt = (marked.length > 0 ? marked : lines).slice(-DETAIL_LINE_LIMIT);
  return excerpt.join(" | ").slice(0, 600);
};

export const checkPackage = (root: string, packageName: string): string[] => {
  const label = `packages/${packageName}`;
  if (!existsSync(join(root, "packages", packageName, "dist"))) {
    return [`${label}: dist/ missing — run pnpm build before the attw parity check`];
  }
  const result = spawnSync("pnpm", ["exec", "attw", "--pack", ".", "--profile", PROFILE], {
    cwd: join(root, "packages", packageName),
    encoding: "utf8",
    timeout: 120_000,
  });
  if (result.status === 0) return [];
  const detail = detailExcerpt(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return [
    `${label}: attw --pack --profile ${PROFILE} failed (exit ${String(result.status)}): ${detail}`,
  ];
};

export const validate = (root: string): string[] => [
  ...checkConfigArtifacts(root),
  ...PUBLISHABLE.flatMap((packageName) => checkPackage(root, packageName)),
];

if (import.meta.main) {
  if (process.argv.includes("--generate-config-artifacts")) {
    generateConfigArtifacts(join(import.meta.dir, "../.."));
    console.log("OK config-artifacts: deterministic schema and defaults positions generated");
    process.exit(0);
  }
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL exports-parity: ${message}`);
    process.exit(1);
  }
  console.log(
    `OK exports-parity: ${PUBLISHABLE.length} publishables pass attw --pack --profile ${PROFILE}`,
  );
}
