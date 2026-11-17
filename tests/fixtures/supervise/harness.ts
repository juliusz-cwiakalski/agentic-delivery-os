/**
 * In-process supervision battery harness (GH-295 test plan §6, NFR-7).
 *
 * One real temporary repository, one delivered state store inside it, an
 * injected clock, and a recording read port. The same battery function the CLI
 * projects is exercised here; no case reads the wall clock, the environment, or
 * the process table.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createSuperviseCommandDefinition } from "../../../packages/cli/src/commands/supervise";
import {
  createStateSupervisionReadPort,
  runSupervisionBattery,
  type SupervisionBatteryResult,
  type SupervisionReadPort,
} from "../../../packages/core/src/app/index";
import type { StateStorePort } from "../../../packages/core/src/contracts/index";
import { type QueueCliRun, runProgram } from "../queue-ready/harness";
import { makeIdentity, openStore } from "../state/harness";
import type { SupervisionSeedTarget } from "./records";
import { isoAt } from "./records";
import { createSupervisionRepository, type SupervisionTempRepository } from "./temp-git";

export const HARNESS_NOW_ISO = "2026-11-17T00:00:00.000Z";
export const HARNESS_REPOSITORY = "github.com/example/supervision-repo";

export type SupervisionHarness = {
  readonly directory: string;
  readonly repository: string;
  readonly repositoryFixture: SupervisionTempRepository;
  readonly store: StateStorePort;
  readonly nowMs: number;
  readonly nowIso: string;
  readonly seed: SupervisionSeedTarget;
  /** Run one battery pass and return its result; the read counter resets. */
  readonly battery: (options?: {
    readonly repository?: string;
    readonly nowMs?: number;
  }) => SupervisionBatteryResult;
  /** The port read passes observed by the most recent battery run. */
  readonly reads: { count: number };
  /** Run the composed `supervise` command in process (captured streams). */
  readonly runCli: (
    argv: readonly string[],
    options?: { readonly repository?: string; readonly nowMs?: number; readonly runId?: string },
  ) => Promise<QueueCliRun>;
  readonly remove: () => void;
};

export type SupervisionHarnessOptions = {
  readonly label?: string;
  readonly nowMs?: number;
  readonly repository?: string;
};

export const createSupervisionHarness = (
  options: SupervisionHarnessOptions = {},
): SupervisionHarness => {
  const repositoryFixture = createSupervisionRepository(options.label ?? "supervise");
  const directory = repositoryFixture.directory;
  const stateDirectory = join(directory, ".supervision-state");
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  const { store } = openStore(makeIdentity(stateDirectory));
  const nowMs = options.nowMs ?? Date.parse(HARNESS_NOW_ISO);
  const nowIso = new Date(nowMs).toISOString();
  const repository = options.repository ?? HARNESS_REPOSITORY;
  let fenceSequence = 0;
  const fence = (label: string): string => {
    fenceSequence += 1;
    return `${label}-${fenceSequence}`;
  };
  const seed: SupervisionSeedTarget = { store, nowMs, nowIso, repository, root: directory, fence };

  const reads = { count: 0 };
  return {
    directory,
    repository,
    repositoryFixture,
    store,
    nowMs,
    nowIso,
    seed,
    reads,
    battery: (runOptions = {}) => {
      const runNowMs = runOptions.nowMs ?? nowMs;
      const inner = createStateSupervisionReadPort(store);
      const port: SupervisionReadPort = {
        read: (request) => {
          reads.count += 1;
          return inner.read(request);
        },
      };
      return runSupervisionBattery({
        repository: runOptions.repository ?? repository,
        nowMs: runNowMs,
        nowIso: new Date(runNowMs).toISOString(),
        read: port,
      });
    },
    runCli: async (argv, runOptions = {}) => {
      reads.count = 0;
      const runNowMs = runOptions.nowMs ?? nowMs;
      const inner = createStateSupervisionReadPort(store);
      const port: SupervisionReadPort = {
        read: (request) => {
          reads.count += 1;
          return inner.read(request);
        },
      };
      return runProgram(
        argv,
        {
          commands: {
            supervise: createSuperviseCommandDefinition({
              repository: runOptions.repository ?? repository,
              read: port,
              nowMs: () => runNowMs,
              nowIso: () => new Date(runNowMs).toISOString(),
            }),
          },
        },
        { runId: runOptions.runId ?? "run-supervision-fixture" },
      );
    },
    remove: () => repositoryFixture.remove(),
  };
};

/** A deterministic synthetic snapshot for scale cells (the fold is the subject). */
export const syntheticLaneSnapshot = (
  repository: string,
  laneCount: number,
): SupervisionScopeSnapshot => ({
  repository,
  lanes: Array.from({ length: laneCount }, (_, index) => ({
    ref: `GH-${1_000 + index}`,
    repository,
    firstHeartbeatAt: "2026-11-16T23:55:00.000Z",
    lastHeartbeatAt: "2026-11-16T23:58:00.000Z",
    heartbeatOrdinal: 1,
    artifacts:
      index % 2 === 0
        ? { classes: ["commit-record"], instants: ["2026-11-16T23:59:00.000Z"] }
        : { classes: [], instants: [] },
  })),
  leases: [],
  degraded: [],
});

/** A recording port over a synthetic snapshot: one read pass per run. */
export const syntheticReadPort = (
  snapshot: SupervisionScopeSnapshot,
  reads: { count: number },
): SupervisionReadPort => ({
  read: (request) => {
    reads.count += 1;
    return { ok: true, snapshot: { ...snapshot, repository: request.repository } };
  },
});

export { isoAt };
