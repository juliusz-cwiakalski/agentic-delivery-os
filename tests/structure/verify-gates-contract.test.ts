/**
 * TC-VGATES-001 — one data contract owns gate order, verdicts, closed reasons,
 * sources/outcomes, counts, name kinds, constants, and bounds.
 */
import { describe, expect, test } from "bun:test";
import {
  STATUS_CI_RESULTS,
  STATUS_OWNER_ATTENTION_LABELS,
  VERIFY_GATES_CI_RUN_LIMIT,
  VERIFY_GATES_CI_WORKFLOW_PATH,
  VERIFY_GATES_COUNT_NAMES,
  VERIFY_GATES_FAILURE_CLASSES,
  VERIFY_GATES_GATE_COUNTS,
  VERIFY_GATES_GATE_NAME_KINDS,
  VERIFY_GATES_GATE_ORDER,
  VERIFY_GATES_GATE_REASONS,
  VERIFY_GATES_GATE_SOURCES,
  VERIFY_GATES_INTEGRATION_BASE,
  VERIFY_GATES_MAX_CITATION_NAMES,
  VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS,
  VERIFY_GATES_MAX_EXPECTED_JOBS,
  VERIFY_GATES_MAX_MACHINE_BYTES,
  VERIFY_GATES_MAX_NAME_CHARS,
  VERIFY_GATES_MAX_REF_CHARS,
  VERIFY_GATES_MAX_SUMMARY_BYTES,
  VERIFY_GATES_MAX_SUMMARY_LINES,
  VERIFY_GATES_NAME_KINDS,
  VERIFY_GATES_OPEN_PR_LIMIT,
  VERIFY_GATES_REASONS,
  VERIFY_GATES_SCHEMA_VERSION,
  VERIFY_GATES_SOURCE_NAMES,
  VERIFY_GATES_SOURCE_OUTCOMES,
  VERIFY_GATES_VERDICTS,
  VERIFY_GATES_WORKFLOW_MAX_BYTES,
} from "../../packages/core/src/contracts/index";
import { evaluateVerifyGates } from "../../packages/core/src/domain/index";
import { baseFacts } from "../fixtures/verify-gates/cases/facts";

const validatesOrder = (order: readonly string[]): boolean =>
  JSON.stringify(order) === JSON.stringify(VERIFY_GATES_GATE_ORDER);

const isOrderedSubset = (actual: readonly string[], declared: readonly string[]): boolean => {
  let cursor = 0;
  for (const value of actual) {
    const index = declared.indexOf(value, cursor);
    if (index < 0) return false;
    cursor = index + 1;
  }
  return true;
};

type CitationLike = {
  readonly sources: ReadonlyArray<{
    readonly name: string;
    readonly outcome: string;
    readonly failureCode?: string;
    readonly failureClass?: string;
  }>;
  readonly identity: unknown;
  readonly counts: ReadonlyArray<{ readonly name: string; readonly value: number }>;
  readonly names: ReadonlyArray<{
    readonly kind: string;
    readonly values: readonly string[];
    readonly omitted: number;
  }>;
  readonly reasons: readonly string[];
};

const sourceOutcomes: readonly string[] = VERIFY_GATES_SOURCE_OUTCOMES;
const failureClasses: readonly string[] = VERIFY_GATES_FAILURE_CLASSES;

