/**
 * The read-only delivery corroborator (GH-348 F-5, DM-6; AC-F5-3, AC-F5-7).
 *
 * A total decision over delivered facts from the same verified state read plus
 * the delivered process-port liveness probe. It consumes store readability, the
 * newest `dispatch.lane` facts (state, owner-pid presence, owner liveness) and
 * the newest `daemon.lane` facts (state, pid presence, liveness), and NOTHING
 * ELSE: no `startedAt`, no age bound, no start-time comparison (PM ruling R-01).
 *
 * The evidence classes are D1-D6 and M1-M6, and the fold is F0-F3. `none` is
 * reachable only through F3, so an unreadable store, an absent pid, or an
 * unreadable probe is `unknown` — never `none`, because `none` licenses a kill.
 */
import type { LoopDeliveryReading } from "#contracts";

/** One liveness reading for a recorded process id. */
export type LaneLiveness = "alive" | "dead" | "unreadable";

/** The newest `dispatch.lane` fact for one ref. */
export type DispatchLaneFact = {
  readonly state: "active" | "terminal";
  /** The owner's recorded process id, or `null` when absent. */
  readonly pid: number | null;
  readonly liveness: LaneLiveness;
};

/** The newest `daemon.lane` fact, or `null` when the lane is absent. */
export type DaemonLaneFact = {
  readonly state: "delivering" | "detached" | "preempted" | "completed" | "failed";
  readonly pid: number | null;
  readonly liveness: LaneLiveness;
};

/** The injected corroborator inputs; every fact is already read. */
export type CorroboratorInput = {
  readonly storeReadable: boolean;
  /** The newest dispatch lane for EVERY ref that has one. */
  readonly dispatchLanes: readonly DispatchLaneFact[];
  readonly daemonLane: DaemonLaneFact | null;
};

/** The evidence classes, in the declared order. */
export const LOOP_EVIDENCE_CLASSES = [
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
] as const;

export type LoopEvidenceClass = (typeof LOOP_EVIDENCE_CLASSES)[number];

/** The declared contribution of one evidence class. */
export const evidenceClassContribution = (
  entry: LoopEvidenceClass,
): "ignored" | "in-progress" | "unknown" => {
  switch (entry) {
    case "D1":
    case "D2":
    case "D5":
    case "M1":
    case "M2":
    case "M5":
      return "ignored";
    case "D3":
    case "D6":
    case "M3":
    case "M6":
      return "unknown";
    case "D4":
    case "M4":
      return "in-progress";
    default:
      return "ignored";
  }
};

/** Classify one newest dispatch lane into its D-class. */
export const dispatchEvidenceClass = (lane: DispatchLaneFact | null): LoopEvidenceClass => {
  if (lane === null) return "D1";
  if (lane.state === "terminal") return "D2";
  if (lane.pid === null) return "D3";
  if (lane.liveness === "alive") return "D4";
  if (lane.liveness === "dead") return "D5";
  return "D6";
};

/** Classify the newest daemon lane into its M-class. */
export const daemonEvidenceClass = (lane: DaemonLaneFact | null): LoopEvidenceClass => {
  if (lane === null) return "M1";
  if (lane.state !== "delivering") return "M2";
  if (lane.pid === null) return "M3";
  if (lane.liveness === "alive") return "M4";
  if (lane.liveness === "dead") return "M5";
  return "M6";
};

/** The fold F0-F3 over the contributions; the table is total. */
export const foldDeliveryEvidence = (input: {
  readonly storeReadable: boolean;
  readonly classes: readonly LoopEvidenceClass[];
}): LoopDeliveryReading => {
  if (!input.storeReadable) return "unknown";
  const contributions = input.classes.map(evidenceClassContribution);
  if (contributions.includes("in-progress")) return "in-progress";
  if (contributions.includes("unknown")) return "unknown";
  return "none";
};

/**
 * The corroborator's one total decision. `in-progress` dominates `unknown`
 * because both are kill-safe and `in-progress` is the more informative reading.
 */
export const corroborateDelivery = (input: CorroboratorInput): LoopDeliveryReading => {
  const classes = [
    ...input.dispatchLanes.map((lane) => dispatchEvidenceClass(lane)),
    daemonEvidenceClass(input.daemonLane),
  ];
  return foldDeliveryEvidence({ storeReadable: input.storeReadable, classes });
};
