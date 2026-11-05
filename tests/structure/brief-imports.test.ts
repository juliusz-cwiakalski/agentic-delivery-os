/**
 * TC-BRIEF-003 — render-path boundaries: data-only contracts, pure domain,
 * core-only command imports, no model/network capability, and no new subpath.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { SECRET_READ_ALLOWLIST } from "../../scripts/checks/secret-read-boundary";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/brief.ts";
const DOMAIN = "packages/core/src/domain/brief.ts";
const COMMAND = "packages/cli/src/commands/brief.ts";
const EDGE = "packages/cli/src/edge.ts";
const RENDER_PATH = [CONTRACT, DOMAIN, COMMAND, EDGE];
const RUNTIME_SPECIFIERS = ["node:", "bun:"];
const MODEL_SPECIFIERS = ["openai", "anthropic", "@anthropic-ai/", "langchain", "ollama", "undici"];
const NETWORK_SPECIFIERS = [
  "node:http",
  "node:https",
  "node:net",
  "node:dns",
  "node:child_process",
];

const parse = (path: string, text: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const specifiersOf = (source: ts.SourceFile): string[] => {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument !== undefined && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const callNames = (source: ts.SourceFile): string[] => {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) names.push(node.expression.text);
      if (ts.isPropertyAccessExpression(node.expression)) {
        names.push(`${node.expression.expression.getText(source)}.${node.expression.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

const DATA_ONLY = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const contractsDataOnly = (text: string, label = CONTRACT): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!DATA_ONLY.has(statement.kind)) {
      violations.push(`${label}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  for (const specifier of specifiersOf(source)) {
    if (RUNTIME_SPECIFIERS.some((prefix) => specifier.startsWith(prefix))) {
      violations.push(`${label}: runtime import ${specifier}`);
    }
  }
  return violations;
};

const domainPure = (text: string, label = DOMAIN): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "#contracts" || specifier.startsWith("#domain/") || specifier.startsWith("./");
    if (!allowed) violations.push(`${label}: domain import ${specifier}`);
  }
  for (const name of callNames(source)) {
    if (
      [
        "Date.now",
        "Math.random",
        "performance.now",
        "process.env",
        "Bun.env",
        "fetch",
        "readFileSync",
      ].includes(name)
    ) {
      violations.push(`${label}: impure call ${name}`);
    }
  }
  return violations;
};

const commandCoreOnly = (text: string, label = COMMAND): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "@delivery-os/core" ||
      specifier === "@delivery-os/core/contracts" ||
      specifier.startsWith("./") ||
      specifier.startsWith("../");
    if (!allowed) violations.push(`${label}: non-core command import ${specifier}`);
  }
  return violations;
};

const capabilityViolations = (text: string, label: string): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    if (NETWORK_SPECIFIERS.some((banned) => specifier === banned)) {
      violations.push(`${label}: network capability ${specifier}`);
    }
    if (MODEL_SPECIFIERS.some((banned) => specifier === banned || specifier.startsWith(banned))) {
      violations.push(`${label}: model capability ${specifier}`);
    }
  }
  if (callNames(source).includes("fetch")) violations.push(`${label}: fetch call`);
  return violations;
};

const brandLiteralViolations = (text: string, label: string): string[] => {
  const seeds = ["a" + "dos", "A" + "DOS_", "~/" + "." + "ad" + "os"];
  return seeds
    .filter((seed) => text.includes(seed))
    .map((seed) => `${label}: product literal ${seed}`);
};

describe("TC-BRIEF-003 render-path boundaries", () => {
  test("the brief contracts module is data-only with no runtime import", () => {
    expect(contractsDataOnly(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
  });

  test("the brief domain module is pure", () => {
    expect(domainPure(readFileSync(join(ROOT, DOMAIN), "utf8"))).toEqual([]);
  });

  test("the brief command imports only core and relative modules", () => {
    expect(commandCoreOnly(readFileSync(join(ROOT, COMMAND), "utf8"))).toEqual([]);
  });

  test("the render path has no model or network capability", () => {
    let scanned = 0;
    for (const path of RENDER_PATH) {
      const text = readFileSync(join(ROOT, path), "utf8");
      expect(capabilityViolations(text, path)).toEqual([]);
      scanned += 1;
    }
    expect(scanned).toBe(RENDER_PATH.length);
    expect(scanned).toBeGreaterThan(0);
  });

  test("seeded model, network, and fetch controls fail by name", () => {
    expect(capabilityViolations('import "node:http";', "probe.ts").length).toBeGreaterThan(0);
    expect(capabilityViolations('import "openai";', "probe.ts").length).toBeGreaterThan(0);
    expect(
      capabilityViolations('const value = fetch("https://example.test");', "probe.ts"),
    ).toContain("probe.ts: fetch call");
  });

  test("no product literal appears in the render path", () => {
    for (const path of [CONTRACT, DOMAIN, COMMAND]) {
      expect(brandLiteralViolations(readFileSync(join(ROOT, path), "utf8"), path)).toEqual([]);
    }
  });

  test("no new runtime dependency or subpath is declared", () => {
    const cli = JSON.parse(readFileSync(join(ROOT, "packages/cli/package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(cli.dependencies).sort()).toEqual([
      "@delivery-os/adapters",
      "@delivery-os/core",
    ]);
    const core = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(Object.keys(core.exports).sort()).toEqual([
      ".",
      "./branding",
      "./contracts",
      "./provider",
      "./state",
    ]);
  });

  test("the secret-read allowlist is unchanged and names no brief file", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(4);
    const paths = SECRET_READ_ALLOWLIST.map((entry) => entry.path);
    for (const file of [CONTRACT, DOMAIN, COMMAND]) {
      expect(paths.some((path) => path.includes(file.replace("packages/", "")))).toBe(false);
    }
  });
});
