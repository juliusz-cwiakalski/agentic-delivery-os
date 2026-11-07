/**
 * TC-ECON-002 / TC-ECON-084 (static half) — the tier boundaries and the adapter
 * seam hold for the economics surface. Contracts are data-only; domain modules
 * are pure and import only #contracts/local modules; per-harness sourcing lives
 * only in the adapter seam; and the ambient guard reports zero violations over
 * the new domain/config files.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { scan } from "../../scripts/checks/ambient-globals";

const ROOT = process.cwd();

const CONTRACT_FILES = [
  "packages/core/src/contracts/economics.ts",
  "packages/core/src/contracts/harness.ts",
  "packages/core/src/contracts/watchdog.ts",
  "packages/core/src/contracts/error-table.ts",
];
const DOMAIN_FILES = [
  "packages/core/src/domain/economics-budget.ts",
  "packages/core/src/domain/economics-resume.ts",
  "packages/core/src/domain/economics-view.ts",
  "packages/core/src/domain/economics-evidence.ts",
  "packages/core/src/domain/harness-liveness.ts",
];
const CONFIG_FILES = [
  "packages/core/src/config/catalog.ts",
  "packages/core/src/config/defaults.ts",
];
const STATE_FILES = ["packages/core/src/state/economics.ts"];
const CLI_FILES = ["packages/cli/src/commands/watchdog.ts"];
const ADAPTER_FILES = [
  "packages/adapters/src/harness/opencode.ts",
  "packages/adapters/src/harness/claude.ts",
];

const DATA_ONLY = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const importsOf = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

export const domainPurityViolations = (file: string, text: string): string[] => {
  const violations: string[] = [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of source.statements) {
    if (!DATA_ONLY.has(statement.kind)) {
      violations.push(`${file}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  for (const specifier of importsOfText(text)) {
    const allowed =
      specifier.startsWith("#contracts") ||
      specifier.startsWith("./") ||
      specifier.startsWith("#domain/");
    if (!allowed) violations.push(`${file}: disallowed import ${specifier}`);
  }
  for (const token of [
    "Date.now",
    "Math.random",
    "performance.now",
    "process.env",
    "Bun.env",
    "fetch(",
    "setTimeout",
    "setInterval",
    "node:",
    "bun:",
  ]) {
    if (text.includes(token)) violations.push(`${file}: runtime API ${token}`);
  }
  return violations;
};

const importsOfText = (text: string): string[] => {
  const source = ts.createSourceFile(
    "probe.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
};

export const harnessLiteralViolations = (file: string, text: string): string[] => {
  const violations: string[] = [];
  for (const token of [
    'harness === "opencode"',
    'harness === "claude-code"',
    '"opencode"',
    '"claude-code"',
  ]) {
    if (text.includes(token)) violations.push(`${file}: harness-specific branch ${token}`);
  }
  return violations;
};

describe("TC-ECON-002 the economics surface respects the tier boundaries", () => {
  test("contracts modules are data-only and import no runtime specifier", () => {
    for (const file of CONTRACT_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(domainPurityViolations(file, text), file).toEqual([]);
    }
  });

  test("domain modules import only #contracts and local modules and call no runtime API", () => {
    for (const file of DOMAIN_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      const violations = domainPurityViolations(file, text).filter(
        (violation) => !violation.includes("disallowed import #domain/"),
      );
      expect(violations, file).toEqual([]);
      for (const specifier of importsOf(file)) {
        expect(
          specifier.startsWith("#contracts") ||
            specifier.startsWith("./") ||
            specifier.startsWith("#domain/"),
          `${file} imports ${specifier}`,
        ).toBe(true);
      }
    }
  });

  test("the config branch and the state module reuse existing mechanisms", () => {
    for (const file of [...CONFIG_FILES, ...STATE_FILES]) {
      for (const specifier of importsOf(file)) {
        expect(specifier.startsWith("#contracts") || specifier.startsWith("./"), file).toBe(true);
      }
    }
  });

  test("per-harness sourcing lives only in the adapter seam", () => {
    for (const file of [
      ...CONTRACT_FILES,
      ...DOMAIN_FILES,
      ...CONFIG_FILES,
      ...STATE_FILES,
      ...CLI_FILES,
    ]) {
      // The contracts home declares the closed harness-kind vocabulary and the
      // config catalog declares per-harness store paths; no other module may
      // branch on a harness name or carry a harness literal.
      if (
        file === "packages/core/src/contracts/harness.ts" ||
        file.startsWith("packages/core/src/config/")
      ) {
        expect(
          harnessLiteralViolations(file, readFileSync(join(ROOT, file), "utf8")).filter(
            (violation) => violation.includes('harness === "'),
          ),
          file,
        ).toEqual([]);
        continue;
      }
      expect(harnessLiteralViolations(file, readFileSync(join(ROOT, file), "utf8")), file).toEqual(
        [],
      );
    }
    for (const file of ADAPTER_FILES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).toContain("sourcedSignalSources");
    }
  });

  test("the ambient guard reports zero violations over the new neutral-tier files", () => {
    const violations = scan(ROOT);
    expect(violations).toEqual([]);
  });

  test("non-vacuity: node:fs in contracts, Date.now in domain, and a harness branch each fail", () => {
    const economics = readFileSync(join(ROOT, CONTRACT_FILES[0] as string), "utf8");
    const contractsRoot = mkdtempSync(join(tmpdir(), "econ-imports-"));
    try {
      mkdirSync(join(contractsRoot, "packages/core/src/contracts"), { recursive: true });
      writeFileSync(
        join(contractsRoot, "packages/core/src/contracts/probe.ts"),
        `${economics}\nimport "node:fs";\n`,
      );
      expect(
        domainPurityViolations(
          "packages/core/src/contracts/probe.ts",
          `${economics}\nimport "node:fs";\n`,
        ),
      ).toContain("packages/core/src/contracts/probe.ts: runtime API node:");
    } finally {
      rmSync(contractsRoot, { recursive: true, force: true });
    }
    const budget = readFileSync(join(ROOT, DOMAIN_FILES[0] as string), "utf8");
    expect(
      domainPurityViolations(DOMAIN_FILES[0] as string, `${budget}\nconst t = Date.now();\n`),
    ).toContain(`${DOMAIN_FILES[0]}: runtime API Date.now`);
    expect(
      harnessLiteralViolations(
        "packages/core/src/domain/probe.ts",
        'if (harness === "opencode") {}',
      ),
    ).toContain(
      'packages/core/src/domain/probe.ts: harness-specific branch harness === "opencode"',
    );
  });
});
