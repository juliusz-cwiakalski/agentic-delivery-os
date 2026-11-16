/**
 * The in-process board harness (test-plan §4.1): injected brand, clock, run id,
 * repository reads, policy, state store, and streams over `runCli`. No child
 * process, no live tree, no wall clock.
 */

import {
  type BoardCommandRuntime,
  type BoardRepositoryLoad,
  type BoardSelectionResolution,
  createBoardCommandDefinition,
} from "../../../packages/cli/src/commands/board";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type {
  BoardAskFact,
  BoardLaneFact,
  BoardOwnerHold,
  BoardParkedFact,
  BoardRepositoryFacts,
  BoardScope,
  BoardSelection,
  OwnerGateCollectorRead,
  OwnerGateFact,
  OwnerGateSlaDecisionRecord,
  OwnerGateSlaPolicy,
} from "../../../packages/core/src/contracts/index";
import {
  boardNeedsDecisionHistory,
  collectorUnavailableCode,
} from "../../../packages/core/src/domain/owner-gate-sla";
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

/** One seedable repository fixture (DM-2, DM-7). */
export type BoardRepositoryFixture = {
  readonly key: string;
  readonly gates?: readonly OwnerGateFact[];
  readonly lanes?: readonly BoardLaneFact[];
  readonly asks?: readonly BoardAskFact[];
  readonly parks?: readonly BoardParkedFact[];
  readonly decisions?: readonly OwnerGateSlaDecisionRecord[];
};

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
  /** The legacy single-repository key (DM-7). */
  readonly repositoryKey?: string;
  /** The full repository fixtures; when present the legacy collectors are unused. */
  readonly repositories?: readonly BoardRepositoryFixture[];
  readonly scope?: BoardScope;
  readonly selection?: BoardSelection;
  readonly omittedRepositories?: number;
  readonly ownerHold?: BoardOwnerHold;
  /** A repository whose read fails with the given classified identity. */
  readonly failingRepository?: {
    readonly key: string;
    readonly code: string;
    readonly kind?: string;
  };
  /** A selection resolution that refuses before any read. */
  readonly selectionFailure?: {
    readonly kind: string;
    readonly code: string;
    readonly summary?: string;
  };
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
  const repositoryKey = options.repositoryKey ?? "example-repository";

  const repositoryFixtures: readonly BoardRepositoryFixture[] = options.repositories ?? [
    {
      key: repositoryKey,
      gates: options.gates ?? [],
      lanes: [],
      asks: [],
      parks: [],
    },
  ];

  const selectionOf = (): BoardSelectionResolution => {
    if (options.selectionFailure !== undefined) {
      return { ok: false, ...options.selectionFailure };
    }
    return {
      ok: true,
      scope: options.scope ?? "repository",
      selection: options.selection ?? "current",
      repositories: repositoryFixtures.map((repository) => repository.key),
      omittedRepositories: options.omittedRepositories ?? 0,
    };
  };

  const decisions = new Map<string, readonly OwnerGateSlaDecisionRecord[]>();
  const collectors = options.collectors ?? [availableCollector("tracker", options.gates ?? [])];

  const loadFromCollectors = async (): Promise<BoardRepositoryLoad> => {
    const gates: OwnerGateFact[] = [];
    for (const collector of collectors) {
      const read = await collector.read();
      if (!read.ok) {
        const id = read.collector.length > 0 ? read.collector : collector.id;
        return {
          ok: false,
          kind: "status",
          code: collectorUnavailableCode(id),
        };
      }
      gates.push(...read.gates);
    }
    const fixture = options.repositories?.find((repository) => repository.key === repositoryKey);
    const asks = fixture?.asks ?? [];
    let records: readonly OwnerGateSlaDecisionRecord[] = [];
    if (
      boardNeedsDecisionHistory({
        gates,
        asks,
        policy,
        nowMs: options.nowMs ?? Date.parse("2026-11-06T12:00:00Z"),
      })
    ) {
      if (!decisions.has(repositoryKey)) {
        recorder.calls.push("readDecisions");
        const read = readOwnerGateSlaDecisions(guarded.store);
        if (!read.ok) {
          return { ok: false, kind: read.error.kind, code: read.error.code };
        }
        decisions.set(repositoryKey, read.value.records);
      }
      records = decisions.get(repositoryKey) ?? [];
    }
    return {
      ok: true,
      facts: {
        key: repositoryKey,
        gates,
        lanes: fixture?.lanes ?? [],
        asks,
        parks: fixture?.parks ?? [],
        decisions: records,
      },
    };
  };

  const runtime: BoardCommandRuntime = {
    resolve: selectionOf,
    loadRepository: async (repository) => {
      if (options.failingRepository !== undefined && options.failingRepository.key === repository) {
        return {
          ok: false,
          kind: options.failingRepository.kind ?? "board",
          code: options.failingRepository.code,
          summary: `repository ${repository} state-unavailable`,
        };
      }
      if (options.collectors !== undefined || options.repositories === undefined) {
        return loadFromCollectors();
      }
      const fixture = repositoryFixtures.find((candidate) => candidate.key === repository);
      if (fixture === undefined) {
        return { ok: false, kind: "board", code: "board.repository-unknown" };
      }
      let records = fixture.decisions;
      if (
        records === undefined &&
        boardNeedsDecisionHistory({
          gates: fixture.gates ?? [],
          asks: fixture.asks ?? [],
          policy,
          nowMs: options.nowMs ?? Date.parse("2026-11-06T12:00:00Z"),
        })
      ) {
        recorder.calls.push("readDecisions");
        const read = readOwnerGateSlaDecisions(guarded.store);
        if (!read.ok) return { ok: false, kind: read.error.kind, code: read.error.code };
        records = read.value.records;
      }
      records ??= [];
      return {
        ok: true,
        facts: {
          key: fixture.key,
          gates: fixture.gates ?? [],
          lanes: fixture.lanes ?? [],
          asks: fixture.asks ?? [],
          parks: fixture.parks ?? [],
          decisions: records,
        } satisfies BoardRepositoryFacts,
      };
    },
    appendDecision: (repository, decision) => {
      recorder.calls.push(`appendDecision:${repository}`);
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
    ownerHold: () => options.ownerHold ?? { active: false },
    policy,
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

export const boardLanes = (run: BoardRun): readonly Record<string, unknown>[] => {
  const lanes = boardData(run)?.lanes;
  return Array.isArray(lanes) ? (lanes as Record<string, unknown>[]) : [];
};

export const boardAsks = (run: BoardRun): readonly Record<string, unknown>[] => {
  const asks = boardData(run)?.asks;
  return Array.isArray(asks) ? (asks as Record<string, unknown>[]) : [];
};

export const boardParked = (run: BoardRun): readonly Record<string, unknown>[] => {
  const parked = boardData(run)?.parked;
  return Array.isArray(parked) ? (parked as Record<string, unknown>[]) : [];
};
