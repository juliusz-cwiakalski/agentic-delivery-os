/**
 * Safe-boundary automatic preemption (GH-238 F-11; DEC-2; DM-5; EVT-5;
 * AC-F11-1, AC-F11-2).
 *
 * A computed preemption is applied only at a safe boundary (a phase boundary or
 * session completion); a live session is never signalled or killed. No active
 * session means an immediate release and park. A live session records a durable
 * pending preemption and re-evaluates later. `withdrawn` is a declared read-only
 * state in this change.
 */
import type { DaemonPreemptionBoundary, DaemonPreemptionState } from "#contracts";

export type PreemptionInput = {
  readonly ref: string;
  readonly repository: string;
  readonly closeRef: string;
  readonly holder: string;
  readonly hasActiveSession: boolean;
  readonly boundary?: DaemonPreemptionBoundary;
  readonly requestedAt: string;
};

export type PreemptionDecision =
  | {
      readonly state: "pending";
      readonly releaseAndPark: false;
      readonly singleFlight: true;
    }
  | {
      readonly state: "applied";
      readonly releaseAndPark: true;
      readonly singleFlight: false;
      readonly boundary?: DaemonPreemptionBoundary;
    };

export const decidePreemption = (input: PreemptionInput): PreemptionDecision => {
  if (!input.hasActiveSession) {
    return { state: "applied", releaseAndPark: true, singleFlight: false };
  }
  if (input.boundary !== undefined) {
    return {
      state: "applied",
      releaseAndPark: true,
      singleFlight: false,
      boundary: input.boundary,
    };
  }
  return { state: "pending", releaseAndPark: false, singleFlight: true };
};

/** The declared read states; `withdrawn` is never written by this change. */
export const PREEMPTION_WRITABLE_STATES = [
  "pending",
  "applied",
] as const satisfies readonly DaemonPreemptionState[];
