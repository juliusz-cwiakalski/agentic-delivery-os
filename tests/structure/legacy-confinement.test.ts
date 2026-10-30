/**
 * TC-BRANDING-016 / 017 / 018 — the legacy adapter never imports branding, no
 * new pre-freeze-prefixed variable is introduced, and its literals are confined
 * to the reviewed legacy inventory.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import { readRegistry, scan } from "../../scripts/checks/forbidden-literals";

const ROOT = process.cwd();
const ADAPTER = "packages/adapters/src/legacy/index.ts";
const BRANDING = "packages/core/src/branding/index.ts";
const OVERRIDE_VARIABLE = "DELIVERY_OS_WORKING_NAME";
const INVENTORY = "tests/fixtures/legacy/literal-inventory.json";

const listTypeScriptFiles = (root: string, relativeDir: string): string[] => {
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
  walk(relativeDir);
  return results.sort();
};

const parse = (root: string, relative: string): ts.SourceFile =>
  ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const importFailures = (root: string): string[] => {
  const failures: string[] = [];
  const source = parse(root, ADAPTER);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const specifier = statement.moduleSpecifier.text;
    if (specifier.includes("branding")) {
      failures.push(`${ADAPTER}: must not import branding (found ${specifier})`);
    }
    if (specifier.startsWith("@delivery-os/")) {
      failures.push(`${ADAPTER}: must not import a workspace package (found ${specifier})`);
    }
  }
  return failures;
};

const scopeFiles = (root: string): string[] => {
  const registry = (() => {
    try {
      return readRegistry(root);
    } catch {
      return readRegistry(ROOT);
    }
  })();
  const files = new Set<string>();
  for (const entry of registry.scopeClasses) {
    for (const file of entry.files ?? []) files.add(file);
  }
  for (const file of listTypeScriptFiles(root, "packages")) files.add(file);
  for (const relative of [".gitignore"]) {
    if (readFileSafe(root, relative) !== undefined) files.add(relative);
  }
  const workflows = join(root, ".github/workflows");
  try {
    for (const entry of readdirSync(workflows)) {
      if (entry.endsWith(".yml") || entry.endsWith(".yaml"))
        files.add(`.github/workflows/${entry}`);
    }
  } catch {
    // No workflow directory in a mutation fixture.
  }
  for (const doc of registry.registered) files.add(doc);
  return [...files].sort();
};

const readFileSafe = (root: string, relative: string): string | undefined => {
  try {
    return readFileSync(join(root, relative), "utf8");
  } catch {
    return undefined;
  }
};

export const newVariableFailures = (root: string): string[] => {
  const failures: string[] = [];
  for (const file of scopeFiles(root)) {
    if (file.startsWith("packages/adapters/src/legacy/")) continue;
    const content = readFileSafe(root, file);
    if (content === undefined) continue;
    if (content.includes("ADOS_")) {
      failures.push(`${file}: legacy-prefixed variable outside the legacy adapter`);
    }
  }
  for (const file of [BRANDING, ADAPTER]) {
    const content = readFileSafe(root, file);
    if (content?.includes(OVERRIDE_VARIABLE)) {
      failures.push(`${file}: ${OVERRIDE_VARIABLE} must be owned by the runtime-aware edge`);
    }
  }
  if (OVERRIDE_VARIABLE.startsWith("ADOS_")) {
    failures.push(`${OVERRIDE_VARIABLE}: the override must not be legacy-prefixed`);
  }
  return failures;
};

const literalInventory = (root: string): string[] => {
  const inventory = JSON.parse(readFileSync(join(ROOT, INVENTORY), "utf8")) as {
    legacyLiterals: string[];
    diagnosticLiterals: string[];
    structuralLiterals: string[];
  };
  const allowed = new Set([
    ...inventory.legacyLiterals,
    ...inventory.diagnosticLiterals,
    ...inventory.structuralLiterals,
  ]);
  const failures: string[] = [];
  const visit = (node: ts.Node): void => {
    const isModuleSpecifier =
      ts.isImportDeclaration(node.parent ?? node) && node.parent?.moduleSpecifier === node;
    if (!isModuleSpecifier && ts.isStringLiteral(node) && !allowed.has(node.text)) {
      failures.push(
        `${ADAPTER}: literal ${JSON.stringify(node.text)} is not in the reviewed inventory`,
      );
    }
    if (
      !isModuleSpecifier &&
      (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) &&
      !allowed.has(node.text)
    ) {
      failures.push(
        `${ADAPTER}: literal ${JSON.stringify(node.text)} is not in the reviewed inventory`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(root, ADAPTER));
  return failures;
};

const makeTempFile = (relative: string, content: string): string => {
  const root = mkdtempSync(join(tmpdir(), "legacy-confinement-"));
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return root;
};

describe("legacy adapter confinement", () => {
  test("the live adapter imports no branding and no workspace package", () => {
    expect(importFailures(ROOT)).toEqual([]);
  });

  test("no new pre-freeze-prefixed variable exists outside the adapter", () => {
    expect(newVariableFailures(ROOT)).toEqual([]);
  });

  test("the adapter literal inventory is confined", () => {
    expect(literalInventory(ROOT)).toEqual([]);
  });

  test("the full scan stays green over the allowlisted adapter subpath", () => {
    const outcome = scan(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(
      outcome.violations.some((violation) =>
        violation.file.startsWith("packages/adapters/src/legacy/"),
      ),
    ).toBe(false);
  });

  test("a branding import added in a temp copy fails by name", () => {
    const adapter = readFileSync(join(ROOT, ADAPTER), "utf8");
    const root = makeTempFile(ADAPTER, `import "@delivery-os/core/branding";\n${adapter}`);
    try {
      expect(importFailures(root).some((message) => message.includes("branding"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a legacy-prefixed read in a surface package fails by name", () => {
    const root = makeTempFile(
      "packages/cli/src/index.ts",
      "export const value = process.env.ADOS_NEW;\n",
    );
    try {
      expect(
        newVariableFailures(root).some((message) => message.includes("packages/cli/src/index.ts")),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a synthetic non-legacy literal fails the inventory", () => {
    const adapter = readFileSync(join(ROOT, ADAPTER), "utf8");
    const root = makeTempFile(ADAPTER, `${adapter}\nexport const candidate = "candidate-brand";\n`);
    try {
      expect(literalInventory(root).some((message) => message.includes("candidate-brand"))).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
