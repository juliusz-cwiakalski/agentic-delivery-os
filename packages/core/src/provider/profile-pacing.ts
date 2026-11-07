/**
 * Provider-profile pacing policy (GH-234 F-7; DM-3, DM-5, DEC-1).
 *
 * Pure: goal priorities, rungs, and thresholds are configuration data. Rungs
 * move ONLY seats whose declared `pacingClass` is `execution`; a `judgment` seat
 * is structurally immovable. Goal priorities are evaluated in declared order —
 * the first declared priority is the precedence, with no hardcoded ordering.
 */
import {
  type PacingGoalPriority,
  type ProfileEvent,
  type ProfileRungState,
  type ProviderPacingConfiguration,
  type ProviderPacingRung,
  type ProviderProfile,
} from "#contracts";
import { createProfileEvent } from "./profile.js";

export type PacingEvaluationInput = {
  readonly pacing?: ProviderPacingConfiguration;
  readonly profile: ProviderProfile;
  readonly utilizationPercent: number;
  readonly previousRung?: string;
  readonly nowMs: number;
};

export type PacingEvaluation = {
  readonly rung: string;
  readonly seatModels: Readonly<Record<string, string>>;
  readonly judgmentHeld: boolean;
  readonly reason: string;
  readonly events: readonly ProfileEvent[];
};

const orderedRungs = (
  pacing: ProviderPacingConfiguration,
): readonly ProviderPacingRung[] =>
  Object.values(pacing.rungs).sort(
    (left, right) =>
      left.thresholdPercent - right.thresholdPercent ||
      (left.name < right.name ? -1 : left.name > right.name ? 1 : 0),
  );

/** The highest-threshold rung not above the current utilization, or none. */
export const activeRung = (
  pacing: ProviderPacingConfiguration,
  utilizationPercent: number,
): ProviderPacingRung | undefined => {
  const rungs = orderedRungs(pacing);
  let active: ProviderPacingRung | undefined;
  for (const rung of rungs) {
    if (utilizationPercent >= rung.thresholdPercent) active = rung;
  }
  return active;
};

const firstPriority = (
  priorities: readonly PacingGoalPriority[],
): PacingGoalPriority | undefined => priorities[0];

/**
 * Whether execution seats move for the active rung under the first declared
 * goal priority. `hold-judgment` defers movement until the declared tail;
 * `utilize-subscription` moves at the rung threshold; `minimize-paid` moves as
 * soon as any rung is active.
 */
const shouldMoveExecution = (
  priority: PacingGoalPriority | undefined,
  utilizationPercent: number,
  tailThresholdPercent: number,
  rung: ProviderPacingRung | undefined,
): boolean => {
  if (rung === undefined) return false;
  switch (priority) {
    case "hold-judgment":
      return utilizationPercent >= tailThresholdPercent;
    case "minimize-paid":
      return utilizationPercent > 0;
    case "utilize-subscription":
    case undefined:
      return utilizationPercent >= rung.thresholdPercent;
    default:
      return utilizationPercent >= rung.thresholdPercent;
  }
};

/** Evaluate rungs and return the resulting seat models plus any transition event. */
export const evaluatePacing = (input: PacingEvaluationInput): PacingEvaluation => {
  const pacing = input.pacing;
  const seatModels: Record<string, string> = Object.fromEntries(
    Object.entries(input.profile.seats).map(([seatName, seat]) => [seatName, seat.model]),
  );
  if (pacing === undefined) {
    return {
      rung: "base",
      seatModels,
      judgmentHeld: true,
      reason: "no-pacing-declared",
      events: [],
    };
  }
  const rung = activeRung(pacing, input.utilizationPercent);
  const priority = firstPriority(pacing.goalPriorities);
  const move = shouldMoveExecution(
    priority,
    input.utilizationPercent,
    pacing.tailThresholdPercent,
    rung,
  );
  if (move && rung !== undefined) {
    for (const [seatName, seat] of Object.entries(input.profile.seats)) {
      if (seat.pacingClass === "execution") seatModels[seatName] = rung.executionModel;
    }
  }
  const rungName = rung?.name ?? "base";
  const events: ProfileEvent[] = [];
  if (input.previousRung !== undefined && input.previousRung !== rungName) {
    events.push(
      createProfileEvent({
        code: "profile.rung-changed",
        createdAtMs: input.nowMs,
        message: `profile ${input.profile.name} moved to rung ${rungName}`,
        evidence: {
          profileName: input.profile.name,
          rung: rungName,
          reason: priority ?? "declared-order",
        },
      }),
    );
  }
  return {
    rung: rungName,
    seatModels,
    judgmentHeld: true,
    reason: priority ?? "declared-order",
    events,
  };
};

/** The rung state shape carried by a selection decision. */
export const rungState = (evaluation: PacingEvaluation): ProfileRungState => {
  const movedSeats: Record<string, string> = {};
  for (const [seatName, model] of Object.entries(evaluation.seatModels)) {
    movedSeats[seatName] = model;
  }
  return { rung: evaluation.rung, movedSeats };
};
