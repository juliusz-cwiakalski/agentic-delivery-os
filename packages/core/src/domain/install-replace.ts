/**
 * The seven-step replace plan, the rollback precondition, and the record
 * reconciliation (F-9; Appendix B, TDR-0040).
 *
 * The replace is one plan over what is on disk: the step-4 agreement gate is on
 * CONTENT (never an identity test on a file, never the record), step 5 promotes
 * only a differing regular compiled artifact, a delivered launcher is discarded
 * with a report, a symlink is replaced without write-through and is never
 * promoted, and an absent destination skips step 5. The rollback precondition is
 * the record/disk PAIR INVERSION: it compares the record with what is on disk,
 * never with the running identity, and the `previous` leg is presence-only by
 * declared limit.
 */
import type {
  InstallArtifactIdentity,
  InstallDestinationDisposition,
  InstallGitRead,
  InstallLauncherDisposition,
  InstallProvenance,
  InstallRecord,
  InstallSlotState,
  InstallTargetStability,
} from "../contracts/install.js";
import type { InstallAdmission } from "./install-admission.js";
import type { InstallRecordRead } from "./install-record.js";

/** The declared destination class of the replace plan (Appendix C.2). */
export const REPLACE_DESTINATION_CLASSES = [
  "absent",
  "compiled-artifact",
  "launcher",
  "symlink",
  "directory",
  "other",
] as const;
export type ReplaceDestinationClass = (typeof REPLACE_DESTINATION_CLASSES)[number];

/** One replace plan: what the run will do, decided from what is on disk. */
export type ReplacePlan = {
  /** The destination's content is the running artifact's: the run stops at step 4. */
  readonly agreement: boolean;
  readonly disposition: InstallDestinationDisposition;
  /** Whether step 5 moves the destination into the slot. */
  readonly slotSwap: boolean;
  readonly launcherDisposition: InstallLauncherDisposition;
  readonly launcherTarget?: string;
  readonly symlinkTarget?: string;
  /** Whether the record is reconciled in place on the agreement path. */
  readonly reconcilesRecord: boolean;
};

/**
 * Plan the replace from the destination class, the two content digests, and the
 * record's condition. Identity is deliberately not the test and the record is
 * never a gate.
 */
export const planReplace = (input: {
  readonly destinationClass: ReplaceDestinationClass;
  readonly destinationDigest?: string;
  readonly runningDigest?: string;
  readonly recordState: "current" | "record-stale" | "unreadable" | "absent";
}): ReplacePlan => {
  const agreement =
    input.destinationClass === "compiled-artifact" &&
    input.destinationDigest !== undefined &&
    input.runningDigest !== undefined &&
    input.destinationDigest === input.runningDigest;
  if (agreement) {
    return {
      agreement: true,
      disposition: "unchanged",
      slotSwap: false,
      launcherDisposition: "none",
      reconcilesRecord: input.recordState !== "current",
    };
  }
  if (input.destinationClass === "launcher") {
    return {
      agreement: false,
      disposition: "launcher-discarded",
      slotSwap: false,
      launcherDisposition: "launcher-discarded",
      reconcilesRecord: false,
    };
  }
  if (input.destinationClass === "symlink") {
    return {
      agreement: false,
      disposition: "symlink-replaced",
      slotSwap: false,
      launcherDisposition: "symlink-replaced",
      reconcilesRecord: false,
    };
  }
  if (input.destinationClass === "compiled-artifact") {
    return {
      agreement: false,
      disposition: "slot-swapped",
      slotSwap: true,
      launcherDisposition: "none",
      reconcilesRecord: false,
    };
  }
  return {
    agreement: false,
    disposition: input.destinationClass === "absent" ? "created" : "replaced",
    slotSwap: false,
    launcherDisposition: "none",
    reconcilesRecord: false,
  };
};

/** The identity fields a record repeats. */
const identityOfRecord = (record: InstallRecord): InstallArtifactIdentity => ({
  version: record.version,
  commit: record.commit,
  builtAt: record.builtAt,
  dirty: record.dirty,
  channel: record.channel,
});

const sameIdentity = (left: InstallArtifactIdentity, right: InstallArtifactIdentity): boolean =>
  left.version === right.version &&
  left.commit === right.commit &&
  left.builtAt === right.builtAt &&
  left.dirty === right.dirty &&
  left.channel === right.channel;

/** The four declared record-precondition causes, all MISSING-NAME conditions. */
export const ROLLBACK_RECORD_CAUSES = [
  "absent",
  "unreadable",
  "no-previous",
  "pair-inverted",
] as const;
export type RollbackRecordCause = (typeof ROLLBACK_RECORD_CAUSES)[number];

