/**
 * GH-273 — structural anti-recurrence over the CLI composition source.
 *
 * Parses `packages/cli/src/**\/*.ts` with the TypeScript AST (never text or line
 * numbers) and asserts the two invariants the spec states: exactly one queue
 * repository-binding derivation site that produces a pair-or-absent outcome and
 * never a partial literal (AC-F1-4, TC-BIND-014), exactly one repository-facts
 * resolution per composition (AC-F2-3/NFR-5, TC-BIND-016), and the source
 * allowlist for `repositoryRoot` references (AC-F4-1 source half, TC-BIND-008).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const CLI_SOURCE = join(ROOT, "packages/cli/src");
const PRODUCTION = join(CLI_SOURCE, "production.ts");

const REPOSITORY_ROOT_ALLOWLIST = [
  "packages/cli/src/edge.ts",
  "packages/cli/src/production.ts",
  "packages/core/src/app/queue.ts",
  "packages/core/src/contracts/queue.ts",
] as const;

/** Every `.ts` source file under a directory tree (declarations excluded). */
const listSourceFiles = (directory: string): readonly string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
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

/** The declared property name of an object-literal element, when statically named. */
const propertyName = (element: ts.ObjectLiteralElementLike): string | undefined => {
  if (
    (ts.isPropertyAssignment(element) || ts.isShorthandPropertyAssignment(element)) &&
    element.name !== undefined
  ) {
    const name = element.name;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
      return name.text;
    }
  }
  return undefined;
};

const objectKeys = (literal: ts.ObjectLiteralExpression): readonly string[] =>
  literal.properties.map(propertyName).filter((name): name is string => name !== undefined);

const objectLiteralsWithin = (node: ts.Node): readonly ts.ObjectLiteralExpression[] => {
  const literals: ts.ObjectLiteralExpression[] = [];
  walk(node, (candidate) => {
    if (ts.isObjectLiteralExpression(candidate)) literals.push(candidate);
  });
  return literals;
};

type BindingSite = {
  readonly file: string;
  readonly form: "property-assignment" | "shorthand" | "variable-declaration";
  readonly literals: readonly ts.ObjectLiteralExpression[];
};

/** Every syntactically visible `repositoryBinding` construction/forwarding site. */
const bindingSites = (files: readonly string[]): readonly BindingSite[] => {
  const sites: BindingSite[] = [];
  for (const file of files) {
    const source = parseSource(file);
    walk(source, (node) => {
      if (
        (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) &&
        propertyName(node) === "repositoryBinding"
      ) {
        sites.push({
          file,
          form: ts.isShorthandPropertyAssignment(node) ? "shorthand" : "property-assignment",
          literals: ts.isPropertyAssignment(node) ? objectLiteralsWithin(node.initializer) : [],
        });
        return;
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "repositoryBinding" &&
        node.initializer !== undefined
      ) {
        sites.push({
          file,
          form: "variable-declaration",
          literals: objectLiteralsWithin(node.initializer),
        });
      }
    });
  }
  return sites;
};

/** The pair literals: the only place a complete binding can be constructed. */
const pairLiterals = (files: readonly string[]): readonly { readonly file: string }[] => {
  const found: { readonly file: string }[] = [];
  for (const file of files) {
    const source = parseSource(file);
    walk(source, (node) => {
      if (!ts.isObjectLiteralExpression(node)) return;
      const keys = objectKeys(node);
      if (keys.includes("repository") && keys.includes("repositoryRoot")) found.push({ file });
    });
  }
  return found;
};

const rel = (path: string): string => relative(ROOT, path);

