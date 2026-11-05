/**
 * TC-WATCHDOG-002, TC-WATCHDOG-006, TC-WATCHDOG-007 — tier boundaries, brand
 * neutrality, and a check-only grammar. Every detector has a failing mutant in a
 * temp copy or an in-memory string; the live tree is never written.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { createWatchdogCommandDefinition } from "../../packages/cli/src/commands/watchdog";
import { WATCHDOG_PROBES } from "../../packages/core/src/contracts/index";
import { scan, scopedFiles } from "../../scripts/checks/ambient-globals";
import {
  type ForbiddenLiteralRegistry,
  readRegistry,
} from "../../scripts/checks/forbidden-literals";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/watchdog.ts";
const DOMAIN = "packages/core/src/domain/watchdog.ts";
const COMMAND = "packages/cli/src/commands/watchdog.ts";
const RUNTIME_SPECIFIERS = ["node:", "bun:"];
const RUNNER_VERBS = ["run", "start", "stop", "kill", "spawn", "dispatch", "restart", "supervise"];

const parse = (label: string, text: string): ts.SourceFile =>
  ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const specifiersOf = (source: ts.SourceFile): string[] => {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const callNames = (source: ts.SourceFile): string[] => {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) names.push(node.expression.text);
      if (ts.isPropertyAccessExpression(node.expression)) {
        names.push(`${node.expression.expression.getText(source)}.${node.expression.name.text}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
};

const DATA_ONLY = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

export const contractsDataOnly = (text: string, label = CONTRACT): string[] => {
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

export const domainPure = (text: string, label = DOMAIN): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "#contracts" || specifier.startsWith("#domain/") || specifier.startsWith("./");
    if (!allowed) violations.push(`${label}: domain import ${specifier}`);
  }
  for (const name of callNames(source)) {
    if (
      [
        "Date.now",
        "Math.random",
        "performance.now",
        "process.env",
        "Bun.env",
        "fetch",
        "readFileSync",
      ].includes(name)
    ) {
      violations.push(`${label}: impure call ${name}`);
    }
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "env" &&
      ts.isIdentifier(node.expression) &&
      ["process", "Bun"].includes(node.expression.text)
    ) {
      violations.push(`${label}: ambient environment read ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

export const commandCoreOnly = (text: string, label = COMMAND): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "@delivery-os/core" ||
      specifier === "@delivery-os/core/contracts" ||
      specifier === "../index.js" ||
      specifier.startsWith("./");
    if (!allowed) violations.push(`${label}: non-core command import ${specifier}`);
  }
  return violations;
};

/** Runner verbs may never appear as a declared subcommand string. */
export const runnerVerbViolations = (text: string, label = COMMAND): string[] => {
  const source = parse(label, text);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) && RUNNER_VERBS.includes(node.text)) {
      violations.push(`${label}: runner verb ${node.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

export const seedLiteralViolations = (
  registry: ForbiddenLiteralRegistry,
  text: string,
  label: string,
): string[] => {
  const violations: string[] = [];
  for (const seed of registry.seedLiterals) {
    if (text.includes(seed)) violations.push(`${label}: product literal ${seed}`);
  }
  return violations;
};

const registry = readRegistry(ROOT);
const live = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-WATCHDOG-002 contracts, domain, and command respect tier boundaries", () => {
  test("the live contracts module is data-only and imports no runtime specifier", () => {
    expect(contractsDataOnly(live(CONTRACT))).toEqual([]);
  });

  test("the live domain module is pure and imports only contracts and local modules", () => {
    expect(domainPure(live(DOMAIN))).toEqual([]);
  });

  test("the live command module imports only core surfaces and local modules", () => {
    expect(commandCoreOnly(live(COMMAND))).toEqual([]);
  });

  test("the ambient-globals guard scopes the new contracts and domain files with zero violations", () => {
    const scoped = scopedFiles(ROOT);
    expect(scoped).toContain(CONTRACT);
    expect(scoped).toContain(DOMAIN);
    const violations = scan(ROOT).filter(
      (violation) => violation.file === CONTRACT || violation.file === DOMAIN,
    );
    expect(violations).toEqual([]);
  });

  test("a node:fs import in contracts, Date.now in domain, and an adapter import in the command each fail by file and kind", () => {
    expect(contractsDataOnly(`${live(CONTRACT)}\nimport "node:fs";\n`).join("\n")).toContain(
      "runtime import node:fs",
    );
    expect(
      domainPure(`${live(DOMAIN)}\nexport const rogue = () => Date.now();\n`).join("\n"),
    ).toContain("impure call Date.now");
    expect(
      commandCoreOnly(`${live(COMMAND)}\nimport "@delivery-os/adapters/session";\n`).join("\n"),
    ).toContain("non-core command import @delivery-os/adapters/session");
    expect(
      commandCoreOnly(`${live(COMMAND)}\nimport { x } from "../../../adapters/src/session";\n`),
    ).not.toEqual([]);
  });
});

describe("TC-WATCHDOG-006 the new surface is brand-neutral", () => {
  test("the seed-literal matcher finds no product or binary literal in the new modules", () => {
    for (const file of [CONTRACT, DOMAIN, COMMAND]) {
      expect(seedLiteralViolations(registry, live(file), file)).toEqual([]);
    }
  });

  test("the injected brand renders wherever a binary name appears", () => {
    const definition = createWatchdogCommandDefinition({
      readLane: () => ({ ok: false, reason: "missing" }),
      git: {
        readCheckoutFacts: async () => ({ kind: "unreadable", detail: "not used" }),
        restoreCheckout: async () => ({ ok: true }),
        removePath: async () => ({ ok: true }),
        preserveCommit: async () => ({ ok: true }),
      },
      signalSources: [],
    });
    const rendered = definition.humanText?.(
      {
        schemaVersion: "delivery.watchdog.v1",
        probe: "preflight",
        lane: "lane-1",
        verdict: "ok",
        signals: {},
        evidence: "checkout clean on base main",
      },
      SYNTHETIC_BRAND,
    );
    expect(rendered).toBeDefined();
    expect(rendered ?? "").toContain(SYNTHETIC_BRAND.binaryName);
    expect(seedLiteralViolations(registry, rendered ?? "", "rendered")).toEqual([]);
  });

  test("a planted product literal in a temp copy fails the scanner naming file and token", () => {
    const root = mkdtempSync(join(tmpdir(), "watchdog-brand-"));
    try {
      mkdirSync(join(root, "packages/cli/src/commands"), { recursive: true });
      const mutated = `${live(COMMAND)}\nexport const planted = "ados";\n`;
      writeFileSync(join(root, COMMAND), mutated);
      expect(seedLiteralViolations(registry, mutated, COMMAND).join("\n")).toContain(
        `${COMMAND}: product literal ados`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-WATCHDOG-007 grammar exposes checks, never runner verbs", () => {
  test("the exported subcommand set is exactly preflight, teardown, liveness", () => {
    expect(WATCHDOG_PROBES).toEqual(["preflight", "teardown", "liveness"]);
    for (const verb of RUNNER_VERBS) {
      expect(WATCHDOG_PROBES).not.toContain(verb);
    }
  });

  test("the command definition declares read-only shape and no run/mutate flags", () => {
    const definition = createWatchdogCommandDefinition({
      readLane: () => ({ ok: false, reason: "missing" }),
      git: {
        readCheckoutFacts: async () => ({ kind: "unreadable", detail: "not used" }),
        restoreCheckout: async () => ({ ok: true }),
        removePath: async () => ({ ok: true }),
        preserveCommit: async () => ({ ok: true }),
      },
      signalSources: [],
    });
    expect(definition.flags).toEqual([]);
    expect(definition.positionals).toEqual({ max: 2 });
  });

  test("the command source declares no runner verb and a run-subcommand mutant fails", () => {
    expect(runnerVerbViolations(live(COMMAND))).toEqual([]);
    const mutant = `${live(COMMAND)}\nconst rogueSubcommand = "run";\n`;
    expect(runnerVerbViolations(mutant).join("\n")).toContain(`${COMMAND}: runner verb run`);
  });
});
