/**
 * GH-273 — fixture honesty over every composed queue repository binding.
 *
 * Parses `tests/fixtures/**\/*.ts` (files only; no fixture is built, so no
 * `git` spawn) and requires every `repositoryBinding` initializer to be one of
 * the three declared forms — a literal pair, a same-file reference to one, or a
 * `??`/conditional whose fallback operand is one of those (spec F-6, DEC-7;
 * test plan TC-BIND-015, AC-F6-3). The pilot binding's key must be the same
 * identifier its ledger seeds use.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const FIXTURES = join(ROOT, "tests/fixtures");
const PILOT_HARNESS = join(FIXTURES, "pilot/harness.ts");
const QUEUE_CLI_HARNESS = join(FIXTURES, "queue/cli/harness.ts");

const listFixtureFiles = (directory: string): readonly string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFixtureFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files.sort();
};

const parseSource = (path: string): ts.SourceFile =>
  ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const walk = (node: ts.Node, visit: (candidate: ts.Node) => void): void => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

const rel = (path: string): string => relative(ROOT, path);

const staticName = (element: ts.ObjectLiteralElementLike): string | undefined => {
  if (!ts.isPropertyAssignment(element) && !ts.isShorthandPropertyAssignment(element)) {
    return undefined;
  }
  const name = element.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
};

const objectKeys = (literal: ts.ObjectLiteralExpression): readonly string[] =>
  literal.properties.map(staticName).filter((name): name is string => name !== undefined);

const isPairLiteral = (expression: ts.Expression): boolean => {
  const unwrapped = unwrap(expression);
  if (!ts.isObjectLiteralExpression(unwrapped)) return false;
  const keys = objectKeys(unwrapped);
  return keys.length === 2 && keys.includes("repository") && keys.includes("repositoryRoot");
};

const unwrap = (expression: ts.Expression): ts.Expression => {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

/** A same-file identifier (or member) that resolves to a literal pair. */
const resolvesToPair = (source: ts.SourceFile, expression: ts.Expression): boolean => {
  const target = unwrap(expression);
  if (ts.isIdentifier(target)) {
    let found = false;
    walk(source, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === target.text &&
        node.initializer !== undefined &&
        isPairLiteral(node.initializer)
      ) {
        found = true;
      }
    });
    return found;
  }
  if (ts.isPropertyAccessExpression(target) && ts.isIdentifier(target.expression)) {
    const objectName = target.expression.text;
    const propertyName = target.name.text;
    let found = false;
    walk(source, (node) => {
      if (
        !ts.isVariableDeclaration(node) ||
        !ts.isIdentifier(node.name) ||
        node.name.text !== objectName ||
        node.initializer === undefined
      ) {
        return;
      }
      const initializer = unwrap(node.initializer);
      if (!ts.isObjectLiteralExpression(initializer)) return;
      const property = initializer.properties.find(
        (element) => staticName(element) === propertyName,
      );
      if (
        property !== undefined &&
        ts.isPropertyAssignment(property) &&
        isPairLiteral(property.initializer)
      ) {
        found = true;
      }
    });
    return found;
  }
  return false;
};

const isPairExpression = (source: ts.SourceFile, expression: ts.Expression): boolean =>
  isPairLiteral(expression) || resolvesToPair(source, expression);

/** The left of `??` is a caller-supplied override: literal values must be empty or complete. */
const overrideOperandAllowed = (expression: ts.Expression): boolean => {
  const unwrapped = unwrap(expression);
  if (!ts.isObjectLiteralExpression(unwrapped)) return true;
  const keys = objectKeys(unwrapped);
  return keys.length === 0 || isPairLiteral(unwrapped);
};

/** The fixture-syntactic rule over one `repositoryBinding` initializer. */
const acceptedInitializer = (source: ts.SourceFile, expression: ts.Expression): boolean => {
  const target = unwrap(expression);
  if (isPairExpression(source, target)) return true;
  if (
    ts.isBinaryExpression(target) &&
    target.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    return isPairExpression(source, target.right) && overrideOperandAllowed(target.left);
  }
  if (ts.isConditionalExpression(target)) {
    return isPairExpression(source, target.whenTrue);
  }
  return false;
};

