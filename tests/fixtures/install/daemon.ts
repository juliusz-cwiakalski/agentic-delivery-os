/**
 * The daemon seam for lifecycle cases (GH-346 F-9, AC-F9-4; ORDER-TP-1).
 *
 * One injected port answers the live-holder read and appends every stop to one
 * ORDERED log, so "the stop happens before the swap" is a comparison and a
 * refusal's "no daemon action" is an empty log rather than a claim.
 */
import type {
  InstallDaemonPort,
  InstallDaemonState,
} from "../../../packages/core/src/contracts/install";

export type RecordingDaemon = {
  readonly port: InstallDaemonPort;
  readonly log: () => readonly string[];
  readonly state: () => InstallDaemonState;
  setRunning: (state: InstallDaemonState) => void;
  readonly setStopResult: (ok: boolean) => void;
};

/** Build one recording daemon seam. */
export const createRecordingDaemon = (
  initial: InstallDaemonState = { running: false },
): RecordingDaemon => {
  let state = initial;
  let stopResult = true;
  const entries: string[] = [];
  return {
    port: {
      status: async () => {
        entries.push(`status:${state.running ? "running" : "absent"}`);
        return state;
      },
      stop: async () => {
        entries.push("stop");
        return stopResult ? { ok: true } : { ok: false, detail: "injected stop failure" };
      },
    },
    log: () => [...entries],
    state: () => state,
    setRunning: (next) => {
      state = next;
    },
    setStopResult: (ok) => {
      stopResult = ok;
    },
  };
};

/** A dry-run purity seam: any entry in the log fails the "no daemon action" claim. */
export const emptyDaemonLog = (): readonly string[] => [];
