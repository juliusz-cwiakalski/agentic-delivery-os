/**
 * The in-process blockers harness (test-plan §4.1): injected brand, clock, run
 * id, secrets, id generator, state store, caller-audience fact, capability, and
 * delegation policy over `runCli`. No child process, no live tree, no wall clock.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  type BlockerSessionPort,
  type BlockersCommandRuntime,
  createBlockersCommandDefinition,
} from "../../../packages/cli/src/commands/blockers";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type {
  BlockerAnswerRecord,
  BlockerCapabilityFact,
  BlockerDelegationPolicy,
  BlockerQuestionRecord,
  StateJsonValue,
} from "../../../packages/core/src/contracts/index";
import {
  appendBlockerAnswer,
  appendBlockerQuestion,
  type BlockerLedgerRead,
  readBlockerLedger,
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
import { shippedPolicy } from "./policy";

export const FIXED_NOW_ISO = "2026-11-06T12:00:00Z";
export const FIXED_NOW_MS = Date.parse(FIXED_NOW_ISO);
export const RUN_ID = "run-blockers-fixture";

export type SessionSpy = BlockerSessionPort & { readonly calls: string[] };

export const createSessionSpy = (): SessionSpy => {
  const calls: string[] = [];
  return {
    calls,
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

export type BlockerHarnessOptions = {
  readonly callerAudienceFact?: string | undefined;
  readonly capability?: BlockerCapabilityFact;
  readonly delegationPolicy?: BlockerDelegationPolicy;
  readonly secrets?: readonly string[];
  readonly nowIso?: string;
  readonly nowMs?: number;
  readonly brand?: typeof SYNTHETIC_BRAND;
  readonly runId?: string;
  readonly session?: SessionSpy;
  readonly throwOnMutation?: boolean;
  readonly workspaceId?: string;
  readonly seedQuestions?: readonly BlockerQuestionRecord[];
  readonly seedAnswers?: readonly BlockerAnswerRecord[];
  readonly existingState?: BlockerHarnessState;
};

export type BlockerHarnessState = {
  readonly root: string;
  readonly identity: ReturnType<typeof makeIdentity>;
  readonly edge: TestEdge;
  readonly store: ReturnType<typeof openStore>["store"];
  readonly cleanup: () => void;
};

export const createBlockerState = (workspaceId = "gh230-blockers"): BlockerHarnessState => {
  const root = makeTempRoot("gh230-blockers");
  const identity = makeIdentity(root, { workspaceId });
  const edge = createTestEdge();
  const { store } = openStore(identity, { edge });
  return { root, identity, edge, store, cleanup: () => removeRoot(root) };
};

const rawAppend = (
  store: ReturnType<typeof openStore>["store"],
  request: { readonly kind: string; readonly recordKey: string; readonly payload: StateJsonValue },
): void => {
  const acquired = store.acquireFence("harness-seed");
  if (!acquired.ok) throw new Error(`seed fence failed: ${acquired.error.code}`);
  try {
    const appended = store.append(acquired.value.handle, request);
    if (!appended.ok) throw new Error(`seed append failed: ${appended.error.code}`);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

export type BlockerRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
  readonly data?: Record<string, unknown>;
};

export type BlockersHarness = {
  readonly state: BlockerHarnessState;
  readonly runtime: BlockersCommandRuntime;
  readonly recorder: { readonly calls: string[] };
  readonly session: SessionSpy;
  readonly now: { iso: string; ms: number };
  run(argv: readonly string[], options?: { readonly json?: boolean }): Promise<BlockerRun>;
  seedQuestion(record: BlockerQuestionRecord): void;
  seedAnswer(record: BlockerAnswerRecord): void;
  read(): BlockerLedgerRead;
  readResult(): ReturnType<typeof readBlockerLedger>;
  reRead(): ReturnType<typeof readBlockerLedger>;
  ledgerText(): string;
  ledgerBytes(): Buffer;
  cleanup(): void;
};

export const createBlockersHarness = (options: BlockerHarnessOptions = {}): BlockersHarness => {
  const state = options.existingState ?? createBlockerState(options.workspaceId);
  const ownsState = options.existingState === undefined;
  const recorder = { calls: [] as string[] };
  const guarded = guardStore(state.store, recorder, {
    throwOnMutation: options.throwOnMutation ?? false,
  });
  const session = options.session ?? createSessionSpy();
  const now = { iso: options.nowIso ?? FIXED_NOW_ISO, ms: options.nowMs ?? FIXED_NOW_MS };
  let suffixCounter = 0;
  let fenceCounter = 0;
  const runtime: BlockersCommandRuntime = {
    brand: options.brand ?? SYNTHETIC_BRAND,
    clock: { nowMs: () => now.ms, nowIso: () => now.iso },
    newQuestionSuffix: () => {
      suffixCounter += 1;
      return `fixture-${suffixCounter}`;
    },
    newFenceToken: () => {
      fenceCounter += 1;
      return `blockers-fence-${fenceCounter}`;
    },
    readBlockers: () => readBlockerLedger(guarded.store),
    appendQuestion: (record, current) =>
      appendBlockerQuestion(guarded.store, {
        record,
        fenceToken: `blockers-append-${++fenceCounter}`,
        ...(current === undefined ? {} : { current }),
      }),
    appendAnswer: (record, current) =>
      appendBlockerAnswer(guarded.store, {
        record,
        fenceToken: `blockers-append-${++fenceCounter}`,
        ...(current === undefined ? {} : { current }),
      }),
    callerAudienceFact: options.callerAudienceFact,
    capability: options.capability,
    delegationPolicy: options.delegationPolicy ?? shippedPolicy(),
    secrets: options.secrets ?? [],
    session,
  };
  for (const question of options.seedQuestions ?? []) {
    const appended = appendBlockerQuestion(state.store, {
      record: question,
      fenceToken: "harness-seed-question",
    });
    if (!appended.ok) throw new Error(`seed question failed: ${appended.error.code}`);
  }
  for (const answer of options.seedAnswers ?? []) {
    const appended = appendBlockerAnswer(state.store, {
      record: answer,
      fenceToken: "harness-seed-answer",
    });
    if (!appended.ok) throw new Error(`seed answer failed: ${appended.error.code}`);
  }
  const definition = createBlockersCommandDefinition(runtime);
  const run = async (
    argv: readonly string[],
    runOptions: { readonly json?: boolean } = {},
  ): Promise<BlockerRun> => {
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
      program: { commands: { blockers: definition } },
    };
    const finalArgv =
      runOptions.json === false ? ["blockers", ...argv] : ["--json", "blockers", ...argv];
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
  return {
    state,
    runtime,
    recorder,
    session,
    now,
    run,
    seedQuestion: (record) => {
      const appended = appendBlockerQuestion(state.store, {
        record,
        fenceToken: "harness-seed-question",
      });
      if (!appended.ok) throw new Error(`seed question failed: ${appended.error.code}`);
    },
    seedAnswer: (record) => {
      const appended = appendBlockerAnswer(state.store, {
        record,
        fenceToken: "harness-seed-answer",
      });
      if (!appended.ok) throw new Error(`seed answer failed: ${appended.error.code}`);
    },
    read: () => {
      const read = readBlockerLedger(state.store);
      if (!read.ok) throw new Error(`read failed: ${read.error.code}`);
      return read.value;
    },
    readResult: () => readBlockerLedger(state.store),
    reRead: () => readBlockerLedger(guarded.store),
    ledgerText: () =>
      existsSync(ledgerPath(state.identity))
        ? readFileSync(ledgerPath(state.identity), "utf8")
        : "",
    ledgerBytes: () =>
      existsSync(ledgerPath(state.identity))
        ? readFileSync(ledgerPath(state.identity))
        : Buffer.alloc(0),
    cleanup: () => {
      if (ownsState) state.cleanup();
    },
  };
};

export { rawAppend };
