/**
 * Reusable mcp AST scans for the injection, read-only, and non-vacuity suites.
 *
 * Every scanner walks `packages/mcp/src/**`, reports the walked file count, and
 * names file:line. The same scanners run over seeded temp copies in the mutants
 * meta-check.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

export type Scan = {
  readonly files: readonly string[];
  readonly violations: readonly string[];
};

export const listMcpTsFiles = (root: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) {
        results.push(next);
      }
    }
  };
  walk("packages/mcp/src");
  return results.sort();
};

const lineOf = (source: ts.SourceFile, node: ts.Node): number =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

const scanTree = (
  root: string,
  check: (
    file: string,
    source: ts.SourceFile,
    node: ts.Node,
    report: (detail: string) => void,
  ) => void,
): Scan => {
  const files = listMcpTsFiles(root);
  const violations: string[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      check(file, source, node, (detail) => {
        violations.push(`${file}:${lineOf(source, node)} ${detail}`);
      });
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { files, violations };
};

/** `callTool` may be called only by the protocol dispatcher, never a handler. */
export const handlerRecursionViolations = (root: string): Scan =>
  scanTree(root, (file, _source, node, report) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "callTool" &&
      file.startsWith("packages/mcp/src/commands/") &&
      !file.endsWith("/toolset.ts")
    ) {
      report("handler calls callTool (tool recursion)");
    }
  });

/** Handlers may not evaluate content, spawn, or import a runtime API. */
export const handlerUnsafeViolations = (root: string): Scan =>
  scanTree(root, (file, _source, node, report) => {
    if (!file.startsWith("packages/mcp/src/commands/")) return;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (specifier === "node:child_process") report("imports node:child_process");
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "eval") report("calls eval");
      if (["spawn", "exec", "execFile", "fork"].includes(node.expression.text)) {
        report(`calls ${node.expression.text}`);
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      report("dynamic import in a handler");
    }
  });

/** No mcp module writes to a state store or fence. */
export const handlerWriteViolations = (root: string): Scan =>
  scanTree(root, (_file, _source, node, report) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      [
        "append",
        "replaceDocument",
        "acquireFence",
        "releaseFence",
        "recoverFence",
        "repairTornTail",
        "salvage",
      ].includes(node.expression.name.text)
    ) {
      report(`state mutation ${node.expression.name.text}(`);
    }
  });

/** No mcp module imports or constructs the spawn-capable git seam. */
export const gitSeamViolations = (root: string): Scan =>
  scanTree(root, (_file, _source, node, report) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text === "@delivery-os/adapters/git") report("imports git seam");
    }
    if (
      ts.isIdentifier(node) &&
      [
        "createGitBranchSeam",
        "createGitCommitSeam",
        "createWatchdogGitSeam",
        "createCommitlintProbe",
      ].includes(node.text) &&
      node.parent !== undefined &&
      ts.isCallExpression(node.parent)
    ) {
      report(`calls ${node.text}`);
    }
  });

/** The closed catalog must be exactly the three primitive IDs. */
export const catalogViolations = (root: string): Scan => {
  const files = listMcpTsFiles(root);
  const violations: string[] = [];
  let registrationCount = 0;
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        let initializer: ts.Expression | undefined = node.initializer;
        while (
          initializer !== undefined &&
          (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer))
        ) {
          initializer = initializer.expression;
        }
        if (
          node.name.text === "CANONICAL_TOOL_IDS" &&
          initializer !== undefined &&
          ts.isArrayLiteralExpression(initializer)
        ) {
          registrationCount += 1;
          const ids = initializer.elements.filter(ts.isStringLiteral).map((entry) => entry.text);
          const expected = ["status", "verify-artifact", "gate-report"];
          if (JSON.stringify(ids) !== JSON.stringify(expected)) {
            violations.push(`${file}: catalog [${ids.join(", ")}] is not [${expected.join(", ")}]`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  if (registrationCount !== 1) {
    violations.push(`catalog registration sites: ${registrationCount} (exactly one required)`);
  }
  return { files, violations };
};

/** The naming firewall: no seed literal in a delivered module. */
export const seedLiteralViolations = (root: string): Scan => {
  const files = listMcpTsFiles(root);
  const violations: string[] = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (const seed of ["ados", "ADOS_", "~/.ados"]) {
      if (text.includes(seed)) violations.push(`${file}: forbidden seed literal ${seed}`);
    }
  }
  return { files, violations };
};
