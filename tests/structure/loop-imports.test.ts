/**
 * TC-CONTRACT-005 — the loop domain tier is pure (GH-348 NFR-1, NFR-11).
 *
 * The five pure modules declare facts and compute over injected inputs: no
 * ambient clock, timer, environment, I/O, network, or store reach. Later phases
 * extend this file with their own rows (engine-reuse identity in phase 4); this
 * phase lands only the domain-purity row plus the phase-1 declarations.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();

/** The declared pure domain surface (every file must exist and stay pure). */
export const LOOP_DOMAIN_SURFACE = [
  "packages/core/src/domain/loop-verdict.ts",
  "packages/core/src/domain/loop-backoff.ts",
  "packages/core/src/domain/loop-log.ts",
  "packages/core/src/domain/loop-status.ts",
  "packages/core/src/domain/loop-prompt.ts",
] as const;

/** The forbidden ambient identifiers the purity rule names. */
const FORBIDDEN_AMBIENT = [
  "Date.now",
  "performance.now",
  "setTimeout",
  "setInterval",
  "setImmediate",
  "queueMicrotask",
  "process.env",
  "process.cwd",
  "Math.random",
  "fetch(",
  "readFileSync",
  "writeFileSync",
] as const;

const FORBIDDEN_MODULE_PREFIXES = [
  "node:",
  "bun:",
  "#state",
  "#app",
  "#config",
  "#branding",
  "@delivery-os/adapters",
  "@delivery-os/cli",
] as const;

export type PurityViolation = {
  readonly file: string;
  readonly rule: string;
  readonly line: number;
};

/** Scan one source file for ambient facts and non-contract imports. */
export const purityViolations = (file: string, text: string): PurityViolation[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: PurityViolation[] = [];
  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      if (
        FORBIDDEN_MODULE_PREFIXES.some((prefix) => specifier.startsWith(prefix)) ||
        (specifier.startsWith(".") && !specifier.startsWith("./"))
      ) {
        violations.push({ file, rule: `import ${specifier}`, line: lineOf(node) });
      }
    }
    if (ts.isCallExpression(node)) {
      const text = node.expression.getText(source);
      for (const ambient of FORBIDDEN_AMBIENT) {
        if (text === ambient.replace(/\($/u, "") || text === ambient) {
          violations.push({ file, rule: `ambient ${ambient}`, line: lineOf(node) });
        }
      }
    }
    // A zero-argument `new Date()` reads the ambient clock.
    if (
      ts.isNewExpression(node) &&
      node.expression.getText(source) === "Date" &&
      (node.arguments === undefined || node.arguments.length === 0)
    ) {
      violations.push({ file, rule: "ambient new Date()", line: lineOf(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

describe("TC-CONTRACT-005 the loop domain tier is pure", () => {
  test("every declared domain module exists and reports no purity violation", () => {
    expect(LOOP_DOMAIN_SURFACE.length).toBe(5);
    const failures = LOOP_DOMAIN_SURFACE.flatMap((file) =>
      purityViolations(file, readFileSync(join(ROOT, file), "utf8")),
    );
    expect(failures).toEqual([]);
  });

  test("M93 a planted ambient timer in a temp copy fails by name", () => {
    const base = join(ROOT, "tmp", "tmpdir");
    mkdirSync(base, { recursive: true });
    const root = mkdtempSync(join(base, "gh348-purity-mutant-"));
    try {
      const relative = "packages/core/src/domain/loop-backoff.ts";
      const planted = `${readFileSync(join(ROOT, relative), "utf8")}\nexport const drift = () => setTimeout(() => undefined, 1);\n`;
      const path = join(root, relative);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, planted);
      const violations = purityViolations(relative, readFileSync(path, "utf8"));
      expect(violations.map((violation) => violation.rule)).toContain("ambient setTimeout");
      expect(violations[0]?.file).toBe(relative);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the purity scanner reports a non-contract import and a store reach", () => {
    expect(
      purityViolations("planted.ts", 'import { x } from "node:fs";\nexport const y = x;\n').map(
        (violation) => violation.rule,
      ),
    ).toContain("import node:fs");
    expect(
      purityViolations("planted.ts", 'import { y } from "#state/loop";\nexport const x = y;\n').map(
        (violation) => violation.rule,
      ),
    ).toContain("import #state/loop");
  });

  test("the five modules declare the phase-1 contract surface once", async () => {
    const contracts = await import("../../packages/core/src/contracts/index.js");
    expect([...contracts.LOOP_VERBS]).toEqual(["start", "stop", "status", "log", "reset"]);
    expect([...contracts.LOOP_STOP_MODES]).toEqual(["drain", "immediate"]);
    expect(contracts.LOOP_LOG_EVENTS).toHaveLength(11);
    expect([...contracts.LOOP_DEGRADATIONS]).toEqual([
      "session-pid-unknown",
      "progress-unreadable",
      "delivery-corroborator-unreadable",
      "live-facts-unknown",
      "log-unavailable",
    ]);
    expect(contracts.LOOP_SESSION_PAYLOAD_SCHEMA).toBe("delivery.loop.session.v1");
    expect(contracts.LOOP_STOP_PAYLOAD_SCHEMA).toBe("delivery.loop.stop.v1");
    expect(contracts.LOOP_SESSION_KEY_PREFIX).toBe("loop.sessions:");
    expect(contracts.LOOP_STOP_KEY_PREFIX).toBe("loop.stops:");
    expect(contracts.LOOP_V1_SUPERVISOR_IDENTITY).toBe("loop-main");
    expect(contracts.loopLogRelativePath("loop-main")).toBe("loop/loop-main.log");
  });
});

describe("TC-CONTRACT-006 the loop composes the delivered engine primitives", () => {
  const supervisorSource = (): string =>
    readFileSync(join(ROOT, "packages/core/src/app/loop-supervisor.ts"), "utf8");

  test("the loop imports the delivered claim decision and the delivered lease fold", () => {
    const text = supervisorSource();
    expect(text).toContain('from "../domain/coordinator-fence.js"');
    expect(text).toContain("decideCoordinatorClaim");
    expect(text).toContain("foldCoordinatorLease");
    // No second lease/kill/lock mechanism is authored here.
    expect(text).not.toContain("killCoordinatorProcess");
    expect(text).not.toContain("store.acquireFence");
  });

  test("the delivered module owns the fold, so the loop declares no second one", () => {
    const text = supervisorSource();
    expect(text).not.toContain("const foldLease");
    expect(text).not.toContain("function foldLease");
    expect(text).not.toContain("O_EXCL");
  });
});
