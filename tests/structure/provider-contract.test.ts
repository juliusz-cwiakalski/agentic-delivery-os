/**
 * TC-PROV-001 — provider contract inventory and closed vocabularies.
 *
 * The fixture is an independent expectation of the provider contract surface;
 * the live source is parsed with the TypeScript AST and compared in both
 * directions. Mutation probes run in a temp copy only.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import {
  ANNOUNCEMENT_CODES,
  ANNOUNCEMENT_EVIDENCE_FIELDS,
  ANNOUNCEMENT_SEVERITIES,
  PARK_CAUSES,
  PARK_EVIDENCE_FIELDS,
  PROVIDER_ANNOUNCEMENT_RECORD_KEY,
  PROVIDER_ANNOUNCEMENT_SCHEMA_ID,
  PROVIDER_CONDITION_KINDS,
  PROVIDER_COST_CLASSES,
  PROVIDER_PARKS_DOCUMENT_NAME,
  PROVIDER_PARKS_PROJECTION_SCHEMA_ID,
  PROVIDER_PARK_RECORD_KEY,
  PROVIDER_PARK_SCHEMA_ID,
  PROVIDER_PARK_STATES,
  PROVIDER_RECORD_KINDS,
  PROVIDER_SKIP_REASONS,
} from "../../packages/core/src/contracts/provider";

const ROOT = process.cwd();
const PROVIDER = "packages/core/src/contracts/provider.ts";
const INVENTORY = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/provider/contract-inventory.json"), "utf8"),
) as {
  readonly module: string;
  readonly exports: readonly string[];
  readonly closedSets: Readonly<Record<string, readonly string[]>>;
  readonly evidence: { readonly park: readonly string[]; readonly announcement: readonly string[] };
  readonly identifiers: Readonly<Record<string, string>>;
};

const hasExportModifier = (node: ts.Node): boolean =>
  ((node as { modifiers?: readonly ts.Modifier[] }).modifiers ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );

const declaredNames = (statement: ts.Statement): string[] => {
  if (ts.isTypeAliasDeclaration(statement)) return [statement.name.text];
  if (ts.isInterfaceDeclaration(statement)) return [statement.name.text];
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) =>
      ts.isIdentifier(declaration.name) ? declaration.name.text : declaration.name.getText(),
    );
  }
  return [];
};

/** Collect every exported declaration name from one source text. */
export const exportNames = (file: string, text: string): string[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (!hasExportModifier(statement)) continue;
    for (const name of declaredNames(statement)) names.add(name);
  }
  return [...names].sort();
};

/** Compare two sorted string lists in both directions, naming every divergence. */
export const diffNames = (
  label: string,
  actual: readonly string[],
  expected: readonly string[],
): string[] => {
  const failures: string[] = [];
  for (const name of expected) if (!actual.includes(name)) failures.push(`${label}: missing ${name}`);
  for (const name of actual) if (!expected.includes(name)) failures.push(`${label}: unexpected ${name}`);
  return failures;
};

const actualExportNames = (): string[] =>
  exportNames(PROVIDER, readFileSync(join(ROOT, PROVIDER), "utf8"));

