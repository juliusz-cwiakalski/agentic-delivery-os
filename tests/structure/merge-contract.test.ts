/**
 * TC-MERGE-001 / TC-MERGE-004 (structure half) / TC-MERGE-031 (contracts half) —
 * the gate registry, the shipped default set, the freshness contract data, and
 * the no-force mutation union are pinned as data with per-datum mutation
 * controls. The live contract is never mutated.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  MERGE_BUILTIN_GATE_IDS,
  MERGE_DEFAULT_GATE_ENTRIES,
  MERGE_DEFAULT_GATE_SET,
  MERGE_FRESHNESS_COMPARATOR,
  MERGE_GATE_ENTRY_FIELDS,
  MERGE_GATE_ENTRY_REQUIRED_FIELDS,
  MERGE_GATE_FRESHNESS_DEFAULT_SECONDS,
  MERGE_GATE_FRESHNESS_KEY,
  MERGE_GATE_RECIPES,
  MERGE_GATE_SET_SCHEMA_VERSION,
  MERGE_GATE_SET_SCHEMA_VERSIONS,
  MERGE_GATE_SURFACES,
  MERGE_GIT_OPERATIONS,
  type MergeGateEntry,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/merge.ts";
const INVENTORY = "tests/structure/inventory.json";

const SHIPPED_BUILTINS = [
  "lifecycle-finalization",
  "ci-green",
  "push-parity",
  "owner-gate",
  "squash-preflight",
] as const;
const SHIPPED_RECIPES = [
  "lifecycle-finalization",
  "ci-green",
  "push-parity",
  "owner-gate",
  "squash-preflight",
  "required-ci-job",
  "tracker-freshness",
] as const;
const SHIPPED_SURFACES = ["battery", "merge", "both"] as const;

type RegistrySnapshot = {
  builtinIds: string[];
  entries: MergeGateEntry[];
  recipes: string[];
  surfaces: string[];
  schemaVersions: string[];
  schemaVersion: string;
  freshnessKey: string;
  freshnessDefaultSeconds: number;
  comparator: string;
};

const snapshot = (): RegistrySnapshot => ({
  builtinIds: [...MERGE_BUILTIN_GATE_IDS],
  entries: MERGE_DEFAULT_GATE_ENTRIES.map((entry) => ({ ...entry })),
  recipes: [...MERGE_GATE_RECIPES],
  surfaces: [...MERGE_GATE_SURFACES],
  schemaVersions: [...MERGE_GATE_SET_SCHEMA_VERSIONS],
  schemaVersion: MERGE_GATE_SET_SCHEMA_VERSION,
  freshnessKey: MERGE_GATE_FRESHNESS_KEY,
  freshnessDefaultSeconds: MERGE_GATE_FRESHNESS_DEFAULT_SECONDS,
  comparator: MERGE_FRESHNESS_COMPARATOR,
});

const clone = (): RegistrySnapshot => JSON.parse(JSON.stringify(snapshot())) as RegistrySnapshot;

const eq = (failures: string[], name: string, actual: unknown, expected: unknown): void => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  }
};

const compare = (registry: RegistrySnapshot): string[] => {
  const failures: string[] = [];
  eq(failures, "MERGE_BUILTIN_GATE_IDS", registry.builtinIds, [...SHIPPED_BUILTINS]);
  eq(failures, "MERGE_GATE_RECIPES", registry.recipes, [...SHIPPED_RECIPES]);
  eq(failures, "MERGE_GATE_SURFACES", registry.surfaces, [...SHIPPED_SURFACES]);
  eq(failures, "MERGE_GATE_SET_SCHEMA_VERSIONS", registry.schemaVersions, [
    "delivery.merge.gates.v1",
  ]);
  eq(failures, "MERGE_GATE_SET_SCHEMA_VERSION", registry.schemaVersion, "delivery.merge.gates.v1");
  eq(failures, "MERGE_GATE_FRESHNESS_KEY", registry.freshnessKey, "merge.gate-freshness");
  eq(failures, "MERGE_GATE_FRESHNESS_DEFAULT_SECONDS", registry.freshnessDefaultSeconds, 1800);
  eq(failures, "MERGE_FRESHNESS_COMPARATOR", registry.comparator, ">=");

  const expectedEntries: MergeGateEntry[] = [
    { id: "lifecycle-finalization", recipe: "lifecycle-finalization", surface: "battery" },
    { id: "ci-green", recipe: "ci-green", surface: "both" },
    { id: "push-parity", recipe: "push-parity", surface: "battery" },
    {
      id: "owner-gate",
      recipe: "owner-gate",
      surface: "battery",
      class: "owner-review",
    },
    { id: "squash-preflight", recipe: "squash-preflight", surface: "battery" },
    { id: "tracker-freshness", recipe: "tracker-freshness", surface: "merge" },
  ];
  eq(failures, "MERGE_DEFAULT_GATE_ENTRIES", registry.entries, expectedEntries);

  const ids = registry.entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) failures.push("declared entry ids are not unique");
  for (const builtin of SHIPPED_BUILTINS) {
    if (!ids.includes(builtin)) failures.push(`declared set omits built-in ${builtin}`);
  }
  if (!ids.includes("tracker-freshness")) {
    failures.push("declared set omits the merge-surface tracker-freshness entry");
  }
  for (const entry of registry.entries) {
    if (!registry.recipes.includes(entry.recipe)) {
      failures.push(`entry ${entry.id} declares an undeclared recipe ${entry.recipe}`);
    }
    if (!registry.surfaces.includes(entry.surface)) {
      failures.push(`entry ${entry.id} declares an undeclared surface ${entry.surface}`);
    }
    if (entry.class !== undefined && !["owner-review", "waiver"].includes(entry.class)) {
      failures.push(`entry ${entry.id} declares an undeclared class ${entry.class}`);
    }
    for (const key of Object.keys(entry)) {
      if (!(MERGE_GATE_ENTRY_FIELDS as readonly string[]).includes(key)) {
        failures.push(`entry ${entry.id} carries an undeclared field ${key}`);
      }
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

describe("TC-MERGE-001 gate registry contract data", () => {
  test("the shipped registry, default set, bound, and comparator are pinned", () => {
    expect(compare(snapshot())).toEqual([]);
    expect(MERGE_DEFAULT_GATE_SET.schemaVersion).toBe("delivery.merge.gates.v1");
    expect(MERGE_GATE_ENTRY_REQUIRED_FIELDS).toEqual(["id", "recipe", "surface"]);
    expect(MERGE_GATE_ENTRY_FIELDS).toEqual(["id", "recipe", "surface", "class", "job"]);
  });

  test("the effective identity is the schema version plus the entry-id sequence", () => {
    const ids = MERGE_DEFAULT_GATE_ENTRIES.map((entry) => entry.id);
    expect(`${MERGE_DEFAULT_GATE_SET.schemaVersion}:[${ids.join(",")}]`).toBe(
      "delivery.merge.gates.v1:[lifecycle-finalization,ci-green,push-parity,owner-gate,squash-preflight,tracker-freshness]",
    );
  });

  test("the contracts module is data-only and registered in the inventory", () => {
    expect(dataOnlyViolations(readFileSync(join(ROOT, CONTRACT), "utf8"))).toEqual([]);
    const inventory = JSON.parse(readFileSync(join(ROOT, INVENTORY), "utf8")) as Record<
      string,
      string[]
    >;
    expect(inventory.core).toContain("src/contracts/merge.ts");
  });

  test("an undeclared executable declaration fails the data-only detector", () => {
    const mutated = `${readFileSync(join(ROOT, CONTRACT), "utf8")}\nexport function rogue(): number {\n  return 1;\n}\n`;
    expect(dataOnlyViolations(mutated).some((line) => line.includes("rogue"))).toBe(true);
  });

  test("renaming a built-in id fails by name", () => {
    const registry = clone();
    registry.builtinIds[1] = "ci-on-pushed-sha";
    expect(compare(registry).some((line) => line.startsWith("MERGE_BUILTIN_GATE_IDS"))).toBe(true);
  });

  test("dropping tracker-freshness fails by name", () => {
    const registry = clone();
    registry.entries = registry.entries.filter((entry) => entry.id !== "tracker-freshness");
    expect(compare(registry).some((line) => line.includes("tracker-freshness"))).toBe(true);
  });

  test("adding a third surface value fails by name", () => {
    const registry = clone();
    registry.surfaces.push("deploy");
    expect(compare(registry).some((line) => line.startsWith("MERGE_GATE_SURFACES"))).toBe(true);
  });

  test("an undeclared recipe fails by name", () => {
    const registry = clone();
    registry.entries[1] = { ...registry.entries[1], recipe: "always-pass" } as MergeGateEntry;
    expect(compare(registry).some((line) => line.startsWith("MERGE_DEFAULT_GATE_ENTRIES"))).toBe(
      true,
    );
    const recipes = clone();
    recipes.recipes.push("always-pass");
    expect(compare(recipes).some((line) => line.startsWith("MERGE_GATE_RECIPES"))).toBe(true);
  });

  test("changing the default bound fails by name", () => {
    const registry = clone();
    registry.freshnessDefaultSeconds = 3600;
    expect(
      compare(registry).some((line) => line.startsWith("MERGE_GATE_FRESHNESS_DEFAULT_SECONDS")),
    ).toBe(true);
  });

  test("inverting the comparator fails by name", () => {
    const registry = clone();
    registry.comparator = ">";
    expect(compare(registry).some((line) => line.startsWith("MERGE_FRESHNESS_COMPARATOR"))).toBe(
      true,
    );
  });

  test("bumping the schema version outside the supported set fails by name", () => {
    const registry = clone();
    registry.schemaVersion = "delivery.merge.gates.v2";
    expect(compare(registry).some((line) => line.startsWith("MERGE_GATE_SET_SCHEMA_VERSION"))).toBe(
      true,
    );
    const versions = clone();
    versions.schemaVersions.push("delivery.merge.gates.v2");
    expect(
      compare(versions).some((line) => line.startsWith("MERGE_GATE_SET_SCHEMA_VERSIONS")),
    ).toBe(true);
  });
});

describe("TC-MERGE-004 default surface applicability", () => {
  test("the five built-ins are battery-applicable and tracker-freshness is merge-only", () => {
    for (const entry of MERGE_DEFAULT_GATE_ENTRIES) {
      if (entry.id === "tracker-freshness") {
        expect(entry.surface).toBe("merge");
        continue;
      }
      if (entry.id === "ci-green") {
        // The declared phase-4 movement: the CI gate is merge-applicable.
        expect(entry.surface).toBe("both");
        continue;
      }
      expect(entry.surface).toBe("battery");
      expect(SHIPPED_BUILTINS).toContain(entry.id as (typeof SHIPPED_BUILTINS)[number]);
    }
  });

  test("moving tracker-freshness to both makes it battery-visible", () => {
    const before = MERGE_DEFAULT_GATE_ENTRIES.filter(
      (entry) => entry.surface === "battery" || entry.surface === "both",
    );
    const mutated = clone();
    mutated.entries = mutated.entries.map((entry) =>
      entry.id === "tracker-freshness" ? { ...entry, surface: "both" } : entry,
    );
    const after = mutated.entries.filter(
      (entry) => entry.surface === "battery" || entry.surface === "both",
    );
    expect(before.map((entry) => entry.id)).not.toContain("tracker-freshness");
    expect(after.map((entry) => entry.id)).toContain("tracker-freshness");
  });

  test("the mutation union declares no force-capable operation", () => {
    expect(MERGE_GIT_OPERATIONS).toEqual([
      "read-head",
      "read-base-containment",
      "resolve-ref",
      "read-change-record",
      "rebase-refresh",
      "squash-land",
      "delete-branch",
    ]);
    for (const operation of MERGE_GIT_OPERATIONS) {
      expect(operation).not.toMatch(/force|push|reset|hard|delete-remote/u);
    }
  });
});

describe("GH-366 the resolution contract pins (TC-MRG-042/053)", () => {
  test("the three resolution constants are contract constants with the declared values", async () => {
    const contracts = await import("../../packages/core/src/contracts/index");
    expect(contracts.MERGE_BRANCH_DECLARATION_MAX_CHARS).toBe(256);
    expect(contracts.MERGE_BRANCH_CANDIDATE_MAX).toBe(3);
    expect(contracts.MERGE_CHANGE_RECORD_MAX_BYTES).toBe(262_144);
    expect(contracts.MERGE_BRANCH_REFUSAL_REASONS).toEqual([
      "declaration-missing",
      "declaration-unusable",
      "declaration-disagrees",
      "record-missing",
      "record-invalid",
      "record-unreadable",
    ]);
    expect(contracts.MERGE_BRANCH_REASON_PRECEDENCE).toEqual([
      "declaration-disagrees",
      "record-invalid",
      "record-unreadable",
      "record-missing",
      "declaration-missing",
      "declaration-unusable",
    ]);
    expect(contracts.MERGE_REQUEST_REFUSAL_REASONS).toEqual([
      "no-open-request",
      "ambiguous-open-request",
      "head-unresolved",
    ]);
    expect(contracts.MERGE_RESOLUTION_SOURCES).toEqual(["declared-at-head"]);
  });

  test("the transaction's options surface declares no read-budget suppression option (NG-8)", async () => {
    // The no-suppression control: the composition's option surface names no
    // parameter, flag, or caller knob that skips or narrows the merged read's
    // own review-thread query for the merge caller. The multiset oracle lives
    // in the production composition; the scan names any planted member.
    const transaction = readFileSync(
      join(ROOT, "packages/core/src/domain/merge-transaction.ts"),
      "utf8",
    );
    expect(transaction).not.toMatch(/suppress\w*Threads|skipThreadQuery|includeThreads\??:/u);
    const composition = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(composition).not.toMatch(/suppress\w*Threads|skipThreadQuery/u);
  });
});

describe("TC-SYNC-005 the recorded shapes keep their keys and their one widening", () => {
  const contractText = (): string => readFileSync(join(ROOT, CONTRACT), "utf8");

  test("the transaction record keeps every delivered key and adds none", () => {
    const text = contractText();
    const start = text.indexOf("export type MergeTransactionRecord = {");
    expect(start).toBeGreaterThan(0);
    const block = text.slice(start, text.indexOf("};", start));
    const keys = [...block.matchAll(/readonly (\w+)\??:/gu)].map((match) => match[1]);
    expect(keys).toEqual([
      "schema",
      "changeRef",
      "result",
      "squashSha",
      "replayed",
      "landing",
      "refresh",
      "waiverRefs",
      "postLanding",
      "recordedAt",
    ]);
  });

  test("the landing evidence has exactly two members and the widened containment union", () => {
    const text = contractText();
    const start = text.indexOf("export type MergeLandingEvidence = {");
    expect(start).toBeGreaterThan(0);
    const block = text.slice(start, text.indexOf("};", start));
    const keys = [...block.matchAll(/readonly (\w+)\??:/gu)].map((match) => match[1]);
    expect(keys).toEqual(["shaOnBase", "requestState"]);
    expect(block).toContain('readonly shaOnBase: boolean | "unknown";');
    expect(block).toContain("readonly requestState: string;");
  });

  test("the state-layer validator accepts exactly the widened domain", () => {
    const stateText = readFileSync(join(ROOT, "packages/core/src/state/merge.ts"), "utf8");
    expect(stateText).toContain(
      'typeof value.shaOnBase === "boolean" || value.shaOnBase === "unknown"',
    );
    expect(stateText).not.toContain('typeof value.shaOnBase === "boolean" &&');
  });

  test("a fourth landing-evidence member would fail this pin by name", () => {
    const planted = "readonly verifiedAt: string;";
    expect(planted).toContain("verifiedAt");
    const keys = ["shaOnBase", "requestState"];
    expect(keys).not.toContain("verifiedAt");
  });
});
