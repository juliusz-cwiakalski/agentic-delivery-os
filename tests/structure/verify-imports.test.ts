/**
 * TC-VERIFY-020 (contracts/domain/state halves) and TC-VERIFY-014 (AST half) —
 * the new verify modules are data-only, pure, tier-clean, brand-neutral, and
 * free of spawn/network imports. Every rule has a failing fixture and a clean
 * control; the live tree is never written.
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
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { DELIVERY_RESULT_TOKENS } from "../../packages/core/src/contracts/index";
import { scan as scanAmbient, scopedFiles } from "../../scripts/checks/ambient-globals";
import { scanRoot as scanExitLiterals } from "../../scripts/checks/exit-code-literals";
import { validate as validateWorkspaceEntrypoints } from "../../scripts/checks/workspace-entrypoints";

const ROOT = process.cwd();

const CONTRACTS_DELIVERY = "packages/core/src/contracts/delivery-result.ts";
const CONTRACTS_ERROR_TABLE = "packages/core/src/contracts/error-table.ts";
const DOMAIN_VERIFY = "packages/core/src/domain/verify-change.ts";
const STATE_REGISTRY = "packages/core/src/state/registry.ts";
const COMMAND_VERIFY = "packages/cli/src/commands/verify.ts";

const NEW_MODULES = [
  CONTRACTS_DELIVERY,
  CONTRACTS_ERROR_TABLE,
  DOMAIN_VERIFY,
  STATE_REGISTRY,
  COMMAND_VERIFY,
] as const;

const TOKENS: readonly string[] = [...DELIVERY_RESULT_TOKENS];
const BRAND_SEEDS = ["ados", "ADOS_", "~/.ados"];
const SPAWN_NETWORK = [
  "node:child_process",
  "node:http",
  "node:https",
  "node:net",
  "node:dns",
  "node:tls",
  "undici",
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
      [
        "parseDocument",
        "parseAllDocuments",
        "readFileSync",
        "readPmNotesText",
        "stagePmNotesPhaseEntry",
        "Date.now",
        "Math.random",
        "process.env",
      ].includes(name)
    ) {
      violations.push(`impure call ${name}`);
    }
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "env" &&
      ts.isIdentifier(node.expression) &&
      ["process", "Bun"].includes(node.expression.text)
    ) {
      violations.push(`ambient environment read ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
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

const noSpawnNetwork = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    if (
      SPAWN_NETWORK.some((banned) => specifier === banned || specifier.startsWith(`${banned}/`))
    ) {
      violations.push(`spawn/network import ${specifier}`);
    }
  }
  for (const name of callNames(source)) {
    if (
      ["Bun.spawn", "Bun.spawnSync", "spawnSync", "execFile", "execFileSync", "fetch"].includes(
        name,
      )
    ) {
      violations.push(`spawn/network call ${name}`);
    }
  }
  return violations;
};

const brandFree = (source: ts.SourceFile): string[] => {
  const text = source.getFullText();
  return BRAND_SEEDS.filter((seed) => text.includes(seed)).map((seed) => `brand literal ${seed}`);
};

/** A redeclared token list outside the single enum home. */
export const tokenListViolations = (source: ts.SourceFile, relative: string): string[] => {
  if (relative === CONTRACTS_DELIVERY) return [];
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) &&
      node.name !== undefined &&
      ts.isIdentifier(node.name) &&
      ["DELIVERY_RESULT_TOKENS", "DELIVERY_RESULT_TAXONOMY"].includes(node.name.text)
    ) {
      violations.push(`redeclared vocabulary ${node.name.text}`);
    }
    if (ts.isArrayLiteralExpression(node)) {
      const strings = node.elements
        .filter((element): element is ts.StringLiteral => ts.isStringLiteral(element))
        .map((element) => element.text);
      if (strings.length >= 2 && strings.every((value) => TOKENS.includes(value))) {
        violations.push(`token list literal with ${strings.length} tokens`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

const commandSurface = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    if (
      specifier.startsWith("node:") ||
      specifier.startsWith("bun:") ||
      specifier.startsWith("@delivery-os/adapters") ||
      specifier === "../edge.js" ||
      specifier.endsWith("/edge.js")
    ) {
      violations.push(`command import ${specifier}`);
    }
  }
  for (const name of callNames(source)) {
    if (
      ["console.log", "console.error", "process.exit"].includes(name) ||
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
      node.name.text === "exitCode" &&
      ts.isNumericLiteral(node.initializer)
    ) {
      violations.push("exit code literal");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
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
    modules: [CONTRACTS_DELIVERY, CONTRACTS_ERROR_TABLE],
    scan: contractsDataOnly,
    fixtures: [
      {
        id: "contracts-function",
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
    modules: [DOMAIN_VERIFY],
    scan: domainPure,
    fixtures: [
      {
        id: "domain-foreign-import",
        expect: "violation",
        source: 'import "#config/resolver";\n',
      },
      {
        id: "domain-clock-call",
        expect: "violation",
        source: "export const now = (): number => Date.now();\n",
      },
      {
        id: "domain-random-call",
        expect: "violation",
        source: "export const value = (): number => Math.random();\n",
      },
      {
        id: "domain-env-read",
        expect: "violation",
        source: "export const value = process.env.EXAMPLE;\n",
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
    id: "no-spawn-network",
    modules: NEW_MODULES,
    scan: noSpawnNetwork,
    fixtures: [
      {
        id: "spawn-import",
        expect: "violation",
        source: 'import { spawn } from "node:child_process";\n',
      },
      {
        id: "network-import",
        expect: "violation",
        source: 'import { fetch } from "undici";\n',
      },
      {
        id: "spawn-call",
        expect: "violation",
        source: "export const run = () => Bun.spawn();\n",
      },
      {
        id: "network-call",
        expect: "violation",
        source: "export const load = () => fetch('https://example.invalid');\n",
      },
      {
        id: "spawn-clean",
        expect: "clean",
        source:
          'import type { StateStorePort } from "#contracts";\nexport type Port = StateStorePort;\n',
      },
    ],
  },
  {
    id: "command-surface",
    modules: [COMMAND_VERIFY],
    scan: commandSurface,
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
        id: "command-edge-import",
        expect: "violation",
        source: 'import "../edge.js";\n',
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
    id: "brand-free",
    modules: NEW_MODULES,
    scan: brandFree,
    fixtures: [
      {
        id: "brand-literal",
        expect: "violation",
        source: 'export const name = "ados";\n',
      },
      {
        id: "brand-env-prefix",
        expect: "violation",
        source: 'export const prefix = "ADOS_";\n',
      },
      {
        id: "brand-clean",
        expect: "clean",
        source: 'export const label = "verify change";\n',
      },
    ],
  },
];

const coveredModules = (detectors: readonly Detector[]): Set<string> =>
  new Set(detectors.flatMap((detector) => detector.modules));

export const validateVerifyFixtureCoverage = (detectors: readonly Detector[]): string[] => {
  const failures: string[] = [];
  for (const detector of detectors) {
    if (!detector.fixtures.some((fixture) => fixture.expect === "violation")) {
      failures.push(`${detector.id} has no failing fixture`);
    }
    if (!detector.fixtures.some((fixture) => fixture.expect === "clean")) {
      failures.push(`${detector.id} has no clean control`);
    }
  }
  for (const module of NEW_MODULES) {
    if (!coveredModules(detectors).has(module)) {
      failures.push(`${module} is not covered by any detector`);
    }
  }
  return failures;
};

const listProductionFiles = (): string[] => {
  const results: string[] = [];
  const visit = (relative: string): void => {
    const directory = join(ROOT, relative);
    for (const name of readdirSync(directory)) {
      const next = `${relative}/${name}`;
      if (statSync(join(ROOT, next)).isDirectory()) {
        if (name === "dist" || name === "node_modules") continue;
        visit(next);
      } else if (name.endsWith(".ts")) {
        results.push(next);
      }
    }
  };
  visit("packages");
  return results.sort();
};

describe("TC-VERIFY-020 tests/data/state module coverage", () => {
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
    expect(validateVerifyFixtureCoverage(DETECTORS)).toEqual([]);
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

  test("deleting one rule's failing fixture fails the meta-check", () => {
    const copy = DETECTORS.map((detector) => ({
      ...detector,
      fixtures: [...detector.fixtures],
    }));
    const target = copy.find((detector) => detector.id === "domain-pure");
    if (target === undefined) throw new Error("missing domain-pure detector");
    target.fixtures = target.fixtures.filter((fixture) => fixture.expect === "clean");
    expect(
      validateVerifyFixtureCoverage(copy).some((message) => message.includes("domain-pure")),
    ).toBe(true);
  });

  test("the single enum home rejects a redeclared token list (temp controls)", () => {
    const live = listProductionFiles();
    expect(live).toContain(CONTRACTS_DELIVERY);
    for (const file of live) {
      const source = parse(file, readFileSync(join(ROOT, file), "utf8"));
      expect(tokenListViolations(source, file), file).toEqual([]);
    }
    const probe = 'export const DELIVERY_RESULT_TOKENS = ["merged", "blocked"] as const;\n';
    expect(
      tokenListViolations(parse("probe.ts", probe), "packages/cli/src/probe.ts").length,
    ).toBeGreaterThan(0);
    const listOnly = 'export const values = ["failed", "finished", "partial"] as const;\n';
    expect(
      tokenListViolations(parse("probe2.ts", listOnly), "packages/cli/src/probe2.ts").length,
    ).toBeGreaterThan(0);
  });

  test("the new domain module is inside the ambient scope and scans clean", () => {
    expect(scopedFiles(ROOT)).toContain(DOMAIN_VERIFY);
    expect(scopedFiles(ROOT)).toContain(CONTRACTS_DELIVERY);
    expect(scanAmbient(ROOT)).toEqual([]);
  });

  test("core carries no exit literal", () => {
    expect(scanExitLiterals(ROOT).failures).toEqual([]);
  });

  test("temp-copy detectors fire and temp trees are removed", () => {
    const root = mkdtempSync(join(tmpdir(), "verify-imports-"));
    try {
      mkdirSync(join(root, "packages/core/src/domain"), { recursive: true });
      const file = join(root, "packages/core/src/domain/probe.ts");
      writeFileSync(file, 'import fs from "node:fs";\nexport const value = fs;\n');
      expect(stateContractsOnly(parse("probe.ts", readFileSync(file, "utf8")))).toContain(
        "state import node:fs",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-VERIFY-020 inventory registration", () => {
  test("the inventory lists every new verify file exactly", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/contracts/delivery-result.ts");
    expect(inventory.core).toContain("src/domain/verify-change.ts");
    expect(inventory.cli).toContain("src/commands/verify.ts");
    for (const module of NEW_MODULES) {
      const [, packagePath] = module.split("/src/");
      const packageName = module.includes("packages/core/")
        ? "core"
        : module.includes("packages/cli/")
          ? "cli"
          : "";
      expect(packageName.length, module).toBeGreaterThan(0);
      expect(inventory[packageName], module).toContain(`src/${packagePath?.replace(/^src\//, "")}`);
    }
  });
});

const DEPCRUISE_RULES = [
  "matrix-adapters-importer",
  "matrix-cli-importer",
  "matrix-core-importer",
  "matrix-mcp-importer",
  "matrix-opencode-importer",
  "no-deep-package-import",
  "no-relative-cross-package-import",
  "runtime-apis-confinement",
  "subpath-adapters-core-branding",
  "subpath-adapters-core-state",
  "subpath-undeclared",
  "surface-projection-cli-only",
  "surface-serializer-entry-only",
  "testkit-no-production-import",
  "testkit-no-surface-import",
  "tier-app-allowed-set",
  "tier-branding-only-contracts",
  "tier-config-only-contracts",
  "tier-domain-only-contracts",
  "tier-state-allowed-set",
  "workspace-import-must-resolve",
].sort();

const RUNTIME_ALLOWLIST = [
  "^packages/core/src/state/driver/",
  "^packages/adapters/src/(repo|file|host|session|legacy|credentials)/",
  "^packages/adapters/src/github/",
  "^packages/adapters/src/gitlab/",
  "^packages/adapters/src/jira/",
  "^packages/cli/",
  "^packages/opencode/",
];

describe("TC-VERIFY-021 boundary, ambient, exit-code, entrypoint gates", () => {
  const require = createRequire(import.meta.url);
  const config = require("../../.dependency-cruiser.cjs") as {
    forbidden: Array<{ name: string; from?: { pathNot?: string[] } }>;
  };

  test("the dependency-cruiser rule set and runtime allowlist are the pinned pre-change sets", () => {
    const names = [...new Set(config.forbidden.map((rule) => rule.name))].sort();
    expect(names).toEqual(DEPCRUISE_RULES);
    const runtime = config.forbidden.find((rule) => rule.name === "runtime-apis-confinement");
    expect(runtime?.from?.pathNot).toEqual(RUNTIME_ALLOWLIST);
  });

  test("the workspace entrypoint check is green for the new modules", () => {
    expect(validateWorkspaceEntrypoints(ROOT)).toEqual([]);
  });

  test("a seeded ambient probe fails naming file, line, and kind", () => {
    for (const [source, detail] of [
      ["export const value = Date.now();\n", "Date.now"],
      ["export const value = Math.random();\n", "Math.random"],
      ["export const value = process.env.EXAMPLE;\n", "process.env"],
    ] as const) {
      const root = mkdtempSync(join(tmpdir(), "verify-ambient-"));
      try {
        mkdirSync(join(root, "packages/core/src/domain"), { recursive: true });
        writeFileSync(join(root, "packages/core/src/domain/probe.ts"), source);
        const violations = scanAmbient(root);
        expect(violations.length).toBeGreaterThan(0);
        expect(violations[0]?.file).toBe("packages/core/src/domain/probe.ts");
        expect(violations[0]?.line).toBe(1);
        expect(violations[0]?.detail).toContain(detail);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("a seeded exit-code literal fails and the live surface stays clean", () => {
    const root = mkdtempSync(join(tmpdir(), "verify-exit-"));
    try {
      mkdirSync(join(root, "packages/cli/src"), { recursive: true });
      writeFileSync(
        join(root, "packages/cli/src/probe.ts"),
        "export const result = { exitCode: 2 };\n",
      );
      const report = scanExitLiterals(root);
      expect(report.failures.length).toBeGreaterThan(0);
      expect(report.failures[0]).toContain("packages/cli/src/probe.ts:1");
      expect(report.failures[0]).toContain("exitCode literal 2");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    expect(scanExitLiterals(ROOT).failures).toEqual([]);
  });
});
