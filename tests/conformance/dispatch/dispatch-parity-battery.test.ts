/**
 * TC-PARITY-001..005 — the offline deterministic parity battery (GH-347 F-9;
 * AC-F9-1..AC-F9-3, AC-F9-5; DEC-9; NFR-1, NFR-7, NFR-10).
 *
 * Every row comes from the single registry; the class rows come from the
 * 11-class table. Nothing here re-expresses a scenario, reads a change artifact,
 * or asserts a wall-clock value.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deriveDispatchResult } from "../../../packages/core/src/domain/dispatch-result";
import {
  PARITY_CASES,
  parityCasesOf,
  runAllParityCases,
} from "../../fixtures/dispatch/parity/cases";
import {
  CLASS_ROWS,
  canonicalize,
  PARITY_NOT_PROVEN_SURFACES,
  PARITY_PROOF_BOUNDARY,
  PARITY_PROVEN_SURFACES,
} from "../../fixtures/dispatch/parity/evidence";
import {
  importIdentityViolations,
  reimplementationViolations,
} from "../../fixtures/dispatch/parity/seams";

const ROOT = process.cwd();

type Boundary = { readonly proven: readonly string[]; readonly notProven: readonly string[] };

/** The boundary's self-consistency check; a drift is named `proof boundary drift: ...`. */
export const boundaryViolations = (
  boundary: Boundary,
  rows: readonly { readonly id: string; readonly declaredSeam: string }[],
): string[] => {
  const failures: string[] = [];
  if (boundary.proven.length !== PARITY_PROVEN_SURFACES.length) {
    failures.push(
      `proof boundary drift: proven expected ${PARITY_PROVEN_SURFACES.length} ids, received ${boundary.proven.length}`,
    );
  }
  if (boundary.notProven.length !== PARITY_NOT_PROVEN_SURFACES.length) {
    failures.push(
      `proof boundary drift: notProven expected ${PARITY_NOT_PROVEN_SURFACES.length} ids, received ${boundary.notProven.length}`,
    );
  }
  if (
    boundary.proven.length === PARITY_PROVEN_SURFACES.length &&
    boundary.proven.some((id, index) => id !== PARITY_PROVEN_SURFACES[index])
  ) {
    failures.push(
      `proof boundary drift: proven order expected [${PARITY_PROVEN_SURFACES.join(",")}], received [${boundary.proven.join(",")}]`,
    );
  }
  if (
    boundary.notProven.length === PARITY_NOT_PROVEN_SURFACES.length &&
    boundary.notProven.some((id, index) => id !== PARITY_NOT_PROVEN_SURFACES[index])
  ) {
    failures.push(
      `proof boundary drift: notProven order expected [${PARITY_NOT_PROVEN_SURFACES.join(",")}], received [${boundary.notProven.join(",")}]`,
    );
  }
  for (const row of rows) {
    if (boundary.notProven.includes(row.declaredSeam) || row.declaredSeam.startsWith("live-")) {
      failures.push(`parity row ${row.id} declares a not-proven seam ${row.declaredSeam}`);
    }
  }
  return failures;
};

describe("TC-PARITY-001 all 11 classes replay through the real derivation and command path", () => {
  test("each class row yields its token and its delivered exit, exactly once", async () => {
    const observed: string[] = [];
    for (const row of CLASS_ROWS) {
      const observation = await row.scenario();
      expect(observation.token, row.id).toBe(row.token);
      expect(observation.exit, row.id).toBe(row.exit);
      expect(observation.attempts, row.id).toHaveLength(1);
      // The declared seam was exercised: a spawn or resume was recorded.
      expect(observation.spawns + observation.resumes, row.id).toBeGreaterThan(0);
      observed.push(row.token ?? "");
    }
    expect(new Set(observed).size).toBe(11);
    expect(observed).toHaveLength(11);
  });

  test("the class table names one row per taxonomy token", () => {
    expect(CLASS_ROWS.map((row) => row.id)).toHaveLength(11);
    expect(new Set(CLASS_ROWS.map((row) => row.token)).size).toBe(11);
    for (const row of CLASS_ROWS) {
      expect(row.declaredSeam.length).toBeGreaterThan(0);
    }
  });
});

