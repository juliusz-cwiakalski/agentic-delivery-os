/**
 * The GH-290 event-subscription harness.
 *
 * Composes the delivered pieces — `createDaemonCommandRuntime`, the real
 * `createControlServer`, the real `createControlSession`/codec, and the
 * delivered appenders — over a real temp store. The only doubles are the
 * transport pair, the injected clock, and the wake port (the GH-238 pattern).
 * No case writes outside its temp root and no case opens a real socket.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createDaemonCommandRuntime,
  type DaemonComposition,
} from "../../../packages/cli/src/daemon-compose";
import {
  addQueueDependency,
  appendDaemonLane,
  appendDispatchAttempt,
  declareQueueEntry,
  recordResumeIntent,
} from "../../../packages/core/src/app/index";
import {
  BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  type BlockerAnswerRecord,
  type BlockerQuestionRecord,
  CONTROL_PROTOCOL_CURRENT,
  type ControlConnection,
  type ControlFrame,
  type ControlRequestFrame,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type DaemonClockPort,
  type DaemonLaneRecord,
  type DaemonSettings,
  type DaemonWakeKind,
  type DaemonWakePort,
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  type DispatchAttemptRecord,
  type LaneExecutorPort,
  LOCAL_CALLER_PRINCIPAL,
  type QueueEntryRecord,
  type QueueLeaseRecord,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  decodeControlLine,
  encodeControlFrame,
} from "../../../packages/core/src/domain/control-codec";
import {
  appendBlockerAnswer,
  appendBlockerQuestion,
  appendPhaseTransition,
  createDaemonLockPort,
} from "../../../packages/core/src/state/index";
import { createMemoryTransportPair } from "../daemon/transport/pair";
import { createTestEdge, makeIdentity, openStore } from "../state/harness";

export const NOW = "2026-11-12T10:00:00.000Z";

const tempRoot = (label: string): string => {
  const root = join(process.cwd(), "tmp", "tmpdir", `gh290-events-${label}-`);
  mkdirSync(join(process.cwd(), "tmp", "tmpdir"), { recursive: true });
  return mkdtempSync(root);
};

export type HarnessClock = DaemonClockPort & {
  readonly advance: (ms: number) => void;
  readonly now: () => number;
};

const createClock = (startIso: string): HarnessClock => {
  let now = Date.parse(startIso);
  return {
    nowMs: () => now,
    nowIso: () => new Date(now).toISOString(),
    sleep: async () => undefined,
    advance: (ms) => {
      now += ms;
    },
    now: () => now,
  };
};

const createManualWake = () => {
  let pending: ((kind: DaemonWakeKind) => void) | undefined;
  const waiting: Array<() => void> = [];
  const notify = (): void => {
    for (const resolve of waiting.splice(0)) resolve();
  };
  const next = (): Promise<DaemonWakeKind> =>
    new Promise((resolve) => {
      pending = resolve;
      notify();
    });
  const whenWaiting = async (): Promise<void> => {
    if (pending !== undefined) return;
    await new Promise<void>((resolve) => waiting.push(resolve));
  };
  return {
    port: { next } satisfies DaemonWakePort,
    /** Release one loop iteration and wait until the loop waits again. */
    step: async (): Promise<void> => {
      await whenWaiting();
      const resolve = pending;
      pending = undefined;
      resolve?.("poke");
      await whenWaiting();
    },
    release: (): void => {
      const resolve = pending;
      pending = undefined;
      resolve?.("poke");
    },
  };
};

const executor = (): LaneExecutorPort => ({
  availability: () => ({ available: true }),
  start: async () => ({ sessionId: "session-gh290", harnessKind: "opencode" }),
  observe: async () => ({ observable: true, progress: "progressing", done: false }),
  collect: async () => ({ ok: true }),
  resume: async () => true,
});

const settings = (root: string, subscriptionBuffer: number): DaemonSettings => ({
  heartbeatIntervalMs: 5_000,
  heartbeatCycleMs: 60_000,
  lockStalenessMs: 30_000,
  pollIntervalMs: 60_000,
  watchPollIntervalMs: 5_000,
  responseTimeoutMs: 2_000,
  subscriptionBuffer,
  frameMaxBytes: 65_536,
  reconcileMaxLanes: 200,
  transport: "unix",
  socketPath: `${root}/daemon.sock`,
});

export type EventClient = {
  readonly connection: ControlConnection;
  readonly frames: ControlFrame[];
  readonly subscribe: (topic: string, since?: number) => void;
  /** Every event frame received so far, in arrival order. */
  readonly events: () => readonly ControlFrame[];
  /** Drop the received frames so a step's output can be read alone. */
  readonly drain: () => readonly ControlFrame[];
};

