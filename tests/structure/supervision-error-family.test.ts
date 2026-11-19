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
    // GH-299's `metrics` kind mounts after `supervise`, so supervise is second-to-last.
    expect(DOMAIN_KINDS.at(-3)).toBe("supervise");
    expect(DOMAIN_KINDS.at(-2)).toBe("metrics");
    expect(DOMAIN_KINDS.at(-1)).toBe("install");
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
    expect(baseline.rows).toHaveLength(150);
    // The captured baseline includes GH-335's four harness rows; it predates
    // GH-299's `metrics` row, the two supervise rows, GH-346's eleven install
    // rows, and GH-349's three additive rows (the two `merge` rows and the one
    // `lint` row), so the comparison excludes those three kinds. Every baseline
    // row must still be present, byte-identical and in its delivered relative
    // order, so the positional oracle is preserved; the rows outside the
    // baseline are exactly those three additive declarations, named here so no
    // fourth row can appear unnoticed.
    const baselineCodes = new Set(baseline.rows.map((row) => row[0]));
    const live = entries.filter(
      (entry) =>
        entry.domainKind !== "supervise" &&
        entry.domainKind !== "metrics" &&
        entry.domainKind !== "install",
    );
    expect(live).toHaveLength(153);
    for (const row of baseline.rows) {
      const found = entries.find((entry) => entry.code === row[0]);
      expect(found, row[0]).toBeDefined();
      if (found !== undefined) expect(tupleOf(found), row[0]).toEqual([...row]);
    }
    expect(entries.map((entry) => entry.code).filter((code) => baselineCodes.has(code))).toEqual(
      baseline.rows.map((row) => row[0]),
    );
    expect(
      live
        .filter((entry) => !baselineCodes.has(entry.code))
        .map((entry) => entry.code)
        .sort(),
    ).toEqual(["lint.phases.divergent", "merge.mergeability-unknown", "merge.sync-required"]);
    // The post-baseline kinds are appended after every delivered row: indices
    // 153..155 hold supervise/metrics and 156..166 hold the eleven install rows.
    expect(entries.slice(153).map((entry) => entry.domainKind)).toEqual([
      "supervise",
      "supervise",
      "metrics",
      ...new Array(11).fill("install"),
    ]);
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
