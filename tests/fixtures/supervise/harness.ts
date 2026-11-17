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
import type {
  SupervisionClaimRefusal,
  SupervisionEconomicsWritePort,
  SupervisionRestartAdmission,
} from "../../../packages/core/src/app/index";
import {
  createStateSupervisionReadPort,
  createStateSupervisionWritePort,
  runSupervisionBattery,
  type SupervisionBatteryResult,
  type SupervisionReadPort,
} from "../../../packages/core/src/app/index";
import type {
  QueueLanesData,
  QueueParkCause,
  QueueParkEvaluation,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { foldLanes, type QueueLaneEconomics } from "../../../packages/core/src/domain/queue-lanes";
import { createParkRecord } from "../../../packages/core/src/domain/queue-park";
import { computeQueueSchedule } from "../../../packages/core/src/domain/queue-precedence";
import {
  appendBlockerQuestion,
  appendEconomicsRestartEvent,
  ensureEconomicsExhaustionRecord,
  readBlockerLedger,
} from "../../../packages/core/src/state/index";
import { activeLease, makeFacts, REPO_A } from "../queue/schedule/harness";
import { type QueueCliRun, runProgram } from "../queue-ready/harness";
import { makeIdentity, openStore } from "../state/harness";
import type { SupervisionSeedTarget } from "./records";
import { isoAt } from "./records";
import { createSupervisionRepository, type SupervisionTempRepository } from "./temp-git";

/** The delivered economics append paths over the fixture store. */
export const createTestEconomicsWrite = (
  store: StateStorePort,
  fence: (label: string) => string,
): SupervisionEconomicsWritePort => ({
  appendRestart: ({ ref, ordinal, runId, recordedAt }) => {
    const outcome = appendEconomicsRestartEvent(store, fence("economics-restart"), {
      schemaId: "delivery.economics.restart.v1",
      workItemRef: ref,
      runId,
      sessionId: "supervise",
      ordinal,
      reason: "session-interrupted",
      recordedAt,
    });
    return outcome.ok
      ? { ok: true, appended: outcome.appended }
      : { ok: false, code: outcome.code };
  },
  ensureExhaustion: ({ ref, restarts, recordedAt }) => {
    const outcome = ensureEconomicsExhaustionRecord(store, fence("economics-exhaustion"), {
      schemaId: "delivery.economics.exhaustion.v1",
      workItemRef: ref,
      runId: "supervise",
      reason: "dispatch.restart-budget-exceeded",
      restarts,
      historyRef: `economics/${ref}`,
      terminal: true,
      options: ["requeue-fresh-budget", "park-owner-review"],
      recordedAt,
    });
    return outcome.ok
      ? { ok: true, appended: outcome.appended }
      : { ok: false, code: outcome.code };
  },
  raiseQuestion: ({ ref, restarts, askedAt }) => {
    const ledger = readBlockerLedger(store);
    if (!ledger.ok) return { ok: false, code: ledger.error.code };
    const id = `supervise-exhaustion-${ref}`;
    if (ledger.value.questions.some((question) => question.id === id)) {
      return { ok: true, appended: false };
    }
    const appended = appendBlockerQuestion(store, {
      record: {
        schemaId: "delivery.blocker.question.v1",
        id,
        type: "decision-needed",
        audience: "owner",
        lane: "supervise",
        ref,
        question: `the restart budget for ${ref} is exhausted after ${String(restarts)} restarts; choose the recovery route`,
        options: ["requeue-fresh-budget", "park-owner-review"],
        askedAt,
      },
      fenceToken: fence("supervise-question"),
    });
    return appended.ok
      ? { ok: true, appended: appended.value.appended }
      : { ok: false, code: appended.error.code };
  },
});

export const HARNESS_NOW_ISO = "2026-11-17T00:00:00.000Z";
export const HARNESS_REPOSITORY = "github.com/example/supervision-repo";

export type SupervisionRunOptions = {
  readonly repository?: string;
  readonly nowMs?: number;
  readonly runId?: string;
  readonly admitRestart?: (ref: string) => SupervisionRestartAdmission | undefined;
  readonly claimRefusal?: (ref: string) => SupervisionClaimRefusal | undefined;
};

export type SupervisionHarness = {
  readonly directory: string;
  readonly repository: string;
  readonly repositoryFixture: SupervisionTempRepository;
  readonly store: StateStorePort;
  readonly nowMs: number;
  readonly nowIso: string;
  readonly seed: SupervisionSeedTarget;
  /** Run one battery pass and return its result; the read counter resets. */
  readonly battery: (options?: SupervisionRunOptions) => SupervisionBatteryResult;
  /** The port read passes observed by the most recent battery run. */
  readonly reads: { count: number };
  /** Run the composed `supervise` command in process (captured streams). */
  readonly runCli: (
    argv: readonly string[],
    options?: SupervisionRunOptions,
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
        write: createStateSupervisionWritePort({ store, newFenceToken: fence }),
        economicsWrite: createTestEconomicsWrite(store, fence),
        ...(runOptions.admitRestart === undefined ? {} : { admitRestart: runOptions.admitRestart }),
        ...(runOptions.claimRefusal === undefined ? {} : { claimRefusal: runOptions.claimRefusal }),
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
              write: createStateSupervisionWritePort({ store, newFenceToken: fence }),
              economicsWrite: createTestEconomicsWrite(store, fence),
              ...(runOptions.admitRestart === undefined
                ? {}
                : { admitRestart: runOptions.admitRestart }),
              ...(runOptions.claimRefusal === undefined
                ? {}
                : { claimRefusal: runOptions.claimRefusal }),
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

export const LANES_NOW_ISO = "2026-11-17T00:00:00.000Z";
export const LANES_RECHECK_MS = 60_000;

/**
 * Fold one lane read exactly as the delivered lanes surface does, carrying the
 * park evaluation and record so the additive `until` is exercised end to end.
 */
export const lanesReadFor = (input: {
  readonly ref?: string;
  readonly cause?: QueueParkCause;
  readonly until?: string;
  readonly leased?: boolean;
}): QueueLanesData => {
  const ref = input.ref ?? "GH-295";
  const cause = input.cause;
  const record =
    cause === undefined
      ? undefined
      : createParkRecord({
          ref,
          repository: REPO_A,
          cause,
          condition:
            cause === "owner-hold"
              ? { type: "preemption" }
              : { type: "provider-window", expiresAt: input.until ?? LANES_NOW_ISO },
          recheckMs: LANES_RECHECK_MS,
          evaluatedAt: LANES_NOW_ISO,
          recordedAt: LANES_NOW_ISO,
          ...(input.until === undefined ? {} : { until: input.until }),
        });
  const evaluation: QueueParkEvaluation | undefined =
    cause === undefined
      ? undefined
      : {
          state: "active",
          cause,
          recheckMs: LANES_RECHECK_MS,
          lastEvaluatedAt: LANES_NOW_ISO,
          ...(input.until === undefined ? {} : { expiresAt: input.until }),
        };
  const facts = makeFacts(
    [
      {
        ref,
        repository: REPO_A,
        priority: 1,
        ...(evaluation === undefined ? {} : { park: evaluation }),
      },
    ],
    {
      parkRecords: record === undefined ? [] : [record],
      leases:
        input.leased === true ? [activeLease({ repository: REPO_A, holder: "holder-a", ref })] : [],
    },
  );
  const economics: Readonly<Record<string, QueueLaneEconomics>> = {
    [ref]: { restarts: 1, amplification: 2 },
  };
  const schedule = computeQueueSchedule(facts, { next: 20 });
  return foldLanes({ schedule, economics, degraded: [] });
};

export { isoAt };