export type EventHarness = {
  readonly root: string;
  readonly store: StateStorePort;
  readonly clock: HarnessClock;
  readonly subscribeBuffer: number;
  readonly connect: () => Promise<EventClient>;
  readonly step: () => Promise<void>;
  readonly appendEntry: (entry: QueueEntryRecord) => void;
  readonly appendDependency: (ref: string, edges: readonly string[]) => void;
  readonly appendLease: (lease: QueueLeaseRecord) => void;
  readonly appendLane: (record: DaemonLaneRecord) => void;
  readonly appendAttempt: (record: DispatchAttemptRecord) => void;
  readonly appendPhase: (request: {
    readonly phaseId: string;
    readonly operation: "complete" | "reopen";
    readonly timestamp?: string;
    readonly reason?: string;
    readonly commitIntent?: "atomic" | "record-only";
    readonly commitSha?: string;
  }) => void;
  readonly appendQuestion: (record: BlockerQuestionRecord) => void;
  readonly appendAnswer: (record: BlockerAnswerRecord) => void;
  readonly clearQuestion: (lane: DaemonLaneRecord, questionId: string, mode: string) => void;
  readonly stop: () => Promise<void>;
  readonly close: () => void;
};

export type EventHarnessOptions = {
  readonly label?: string;
  readonly subscriptionBuffer?: number;
  /** Reuse a previous incarnation's root (a restart over the same store). */
  readonly root?: string;
  readonly startIso?: string;
};

/** The eight declared event-frame `data` keys, in order. */
export const ENVELOPE_KEYS = [
  "topic",
  "kind",
  "lane",
  "ref",
  "sequence",
  "occurredAt",
  "payload",
  "taxonomyVersion",
] as const;

export const dataOf = (frame: ControlFrame): Record<string, unknown> =>
  (frame.data ?? {}) as Record<string, unknown>;

export const createEventHarness = async (
  options: EventHarnessOptions = {},
): Promise<EventHarness> => {
  const root = options.root ?? tempRoot(options.label ?? "case");
  const subscriptionBuffer = options.subscriptionBuffer ?? 256;
  const edge = createTestEdge();
  edge.ensureDirectory(root);
  const { store } = openStore(makeIdentity(root));
  const lock = createDaemonLockPort(edge, root);
  const clock = createClock(options.startIso ?? NOW);
  const wake = createManualWake();
  const pair = createMemoryTransportPair();
  let fence = 0;
  let laneOrdinal = 0;
  const fenceToken = (): string => {
    fence += 1;
    return `gh290-fence-${fence}`;
  };
  const appendRaw = (kind: string, key: string, payload: Record<string, unknown>): void => {
    const acquired = store.acquireFence(fenceToken());
    if (!acquired.ok) throw new Error(`fence refused: ${acquired.error.code}`);
    const appended = store.append(acquired.value.handle, {
      kind,
      recordKey: key,
      payload: payload as never,
    });
    store.releaseFence(acquired.value.handle);
    if (!appended.ok) throw new Error(`append refused: ${appended.error.code}`);
  };
  const composition: DaemonComposition = {
    store,
    lock,
    settings: settings(root, subscriptionBuffer),
    restartBound: 3,
    stateDirectory: root,
    unit: "ados.service",
    binary: "ados",
    environmentName: "ADOS_STATE_DIR",
    clock,
    executor: executor(),
    transport: pair.server,
    wake: wake.port,
    newFenceToken: fenceToken,
    newLockToken: () => "lock-gh290",
    newInstanceId: () => `instance-gh290-${options.label ?? "a"}`,
  };
  const runtime = createDaemonCommandRuntime(composition);
  const started = await runtime.start({ foreground: true });
  if (!("data" in started)) throw new Error("daemon runtime failed to start");

  const connect = async (): Promise<EventClient> => {
    const connection = await pair.client.connect();
    const frames: ControlFrame[] = [];
    connection.onLine((line) => {
      const decoded = decodeControlLine(line);
      if (decoded.ok) frames.push(decoded.frame);
    });
    let ordinal = 0;
    const subscribe = (topic: string, since?: number): void => {
      ordinal += 1;
      const request: ControlRequestFrame = {
        v: CONTROL_PROTOCOL_CURRENT,
        kind: "request",
        type: "subscribe",
        id: `sub-${ordinal}`,
        payload: { topic, ...(since === undefined ? {} : { since }) } as never,
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      };
      connection.write(encodeControlFrame(request));
    };
    return {
      connection,
      frames,
      subscribe,
      events: () => frames.filter((frame) => frame.kind === "event"),
      drain: () => frames.splice(0, frames.length),
    };
  };

  return {
    root,
    store,
    clock,
    subscribeBuffer: subscriptionBuffer,
    connect,
    step: async () => {
      await wake.step();
    },
    appendEntry: (record) => {
      const declared = declareQueueEntry(store, {
        ref: record.ref,
        ...(record.repository === undefined ? {} : { repository: record.repository }),
        ...(record.repositoryRoot === undefined ? {} : { repositoryRoot: record.repositoryRoot }),
        priority: record.priority,
        recordedAt: record.recordedAt,
        fenceToken: fenceToken(),
      });
      if (!declared.ok) throw new Error(`entry refused: ${declared.code}`);
    },
    appendDependency: (ref, edges) => {
      for (const edgeRef of edges) {
        const added = addQueueDependency(store, {
          ref,
          onRef: edgeRef,
          recordedAt: new Date(clock.now() + edges.indexOf(edgeRef)).toISOString(),
          fenceToken: fenceToken(),
        });
        if (!added.ok && added.code !== "queue.dependency-cycle") {
          throw new Error(`dependency refused: ${added.code}`);
        }
      }
    },
    appendLease: (record) => {
      appendRaw("queue.lease", `queue.leases:${record.leaseId}`, record as never);
    },
    appendLane: (record) => {
      const appended = appendDaemonLane(store, fenceToken(), {
        ...record,
        spawnOrdinal: record.spawnOrdinal === 0 ? ++laneOrdinal : record.spawnOrdinal,
      });
      if (!appended.ok) throw new Error(`lane refused: ${appended.code}`);
    },
    appendAttempt: (record) => {
      const appended = appendDispatchAttempt(store, fenceToken(), record);
      if (!appended.ok) throw new Error(`attempt refused: ${String(appended.code)}`);
    },
    appendPhase: (request) => {
      const appended = appendPhaseTransition(store, {
        changeRef: "GH-290",
        phaseId: request.phaseId,
        operation: request.operation,
        timestamp: request.timestamp ?? new Date(clock.now()).toISOString(),
        fenceToken: fenceToken(),
        ...(request.reason === undefined ? {} : { reason: request.reason }),
        ...(request.commitIntent === undefined ? {} : { commitIntent: request.commitIntent }),
        ...(request.commitSha === undefined ? {} : { commitSha: request.commitSha }),
      });
      if (!appended.ok) throw new Error(`phase refused: ${appended.error.code}`);
    },
    appendQuestion: (record) => {
      const appended = appendBlockerQuestion(store, { record, fenceToken: fenceToken() });
      if (!appended.ok) throw new Error(`question refused: ${appended.error.code}`);
    },
    appendAnswer: (record) => {
      const appended = appendBlockerAnswer(store, { record, fenceToken: fenceToken() });
      if (!appended.ok) throw new Error(`answer refused: ${appended.error.code}`);
    },
    clearQuestion: (lane, questionId, mode) => {
      const updated = recordResumeIntent(
        { store, fenceToken: fenceToken(), nowIso: clock.nowIso },
        lane,
        { questionId, mode: mode as never },
      );
      if (updated === undefined) throw new Error("resume intent refused");
    },
    stop: async () => {
      wake.release();
      await runtime.stop({ mode: "immediate" });
    },
    close: () => {
      rmSync(root, { recursive: true, force: true });
    },
  };
};

