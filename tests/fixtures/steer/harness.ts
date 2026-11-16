/**
 * The in-process steer harness (GH-298 test plan §4): injected brand, clock,
 * run id, secrets, id/fence factories, origin source, phase fold, delivered asks
 * view, and state port over `runCli`. No child process, no live tree, no wall
 * clock.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  createSteerCommandDefinition,
  type SteerCommandRuntime,
  type SteerSessionPort,
} from "../../../packages/cli/src/commands/steer";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type {
  StateJsonValue,
  StateResult,
  StateStorePort,
  SteerAskSource,
  SteerCompletionRecord,
  SteerMessageRecord,
  SteerOrigin,
  SteerOutcome,
  SteerPhaseFoldView,
} from "../../../packages/core/src/contracts/index";
import {
  appendSteeringCompletion,
  appendSteeringMessage,
  appendSteeringOutcomes,
  readSteeringQueue,
  type SteeringQueueRead,
} from "../../../packages/core/src/state/index";
import { guardStore } from "../../behaviour/verify-support";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import {
  createTestEdge,
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  type TestEdge,
} from "../state/harness";
import {
  EMPTY_ASKS,
  makeAppliedOutcome,
  makeCompletion,
  makeExpiredOutcome,
  makeMessage,
  NO_PHASE,
} from "./cases";

export const FIXED_NOW_ISO = "2026-11-16T12:00:00.000Z";
export const FIXED_NOW_MS = Date.parse(FIXED_NOW_ISO);
export const RUN_ID = "run-steer-fixture";

export const BOUND_ORIGIN: SteerOrigin = {
  change: "GH-298",
  repo: "example/product",
  agent: "owner",
};

export const UNBOUND_ORIGIN: SteerOrigin = {
  change: null,
  repo: "example/product",
  agent: "owner",
};

export type SessionSpy = SteerSessionPort & {
  readonly calls: string[];
  readonly id: string;
};

export const createSessionSpy = (): SessionSpy => {
  const calls: string[] = [];
  return {
    calls,
    id: "sess-steer-1",
    spawn: () => {
      calls.push("spawn");
    },
    attach: () => {
      calls.push("attach");
    },
    resume: () => {
      calls.push("resume");
    },
    steer: () => {
      calls.push("steer");
    },
  };
};

export type SteerStoreMode = "healthy" | "unreadable" | "unwritable" | "unverified" | "corrupt";

export type SteerHarnessOptions = {
  readonly nowIso?: string;
  readonly nowMs?: number;
  readonly brand?: typeof SYNTHETIC_BRAND;
  readonly runId?: string;
  readonly secrets?: readonly string[];
  readonly origin?: SteerOrigin;
  readonly phase?: SteerPhaseFoldView;
  readonly asks?: SteerAskSource;
  readonly storeMode?: SteerStoreMode;
  readonly newMessageSuffix?: () => string;
  readonly workspaceId?: string;
  readonly session?: SessionSpy;
  readonly throwOnMutation?: boolean;
  readonly existingState?: SteerHarnessState;
};

export type SteerHarnessState = {
  readonly root: string;
  readonly identity: ReturnType<typeof makeIdentity>;
  readonly edge: TestEdge;
  readonly store: StateStorePort;
  readonly cleanup: () => void;
};

export const createSteerState = (workspaceId = "gh298-steer"): SteerHarnessState => {
  const root = makeTempRoot("gh298-steer");
  const identity = makeIdentity(root, { workspaceId });
  const edge = createTestEdge();
  const { store } = openStore(identity, { edge });
  return { root, identity, edge, store, cleanup: () => removeRoot(root) };
};

const rawAppend = (
  store: StateStorePort,
  request: { readonly kind: string; readonly recordKey: string; readonly payload: StateJsonValue },
): void => {
  const acquired = store.acquireFence("steer-harness-seed");
  if (!acquired.ok) throw new Error(`seed fence failed: ${acquired.error.code}`);
  try {
    const appended = store.append(acquired.value.handle, request);
    if (!appended.ok) throw new Error(`seed append failed: ${appended.error.code}`);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const failureStore = (
  inner: StateStorePort,
  mode: SteerStoreMode,
): { readonly store: StateStorePort; readonly reset: () => void } => {
  if (mode === "unreadable") {
    const unreadable = <T>(): StateResult<T> => ({
      ok: false,
      error: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: { path: inner.identity.stateDirectory },
      },
    });
    return {
      store: {
        ...inner,
        read: () => unreadable(),
        readRecords: () => unreadable(),
      },
      reset: () => undefined,
    };
  }
  if (mode === "unwritable") {
    return {
      store: {
        ...inner,
        append: () => ({
          ok: false,
          error: {
            kind: "state",
            code: "state.store.torn",
            consequence: "not_landed",
            location: { path: inner.identity.stateDirectory },
          },
        }),
      },
      reset: () => undefined,
    };
  }
  if (mode === "unverified") {
    let suppressNewest = false;
    return {
      store: {
        ...inner,
        append: (handle, request) => {
          const appended = inner.append(handle, request);
          if (appended.ok) suppressNewest = true;
          return appended;
        },
        readRecords: () => {
          const read = inner.readRecords();
          if (!read.ok || !suppressNewest) return read;
          return {
            ok: true,
            value: { records: read.value.records.slice(0, -1), evidence: read.value.evidence },
          };
        },
      },
      reset: () => {
        suppressNewest = false;
      },
    };
  }
  return { store: inner, reset: () => undefined };
};

export type SteerRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
  readonly data?: Record<string, unknown>;
};

export type SteerHarness = {
  readonly state: SteerHarnessState;
  readonly runtime: SteerCommandRuntime;
  readonly recorder: { readonly calls: string[] };
  readonly session: SessionSpy;
  readonly now: { iso: string; ms: number };
  run(argv: readonly string[], options?: { readonly json?: boolean }): Promise<SteerRun>;
  seedMessage(record: SteerMessageRecord): void;
  seedOutcome(record: SteerOutcome): void;
  seedCompletion(record: SteerCompletionRecord): void;
  read(): SteeringQueueRead;
  readResult(): StateResult<SteeringQueueRead>;
  reRead(): StateResult<SteeringQueueRead>;
  ledgerText(): string;
  ledgerBytes(): Buffer;
  resetStoreMode(): void;
  cleanup(): void;
};

export const createSteerHarness = (options: SteerHarnessOptions = {}): SteerHarness => {
  const state = options.existingState ?? createSteerState(options.workspaceId);
  const ownsState = options.existingState === undefined;
  const recorder = { calls: [] as string[] };
  const mode = options.storeMode ?? "healthy";
  const failing = failureStore(state.store, mode);
  const guarded = guardStore(failing.store, recorder, {
    throwOnMutation: options.throwOnMutation ?? false,
  });
  const session = options.session ?? createSessionSpy();
  const now = { iso: options.nowIso ?? FIXED_NOW_ISO, ms: options.nowMs ?? FIXED_NOW_MS };
  let suffixCounter = 0;
  let fenceCounter = 0;
  const nextFence = (): string => {
    fenceCounter += 1;
    return `steer-fence-${fenceCounter}`;
  };
  const runtime: SteerCommandRuntime = {
    brand: options.brand ?? SYNTHETIC_BRAND,
    clock: { nowMs: () => now.ms, nowIso: () => now.iso },
    newMessageSuffix:
      options.newMessageSuffix ??
      (() => {
        suffixCounter += 1;
        return `fixture-${suffixCounter}`;
      }),
    newFenceToken: nextFence,
    origin: () => options.origin ?? BOUND_ORIGIN,
    readQueue: () => readSteeringQueue(guarded.store),
    appendMessage: (record, current) =>
      appendSteeringMessage(guarded.store, {
        record,
        fenceToken: nextFence(),
        ...(current === undefined ? {} : { current }),
      }),
    appendOutcomes: (records, current) =>
      appendSteeringOutcomes(guarded.store, {
        records,
        fenceToken: nextFence(),
        ...(current === undefined ? {} : { current }),
      }),
    appendCompletion: (record, current) =>
      appendSteeringCompletion(guarded.store, {
        record,
        fenceToken: nextFence(),
        ...(current === undefined ? {} : { current }),
      }),
    readPhaseFold: () => ({ ok: true, value: options.phase ?? NO_PHASE }),
    readAsks: () => ({ ok: true, value: options.asks ?? EMPTY_ASKS }),
    secrets: options.secrets ?? [],
    session,
  };
  const definition = createSteerCommandDefinition(runtime);
  const run = async (
    argv: readonly string[],
    runOptions: { readonly json?: boolean } = {},
  ): Promise<SteerRun> => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    let tick = 0;
    const deps: CliDependencies = {
      brand: options.brand ?? SYNTHETIC_BRAND,
      clock: {
        now: () => {
          tick += 1;
          return tick === 1 ? 100 : 110;
        },
      },
      newRunId: () => options.runId ?? RUN_ID,
      secrets: options.secrets ?? [],
      program: { commands: { steer: definition } },
    };
    const finalArgv = runOptions.json === false ? ["steer", ...argv] : ["--json", "steer", ...argv];
    const exitCode = await runCli(finalArgv, { stdout, stderr }, deps);
    const trimmed = stdout.value.trim();
    const envelope = trimmed.startsWith("{")
      ? (JSON.parse(trimmed) as Record<string, unknown>)
      : undefined;
    const data = envelope?.data;
    return {
      exitCode,
      stdout: stdout.value,
      stderr: stderr.value,
      ...(envelope === undefined ? {} : { envelope }),
      ...(typeof data === "object" && data !== null && !Array.isArray(data)
        ? { data: data as Record<string, unknown> }
        : {}),
    };
  };
  const seed = (): void => {
    if (mode === "corrupt") {
      rawAppend(state.store, {
        kind: "steering.message",
        recordKey: "steering.messages:msg-corrupt",
        payload: { schemaId: "delivery.steering.message.v1", id: "msg-corrupt" },
      });
    }
  };
  seed();
  return {
    state,
    runtime,
    recorder,
    session,
    now,
    run,
    seedMessage: (record) => {
      const appended = appendSteeringMessage(state.store, {
        record,
        fenceToken: "steer-seed-message",
      });
      if (!appended.ok) throw new Error(`seed message failed: ${appended.error.code}`);
    },
    seedOutcome: (record) => {
      const appended = appendSteeringOutcomes(state.store, {
        records: [record],
        fenceToken: "steer-seed-outcome",
      });
      if (!appended.ok) throw new Error(`seed outcome failed: ${appended.error.code}`);
    },
    seedCompletion: (record) => {
      const appended = appendSteeringCompletion(state.store, {
        record,
        fenceToken: "steer-seed-completion",
      });
      if (!appended.ok) throw new Error(`seed completion failed: ${appended.error.code}`);
    },
    read: () => {
      const read = readSteeringQueue(state.store);
      if (!read.ok) throw new Error(`read failed: ${read.error.code}`);
      return read.value;
    },
    readResult: () => readSteeringQueue(state.store),
    reRead: () => readSteeringQueue(guarded.store),
    ledgerText: () =>
      existsSync(ledgerPath(state.identity))
        ? readFileSync(ledgerPath(state.identity), "utf8")
        : "",
    ledgerBytes: () =>
      existsSync(ledgerPath(state.identity))
        ? readFileSync(ledgerPath(state.identity))
        : Buffer.alloc(0),
    resetStoreMode: () => failing.reset(),
    cleanup: () => {
      if (ownsState) state.cleanup();
    },
  };
};

export { rawAppend };

/** A queued message with every drawn default (DM-1, DEC-6). */
export const queuedMessage = (overrides: Partial<SteerMessageRecord> = {}): SteerMessageRecord =>
  makeMessage(overrides);

/** A landed note's applied outcome with the complete receipt. */
export const landedOutcome = (
  message: SteerMessageRecord,
  at = FIXED_NOW_ISO,
  boundary = "delivery",
): SteerOutcome => makeAppliedOutcome(message, at, boundary);

/** An expired note's ttl-elapsed outcome. */
export const expiredOutcome = (message: SteerMessageRecord, at = FIXED_NOW_ISO): SteerOutcome =>
  makeExpiredOutcome(message, at);

/** A completion record for a landed note. */
export const completionOf = (
  message: SteerMessageRecord,
  artifact = "doc/changes/2026-11/2026-11-16--GH-298--steer/chg-GH-298-plan.yaml",
  at = FIXED_NOW_ISO,
): SteerCompletionRecord => makeCompletion(message.id, artifact, at);
