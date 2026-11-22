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
import { join } from "node:path";
import ts from "typescript";
import {
  ANNOUNCEMENT_CODES,
  ANNOUNCEMENT_EVIDENCE_FIELDS,
  ANNOUNCEMENT_SEVERITIES,
  PARK_CAUSES,
  PARK_EVIDENCE_FIELDS,
  PROVIDER_ANNOUNCEMENT_RECORD_KEY,
  PROVIDER_ANNOUNCEMENT_SCHEMA_ID,
  PROVIDER_BUDGET_BASES,
  PROVIDER_BUDGET_SCOPES,
  PROVIDER_CONDITION_KINDS,
  PROVIDER_CONDITION_TIE_ORDER,
  PROVIDER_COST_CLASSES,
  PROVIDER_MIGRATE_MAX_SOURCES,
  PROVIDER_MIGRATE_SOURCE_MAX_BYTES,
  PROVIDER_MIGRATE_SOURCE_MAX_LINES,
  PROVIDER_PARK_RECORD_KEY,
  PROVIDER_PARK_SCHEMA_ID,
  PROVIDER_PARK_STATES,
  PROVIDER_PARKS_DOCUMENT_NAME,
  PROVIDER_PARKS_PROJECTION_SCHEMA_ID,
  PROVIDER_RECORD_KINDS,
  PROVIDER_SIMULATE_FIXTURE_MAX_BYTES,
  PROVIDER_SKIP_REASONS,
  PROVIDER_WATCH_CONDITIONS,
  PROVIDER_WATCH_MAPPING_KINDS,
  PROVIDER_ZONE_NAME_MAX_LENGTH,
} from "../../packages/core/src/contracts/provider";
import {
  PARK_CAUSE_TAXONOMY,
  type ParkCauseClassification,
} from "../fixtures/provider/profile/parks/cause-taxonomy";

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
  for (const name of expected)
    if (!actual.includes(name)) failures.push(`${label}: missing ${name}`);
  for (const name of actual)
    if (!expected.includes(name)) failures.push(`${label}: unexpected ${name}`);
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
      watchMappingKinds: PROVIDER_WATCH_MAPPING_KINDS,
      watchConditions: PROVIDER_WATCH_CONDITIONS,
      budgetScopes: PROVIDER_BUDGET_SCOPES,
      budgetBases: PROVIDER_BUDGET_BASES,
    };
    for (const [name, values] of Object.entries(sets)) {
      expect(diffNames(`closed set ${name}`, values, INVENTORY.closedSets[name] ?? [])).toEqual([]);
    }
  });

  test("the condition tie order inserts budget-exhausted third", () => {
    expect([...PROVIDER_CONDITION_TIE_ORDER]).toEqual([
      "peak-window",
      "quota-exhausted",
      "budget-exhausted",
      "provider-outage",
      "credential-missing",
      "credential-rejected",
    ]);
    expect([...PROVIDER_CONDITION_TIE_ORDER]).toEqual([...PROVIDER_CONDITION_KINDS]);
  });

  test("the five declared bound constants are pinned by name and value", () => {
    expect(PROVIDER_ZONE_NAME_MAX_LENGTH).toBe(64);
    expect(PROVIDER_SIMULATE_FIXTURE_MAX_BYTES).toBe(65536);
    expect(PROVIDER_MIGRATE_SOURCE_MAX_BYTES).toBe(65536);
    expect(PROVIDER_MIGRATE_SOURCE_MAX_LINES).toBe(2000);
    expect(PROVIDER_MIGRATE_MAX_SOURCES).toBe(64);
  });

  test("evidence allowlists are exactly fourteen and seventeen fields", () => {
    expect(PARK_EVIDENCE_FIELDS).toHaveLength(14);
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS).toHaveLength(17);
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
        diffNames("evidence park", [...PARK_EVIDENCE_FIELDS, "rawBody"], INVENTORY.evidence.park),
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
    const violations = scan(ROOT).filter((violation) =>
      violation.file.startsWith("packages/core/src/provider/"),
    );
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

/**
 * GH-350 TC-ZONE-010 — zone data is read at exactly one edge and core policy
 * stays ambient-neutral: the provider tier carries no `Intl`, and the guard now
 * fails by name on a planted reference.
 */
describe("GH-350 TC-ZONE-010 the provider tier holds no ambient zone read", () => {
  test("no provider-tier file references Intl or TZ; the adapter is the only reader", () => {
    for (const file of providerFiles()) {
      const text = readFileSync(join(ROOT, file), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(text, file).not.toContain("Intl");
      expect(text, file).not.toContain("process.env.TZ");
    }
    expect(readFileSync(join(ROOT, "packages/adapters/src/time-zone/index.ts"), "utf8")).toContain(
      "Intl",
    );
    expect(
      scan(ROOT).filter((violation) => violation.file.startsWith("packages/core/src/provider/")),
    ).toEqual([]);
  });

  test("a planted Intl reference in the provider tier fails by name", () => {
    const root = mkdtempSync(join(tmpdir(), "zone-guard-"));
    const directory = join(root, "packages/core/src/provider");
    mkdirSync(directory, { recursive: true });
    try {
      writeFileSync(
        join(directory, "planted.ts"),
        'export const zone = new Intl.DateTimeFormat("en-US", { timeZone: "UTC" });\n',
      );
      const violations = scan(root);
      expect(violations.map((violation) => violation.detail)).toContain("ambient global Intl");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/* ------------------------------------------------------------------------- *
 * GH-377 — the eight-cause taxonomy proof.
 * ------------------------------------------------------------------------- */

const taxonomyFailures = (
  taxonomy: Readonly<Record<string, ParkCauseClassification>>,
): string[] => {
  const failures: string[] = [];
  for (const cause of PARK_CAUSES) {
    const row = taxonomy[cause];
    if (row === undefined) {
      failures.push(`taxonomy: missing ${cause}`);
      continue;
    }
    if (row.subject.trim().length === 0 || row.effect.trim().length === 0) {
      failures.push(`taxonomy: empty row ${cause}`);
    }
    if (row.clearsProvider === true) failures.push(`taxonomy: ${cause} clears a provider`);
    if (row.attributable && row.subject !== "provider") {
      failures.push(`taxonomy: ${cause} is attributable but not provider-subject`);
    }
    if (!row.attributable && row.subject === "provider") {
      failures.push(`taxonomy: ${cause} is provider-subject but not attributable`);
    }
  }
  for (const cause of Object.keys(taxonomy)) {
    if (!(PARK_CAUSES as readonly string[]).includes(cause)) {
      failures.push(`taxonomy: unexpected ${cause}`);
    }
  }
  const attributable = PARK_CAUSES.filter((cause) => taxonomy[cause]?.attributable === true);
  if (attributable.length !== 6) {
    failures.push(`taxonomy: attributable count ${attributable.length}`);
  }
  if (taxonomy["chain-exhausted"]?.subject !== "chain") {
    failures.push("taxonomy: chain-exhausted is not chain-subject");
  }
  if (taxonomy["reevaluation-cap"]?.subject !== "provider-loop") {
    failures.push("taxonomy: reevaluation-cap is not provider-loop-subject");
  }
  const budget = taxonomy["budget-exhausted"]?.scopeEffects;
  if (
    budget?.window !== "consumed-as-eligibility-input" ||
    budget.ticket !== "no-park-not-readable"
  ) {
    failures.push("taxonomy: budget-exhausted scope effects are not pinned");
  }
  return failures;
};

describe("GH-377 TC-PROFILE-080/083 the eight-cause table pins every cause and its subject", () => {
  test("set equality, six attributable, two chain-level, and both budget scopes", () => {
    expect(Object.keys(PARK_CAUSE_TAXONOMY).sort()).toEqual([...PARK_CAUSES].sort());
    expect(taxonomyFailures(PARK_CAUSE_TAXONOMY)).toEqual([]);
    expect(PARK_CAUSES.filter((cause) => PARK_CAUSE_TAXONOMY[cause].attributable)).toHaveLength(6);
    expect(PARK_CAUSE_TAXONOMY["chain-exhausted"]?.subject).toBe("chain");
    expect(PARK_CAUSE_TAXONOMY["reevaluation-cap"]?.subject).toBe("provider-loop");
  });

  test("a missing row, extra row, reclassification, ignored cause, and clearing cause fail by name", () => {
    const missing = { ...PARK_CAUSE_TAXONOMY } as Record<string, ParkCauseClassification>;
    delete missing["quota-exhausted"];
    expect(taxonomyFailures(missing)).toContain("taxonomy: missing quota-exhausted");

    const extra = {
      ...PARK_CAUSE_TAXONOMY,
      "not-a-cause": {
        subject: "provider",
        attributable: true,
        effect: "invented",
      },
    } as Record<string, ParkCauseClassification>;
    expect(taxonomyFailures(extra)).toContain("taxonomy: unexpected not-a-cause");

    const reclassified: Record<string, ParkCauseClassification> = {
      ...PARK_CAUSE_TAXONOMY,
      "chain-exhausted": {
        ...PARK_CAUSE_TAXONOMY["chain-exhausted"],
        attributable: true,
      },
    };
    expect(taxonomyFailures(reclassified)).toContain(
      "taxonomy: chain-exhausted is attributable but not provider-subject",
    );

    const ignored: Record<string, ParkCauseClassification> = {
      ...PARK_CAUSE_TAXONOMY,
      "peak-window": { ...PARK_CAUSE_TAXONOMY["peak-window"], attributable: false },
    };
    expect(taxonomyFailures(ignored)).toContain(
      "taxonomy: peak-window is provider-subject but not attributable",
    );

    const clearing: Record<string, ParkCauseClassification> = {
      ...PARK_CAUSE_TAXONOMY,
      "provider-outage": { ...PARK_CAUSE_TAXONOMY["provider-outage"], clearsProvider: true },
    };
    expect(taxonomyFailures(clearing)).toContain("taxonomy: provider-outage clears a provider");
  });
});
