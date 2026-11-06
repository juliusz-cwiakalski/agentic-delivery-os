/**
 * TC-MCP-001 / TC-MCP-002 / TC-MCP-010 / TC-MCP-015 — the closed branding-
 * projected catalog, the payload boundary, and the committed tool-list snapshot.
 *
 * The catalog is the registration site: exactly the three canonical primitive
 * IDs, no fourth tool, no batch or mutating capability. The snapshot is read
 * only and its mtime is asserted unchanged.
 */
import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import {
  CANONICAL_TOOL_IDS,
  describeTools,
  type ToolDescriptor,
} from "../../packages/mcp/src/commands/catalog";
import { createToolset } from "../../packages/mcp/src/index";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "tests/fixtures/mcp/tool-list.snapshot.json");
const SECOND_BRAND = {
  ...SYNTHETIC_BRAND,
  productName: "renamed-product",
  binaryName: "renamed-product",
  mcpToolPrefix: "renamed-product_",
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
};

const canonicalJson = (value: unknown): string => JSON.stringify(canonical(value));

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
  walk("packages/mcp/src");
  return results.sort();
};

type CatalogRegistration = { readonly file: string; readonly ids: readonly string[] };

/** Locate every canonical catalog registration in one source file. */
export const catalogRegistrations = (file: string, text: string): CatalogRegistration[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const registrations: CatalogRegistration[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const isCatalogName = node.name.text === "CANONICAL_TOOL_IDS";
      let initializer: ts.Expression | undefined = node.initializer;
      while (
        initializer !== undefined &&
        (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer))
      ) {
        initializer = initializer.expression;
      }
      if (isCatalogName && initializer !== undefined && ts.isArrayLiteralExpression(initializer)) {
        const ids = initializer.elements.filter(ts.isStringLiteral).map((element) => element.text);
        registrations.push({ file, ids });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return registrations;
};

/** The catalogue closure check over a tree; a fourth id fails by name. */
export const registrationViolations = (root: string): string[] => {
  const failures: string[] = [];
  const registrations = listTypeScriptFiles(root).flatMap((file) =>
    catalogRegistrations(file, readFileSync(join(root, file), "utf8")),
  );
  if (registrations.length !== 1) {
    failures.push(
      `catalog has ${registrations.length} registration sites; exactly one is required`,
    );
  }
  for (const registration of registrations) {
    const actual = JSON.stringify([...registration.ids]);
    const expected = JSON.stringify([...CANONICAL_TOOL_IDS]);
    if (actual !== expected) {
      failures.push(
        `${registration.file}: catalog [${registration.ids.join(", ")}] is not [${CANONICAL_TOOL_IDS.join(", ")}]`,
      );
    }
  }
  return failures;
};

const FORBIDDEN_CAPABILITIES = ["batch", "write", "apply", "mutate", "merge", "delete", "commit"];

const descriptorNames = (tools: readonly ToolDescriptor[]): readonly string[] =>
  tools.map((tool) => tool.name);

describe("TC-MCP-001 the catalog is closed and branding-projected", () => {
  test("the canonical primitive-ID list is exactly the three pinned ids", () => {
    expect([...CANONICAL_TOOL_IDS]).toEqual(["status", "verify-artifact", "gate-report"]);
  });

  test("listTools projects exactly three descriptors with the brand prefix", () => {
    const tools = createToolset({ brand: SYNTHETIC_BRAND }).listTools();
    expect(tools).toHaveLength(3);
    expect(tools.map((tool) => tool.name)).toEqual([
      `${SYNTHETIC_BRAND.mcpToolPrefix}status`,
      `${SYNTHETIC_BRAND.mcpToolPrefix}verify-artifact`,
      `${SYNTHETIC_BRAND.mcpToolPrefix}gate-report`,
    ]);
    for (const tool of tools) {
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  test("status declares no required parameter; ref tools declare exactly one", () => {
    const tools = createToolset({ brand: SYNTHETIC_BRAND }).listTools();
    const status = tools.find((tool) => tool.name.endsWith("status"));
    expect(status?.inputSchema.required).toEqual([]);
    expect(status?.inputSchema.additionalProperties).toBe(false);
    for (const suffix of ["verify-artifact", "gate-report"]) {
      const tool = tools.find((entry) => entry.name.endsWith(suffix));
      expect(tool?.inputSchema.required).toEqual(["ref"]);
      expect(tool?.inputSchema.additionalProperties).toBe(false);
      expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual(["ref"]);
    }
  });

  test("no descriptor names a batch or mutating capability", () => {
    const tools = createToolset({ brand: SYNTHETIC_BRAND }).listTools();
    const names = descriptorNames(tools).join(" ");
    const parameters = tools.flatMap((tool) => Object.keys(tool.inputSchema.properties)).join(" ");
    for (const capability of FORBIDDEN_CAPABILITIES) {
      expect(names.toLowerCase()).not.toContain(capability);
      expect(parameters.toLowerCase()).not.toContain(capability);
    }
  });

  test("the concrete registration site declares the closed list", () => {
    expect(registrationViolations(ROOT)).toEqual([]);
  });

  test("a seeded fourth catalog entry fails naming the file", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-catalog-mutant-"));
    try {
      const relative = "packages/mcp/src/commands/catalog.ts";
      const path = join(root, relative);
      mkdirSync(dirname(path), { recursive: true });
      const source = readFileSync(join(ROOT, relative), "utf8").replace(
        '"gate-report"] as const',
        '"gate-report", "batch"] as const',
      );
      writeFileSync(path, source);
      const failures = registrationViolations(root);
      expect(failures.some((message) => message.includes(relative))).toBe(true);
      expect(failures.some((message) => message.includes("batch"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-MCP-015 branding projection and the committed snapshot", () => {
  test("names are the prefix + id; descriptions and schemas are brand-invariant", () => {
    const brandA = createToolset({ brand: SYNTHETIC_BRAND }).listTools();
    const brandB = createToolset({ brand: SECOND_BRAND }).listTools();
    expect(brandA).toHaveLength(brandB.length);
    for (let index = 0; index < brandA.length; index += 1) {
      const first = brandA[index] as ToolDescriptor;
      const second = brandB[index] as ToolDescriptor;
      expect(first.name).toBe(`${SYNTHETIC_BRAND.mcpToolPrefix}${CANONICAL_TOOL_IDS[index]}`);
      expect(second.name).toBe(`${SECOND_BRAND.mcpToolPrefix}${CANONICAL_TOOL_IDS[index]}`);
      expect(first.description).toBe(second.description);
      expect(canonicalJson(first.inputSchema)).toBe(canonicalJson(second.inputSchema));
    }
  });

  test("the canonical list equals the committed snapshot and leaves it untouched", () => {
    const before = statSync(SNAPSHOT).mtimeMs;
    const tools = createToolset({ brand: SYNTHETIC_BRAND }).listTools();
    const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as unknown;
    expect(canonicalJson(tools)).toBe(canonicalJson(snapshot));
    expect(statSync(SNAPSHOT).mtimeMs).toBe(before);
  });

  test("a mutated descriptor fails the snapshot comparison", () => {
    const tools = createToolset({ brand: SYNTHETIC_BRAND }).listTools();
    const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as ToolDescriptor[];
    const mutated = JSON.parse(JSON.stringify(snapshot)) as ToolDescriptor[];
    (mutated[0] as { description: string }).description = "changed one field";
    expect(canonicalJson(tools)).not.toBe(canonicalJson(mutated));
  });

  test("the package root exposes the same pure toolset seam", () => {
    const fromRoot = createToolset({ brand: SYNTHETIC_BRAND }).listTools();
    const fromCatalog = describeTools(SYNTHETIC_BRAND);
    expect(canonicalJson(fromRoot)).toBe(canonicalJson(fromCatalog));
  });
});
