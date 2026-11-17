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
  seedDispatchAttempt,
  seedHeartbeat,
  seedLane,
  seedLaneRecord,
  seedRestart,
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

describe("TC-SUP-011 prefill and resume cells: any advancing evidence reads progressing", () => {
  test("a freshly started lane with a flat trail but an age below the bound progresses", async () => {
    const harness = createSupervisionHarness({ label: "prefill-fresh" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -1_000 });
      const result = harness.battery();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.report.lanes[0]?.classification).toBe("progressing");
      expect(result.report.actions).toEqual([]);
    } finally {
      harness.remove();
    }
  });

  test("one advancing artifact of each class defeats the aged heartbeat", async () => {
    const cells = [
      {
        label: "ledger-position",
        seed: (harness: SupervisionHarness) =>
          seedLaneRecord(harness.seed, { offsetMs: -60_000, lastCompletedPhase: "5" }),
        artifact: "daemon-lane",
      },
      {
        label: "commit-record",
        seed: (harness: SupervisionHarness) =>
          seedCommitEffect(harness.seed, { offsetMs: -60_000 }),
        artifact: "effect-record",
      },
      {
        label: "dispatch-attempt",
        seed: (harness: SupervisionHarness) =>
          seedDispatchAttempt(harness.seed, { offsetMs: -60_000 }),
        artifact: "dispatch-attempt",
      },
      {
        label: "restart-record",
        seed: (harness: SupervisionHarness) => seedRestart(harness.seed, { offsetMs: -60_000 }),
        artifact: "restart-record",
      },
    ] as const;
    for (const cell of cells) {
      const harness = createSupervisionHarness({ label: `prefill-${cell.label}` });
      try {
        seedLane(harness.seed, LANE_REF);
        seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -300_001 });
        cell.seed(harness);
        const result = harness.battery();
        expect(result.ok, cell.label).toBe(true);
        if (!result.ok) continue;
        const lane = result.report.lanes[0];
        expect(lane?.classification, cell.label).toBe("progressing");
        expect(lane?.evidence.some((item) => item.code === "artifact-progress")).toBe(true);
        expect(
          lane?.evidence.some(
            (item) => item.code === "artifact-progress" && item.recordKind === cell.artifact,
          ),
        ).toBe(true);
        expect(result.report.actions, cell.label).toEqual([]);
      } finally {
        harness.remove();
      }
    }
  });

  test("ignoring the artifact half would misfire, so the case is not vacuous", async () => {
    const harness = createSupervisionHarness({ label: "prefill-mutant" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -300_001 });
      seedCommitEffect(harness.seed, { offsetMs: -60_000 });
      const result = harness.battery();
      if (!result.ok) throw new Error("report data missing");
      const progressing = result.report.lanes[0]?.classification;
      expect(progressing).toBe("progressing");
      // The stripped input (the mutant's view: artifacts ignored) reads stalled
      // and names the ignored artifact class it failed to consider.
      const { classifySupervision } = await import("../../packages/core/src/domain/index");
      const mutant = classifySupervision(
        {
          repository: harness.repository,
          ref: LANE_REF,
          claimKind: "per-ref-lease",
          identity: LANE_REF,
          sourcePresent: true,
          lastHeartbeatAt: new Date(harness.nowMs - 300_001).toISOString(),
          firstHeartbeatAt: new Date(harness.nowMs - 300_001).toISOString(),
          artifactClasses: ["effect-record"],
          artifactInstants: [],
          artifactAdvancing: false,
        },
        harness.nowMs,
      );
      expect(mutant.state).toBe("stalled");
      expect(mutant.evidence.some((item) => item.recordKind === "effect-record")).toBe(true);
    } finally {
      harness.remove();
    }
  });
});