describe("TC-PARITY-002 every case exercises the real production seam", () => {
  test("the import-identity manifest holds for every seam", async () => {
    expect(await importIdentityViolations(ROOT)).toEqual([]);
    // The manifest names the real production modules, and the derivation seam
    // is the one the battery imports (never a test-local copy).
    expect(typeof deriveDispatchResult).toBe("function");
  });

  test("the forbidden-signature scan is empty on the live tree", () => {
    expect(reimplementationViolations(ROOT)).toEqual([]);
  });

  test("a planted local claim reimplementation is rejected by name", () => {
    const root = mkdtempSync(join(ROOT, "tmp", "tmpdir", "seam-control-"));
    try {
      mkdirSync(join(root, "tests", "conformance", "dispatch"), { recursive: true });
      // The text is assembled so this suite's own source never carries the pair
      // the scan looks for (the planted control lives only in the temp copy).
      const pre = ["dispatchAdmission", "Refusal("].join("");
      const claim = ["claimQueue", "Lease("].join("");
      writeFileSync(
        join(root, "tests", "conformance", "dispatch", "planted-claim.ts"),
        [
          "// planted control: the old non-atomic admission pair",
          'import { claimQueueLease, dispatchAdmissionRefusal } from "@delivery-os/core";',
          "export const planted = () => {",
          `  const pre = ${pre}undefined as never, { ref: "GH-1", nowMs: 0 });`,
          `  const claim = ${claim}undefined as never, {} as never);`,
          "  return [pre, claim];",
          "};",
          "",
        ].join("\n"),
      );
      const violations = reimplementationViolations(root);
      expect(violations).toContain(
        `reimplementation of claim in ${join(root, "tests", "conformance", "dispatch", "planted-claim.ts")}`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-PARITY-003 two consecutive runs are identical with zero live I/O", () => {
  // Sixty composed runs; the suite's own budget is the only time source.

  test("the full registry runs twice with identical envelopes and counts", {
    timeout: 60_000,
  }, async () => {
    const first = await runAllParityCases();
    const second = await runAllParityCases();
    expect(first).toHaveLength(PARITY_CASES.length);
    expect(second).toHaveLength(PARITY_CASES.length);
    expect(PARITY_CASES).toHaveLength(29);

    /**
     * The determinism projection (GH-347 AC-F9-3, NFR-1): the FULL canonical
     * envelope, the attempt count and its tokens, the lane count, the restart /
     * spawn / resume counts, the injected waits, and the class coverage. A
     * token-plus-exit projection is deliberately NOT enough — an envelope or an
     * attempt count that drifted would pass it.
     */
    const snapshot = (
      runs: Awaited<ReturnType<typeof runAllParityCases>>,
    ): readonly Record<string, unknown>[] =>
      runs.map((run) => ({
        id: run.entry.id,
        group: run.entry.group,
        result: run.observation.token,
        exit: run.observation.exit,
        envelopes: run.observation.envelopes,
        attemptCount: run.observation.attempts.length,
        attemptTokens: run.observation.attempts.map((attempt) => attempt.token),
        laneCount: run.observation.lanes.length,
        divergences: run.observation.divergences,
        economicsRestarts: run.observation.economicsRestarts,
        spawns: run.observation.spawns,
        resumes: run.observation.resumes,
        waits: run.observation.waits,
        violations: run.observation.violations,
      }));
    expect(canonicalize(snapshot(second), ROOT)).toBe(canonicalize(snapshot(first), ROOT));

    for (const run of [...first, ...second]) {
      // A zero-length violation list is a real assertion: the guarded runner and
      // the process-tree model both record one when they refuse an act.
      expect(run.observation.violations, run.entry.id).toEqual([]);
    }
    // Class coverage is 11/11 and identical in both runs.
    const classes = (runs: Awaited<ReturnType<typeof runAllParityCases>>): number =>
      new Set(runs.filter((run) => run.entry.group === "class").map((run) => run.observation.token))
        .size;
    expect(classes(first)).toBe(11);
    expect(classes(second)).toBe(11);
    const coverage = (runs: Awaited<ReturnType<typeof runAllParityCases>>): readonly string[] =>
      runs
        .filter((run) => run.entry.group === "class")
        .map((run) => run.observation.token ?? "")
        .sort();
    expect(coverage(second)).toEqual(coverage(first));
  });
});

describe("TC-PARITY-004 the proved / not-proved boundary is permanent and self-consistent", () => {
  test("the live constant has eight proven and six not-proven ids in order", () => {
    expect(PARITY_PROOF_BOUNDARY.proven).toHaveLength(8);
    expect(PARITY_PROOF_BOUNDARY.notProven).toHaveLength(6);
    expect(boundaryViolations(PARITY_PROOF_BOUNDARY, PARITY_CASES)).toEqual([]);
  });

  test("the planted controls fail by name", () => {
    const rows = PARITY_CASES.map((row) => ({ id: row.id, declaredSeam: row.declaredSeam }));
    const appended = {
      proven: [...PARITY_PROOF_BOUNDARY.proven, "extra-surface"],
      notProven: [...PARITY_PROOF_BOUNDARY.notProven],
    };
    expect(boundaryViolations(appended, rows)).toContain(
      "proof boundary drift: proven expected 8 ids, received 9",
    );
    const removed = {
      proven: PARITY_PROOF_BOUNDARY.proven.slice(0, 7),
      notProven: [...PARITY_PROOF_BOUNDARY.notProven],
    };
    expect(boundaryViolations(removed, rows)).toContain(
      "proof boundary drift: proven expected 8 ids, received 7",
    );
    const swapped = {
      proven: [
        PARITY_PROOF_BOUNDARY.proven[1],
        PARITY_PROOF_BOUNDARY.proven[0],
        ...PARITY_PROOF_BOUNDARY.proven.slice(2),
      ],
      notProven: [...PARITY_PROOF_BOUNDARY.notProven],
    };
    expect(
      boundaryViolations(swapped, rows).some((failure) =>
        failure.startsWith("proof boundary drift: proven order"),
      ),
    ).toBe(true);
    const extraNotProven = {
      proven: [...PARITY_PROOF_BOUNDARY.proven],
      notProven: [...PARITY_PROOF_BOUNDARY.notProven, "seventh"],
    };
    expect(boundaryViolations(extraNotProven, rows)).toContain(
      "proof boundary drift: notProven expected 6 ids, received 7",
    );
    expect(
      boundaryViolations(PARITY_PROOF_BOUNDARY, [
        ...rows,
        { id: "planted-row", declaredSeam: "live-opencode" },
      ]),
    ).toContain("parity row planted-row declares a not-proven seam live-opencode");
  });

  test("this suite reads no change artifact", () => {
    const source = require("node:fs").readFileSync(
      join(ROOT, "tests/conformance/dispatch/dispatch-parity-battery.test.ts"),
      "utf8",
    ) as string;
    expect(source).not.toContain(["doc", "changes"].join("/"));
  });
});

describe("TC-PARITY-005 record bounds and redaction hold across the battery", () => {
  test("lane records carry the exact key set and no forbidden payload", async () => {
    const result = await parityCasesOf("class")
      .find((row) => row.id === "class-pr-open")
      ?.scenario();
    expect(result).toBeDefined();
    for (const lane of result?.lanes ?? []) {
      const keys = Object.keys(lane).sort();
      for (const forbidden of ["prompt", "transcript", "diff", "credential", "payload"]) {
        expect(keys).not.toContain(forbidden);
      }
      expect(keys).toContain("owner");
      expect(keys).toContain("sessionId");
    }
    for (const attempt of result?.attempts ?? []) {
      expect(attempt.evidenceRefs.length).toBeLessThanOrEqual(16);
      for (const ref of attempt.evidenceRefs) {
        expect(ref).not.toContain("\n");
        expect(ref.trim()).toBe(ref);
      }
    }
  });

  test("no injected canary appears in any envelope or record", { timeout: 60_000 }, async () => {
    const results = await runAllParityCases();
    const text = canonicalize(
      results.map((run) => run.observation),
      ROOT,
    );
    for (const canary of ["planted-gh347-parity-canary", "planted-secret-canary"]) {
      expect(text).not.toContain(canary);
    }
    for (const run of results) {
      for (const attempt of run.observation.attempts) {
        expect(attempt.evidenceRefs.length, run.entry.id).toBeLessThanOrEqual(16);
      }
    }
  });
});