/** A daemon lane record in `delivering`, the `started` source. */
export const laneRecord = (ref: string, recordedAt = NOW): DaemonLaneRecord => ({
  schema: DAEMON_LANE_PAYLOAD_SCHEMA,
  ref,
  state: "delivering",
  harnessKind: "opencode",
  sessionId: `session-${ref}`,
  spawnOrdinal: 1,
  recordedAt,
});

/** A complete attempt record with the given outcome. */
export const attemptRecord = (
  ref: string,
  outcome: DispatchAttemptRecord["outcome"],
  recordedAt = NOW,
): DispatchAttemptRecord => ({
  schema: DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  attemptId: `ATT-${ref}-${outcome}`,
  repository: "github.com/example/repo",
  ref,
  harness: "opencode",
  evidenceClass: "pilot",
  startedAt: recordedAt,
  finishedAt: recordedAt,
  handoverState: "dual-run",
  outcome,
  token: "finished",
  comparison: { class: "verify-change", token: "finished", outcome: "match" },
  falseSuccess: false,
  corroboration: {
    pmNotes: "satisfied",
    tracker: "satisfied",
    ci: "satisfied",
  },
  evidenceRefs: ["evidence-1"],
  recordedAt,
});

/** A CLI-published question: required non-empty lane, `ref: null`. */
export const questionRecord = (id: string, lane: string, askedAt = NOW): BlockerQuestionRecord => ({
  schemaId: BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  id,
  type: "decision-needed",
  audience: "owner",
  lane,
  ref: null,
  question: "Which gate applies?",
  options: ["option-a", "option-b"],
  askedAt,
});

/** An answer record with the delivered resume mode. */
export const answerRecord = (
  questionId: string,
  answeredAt = NOW,
  mode: BlockerAnswerRecord["laneResume"]["mode"] = "boundary-note",
): BlockerAnswerRecord => ({
  schemaId: BLOCKER_ANSWER_PAYLOAD_SCHEMA,
  questionId,
  answeringAudience: "owner",
  choice: "option-a",
  answeredAt,
  applied: false,
  laneResume: {
    mode,
    sessionReentry: false,
    capabilitySource: "adapter-declared",
  },
});
