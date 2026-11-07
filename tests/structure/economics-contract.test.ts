/**
 * TC-ECON-001 and TC-ECON-005 — the economics contract data has one data-only
 * home and the declared outcome/identity/exit matrix is total, single-homed,
 * and free of CPU-shaped keys. Mutants live in temp copies or in-memory values,
 * never the live tree.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  ECONOMICS_EXHAUSTION_OPTIONS,
  ECONOMICS_OUTCOMES,
  ECONOMICS_OUTCOME_MATRIX,
  ECONOMICS_RESTART_HISTORY_FIELDS,
  ECONOMICS_RESTART_REASONS,
  ECONOMICS_RESUME_MODES,
  ECONOMICS_SOURCED_SIGNAL_KINDS,
  ECONOMICS_VIEW_FIELDS,
  HARNESS_LIVENESS_KINDS,
  STATE_SCHEMA_VERSION,
  WATCHDOG_ERROR_CODES,
  WATCHDOG_SIGNAL_KEYS,
  type EconomicsOutcomeMatrixRow,
  type ErrorTableEntry,
  ERROR_TABLE,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/economics.ts";
const RUNTIME_SPECIFIERS = ["node:", "bun:"];
const DATA_ONLY = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const parse = (label: string, text: string): ts.SourceFile =>
  ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const specifiersOf = (source: ts.SourceFile): string[] => {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

export const economicsContractViolations = (text: string, label = CONTRACT): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!DATA_ONLY.has(statement.kind)) {
      violations.push(`${label}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  for (const specifier of specifiersOf(source)) {
    if (RUNTIME_SPECIFIERS.some((prefix) => specifier.startsWith(prefix))) {
      violations.push(`${label}: runtime import ${specifier}`);
    }
  }
  return violations;
};

const declaredNames = (text: string, name: string): string[] => {
  const source = parse(CONTRACT, text);
  const names: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        names.push(statement.getText(source));
      }
    }
  }
  return names;
};

const listTypeScript = (directory: string): string[] => {
  const results: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(join(path, entry.name));
      } else if (entry.name.endsWith(".ts")) {
        results.push(path.endsWith("/") ? `${path}${entry.name}` : join(path, entry.name));
      }
    }
  };
  walk(directory);
  return results.sort();
};

describe("TC-ECON-001 the economics contract has one data-only home", () => {
  test("the live contract module is data-only and runtime-neutral", () => {
    expect(economicsContractViolations(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
  });

  test("each vocabulary is a single `as const` declaration driving its union", () => {
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    const vocabularies = [
      [
        "ECONOMICS_SOURCED_SIGNAL_KINDS",
        "EconomicsSourcedSignalKind",
        ECONOMICS_SOURCED_SIGNAL_KINDS,
      ],
      ["ECONOMICS_RESTART_REASONS", "EconomicsRestartReason", ECONOMICS_RESTART_REASONS],
      ["ECONOMICS_VIEW_FIELDS", "EconomicsViewField", ECONOMICS_VIEW_FIELDS],
      [
        "ECONOMICS_RESTART_HISTORY_FIELDS",
        "EconomicsRestartHistoryField",
        ECONOMICS_RESTART_HISTORY_FIELDS,
      ],
      ["ECONOMICS_OUTCOMES", "EconomicsOutcome", ECONOMICS_OUTCOMES],
      ["ECONOMICS_EXHAUSTION_OPTIONS", "EconomicsExhaustionOption", ECONOMICS_EXHAUSTION_OPTIONS],
      ["ECONOMICS_RESUME_MODES", "EconomicsResumeMode", ECONOMICS_RESUME_MODES],
    ] as const;
    for (const [name, union, values] of vocabularies) {
      const declarations = declaredNames(text, name);
      expect(declarations.length, name).toBe(1);
      expect(declarations[0], name).toContain("as const");
      expect(text, name).toContain(`export type ${union} = (typeof ${name})[number];`);
      expect(new Set(values).size, name).toBe(values.length);
    }
  });

  test("the sourced-signal vocabulary is closed, non-empty, and disjoint from the exact-three liveness kinds", () => {
    expect(ECONOMICS_SOURCED_SIGNAL_KINDS.length).toBeGreaterThan(0);
    expect(new Set(ECONOMICS_SOURCED_SIGNAL_KINDS).size).toBe(
      ECONOMICS_SOURCED_SIGNAL_KINDS.length,
    );
    expect(ECONOMICS_SOURCED_SIGNAL_KINDS).toEqual(["heartbeat-age", "token-delta"]);
    // DEC-8: the delivered liveness-kind vocabulary is asserted still exactly three.
    expect(HARNESS_LIVENESS_KINDS).toEqual(["session-traffic", "worktree-activity", "process"]);
    for (const kind of ECONOMICS_SOURCED_SIGNAL_KINDS) {
      expect(HARNESS_LIVENESS_KINDS as readonly string[]).not.toContain(kind);
    }
  });

  test("every packages module has one home for the sourced-signal vocabulary", () => {
    const failures: string[] = [];
    for (const file of listTypeScript(join(ROOT, "packages"))) {
      const relative = file.slice(ROOT.length + 1);
      if (relative === CONTRACT) continue;
      const text = readFileSync(file, "utf8");
      if (/(?:const|let|var|type)\s+ECONOMICS_SOURCED_SIGNAL_KINDS\b/.test(text)) {
        failures.push(`${relative}: redeclares ECONOMICS_SOURCED_SIGNAL_KINDS`);
      }
      if (
        relative !== "packages/core/src/contracts/harness.ts" &&
        /(?:const|let|var|type)\s+HARNESS_LIVENESS_KINDS\b/.test(text)
      ) {
        failures.push(`${relative}: redeclares HARNESS_LIVENESS_KINDS`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the view field names are declared with `restarts` and `resumeAmplification`, history ordered by ordinal", () => {
    expect(ECONOMICS_VIEW_FIELDS).toContain("restarts");
    expect(ECONOMICS_VIEW_FIELDS).toContain("resumeAmplification");
    expect(ECONOMICS_VIEW_FIELDS).toContain("restartHistory");
    expect(ECONOMICS_VIEW_FIELDS).toContain("amplificationFlag");
    expect(ECONOMICS_VIEW_FIELDS).toContain("warnings");
    expect(ECONOMICS_RESTART_HISTORY_FIELDS[0]).toBe("ordinal");
  });

  test("the watchdog signal keys are unchanged and no contract type declares a CPU field", () => {
    expect(WATCHDOG_SIGNAL_KEYS).toEqual(["heartbeatAgeMs", "tokenDelta", "traffic"]);
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(text).not.toMatch(/\bcpu/i);
  });

  test("WATCHDOG_ERROR_CODES is the three delivered codes plus the sourced-stall identity in append order", () => {
    expect(WATCHDOG_ERROR_CODES).toEqual([
      "watchdog.checkout-dirty",
      "watchdog.checkout-non-base",
      "watchdog.signals-absent",
      "watchdog.liveness-stalled",
    ]);
  });

  test("STATE_SCHEMA_VERSION is unchanged and record kinds are additive string constants", () => {
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(text).toContain('ECONOMICS_RESTART_RECORD_KIND = "economics.restart" as const');
    expect(text).toContain(
      'ECONOMICS_EXHAUSTION_RECORD_KIND = "economics.budget-exhaustion" as const',
    );
    expect(text).not.toContain("STATE_SCHEMA_VERSION =");
  });

  test("a runtime import or executable statement in a temp copy is rejected naming file and kind", () => {
    const live = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(
      economicsContractViolations(`${live}\nimport "node:fs";\n`).some((message) =>
        message.includes("runtime import node:fs"),
      ),
    ).toBe(true);
    expect(
      economicsContractViolations(
        `${live}\nexport function rogue(): number {\n  return 1;\n}\n`,
      ).some((message) => message.includes("executable statement")),
    ).toBe(true);
  });
});

const entries = ERROR_TABLE as readonly ErrorTableEntry[];

export const matrixViolations = (rows: readonly EconomicsOutcomeMatrixRow[]): string[] => {
  const violations: string[] = [];
  const outcomes = rows.map((row) => row.outcome);
  if (rows.length !== 6) violations.push(`matrix has ${rows.length} outcomes, expected 6`);
  if (new Set(outcomes).size !== outcomes.length) violations.push("matrix duplicates an outcome");
  for (const expected of ECONOMICS_OUTCOMES) {
    if (!outcomes.includes(expected)) violations.push(`matrix is missing ${expected}`);
  }
  for (const row of rows) {
    const digits = row.exitCode === null ? [] : [row.exitCode];
    for (const digit of digits) {
      if (![0, 1, 2].includes(digit)) violations.push(`row ${row.outcome} declares exit ${digit}`);
    }
    if (row.outcome === "progressing") {
      if (row.identity !== null) violations.push("progressing declares a refusal identity");
      if (row.exitCode !== 0) violations.push("progressing does not declare exit 0");
      if (row.projection !== "success") violations.push("progressing is not a success projection");
    }
    if (row.outcome === "restart-within-budget") {
      if (row.identity !== null)
        violations.push("restart-within-budget declares a refusal identity");
      if (row.exitCode !== null) violations.push("restart-within-budget declares an exit digit");
      if (row.projection !== "record") violations.push("restart-within-budget is not a record");
    }
    if (row.identity === null) continue;
    if (row.identity.startsWith("fallback.")) {
      violations.push(`row ${row.outcome} resolves to ${row.identity}`);
    }
    const entry = entries.find((candidate) => candidate.code === row.identity);
    if (entry === undefined) {
      violations.push(`row ${row.outcome} identity ${row.identity} has no table entry`);
      continue;
    }
    const expectedDigit = entry.projectionClass === "user-validation" ? 1 : 2;
    if (row.exitCode !== expectedDigit) {
      violations.push(
        `row ${row.outcome} exit ${String(row.exitCode)} != ${expectedDigit} for ${entry.projectionClass}`,
      );
    }
  }
  return violations;
};

describe("TC-ECON-005 the outcome/identity/exit matrix is declared once and total", () => {
  const rows = ECONOMICS_OUTCOME_MATRIX as readonly EconomicsOutcomeMatrixRow[];

  test("exactly the six declared outcomes, one identity and one exit digit per refusal", () => {
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.outcome)).toEqual([...ECONOMICS_OUTCOMES]);
    expect(matrixViolations(rows)).toEqual([]);
  });

  test("every identity resolves in ERROR_TABLE and projections match the declared digit", () => {
    const byOutcome = new Map(rows.map((row) => [row.outcome, row]));
    expect(byOutcome.get("stalled")).toEqual({
      outcome: "stalled",
      identity: "watchdog.liveness-stalled",
      exitCode: 1,
      projection: "refusal",
    });
    expect(byOutcome.get("sources-absent")?.identity).toBe("watchdog.signals-absent");
    expect(byOutcome.get("sources-absent")?.exitCode).toBe(2);
    expect(byOutcome.get("restart-past-budget")?.identity).toBe("dispatch.restart-budget-exceeded");
    expect(byOutcome.get("resume-uneconomical")?.identity).toBe("dispatch.resume-uneconomical");
    expect(byOutcome.get("progressing")?.identity).toBeNull();
  });

  test("the exit-digit set is a subset of {0, 1, 2}", () => {
    const digits = new Set(rows.flatMap((row) => (row.exitCode === null ? [] : [row.exitCode])));
    for (const digit of digits) expect([0, 1, 2]).toContain(digit);
  });

  test("the matrix is the only home: no second copy in cli or adapters", () => {
    for (const directory of ["packages/cli/src", "packages/adapters/src"]) {
      for (const file of listTypeScript(join(ROOT, directory))) {
        const text = readFileSync(file, "utf8");
        expect(text, file).not.toContain("ECONOMICS_OUTCOME_MATRIX");
      }
    }
  });

  test("matrix mutants fail naming the offending row", () => {
    const seventh = [
      ...rows,
      { outcome: "ghost", identity: null, exitCode: 0, projection: "success" as const },
    ] as unknown as readonly EconomicsOutcomeMatrixRow[];
    expect(matrixViolations(seventh).join("\n")).toContain("7 outcomes");
    const duplicate = [...rows, rows[1] as EconomicsOutcomeMatrixRow];
    expect(matrixViolations(duplicate).join("\n")).toContain("duplicates an outcome");
    const fourthDigit = rows.map((row) =>
      row.outcome === "stalled" ? { ...row, exitCode: 3 } : row,
    );
    expect(matrixViolations(fourthDigit).join("\n")).toContain("declares exit 3");
    const fallback = rows.map((row) =>
      row.outcome === "restart-past-budget" ? { ...row, identity: "fallback.internal" } : row,
    );
    expect(matrixViolations(fallback).join("\n")).toContain("resolves to fallback.internal");
  });
});

describe("TC-ECON-001 no second sourced-signal home in a temp package tree", () => {
  test("a temp copy with a redeclaration fails naming the file", () => {
    const root = mkdtempSync(join(tmpdir(), "econ-home-"));
    try {
      mkdirSync(join(root, "packages/core/src/domain"), { recursive: true });
      writeFileSync(
        join(root, "packages/core/src/domain/rogue.ts"),
        'export const ECONOMICS_SOURCED_SIGNAL_KINDS = ["heartbeat-age"] as const;\n',
      );
      const violations = listTypeScript(join(root, "packages"))
        .filter((file) => file.endsWith("rogue.ts"))
        .map((file) => {
          const text = readFileSync(file, "utf8");
          return /(?:const|let|var|type)\s+ECONOMICS_SOURCED_SIGNAL_KINDS\b/.test(text)
            ? `${file.slice(root.length + 1)}: redeclares ECONOMICS_SOURCED_SIGNAL_KINDS`
            : "";
        })
        .filter((entry) => entry.length > 0);
      expect(violations.join("\n")).toContain(
        "rogue.ts: redeclares ECONOMICS_SOURCED_SIGNAL_KINDS",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
