/**
 * Total four-state convergence classification (GH-227 F-7, DEC-7).
 *
 * The delta is read from durable evidence only: the persisted transition
 * record (with its stored commit intent) and the persisted commit telemetry
 * event. The stale derived projection is never consulted, and the mode of the
 * current invocation never drives the outcome.
 */
import type { CommitDelta, CommitDurableEvidence } from "#contracts";

/** Classify the durable delta; total over all four (record × commit) states. */
export const classifyCommitDelta = (evidence: CommitDurableEvidence): CommitDelta => {
  if (!evidence.recordPresent && !evidence.commitPresent) return { state: "neither" };
  if (evidence.recordPresent && !evidence.commitPresent) {
    const transitionId =
      evidence.recordTransitionId === undefined ? {} : { transitionId: evidence.recordTransitionId };
    if (evidence.recordIntent === "atomic") {
      return { state: "record-atomic-without-commit", ...transitionId };
    }
    return {
      state: "record-record-only",
      ...(evidence.recordBasis === undefined ? {} : { basis: evidence.recordBasis }),
      ...transitionId,
    };
  }
  if (!evidence.recordPresent && evidence.commitPresent) {
    return {
      state: "commit-without-record",
      commitSha: evidence.commitSha ?? "",
    };
  }
  return {
    state: "both",
    ...(evidence.commitSha === undefined ? {} : { commitSha: evidence.commitSha }),
    ...(evidence.recordTransitionId === undefined
      ? {}
      : { transitionId: evidence.recordTransitionId }),
  };
};
