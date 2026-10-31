/**
 * TC-STATUS-008 — declared constants and closed vocabularies bound to
 * Appendix C, plus in-memory/temp-copy mutation controls.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import type { StatusProviderEntry } from "../../packages/core/src/contracts/index";
import {
  STATUS_CI_RESULTS,
  STATUS_DEPENDENCY_STATES,
  STATUS_EVIDENCE_OUTCOMES,
  STATUS_EVIDENCE_REASONS,
  STATUS_EVIDENCE_SOURCES,
  STATUS_HYGIENE_FINDINGS,
  STATUS_MAX_DETAIL_CHARS,
  STATUS_MAX_EVIDENCE_SOURCES,
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_ITEMS_PER_SECTION,
  STATUS_MAX_MACHINE_BYTES,
  STATUS_MAX_OPEN_PULL_REQUESTS,
  STATUS_MAX_PARKED_CHANGES,
  STATUS_MAX_PIPELINE_RUNS,
  STATUS_MAX_PROVIDER_ENTRIES,
  STATUS_MAX_PROVIDER_PARKS,
  STATUS_MAX_REASONS,
  STATUS_MAX_TITLE_CHARS,
  STATUS_MAX_TRACKER_FAMILY_ITEMS,
  STATUS_OWNER_ATTENTION_LABELS,
  STATUS_PARKED_ITEM_STATES,
  STATUS_PROVIDER_AVAILABILITY,
  STATUS_PROVIDER_CHAIN_STATES,
  STATUS_SCHEMA_VERSION,
  STATUS_SECTION_ORDER,
  STATUS_SECTION_STATES,
  STATUS_SECTION_TITLES,
  STATUS_SOURCE_ITEM_LIMIT,
  STATUS_SOURCE_PIPELINE_LIMIT,
  STATUS_STALL_STATES,
  STATUS_STALL_THRESHOLD_DAYS,
  STATUS_TRACKER_FAMILIES,
  STATUS_TRACKER_FAMILY_STATES,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const SPEC = "doc/changes/2026-10/2026-10-31--GH-175--status-v1/chg-GH-175-spec.md";
const CONTRACT = "packages/core/src/contracts/status.ts";

const EXPECTED_REASONS = [
  "observed",
  "observed-empty",
  "read-failed",
  "source-unavailable",
  "signal-unavailable",
  "addressing-unresolved",
  "remote-unsupported",
  "credential-unavailable",
  "config-invalid",
  "state-unreadable",
  "commit-unresolved",
  "provider-chain-not-declared",
  "provider-chain-unresolved",
  "local-context-missing",
  "local-context-malformed",
  "local-state-untracked",
  "engine-not-delivered",
  "source-truncated",
  "item-signal-absent",
  "partial-evidence",
];

const EXPECTED_SOURCES = [
  "tracker",
  "changes",
  "ci",
  "queue-engine",
  "provider-config",
  "provider-parks",
  "local-context",
  "repository-binding",
];

type ConstantSnapshot = {
  readonly order: readonly string[];
  readonly states: readonly string[];
  readonly reasons: readonly string[];
  readonly sources: readonly string[];
  readonly outcomes: readonly string[];
  readonly caps: Readonly<Record<string, number>>;
  readonly labels: readonly string[];
  readonly schema: string;
  readonly titles: Readonly<Record<string, string>>;
};

export const liveSnapshot = (): ConstantSnapshot => ({
  order: [...STATUS_SECTION_ORDER],
  states: [...STATUS_SECTION_STATES],
  reasons: [...STATUS_EVIDENCE_REASONS],
  sources: [...STATUS_EVIDENCE_SOURCES],
  outcomes: [...STATUS_EVIDENCE_OUTCOMES],
  caps: {
    STATUS_MAX_ITEMS_PER_SECTION,
    STATUS_MAX_TRACKER_FAMILY_ITEMS,
    STATUS_MAX_EVIDENCE_SOURCES,
    STATUS_MAX_REASONS,
    STATUS_MAX_PROVIDER_ENTRIES,
    STATUS_MAX_PROVIDER_PARKS,
    STATUS_MAX_PIPELINE_RUNS,
    STATUS_MAX_OPEN_PULL_REQUESTS,
    STATUS_MAX_PARKED_CHANGES,
    STATUS_SOURCE_ITEM_LIMIT,
    STATUS_SOURCE_PIPELINE_LIMIT,
    STATUS_MAX_TITLE_CHARS,
    STATUS_MAX_DETAIL_CHARS,
    STATUS_MAX_HUMAN_LINES,
    STATUS_MAX_HUMAN_BYTES,
    STATUS_MAX_MACHINE_BYTES,
    STATUS_STALL_THRESHOLD_DAYS,
  },
  labels: [...STATUS_OWNER_ATTENTION_LABELS],
  schema: STATUS_SCHEMA_VERSION,
  titles: { ...STATUS_SECTION_TITLES },
});

const EXPECTED_CAPS: Readonly<Record<string, number>> = {
  STATUS_MAX_ITEMS_PER_SECTION: 8,
  STATUS_MAX_TRACKER_FAMILY_ITEMS: 4,
  STATUS_MAX_EVIDENCE_SOURCES: 6,
  STATUS_MAX_REASONS: 6,
  STATUS_MAX_PROVIDER_ENTRIES: 8,
  STATUS_MAX_PROVIDER_PARKS: 8,
  STATUS_MAX_PIPELINE_RUNS: 8,
  STATUS_MAX_OPEN_PULL_REQUESTS: 8,
  STATUS_MAX_PARKED_CHANGES: 8,
  STATUS_SOURCE_ITEM_LIMIT: 100,
  STATUS_SOURCE_PIPELINE_LIMIT: 20,
  STATUS_MAX_TITLE_CHARS: 120,
  STATUS_MAX_DETAIL_CHARS: 160,
  STATUS_MAX_HUMAN_LINES: 24,
  STATUS_MAX_HUMAN_BYTES: 4096,
  STATUS_MAX_MACHINE_BYTES: 65536,
  STATUS_STALL_THRESHOLD_DAYS: 14,
};

const EXPECTED_ORDER = [
  "tracker",
  "changes-and-prs",
  "ci",
  "lanes-or-queue",
  "providers",
  "parked-work",
];
const EXPECTED_STATES = ["observed", "degraded", "unknown", "unavailable", "not-delivered"];
const EXPECTED_OUTCOMES = ["read", "observed-empty", "failed", "not-configured", "not-delivered"];
const EXPECTED_TITLES: Record<string, string> = {
  tracker: "Tracker",
  "changes-and-prs": "Changes and pull requests",
  ci: "CI",
  "lanes-or-queue": "Lanes or queue",
  providers: "Providers",
  "parked-work": "Parked work",
};

const compareSnapshot = (candidate: ConstantSnapshot): string[] => {
  const failures: string[] = [];
  const eq = (name: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
  };
  eq("STATUS_SECTION_ORDER", candidate.order, EXPECTED_ORDER);
  eq("STATUS_SECTION_STATES", candidate.states, EXPECTED_STATES);
  eq("STATUS_EVIDENCE_REASONS", candidate.reasons, EXPECTED_REASONS);
  eq("STATUS_EVIDENCE_SOURCES", candidate.sources, EXPECTED_SOURCES);
  eq("STATUS_EVIDENCE_OUTCOMES", candidate.outcomes, EXPECTED_OUTCOMES);
  for (const [name, expected] of Object.entries(EXPECTED_CAPS)) {
    eq(name, candidate.caps[name], expected);
  }
  eq("STATUS_OWNER_ATTENTION_LABELS", candidate.labels, ["hand-back", "human-input-needed"]);
  eq("STATUS_SCHEMA_VERSION", candidate.schema, "delivery.status.v1");
  eq("STATUS_SECTION_TITLES", candidate.titles, EXPECTED_TITLES);
  eq("STATUS_TRACKER_FAMILIES", STATUS_TRACKER_FAMILIES, [
    "ownerHandBacks",
    "blockedDependencies",
    "stalls",
    "hygiene",
  ]);
  eq("STATUS_TRACKER_FAMILY_STATES", STATUS_TRACKER_FAMILY_STATES, ["observed", "unavailable"]);
  eq("STATUS_DEPENDENCY_STATES", STATUS_DEPENDENCY_STATES, ["open", "unknown"]);
  eq("STATUS_STALL_STATES", STATUS_STALL_STATES, ["stalled", "unknown"]);
  eq("STATUS_HYGIENE_FINDINGS", STATUS_HYGIENE_FINDINGS, ["missing-title", "missing-labels"]);
  eq("STATUS_CI_RESULTS", STATUS_CI_RESULTS, [
    "failed",
    "pending",
    "succeeded",
    "canceled",
    "none",
    "unknown",
  ]);
  eq("STATUS_PROVIDER_CHAIN_STATES", STATUS_PROVIDER_CHAIN_STATES, [
    "declared",
    "parked",
    "absent",
    "unknown",
  ]);
  eq("STATUS_PROVIDER_AVAILABILITY", STATUS_PROVIDER_AVAILABILITY, ["parked", "unverified"]);
  eq("STATUS_PARKED_ITEM_STATES", STATUS_PARKED_ITEM_STATES, ["observed", "unknown"]);
  return failures;
};

const cloneSnapshot = (snapshot: ConstantSnapshot): ConstantSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as ConstantSnapshot;

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

describe("TC-STATUS-008 declared constants bind Appendix C", () => {
  test("the live constants equal the Appendix C vocabulary and bounds", () => {
    expect(compareSnapshot(liveSnapshot())).toEqual([]);
    expect(STATUS_SECTION_ORDER).toHaveLength(6);
    expect(STATUS_EVIDENCE_REASONS).toHaveLength(20);
    expect(STATUS_EVIDENCE_SOURCES).toHaveLength(8);
  });

  test("StatusProviderEntry binds the emitted quota and peak declarations", () => {
    const entry: StatusProviderEntry = {
      name: "primary",
      class: "subscription",
      enabled: true,
      availability: "unverified",
      quotaDeclared: false,
      peakDeclared: false,
    };
    expect(Object.keys(entry).sort()).toEqual(
      ["availability", "class", "enabled", "name", "peakDeclared", "quotaDeclared"].sort(),
    );
    expect(typeof entry.peakDeclared).toBe("boolean");
  });

  test("the contracts module is data-only", () => {
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(dataOnlyViolations(text)).toEqual([]);
  });

  test("the spec reference is read-only and still names the pinned bounds", () => {
    const path = join(ROOT, SPEC);
    const before = statSync(path).mtimeMs;
    const text = readFileSync(path, "utf8");
    expect(text).toContain("STATUS_SOURCE_ITEM_LIMIT");
    expect(text).toContain("STATUS_SOURCE_PIPELINE_LIMIT");
    expect(text).toContain("delivery.status.v1");
    expect(statSync(path).mtimeMs).toBe(before);
  });

  test("the status modules are registered in the committed inventory", () => {
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/contracts/status.ts");
    expect(inventory.core).toContain("src/domain/status.ts");
  });

  test("an undeclared executable declaration fails the data-only detector", () => {
    const mutated = `${readFileSync(join(ROOT, CONTRACT), "utf8")}\nexport function rogue(): number {\n  return 1;\n}\n`;
    expect(dataOnlyViolations(mutated).some((line) => line.includes("rogue"))).toBe(true);
  });

  test("reordering the section order fails by constant name", () => {
    const snapshot = cloneSnapshot(liveSnapshot());
    const mutated: ConstantSnapshot = {
      ...snapshot,
      order: [...snapshot.order].reverse(),
    };
    const failures = compareSnapshot(mutated);
    expect(failures.some((line) => line.startsWith("STATUS_SECTION_ORDER"))).toBe(true);
  });

  test("renaming a state fails by constant name", () => {
    const snapshot = cloneSnapshot(liveSnapshot());
    const states = [...snapshot.states];
    states[0] = "clear";
    const failures = compareSnapshot({ ...snapshot, states });
    expect(failures.some((line) => line.startsWith("STATUS_SECTION_STATES"))).toBe(true);
  });

  test("dropping a reason fails naming the reason set", () => {
    const snapshot = cloneSnapshot(liveSnapshot());
    const failures = compareSnapshot({
      ...snapshot,
      reasons: snapshot.reasons.slice(0, -1),
    });
    expect(failures.some((line) => line.startsWith("STATUS_EVIDENCE_REASONS"))).toBe(true);
  });

  test("changing a cap fails by constant name", () => {
    const snapshot = cloneSnapshot(liveSnapshot());
    const failures = compareSnapshot({
      ...snapshot,
      caps: { ...snapshot.caps, STATUS_MAX_TRACKER_FAMILY_ITEMS: 5 },
    });
    expect(failures.some((line) => line.startsWith("STATUS_MAX_TRACKER_FAMILY_ITEMS"))).toBe(true);
  });

  test("changing the schema version fails by constant name", () => {
    const snapshot = cloneSnapshot(liveSnapshot());
    const failures = compareSnapshot({ ...snapshot, schema: "delivery.status.v2" });
    expect(failures.some((line) => line.startsWith("STATUS_SCHEMA_VERSION"))).toBe(true);
  });
});
