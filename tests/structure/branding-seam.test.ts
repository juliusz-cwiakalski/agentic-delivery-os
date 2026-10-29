/**
 * TC-BRANDING-021 — no name-derived value is constructed outside the resolver
 * and no working-name literal or default is committed.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const BRANDING_DIR = "packages/core/src/branding/";
const CONTRACTS_DIR = "packages/core/src/contracts/";
const FIELDS = [
  "productName",
  "binaryName",
  "packageScope",
  "environmentPrefix",
  "configDirectoryName",
  "stateDirectoryName",
  "mcpToolPrefix",
  "telemetryNamespace",
  "docsBaseUrl",
  "repositoryUrl",
  "releaseAssetPrefix",
  "installPath",
] as const;
const SYNTHETIC_NAMES = [".renamed-product", ".alt-brand", ".synthetic", "example-product"];
const OVERRIDE_VARIABLE = "DELIVERY_OS_WORKING_NAME";

const listTypeScriptFiles = (root: string): string[] => {
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
  walk("packages");
  return results.sort();
};

const parseFile = (root: string, relative: string): ts.SourceFile =>
  ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const propertyText = (name: ts.PropertyName | undefined, source: ts.SourceFile): string => {
  if (!name) return "";
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text;
  return name.getText(source);
};

const isStringLiteralInitializer = (node: ts.Expression | undefined): boolean =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));

const exportedStringConstants = (source: ts.SourceFile): string[] => {
  const names: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const exported = (statement.modifiers ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        isStringLiteralInitializer(declaration.initializer)
      ) {
        names.push(declaration.name.text);
      }
    }
  }
  return names;
};

const fieldLiterals = (source: ts.SourceFile): string[] => {
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && isStringLiteralInitializer(node.initializer)) {
      const name = propertyText(node.name, source);
      if ((FIELDS as readonly string[]).includes(name)) findings.push(name);
    }
    if (ts.isVariableDeclaration(node) && isStringLiteralInitializer(node.initializer)) {
      const name = propertyText(node.name, source);
      if ((FIELDS as readonly string[]).includes(name)) findings.push(name);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
};

const brandShapedLiterals = (source: ts.SourceFile): number => {
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Set(
        node.properties
          .filter(ts.isPropertyAssignment)
          .map((entry) => propertyText(entry.name, source)),
      );
      if (FIELDS.every((field) => properties.has(field))) count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
};

const resolverParameterFailures = (root: string): string[] => {
  const file = `${BRANDING_DIR}index.ts`;
  const source = parseFile(root, file);
  const failures: string[] = [];
  const resolver = source.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "resolveBrandIdentity",
  );
  if (!resolver) return [`${file}: missing resolveBrandIdentity declaration`];
  if (resolver.parameters.length !== 1) {
    failures.push(`${file}: resolveBrandIdentity must take exactly one input parameter`);
  }
  for (const parameter of resolver.parameters) {
    if (parameter.initializer !== undefined) {
      failures.push(`${file}: resolver parameter must not have a default value`);
    }
    if (!ts.isIdentifier(parameter.name) || parameter.name.text !== "input") {
      failures.push(`${file}: resolver parameter must be the ResolverInput object`);
    }
  }
  const resolverInput = source.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === "ResolverInput",
  );
  if (!resolverInput || !ts.isTypeLiteralNode(resolverInput.type)) {
    failures.push(`${file}: ResolverInput type alias is required`);
  } else {
    for (const member of resolverInput.type.members) {
      if (!ts.isPropertySignature(member)) continue;
      const name = propertyText(member.name, source);
      if (name === "workingName" && member.questionToken !== undefined) {
        failures.push(`${file}: workingName must not be optional`);
      }
      if (name === "workingName" && member.type?.kind !== ts.SyntaxKind.StringKeyword) {
        failures.push(`${file}: workingName must be a string`);
      }
    }
  }
  return failures;
};

export const validateSeam = (root: string): string[] => {
  const failures: string[] = [...resolverParameterFailures(root)];
  const brandingFile = `${BRANDING_DIR}index.ts`;
  const brandingText = readFileSync(join(root, brandingFile), "utf8");
  if (brandingText.includes(OVERRIDE_VARIABLE)) {
    failures.push(`${brandingFile}: branding must not mention ${OVERRIDE_VARIABLE}`);
  }
  for (const name of SYNTHETIC_NAMES) {
    if (brandingText.includes(name)) {
      failures.push(`${brandingFile}: committed fixture name ${name} must not appear in branding`);
    }
  }
  for (const file of listTypeScriptFiles(root)) {
    const source = parseFile(root, file);
    for (const constant of exportedStringConstants(source)) {
      failures.push(`${file}: exported module-level string constant ${constant} is not permitted`);
    }
    if (!file.startsWith(BRANDING_DIR)) {
      for (const field of fieldLiterals(source)) {
        failures.push(
          `${file}: field ${field} is assigned a string literal outside branding/contracts`,
        );
      }
      const shaped = brandShapedLiterals(source);
      if (shaped > 0 && !file.startsWith(CONTRACTS_DIR)) {
        failures.push(
          `${file}: BrandIdentity-shaped object literal is constructed outside branding`,
        );
      }
    }
  }
  return failures;
};

const makeTempRoot = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "branding-seam-"));
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
};

describe("branding seam integrity", () => {
  test("the live tree derives names only through the resolver", () => {
    expect(validateSeam(ROOT)).toEqual([]);
  });

  test("the resolver has no default parameter and no committed default name", () => {
    const source = readFileSync(join(ROOT, `${BRANDING_DIR}index.ts`), "utf8");
    expect(source).not.toMatch(/workingName\s*=\s*["']/);
    expect(source).not.toMatch(/=\s*["']\.?(renamed-product|alt-brand|synthetic|example-product)/);
  });

  test("an exported product constant in a surface package fails by name", () => {
    const root = makeTempRoot({
      [`${BRANDING_DIR}index.ts`]: readFileSync(join(ROOT, `${BRANDING_DIR}index.ts`), "utf8"),
      "packages/cli/src/index.ts": 'export const PRODUCT_NAME = "example-product";\n',
    });
    try {
      const failures = validateSeam(root);
      expect(failures.some((message) => message.includes("PRODUCT_NAME"))).toBe(true);
      expect(failures.some((message) => message.includes("packages/cli/src/index.ts"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a twelve-field object literal outside branding fails by name", () => {
    const literal = `export const identity = {\n${FIELDS.map((field) => `  ${field}: "x",`).join("\n")}\n};\n`;
    const root = makeTempRoot({
      [`${BRANDING_DIR}index.ts`]: readFileSync(join(ROOT, `${BRANDING_DIR}index.ts`), "utf8"),
      "packages/core/src/domain/index.ts": literal,
    });
    try {
      const failures = validateSeam(root);
      expect(
        failures.some((message) => message.includes("packages/core/src/domain/index.ts")),
      ).toBe(true);
      expect(failures.some((message) => message.includes("BrandIdentity-shaped"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a single field literal outside branding fails by name", () => {
    const root = makeTempRoot({
      [`${BRANDING_DIR}index.ts`]: readFileSync(join(ROOT, `${BRANDING_DIR}index.ts`), "utf8"),
      "packages/core/src/domain/index.ts":
        'export const value = { productName: "example-product" };\n',
    });
    try {
      const failures = validateSeam(root);
      expect(failures.some((message) => message.includes("productName"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
