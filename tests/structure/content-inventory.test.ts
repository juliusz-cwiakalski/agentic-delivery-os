/**
 * TC-SCAFFOLD-006 / TC-BRANDING-022 — the committed source inventory equals the
 * actual file set, and executable content is allowed only per an explicit,
 * per-file allowlist (never a global switch).
 */
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];
const inventory = JSON.parse(
  readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
) as Record<string, string[]>;

/**
 * Per-file executable allowances. The value lists the only executable exports a
 * file may declare; internal helpers are permitted inside an allowed file.
 */
const EXECUTABLE_ALLOWANCES: Record<string, string[]> = {
  "core/src/branding/index.ts": ["resolveBrandIdentity"],
  "core/src/contracts/error-table.ts": [
    "DOMAIN_KINDS",
    "ERROR_TABLE",
    "FALLBACK_INTERNAL_CODE",
    "FALLBACK_INVOCATION_CODE",
  ],
  "core/src/contracts/result.ts": ["RESULT_SCHEMA_VERSION"],
  "core/src/contracts/state.ts": ["STATE_DRIVER_KINDS", "STATE_LEVELS", "STATE_SCHEMA_VERSION"],
  "cli/src/classify.ts": ["classifyDomainKind", "classifyThrown", "resolveAppErrorCode"],
  "cli/src/commands/config.ts": ["createConfigCommandDefinition"],
  "cli/src/commands/index.ts": ["createConfigCommandDefinition"],
  "cli/src/edge.ts": [
    "createProductionDependencies",
    "registerEdgeSecrets",
    "readShippedDefaultsManifest",
    "createConfigProgram",
  ],
  "cli/src/index.ts": ["runCli"],
  "cli/src/output/serialize.ts": ["redact", "serializeEnvelope", "writeOutput"],
  "cli/src/projection.ts": ["projectExitCode"],
  "testkit/src/result-conformance.ts": ["assertEnvelopeContract", "RULES", "loadGoldenCases"],
  "core/src/contracts/config.ts": ["CONFIG_LAYERS"],
  "core/src/config/catalog.ts": [
    "BOOTSTRAP_DESCRIPTOR",
    "PRODUCTION_CATALOG",
    "fieldAt",
    "catalogPaths",
  ],
  "core/src/config/defaults.ts": ["PRODUCTION_DEFAULTS", "defaultsFor"],
  "core/src/config/provenance.ts": ["descendants", "removeOrigins", "copyOrigins", "originLabel"],
  "core/src/config/resolver.ts": ["resolveConfig"],
  "core/src/config/schema.ts": [
    "generateConfigSchema",
    "PRODUCTION_SCHEMA",
    "compileTrustedSchema",
    "invalidKey",
    "serializeProductionSchema",
  ],
  "adapters/src/file/config-source.ts": [
    "acquireFileConfig",
    "neutralEnvironmentFacts",
    "nodeFileSystemFacts",
    "runtimePlatform",
  ],
  "adapters/src/file/yaml-parser.ts": ["parseConfigYaml", "parserHostSwitchBlocked"],
  "adapters/src/repo/index.ts": ["findGitRoot", "resolveRepositoryRoot", "nodeRepositoryIo"],
  "adapters/src/legacy/index.ts": [
    "createLegacyCompat",
    "resolveProcessLegacy",
    "resolveProcessLegacyFromEnvironment",
  ],
};

const listTypeScriptFiles = (packageDir: string): string[] => {
  const results: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(packageDir, relative), { withFileTypes: true })) {
      const next = relative.length > 0 ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) results.push(next);
    }
  };
  walk("");
  return results.sort();
};

const ALLOWED_TYPES_ONLY = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.EndOfFileToken,
]);