export type RollbackPrecondition =
  | {
      readonly ok: true;
      /** The record's `current` claim, written verbatim as the new `current`. */
      readonly claimedCurrent: InstallArtifactIdentity;
      /** The slot's claimed occupant, presence-checked only. */
      readonly claimedPrevious: InstallArtifactIdentity;
      /** The displaced destination's identity (the record's `current`). */
      readonly displaced: InstallArtifactIdentity;
    }
  | { readonly ok: false; readonly cause: RollbackRecordCause };

/**
 * The rollback precondition: pair inversion over the record and the disk.
 *
 * The run proceeds only when the record is readable, names a `previous` name
 * (PRESENCE only — a wrong name is admitted by declared limit), and — when the
 * running artifact IS the destination's artifact, so that the destination leg is
 * knowable — its `current` names the running identity. When the invoked artifact
 * is not the one at the destination the destination leg is unknowable and the
 * record's claim is taken at its word. A destination that is not a compiled
 * artifact at all cannot form the pair, so it refuses with the pair-inversion
 * cause rather than displacing that object into the slot.
 */
export const rollbackPrecondition = (input: {
  readonly record: InstallRecordRead;
  readonly running: InstallArtifactIdentity;
  readonly destinationIsRunning: boolean;
  /**
   * Whether the destination holds a compiled artifact at all. When it does not
   * (a launcher, a symlink, a foreign file, or nothing), the pair the swap
   * inverts does not exist on disk, so the precondition refuses like a pair
   * inversion instead of promoting that object into the slot.
   */
  readonly destinationIsArtifact?: boolean;
}): RollbackPrecondition => {
  if (input.record.kind === "absent") return { ok: false, cause: "absent" };
  if (input.record.kind === "unreadable") return { ok: false, cause: "unreadable" };
  const record = input.record.record;
  const current = identityOfRecord(record);
  if (record.previous === undefined) return { ok: false, cause: "no-previous" };
  if (input.destinationIsArtifact === false) return { ok: false, cause: "pair-inverted" };
  if (input.destinationIsRunning && !sameIdentity(current, input.running)) {
    return { ok: false, cause: "pair-inverted" };
  }
  return {
    ok: true,
    claimedCurrent: record.previous,
    claimedPrevious: current,
    displaced: current,
  };
};

/** The sentence a refusal prints for one cause (the remedy is the same row's). */
export const rollbackCauseSentence = (cause: RollbackRecordCause): string => {
  switch (cause) {
    case "absent":
      return "the record is absent";
    case "unreadable":
      return "the record is unreadable";
    case "no-previous":
      return "the record names no previous artifact while a slot is present";
    default:
      return "the record's current names an artifact other than the one at the destination";
  }
};

/** The record written by a rollback: the claimed name becomes `current`. */
export const rollbackRecordOf = (input: {
  readonly precondition: Extract<RollbackPrecondition, { readonly ok: true }>;
  readonly stateSchemaVersion: string;
  readonly sourceCheckout?: string;
  readonly provenance: InstallProvenance;
  readonly installedAt: string;
  readonly launcherDisposition: InstallLauncherDisposition;
  readonly pathBlock?: InstallRecord["pathBlock"];
}): InstallRecord => ({
  schemaVersion: "install.record.v1",
  version: input.precondition.claimedCurrent.version,
  commit: input.precondition.claimedCurrent.commit,
  builtAt: input.precondition.claimedCurrent.builtAt,
  dirty: input.precondition.claimedCurrent.dirty,
  channel: input.precondition.claimedCurrent.channel,
  stateSchemaVersion: input.stateSchemaVersion,
  ...(input.sourceCheckout === undefined ? {} : { sourceCheckout: input.sourceCheckout }),
  provenance: input.provenance,
  installedAt: input.installedAt,
  previous: input.precondition.displaced,
  launcherDisposition: input.launcherDisposition,
  ...(input.pathBlock === undefined ? {} : { pathBlock: input.pathBlock }),
});

/**
 * The step-7 record of a replacing install.
 *
 * When step 5 swapped the slot, `previous` is the predecessor the readable
 * record's `current` named (absent and unknown when no readable record names
 * one). When step 5 was skipped the slot was never touched, so the readable
 * record's own `previous` carries over.
 */
