/**
 * TC-MERGE-031 — the merge/deploy contracts are data-only, the pure domain
 * modules import contracts (or intra-domain modules) only, and every new module
 * is registered in the committed inventory. A negative fixture proves each rule.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import * as mergeGateSet from "../../packages/core/src/domain/merge-gate-set";
import * as mergeProbe from "../../packages/core/src/domain/merge-probe";
import * as mergeWaiver from "../../packages/core/src/domain/merge-waiver";
import * as verifyDeploy from "../../packages/core/src/domain/verify-deploy";

const ROOT = process.cwd();

const CONTRACTS = [
  "packages/core/src/contracts/merge.ts",
  "packages/core/src/contracts/verify-deploy.ts",
] as const;
const DOMAIN = [
  "packages/core/src/domain/merge-gate-set.ts",
  "packages/core/src/domain/merge-freshness.ts",
  "packages/core/src/domain/merge-waiver.ts",
  "packages/core/src/domain/merge-probe.ts",
  "packages/core/src/domain/merge-transaction.ts",
  "packages/core/src/domain/verify-deploy.ts",
] as const;

const parse = (path: string, text: string): ts.SourceFile =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

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

const contractsDataOnly = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!DATA_ONLY.has(statement.kind)) {
      violations.push(`executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
  }
  for (const specifier of specifiersOf(source)) {
    if (specifier.startsWith("node:") || specifier.startsWith("bun:")) {
      violations.push(`runtime import ${specifier}`);
    }
  }
  return violations;
};

const domainPure = (source: ts.SourceFile): string[] => {
  const violations: string[] = [];
  for (const specifier of specifiersOf(source)) {
    const allowed =
      specifier === "#contracts" || specifier.startsWith("#domain/") || specifier.startsWith("./");
    if (!allowed) violations.push(`domain import ${specifier}`);
  }
  for (const name of callNames(source)) {
    if (
      [
        "Date.now",
        "Math.random",
        "process.env",
        "readFileSync",
        "readdirSync",
        "existsSync",
        "writeFileSync",
        "execFile",
        "execFileSync",
        "spawn",
        "spawnSync",
        "fetch",
      ].includes(name)
    ) {
      violations.push(`impure call ${name}`);
    }
  }
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "env" &&
      ts.isIdentifier(node.expression) &&
      ["process", "Bun"].includes(node.expression.text)
    ) {
      violations.push(`ambient environment read ${node.getText(source)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
};

describe("TC-MERGE-031 merge/deploy imports and purity", () => {
  test("the new contracts modules are data-only", () => {
    for (const path of CONTRACTS) {
      const source = parse(path, readFileSync(join(ROOT, path), "utf8"));
      expect(contractsDataOnly(source), path).toEqual([]);
    }
  });

  test("a contracts function or runtime import fails the data-only rule", () => {
    const functionFixture = parse(
      "fixture.ts",
      "export function rogue(): number {\n  return 1;\n}\n",
    );
    expect(contractsDataOnly(functionFixture).length).toBeGreaterThan(0);
    const importFixture = parse("fixture.ts", 'import fs from "node:fs";\n');
    expect(contractsDataOnly(importFixture).length).toBeGreaterThan(0);
  });

  test("the new domain modules are pure and import only contracts or intra-domain modules", () => {
    for (const path of DOMAIN) {
      const source = parse(path, readFileSync(join(ROOT, path), "utf8"));
      expect(domainPure(source), path).toEqual([]);
    }
  });

  test("a domain module importing an adapter, state, CLI, clock, or network fails the rule", () => {
    for (const fixture of [
      'import "@delivery-os/adapters/git";\n',
      'import "#state/index";\n',
      'import "../commands/merge.js";\n',
      "export const now = (): number => Date.now();\n",
      "export const value = (): number => Math.random();\n",
      "export const value = process.env.EXAMPLE;\n",
      'import fs from "node:fs";\n',
    ]) {
      expect(domainPure(parse("fixture.ts", fixture)).length, fixture).toBeGreaterThan(0);
    }
  });

  test("the new modules are registered in the committed inventory", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    for (const path of [...CONTRACTS, ...DOMAIN]) {
      const relative = path.replace("packages/core/", "");
      expect(inventory.core, path).toContain(relative);
    }
  });

  test("the pure engines evaluate injected data without ambient sentinels", () => {
    const resolved = mergeGateSet.resolveMergeGateSet(undefined);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.ids).toContain("tracker-freshness");
      expect(mergeGateSet.mergeGateSetIdentity(resolved.value)).toContain(
        "delivery.merge.gates.v1",
      );
    }
    const posture = mergeProbe.postureOf(["hand-back", "change"]);
    expect(posture.ownerLabels).toEqual(["hand-back"]);
    const verdict = mergeWaiver.authorizeMergeWaiver({
      declaration: { gateId: "owner-gate", authorizer: "owner-principal" },
      changeRef: "GH-1",
      entry: { id: "owner-gate", recipe: "owner-gate", surface: "battery", class: "owner-review" },
      policy: {
        comparator: ">=",
        escalationThresholdMs: 1,
        expiryThresholdMs: 2,
        rows: [
          {
            kind: "owner-review",
            class: "owner-review",
            neverMerge: true,
            defaultable: false,
            default: null,
            waiverAuthorization: "owner-authored",
          },
        ],
      },
      ownerPrincipal: "owner-principal",
      authorizedAt: "2026-11-06T12:00:00Z",
    });
    expect(verdict.ok).toBe(true);
    const deploy = verifyDeploy.evaluateDeploy({
      expectation: undefined,
      trace: { jobId: "1", pipelineName: "deploy", located: false, steps: [], artifacts: [] },
    });
    expect(deploy.verdict).toBe("unknown");
  });
});
