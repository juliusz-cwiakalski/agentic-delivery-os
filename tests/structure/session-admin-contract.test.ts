/**
 * TC-DB-001 and the automated in-tree half of TC-DB-038.
 *
 * The `delivery.session-admin.v1` vocabulary is declaration-only, every pinned
 * constant is exact, the read/admin port split is closed, and the C-11 privacy
 * sign-off is recorded as an owner merge gate with no approval claim.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  DB_CHECKPOINT_TIMEOUT_MS,
  DB_COMMANDS,
  DB_DEFAULT_LIST_LIMIT,
  DB_DEFAULT_OLDER_THAN_DAYS,
  DB_DEFAULT_PRUNE_LIMIT,
  DB_DELETE_TIMEOUT_MS,
  DB_LIVE_WINDOW_MINUTES,
  DB_MAX_HUMAN_BYTES,
  DB_MAX_HUMAN_ITEMS,
  DB_MAX_HUMAN_LINES,
  DB_MAX_ID_CHARS,
  DB_MAX_LIST_LIMIT,
  DB_MAX_MACHINE_BYTES,
  DB_MAX_OLDER_THAN_DAYS,
  DB_MAX_PATH_CHARS,
  DB_MAX_PRUNE_LIMIT,
  DB_MAX_TIMESTAMP_CHARS,
  DB_MIN_LIMIT,
  DB_MIN_OLDER_THAN_DAYS,
  DB_MODES,
  DB_QUERY_TIMEOUT_MS,
  DB_SCHEMA_VERSION,
  DB_SESSION_ID_PATTERN,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/session.ts";
const SPEC = "doc/changes/2026-10/2026-10-31--GH-180--db-session-admin-port/chg-GH-180-spec.md";
const EVIDENCE =
  "doc/changes/2026-10/2026-10-31--GH-180--db-session-admin-port/chg-GH-180-evidence.md";

const EXPECTED_CONSTANTS: Readonly<Record<string, string | number | readonly string[]>> = {
  DB_SCHEMA_VERSION: "delivery.session-admin.v1",
  DB_COMMANDS: ["size", "list", "prune", "reboot"],
  DB_MODES: ["dry-run", "applied"],
  DB_LIVE_WINDOW_MINUTES: 15,
  DB_DEFAULT_OLDER_THAN_DAYS: 30,
  DB_MIN_OLDER_THAN_DAYS: 1,
  DB_MAX_OLDER_THAN_DAYS: 3650,
  DB_DEFAULT_LIST_LIMIT: 20,
  DB_MAX_LIST_LIMIT: 100,
  DB_DEFAULT_PRUNE_LIMIT: 50,
  DB_MAX_PRUNE_LIMIT: 500,
  DB_MIN_LIMIT: 1,
  DB_MAX_ID_CHARS: 128,
  DB_MAX_TIMESTAMP_CHARS: 32,
  DB_MAX_PATH_CHARS: 1024,
  DB_MAX_HUMAN_ITEMS: 32,
  DB_MAX_HUMAN_LINES: 40,
  DB_MAX_HUMAN_BYTES: 8192,
  DB_MAX_MACHINE_BYTES: 524288,
  DB_SESSION_ID_PATTERN: "^[A-Za-z0-9_-]+$",
  DB_QUERY_TIMEOUT_MS: 30000,
  DB_DELETE_TIMEOUT_MS: 30000,
  DB_CHECKPOINT_TIMEOUT_MS: 120000,
};

const parse = (text: string): ts.SourceFile =>
  ts.createSourceFile(CONTRACT, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const ALLOWED = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

/** Every session contract statement is declaration data; no executable content. */
export const declarationViolations = (text: string): string[] => {
  const source = parse(text);
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!ALLOWED.has(statement.kind)) {
      violations.push(`executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) violations.push("call expression");
    if (ts.isNewExpression(node)) violations.push("new expression");
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node)
    ) {
      violations.push("function body");
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

const literalValue = (node: ts.Expression): string | number | readonly string[] | undefined => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isAsExpression(node)) return literalValue(node.expression);
  if (ts.isParenthesizedExpression(node)) return literalValue(node.expression);
  if (ts.isArrayLiteralExpression(node)) {
    const values: string[] = [];
    for (const element of node.elements) {
      const value = literalValue(element);
      if (typeof value !== "string") return undefined;
      values.push(value);
    }
    return values;
  }
  return undefined;
};

/** Extract every `export const NAME = <literal> as const` value. */
export const constantSnapshot = (
  text: string,
): Record<string, string | number | readonly string[]> => {
  const source = parse(text);
  const snapshot: Record<string, string | number | readonly string[]> = {};
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue;
      const value = literalValue(declaration.initializer);
      if (value !== undefined) snapshot[declaration.name.text] = value;
    }
  }
  return snapshot;
};

const compareConstants = (
  snapshot: Record<string, string | number | readonly string[]>,
): string[] => {
  const failures: string[] = [];
  for (const [name, expected] of Object.entries(EXPECTED_CONSTANTS)) {
    if (JSON.stringify(snapshot[name]) !== JSON.stringify(expected)) {
      failures.push(`${name}: ${JSON.stringify(snapshot[name])} != ${JSON.stringify(expected)}`);
    }
  }
  return failures;
};

type PortShape = { readonly name: string; readonly methods: string[]; readonly extends: string[] };

const portShapes = (text: string): PortShape[] => {
  const source = parse(text);
  const shapes: PortShape[] = [];
  for (const statement of source.statements) {
    if (!ts.isInterfaceDeclaration(statement)) continue;
    const methods = statement.members
      .filter(ts.isMethodSignature)
      .map((member) => member.name.getText(source));
    const heritage = (statement.heritageClauses ?? []).flatMap((clause) =>
      clause.types.map((type) => type.expression.getText(source)),
    );
    shapes.push({ name: statement.name.text, methods, extends: heritage });
  }
  return shapes;
};

type FieldShape = { readonly name: string; readonly optional: boolean };

const typeFields = (text: string, typeName: string): FieldShape[] | undefined => {
  const source = parse(text);
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== typeName) continue;
    if (!ts.isTypeLiteralNode(statement.type)) return undefined;
    return statement.type.members.filter(ts.isPropertySignature).map((member) => ({
      name: member.name.getText(source),
      optional: member.questionToken !== undefined,
    }));
  }
  return undefined;
};

const textOf = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-DB-001 session-admin contract vocabulary", () => {
  test("the contract module is declaration-only", () => {
    expect(declarationViolations(textOf(CONTRACT))).toEqual([]);
  });

  test("every pinned constant has its exact value", () => {
    const snapshot = constantSnapshot(textOf(CONTRACT));
    expect(compareConstants(snapshot)).toEqual([]);
    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(EXPECTED_CONSTANTS).sort());
    // Runtime imports agree with the literal AST values.
    expect(DB_SCHEMA_VERSION).toBe("delivery.session-admin.v1");
    expect([...DB_COMMANDS]).toEqual(["size", "list", "prune", "reboot"]);
    expect([...DB_MODES]).toEqual(["dry-run", "applied"]);
    expect([
      DB_LIVE_WINDOW_MINUTES,
      DB_DEFAULT_OLDER_THAN_DAYS,
      DB_DEFAULT_LIST_LIMIT,
      DB_DEFAULT_PRUNE_LIMIT,
      DB_MAX_LIST_LIMIT,
      DB_MAX_PRUNE_LIMIT,
      DB_MIN_LIMIT,
      DB_MAX_ID_CHARS,
      DB_MAX_TIMESTAMP_CHARS,
      DB_MAX_PATH_CHARS,
      DB_MAX_HUMAN_ITEMS,
      DB_MAX_HUMAN_LINES,
      DB_MAX_HUMAN_BYTES,
      DB_MAX_MACHINE_BYTES,
      DB_QUERY_TIMEOUT_MS,
      DB_DELETE_TIMEOUT_MS,
      DB_CHECKPOINT_TIMEOUT_MS,
      DB_MIN_OLDER_THAN_DAYS,
      DB_MAX_OLDER_THAN_DAYS,
    ]).toEqual([
      15, 30, 20, 50, 100, 500, 1, 128, 32, 1024, 32, 40, 8192, 524288, 30000, 30000, 120000, 1,
      3650,
    ]);
    expect(DB_SESSION_ID_PATTERN).toBe("^[A-Za-z0-9_-]+$");
  });

  test("the read port is exactly size/list and the admin port adds prune/reboot", () => {
    const shapes = portShapes(textOf(CONTRACT));
    const read = shapes.find((shape) => shape.name === "SessionStorePort");
    const admin = shapes.find((shape) => shape.name === "SessionAdminPort");
    expect(read).toEqual({ name: "SessionStorePort", methods: ["size", "list"], extends: [] });
    expect(admin?.methods).toEqual(["prune", "reboot"]);
    expect(admin?.extends).toEqual(["SessionStorePort"]);
    expect(shapes.map((shape) => shape.name).sort()).toEqual([
      "SessionAdminPort",
      "SessionStorePort",
    ]);
  });

  test("SessionSummary has exactly the closed nine-field shape and optional parentId", () => {
    const fields = typeFields(textOf(CONTRACT), "SessionSummary");
    expect(fields?.map((field) => field.name)).toEqual([
      "id",
      "parentId",
      "createdAt",
      "updatedAt",
      "messageCount",
      "partCount",
      "dataBytes",
      "archived",
      "live",
    ]);
    expect(fields?.find((field) => field.name === "parentId")?.optional).toBe(true);
    expect(
      fields?.filter((field) => field.name !== "parentId").every((field) => !field.optional),
    ).toBe(true);
  });

  test("each payload declares its documented key set", () => {
    expect(typeFields(textOf(CONTRACT), "SizeData")?.map((field) => field.name)).toEqual([
      "schemaVersion",
      "command",
      "database",
      "counts",
      "oldestSessionUpdatedAt",
      "newestSessionUpdatedAt",
    ]);
    expect(typeFields(textOf(CONTRACT), "ListData")?.map((field) => field.name)).toEqual([
      "schemaVersion",
      "command",
      "limit",
      "total",
      "omitted",
      "truncated",
      "items",
    ]);
    expect(typeFields(textOf(CONTRACT), "PruneData")?.map((field) => field.name)).toEqual([
      "schemaVersion",
      "command",
      "mode",
      "olderThanDays",
      "limit",
      "liveWindowMinutes",
      "cutoff",
      "counts",
      "candidates",
    ]);
    expect(typeFields(textOf(CONTRACT), "RebootData")?.map((field) => field.name)).toEqual([
      "schemaVersion",
      "command",
      "mode",
      "liveWindowMinutes",
      "liveSessions",
      "blockedByLiveSession",
      "checkpointPerformed",
      "database",
    ]);
  });

  test("a seeded executable statement and a wrong constant each fail the scan", () => {
    const live = textOf(CONTRACT);
    expect(
      declarationViolations(`${live}\nexport const rogue = (): number => 1;\n`).length,
    ).toBeGreaterThan(0);
    const mutated = live.replace(
      "export const DB_LIVE_WINDOW_MINUTES = 15 as const;",
      "export const DB_LIVE_WINDOW_MINUTES = 16 as const;",
    );
    expect(
      compareConstants(constantSnapshot(mutated)).some((line) =>
        line.includes("DB_LIVE_WINDOW_MINUTES"),
      ),
    ).toBe(true);
  });
});

const APPROVAL_CLAIM_PATTERNS = [
  /sign-off is granted/i,
  /sign-off has been granted/i,
  /approval is granted/i,
  /approval has been granted/i,
  /approved for merge/i,
  /C-11 approved/i,
];
const NEGATIONS = ["not ", "never ", "claims ", "claim "];

/** TC-DB-038: the sign-off is recorded and no artifact claims it was granted. */
export const signOffFailures = (specText: string, evidenceText: string | undefined): string[] => {
  const failures: string[] = [];
  for (const required of [
    "ADR-0003 C-11",
    "owner merge gate",
    "not claimed as granted",
    "CEO/human owner",
  ]) {
    if (!specText.includes(required)) failures.push(`spec is missing "${required}"`);
  }
  const corpus = evidenceText === undefined ? specText : `${specText}\n${evidenceText}`;
  for (const pattern of APPROVAL_CLAIM_PATTERNS) {
    for (const match of corpus.matchAll(new RegExp(pattern.source, "gi"))) {
      const before = corpus.slice(Math.max(0, (match.index ?? 0) - 40), match.index ?? 0);
      if (!NEGATIONS.some((negation) => before.toLowerCase().includes(negation))) {
        failures.push(`approval claim present: ${match[0]}`);
      }
    }
  }
  return failures;
};

describe("TC-DB-038 C-11 sign-off is an owner merge gate", () => {
  test("the spec records the gate and no artifact claims approval", () => {
    let evidence: string | undefined;
    try {
      evidence = textOf(EVIDENCE);
    } catch {
      evidence = undefined;
    }
    expect(signOffFailures(textOf(SPEC), evidence)).toEqual([]);
  });

  test("a temp copy claiming approval fails the scan", () => {
    const mutated = `${textOf(SPEC)}\nThe C-11 sign-off is granted.`;
    expect(signOffFailures(mutated, undefined).some((line) => line.includes("granted"))).toBe(true);
  });
});
