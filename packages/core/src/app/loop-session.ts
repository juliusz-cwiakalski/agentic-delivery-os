/**
 * The loop's session identity: the CEO spawn input, the durable `loop.session`
 * record builder, and the recorded session facts the supervision cycle reads
 * (GH-348 F-2, F-6; DM-1, DM-3).
 *
 * The composition supplies the effects (spawn / resume / join) over the
 * delivered harness session port and supplies the ledger appends through the
 * injected port; this module owns the deterministic title, the per-spawn
 * binding mount, and the record shape. It reaches no store and no clock.
 */
import {
  type CoordinatorProgressState,
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessSeatBinding,
  type HarnessSpawnInput,
  LOOP_SESSION_PAYLOAD_SCHEMA,
  LOOP_V1_SUPERVISOR_IDENTITY,
  type LoopSessionRecord,
  type LoopSessionState,
} from "#contracts";
import { loopPromptFor, loopSessionTitle } from "../domain/loop-prompt.js";

/** The recorded session facts the cycle consumes; every fact is read, never invented. */
export type LoopSessionFacts = {
  readonly sessionId: string | null;
  readonly liveness: "alive" | "absent" | "unknown";
  readonly harnessKind: string;
  /** The recorded process id, or `null` when the adapter supplies none. */
  readonly pid: number | null;
  /** The platform process start time read at acquisition, or `null`. */
  readonly processStartTimeMs: number | null;
  /** The recorded fresh-spawn title, or `null`. */
  readonly title: string | null;
};

/** One session effect's result: the identity it established, or a typed refusal. */
export type LoopSessionEffect =
  | {
      readonly ok: true;
      readonly sessionId: string;
      readonly harnessKind: string;
      readonly pid: number | null;
      readonly processStartTimeMs: number | null;
      readonly title: string | null;
      /** `false` when the effect resumed or joined an existing session. */
      readonly fresh: boolean;
    }
  | { readonly ok: false; readonly code: string };

/** The injected session-effect port the composition supplies (F-2, F-6). */
export type LoopSessionPort = {
  readonly read: () => LoopSessionFacts;
  readonly spawn: (input: {
    readonly title: string;
    readonly prompt: string;
  }) => Promise<LoopSessionEffect>;
  readonly resume: (input: {
    readonly sessionId: string;
    readonly prompt: string;
  }) => Promise<LoopSessionEffect>;
  readonly join: () => Promise<LoopSessionEffect>;
};

/** The fresh-spawn title for one acquisition, from the injected clock (F-2). */
export const freshSessionTitle = (nowMs: number): string => loopSessionTitle(nowMs);

/** The declared prompt for the loop identity (AC-F8-4, phase 8's content scan). */
export const loopSpawnPrompt = (loopId: string = LOOP_V1_SUPERVISOR_IDENTITY): string =>
  loopPromptFor(loopId);

/**
 * Mount the per-spawn single-seat binding as data on the spawn input (F-2,
 * AC-F2-4): the caller agent identity `ceo`, the resolved binding, and the
 * deterministic title. No second resolver and no operator flag participates.
 */
export const loopSpawnInput = (input: {
  readonly workItemRef: string;
  readonly descriptor: HarnessExecutionEnvironmentDescriptor;
  readonly prompt: string;
  readonly agent?: string;
  readonly binding?: HarnessSeatBinding;
  readonly title?: string;
}): HarnessSpawnInput => ({
  workItemRef: input.workItemRef,
  prompt: input.prompt,
  descriptor: input.descriptor,
  ...(input.agent === undefined ? {} : { agent: input.agent }),
  ...(input.binding === undefined ? {} : { binding: input.binding }),
  ...(input.title === undefined ? {} : { title: input.title }),
});

/** Build the durable `loop.session` record for one acquisition or state change. */
export const sessionRecordFrom = (input: {
  readonly sessionRecordId: string;
  readonly loopId: string;
  readonly sessionId: string;
  readonly harnessKind: string;
  readonly pid: number | null;
  readonly processStartTimeMs: number | null;
  readonly title: string | null;
  readonly state: LoopSessionState;
  /** The observed progress state; absent means "no reading yet". */
  readonly progressState?: CoordinatorProgressState;
  readonly acquiredAt: string;
  readonly recordedAt: string;
}): LoopSessionRecord => ({
  schemaId: LOOP_SESSION_PAYLOAD_SCHEMA,
  sessionRecordId: input.sessionRecordId,
  loopId: input.loopId,
  sessionId: input.sessionId,
  harnessKind: input.harnessKind,
  pid: input.pid,
  processStartTimeMs: input.processStartTimeMs,
  title: input.title,
  state: input.state,
  ...(input.progressState === undefined ? {} : { progressState: input.progressState }),
  acquiredAt: input.acquiredAt,
  recordedAt: input.recordedAt,
});

/**
 * The session's `ended` record, derived from the acquisition record: one append
 * per state change and none per cycle (DM-1).
 */
export const endedSessionRecord = (input: {
  readonly record: LoopSessionRecord;
  readonly sessionRecordId: string;
  readonly recordedAt: string;
  /** The last observed progress state; absent keeps the record's own value. */
  readonly progressState?: CoordinatorProgressState;
}): LoopSessionRecord => ({
  ...input.record,
  sessionRecordId: input.sessionRecordId,
  state: "ended",
  ...(input.progressState === undefined ? {} : { progressState: input.progressState }),
  recordedAt: input.recordedAt,
});
