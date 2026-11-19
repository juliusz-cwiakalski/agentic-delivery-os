/**
 * Loop verdict and corroborator fact tables (GH-348 F-5; DM-6; TC-STUCK-*).
 *
 * The sixteen-row decision table, the verdict table over the three injected fact
 * sets, and the evidence-corpus candidates (including a maximal one). Every row
 * is data: a case drives the exported pure functions with it, so no scenario is
 * re-expressed in a test body.
 */
import type { CorroboratorInput, LaneLiveness } from "../../../packages/core/src/app/index";
import type {
  CoordinatorProgressState,
  LoopDeliveryReading,
} from "../../../packages/core/src/contracts/index";
import type { LoopVerdictInput } from "../../../packages/core/src/domain/index";

/** The `(class, expected)` decision rows over the F0-F3 fold. */
export const LOOP_DECISION_ROWS: readonly {
  readonly id: string;
  readonly input: CorroboratorInput;
  readonly expected: LoopDeliveryReading;
}[] = [
  {
    id: "D1+M1 readable",
    input: { storeReadable: true, dispatchLanes: [], daemonLane: null },
    expected: "none",
  },
  {
    id: "D2+M2 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "terminal", pid: 1, liveness: "alive" }],
      daemonLane: { state: "completed", pid: 1, liveness: "alive" },
    },
    expected: "none",
  },
  {
    id: "D3+M1 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "active", pid: null, liveness: "dead" }],
      daemonLane: null,
    },
    expected: "unknown",
  },
  {
    id: "D4+M1 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "active", pid: 10, liveness: "alive" }],
      daemonLane: null,
    },
    expected: "in-progress",
  },
  {
    id: "D5+M1 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "active", pid: 10, liveness: "dead" }],
      daemonLane: null,
    },
    expected: "none",
  },
  {
    id: "D6+M1 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "active", pid: 10, liveness: "unreadable" }],
      daemonLane: null,
    },
    expected: "unknown",
  },
  {
    id: "D1+M3 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [],
      daemonLane: { state: "delivering", pid: null, liveness: "dead" },
    },
    expected: "unknown",
  },
  {
    id: "D1+M4 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [],
      daemonLane: { state: "delivering", pid: 20, liveness: "alive" },
    },
    expected: "in-progress",
  },
  {
    id: "D1+M5 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [],
      daemonLane: { state: "delivering", pid: 20, liveness: "dead" },
    },
    expected: "none",
  },
  {
    id: "D1+M6 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [],
      daemonLane: { state: "delivering", pid: 20, liveness: "unreadable" },
    },
    expected: "unknown",
  },
  {
    id: "D4+M5 in-progress dominates",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "active", pid: 10, liveness: "alive" }],
      daemonLane: { state: "delivering", pid: 20, liveness: "dead" },
    },
    expected: "in-progress",
  },
  {
    id: "D3+M4 in-progress dominates unknown",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "active", pid: null, liveness: "dead" }],
      daemonLane: { state: "delivering", pid: 20, liveness: "alive" },
    },
    expected: "in-progress",
  },
  {
    id: "unreadable store + D4",
    input: {
      storeReadable: false,
      dispatchLanes: [{ state: "active", pid: 10, liveness: "alive" }],
      daemonLane: null,
    },
    expected: "unknown",
  },
  {
    id: "unreadable store + D2+M2",
    input: {
      storeReadable: false,
      dispatchLanes: [{ state: "terminal", pid: 1, liveness: "dead" }],
      daemonLane: { state: "detached", pid: null, liveness: "dead" },
    },
    expected: "unknown",
  },
  {
    id: "D5+M5 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "active", pid: 10, liveness: "dead" }],
      daemonLane: { state: "delivering", pid: 20, liveness: "dead" },
    },
    expected: "none",
  },
  {
    id: "D4+M6 readable",
    input: {
      storeReadable: true,
      dispatchLanes: [{ state: "active", pid: 10, liveness: "alive" }],
      daemonLane: { state: "delivering", pid: 20, liveness: "unreadable" },
    },
    expected: "in-progress",
  },
];

/** One verdict expectation over the three injected fact sets. */
export const LOOP_VERDICT_ROWS: readonly {
  readonly id: string;
  readonly input: Partial<LoopVerdictInput> & Pick<LoopVerdictInput, "progress" | "delivery">;
  readonly expected: "progressing" | "stuck" | "unevaluable";
}[] = [
  {
    id: "positive progress",
    input: { progress: "positive", delivery: "none" },
    expected: "progressing",
  },
  {
    id: "zero inside the window",
    input: { progress: "zero", delivery: "none", lastProgressAtMs: 900_000 },
    expected: "progressing",
  },
  {
    id: "zero across the window",
    input: { progress: "zero", delivery: "none", lastProgressAtMs: 300_000 },
    expected: "stuck",
  },
  {
    id: "zero across the window with a live delivery",
    input: { progress: "zero", delivery: "in-progress", lastProgressAtMs: 300_000 },
    expected: "progressing",
  },
  {
    id: "unreadable progress",
    input: { progress: "unknown", delivery: "none", lastProgressAtMs: 300_000 },
    expected: "unevaluable",
  },
  {
    id: "unreadable corroborator",
    input: { progress: "zero", delivery: "unknown", lastProgressAtMs: 300_000 },
    expected: "unevaluable",
  },
  {
    id: "zero across the window with an artifact advance",
    input: {
      progress: "zero",
      delivery: "none",
      lastProgressAtMs: 300_000,
      artifactAdvanced: true,
    },
    expected: "progressing",
  },
];

/** A maximal evidence corpus: the declared keys, well inside the 512-byte bound. */
export const MAXIMAL_EVIDENCE_FIELDS = {
  traffic: "zero" as CoordinatorProgressState,
  delivery: "none" as LoopDeliveryReading,
  progressAgeMs: 652_000,
  windowMs: 600_000,
};

/** The liveness vocabulary the lane facts use. */
export const LANE_LIVENESS: readonly LaneLiveness[] = ["alive", "dead", "unreadable"];
