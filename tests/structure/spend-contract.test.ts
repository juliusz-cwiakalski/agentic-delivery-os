/**
 * TC-SPEND-001 — the `delivery.spend.v1` contract is declaration-only, carries
 * exactly the six pinned data keys, reuses the delivered token-class and
 * warning vocabularies by reference, keeps the amplification block exact, and
 * declares exactly one spend error identity.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableEntry,
  HARNESS_TOKEN_CLASSES,
  SPEND_AMPLIFICATION_CAUSES,
  SPEND_AMPLIFICATION_KEYS,
  SPEND_DATA_KEYS,
  SPEND_DATA_SCHEMA_ID,
  SPEND_TELEMETRY_ABSENT_CODE,
  SPEND_V2_DATA_KEYS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const MODULE = "packages/core/src/contracts/spend.ts";

const parse = (text: string, name = "spend.ts"): ts.SourceFile =>
  ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const source = readFileSync(join(ROOT, MODULE), "utf8");
const file = parse(source);

const typeAlias = (name: string): ts.TypeAliasDeclaration => {
  for (const statement of file.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) return statement;
  }
  throw new Error(`type alias ${name} is missing`);
};

const membersOf = (name: string): { readonly name: string; readonly typeText: string }[] => {
  const alias = typeAlias(name);
  if (!ts.isTypeLiteralNode(alias.type)) throw new Error(`${name} is not a type literal`);
  return alias.type.members.flatMap((member) => {
    if (!ts.isPropertySignature(member) || member.name === undefined) return [];
    const text = member.type === undefined ? "" : member.type.getText(file);
    return [{ name: member.name.getText(file), typeText: text }];
  });
};

const constInitializer = (name: string): string => {
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      if (declaration.initializer === undefined) throw new Error(`${name} has no initializer`);
      return declaration.initializer.getText(file).replace(/ as const$/, "");
    }
  }
  throw new Error(`constant ${name} is missing`);
};

const stringArray = (name: string): string[] => {
  const initializer = constInitializer(name);
  return [...initializer.matchAll(/"([^"]*)"/g)].map((match) => match[1] as string);
};

const SPEND_DISCLOSURES = stringArray("SPEND_DISCLOSURES");

describe("TC-SPEND-001 declaration-only spend contract", () => {
  test("the module declares no executable statement, function body, or call", () => {
    const executable = file.statements.filter(
      (statement) =>
        !ts.isTypeAliasDeclaration(statement) &&
        !ts.isInterfaceDeclaration(statement) &&
        !ts.isImportDeclaration(statement) &&
        !ts.isExportDeclaration(statement) &&
        !ts.isVariableStatement(statement) &&
        statement.kind !== ts.SyntaxKind.EndOfFileToken,
    );
    expect(executable.map((statement) => ts.SyntaxKind[statement.kind])).toEqual([]);
    expect(source.includes("function ")).toBe(false);
  });

  test("the data contract carries the six v1 keys plus the five declared v2 keys", () => {
    const dataKeys = membersOf("SpendReport").map((member) => member.name);
    // The six v1 keys keep their names and semantics (DEC-6).
    expect(SPEND_DATA_KEYS).toEqual([
      "tokensByClass",
      "perPhase",
      "perAgent",
      "restarts",
      "amplification",
      "degradation",
    ]);
    for (const key of SPEND_DATA_KEYS) expect(dataKeys, key).toContain(key);
    // The v2 additions are exactly the declared set, beside the six.
    for (const key of SPEND_V2_DATA_KEYS) expect(dataKeys, key).toContain(key);
    expect(dataKeys.sort()).toEqual([...SPEND_DATA_KEYS, ...SPEND_V2_DATA_KEYS].sort());
    expect(new Set(dataKeys).size).toBe(dataKeys.length);
    expect(dataKeys).not.toContain("schemaVersion");
    expect(dataKeys).not.toContain("currency");
    expect(dataKeys).not.toContain("paid");
    expect(dataKeys).not.toContain("progress");
    expect(SPEND_V2_DATA_KEYS).toEqual([
      "costTotals",
      "breakdowns",
      "phaseTiming",
      "telemetryState",
      "reconciliation",
    ]);
  });

  test("the schema id is a declared constant, never a data field", () => {
    expect(SPEND_DATA_SCHEMA_ID).toBe("delivery.spend.v1");
    expect(source).toContain('export const SPEND_DATA_SCHEMA_ID = "delivery.spend.v1" as const;');
    expect(membersOf("SpendReport").map((member) => member.name)).not.toContain("schemaId");
  });

  test("tokensByClass reuses the five delivered classes by reference", () => {
    const alias = typeAlias("SpendTokenTotals");
    expect(alias.type.getText(file)).toContain("HarnessTokenClass");
    expect(HARNESS_TOKEN_CLASSES).toEqual([
      "input",
      "output",
      "reasoning",
      "cacheRead",
      "cacheWrite",
    ]);
    // No re-declaration of the token class vocabulary in this module.
    expect(source.includes('"cacheRead"')).toBe(false);
  });

  test("perPhase, perAgent, restarts and degradation carry the pinned members", () => {
    expect(
      membersOf("SpendPhaseEntry")
        .map((member) => member.name)
        .sort(),
    ).toEqual(["calls", "phase", "share", "tokens"]);
    expect(
      membersOf("SpendAgentEntry")
        .map((member) => member.name)
        .sort(),
    ).toEqual(["agent", "calls", "model", "tokens"]);
    expect(
      membersOf("SpendDegradation")
        .map((member) => member.name)
        .sort(),
    ).toEqual(["byReason", "records"]);
    const degradation = membersOf("SpendDegradation");
    const byReason = degradation.find((member) => member.name === "byReason");
    expect(byReason?.typeText).toContain("HarnessWarningReason");
    const restarts = membersOf("SpendReport").find((member) => member.name === "restarts");
    expect(restarts?.typeText).toBe("number");
  });

  test("amplification is exactly ratio, progressRun and events", () => {
    const members = membersOf("SpendAmplification");
    expect(members.map((member) => member.name)).toEqual(["ratio", "progressRun", "events"]);
    expect(members[0]?.typeText).toBe("number | null");
    expect(members[1]?.typeText).toBe("string | null");
    expect(SPEND_AMPLIFICATION_KEYS).toEqual(["ratio", "progressRun", "events"]);
    expect(
      membersOf("SpendAmplificationEvent")
        .map((member) => member.name)
        .sort(),
    ).toEqual(["cause", "tokensWasted", "window"]);
    expect(
      membersOf("SpendAmplificationWindow")
        .map((member) => member.name)
        .sort(),
    ).toEqual(["end", "start"]);
  });

  test("the cause vocabulary is closed with exactly the one v0 cause", () => {
    expect(SPEND_AMPLIFICATION_CAUSES).toEqual(["restart-loop prefill re-pay"]);
    expect(stringArray("SPEND_AMPLIFICATION_CAUSES")).toEqual(["restart-loop prefill re-pay"]);
  });

  test("progressRun naming is documented as the zero-token progress-run rule", () => {
    const index = source.indexOf("progressRun: string | null");
    expect(index).toBeGreaterThan(0);
    const comment = source.slice(Math.max(0, index - 600), index + 200);
    expect(comment.toLowerCase()).toContain("zero-token");
  });

  test("the bounds, ordering, disclosure and grammar constants are declared", () => {
    expect(constInitializer("SPEND_MAX_MACHINE_BYTES")).toBe("65_536");
    expect(constInitializer("SPEND_MAX_HUMAN_BYTES")).toBe("16_384");
    expect(constInitializer("SPEND_MAX_HUMAN_LINES")).toBe("200");
    expect(stringArray("SPEND_AGENT_ORDER")).toEqual(["tokens-desc", "agent-asc", "model-asc"]);
    expect(stringArray("SPEND_PHASE_ORDER")).toEqual(["window-start-asc", "phase-id-asc"]);
    expect(stringArray("SPEND_TRUNCATION_TARGETS")).toEqual(["perAgent", "perPhase", "events"]);
    expect(stringArray("SPEND_DISCLOSURES")).toHaveLength(4);
    expect(SPEND_DISCLOSURES.join(" ")).toContain("run duplication");
    expect(SPEND_DISCLOSURES.join(" ")).not.toContain("work duplication");
    expect(constInitializer("SPEND_WORK_ITEM_REF_PATTERN")).toBe('"^[A-Z][A-Z0-9]*-[0-9]+$"');
  });
});

describe("TC-SPEND-001 one spend error identity", () => {
  const rows = (ERROR_TABLE as readonly ErrorTableEntry[]).filter(
    (entry) => entry.domainKind === "spend",
  );

  test("spend is a declared kind with exactly one row", () => {
    expect(DOMAIN_KINDS).toContain("spend");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      code: "spend.telemetry-absent",
      domainKind: "spend",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      remediationHint:
        "Capture harness telemetry (session-group and capture-outcome records) for the selected work item at closeout, then re-run spend.",
      projectionClass: "user-validation",
      summary: "No captured harness telemetry exists for the selected work item.",
    });
    expect(SPEND_TELEMETRY_ABSENT_CODE).toBe("spend.telemetry-absent");
  });

  test("the code is declared exactly once in the contracts module", () => {
    expect(source.split('"spend.telemetry-absent"').length - 1).toBe(1);
  });

  test("a widened byReason vocabulary or a second cause fails the shape", () => {
    // The closed vocabularies are the delivered ones; a local re-declaration
    // (which could silently widen) is absent.
    expect(source.includes("HARNESS_WARNING_REASONS =")).toBe(false);
    expect(source.includes("HARNESS_TOKEN_CLASSES =")).toBe(false);
    expect(stringArray("SPEND_AMPLIFICATION_CAUSES")).toHaveLength(1);
  });

  test("a temp mutant that widens a data key or adds a cause is detectable", () => {
    const root = mkdtempSync(join(tmpdir(), "spend-contract-mutant-"));
    try {
      mkdirSync(join(root, "packages/core/src/contracts"), { recursive: true });
      const widened = source
        .replace(
          '"restart-loop prefill re-pay"] as const',
          '"restart-loop prefill re-pay", "other"] as const',
        )
        .replace('  "degradation",\n] as const', '  "degradation",\n  "cost",\n] as const');
      const path = join(root, "packages/core/src/contracts/spend.ts");
      writeFileSync(path, widened);
      const mutant = parse(readFileSync(path, "utf8"), "spend-mutant.ts");
      const keys = [...mutant.statements]
        .filter((statement): statement is ts.VariableStatement => ts.isVariableStatement(statement))
        .flatMap((statement) =>
          statement.declarationList.declarations
            .filter((declaration) => ts.isIdentifier(declaration.name))
            .map((declaration) => (declaration.name as ts.Identifier).text),
        );
      expect(keys).toContain("SPEND_DATA_KEYS");
      expect(stringArrayFrom(widened, "SPEND_AMPLIFICATION_CAUSES")).toHaveLength(2);
      expect(stringArrayFrom(widened, "SPEND_DATA_KEYS")).toContain('"cost"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const stringArrayFrom = (text: string, name: string): string[] => {
  const mutant = parse(text, "mutant.ts");
  for (const statement of mutant.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      const initializer = declaration.initializer;
      if (initializer === undefined) throw new Error(`${name} has no initializer`);
      const array = ts.isAsExpression(initializer) ? initializer.expression : initializer;
      if (!ts.isArrayLiteralExpression(array)) throw new Error(`${name} is not an array`);
      return array.elements.map((element) => element.getText(mutant));
    }
  }
  throw new Error(`${name} is missing`);
};