const isExported = (node: ts.Node): boolean =>
  ((node as { modifiers?: readonly ts.Modifier[] }).modifiers ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

export const executableViolations = (
  root: string,
  packageName: string,
  relative: string,
): string[] => {
  const file = join(root, "packages", packageName, relative);
  const label = `${packageName}/${relative}`;
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const allowance = EXECUTABLE_ALLOWANCES[`${packageName}/${relative}`];
  const violations: string[] = [];

  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      const named = statement.name?.text ?? "<anonymous>";
      const exported = isExported(statement);
      if (allowance) {
        if (exported && !allowance.includes(named)) {
          violations.push(`${label}: undeclared executable export ${named}`);
        }
        continue;
      }
      if (!exported || named !== "createRuntime" || statement.body) {
        violations.push(
          `${label}: ${named === "createRuntime" ? "createRuntime must be an exported declaration without a body" : `unexpected executable function ${named}`}`,
        );
      }
      continue;
    }

    if (allowance) {
      if (ts.isVariableStatement(statement)) {
        if (isExported(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            const name = ts.isIdentifier(declaration.name)
              ? declaration.name.text
              : declaration.name.getText(source);
            if (!allowance.includes(name)) {
              violations.push(`${label}: undeclared executable export ${name}`);
            }
          }
        }
        continue;
      }
      if (!ALLOWED_TYPES_ONLY.has(statement.kind)) {
        violations.push(
          `${label}: executable statement ${ts.SyntaxKind[statement.kind]} is not permitted`,
        );
      }
      continue;
    }

    if (!ALLOWED_TYPES_ONLY.has(statement.kind)) {
      violations.push(
        `${label}: executable statement ${ts.SyntaxKind[statement.kind]} is not permitted at scaffold`,
      );
    }
  }
  return violations;
};

test("actual source file set equals the committed inventory", () => {
  const failures: string[] = [];
  for (const packageName of PACKAGE_NAMES) {
    const actual = listTypeScriptFiles(join(ROOT, "packages", packageName));
    const expected = [...(inventory[packageName] ?? [])].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(
        `${packageName}: inventory ${JSON.stringify(expected)} != actual ${JSON.stringify(actual)}`,
      );
    }
  }
  expect(failures).toEqual([]);
});

test("executable content is limited to the per-file allowlist", () => {
  const violations: string[] = [];
  for (const packageName of PACKAGE_NAMES) {
    for (const relative of inventory[packageName] ?? []) {
      violations.push(...executableViolations(ROOT, packageName, relative));
    }
  }
  expect(violations).toEqual([]);
});

const makeTempFile = (packageName: string, relative: string, content: string): string => {
  const root = mkdtempSync(join(tmpdir(), "inventory-"));
  const path = join(root, "packages", packageName, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return root;
};

test("an undeclared executable function in a types-only file fails", () => {
  const root = makeTempFile(
    "core",
    "src/domain/index.ts",
    "export function rogue(): number {\n  return 1;\n}\n",
  );
  try {
    const violations = executableViolations(root, "core", "src/domain/index.ts");
    expect(violations.some((message) => message.includes("rogue"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a second executable export in branding fails", () => {
  const branding = readFileSync(join(ROOT, "packages/core/src/branding/index.ts"), "utf8");
  const root = makeTempFile(
    "core",
    "src/branding/index.ts",
    `${branding}\nexport const extraHelper = () => 1;\n`,
  );
  try {
    const violations = executableViolations(root, "core", "src/branding/index.ts");
    expect(violations.some((message) => message.includes("extraHelper"))).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("no engine, driver, or command-registration markers exist", () => {
  const dependencyFields = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];
  const forbiddenDependency = /sqlite|confluence|@opencode-ai\/|cliffy|^commander$|^yargs$/i;
  const forbiddenSource = [
    "node:sqlite",
    "better-sqlite3",
    ".mcpb",
    "registerCommand",
    "program.command(",
  ];
  const violations: string[] = [];

  for (const packageName of PACKAGE_NAMES) {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, "packages", packageName, "package.json"), "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    for (const field of dependencyFields) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (forbiddenDependency.test(dependency)) {
          violations.push(
            `${packageName}: forbidden scaffold dependency ${dependency} in ${field}`,
          );
        }
      }
    }
    for (const relative of inventory[packageName] ?? []) {
      const content = readFileSync(join(ROOT, "packages", packageName, relative), "utf8");
      for (const marker of forbiddenSource) {
        if (content.includes(marker)) {
          violations.push(`${packageName}/${relative}: forbidden marker ${marker}`);
        }
      }
    }
  }
  expect(violations).toEqual([]);
});
