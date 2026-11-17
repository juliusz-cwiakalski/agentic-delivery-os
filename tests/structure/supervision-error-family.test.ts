/**
 * TC-SUP-070 — exactly two `supervise` identities are appended and no delivered
 * row changes (GH-295 F-8, AC-F8-1, DEC-6, RSK-6).
 *
 * The snapshot fixture is the delivered table captured before the change; the
 * case proves every pre-existing row byte-identical and in place.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyThrown, resolveAppErrorCode } from "../../packages/cli/src/classify";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableEntry,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const BASELINE = join(ROOT, "tests/fixtures/supervise/error-table-baseline.json");

type BaselineRow = readonly [string, string, string, boolean, string, string, string, string];

const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as {
  readonly rows: readonly BaselineRow[];
};

const tupleOf = (entry: ErrorTableEntry): BaselineRow => [
  entry.code,
  entry.domainKind,
  entry.category,
  entry.retryable,
  entry.consequence,
  entry.remediationHint,
  entry.projectionClass,
  entry.summary ?? "",
];

const entries = ERROR_TABLE as readonly ErrorTableEntry[];
const superviseRows = entries.filter((entry) => entry.domainKind === "supervise");

describe("TC-SUP-070 the supervise kind declares exactly two rows", () => {
  test("DOMAIN_KINDS gains supervise once", () => {
    expect(DOMAIN_KINDS.filter((kind) => kind === "supervise")).toHaveLength(1);
    expect(DOMAIN_KINDS.at(-1)).toBe("supervise");
  });

  test("exactly two rows carry the declared identity, category, consequence, and projection", () => {
    expect(superviseRows.map((entry) => entry.code).sort()).toEqual([
      "supervise.duplicate-supervision",
      "supervise.evidence-absent",
    ]);
    const duplicate = superviseRows.find(
      (entry) => entry.code === "supervise.duplicate-supervision",
    );
    expect(duplicate).toMatchObject({
      category: "user",
      retryable: true,
      consequence: "not_landed",
      projectionClass: "user-validation",
    });
    const absent = superviseRows.find((entry) => entry.code === "supervise.evidence-absent");
    expect(absent).toMatchObject({
      category: "platform",
      retryable: true,
      consequence: "not_landed",
      projectionClass: "platform-provider",
    });
    for (const row of superviseRows) {
      expect(row.remediationHint.length).toBeGreaterThan(0);
      expect((row.summary ?? "").length).toBeGreaterThan(0);
    }
  });

  test("every delivered row is byte-identical to the captured baseline and in place", () => {
    expect(baseline.rows).toHaveLength(146);
    const live = entries.filter((entry) => entry.domainKind !== "supervise");
    expect(live).toHaveLength(146);
    expect(live.map(tupleOf)).toEqual(baseline.rows.map((row) => [...row]));
    // The two new rows are appended after every delivered row: no reordering.
    expect(entries.slice(0, 146).map(tupleOf)).toEqual(baseline.rows.map((row) => [...row]));
  });

  test("the identity is exact — no family or prefix widening", () => {
    for (const code of [
      "supervise.duplicate",
      "supervise.evidence",
      "supervise.duplicate-supervisions",
      "supervise.evidence-absent.extra",
      "supervise.a.b",
    ]) {
      expect(resolveAppErrorCode(code).ok, code).toBe(false);
      expect(classifyThrown({ kind: "supervise", code }).code, code).toBe("fallback.internal");
    }
    expect(resolveAppErrorCode("supervise.duplicate-supervision").ok).toBe(true);
    expect(resolveAppErrorCode("supervise.evidence-absent").ok).toBe(true);
    expect(() => classifyThrown({ kind: "supervise" })).not.toThrow();
  });

  test("the exit projection is the declared one", () => {
    const duplicate = resolveAppErrorCode("supervise.duplicate-supervision");
    const absent = resolveAppErrorCode("supervise.evidence-absent");
    if (!duplicate.ok || !absent.ok) throw new Error("supervise identities must resolve");
    expect(projectExitCode(duplicate.entry.projectionClass)).toBe(1);
    expect(projectExitCode(absent.entry.projectionClass)).toBe(2);
    expect(duplicate.entry.retryable).toBe(true);
    expect(absent.entry.retryable).toBe(true);
  });
});

describe("TC-SUP-072 (structure half) the reuse outcomes contribute no supervise identity", () => {
  test("containment, state, and single-flight identities resolve outside the supervise kind", () => {
    for (const code of ["fallback.invocation", "state.store.torn", "queue.single-flight"]) {
      const resolution = resolveAppErrorCode(code);
      expect(resolution.ok, code).toBe(true);
      if (!resolution.ok) continue;
      expect(resolution.entry.domainKind, code).not.toBe("supervise");
    }
  });

  test("the supervise kind declares exactly the two identities (no reuse member)", () => {
    expect(
      (ERROR_TABLE as readonly ErrorTableEntry[])
        .filter((entry) => entry.domainKind === "supervise")
        .map((entry) => entry.code)
        .sort(),
    ).toEqual(["supervise.duplicate-supervision", "supervise.evidence-absent"]);
  });
});