const citationViolations = (
  gateId: keyof typeof VERIFY_GATES_GATE_SOURCES,
  citation: CitationLike,
): string[] => {
  const violations: string[] = [];
  const sources = VERIFY_GATES_GATE_SOURCES[gateId];
  const counts = VERIFY_GATES_GATE_COUNTS[gateId];
  const kinds = VERIFY_GATES_GATE_NAME_KINDS[gateId];
  const reasons = VERIFY_GATES_GATE_REASONS[gateId];

  if (citation.sources.length < 1 || citation.sources.length > 3) {
    violations.push("sources outside 1..3");
  }
  if (
    !isOrderedSubset(
      citation.sources.map((source) => source.name),
      sources,
    )
  ) {
    violations.push("sources out of declared order or unknown");
  }
  for (const source of citation.sources) {
    if (!sourceOutcomes.includes(source.outcome)) {
      violations.push(`unknown source outcome ${source.outcome}`);
    }
    if (source.failureClass !== undefined && !failureClasses.includes(source.failureClass)) {
      violations.push(`free-form failureClass ${source.failureClass}`);
    }
    if (source.failureCode !== undefined && source.failureClass !== undefined) {
      violations.push("source carries both failureCode and failureClass");
    }
  }

  if (citation.counts.length > VERIFY_GATES_MAX_CITATION_NAMES) {
    violations.push("too many counts");
  }
  if (
    !isOrderedSubset(
      citation.counts.map((entry) => entry.name),
      counts,
    )
  ) {
    violations.push("counts out of declared order or unknown");
  }
  for (const entry of citation.counts) {
    if (!Number.isInteger(entry.value) || entry.value < 0) {
      violations.push(`non-integer count ${entry.name}=${entry.value}`);
    }
  }

  if (citation.names.length > 3) violations.push("too many name lists");
  if (
    !isOrderedSubset(
      citation.names.map((entry) => entry.kind),
      kinds,
    )
  ) {
    violations.push("name lists out of declared order or unknown");
  }
  for (const entry of citation.names) {
    if (entry.values.length > VERIFY_GATES_MAX_CITATION_NAMES) {
      violations.push(`${entry.kind} exceeds the citation name cap`);
    }
    if (entry.values.some((value) => value.length > VERIFY_GATES_MAX_NAME_CHARS)) {
      violations.push(`${entry.kind} has an over-long name`);
    }
    if (entry.omitted < 0 || !Number.isInteger(entry.omitted)) {
      violations.push(`${entry.kind} has an invalid omitted count`);
    }
    if (entry.kind === "squash-signals" && entry.values.length > 0) {
      const [draft, mergeable] = entry.values;
      if (
        entry.values.length !== 2 ||
        !draft?.startsWith("draft=") ||
        !mergeable?.startsWith("mergeable=")
      ) {
        violations.push("squash-signals are not the two ordered tokens");
      }
    }
  }

  if (citation.reasons.length < 1 || citation.reasons.length > 4) {
    violations.push("reasons outside 1..4");
  }
  if (!citation.reasons.every((reason) => reasons.includes(reason))) {
    violations.push("reason outside the gate's closed set");
  }
  return violations;
};

describe("TC-VGATES-001 gate vocabulary", () => {
  test("gate order, verdicts, schema, and closed reasons are exact", () => {
    expect(VERIFY_GATES_GATE_ORDER).toEqual([
      "lifecycle-finalization",
      "ci-green",
      "push-parity",
      "owner-gate",
      "squash-preflight",
    ]);
    expect(new Set(VERIFY_GATES_GATE_ORDER).size).toBe(5);
    expect(VERIFY_GATES_VERDICTS).toEqual(["pass", "fail", "unknown"]);
    expect(VERIFY_GATES_SCHEMA_VERSION).toBe("delivery.verify-gates.v1");
    expect(VERIFY_GATES_REASONS).toHaveLength(35);
    expect(new Set(VERIFY_GATES_REASONS).size).toBe(35);
  });

  test("each gate declares its sources, reasons, counts, and name kinds", () => {
    for (const id of VERIFY_GATES_GATE_ORDER) {
      expect(VERIFY_GATES_GATE_SOURCES[id].length).toBeGreaterThanOrEqual(1);
      expect(VERIFY_GATES_GATE_SOURCES[id].length).toBeLessThanOrEqual(3);
      expect(VERIFY_GATES_GATE_REASONS[id].length).toBeGreaterThan(0);
      expect(VERIFY_GATES_GATE_COUNTS[id].length).toBeGreaterThan(0);
      for (const source of VERIFY_GATES_GATE_SOURCES[id]) {
        expect(VERIFY_GATES_SOURCE_NAMES).toContain(source);
      }
      for (const reason of VERIFY_GATES_GATE_REASONS[id]) {
        expect(VERIFY_GATES_REASONS).toContain(reason);
      }
      for (const count of VERIFY_GATES_GATE_COUNTS[id]) {
        expect(VERIFY_GATES_COUNT_NAMES).toContain(count);
      }
      for (const kind of VERIFY_GATES_GATE_NAME_KINDS[id]) {
        expect(VERIFY_GATES_NAME_KINDS).toContain(kind);
      }
    }
    expect(VERIFY_GATES_SOURCE_OUTCOMES).toEqual([
      "read",
      "observed-empty",
      "failed",
      "absent",
      "unresolved",
      "not-attempted",
    ]);
    expect(VERIFY_GATES_FAILURE_CLASSES).toEqual([
      "provider.payload.invalid",
      "provider.not-found",
    ]);
  });

  test("constants and bounds match Appendix C", () => {
    expect(VERIFY_GATES_INTEGRATION_BASE).toBe("main-tools");
    expect(VERIFY_GATES_CI_WORKFLOW_PATH).toBe(".github/workflows/ci.yml");
    expect(VERIFY_GATES_OPEN_PR_LIMIT).toBe(100);
    expect(VERIFY_GATES_CI_RUN_LIMIT).toBe(100);
    expect(VERIFY_GATES_MAX_EXPECTED_JOBS).toBe(200);
    expect(VERIFY_GATES_MAX_EXPECTED_JOB_NAME_CHARS).toBe(120);
    expect(VERIFY_GATES_WORKFLOW_MAX_BYTES).toBe(262144);
    expect(VERIFY_GATES_MAX_CITATION_NAMES).toBe(8);
    expect(VERIFY_GATES_MAX_NAME_CHARS).toBe(120);
    expect(VERIFY_GATES_MAX_REF_CHARS).toBe(120);
    expect(VERIFY_GATES_MAX_SUMMARY_LINES).toBe(6);
    expect(VERIFY_GATES_MAX_SUMMARY_BYTES).toBe(4096);
    expect(VERIFY_GATES_MAX_MACHINE_BYTES).toBe(65536);
  });

  test("reused status constants are referenced, not redeclared", () => {
    expect(STATUS_OWNER_ATTENTION_LABELS).toEqual(["hand-back", "human-input-needed"]);
    expect(STATUS_CI_RESULTS).toContain("none");
    expect(STATUS_CI_RESULTS).toContain("unknown");
    expect(STATUS_CI_RESULTS[4]).toBe("none");
  });

  test("negative control: a reversed order is a violation", () => {
    expect(validatesOrder(VERIFY_GATES_GATE_ORDER)).toBe(true);
    expect(validatesOrder([...VERIFY_GATES_GATE_ORDER].reverse())).toBe(false);
  });
});