describe("TC-PROV-001 contract surface", () => {
  test("every provider export equals the independent fixture in both directions", () => {
    expect(INVENTORY.module).toBe("provider.ts");
    expect(diffNames("provider.ts", actualExportNames(), INVENTORY.exports)).toEqual([]);
  });

  test("closed sets are closed and exactly the documented values", () => {
    const sets: Readonly<Record<string, readonly string[]>> = {
      costClasses: PROVIDER_COST_CLASSES,
      conditionKinds: PROVIDER_CONDITION_KINDS,
      parkCauses: PARK_CAUSES,
      skipReasons: PROVIDER_SKIP_REASONS,
      announcementCodes: ANNOUNCEMENT_CODES,
      recordKinds: PROVIDER_RECORD_KINDS,
      parkStates: PROVIDER_PARK_STATES,
      severities: ANNOUNCEMENT_SEVERITIES,
    };
    for (const [name, values] of Object.entries(sets)) {
      expect(diffNames(`closed set ${name}`, values, INVENTORY.closedSets[name] ?? [])).toEqual([]);
    }
  });

  test("evidence allowlists are exactly eight and eleven fields", () => {
    expect(PARK_EVIDENCE_FIELDS).toHaveLength(8);
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS).toHaveLength(11);
    expect([...PARK_EVIDENCE_FIELDS]).toEqual(INVENTORY.evidence.park);
    expect([...ANNOUNCEMENT_EVIDENCE_FIELDS]).toEqual(INVENTORY.evidence.announcement);
  });

  test("schema and projection identifiers are pinned", () => {
    expect(PROVIDER_PARK_SCHEMA_ID).toBe(INVENTORY.identifiers.parkSchema);
    expect(PROVIDER_ANNOUNCEMENT_SCHEMA_ID).toBe(INVENTORY.identifiers.announcementSchema);
    expect(PROVIDER_PARKS_DOCUMENT_NAME).toBe(INVENTORY.identifiers.parksDocument);
    expect(PROVIDER_PARKS_PROJECTION_SCHEMA_ID).toBe(INVENTORY.identifiers.parksProjectionSchema);
    expect(PROVIDER_PARK_RECORD_KEY).toBe(INVENTORY.identifiers.parkRecordKey);
    expect(PROVIDER_ANNOUNCEMENT_RECORD_KEY).toBe(INVENTORY.identifiers.announcementRecordKey);
  });

  test("a temp-copy extra export, extra cause, and unknown evidence key are named", () => {
    const root = mkdtempSync(join(tmpdir(), "provider-contract-"));
    const directory = join(root, "packages/core/src/contracts");
    mkdirSync(directory, { recursive: true });
    const path = join(directory, "provider.ts");
    try {
      writeFileSync(
        path,
        `${readFileSync(join(ROOT, PROVIDER), "utf8")}\nexport const EXTRA_CAUSE = "not-a-cause" as const;\n`,
      );
      const mutated = exportNames("provider.ts", readFileSync(path, "utf8"));
      expect(diffNames("provider.ts", mutated, INVENTORY.exports)).toContain(
        "provider.ts: unexpected EXTRA_CAUSE",
      );
      expect(
        diffNames(
          "closed set parkCauses",
          [...PARK_CAUSES, "not-a-cause"],
          INVENTORY.closedSets.parkCauses ?? [],
        ),
      ).toContain("closed set parkCauses: unexpected not-a-cause");
      expect(
        diffNames(
          "evidence park",
          [...PARK_EVIDENCE_FIELDS, "rawBody"],
          INVENTORY.evidence.park,
        ),
      ).toContain("evidence park: unexpected rawBody");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

import { readdirSync } from "node:fs";
import { scan } from "../../scripts/checks/ambient-globals";

const providerFiles = (): string[] =>
  readdirSync(join(ROOT, "packages/core/src/provider"))
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => `packages/core/src/provider/${entry}`)
    .sort();

describe("TC-PROV-006 provider-policy purity and neutrality", () => {
  test("imports are only #contracts and intra-provider #provider/*", () => {
    const failures: string[] = [];
    for (const file of providerFiles()) {
      const source = ts.createSourceFile(
        file,
        readFileSync(join(ROOT, file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      for (const statement of source.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const specifier = statement.moduleSpecifier.text;
        const allowed =
          specifier === "#contracts" ||
          specifier.startsWith("#provider/") ||
          /^\.\/[a-z-]+\.js$/.test(specifier);
        if (!allowed) failures.push(`${file}: import ${specifier}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the ambient-globals guard is clean over the provider tier", () => {
    const violations = scan(ROOT).filter((violation) => violation.file.startsWith("packages/core/src/provider/"));
    expect(violations).toEqual([]);
  });

  test("provider policy source carries no vendor constant or product token", () => {
    for (const file of providerFiles()) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const token of ["api.z.ai", "zai-coding-plan", "ZAI_API_KEY", "ados", "ADOS_"]) {
        expect(text.toLowerCase(), `${file}: ${token}`).not.toContain(token.toLowerCase());
      }
    }
  });
});
