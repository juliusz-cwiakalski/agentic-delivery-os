/**
 * TC-MCP-010 / TC-MCP-013 / TC-MCP-017 / TC-MCP-018 — the mcp-scoped AST
 * boundary scans.
 *
 * Every scan walks the delivered tree (no hand-picked allowlist at the call
 * site), asserts a non-zero file count, and carries a seeded temp-copy control
 * that fails by name. The serve composition root is the single runtime edge.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SERVE = "packages/mcp/src/serve.ts";
const SPAWN_NAMES = new Set(["spawn", "exec", "execFile", "fork"]);

export type ScanReport = {
  readonly files: readonly string[];
  readonly violations: readonly string[];
};

const listMcpFiles = (root: string): string[] => {
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

/** Scan one mcp source tree for imports, purity, exits, and spawns. */
export const scanMcpTree = (root: string): ScanReport => {
  const files = listMcpFiles(root);
  const violations: string[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const isServe = file === SERVE;
    const report = (node: ts.Node, detail: string): void => {
      violations.push(`${file}:${lineOf(source, node)} ${detail}`);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (
          specifier === "@delivery-os/cli" ||
          specifier.startsWith("@delivery-os/cli/") ||
          specifier.includes("packages/cli") ||
          specifier.includes("/projection") ||
          specifier.startsWith("bun:")
        ) {
          report(node, `forbidden import ${specifier}`);
        }
        if (specifier === "node:child_process") report(node, "forbidden node:child_process import");
        if (specifier === "node:process") report(node, "forbidden node:process import");
        if (specifier.startsWith("node:") && !isServe) {
          report(node, `runtime import ${specifier} outside serve.ts`);
        }
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "Bun" || node.expression.text === "Deno")
      ) {
        report(node, `runtime API ${node.expression.text}.${node.name.text}`);
      }
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "process" &&
        node.name.text === "env" &&
        !isServe
      ) {
        report(node, "ambient process.env read outside serve.ts");
      }
      if (ts.isIdentifier(node) && node.text === "Bun") {
        report(node, "Bun global outside an allowed runtime edge");
      }
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        if (ts.isIdentifier(callee) && SPAWN_NAMES.has(callee.text)) {
          report(node, `spawn call ${callee.text}(`);
        }
      }
      if (ts.isPropertyAssignment(node)) {
        const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(source);
        if (name === "exitCode") report(node, "forbidden exitCode literal");
        if (name === "runId" || name === "timing") report(node, `forbidden envelope key ${name}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { files, violations };
};

const tempTree = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "mcp-imports-"));
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
};

describe("TC-MCP-010/013/017/018 the live mcp tree is clean", () => {
  test("the scan is non-vacuous and reports zero violations", () => {
    const report = scanMcpTree(ROOT);
    expect(report.files.length).toBeGreaterThan(0);
    expect(report.violations).toEqual([]);
  });

  test("no module imports the CLI or the projection", () => {
    const report = scanMcpTree(ROOT);
    expect(
      report.files.filter((file) =>
        readFileSync(join(ROOT, file), "utf8").includes("@delivery-os/cli"),
      ),
    ).toEqual([]);
  });
});

describe("TC-MCP-010/013/017/018 seeded controls fail by name", () => {
  test("a projection import in a temp copy fails", () => {
    const root = tempTree({
      [SERVE]: 'import "../../cli/src/projection";\nexport {};\n',
      "packages/mcp/src/commands/status.ts": 'import "@delivery-os/cli";\nexport {};\n',
    });
    try {
      const report = scanMcpTree(root);
      expect(report.violations.some((entry) => entry.includes("forbidden import"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a node: import in a non-serve module fails", () => {
    const root = tempTree({
      "packages/mcp/src/commands/status.ts":
        'import fs from "node:fs";\nexport const value = fs;\n',
    });
    try {
      const report = scanMcpTree(root);
      expect(report.violations.some((entry) => entry.includes("node:fs outside serve.ts"))).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a Bun.spawn and a spawn call in a temp copy fail", () => {
    const root = tempTree({
      "packages/mcp/src/commands/toolset.ts": "export const run = (): unknown => Bun.spawn([]);\n",
      "packages/mcp/src/commands/gate-report.ts": "export const run = (): unknown => spawn([]);\n",
    });
    try {
      const violations = scanMcpTree(root).violations;
      expect(violations.some((entry) => entry.includes("Bun"))).toBe(true);
      expect(violations.some((entry) => entry.includes("spawn call"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an ambient env read outside serve.ts fails", () => {
    const root = tempTree({
      "packages/mcp/src/commands/status.ts": "export const value = process.env.FIXTURE;\n",
    });
    try {
      const report = scanMcpTree(root);
      expect(report.violations.some((entry) => entry.includes("process.env"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a payload exitCode literal fails", () => {
    const root = tempTree({
      "packages/mcp/src/output/payload.ts": "export const value = { exitCode: 2 };\n",
    });
    try {
      const report = scanMcpTree(root);
      expect(report.violations.some((entry) => entry.includes("exitCode"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