export const replacingRecordOf = (input: {
  readonly running: InstallArtifactIdentity;
  readonly stateSchemaVersion: string;
  readonly sourceCheckout?: string;
  readonly provenance: InstallProvenance;
  readonly installedAt: string;
  readonly plan: ReplacePlan;
  readonly record: InstallRecordRead;
  readonly pathBlock?: InstallRecord["pathBlock"];
}): InstallRecord => {
  const readable = input.record.kind === "record" ? input.record.record : undefined;
  const previous = input.plan.slotSwap
    ? readable === undefined
      ? undefined
      : identityOfRecord(readable)
    : readable?.previous;
  return {
    schemaVersion: "install.record.v1",
    version: input.running.version,
    commit: input.running.commit,
    builtAt: input.running.builtAt,
    dirty: input.running.dirty,
    channel: input.running.channel,
    stateSchemaVersion: input.stateSchemaVersion,
    ...(input.sourceCheckout === undefined ? {} : { sourceCheckout: input.sourceCheckout }),
    provenance: input.provenance,
    installedAt: input.installedAt,
    ...(previous === undefined ? {} : { previous }),
    launcherDisposition: input.plan.launcherDisposition,
    ...(input.plan.launcherTarget === undefined
      ? {}
      : { launcherDetail: input.plan.launcherTarget }),
    ...(input.pathBlock === undefined ? {} : { pathBlock: input.pathBlock }),
  };
};

/**
 * The step-4 reconciliation record of an agreement run.
 *
 * `previous` is the predecessor a readable record named (its `current`), never
 * the record's own previous `previous` — step 5 may have overwritten that
 * artifact. With no readable record the predecessor is absent and reported
 * unknown.
 */
export const reconciliationRecordOf = (input: {
  readonly running: InstallArtifactIdentity;
  readonly stateSchemaVersion: string;
  readonly sourceCheckout?: string;
  readonly provenance: InstallProvenance;
  readonly installedAt: string;
  readonly record: InstallRecordRead;
  readonly pathBlock?: InstallRecord["pathBlock"];
}): { readonly record: InstallRecord; readonly previous: InstallArtifactIdentity | "unknown" } => {
  const readable = input.record.kind === "record" ? input.record.record : undefined;
  const previous = readable === undefined ? undefined : identityOfRecord(readable);
  return {
    record: {
      schemaVersion: "install.record.v1",
      version: input.running.version,
      commit: input.running.commit,
      builtAt: input.running.builtAt,
      dirty: input.running.dirty,
      channel: input.running.channel,
      stateSchemaVersion: input.stateSchemaVersion,
      ...(input.sourceCheckout === undefined ? {} : { sourceCheckout: input.sourceCheckout }),
      provenance: input.provenance,
      installedAt: input.installedAt,
      ...(previous === undefined ? {} : { previous }),
      launcherDisposition: "none",
      ...(input.pathBlock === undefined ? {} : { pathBlock: input.pathBlock }),
    },
    previous: previous ?? "unknown",
  };
};

/** The admission provenance the record keeps (a stable checkout or an absence). */
export const provenanceOfAdmission = (
  admission: Extract<InstallAdmission, { readonly ok: true }>,
): {
  readonly provenance: InstallProvenance;
  readonly sourceCheckout?: string;
} =>
  admission.checkoutPath === undefined
    ? { provenance: admission.provenance }
    : { provenance: admission.provenance, sourceCheckout: admission.checkoutPath };

/**
 * The slot's condition, reported even when its identity is not knowable.
 *
 * The condition uses the same compiled-artifact predicate the replace and the
 * rollback use: a regular, non-empty, executable file that is not a script and
 * whose probe bytes are readable. A launcher, an identity-less file, or a file
 * whose bytes cannot be read for the probe is `invalid`, so `status` and
 * `rollback` never disagree about whether the slot is rollback-ready.
 */
export const slotCondition = (input: {
  readonly stats:
    | { readonly kind: string; readonly size: number; readonly executable: boolean }
    | undefined;
  /** Whether the occupant begins with a shebang, which makes it a script. */
  readonly script?: boolean;
  /** Whether the occupant's probe bytes could not be read at all. */
  readonly unreadable?: boolean;
  readonly identity?: InstallArtifactIdentity;
}): { readonly state: InstallSlotState; readonly identity?: InstallArtifactIdentity } => {
  if (input.stats === undefined) return { state: "absent" };
  if (
    input.stats.kind !== "file" ||
    input.stats.size === 0 ||
    !input.stats.executable ||
    input.script === true ||
    input.unreadable === true
  )
    return { state: "invalid" };
  return input.identity === undefined
    ? { state: "present" }
    : { state: "present", identity: input.identity };
};

/** The target-stability finding for a status read (data, never a refusal here). */
export const targetStabilityOf = (git: InstallGitRead): InstallTargetStability => {
  if (git.kind !== "resolved") return "unverified";
  return git.gitDir === git.commonDir ? "verified" : "linked-worktree";
};
