/**
 * TC-BRANDING-005 / TC-BRANDING-019 — `BrandIdentity` is declared once in
 * `core ./contracts` with the twelve DEC-8 fields, branding consumes it as a
 * type-only import, and the telemetry schema names stay brand-neutral with no
 * emission path.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const CONTRACTS = "packages/core/src/contracts/index.ts";
const BRANDING = "packages/core/src/branding/index.ts";
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
const ALLOWED_BRANDING_IMPORTS = new Set([
  "#contracts",
  "./contracts",
  "../contracts/index.ts",
  "@delivery-os/core/contracts",
]);
const SEED_LITERALS = ["ados", "ADOS_", "~/.ados"];
const SYNTHETIC_NAMES = [".renamed-product", ".alt-brand", ".synthetic", "example-product"];

type BrandDeclaration = {
  file: string;
  fields: string[];
  readonlyMembers: boolean;
  stringMembers: boolean;
};

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

const memberName = (member: ts.TypeElement, source: ts.SourceFile): string => {
  if (!member.name) return "";
  return ts.isIdentifier(member.name) ? member.name.text : member.name.getText(source);
};

const describeMembers = (members: ts.NodeArray<ts.TypeElement>, source: ts.SourceFile) => {
  const fields: string[] = [];
  let readonlyMembers = true;
  let stringMembers = true;
  for (const member of members) {
    if (!ts.isPropertySignature(member)) {
      readonlyMembers = false;
      stringMembers = false;
      continue;
    }
    fields.push(memberName(member, source));
    if (
      !(member.modifiers ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
    ) {
      readonlyMembers = false;
    }
    if (!member.type || member.type.kind !== ts.SyntaxKind.StringKeyword) stringMembers = false;
  }
  return { fields, readonlyMembers, stringMembers };
};

const brandDeclarations = (root: string): BrandDeclaration[] => {
  const declarations: BrandDeclaration[] = [];
  for (const file of listTypeScriptFiles(root)) {
    const source = parseFile(root, file);
    for (const statement of source.statements) {
      if (
        ts.isTypeAliasDeclaration(statement) &&
        statement.name.text === "BrandIdentity" &&
        ts.isTypeLiteralNode(statement.type)
      ) {
        declarations.push({ file, ...describeMembers(statement.type.members, source) });
      }
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === "BrandIdentity") {
        declarations.push({ file, ...describeMembers(statement.members, source) });
      }
    }
  }
  return declarations;
};

const brandingImportFailures = (root: string): string[] => {
  const failures: string[] = [];
  let source: ts.SourceFile;
  try {
    source = parseFile(root, BRANDING);
  } catch {
    return [`${BRANDING}: missing branding module`];
  }
  let importsBrand = false;
  let exportsBrand = false;
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (!ALLOWED_BRANDING_IMPORTS.has(specifier)) {
        failures.push(`${BRANDING}: branding may import ./contracts only; found ${specifier}`);
        continue;
      }
      const clause = statement.importClause;
      const named = clause?.namedBindings;
      const typeOnly =
        clause?.isTypeOnly === true ||
        (named !== undefined &&
          ts.isNamedImports(named) &&
          named.elements.length > 0 &&
          named.elements.every((element) => element.isTypeOnly));
      if (!typeOnly) failures.push(`${BRANDING}: ${specifier} import must be type-only`);
      if (
        named !== undefined &&
        ts.isNamedImports(named) &&
        named.elements.some((element) => element.name.text === "BrandIdentity")
      ) {
        importsBrand = true;
      }
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause !== undefined &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.some((element) => element.name.text === "BrandIdentity")
    ) {
      if (!statement.isTypeOnly)
        failures.push(`${BRANDING}: BrandIdentity re-export must be type-only`);
      exportsBrand = true;
    }
  }
  if (!importsBrand) failures.push(`${BRANDING}: must import BrandIdentity from ./contracts`);
  if (!exportsBrand) failures.push(`${BRANDING}: must re-export the BrandIdentity type`);
  if (brandDeclarationsForFile(root, BRANDING) > 0) {
    failures.push(`${BRANDING}: declares a duplicate BrandIdentity type`);
  }
  return failures;
};

const brandDeclarationsForFile = (root: string, file: string): number =>
  brandDeclarations(root).filter((declaration) => declaration.file === file).length;

export const validateBrandIdentityContract = (root: string): string[] => {
  const failures: string[] = [];
  const declarations = brandDeclarations(root);
  if (declarations.length !== 1) {
    failures.push(
      `expected exactly one BrandIdentity declaration under packages/**; found ${declarations.length} (${declarations.map((entry) => entry.file).join(", ")})`,
    );
  }
  const contract = declarations.find((entry) => entry.file === CONTRACTS);
  if (!contract) {
    failures.push(`BrandIdentity must be declared once in ${CONTRACTS}`);
  } else {
    const missing = FIELDS.filter((field) => !contract.fields.includes(field));
    const extra = contract.fields.filter((field) => !(FIELDS as readonly string[]).includes(field));
    if (missing.length > 0)
      failures.push(`${CONTRACTS}: BrandIdentity is missing field ${missing.join(", ")}`);
    if (extra.length > 0)
      failures.push(`${CONTRACTS}: BrandIdentity has extra field ${extra.join(", ")}`);
    if (!contract.readonlyMembers)
      failures.push(`${CONTRACTS}: every BrandIdentity field must be readonly`);
    if (!contract.stringMembers)
      failures.push(`${CONTRACTS}: every BrandIdentity field must be a string`);
  }
  failures.push(...brandingImportFailures(root));
  return failures;
};

const stringLiteralAlias = (source: ts.SourceFile, name: string): string | undefined => {
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== name) continue;
    if (!ts.isLiteralTypeNode(statement.type) || !ts.isStringLiteral(statement.type.literal)) {
      return undefined;
    }
    return statement.type.literal.text;
  }
  return undefined;
};

const emissionFailures = (root: string): string[] => {
  const failures: string[] = [];
  const telemetrySdk = /telemetry|analytics|opentelemetry|sentry|posthog|segment|datadog/i;
  for (const packageName of readdirSync(join(root, "packages"))) {
    const manifestPath = join(root, "packages", packageName, "package.json");
    let manifest: Record<string, Record<string, string> | undefined>;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
        string,
        Record<string, string> | undefined
      >;
    } catch {
      continue;
    }
    for (const field of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      for (const dependency of Object.keys(manifest[field] ?? {})) {
        if (telemetrySdk.test(dependency)) {
          failures.push(
            `packages/${packageName}: telemetry SDK dependency ${dependency} in ${field}`,
          );
        }
      }
    }
  }
  for (const file of listTypeScriptFiles(root)) {
    const content = readFileSync(join(root, file), "utf8");
    if (/\b(emit|track|capture)\s*\(/.test(content)) {
      failures.push(`${file}: telemetry emission call is not permitted`);
    }
    if (
      /(?:from\s+|import\()\s*["'][^"']*(?:telemetry|analytics|sentry|posthog|opentelemetry)/i.test(
        content,
      )
    ) {
      failures.push(`${file}: telemetry SDK import is not permitted`);
    }
  }
  return failures;
};

export const validateTelemetryContract = (root: string): string[] => {
  const failures: string[] = [];
  let source: ts.SourceFile;
  try {
    source = parseFile(root, CONTRACTS);
  } catch {
    return [`${CONTRACTS}: missing contracts module`];
  }
  const event = stringLiteralAlias(source, "TelemetryEventSchemaName");
  const metric = stringLiteralAlias(source, "TelemetryMetricSchemaName");
  if (event !== "delivery.event.v1") {
    failures.push(`${CONTRACTS}: TelemetryEventSchemaName must be the literal "delivery.event.v1"`);
  }
  if (metric !== "delivery.metric.v1") {
    failures.push(
      `${CONTRACTS}: TelemetryMetricSchemaName must be the literal "delivery.metric.v1"`,
    );
  }
  for (const candidate of [event, metric]) {
    if (candidate === undefined) continue;
    if (candidate.includes("${")) failures.push(`${CONTRACTS}: schema name must not interpolate`);
    for (const seed of SEED_LITERALS) {
      if (candidate.toLowerCase().includes(seed.toLowerCase())) {
        failures.push(`${CONTRACTS}: schema name ${candidate} contains a seed token`);
      }
    }
    for (const synthetic of SYNTHETIC_NAMES) {
      if (candidate.includes(synthetic)) {
        failures.push(`${CONTRACTS}: schema name ${candidate} embeds a product-like name`);
      }
    }
  }
  const text = readFileSync(join(root, CONTRACTS), "utf8");
  const normalized = text
    .replace(/^[\s*#/]+/gm, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!normalized.includes("producer name is branding metadata")) {
    failures.push(`${CONTRACTS}: must document the producer-name-as-metadata rule`);
  }
  if (!normalized.includes("never part of a schema name")) {
    failures.push(`${CONTRACTS}: must state that the producer is never part of a schema name`);
  }
  const contract = brandDeclarations(root).find((entry) => entry.file === CONTRACTS);
  if (!contract?.fields.includes("telemetryNamespace")) {
    failures.push(`${CONTRACTS}: BrandIdentity must carry telemetryNamespace separately`);
  }
  failures.push(...emissionFailures(root));
  return failures;
};

const makeTempRoot = (files: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), "branding-contract-"));
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
};

const readRepo = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("BrandIdentity contract", () => {
  test("defined once in core ./contracts with the twelve readonly string fields", () => {
    expect(validateBrandIdentityContract(ROOT)).toEqual([]);
  });

  test("branding imports ./contracts type-only and declares no duplicate", () => {
    const branding = readRepo(BRANDING);
    expect(branding).toMatch(/import type \{[^}]*BrandIdentity[^}]*\} from "#contracts";/);
    expect(branding).toContain("export type { BrandIdentity };");
    expect(branding).not.toContain("type BrandIdentity =");
  });

  test("a removed field fails naming the missing field", () => {
    const contracts = readRepo(CONTRACTS).replace("  readonly binaryName: string;\n", "");
    const root = makeTempRoot({ [CONTRACTS]: contracts, [BRANDING]: readRepo(BRANDING) });
    try {
      const failures = validateBrandIdentityContract(root);
      expect(failures.some((message) => message.includes("binaryName"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an extra field fails naming the extra field", () => {
    const contracts = readRepo(CONTRACTS).replace(
      "  readonly installPath: string;\n",
      "  readonly installPath: string;\n  readonly extraName: string;\n",
    );
    const root = makeTempRoot({ [CONTRACTS]: contracts, [BRANDING]: readRepo(BRANDING) });
    try {
      const failures = validateBrandIdentityContract(root);
      expect(failures.some((message) => message.includes("extraName"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a duplicate declaration in branding fails naming the duplicate", () => {
    const duplicate = "export type BrandIdentity = {\n  readonly productName: string;\n};\n";
    const root = makeTempRoot({
      [CONTRACTS]: readRepo(CONTRACTS),
      [BRANDING]: `${readRepo(BRANDING)}\n${duplicate}`,
    });
    try {
      const failures = validateBrandIdentityContract(root);
      expect(failures.some((message) => message.includes("duplicate BrandIdentity"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("telemetry schema reservation", () => {
  test("reserves exact brand-neutral event and metric schema names", () => {
    expect(validateTelemetryContract(ROOT)).toEqual([]);
  });

  test("a brand-coupled schema name fails neutrality", () => {
    const contracts = readRepo(CONTRACTS).replace(
      '"delivery.event.v1"',
      '"example-product.delivery.event.v1"',
    );
    const root = makeTempRoot({ [CONTRACTS]: contracts, [BRANDING]: readRepo(BRANDING) });
    try {
      const failures = validateTelemetryContract(root);
      expect(failures.some((message) => message.includes("TelemetryEventSchemaName"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a fake emitter import fails the no-emission assertion", () => {
    const contracts = `${readRepo(CONTRACTS)}\nimport { track } from "@synthetic/telemetry-sdk";\ntrack("boot");\n`;
    const root = makeTempRoot({ [CONTRACTS]: contracts, [BRANDING]: readRepo(BRANDING) });
    try {
      const failures = validateTelemetryContract(root);
      expect(failures.some((message) => message.includes("emission"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
