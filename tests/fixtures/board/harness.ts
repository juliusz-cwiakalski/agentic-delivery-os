/**
 * The in-process board harness (test-plan §4.1): injected brand, clock, run id,
 * collectors, policy, state store, and streams over `runCli`. No child process,
 * no live tree, no wall clock.
 */

import {
  type BoardCommandRuntime,
  createBoardCommandDefinition,
} from "../../../packages/cli/src/commands/board";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type {
  OwnerGateCollectorRead,
  OwnerGateFact,
  OwnerGateSlaPolicy,
} from "../../../packages/core/src/contracts/index";
import { collectorUnavailableCode } from "../../../packages/core/src/domain/owner-gate-sla";
import {
  appendOwnerGateSlaDecision,
  readOwnerGateSlaDecisions,
} from "../../../packages/core/src/state/index";
import { guardStore, type VerifyCallRecorder } from "../../behaviour/verify-support";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import {
  createTestEdge,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  type TestEdge,
} from "../state/harness";
import { shippedPolicy } from "./matrix";

export type BoardCollectorSpec = {
  readonly id: string;
  readonly read: () => Promise<OwnerGateCollectorRead>;
};

export type BoardState = {
  readonly root: string;
  readonly identity: ReturnType<typeof makeIdentity>;
  readonly edge: TestEdge;
  readonly store: ReturnType<typeof openStore>["store"];
  readonly cleanup: () => void;
};

export const createBoardState = (workspaceId = "owner-gate-sla-board"): BoardState => {
  const root = makeTempRoot("gh229-board");
  const identity = makeIdentity(root, { workspaceId });
  const edge = createTestEdge();
  const { store } = openStore(identity, { edge });
  return { root, identity, edge, store, cleanup: () => removeRoot(root) };
};

export const availableCollector = (
  id: string,
  gates: readonly OwnerGateFact[],
): BoardCollectorSpec => ({
  id,
  read: async () => ({ ok: true, collector: id, gates, pageItemCount: gates.length }),
});

export const failingCollector = (
  id: string,
  reason: "failed" | "credential-unavailable" | "not-configured" = "failed",
): BoardCollectorSpec => ({
  id,
  read: async () => ({
    ok: false,
    collector: id,
    reason,
    code: collectorUnavailableCode(id),
  }),
});

export type BoardRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type BoardHarnessOptions = {
  readonly gates?: readonly OwnerGateFact[];
  readonly collectors?: readonly BoardCollectorSpec[];
  readonly policy?: OwnerGateSlaPolicy;
  readonly state?: BoardState;
  readonly runId?: string;
  readonly ticks?: readonly [number, number];
  readonly recorder?: VerifyCallRecorder;
  readonly throwOnMutation?: boolean;
  readonly nowIso?: string;
  readonly nowMs?: number;
  readonly appendFails?: boolean;
  readonly secrets?: readonly string[];
};

export type BoardHarness = {
  readonly state: BoardState;
  readonly recorder: VerifyCallRecorder;
  readonly runtime: BoardCommandRuntime;
  run(argv?: readonly string[], options?: { readonly json?: boolean }): Promise<BoardRun>;
  cleanup(): void;
};

export const createBoardHarness = (options: BoardHarnessOptions = {}): BoardHarness => {
  const state = options.state ?? createBoardState();
  const ownsState = options.state === undefined;
  const recorder = options.recorder ?? { calls: [] };
  const guarded = guardStore(state.store, recorder, {
    throwOnMutation: options.throwOnMutation ?? false,
  });
  let fenceCounter = 0;
  const policy = options.policy ?? shippedPolicy();
  const collectors = options.collectors ?? [availableCollector("tracker", options.gates ?? [])];

  const runtime: BoardCommandRuntime = {
    collectors,
    policy,
    readDecisions: () => {
      recorder.calls.push("readDecisions");
      return readOwnerGateSlaDecisions(guarded.store);
    },
    appendDecision: (decision) => {
      recorder.calls.push("appendDecision");
      if (options.appendFails === true) {
        return {
          ok: false,
          error: {
            kind: "state",
            code: "state.write.failed",
            consequence: "not_landed",
            location: { path: "planted-state-path" },
          },
        };
      }
      fenceCounter += 1;
      return appendOwnerGateSlaDecision(guarded.store, {
        decision,
        fenceToken: `board-fence-${fenceCounter}`,
      });
    },
    nowIso: () => options.nowIso ?? "2026-11-06T12:00:00Z",
    nowMs: () => options.nowMs ?? Date.parse("2026-11-06T12:00:00Z"),
  };
  const definition = createBoardCommandDefinition(runtime);
  const run = async (
    argv: readonly string[] = [],
    runOptions: { readonly json?: boolean } = {},
  ): Promise<BoardRun> => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const ticks = options.ticks ?? [100, 100];
    let tick = 0;
    const deps: CliDependencies = {
      brand: SYNTHETIC_BRAND,
      clock: {
        now: () => {
          const value = ticks[Math.min(tick, 1)] as number;
          tick += 1;
          return value;
        },
      },
      newRunId: () => options.runId ?? "run-board-fixture",
      secrets: options.secrets ?? [],
      program: { commands: { board: definition } },
    };
    const finalArgv = runOptions.json === false ? ["board", ...argv] : ["--json", "board", ...argv];
    const exitCode = await runCli(finalArgv, { stdout, stderr }, deps);
    const trimmed = stdout.value.trim();
    const envelope = trimmed.startsWith("{")
      ? (JSON.parse(trimmed) as Record<string, unknown>)
      : undefined;
    return {
      exitCode,
      stdout: stdout.value,
      stderr: stderr.value,
      ...(envelope === undefined ? {} : { envelope }),
    };
  };
  return {
    state,
    recorder,
    runtime,
    run,
    cleanup: () => {
      if (ownsState) state.cleanup();
    },
  };
};

export const boardData = (run: BoardRun): Record<string, unknown> | undefined => {
  const data = run.envelope?.data;
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
};

export const boardGates = (run: BoardRun): readonly Record<string, unknown>[] => {
  const data = boardData(run);
  const gates = data?.gates;
  return Array.isArray(gates) ? (gates as Record<string, unknown>[]) : [];
};
