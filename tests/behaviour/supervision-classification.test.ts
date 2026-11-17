/**
 * TC-SUP-010 / TC-SUP-012 — the classification matrix is total, deterministic,
 * and artifact-only, and `unknown` is truthful (GH-295 AC-F2-1, DEC-4, DEC-5,
 * NFR-1, NFR-6).
 */
import { describe, expect, test } from "bun:test";
import { createSupervisionHarness, type SupervisionHarness } from "../fixtures/supervise/harness";
import {
  MATRIX_EVIDENCE,
  matrixViolations,
  SUPERVISION_MATRIX,
} from "../fixtures/supervise/matrix";
import {
  LANE_REF,
  seedCommitEffect,
  seedDaemonInstance,
  seedLane,
} from "../fixtures/supervise/records";

const withHarness = (body: (harness: SupervisionHarness) => void): void => {
  const harness = createSupervisionHarness({ label: "matrix" });
  try {
    body(harness);
  } finally {
    harness.remove();
  }
};

describe("TC-SUP-010 the declared matrix is total and every cell classifies", () => {
  test("the matrix declares the full cross product with an expectation per cell", () => {
    expect(matrixViolations()).toEqual([]);
    expect(SUPERVISION_MATRIX).toHaveLength(12);
    expect(SUPERVISION_MATRIX.every((cell) => MATRIX_EVIDENCE.includes(cell.evidence))).toBe(true);
  });

  for (const cell of SUPERVISION_MATRIX) {
    test(`cell ${cell.id} yields ${cell.required}`, () => {
      withHarness((harness) => {
        cell.seed(harness.seed);
        const first = harness.battery();
        if (cell.required === "evidence-absent") {
          // An all-unknown scope is the classified evidence-absent outcome.
          expect(first.ok).toBe(false);
          if (first.ok) return;
          expect(first.code).toBe("supervise.evidence-absent");
          expect(first.summary.length).toBeGreaterThan(0);
          return;
        }
        expect(first.ok).toBe(true);
        if (!first.ok) return;
        const entry = cell.select(first);
        expect(entry, cell.id).toBeDefined();
        expect(entry?.classification, cell.id).toBe(cell.required);
        expect(entry?.evidence.length ?? 0, cell.id).toBeGreaterThan(0);
        for (const item of entry?.evidence ?? []) {
          expect(item.code.length).toBeGreaterThan(0);
        }
        // Re-run and compare the serialized entry: the fold is deterministic.
        const second = harness.battery();
        expect(second.ok).toBe(true);
        if (!second.ok) return;
        expect(JSON.stringify(cell.select(second))).toBe(JSON.stringify(entry));
      });
    });
  }

  test("a matrix with an unmapped cell fails the totality guard", () => {
    const missing = SUPERVISION_MATRIX.slice(0, 11);
    expect(matrixViolations(missing).join("\n")).toContain("missing cell");
    const duplicated = [
      ...SUPERVISION_MATRIX,
      SUPERVISION_MATRIX[0] as (typeof SUPERVISION_MATRIX)[number],
    ];
    expect(matrixViolations(duplicated).join("\n")).toContain("duplicate cell");
  });
});

describe("TC-SUP-012 unknown is truthful and never defaulted", () => {
  test("a mixed scope rides all three states with evidence of absence", () => {
    withHarness((harness) => {
      seedLane(harness.seed, LANE_REF);
      seedCommitEffect(harness.seed, { offsetMs: -60_000 });
      seedLane(harness.seed, "GH-296");
      seedDaemonInstance(harness.seed);
      const result = harness.battery();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const advancing = result.report.lanes.find((lane) => lane.ref === LANE_REF);
      const unknown = result.report.lanes.find((lane) => lane.ref === "GH-296");
      expect(advancing?.classification).toBe("progressing");
      expect(unknown?.classification).toBe("unknown");
      expect(unknown?.heartbeat).toBeUndefined();
      expect(JSON.stringify(unknown)).not.toContain('"heartbeat":0');
      expect(JSON.stringify(unknown)).not.toContain('"heartbeat":null');
      expect(unknown?.evidence.some((item) => item.code === "artifact-source-absent")).toBe(true);
      const daemon = result.report.supervisors.find(
        (claim) => claim.claimKind === "daemon-instance",
      );
      expect(daemon?.classification).toBe("unknown");
      expect(daemon?.evidence.some((item) => item.code === "artifact-source-absent")).toBe(true);
      // Counts are present and derived from the entries.
      expect(result.report.counts.lanes).toBe(result.report.lanes.length);
      expect(
        result.report.counts.progressing +
          result.report.counts.stalled +
          result.report.counts.unknown,
      ).toBe(result.report.counts.lanes);
      expect(result.report.degraded).toContain("artifact-source-absent");
    });
  });
});
