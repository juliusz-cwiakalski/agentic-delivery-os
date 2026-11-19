/**
 * The `install status` payload assembly (F-7, F-8; DM-4, Appendix D).
 *
 * The payload is derived and never persisted: the running identity, the
 * installed record's identity and condition, the slot's identity and condition,
 * the target-stability finding as data, the state-format verdict, and the
 * managed PATH block. Field and line order are deterministic for a given
 * machine state.
 */
import {
  INSTALL_STATUS_SCHEMA,
  type InstallArtifactIdentity,
  type InstallPathBlockRecord,
  type InstallRecord,
  type InstallRecordState,
  type InstallRunningIdentity,
  type InstallSlotReport,
  type InstallSlotState,
  type InstallStateFormatVerdict,
  type InstallStatusPayload,
  type InstallTargetStability,
} from "../contracts/install.js";

/** The running identity group, with the artifact's declared path beside it. */
export const runningIdentityOf = (input: {
  readonly identity: InstallArtifactIdentity;
  readonly artifactPath: string;
}): InstallRunningIdentity => ({
  version: input.identity.version,
  commit: input.identity.commit,
  builtAt: input.identity.builtAt,
  dirty: input.identity.dirty,
  channel: input.identity.channel,
  artifactPath: input.artifactPath,
});

/** The identity fields a record repeats, without its provenance or timestamps. */
export const identityOfRecord = (record: InstallRecord): InstallArtifactIdentity => ({
  version: record.version,
  commit: record.commit,
  builtAt: record.builtAt,
  dirty: record.dirty,
  channel: record.channel,
});

/**
 * The record condition, decided against the RUNNING identity (DM-4).
 *
 * A readable record whose identity disagrees with the running artifact is
 * `record-stale`; this comparison never reads the destination's bytes, so a
 * candidate-artifact invocation truthfully reports `record-stale` before it has
 * installed itself.
 */
export const recordStateOf = (input: {
  readonly record: InstallRecord | undefined;
  readonly readable: boolean;
  readonly running: InstallArtifactIdentity;
}): InstallRecordState => {
  if (input.record === undefined) return input.readable ? "absent" : "unreadable";
  const record = input.record;
  const running = input.running;
  return record.version === running.version &&
    record.commit === running.commit &&
    record.builtAt === running.builtAt &&
    record.dirty === running.dirty &&
    record.channel === running.channel
    ? "current"
    : "record-stale";
};

/** The slot condition, with its identity only when the record names one. */
export const slotReportOf = (input: {
  readonly path: string;
  readonly state: InstallSlotState;
  readonly identity?: InstallArtifactIdentity;
}): InstallSlotReport => ({
  path: input.path,
  state: input.state,
  ...(input.identity === undefined ? {} : { identity: input.identity }),
});

/** Assemble the `install.status.v1` payload in its declared field order. */
export const assembleInstallStatus = (input: {
  readonly running: InstallRunningIdentity;
  readonly record: InstallRecord | undefined;
  readonly recordState: InstallRecordState;
  readonly recordPath: string;
  readonly slot: InstallSlotReport;
  readonly targetStability: InstallTargetStability;
  readonly stateFormat?: InstallStateFormatVerdict;
  readonly pathBlock?: InstallPathBlockRecord;
}): InstallStatusPayload => ({
  schemaVersion: INSTALL_STATUS_SCHEMA,
  running: input.running,
  installed: input.record === undefined ? null : identityOfRecord(input.record),
  recordState: input.recordState,
  recordPath: input.recordPath,
  rollback: input.slot,
  targetStability: input.targetStability,
  ...(input.stateFormat === undefined ? {} : { stateFormat: input.stateFormat }),
  pathBlock: input.pathBlock ?? null,
});
