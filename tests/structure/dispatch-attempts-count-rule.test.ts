/**
 * GH-289 TC-ATTEMPT-038 — one divergence-count computation, two consumers, zero
 * second fold and zero list-length derivation.
 *
 * The structural half parses every `packages/<package>/src` module with the
 * TypeScript AST and walks the import graph instead of matching source text: the
 * shared computation is declared once, exactly two call sites pass a repository
 * scope and both import the same exported symbol, the latest-per-identifier fold
 * exists once, and no count is derived from the truncated identifier list. Every
 * failure names the file and line. The retirement scan covers `packages/**` and
 * `tests/**` and reports file:line for each surviving reference. The
 * behavioural half proves the exact count equals the open-record count, not the
 * truncated identifier list's length.
 */
import { describe, expect, test } from "bun:test";
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { summarizeRepositoryDivergences } from "../../packages/core/src/domain/dispatch-gate";
import { openDivergences, withHistory } from "../fixtures/dispatch/attempt-records";
import { REPOSITORY } from "../fixtures/dispatch/ledger";

const ROOT = process.cwd();
const SYMBOL = "summarizeRepositoryDivergences";
/** The retired helper's name; it must not survive in any source or test file. */
const DEPRECATED_COUNT_HELPER = "summarizeDispatchDivergences";
const DOMAIN = "packages/core/src/domain/dispatch-gate.ts";
const APP = "packages/core/src/app/dispatch-gate.ts";
/** This scanner names the retired symbol once; it excludes itself from the scan. */
const SELF = "tests/structure/dispatch-attempts-count-rule.test.ts";

type Parsed = { readonly path: string; readonly source: ts.SourceFile };

const walkFiles = (relative: string): string[] => {
  const results: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(join(ROOT, relative), { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) results.push(...walkFiles(next));
    else if (entry.name.endsWith(".ts")) results.push(next);
  }
  return results.sort();
};

const packageSources: readonly Parsed[] = ["adapters", "cli", "core", "mcp", "opencode", "testkit"]
  .flatMap((name) => walkFiles(`packages/${name}/src`))
  .map((path) => ({
    path,
    source: ts.createSourceFile(
      path,
      readFileSync(join(ROOT, path), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    ),
  }));

const lineOf = (node: ts.Node): number =>
  node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1;

const at = (item: Parsed, node: ts.Node): string => {
  const text = node.getText(item.source).split("\n")[0] ?? "";
  return `${item.path}:${String(lineOf(node))}: ${text.slice(0, 120)}`;
};

const walkNodes = (node: ts.Node, visit: (node: ts.Node) => void): void => {
  visit(node);
  ts.forEachChild(node, (child) => walkNodes(child, visit));
};

const declarations: { readonly item: Parsed; readonly node: ts.VariableDeclaration }[] = [];
const callSites: { readonly item: Parsed; readonly node: ts.CallExpression }[] = [];
const references: { readonly item: Parsed; readonly node: ts.Identifier }[] = [];
const folds: { readonly item: Parsed; readonly node: ts.CallExpression }[] = [];
const listLengthCounts: string[] = [];

for (const item of packageSources) {
  walkNodes(item.source, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === SYMBOL) {
      declarations.push({ item, node });
    }
    if (ts.isIdentifier(node) && node.text === SYMBOL) references.push({ item, node });
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === SYMBOL
    ) {
      callSites.push({ item, node });
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "set"
    ) {
      const key = node.arguments[0];
      if (
        key !== undefined &&
        ts.isPropertyAccessExpression(key) &&
        key.name.text === "divergenceId"
      ) {
        folds.push({ item, node });
      }
    }
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(item.source);
      if (name !== "unresolved" && name !== "resolved") return;
      const initializer = node.initializer.getText(item.source);
      // The truncated list (`unresolvedIds`) may never feed a count: the P2
      // mutation is `unresolved: unresolvedIds.length` /
      // `resolved: folded.length - unresolvedIds.length`.
      if (initializer.includes("unresolvedIds")) listLengthCounts.push(at(item, node));
    }
  });
}

const referencingPaths = [...new Set(references.map((entry) => entry.item.path))].sort();

const importsSymbol = (item: Parsed): boolean => {
  let imported = false;
  walkNodes(item.source, (node) => {
    if (!ts.isImportDeclaration(node)) return;
    const bindings = node.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) return;
    if (bindings.elements.some((element) => element.name.text === SYMBOL)) imported = true;
  });
  return imported;
};

const symbolImportSpecifier = (item: Parsed): string | undefined => {
  let specifier: string | undefined;
  walkNodes(item.source, (node) => {
    if (!ts.isImportDeclaration(node)) return;
    const bindings = node.importClause?.namedBindings;
    if (bindings === undefined || !ts.isNamedImports(bindings)) return;
    if (bindings.elements.some((element) => element.name.text === SYMBOL)) {
      specifier = node.moduleSpecifier.getText(item.source);
    }
  });
  return specifier;
};

const enclosingDeclarationName = (node: ts.Node): string | undefined => {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name))
      return current.name.text;
    if (
      (ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current)) &&
      current.name !== undefined
    ) {
      return current.name.text;
    }
    if (ts.isSourceFile(current)) return undefined;
    current = current.parent;
  }
  return undefined;
};

