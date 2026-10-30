/**
 * Exit-code literal invariant (F-4, NFR-7, §4.6).
 *
 * Forbidden outside the single projection module: numeric assignments to an
 * `exitCode` property and `process.exit(n)` anywhere in the delivered surface.
 * Inside the projection module, only the digits 0, 1, and 2 are permitted.
 * `tests/**` is out of scan scope and the report says so explicitly.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export type ExitLiteralReport = {
  readonly failures: readonly string[];
  readonly scannedFiles: number;
  readonly scope: string;
};

const PROJECTION = "packages/cli/src/projection.ts";
const SURFACE_DIRS = [
  "packages/cli/src",
  "packages/core/src",
  "packages/adapters/src",
  "packages/mcp/src",
  "packages/opencode/src",
];
const ALLOWED_PROJECTION_DIGITS = new Set(["0", "1", "2"]);
export const SCOPE_LABEL = "packages/*/src/** (tests/** excluded by design)";

const listFiles = (root: string, relativeDir: string): string[] => {
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return [];
  const results: string[] = [];
  const walk = (relativePath: string): void => {
    for (const entry of readdirSync(join(root, relativePath), { withFileTypes: true })) {
      const next = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk(relativeDir);
  return results.sort();
};

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const propertyName = (name: ts.PropertyName): string => {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return name.getText();
};

/** Scan a root (the live tree or a mutated temp copy) for exit-code literals. */
export const scanRoot = (root: string): ExitLiteralReport => {
  const failures: string[] = [];
  const files = SURFACE_DIRS.flatMap((directory) => listFiles(root, directory));
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const owner = node.expression.expression;
        if (
          ts.isIdentifier(owner) &&
          owner.text === "process" &&
          node.expression.name.text === "exit"
        ) {
          failures.push(`${file}:${lineOf(source, node)} process.exit(...) is forbidden`);
        }
      }
      if (ts.isPropertyAssignment(node) && propertyName(node.name) === "exitCode") {
        if (ts.isNumericLiteral(node.initializer) && file !== PROJECTION) {
          failures.push(
            `${file}:${lineOf(source, node)} exitCode literal ${node.initializer.text}`,
          );
        }
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "exitCode" &&
        node.initializer !== undefined &&
        ts.isNumericLiteral(node.initializer) &&
        file !== PROJECTION
      ) {
        failures.push(`${file}:${lineOf(source, node)} exitCode literal ${node.initializer.text}`);
      }
      if (file === PROJECTION && ts.isNumericLiteral(node)) {
        if (!ALLOWED_PROJECTION_DIGITS.has(node.text)) {
          failures.push(
            `${file}:${lineOf(source, node)} projection literal ${node.text} is outside {0,1,2}`,
          );
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { failures, scannedFiles: files.length, scope: SCOPE_LABEL };
};
if (import.meta.main) {
  const report = scanRoot(process.cwd());
  console.log(`exit-code-literals: scanned=${report.scannedFiles} files; scope=${report.scope}`);
  if (report.failures.length > 0) {
    for (const failure of report.failures) console.error(`FAIL exit-code-literals: ${failure}`);
    process.exit(1);
  }
  console.log("OK exit-code-literals: no call-site exit literals outside the projection module");
}
