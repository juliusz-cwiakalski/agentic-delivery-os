/**
 * TC-PROFILE-039 / TC-PROFILE-055 (structure half) — provider-profile contract
 * inventory, guarded closed sets, and data-only contract discipline.
 *
 * The fixture is an independent expectation; the live module is parsed and
 * compared in both directions. No test writes the live tree.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  ANNOUNCEMENT_CODES,
  ENV_RECORD_FORMAT,
  ENV_RECORD_HEADER,
  ENV_RECORD_MAX_BYTES,
  ENV_RECORD_MAX_LINE_BYTES,
  ENV_RECORD_MAX_RECORDS,
  ENV_RECORD_NAME_PATTERN,
  PACING_CLASSES,
  PACING_GOAL_PRIORITIES,
  PROFILE_BLOCKER_KINDS,
  PROFILE_CAPABILITIES,
  PROFILE_ELIGIBILITY_VERDICTS,
  PROFILE_EVENT_CODES,
  PROFILE_EVENT_SEVERITIES,
  PROFILE_EVIDENCE_FIELDS,
  PROFILE_EVIDENCE_MAX_BYTES,
  PROFILE_EVIDENCE_MAX_FIELDS,
  PROFILE_TARGET_REASONS,
  PROFILE_TARGET_RECORD_KEY,
  PROFILE_TARGET_SCHEMA_ID,
  PROVIDER_RECORD_KINDS,
  PROVIDER_WATCH_MAPPING_KINDS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();

const exportNames = (file: string, text: string): string[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = new Set<string>();
  for (const statement of source.statements) {
    const exported = ((statement as { modifiers?: readonly ts.Modifier[] }).modifiers ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!exported) continue;
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      names.add(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    }
  }
  return [...names].sort();
};
const MODULE = "packages/core/src/contracts/provider-profile.ts";
const INVENTORY = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/provider/profile/contract-inventory.json"), "utf8"),
) as {
  readonly module: string;
  readonly exports: readonly string[];
  readonly closedSets: Readonly<Record<string, readonly string[]>>;
  readonly identifiers: Readonly<Record<string, string | number>>;
  readonly evidence: {
    readonly fields: readonly string[];
    readonly maxBytes: number;
    readonly maxFields: number;
  };
};

const diff = (label: string, actual: readonly string[], expected: readonly string[]): string[] => {
  const failures: string[] = [];
  for (const name of expected)
    if (!actual.includes(name)) failures.push(`${label}: missing ${name}`);
  for (const name of actual)
    if (!expected.includes(name)) failures.push(`${label}: unexpected ${name}`);
  return failures;
};

describe("TC-PROFILE-039 contract inventory", () => {
  test("every provider-profile export equals the independent fixture in both directions", () => {
    expect(INVENTORY.module).toBe("provider-profile.ts");
    const actual = exportNames(MODULE, readFileSync(join(ROOT, MODULE), "utf8"));
    expect(diff("provider-profile.ts", actual, INVENTORY.exports)).toEqual([]);
  });

  test("closed sets are closed, unique, and wildcard-free", () => {
    const sets: Readonly<Record<string, readonly string[]>> = {
      pacingClasses: PACING_CLASSES,
      capabilities: PROFILE_CAPABILITIES,
      goalPriorities: PACING_GOAL_PRIORITIES,
      eventCodes: PROFILE_EVENT_CODES,
      eventSeverities: PROFILE_EVENT_SEVERITIES,
      eligibilityVerdicts: PROFILE_ELIGIBILITY_VERDICTS,
      blockerKinds: PROFILE_BLOCKER_KINDS,
      targetReasons: PROFILE_TARGET_REASONS,
    };
    for (const [name, values] of Object.entries(sets)) {
      expect(diff(`closed set ${name}`, values, INVENTORY.closedSets[name] ?? []), name).toEqual(
        [],
      );
      expect(new Set(values).size, `${name} uniqueness`).toBe(values.length);
      expect(
        values.some((value) => value === "*" || value === "any"),
        `${name} wildcard`,
      ).toBe(false);
    }
    expect([...PACING_CLASSES]).toEqual(["judgment", "execution"]);
    expect([...PROFILE_CAPABILITIES]).toEqual(["vision-capable", "text-only"]);
    expect(PROFILE_EVENT_CODES).toHaveLength(5);
    expect(new Set(PROFILE_EVENT_CODES).size).toBe(5);
  });

  test("exactly one additive target record kind with its own schema id and key", () => {
    expect(PROVIDER_RECORD_KINDS).not.toContain("provider.profile-target");
    expect(PROFILE_TARGET_SCHEMA_ID).toBe("delivery.provider.profile-target.v1");
    expect(PROFILE_TARGET_SCHEMA_ID).not.toBe("delivery.provider.park.v1");
    expect(PROFILE_TARGET_SCHEMA_ID).not.toBe("delivery.provider.announcement.v1");
    expect(PROFILE_TARGET_RECORD_KEY).toBe("provider.profile-target");
    expect(PROFILE_TARGET_REASONS).toEqual(["selection", "switch", "revert"]);
  });

  test("watch mapping kinds are exactly the three first-iteration shapes", () => {
    expect(PROVIDER_WATCH_MAPPING_KINDS).toEqual([
      "coding-plan-windows",
      "deepseek-balance",
      "openai-usage-windows",
    ]);
  });

  test("env-record identifiers and bounds are pinned", () => {
    expect(ENV_RECORD_FORMAT).toBe("data-v1");
    expect(ENV_RECORD_HEADER.trim().length).toBeGreaterThan(0);
    expect(ENV_RECORD_NAME_PATTERN).toBe("^[A-Z_][A-Z0-9_]*$");
    expect(ENV_RECORD_MAX_BYTES).toBe(INVENTORY.identifiers.envRecordMaxBytes ?? 65536);
    expect(ENV_RECORD_MAX_LINE_BYTES).toBe(INVENTORY.identifiers.envRecordMaxLineBytes ?? 8192);
    expect(ENV_RECORD_MAX_RECORDS).toBe(INVENTORY.identifiers.envRecordMaxRecords ?? 256);
  });

  test("evidence is bounded and drawn from the closed allowlist", () => {
    expect([...PROFILE_EVIDENCE_FIELDS]).toEqual(INVENTORY.evidence.fields);
    expect(PROFILE_EVIDENCE_FIELDS.length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
    expect(PROFILE_EVIDENCE_MAX_FIELDS).toBe(20);
    expect(PROFILE_EVIDENCE_MAX_BYTES).toBe(1024);
    for (const field of ["profileName", "previousProfile", "newProfile", "revertCondition"]) {
      expect(PROFILE_EVIDENCE_FIELDS).toContain(field);
    }
  });

  test("profile event codes do not collide with the delivered announcement codes", () => {
    for (const code of PROFILE_EVENT_CODES) {
      expect(ANNOUNCEMENT_CODES as readonly string[]).not.toContain(code);
    }
  });

  test("peak-window rules join as an optional additive profile field (GH-294 DM-3)", () => {
    const source = ts.createSourceFile(
      MODULE,
      readFileSync(join(ROOT, MODULE), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const alias = source.statements.find(
      (statement): statement is ts.TypeAliasDeclaration =>
        ts.isTypeAliasDeclaration(statement) && statement.name.text === "ProviderProfile",
    );
    expect(alias).toBeDefined();
    const members =
      alias !== undefined && alias.type.kind === ts.SyntaxKind.TypeLiteral
        ? alias.type.members
        : [];
    const peakWindows = members.find(
      (member): member is ts.PropertySignature =>
        ts.isPropertySignature(member) &&
        ts.isIdentifier(member.name) &&
        member.name.text === "peakWindows",
    );
    expect(peakWindows).toBeDefined();
    // Additive and optional: a profile without declared rules keeps the
    // delivered shape — absence means no peak enforcement, never a default.
    expect(peakWindows?.questionToken).toBeDefined();
  });
});

describe("TC-PROFILE-055 contract modules are data-only", () => {
  test("provider-profile.ts performs no calls, construction, or function declarations", () => {
    const source = ts.createSourceFile(
      MODULE,
      readFileSync(join(ROOT, MODULE), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const violations: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        violations.push(`call/new at ${node.getStart(source)}`);
      }
      if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
        violations.push(`function at ${node.getStart(source)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    expect(violations).toEqual([]);
  });

  test("provider-profile.ts imports only sibling contract modules", () => {
    const source = ts.createSourceFile(
      MODULE,
      readFileSync(join(ROOT, MODULE), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const specifiers = source.statements
      .filter(ts.isImportDeclaration)
      .map((statement) =>
        ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : "",
      );
    for (const specifier of specifiers) expect(specifier).toMatch(/^\.\/[a-z-]+\.js$/);
  });
});