describe("TC-BIND-014 exactly one derivation site, never a partial binding literal", () => {
  const files = listSourceFiles(CLI_SOURCE);

  test("TC-BIND-014 exactly one queue repository-binding construction site exists", () => {
    const sites = bindingSites(files);
    const propertySites = sites.filter((site) => site.form !== "variable-declaration");
    expect(
      propertySites.length,
      `construction sites: ${propertySites
        .map((site) => `${rel(site.file)} (${site.form})`)
        .join(", ")}`,
    ).toBe(1);
    expect(
      rel(propertySites[0]?.file ?? ""),
      "the single construction site lives in production.ts",
    ).toBe("packages/cli/src/production.ts");
    expect(
      sites.filter(
        (site) =>
          site.form === "variable-declaration" &&
          rel(site.file) === "packages/cli/src/production.ts",
      ),
      "the derivation is carried by one production variable",
    ).toHaveLength(1);
  });

  test("TC-BIND-014 the derivation produces one pair literal and no one-sided literal", () => {
    const pair = pairLiterals(files);
    expect(
      pair.length,
      `expected exactly one { repository, repositoryRoot } literal, found ${pair
        .map((entry) => rel(entry.file))
        .join(", ")}`,
    ).toBe(1);
    expect(rel(pair[0]?.file ?? ""), "the pair literal lives in production.ts").toBe(
      "packages/cli/src/production.ts",
    );

    const partials = bindingSites(files).flatMap((site) =>
      site.literals
        .filter((literal) => {
          const keys = objectKeys(literal);
          const hasKey = keys.includes("repository");
          const hasRoot = keys.includes("repositoryRoot");
          return hasKey !== hasRoot;
        })
        .map((literal) => `${rel(site.file)}: { ${objectKeys(literal).join(", ")} }`),
    );
    expect(partials, `one-sided repositoryBinding literal(s): ${partials.join("; ")}`).toEqual([]);
  });

  test("TC-BIND-014 the queue composition is constructed once and shared with lanes", () => {
    const source = parseSource(PRODUCTION);
    const queueCompositions: ts.VariableDeclaration[] = [];
    walk(source, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "queueComposition"
      ) {
        queueCompositions.push(node);
      }
    });
    expect(queueCompositions.length, "one queueComposition construction in production.ts").toBe(1);

    const programOptions: ts.ObjectLiteralExpression[] = [];
    walk(source, (node) => {
      if (
        ts.isObjectLiteralExpression(node) &&
        node.properties.some((element) => propertyName(element) === "queue") &&
        node.properties.some((element) => propertyName(element) === "lanes")
      ) {
        programOptions.push(node);
      }
    });
    expect(programOptions.length, "one options object feeds both queue and lanes").toBe(1);
    const options = programOptions[0];
    const identifierAt = (name: string): string | undefined => {
      const property = options?.properties.find((element) => propertyName(element) === name);
      if (property === undefined || !ts.isPropertyAssignment(property)) return undefined;
      return ts.isIdentifier(property.initializer) ? property.initializer.text : undefined;
    };
    expect(identifierAt("queue"), "the queue option is the queue composition").toBe(
      "queueComposition",
    );
    expect(identifierAt("lanes"), "the lanes option receives the same composition").toBe(
      identifierAt("queue"),
    );
  });
});

describe("TC-BIND-016 one repository-facts resolution per composition", () => {
  test("TC-BIND-016 exactly one readRepositoryFacts call and one findGitRoot call", () => {
    const source = parseSource(PRODUCTION);
    const calls = new Map<string, number>();
    walk(source, (node) => {
      if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
      const name = node.expression.text;
      if (name !== "readRepositoryFacts" && name !== "findGitRoot") return;
      calls.set(name, (calls.get(name) ?? 0) + 1);
    });
    expect(calls.get("readRepositoryFacts") ?? 0, "exactly one repository-facts resolution").toBe(
      1,
    );
    expect(
      calls.get("findGitRoot") ?? 0,
      "the pre-existing single git-root read is unchanged",
    ).toBe(1);
  });
});

describe("TC-BIND-008 the repositoryRoot source allowlist", () => {
  test("TC-BIND-008 repositoryRoot references stay inside the declared files", () => {
    const files = listSourceFiles(join(ROOT, "packages"));
    const referencing = files.filter((file) => {
      let found = false;
      walk(parseSource(file), (node) => {
        if (ts.isIdentifier(node) && node.text === "repositoryRoot") found = true;
      });
      return found;
    });
    const actual = referencing.map(rel).sort();
    const violations = actual.filter(
      (file) => !(REPOSITORY_ROOT_ALLOWLIST as readonly string[]).includes(file),
    );
    expect(
      violations,
      `repositoryRoot disclosure sites outside the allowlist: ${violations.join(", ")}`,
    ).toEqual([]);
    expect(actual, "the allowlist matches the current disclosure sites").toEqual([
      ...REPOSITORY_ROOT_ALLOWLIST,
    ]);
  });
});
