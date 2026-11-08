/**
 * Resident polling discipline (GH-238 F-14; AC-F14-1; NFR-10, NFR-16).
 *
 * A stateful policy over the pure `poll-policy` rules, driven only by the
 * injected clock. Polling goes through an injected read seam, never a write,
 * and has no unbounded loop.
 */
import type { DaemonClockPort, PlatformPollSettings } from "#contracts";
import {
  nextPollDelayMs,
  pollDue,
  pollFailure,
  pollIssued,
  pollSuccess,
  type PollPolicyState,
} from "../domain/poll-policy.js";

export type ResidentPollingInput = {
  readonly settings: PlatformPollSettings;
  readonly clock: DaemonClockPort;
};

export type ResidentPolling = {
  readonly delayMs: () => number;
  readonly due: () => boolean;
  readonly dueAt: () => number;
  readonly succeed: () => void;
  readonly fail: () => void;
  readonly issued: () => void;
  readonly state: () => PollPolicyState;
};

export const createResidentPolling = (input: ResidentPollingInput): ResidentPolling => {
  let state: PollPolicyState = { failures: 0 };
  return {
    delayMs: () => nextPollDelayMs(input.settings, state.failures),
    due: () => pollDue(state, input.settings, input.clock.nowMs()),
    dueAt: () => (state.lastRequestAtMs ?? 0) + nextPollDelayMs(input.settings, state.failures),
    succeed: () => {
      state = pollSuccess();
    },
    fail: () => {
      state = pollFailure(state);
    },
    issued: () => {
      state = pollIssued(state, input.clock.nowMs());
    },
    state: () => state,
  };
};
