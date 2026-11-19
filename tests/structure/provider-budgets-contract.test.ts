/**
 * GH-350 TC-CONFORM-003 / TC-BUD-016 — the budget surface is the declared one,
 * and exactly one measurement path feeds both the report and the gate.
 *
 * The inventory fixture pins the contracts surface; this suite adds the
 * budget-specific half the fixture cannot express (the five evidence fields in
 * their declared positions and the closed tie order), then proves structurally
 * that no second fold and no new state kind exist on the gate's path.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  ANNOUNCEMENT_CODES,
  ANNOUNCEMENT_EVIDENCE_FIELDS,
  PARK_CAUSES,
  PARK_EVIDENCE_FIELDS,
  PROVIDER_BUDGET_BASES,
  PROVIDER_BUDGET_SCOPES,
  PROVIDER_CONDITION_KINDS,
  PROVIDER_CONDITION_TIE_ORDER,
  PROVIDER_RECORD_KINDS,
  PROVIDER_SKIP_REASONS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const inventory = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/provider/contract-inventory.json"), "utf8"),
) as {
  readonly exports: readonly string[];
  readonly closedSets: Record<string, readonly string[]>;
  readonly evidence: Record<string, readonly string[]>;
};

describe("TC-CONFORM-003 the budget vocabulary is the declared one", () => {
  test("the contract inventory carries the budget, totals and ref exports", () => {
    for (const name of [
      "ProviderBudgetBasis",
      "ProviderBudgetDeclaration",
      "ProviderBudgetFacts",
      "ProviderBudgetOutcome",
      "ProviderBudgetScope",
      "ProviderSpendTotals",
      "ProviderSpendTotalsInput",
      "ProviderSpendTotalsPort",
      "ProviderSpendTotalsRead",
      "ProviderSpendTotalsScope",
      "ProviderWorkItemRefResolution",
      "ProviderWorkItemRefResolver",
    ]) {
      expect(inventory.exports, name).toContain(name);
    }
  });

  test("the closed sets carry the budget members in their declared positions", () => {
    expect(PROVIDER_CONDITION_KINDS).toHaveLength(6);
    expect(PROVIDER_CONDITION_KINDS.indexOf("budget-exhausted")).toBe(2);
    expect(PARK_CAUSES.indexOf("budget-exhausted")).toBe(2);
    expect(PROVIDER_SKIP_REASONS.indexOf("budget-exhausted")).toBe(3);
    expect(ANNOUNCEMENT_CODES).toContain("provider.budget.parked");
    expect(ANNOUNCEMENT_CODES).toContain("provider.budget.crossed");
    expect(PROVIDER_BUDGET_SCOPES).toEqual(["ticket", "window"]);
    expect(PROVIDER_BUDGET_BASES).toEqual(["cost", "tokens"]);
    expect(PROVIDER_CONDITION_TIE_ORDER).toEqual([
      "peak-window",
      "quota-exhausted",
      "budget-exhausted",
      "provider-outage",
      "credential-missing",
      "credential-rejected",
    ]);
    expect(inventory.closedSets.conditionKinds).toEqual([...PROVIDER_CONDITION_KINDS]);
    expect(inventory.closedSets.skipReasons).toEqual([...PROVIDER_SKIP_REASONS]);
    expect(inventory.closedSets.announcementCodes).toEqual([...ANNOUNCEMENT_CODES]);
    expect(inventory.closedSets.budgetScopes).toEqual([...PROVIDER_BUDGET_SCOPES]);
    expect(inventory.closedSets.budgetBases).toEqual([...PROVIDER_BUDGET_BASES]);
  });

  test("the five budget evidence fields sit in their declared allowlist positions", () => {
    expect(PARK_EVIDENCE_FIELDS).toHaveLength(14);
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS).toHaveLength(17);
    const base = [
      "providerName",
      "chainName",
      "conditionKinds",
      "waitSeconds",
      "resetEpochMs",
      "httpStatus",
      "failureClass",
      "credentialRefName",
    ];
    expect(PARK_EVIDENCE_FIELDS.slice(0, 8)).toEqual(base);
    expect(PARK_EVIDENCE_FIELDS[8]).toBe("timezone");
    expect(PARK_EVIDENCE_FIELDS.slice(9)).toEqual([
      "budgetName",
      "budgetScope",
      "budgetBasis",
      "budgetMeasured",
      "budgetCeiling",
    ]);
    // The stated arithmetic: eight delivered base fields + timezone + five = 14.
    expect(PARK_EVIDENCE_FIELDS.length).toBe(base.length + 1 + 5);
    expect(ANNOUNCEMENT_EVIDENCE_FIELDS.length).toBe(base.length + 1 + 5 + 3);
    expect(inventory.evidence.park).toEqual([...PARK_EVIDENCE_FIELDS]);
    expect(inventory.evidence.announcement).toEqual([...ANNOUNCEMENT_EVIDENCE_FIELDS]);
  });
});

describe("TC-BUD-016 exactly one measurement path, no counter, no new record kind", () => {
  test("no new provider record kind exists", () => {
    expect(PROVIDER_RECORD_KINDS).toEqual(["provider.park", "provider.announcement"]);
  });

  test("the budget tier performs no I/O: no store, no fold, no ledger read", () => {
    const providerDirectory = join(ROOT, "packages/core/src/provider");
    for (const file of readdirSync(providerDirectory).filter((name) => name.endsWith(".ts"))) {
      const text = readFileSync(join(providerDirectory, file), "utf8");
      expect(text, file).not.toContain("readSpendLedger");
      expect(text, file).not.toContain("computeSpendReport");
      expect(text, `${file}: state import`).not.toContain("#state");
    }
  });

  test("the one fold is reachable only from the edge and the spend domain", () => {
    const owners: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".ts")) {
          const text = readFileSync(path, "utf8");
          if (/\bcomputeSpendReport\b/u.test(text)) owners.push(path.slice(ROOT.length + 1));
        }
      }
    };
    walk(join(ROOT, "packages"));
    expect(owners.sort()).toEqual([
      "packages/cli/src/edge.ts",
      "packages/core/src/domain/index.ts",
      "packages/core/src/domain/spend.ts",
      "packages/core/src/index.ts",
    ]);
  });

  test("the budget evaluator constructs no record and writes nothing", () => {
    const text = readFileSync(join(ROOT, "packages/core/src/provider/budgets.ts"), "utf8");
    for (const forbidden of ["createParkRecord", "createAnnouncementRecord", "persist", "write"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });
});
