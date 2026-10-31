/**
 * TC-SCAFFOLD-006 / TC-BRANDING-022 — the committed source inventory equals the
 * actual file set, and executable content is allowed only per an explicit,
 * per-file allowlist (never a global switch).
 */
import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
  "core/src/contracts/adapter-capabilities.ts": ["ADAPTER_OPERATIONS", "CARRIER_KINDS"],
  "core/src/contracts/envelope.ts": [
    "DEGRADATION_REASONS",
    "ENVELOPE_KINDS",
    "ENVELOPE_MAX_BYTES",
    "ENVELOPE_SCHEMA_ID",
  ],
  "core/src/contracts/state.ts": ["STATE_DRIVER_KINDS", "STATE_LEVELS", "STATE_SCHEMA_VERSION"],
  "core/src/state/index.ts": ["createStateStore"],
  "core/src/state/ledger.ts": [
    "CHECKSUM_HEX_LENGTH",
    "RECORD_FIELDS",
    "buildRecord",
    "checksumOfPayload",
    "parseRecordLine",
    "serializeRecord",
    "valuesFromRecords",
    "verifiedPrefixLength",
    "verifyLedger",
  ],
  "core/src/state/driver/runtime-edge.ts": ["createNodeStateEdge", "hasForeignAclGrant"],
  "core/src/state/driver/strategy.ts": ["createJsonlStrategy", "createSqliteStrategy"],
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
  "adapters/src/credentials/index.ts": [
    "createEnvironmentCredentialPort",
    "createProcessCredentialPort",
    "resolveCredentialSourceKey",
  ],
  "adapters/src/file/config-source.ts": [
    "acquireFileConfig",
    "neutralEnvironmentFacts",
    "nodeFileSystemFacts",
    "runtimePlatform",
  ],
  "adapters/src/file/yaml-parser.ts": ["parseConfigYaml", "parserHostSwitchBlocked"],
  "adapters/src/io/envelope-codec.ts": [
    "ENVELOPE_FIELD_NAME",
    "isClosedV1Payload",
    "parseEnvelope",
    "readRawCarrier",
    "serializeEnvelope",
    "stripEnvelope",
  ],
  "adapters/src/io/provider-transport.ts": ["providerPayloadFailure"],
  "adapters/src/jira/capabilities.ts": ["JIRA_ADAPTER_CONTRACT"],
  "adapters/src/jira/client.ts": ["createJiraClient"],
  "adapters/src/jira/custom-fields.ts": ["JIRA_CUSTOM_FIELD_MAPPINGS", "applyJiraCustomFields"],
  "adapters/src/jira/index.ts": ["createJiraClient", "JIRA_ADAPTER_CONTRACT"],
  "adapters/src/jira/normalize.ts": [
    "normalizeJiraIssue",
    "normalizeJiraSearch",
    "jiraNormalizationContext",
  ],
  "adapters/src/gitlab/capabilities.ts": ["GITLAB_ADAPTER_CONTRACT"],
  "adapters/src/gitlab/client.ts": ["createGitLabClient"],
  "adapters/src/gitlab/index.ts": ["createGitLabClient", "GITLAB_ADAPTER_CONTRACT"],
  "adapters/src/gitlab/merge-status.ts": [
    "GITLAB_MERGE_STATUS_RULES",
    "createGitLabReviewStateResolver",
    "resolveGitLabReviewState",
  ],
  "adapters/src/gitlab/normalize.ts": ["normalizeMergeRequest", "normalizePipelines"],
  "adapters/src/jira/workflow-map.ts": [
    "JIRA_WORKFLOW_MAP",
    "validateWorkflowMap",
    "stateMappingFor",
  ],
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

/**
 * Scaffold-stage marker guard. The state driver edge is the one sanctioned
 * runtime home for a built-in SQLite binding (GH-174 TDR-0004); every other
 * file and every third-party engine dependency stays forbidden.
 */
const RUNTIME_ENGINE_ALLOWED = ["core/src/state/driver/runtime-edge.ts"];
const FORBIDDEN_DEPENDENCY = /sqlite|confluence|@opencode-ai\/|cliffy|^commander$|^yargs$/i;
const FORBIDDEN_MARKERS = [
  "node:sqlite",
  "better-sqlite3",
  ".mcpb",
  "registerCommand",
  "program.command(",
];

export const engineMarkerViolations = (root: string, files: Record<string, string[]>): string[] => {
  const violations: string[] = [];
  for (const packageName of PACKAGE_NAMES) {
    if (!existsSync(join(root, "packages", packageName, "package.json"))) continue;
    const manifest = JSON.parse(
      readFileSync(join(root, "packages", packageName, "package.json"), "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (FORBIDDEN_DEPENDENCY.test(dependency)) {
          violations.push(
            `${packageName}: forbidden scaffold dependency ${dependency} in ${field}`,
          );
        }
      }
    }
    for (const relative of files[packageName] ?? []) {
      const label = `${packageName}/${relative}`;
      const allowed = RUNTIME_ENGINE_ALLOWED.includes(label);
      const content = readFileSync(join(root, "packages", packageName, relative), "utf8");
      for (const marker of FORBIDDEN_MARKERS) {
        if (marker === "node:sqlite" && allowed) continue;
        if (content.includes(marker)) violations.push(`${label}: forbidden marker ${marker}`);
      }
    }
  }
  return violations;
};

test("no engine, driver, or command-registration markers exist", () => {
  expect(engineMarkerViolations(ROOT, inventory)).toEqual([]);
});

test("the runtime-engine exemption is path-scoped to the state driver edge", () => {
  const root = mkdtempSync(join(tmpdir(), "engine-probe-"));
  try {
    mkdirSync(join(root, "packages/core/src/state/driver"), { recursive: true });
    writeFileSync(join(root, "packages/core/package.json"), JSON.stringify({ name: "core" }));
    writeFileSync(join(root, "packages/core/src/state/index.ts"), 'import "node:sqlite";\n');
    writeFileSync(
      join(root, "packages/core/src/state/driver/runtime-edge.ts"),
      'import "node:sqlite";\n',
    );
    const violations = engineMarkerViolations(root, {
      core: ["src/state/index.ts", "src/state/driver/runtime-edge.ts"],
    });
    expect(violations).toEqual(["core/src/state/index.ts: forbidden marker node:sqlite"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
