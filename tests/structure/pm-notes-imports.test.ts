/**
 * TC-BOUND-001 (completion) — tier, purity, runtime confinement, and literal
 * gates for every GH-179 module.
 *
 * Each rule is exercised by a failing fixture and a clean control, and the
 * fixture-coverage meta-check fails when a rule loses its failing fixture. The
 * production modules are scanned with the same detectors; the ambient guard and
 * the exit-code-literal scan are re-asserted over the new paths.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { scan as scanAmbient, scopedFiles } from "../../scripts/checks/ambient-globals";
import { scanRoot as scanExitLiterals } from "../../scripts/checks/exit-code-literals";

const ROOT = process.cwd();

const CONTRACTS_PM_NOTES = "packages/core/src/contracts/pm-notes.ts";
const CONTRACTS_REGISTRY = "packages/core/src/contracts/registry.ts";
const DOMAIN_RULES = "packages/core/src/domain/pm-notes-lint.ts";
const STATE_REGISTRY = "packages/core/src/state/registry.ts";
const ADAPTER_PARSER = "packages/adapters/src/file/pm-notes-parser.ts";
const COMMAND_LINT = "packages/cli/src/commands/lint.ts";
const COMMAND_PHASE = "packages/cli/src/commands/phase.ts";

const GH179_MODULES = [
  CONTRACTS_PM_NOTES,
  CONTRACTS_REGISTRY,
  DOMAIN_RULES,
  STATE_REGISTRY,
  ADAPTER_PARSER,
  COMMAND_LINT,
  COMMAND_PHASE,
] as const;

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

const CONTRACT_STATEMENTS = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const contractsDataOnly = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!CONTRACT_STATEMENTS.has(statement.kind)) {
      violations.push(`executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  for (const specifier of specifiersOf(source)) {
    if (specifier.startsWith("node:") || specifier.startsWith("bun:")) {
      violations.push(`runtime import ${specifier}`);
    }
  }
  return violations;
};

const domainPure = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "#contracts" || specifier.startsWith("#domain/") || specifier.startsWith("./");
    if (!allowed) violations.push(`domain import ${specifier}`);
  }
  for (const name of callNames(source)) {
    if (
      ["parseDocument", "parseAllDocuments", "readFileSync", "stagePmNotesPhaseEntry"].includes(
        name,
      )
    ) {
      violations.push(`parser or I/O call ${name}`);
    }
  }
  return violations;
};

const stateContractsOnly = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const own = specifier.startsWith("./") || specifier.startsWith("../");
    if (specifier !== "#contracts" && !own) violations.push(`state import ${specifier}`);
  }
  return violations;
};

const handlerNoIo = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    if (
      specifier.startsWith("node:") ||
      specifier.startsWith("bun:") ||
      specifier.startsWith("@delivery-os/adapters") ||
      specifier.endsWith("/edge.js") ||
      specifier === "../edge.js"
    ) {
      violations.push(`command import ${specifier}`);
    }
  }
  for (const name of callNames(source)) {
    if (
      name === "console.log" ||
      name === "console.error" ||
      name === "process.exit" ||
      name.endsWith(".write") ||
      name.endsWith(".exit")
    ) {
      violations.push(`handler I/O call ${name}`);
    }
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "exitCode"
    ) {
      if (ts.isNumericLiteral(node.initializer)) violations.push("exit code literal");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

const adapterIoSubpath = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    if (
      specifier === "@delivery-os/cli" ||
      specifier === "@delivery-os/opencode" ||
      specifier === "@delivery-os/mcp"
    ) {
      violations.push(`adapter imports a surface ${specifier}`);
    }
  }
  return violations;
};

export type RuleFixture = {
  readonly id: string;
  readonly expect: "violation" | "clean";
  readonly source: string;
};

type Detector = {
  readonly id: string;
  readonly modules: readonly string[];
  readonly scan: (source: ts.SourceFile) => string[];
  readonly fixtures: readonly RuleFixture[];
};

const DETECTORS: readonly Detector[] = [
  {
    id: "contracts-data-only",
    modules: [CONTRACTS_PM_NOTES, CONTRACTS_REGISTRY],
    scan: contractsDataOnly,
    fixtures: [
      {
        id: "contracts-executable",
        expect: "violation",
        source: "export function helper(): number { return 1; }\n",
      },
      {
        id: "contracts-runtime-import",
        expect: "violation",
        source: 'import fs from "node:fs";\n',
      },
      {
        id: "contracts-clean",
        expect: "clean",
        source:
          'export const VALUES = ["a", "b"] as const;\nexport type Value = (typeof VALUES)[number];\n',
      },
    ],
  },
  {
    id: "domain-pure",
    modules: [DOMAIN_RULES],
    scan: domainPure,
    fixtures: [
      {
        id: "domain-foreign-import",
        expect: "violation",
        source: 'import "#config/resolver";\n',
      },
      {
        id: "domain-parser-call",
        expect: "violation",
        source:
          'import { parseDocument } from "yaml";\nexport const parse = (text: string) => parseDocument(text);\n',
      },
      {
        id: "domain-clean",
        expect: "clean",
        source:
          'import type { PmNotesParseOutcome } from "#contracts";\nexport type Verdict = { readonly ok: boolean };\n',
      },
    ],
  },
  {
    id: "state-contracts-only",
    modules: [STATE_REGISTRY],
    scan: stateContractsOnly,
    fixtures: [
      {
        id: "state-foreign-import",
        expect: "violation",
        source: 'import "@delivery-os/adapters/file";\n',
      },
      {
        id: "state-runtime-import",
        expect: "violation",
        source: 'import fs from "node:fs";\n',
      },
      {
        id: "state-clean",
        expect: "clean",
        source: 'export * from "./ledger.js";\n',
      },
    ],
  },
  {
    id: "command-handler-no-io",
    modules: [COMMAND_LINT, COMMAND_PHASE],
    scan: handlerNoIo,
    fixtures: [
      {
        id: "command-stream-write",
        expect: "violation",
        source: "export const leak = (value: unknown): void => console.log(value);\n",
      },
      {
        id: "command-exit-literal",
        expect: "violation",
        source: "export const result = { exitCode: 2 };\n",
      },
      {
        id: "command-adapter-import",
        expect: "violation",
        source: 'import "@delivery-os/adapters/file";\n',
      },
      {
        id: "command-clean",
        expect: "clean",
        source:
          'import type { CommandDefinition } from "../index.js";\nexport const build = (): CommandDefinition => ({ handler: () => ({ data: {} }) });\n',
      },
    ],
  },
  {
    id: "adapter-io-subpath",
    modules: [ADAPTER_PARSER],
    scan: adapterIoSubpath,
    fixtures: [
      {
        id: "adapter-surface-import",
        expect: "violation",
        source: 'import "@delivery-os/cli";\n',
      },
      {
        id: "adapter-clean",
        expect: "clean",
        source: 'import { readFileSync } from "node:fs";\n',
      },
    ],
  },
];

const coveredModules = (detectors: readonly Detector[]): Set<string> =>
  new Set(detectors.flatMap((detector) => detector.modules));

export const validateFixtureCoverage = (detectors: readonly Detector[]): string[] => {
  const failures: string[] = [];
  for (const detector of detectors) {
    if (!detector.fixtures.some((fixture) => fixture.expect === "violation")) {
      failures.push(`${detector.id} has no failing fixture`);
    }
    if (!detector.fixtures.some((fixture) => fixture.expect === "clean")) {
      failures.push(`${detector.id} has no clean control`);
    }
  }
  for (const module of GH179_MODULES) {
    if (!coveredModules(detectors).has(module)) {
      failures.push(`${module} is not covered by any detector`);
    }
  }
  return failures;
};

describe("TC-BOUND-001 GH-179 module coverage", () => {
  test("the live modules pass every detector", () => {
    const failures: string[] = [];
    for (const detector of DETECTORS) {
      for (const module of detector.modules) {
        const source = parse(module, readFileSync(join(ROOT, module), "utf8"));
        for (const violation of detector.scan(source)) {
          failures.push(`${module}: ${detector.id}: ${violation}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("every rule has a failing fixture and a clean control, and every module is covered", () => {
    expect(validateFixtureCoverage(DETECTORS)).toEqual([]);
  });

  test("each fixture produces its declared expectation", () => {
    for (const detector of DETECTORS) {
      for (const fixture of detector.fixtures) {
        const violations = detector.scan(parse(`fixture-${fixture.id}.ts`, fixture.source));
        if (fixture.expect === "clean") {
          expect({ id: fixture.id, violations }).toEqual({ id: fixture.id, violations: [] });
        } else {
          expect({ id: fixture.id, caught: violations.length > 0 }).toEqual({
            id: fixture.id,
            caught: true,
          });
        }
      }
    }
  });

  test("deleting one rule's failing fixture fails the meta-check (temp copy)", () => {
    const copy = DETECTORS.map((detector) => ({
      ...detector,
      fixtures: [...detector.fixtures],
    }));
    const target = copy.find((detector) => detector.id === "domain-pure");
    if (target === undefined) throw new Error("missing domain-pure detector");
    target.fixtures = target.fixtures.filter((fixture) => fixture.expect === "clean");
    expect(validateFixtureCoverage(copy).some((message) => message.includes("domain-pure"))).toBe(
      true,
    );
  });

  test("the new contracts and domain paths stay inside the ambient scope and scan clean", () => {
    const scoped = scopedFiles(ROOT);
    for (const path of [CONTRACTS_PM_NOTES, CONTRACTS_REGISTRY, DOMAIN_RULES]) {
      expect(scoped).toContain(path);
    }
    expect(scanAmbient(ROOT)).toEqual([]);
  });

  test("core carries no exit literal and no stream write (live scan)", () => {
    expect(scanExitLiterals(ROOT).failures).toEqual([]);
    const coreFiles = GH179_MODULES.filter((module) => module.startsWith("packages/core/"));
    for (const module of coreFiles) {
      const source = parse(module, readFileSync(join(ROOT, module), "utf8"));
      expect(handlerNoIo(source).filter((entry) => entry.startsWith("handler I/O"))).toEqual([]);
    }
  });
});