describe("TC-VGATES-040/041 citation shape and negative controls", () => {
  const byId = (id: string): CitationLike => {
    const record = evaluateVerifyGates(baseFacts()).gates.find((entry) => entry.id === id);
    if (record === undefined) throw new Error(`missing gate ${id}`);
    return record.citation;
  };

  test("every real citation satisfies the declared shape", () => {
    for (const id of VERIFY_GATES_GATE_ORDER) {
      expect(citationViolations(id, byId(id)), id).toEqual([]);
    }
  });

  test("out-of-order counts and name kinds are rejected", () => {
    const citation = byId("ci-green");
    const reversedCounts = { ...citation, counts: [...citation.counts].reverse() };
    expect(citationViolations("ci-green", reversedCounts).length).toBeGreaterThan(0);
    const reversedNames = { ...citation, names: [...citation.names].reverse() };
    expect(citationViolations("ci-green", reversedNames).length).toBeGreaterThan(0);
  });

  test("a free-form failureClass and a dual failure identity are rejected", () => {
    const citation = byId("ci-green");
    const freeForm = {
      ...citation,
      sources: [
        {
          name: "repository-ci-workflow" as const,
          outcome: "failed" as const,
          failureClass: "provider.something-else",
        },
      ],
    };
    expect(citationViolations("ci-green", freeForm)).toContain(
      "free-form failureClass provider.something-else",
    );
    const dual = {
      ...citation,
      sources: [
        {
          name: "repository-ci-workflow" as const,
          outcome: "failed" as const,
          failureCode: "provider.payload.invalid",
          failureClass: "provider.payload.invalid",
        },
      ],
    };
    expect(citationViolations("ci-green", dual)).toContain(
      "source carries both failureCode and failureClass",
    );
  });

  test("non-integer counts, over-cap names, and free-form reasons are rejected", () => {
    const citation = byId("ci-green");
    const badCounts = {
      ...citation,
      counts: [{ name: "expected", value: Number.NaN }],
    };
    expect(citationViolations("ci-green", badCounts)).toContain("non-integer count expected=NaN");
    const longName = "x".repeat(VERIFY_GATES_MAX_NAME_CHARS + 1);
    const badNames = {
      ...citation,
      names: [{ kind: "missing-jobs", values: [longName], omitted: 0 }],
    };
    expect(citationViolations("ci-green", badNames)).toContain(
      "missing-jobs has an over-long name",
    );
    const badReasons = { ...citation, reasons: ["free-form-reason"] };
    expect(citationViolations("ci-green", badReasons)).toContain(
      "reason outside the gate's closed set",
    );
  });
});