type BindingSite = {
  readonly file: string;
  readonly source: ts.SourceFile;
  readonly assignment: ts.PropertyAssignment;
};

const bindingSites = (files: readonly string[]): readonly BindingSite[] => {
  const sites: BindingSite[] = [];
  for (const file of files) {
    const source = parseSource(file);
    walk(source, (node) => {
      if (ts.isPropertyAssignment(node) && staticName(node) === "repositoryBinding") {
        sites.push({ file, source, assignment: node });
      }
    });
  }
  return sites;
};

describe("TC-BIND-015 every fixture composes a pair or nothing", () => {
  const files = listFixtureFiles(FIXTURES);
  const sites = bindingSites(files);

  test("TC-BIND-015 the fixture corpus composes at least one binding", () => {
    expect(sites.length, "the fixture corpus exercises the rule").toBeGreaterThan(0);
  });

  for (const site of sites) {
    test(`TC-BIND-015 ${rel(site.file)} accepts its repositoryBinding form`, () => {
      expect(
        acceptedInitializer(site.source, site.assignment.initializer),
        `${rel(site.file)}: repositoryBinding must be a literal pair, a same-file pair reference, or a ??/conditional fallback to one`,
      ).toBe(true);
    });
  }

  test("TC-BIND-015 no fixture assigns a one-field binding literal", () => {
    const violations = sites.flatMap((site) => {
      const initializer = unwrap(site.assignment.initializer);
      if (!ts.isObjectLiteralExpression(initializer)) return [];
      const keys = objectKeys(initializer);
      const hasKey = keys.includes("repository");
      const hasRoot = keys.includes("repositoryRoot");
      return hasKey !== hasRoot ? [`${rel(site.file)}: { ${keys.join(", ")} }`] : [];
    });
    expect(violations, `one-field fixture bindings: ${violations.join("; ")}`).toEqual([]);
  });

  test("TC-BIND-015 the pilot binding uses the same identifier as its ledger seeds", () => {
    const source = parseSource(PILOT_HARNESS);
    const binding = bindingSites([PILOT_HARNESS])[0]?.assignment.initializer;
    if (binding === undefined) throw new Error("the pilot harness composes no repositoryBinding");
    const literal = unwrap(binding);
    if (!ts.isObjectLiteralExpression(literal)) {
      throw new Error("the pilot repositoryBinding is not a literal pair");
    }
    const keyProperty = literal.properties.find((element) => staticName(element) === "repository");
    if (keyProperty === undefined || !ts.isPropertyAssignment(keyProperty)) {
      throw new Error("the pilot repositoryBinding carries no repository key");
    }
    if (!ts.isIdentifier(keyProperty.initializer)) {
      throw new Error("the pilot binding key is not an identifier");
    }
    const pilotKey = keyProperty.initializer.text;

    // Every statically visible `repository: <identifier>` in the pilot harness
    // (the binding and the ledger seeds) must name the same identifier.
    const identifiers: string[] = [];
    walk(source, (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        staticName(node) === "repository" &&
        ts.isIdentifier(node.initializer)
      ) {
        identifiers.push(node.initializer.text);
      }
    });
    expect(identifiers.length, "the pilot harness declares binding and seeds").toBeGreaterThan(1);
    for (const identifier of identifiers) {
      expect(identifier, "the pilot binding key matches every ledger seed").toBe(pilotKey);
    }
  });

  test("TC-BIND-015 the unchanged queue CLI harness default stays a pair", () => {
    const source = parseSource(QUEUE_CLI_HARNESS);
    const site = bindingSites([QUEUE_CLI_HARNESS])[0];
    if (site === undefined) throw new Error("the queue CLI harness composes no repositoryBinding");
    const initializer = unwrap(site.assignment.initializer);
    expect(
      ts.isBinaryExpression(initializer) &&
        initializer.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken,
      "the queue CLI harness keeps the fallback form",
    ).toBe(true);
    expect(
      acceptedInitializer(source, site.assignment.initializer),
      "the ?? fallback pair is accepted without editing the untouched fixture",
    ).toBe(true);
  });
});
