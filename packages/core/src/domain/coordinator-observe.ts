/**
 * The coordinator observation projection (GH-241 F-9, Appendix G; AC-F9-1).
 *
 * Assembles the bounded `delivery.coordinator.v1` payload from durable,
 * already-folded facts. It never reads state, never evaluates, and never
 * mutates: `start`, `stop`, and `status` pass `tickVerdict: null`, and only a
 * `tick` supplies the tick-specific verdict. `data.stuck` is the last persisted
 * verdict and keeps non-null phase/reason/evidence.
 */
import {
  COORDINATOR_OBSERVATION_SCHEMA,
  COORDINATOR_V1_SUPERVISOR_MODE,
  type CoordinatorDecisionView,
  type CoordinatorEscalationView,
  type CoordinatorFenceView,
  type CoordinatorInstance,
  type CoordinatorLiveFacts,
  type CoordinatorObservation,
  type CoordinatorRestarts,
  type CoordinatorSession,
  type CoordinatorStuckView,
  type CoordinatorTickVerdict,
  type CoordinatorWakeView,
} from "#contracts";
import { projectCoordinatorRegime } from "./coordinator-regime.js";

/** Every already-folded fact the projection consumes. */
export type CoordinatorObservationFacts = {
  readonly coordinatorId: string;
  readonly stateDirectory: string;
  readonly instance: CoordinatorInstance | null;
  readonly session: CoordinatorSession;
  readonly decision: CoordinatorDecisionView | null;
  readonly restarts: CoordinatorRestarts;
  readonly stuck: CoordinatorStuckView | null;
  readonly tickVerdict: CoordinatorTickVerdict | null;
  readonly wake: CoordinatorWakeView | null;
  readonly escalation: CoordinatorEscalationView;
  readonly fence: CoordinatorFenceView | null;
  readonly live?: CoordinatorLiveFacts | null;
  readonly degradation: readonly string[];
};

/** Assemble the observation payload; the regime is projected deterministically. */
export const projectCoordinatorObservation = (
  facts: CoordinatorObservationFacts,
): CoordinatorObservation => ({
  schemaVersion: COORDINATOR_OBSERVATION_SCHEMA,
  coordinatorId: facts.coordinatorId,
  instance:
    facts.instance === null
      ? null
      : {
          ...facts.instance,
          supervisorMode: COORDINATOR_V1_SUPERVISOR_MODE,
          externalUnit: "absent",
        },
  regime: projectCoordinatorRegime({
    stateDirectory: facts.stateDirectory,
    coordinatorId: facts.coordinatorId,
  }),
  session: facts.session,
  decision: facts.decision,
  restarts: facts.restarts,
  stuck: facts.stuck,
  tickVerdict: facts.tickVerdict,
  wake: facts.wake,
  escalation: facts.escalation,
  fence: facts.fence,
  live: facts.live ?? null,
  degradation: [...facts.degradation],
});

/** The tick-result projection for a `progressing` verdict (never persisted). */
export const progressingTickVerdict = (): CoordinatorTickVerdict => ({
  verdict: "progressing",
  phase: null,
  reason: null,
  evidence: null,
});

/** The tick-result projection for a persisted verdict evaluation. */
export const persistedTickVerdict = (evaluation: {
  readonly verdict: "stuck" | "unevaluable";
  readonly reason: CoordinatorStuckView["reason"];
  readonly evidence: string;
}): CoordinatorTickVerdict => ({
  verdict: evaluation.verdict,
  phase: "verdict",
  reason: evaluation.reason,
  evidence: evaluation.evidence,
});
