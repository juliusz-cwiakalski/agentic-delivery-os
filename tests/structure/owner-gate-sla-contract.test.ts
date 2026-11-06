/**
 * TC-SLA-001 and the TC-SLA-012 contract half — the PDR-0003 policy map,
 * thresholds, comparator, states, markers, audiences, and caps are pinned as
 * contract data with per-datum deep-copy mutation controls.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  BOARD_COLLECTOR_ERROR_PREFIX,
  BOARD_COLLECTOR_ERROR_SUFFIX,
  BOARD_COLLECTOR_IDS,
  BOARD_MAX_GATES,
  BOARD_MAX_HUMAN_BYTES,
  BOARD_MAX_HUMAN_LINES,
  BOARD_MAX_MACHINE_BYTES,
  BOARD_SCHEMA_VERSION,
  OWNER_GATE_CLASSES,
  OWNER_GATE_KINDS,
  OWNER_GATE_SLA_AUDIENCES,
  OWNER_GATE_SLA_CLOCK_SOURCE,
  OWNER_GATE_SLA_COMPARATOR,
  OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA,
  OWNER_GATE_SLA_DECISION_RECORD_KIND,
  OWNER_GATE_SLA_DEFAULTS,
  OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS,
  OWNER_GATE_SLA_EXPIRY_THRESHOLD_MS,
  OWNER_GATE_SLA_POLICY,
  OWNER_GATE_SLA_RANK_STATE_ORDER,
  OWNER_GATE_SLA_STATES,
  OWNER_GATE_UNKNOWN_AGE_REASONS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/owner-gate-sla.ts";
const HOUR_MS = 3_600_000;

type MutablePolicy = {
  comparator: string;
  escalationThresholdMs: number;
  expiryThresholdMs: number;
  rows: Array<{
    kind: string;
    class: string;
    neverMerge: boolean;
    defaultable: boolean;
    default: string | null;
  }>;
};

const clonePolicy = (): MutablePolicy =>
  JSON.parse(JSON.stringify(OWNER_GATE_SLA_POLICY)) as MutablePolicy;

type Failure = string;

const comparePolicy = (policy: MutablePolicy): Failure[] => {
  const failures: Failure[] = [];
  const eq = (name: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
  };
  eq("OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS", policy.escalationThresholdMs, 24 * HOUR_MS);
  eq("OWNER_GATE_SLA_EXPIRY_THRESHOLD_MS", policy.expiryThresholdMs, 72 * HOUR_MS);
  eq("OWNER_GATE_SLA_COMPARATOR", policy.comparator, ">=");
  eq("OWNER_GATE_SLA_POLICY.rows", policy.rows, [
    {
      kind: "owner-review",
      class: "owner-review",
      neverMerge: true,
      defaultable: false,
      default: null,
    },
    {
      kind: "waiver",
      class: "waiver",
      neverMerge: false,
      defaultable: true,
      default: "owner-review-first",
    },
  ]);
  const defaults = policy.rows.flatMap((row) => (row.default === null ? [] : [row.default]));
  eq("default count", defaults.length, 1);
  for (const row of policy.rows) {
    if (row.neverMerge && row.default !== null) {
      failures.push(`never-merge row ${row.kind} carries a default`);
    }
    if (!row.defaultable && row.default !== null) {
      failures.push(`non-defaultable row ${row.kind} carries a default`);
    }
    if ((OWNER_GATE_SLA_DEFAULTS as readonly string[]).includes(row.default ?? "") === false) {
      if (row.default !== null) failures.push(`sentinel default ${row.default}`);
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

describe("TC-SLA-001 policy contract data pinned", () => {
  test("thresholds and the declared comparator are contract data", () => {
    expect(OWNER_GATE_SLA_ESCALATION_THRESHOLD_MS).toBe(24 * HOUR_MS);
    expect(OWNER_GATE_SLA_EXPIRY_THRESHOLD_MS).toBe(72 * HOUR_MS);
    expect(OWNER_GATE_SLA_COMPARATOR).toBe(">=");
    expect(comparePolicy(clonePolicy())).toEqual([]);
  });

  test("the gate-kind and class vocabularies are exactly the closed two", () => {
    expect([...OWNER_GATE_KINDS]).toEqual(["owner-review", "waiver"]);
    expect([...OWNER_GATE_CLASSES]).toEqual(["owner-review", "waiver"]);
    expect(new Set(OWNER_GATE_KINDS).size).toBe(2);
  });

  test("the PDR-0003 two-row map is exact", () => {
    expect(OWNER_GATE_SLA_POLICY.rows).toEqual([
      {
        kind: "owner-review",
        class: "owner-review",
        neverMerge: true,
        defaultable: false,
        default: null,
      },
      {
        kind: "waiver",
        class: "waiver",
        neverMerge: false,
        defaultable: true,
        default: "owner-review-first",
      },
    ]);
    expect([...OWNER_GATE_SLA_DEFAULTS]).toEqual(["owner-review-first"]);
  });

  test("states, markers, audiences, and rank order are exact", () => {
    expect([...OWNER_GATE_SLA_STATES]).toEqual(["fresh", "escalated", "default-applied"]);
    expect([...OWNER_GATE_UNKNOWN_AGE_REASONS]).toEqual([
      "activity-timestamp-absent",
      "activity-timestamp-unparseable",
    ]);
    expect([...OWNER_GATE_SLA_AUDIENCES]).toEqual(["owner", "coordinator"]);
    expect([...OWNER_GATE_SLA_RANK_STATE_ORDER]).toEqual(["escalated", "default-applied", "fresh"]);
  });

  test("bounds, schema, collector ids, and record vocabulary are exact", () => {
    expect(BOARD_MAX_GATES).toBe(8);
    expect(BOARD_MAX_MACHINE_BYTES).toBe(65_536);
    expect(BOARD_MAX_HUMAN_LINES).toBe(24);
    expect(BOARD_MAX_HUMAN_BYTES).toBe(4_096);
    expect(BOARD_SCHEMA_VERSION).toBe("delivery.board.v1");
    expect([...BOARD_COLLECTOR_IDS]).toEqual(["tracker"]);
    expect(BOARD_COLLECTOR_ERROR_PREFIX).toBe("status.collector.");
    expect(BOARD_COLLECTOR_ERROR_SUFFIX).toBe(".unavailable");
    expect(OWNER_GATE_SLA_DECISION_RECORD_KIND).toBe("owner-gate.decision");
    expect(OWNER_GATE_SLA_DECISION_PAYLOAD_SCHEMA).toBe("delivery.owner-gate.decision.v1");
    expect(OWNER_GATE_SLA_CLOCK_SOURCE).toBe("activity-timestamp");
  });

  test("the module is data-only and registered in the inventory", () => {
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(dataOnlyViolations(text)).toEqual([]);
    const inventory = JSON.parse(
      readFileSync(join(ROOT, "tests/structure/inventory.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(inventory.core).toContain("src/contracts/owner-gate-sla.ts");
    expect(text).not.toContain("STATUS_OWNER_ATTENTION_LABELS =");
  });

  test("a rogue executable declaration fails the data-only detector", () => {
    const mutated = `${readFileSync(join(ROOT, CONTRACT), "utf8")}\nexport function rogue(): number {\n  return 1;\n}\n`;
    expect(dataOnlyViolations(mutated).some((line) => line.includes("rogue"))).toBe(true);
  });

  test("each pinned datum mutation fails by name", () => {
    const mutations: Array<[string, (policy: MutablePolicy) => void]> = [
      [
        "escalation threshold",
        (policy) => {
          policy.escalationThresholdMs = 25 * HOUR_MS;
        },
      ],
      [
        "expiry threshold",
        (policy) => {
          policy.expiryThresholdMs = 73 * HOUR_MS;
        },
      ],
      [
        "comparator",
        (policy) => {
          policy.comparator = ">";
        },
      ],
      [
        "third kind",
        (policy) => {
          policy.rows.push({
            kind: "owner-review-v2",
            class: "owner-review",
            neverMerge: false,
            defaultable: false,
            default: null,
          });
        },
      ],
      [
        "default on owner-review",
        (policy) => {
          const row = policy.rows[0];
          if (row !== undefined) {
            Object.assign(row, { defaultable: true, default: "owner-review-first" });
          }
        },
      ],
      [
        "second default on waiver",
        (policy) => {
          const row = policy.rows[1];
          if (row !== undefined) Object.assign(row, { default: "owner-review-first" });
          policy.rows.push({
            kind: "waiver",
            class: "waiver",
            neverMerge: false,
            defaultable: true,
            default: "owner-review-first",
          });
        },
      ],
      [
        "neverMerge flip",
        (policy) => {
          const row = policy.rows[0];
          if (row !== undefined) Object.assign(row, { neverMerge: false });
        },
      ],
    ];
    for (const [label, mutate] of mutations) {
      const policy = clonePolicy();
      mutate(policy);
      expect(comparePolicy(policy).length, label).toBeGreaterThan(0);
    }

    const renamedState = [...OWNER_GATE_SLA_STATES];
    renamedState[0] = "clear";
    expect(renamedState).not.toEqual([...OWNER_GATE_SLA_STATES]);

    const thirdMarker = [...OWNER_GATE_UNKNOWN_AGE_REASONS, "activity-timestamp-future"];
    expect(thirdMarker).not.toEqual([...OWNER_GATE_UNKNOWN_AGE_REASONS]);

    const droppedAudience = OWNER_GATE_SLA_AUDIENCES.filter((value) => value !== "coordinator");
    expect(droppedAudience).not.toEqual([...OWNER_GATE_SLA_AUDIENCES]);
  });
});
