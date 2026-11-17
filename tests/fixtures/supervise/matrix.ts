/**
 * The declared classification matrix (GH-295 test plan TC-SUP-010): every cell
 * over {advancing, partial, flat-and-aged, absent} × {lane, daemon claim,
 * coordinator lease claim} names its expected tri-state, its seed, and its
 * selector. The totality guard fails a matrix with an unmapped cell.
 */

import type { SupervisionBatteryResult } from "../../../packages/core/src/app/index";
import type {
  SupervisionLaneEntry,
  SupervisionState,
  SupervisionSupervisorEntry,
} from "../../../packages/core/src/contracts/index";
import type { SupervisionSeedTarget } from "./records";
import {
  coordinatorClaim,
  daemonClaim,
  LANE_REF,
  seedDaemonInstance,
  seedHeartbeat,
  seedLane,
  seedLaneRecord,
  seedReconciliation,
} from "./records";

export const MATRIX_SUBJECTS = ["lane", "daemon", "coordinator"] as const;

/** A progressing control lane keeps a subject-only absent cell readable. */
export const CONTROL_REF = "GH-001";
const CONTROL_INSTANCE = "control-instance";
export const MATRIX_EVIDENCE = ["advancing", "partial", "flat-and-aged", "absent"] as const;

export type MatrixSubject = (typeof MATRIX_SUBJECTS)[number];
export type MatrixEvidence = (typeof MATRIX_EVIDENCE)[number];

export type SupervisionMatrixCell = {
  readonly id: string;
  readonly subject: MatrixSubject;
  readonly evidence: MatrixEvidence;
  readonly required: SupervisionState | "evidence-absent";
  readonly seed: (target: SupervisionSeedTarget) => void;
  readonly select: (
    result: SupervisionBatteryResult,
  ) => SupervisionLaneEntry | SupervisionSupervisorEntry | undefined;
};

const laneEntry =
  (ref = LANE_REF) =>
  (result: SupervisionBatteryResult): SupervisionLaneEntry | undefined =>
    result.ok ? result.report.lanes.find((lane) => lane.ref === ref) : undefined;

const claimEntry =
  (claimKind: "daemon-instance" | "coordinator-lease") =>
  (result: SupervisionBatteryResult): SupervisionSupervisorEntry | undefined =>
    result.ok
      ? result.report.supervisors.find((claim) => claim.claimKind === claimKind)
      : undefined;

/**
 * The matrix seeds exactly one subject per cell: absent records are never
 * pre-seeded, so an absent cell proves the classified-absence answer.
 */
const seedFor = (subject: MatrixSubject, evidence: MatrixEvidence) => {
  if (subject === "lane") {
    switch (evidence) {
      case "advancing":
        return (target: SupervisionSeedTarget): void => {
          seedLane(target);
          seedHeartbeat(target, { ordinal: 1, offsetMs: -120_000 });
          seedLaneRecord(target, { offsetMs: -60_000, lastCompletedPhase: "5" });
        };
      case "partial":
        return (target: SupervisionSeedTarget): void => {
          seedLane(target);
          seedHeartbeat(target, { ordinal: 1, offsetMs: -120_000 });
        };
      case "flat-and-aged":
        return (target: SupervisionSeedTarget): void => {
          seedLane(target);
          seedHeartbeat(target, { ordinal: 1, offsetMs: -300_001 });
        };
      case "absent":
        return (target: SupervisionSeedTarget): void => {
          seedLane(target);
        };
    }
  }
  if (subject === "daemon") {
    switch (evidence) {
      case "advancing":
        return (target: SupervisionSeedTarget): void => {
          daemonClaim(target, { live: true });
          seedReconciliation(target, { offsetMs: -60_000 });
        };
      case "partial":
        return (target: SupervisionSeedTarget): void => {
          daemonClaim(target, { live: true });
        };
      case "flat-and-aged":
        return (target: SupervisionSeedTarget): void => {
          daemonClaim(target, { live: true, heartbeatOffsetsMs: [-400_000, -5_000] });
        };
      case "absent":
        return (target: SupervisionSeedTarget): void => {
          seedDaemonInstance(target);
        };
    }
  }
  switch (evidence) {
    case "advancing":
      return (target: SupervisionSeedTarget): void => {
        coordinatorClaim(target, { live: true });
      };
    case "partial":
      return (target: SupervisionSeedTarget): void => {
        coordinatorClaim(target, { live: true, iterationOffsetsMs: [-240_000] });
      };
    case "flat-and-aged":
      return (target: SupervisionSeedTarget): void => {
        coordinatorClaim(target, { live: true, iterationOffsetsMs: [-400_000, -330_000] });
      };
    case "absent":
      return (target: SupervisionSeedTarget): void => {
        coordinatorClaim(target, { live: true, iterationOffsetsMs: [] });
      };
  }
};

/** The expected tri-state per (subject, evidence) cell (DEC-5). */
const EXPECTED: Readonly<Record<MatrixEvidence, SupervisionState | "evidence-absent">> = {
  advancing: "progressing",
  partial: "progressing",
  "flat-and-aged": "stalled",
  absent: "evidence-absent",
};

export const SUPERVISION_MATRIX: readonly SupervisionMatrixCell[] = MATRIX_SUBJECTS.flatMap(
  (subject) =>
    MATRIX_EVIDENCE.map((evidence) => {
      const subjectSeed = seedFor(subject, evidence);
      return {
        id: `${subject}:${evidence}`,
        subject,
        evidence,
        required: EXPECTED[evidence],
        seed: subjectSeed,
        select:
          subject === "lane"
            ? laneEntry()
            : subject === "daemon"
              ? claimEntry("daemon-instance")
              : claimEntry("coordinator-lease"),
      };
    }),
);

/**
 * The totality guard: the declared cell count is the full cross product and
 * every cell carries an expectation, a seed, and a selector.
 */
export const matrixViolations = (
  cells: readonly SupervisionMatrixCell[] = SUPERVISION_MATRIX,
): readonly string[] => {
  const violations: string[] = [];
  const expectedCount = MATRIX_SUBJECTS.length * MATRIX_EVIDENCE.length;
  if (cells.length !== expectedCount) {
    violations.push(`matrix declares ${cells.length} cells, expected ${expectedCount}`);
  }
  const seen = new Set<string>();
  for (const cell of cells) {
    if (seen.has(cell.id)) violations.push(`duplicate cell ${cell.id}`);
    seen.add(cell.id);
    if (cell.required === undefined) violations.push(`cell ${cell.id} has no expectation`);
    if (typeof cell.seed !== "function") violations.push(`cell ${cell.id} has no seed`);
    if (typeof cell.select !== "function") violations.push(`cell ${cell.id} has no selector`);
  }
  for (const subject of MATRIX_SUBJECTS) {
    for (const evidence of MATRIX_EVIDENCE) {
      if (!seen.has(`${subject}:${evidence}`)) {
        violations.push(`missing cell ${subject}:${evidence}`);
      }
    }
  }
  return violations;
};
