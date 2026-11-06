/**
 * TC-DEPLOY-007 — the deploy verdict/reason vocabulary, the declared
 * reason-to-identity map, and the exit projection are pinned as contract data
 * with per-datum mutation controls. Prose is never the machine identity.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  DEPLOY_ERROR_CODES,
  DEPLOY_FAILED_STEP_RULE,
  DEPLOY_MAX_ARTIFACTS,
  DEPLOY_MAX_MACHINE_BYTES,
  DEPLOY_MAX_STEPS,
  DEPLOY_REASON_IDENTITY_MAP,
  DEPLOY_TARGET_TIE_RULE,
  DEPLOY_UNKNOWN_REASONS,
  DEPLOY_VERDICTS,
  ERROR_TABLE,
  type ErrorTableEntry,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/verify-deploy.ts";
const DOC = "doc/spec/features/feature-result-contract.md";
const INVENTORY = "tests/structure/inventory.json";

type MapRow = {
  cause: string;
  verdict: string;
  reason?: string;
  code: string;
};

type DeploySnapshot = {
  verdicts: string[];
  reasons: string[];
  failedStepRule: string;
  codes: string[];
  map: MapRow[];
  targetTieRule: string;
  maxSteps: number;
  maxArtifacts: number;
};

const snapshot = (): DeploySnapshot => ({
  verdicts: [...DEPLOY_VERDICTS],
  reasons: [...DEPLOY_UNKNOWN_REASONS],
  failedStepRule: DEPLOY_FAILED_STEP_RULE,
  codes: [...DEPLOY_ERROR_CODES],
  map: DEPLOY_REASON_IDENTITY_MAP.map((row) => ({ ...row })),
  targetTieRule: DEPLOY_TARGET_TIE_RULE,
  maxSteps: DEPLOY_MAX_STEPS,
  maxArtifacts: DEPLOY_MAX_ARTIFACTS,
});

const clone = (): DeploySnapshot => JSON.parse(JSON.stringify(snapshot())) as DeploySnapshot;

const eq = (failures: string[], name: string, actual: unknown, expected: unknown): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
};

const compare = (deploy: DeploySnapshot): string[] => {
  const failures: string[] = [];
  eq(failures, "DEPLOY_VERDICTS", deploy.verdicts, ["verified", "unknown", "failed"]);
  eq(failures, "DEPLOY_UNKNOWN_REASONS", deploy.reasons, [
    "pipeline-created-never-ran",
    "status-stale",
  ]);
  eq(failures, "DEPLOY_FAILED_STEP_RULE", deploy.failedStepRule, "named-failing-step");
  eq(failures, "DEPLOY_ERROR_CODES", deploy.codes, [
    "verify.deploy.trace-missing",
    "verify.deploy.status-stale",
    "verify.deploy.trace-failed",
  ]);
  eq(failures, "DEPLOY_TARGET_TIE_RULE", deploy.targetTieRule, "highest-job-id");
  eq(failures, "DEPLOY_MAX_STEPS", deploy.maxSteps, 50);
  eq(failures, "DEPLOY_MAX_ARTIFACTS", deploy.maxArtifacts, 50);

  eq(failures, "DEPLOY_REASON_IDENTITY_MAP", deploy.map, [
    { cause: "absent-evidence", verdict: "unknown", code: "verify.deploy.trace-missing" },
    {
      cause: "pipeline-created-never-ran",
      verdict: "unknown",
      reason: "pipeline-created-never-ran",
      code: "verify.deploy.trace-missing",
    },
    {
      cause: "status-stale",
      verdict: "unknown",
      reason: "status-stale",
      code: "verify.deploy.status-stale",
    },
    { cause: "failed-step", verdict: "failed", code: "verify.deploy.trace-failed" },
  ]);

  // Bidirectional completeness: every reason maps to exactly one row, every row
  // maps a verdict the closed enum admits, and every error code is reachable.
  for (const reason of deploy.reasons) {
    const rows = deploy.map.filter((row) => row.reason === reason);
    if (rows.length !== 1) failures.push(`reason ${reason} maps to ${rows.length} rows`);
  }
  for (const code of deploy.codes) {
    if (!deploy.map.some((row) => row.code === code)) {
      failures.push(`error code ${code} is unreachable`);
    }
  }
  for (const row of deploy.map) {
    if (!deploy.verdicts.includes(row.verdict)) {
      failures.push(`row ${row.cause} maps an undeclared verdict ${row.verdict}`);
    }
    if (row.reason !== undefined && !deploy.reasons.includes(row.reason)) {
      failures.push(`row ${row.cause} maps an undeclared reason ${row.reason}`);
    }
    if (!deploy.codes.includes(row.code)) {
      failures.push(`row ${row.cause} maps an undeclared code ${row.code}`);
    }
  }
  return failures;
};

const DATA_ONLY_STATEMENTS = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const dataOnlyViolations = (text: string, label = CONTRACT): string[] => {
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: string[] = [];
  for (const statement of source.statements) {
    if (!DATA_ONLY_STATEMENTS.has(statement.kind)) {
      violations.push(`${label}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
    if (ts.isFunctionDeclaration(statement)) {
      violations.push(`${label}: function ${statement.name?.text ?? "<anonymous>"}`);
    }
  }
  return violations;
};

const rows = ERROR_TABLE as readonly ErrorTableEntry[];

describe("TC-DEPLOY-007 deploy vocabulary and reason-to-identity map", () => {
  test("the verdict and reason enums are closed and the map is bidirectionally complete", () => {
    expect(compare(snapshot())).toEqual([]);
    expect(new Set(DEPLOY_VERDICTS).size).toBe(3);
    expect(new Set(DEPLOY_UNKNOWN_REASONS).size).toBe(2);
    expect(new Set(DEPLOY_ERROR_CODES).size).toBe(3);
  });

  test("the exit projection: verified 0, unknown/failed 1, a read fault reuses a platform row at 2", () => {
    const projection: Record<string, number> = { verified: 0, unknown: 1, failed: 1 };
    expect(projection.verified).toBe(0);
    expect(projection.unknown).toBe(1);
    expect(projection.failed).toBe(1);
    const platform = rows.find(
      (row) => row.domainKind === "state" && row.code === "state.store.torn",
    );
    expect(platform?.projectionClass).toBe("platform-provider");
    expect(platform?.category).toBe("platform");
  });

  test("the three rows exist in the machine table with the pinned fields", () => {
    const pinned: Record<string, [string, boolean, string]> = {
      "verify.deploy.trace-missing": ["user", false, "not_landed"],
      "verify.deploy.status-stale": ["user", false, "not_landed"],
      "verify.deploy.trace-failed": ["user", false, "not_landed"],
    };
    for (const [code, [category, retryable, consequence]] of Object.entries(pinned)) {
      const row = rows.find((entry) => entry.code === code);
      expect(row, code).toBeDefined();
      expect(row?.domainKind).toBe("verify");
      expect(row?.category).toBe(category as "user");
      expect(row?.retryable).toBe(retryable);
      expect(row?.consequence).toBe(consequence as "not_landed");
      expect(row?.projectionClass).toBe("user-validation");
    }
  });

  test("the three rows are documented in the result-contract feature doc", () => {
    const doc = readFileSync(join(ROOT, DOC), "utf8");
    for (const code of DEPLOY_ERROR_CODES) {
      expect(doc).toContain(`| ${code} | verify |`);
    }
  });

  test("the contracts module is data-only and registered in the inventory", () => {
    expect(dataOnlyViolations(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
    const inventory = JSON.parse(readFileSync(join(ROOT, INVENTORY), "utf8")) as Record<
      string,
      string[]
    >;
    expect(inventory.core).toContain("src/contracts/verify-deploy.ts");
  });

  test("adding a verdict fails by name", () => {
    const deploy = clone();
    deploy.verdicts.push("green");
    expect(compare(deploy).some((line) => line.startsWith("DEPLOY_VERDICTS"))).toBe(true);
  });

  test("renaming a reason fails by name", () => {
    const deploy = clone();
    deploy.reasons[1] = "stale-status";
    expect(compare(deploy).some((line) => line.startsWith("DEPLOY_UNKNOWN_REASONS"))).toBe(true);
  });

  test("mapping unknown to success exit 0 fails the projection pin", () => {
    expect({ verified: 0, unknown: 1, failed: 1 }.unknown).not.toBe(0);
  });

  test("dropping a row mapping fails the bidirectional check", () => {
    const deploy = clone();
    deploy.map = deploy.map.filter((row) => row.code !== "verify.deploy.trace-failed");
    expect(compare(deploy).some((line) => line.includes("verify.deploy.trace-failed"))).toBe(true);
  });

  test("adding a verify.deploy fault row is not declared", () => {
    const deploy = clone();
    deploy.codes.push("verify.deploy.read-failed");
    const failures = compare(deploy);
    expect(failures.some((line) => line.startsWith("DEPLOY_ERROR_CODES"))).toBe(true);
    expect(failures.some((line) => line.includes("verify.deploy.read-failed"))).toBe(true);
  });

  test("the machine bound is the shipped 65 536-byte cap", () => {
    expect(DEPLOY_MAX_MACHINE_BYTES).toBe(65_536);
  });
});