/** Every reference to the retired helper, with its file and line. */
const retirementFailures = (): string[] => {
  const failures: string[] = [];
  const paths = [
    ...packageSources.map((item) => item.path),
    ...walkFiles("tests").filter((path) => path !== SELF),
  ];
  for (const path of paths) {
    const text = readFileSync(join(ROOT, path), "utf8");
    let index = text.indexOf(DEPRECATED_COUNT_HELPER);
    while (index !== -1) {
      const line = text.slice(0, index).split("\n").length;
      failures.push(`${path}:${String(line)}: ${DEPRECATED_COUNT_HELPER}`);
      index = text.indexOf(DEPRECATED_COUNT_HELPER, index + 1);
    }
  }
  return failures;
};

describe("TC-ATTEMPT-038 one computation, two consumers", () => {
  test("the computation is declared exactly once in the domain tier", () => {
    expect(declarations.map((entry) => at(entry.item, entry.node))).toHaveLength(1);
    expect(declarations[0]?.item.path).toBe(DOMAIN);
  });

  test("the signature admits a repository scope and both call sites pass one", () => {
    const declaration = declarations[0];
    if (declaration === undefined) throw new Error(`${SYMBOL} is not declared`);
    const initializer = declaration.node.initializer;
    if (initializer === undefined || !ts.isArrowFunction(initializer)) {
      throw new Error(`${SYMBOL} is not an arrow function`);
    }
    expect(initializer.parameters).toHaveLength(2);
    expect(initializer.parameters[1]?.name.getText(declaration.item.source)).toBe("repository");

    expect(callSites.map((entry) => at(entry.item, entry.node))).toHaveLength(2);
    const failures: string[] = [];
    for (const entry of callSites) {
      const scope = entry.node.arguments[1];
      if (entry.node.arguments.length !== 2 || scope === undefined) {
        failures.push(`${at(entry.item, entry.node)}: expected two arguments`);
        continue;
      }
      if (!/repository/iu.test(scope.getText(entry.item.source))) {
        failures.push(`${at(entry.item, entry.node)}: second argument is not a repository scope`);
      }
    }
    expect(failures).toEqual([]);
    expect([...new Set(callSites.map((entry) => entry.item.path))].sort()).toEqual([APP, DOMAIN]);
  });

  test("both consumers reference the same exported symbol through the import graph", () => {
    expect(referencingPaths).toEqual([APP, DOMAIN]);
    const app = packageSources.find((item) => item.path === APP);
    if (app === undefined) throw new Error(`${APP} is missing`);
    expect(importsSymbol(app)).toBe(true);
    expect(symbolImportSpecifier(app)).toBe('"../domain/dispatch-gate.js"');
  });

  test("exactly one latest-per-identifier fold exists inside the computation", () => {
    const foldInside = folds.filter((entry) => enclosingDeclarationName(entry.node) === SYMBOL);
    expect(foldInside.map((entry) => at(entry.item, entry.node))).toHaveLength(1);
    expect(foldInside[0]?.item.path).toBe(DOMAIN);
    // No consumer inlines its own fold: every other latest-per-identifier fold
    // in the tree is the delivered `foldDispatchDivergences` helper.
    const unexpected = folds.filter((entry) => {
      const owner = enclosingDeclarationName(entry.node);
      return owner !== SYMBOL && owner !== "foldDispatchDivergences";
    });
    expect(unexpected.map((entry) => at(entry.item, entry.node))).toEqual([]);
  });

  test("no surface derives a count from the truncated identifier list", () => {
    expect(listLengthCounts).toEqual([]);
  });

  test("the retired list-length helper is absent from every source and test file", () => {
    expect(DEPRECATED_COUNT_HELPER).toBe("summarizeDispatchDivergences");
    expect(retirementFailures()).toEqual([]);
  });
});

describe("TC-ATTEMPT-038 the exact count is not the list's length", () => {
  test("25 open reports 25 while returning 20 identifiers", () => {
    const block = summarizeRepositoryDivergences(openDivergences(25), REPOSITORY);
    expect(block.unresolved).toBe(25);
    expect(block.unresolvedIds).toHaveLength(20);
    expect(block.idsTruncated).toBe(true);
    expect(block.reported).toBe(25);
    expect(block.resolved).toBe(0);
  });

  test("below the bound every identifier returns with idsTruncated false", () => {
    const block = summarizeRepositoryDivergences(openDivergences(3), REPOSITORY);
    expect(block.unresolved).toBe(3);
    expect(block.unresolvedIds).toHaveLength(3);
    expect(block.idsTruncated).toBe(false);
  });

  test("the fold reports one identifier open after a resolved-then-open history", () => {
    const block = summarizeRepositoryDivergences(withHistory("DIV-FOLD"), REPOSITORY);
    expect(block.reported).toBe(1);
    expect(block.resolved).toBe(0);
    expect(block.unresolved).toBe(1);
    expect(block.unresolvedIds).toEqual(["DIV-FOLD"]);
  });
});
