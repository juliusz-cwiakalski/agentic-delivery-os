/**
 * The retro render-path purity invariant (GH-232 TC-RETRO-003, NFR-9, RSK-6).
 *
 * The collect/report/export render path must contain zero inference adapters,
 * provider clients, model identifiers, network modules, or ambient clock reads.
 * The check is path-scoped and exported so the mutation suite can drive it over
 * a temp tree.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export const RENDER_PATH_FILES = [
  "packages/core/src/domain/retro.ts",
  "packages/cli/src/commands/retro.ts",
  "packages/core/src/state/retro-sidecar.ts",
  "packages/core/src/state/retro-registry.ts",
] as const;

export const FORBIDDEN_IMPORT_MARKERS = [
  "inference",
  "@delivery-os/adapters",
  "provider/client",
  "node:http",
  "node:https",
  "node:net",
  "node:tls",
  "undici",
  "openai",
  "anthropic",
] as const;

export const MODEL_SEAM_IDENTIFIERS = ["fetch", "Date.now", "Math.random"] as const;

export type RenderPurityReport = {
  readonly failures: readonly string[];
  readonly scanned: number;
  readonly files: readonly string[];
};

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

export const checkRetroRenderPurity = (options: {
  readonly root: string;
  readonly files?: readonly string[];
}): RenderPurityReport => {
  const files = options.files ?? RENDER_PATH_FILES;
  const failures: string[] = [];
  for (const file of files) {
    const path = join(options.root, file);
    if (!existsSync(path)) {
      failures.push(`${file}: render-path file is missing`);
      continue;
    }
    const source = ts.createSourceFile(
      file,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      for (const marker of FORBIDDEN_IMPORT_MARKERS) {
        if (!specifier.includes(marker)) continue;
        failures.push(`${file}:${String(lineOf(source, statement))} forbidden import ${specifier}`);
      }
    }
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === "fetch") {
        failures.push(`${file}:${String(lineOf(source, node))} network call fetch`);
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ((node.expression.text === "Date" && node.name.text === "now") ||
          (node.expression.text === "Math" && node.name.text === "random"))
      ) {
        failures.push(
          `${file}:${String(lineOf(source, node))} ambient ${node.expression.text}.${node.name.text}`,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { failures, scanned: files.length, files };
};

if (import.meta.main) {
  const report = checkRetroRenderPurity({ root: process.cwd() });
  console.log(`retro-render-purity: scanned=${String(report.scanned)} render-path files`);
  if (report.failures.length > 0) {
    for (const failure of report.failures) console.error(`FAIL retro-render-purity: ${failure}`);
    process.exit(1);
  }
  console.log("OK retro-render-purity: no model, network, or ambient clock access");
}
