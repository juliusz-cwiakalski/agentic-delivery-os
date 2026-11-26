/**
 * Shared command-level dispatch harness (GH-239 §6.2): an isolated state root,
 * a scripted harness session port, injected truth reads, a recording lease and
 * merge seam, and `runCli` invocation over the delivered command definition.
 *
 * The real shared classifier, the real derivation, and the real ledger are
 * used; only external I/O is scripted.
 */

import { createDispatchCommandDefinition } from "../../../../packages/cli/src/commands/dispatch";
import {
  createDispatchCommandRuntime,
  type DispatchCommandRuntime,
} from "../../../../packages/cli/src/edge";
import { type CliStreams, runCli } from "../../../../packages/cli/src/index";
import { projectExitCode } from "../../../../packages/cli/src/projection";
import type {
  DispatchCadenceWait,
  DispatchLeaseClaim,
  DispatchPeakWatchPorts,
  DispatchPreflightPort,
  DispatchTruthReads,
} from "../../../../packages/core/src/app/dispatch";
import { resolveBrandIdentity } from "../../../../packages/core/src/branding/index";
import {
  DELIVERY_RESULT_TAXONOMY,
  type DeliveryResultToken,
  type DispatchDelay,
  type DispatchEnvelopeData,
  type DispatchEvidenceClass,
  ECONOMICS_EXHAUSTION_OPTIONS,
  ECONOMICS_EXHAUSTION_SCHEMA_ID,
  type HarnessEvidence,
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessFailure,
  type HarnessLivenessReport,
  type HarnessSessionPort,
  type ProviderProfilePeakRules,
  type QueueParkPreservation,
  type QueueParkRecord,
  type StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import {
  appendEconomicsRestartEvent,
  ensureEconomicsExhaustionRecord,
} from "../../../../packages/core/src/state/index";
import { COMPLETED_EVIDENCE, createDispatchState, createScriptedHarness } from "../harness";
import { truthInput as defaultTruthInput } from "../truth";

const BRAND = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

export const FIXED_CLOCK = { now: () => Date.parse("2026-11-08T10:00:00.000Z") };

export type CommandRun = {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: {
    readonly exitCode: number;
    readonly data?: DispatchEnvelopeData;
    readonly error?: {
      readonly code: string;
      readonly category: string;
      readonly retryable: boolean;
      readonly consequence: string;
      readonly remediationHint: string;
      readonly summary?: string;
      readonly detail?: {
        readonly kind: "harness" | "config";
        readonly code: string;
        readonly field?: string;
      };
    };
  };
};

export type CommandScenarioOptions = {
  readonly label?: string;
  readonly evidence?: HarnessEvidence;
  readonly spawnFails?: boolean;
  /** An explicit underlying spawn failure; takes precedence over `spawnFails`. */
  readonly spawnFailure?: HarnessFailure;
  readonly collectFails?: boolean;
  readonly claim?: DispatchLeaseClaim;
  readonly reads?: DispatchTruthReads;
  /** A per-call truth-read sequence (the last entry repeats). */
  readonly readsSequence?: readonly DispatchTruthReads[];
  readonly evidenceClass?: DispatchEvidenceClass;
  readonly repository?: string;
  readonly handover?: "dual-run" | "authoritative";
  readonly restartBudget?: number;
  readonly initialRestarts?: number;
  /** The delivery's persisted restart count the run reads at run time. */
  readonly restartCount?: number;
  /** The real `lane.liveness-interval` value the watcher is composed with. */
  readonly livenessIntervalMs?: number;
  /** A deterministic liveness sequence the scripted harness consumes per poll. */
  readonly livenessSequence?: readonly HarnessLivenessReport[];
  /** A deterministic report per 1-based poll; precedence over the sequence. */
  readonly livenessOf?: (poll: number) => HarnessLivenessReport;
  /** Resolve `collect` once this many liveness polls have happened. */
  readonly collectAfterPolls?: number;
  /** The advancing clock the composition reads; defaults to the fixed instant. */
  readonly nowIso?: () => string;
  readonly gate?: {
    readonly scope?: "production" | "controlled";
    readonly principal?: string;
    readonly max?: number;
    readonly resolveRepository?: (repo: string) => string | undefined;
  };
  readonly lane?: {
    readonly completedPhases?: readonly string[];
    readonly adapterSupportsResumeInjection?: boolean;
    readonly restartCount?: number;
    readonly prefillCost?: number | null;
    readonly uniqueProgress?: number | null;
  };
  readonly harnessKind?: "opencode" | "claude-code";
  /** An injected real session port; defaults to the delivered scripted port. */
  readonly harnessPort?: HarnessSessionPort;
  /** The execution-environment descriptor dispatch hands to the port. */
  readonly descriptor?: HarnessExecutionEnvironmentDescriptor;
  /** Registered secret values for the redaction path. */
  readonly secrets?: readonly string[];
  /** The prompt factory dispatch hands to the port. */
  readonly prompt?: (ref: string) => string;
  readonly newAttemptId?: (ref: string) => string;
  readonly newDivergenceId?: (ref: string) => string;
  /** The optional admission preflight; omitting it keeps the delivered order. */
  readonly preflight?: DispatchPreflightPort;
  /** The injected delay fact (GH-347 AC-F9-2); absent keeps the delivered order. */
  readonly delay?: DispatchDelay;
  /** The advisory lane owner facts (GH-347 DM-1); absent keeps the lane write off. */
  readonly laneOwner?: { readonly processId: number; readonly startedAt: string };
  /** The borrowed terminate grace (GH-347 DEC-4). */
  readonly killGraceMs?: number;
  /** An injected restart append; the default appends a real economics record. */
  readonly appendRestart?: DispatchPorts["appendRestart"];
  /** The run-path lease renewal (GH-413 DEC-13); absent keeps no renewal. */
  readonly renewLease?: DispatchPorts["renewLease"];
  /** The resolved `queue.lease-ttl` the renewal cadence derives from. */
  readonly leaseTtlMs?: number;
  /** The nomination gate (GH-413 tests need a stored profile). */
  readonly nominate?: DispatchPorts["nominate"];
  /** The dispatch-owned window watch (GH-413); absent keeps no watch. */
  readonly peak?: DispatchPorts["peak"];
  /** The operator stop runtime (GH-413); absent refuses the command. */
  readonly stop?: DispatchCommandRuntime["stop"];
  /** A fake cadence wait; defaults to one that resolves immediately. */
  readonly waitForCadence?: DispatchPorts["waitForCadence"];
  /** An optional store wrapper (for targeted append failures). */
  readonly store?: (store: StateStorePort) => StateStorePort;
};

export type CommandScenario = {
  readonly state: ReturnType<typeof createDispatchState>;
  readonly scripted: ReturnType<typeof createScriptedHarness>;
  readonly runtime: DispatchCommandRuntime;
  readonly calls: {
    readonly spawn: number;
    readonly resume: number;
    readonly merge: number;
    readonly claims: string[];
    readonly releases: string[];
    readonly exhaustions: readonly { readonly ref: string; readonly restarts: number }[];
    readonly restarts: readonly { readonly ordinal: number; readonly reason: string }[];
  };
  readonly invoke: (argv: readonly string[]) => Promise<CommandRun>;
  readonly dispose: () => void;
};

const parseEnvelope = (stdout: string): CommandRun["envelope"] | undefined => {
  const text = stdout.trim();
  if (!text.startsWith("{")) return undefined;
  try {
    return JSON.parse(text) as CommandRun["envelope"];
  } catch {
    return undefined;
  }
};

export const readsFrom = (overrides: Partial<DispatchTruthReads> = {}): DispatchTruthReads => {
  const base = defaultTruthInput();
  return {
    artifacts: base.artifacts,
    ledger: base.ledger,
    tracker: base.tracker,
    ci: { ok: true, value: { verdict: "success" } },
    verifyOutcome: null,
    trackerToken: null,
    phasesComplete: true,
    ...overrides,
  };
};

let attemptSequence = 0;
let divergenceSequence = 0;

export const createCommandScenario = (options: CommandScenarioOptions = {}): CommandScenario => {
  const state = createDispatchState(options.label ?? "command");
  const scripted = createScriptedHarness({
    ...(options.evidence === undefined ? {} : { evidence: options.evidence }),
    ...(options.spawnFails === undefined ? {} : { spawnFails: options.spawnFails }),
    ...(options.spawnFailure === undefined ? {} : { spawnFailure: options.spawnFailure }),
    ...(options.collectFails === undefined ? {} : { collectFails: options.collectFails }),
    ...(options.livenessSequence === undefined
      ? {}
      : { livenessSequence: options.livenessSequence }),
    ...(options.livenessOf === undefined ? {} : { livenessOf: options.livenessOf }),
    ...(options.collectAfterPolls === undefined
      ? {}
      : { collectAfterPolls: options.collectAfterPolls }),
    ...(options.harnessKind === undefined ? {} : { harnessKind: options.harnessKind }),
  });
  const calls = {
    spawn: 0,
    resume: 0,
    merge: 0,
    claims: [] as string[],
    releases: [] as string[],
    exhaustions: [] as { readonly ref: string; readonly restarts: number }[],
    restarts: [] as { readonly ordinal: number; readonly reason: string }[],
  };
  const nowIso = options.nowIso ?? (() => "2026-11-08T10:00:00.000Z");

  const runtime = createDispatchCommandRuntime({
    store: options.store === undefined ? state.store : options.store(state.store),
    stateRoot: state.root,
    fenceToken: state.fenceToken,
    nowIso,
    newAttemptId: () => {
      if (options.newAttemptId !== undefined) return options.newAttemptId("GH-301");
      attemptSequence += 1;
      return `attempt-${attemptSequence}`;
    },
    newDivergenceId: () => {
      if (options.newDivergenceId !== undefined) return options.newDivergenceId("GH-301");
      divergenceSequence += 1;
      return `DIV-${divergenceSequence}`;
    },
    harnesses: {
      [options.harnessKind ?? "opencode"]: options.harnessPort ?? scripted.port,
      opencode:
        options.harnessKind === undefined ? (options.harnessPort ?? scripted.port) : undefined,
      "claude-code":
        options.harnessKind === undefined ? (options.harnessPort ?? scripted.port) : undefined,
    },
    defaultHarness: options.harnessKind ?? "opencode",
    descriptor: options.descriptor ?? {
      kind: "host",
      workDirectory: state.root,
      environment: [],
    },
    prompt: options.prompt ?? ((ref) => `deliver ${ref}`),
    ...(options.evidenceClass === undefined ? {} : { evidenceClass: options.evidenceClass }),
    repository: () => options.repository ?? "github.com/owner/repo",
    readTruth: async () => {
      const sequence = options.readsSequence;
      if (sequence !== undefined && sequence.length > 0) {
        const next = sequence.shift() ?? sequence[sequence.length - 1];
        if (next !== undefined) return next;
      }
      return options.reads ?? readsFrom();
    },
    ...(options.preflight === undefined ? {} : { preflight: options.preflight }),
    ...(options.delay === undefined ? {} : { delay: options.delay }),
    ...(options.laneOwner === undefined ? {} : { laneOwner: options.laneOwner }),
    ...(options.killGraceMs === undefined ? {} : { killGraceMs: options.killGraceMs }),
    appendRestart:
      options.appendRestart ??
      ((input) => {
        calls.restarts = [...calls.restarts, { ordinal: input.ordinal, reason: input.reason }];
        const appended = appendEconomicsRestartEvent(state.store, state.fenceToken, {
          schemaId: "delivery.economics.restart.v1",
          workItemRef: input.ref,
          runId: input.runId,
          sessionId: input.sessionId,
          ordinal: input.ordinal,
          reason: input.reason,
          recordedAt: input.recordedAt,
        });
        return appended.ok;
      }),
    ...(options.nominate === undefined ? {} : { nominate: options.nominate }),
    claimLease: () => {
      calls.claims.push("claim");
      return options.claim ?? { ok: true, leaseId: "lease-1" };
    },
    releaseLease: (_ref, cause) => {
      calls.releases.push(cause);
      return true;
    },
    phaseLedger: () => ({ completed: 3, total: 9, variant: "full" }),
    ...(options.restartBudget === undefined ? {} : { restartBudget: options.restartBudget }),
    ...(options.restartCount === undefined
      ? {}
      : { restartCount: () => options.restartCount ?? 0 }),
    ...(options.livenessIntervalMs === undefined
      ? {}
      : {
          livenessIntervalMs: options.livenessIntervalMs,
          // The fake cadence resolves immediately: the scripted harness decides
          // when `collect` completes, so no wall clock participates.
          waitForCadence:
            options.waitForCadence ?? (() => ({ promise: Promise.resolve(), cancel: () => {} })),
        }),
    ...(options.renewLease === undefined ? {} : { renewLease: options.renewLease }),
    ...(options.leaseTtlMs === undefined ? {} : { leaseTtlMs: options.leaseTtlMs }),
    ...(options.peak === undefined ? {} : { peak: options.peak }),
    ...(options.stop === undefined ? {} : { stop: options.stop }),
    ensureRestartExhaustion: ({ ref, runId, restarts, recordedAt }) => {
      calls.exhaustions = [...calls.exhaustions, { ref, restarts }];
      const ensured = ensureEconomicsExhaustionRecord(state.store, state.fenceToken, {
        schemaId: ECONOMICS_EXHAUSTION_SCHEMA_ID,
        workItemRef: ref,
        runId,
        reason: "dispatch.restart-budget-exceeded",
        restarts,
        historyRef: `economics/${ref}`,
        terminal: true,
        options: [...ECONOMICS_EXHAUSTION_OPTIONS],
        recordedAt,
      });
      return ensured.ok;
    },
    ...(options.gate === undefined
      ? {}
      : {
          gate: {
            scope: options.gate.scope ?? "production",
            principal: options.gate.principal ?? "coder@local",
            ...(options.gate.max === undefined ? {} : { max: options.gate.max }),
            resolveRepository: options.gate.resolveRepository ?? ((repo: string) => repo),
          },
        }),
    ...(options.lane === undefined
      ? {}
      : {
          existingLane: () => ({
            handle: {
              harnessKind: options.harnessKind ?? "opencode",
              sessionId: "session-existing",
              treeRoot: state.root,
              workItemRef: "GH-301",
            },
            completedPhases: options.lane?.completedPhases ?? [],
            adapterSupportsResumeInjection: options.lane?.adapterSupportsResumeInjection ?? false,
            restartCount: options.lane?.restartCount ?? 0,
            ...(options.lane?.prefillCost === undefined
              ? {}
              : { prefillCost: options.lane.prefillCost }),
            ...(options.lane?.uniqueProgress === undefined
              ? {}
              : { uniqueProgress: options.lane.uniqueProgress }),
          }),
        }),
    ...(options.initialRestarts === undefined
      ? {}
      : { resumeAmplification: `${options.initialRestarts}` }),
  });

  const definition = createDispatchCommandDefinition(runtime);

  const invoke = async (argv: readonly string[]): Promise<CommandRun> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    const exit = await runCli(argv, streams, {
      brand: BRAND,
      clock: FIXED_CLOCK,
      newRunId: () => "run-fixed",
      secrets: [...(options.secrets ?? [])],
      program: { commands: { dispatch: definition } },
    });
    const stdout = out.join("");
    return {
      exit,
      stdout,
      stderr: err.join(""),
      ...(argv.includes("--json") ? { envelope: parseEnvelope(stdout) } : {}),
    };
  };

  return {
    state,
    scripted,
    runtime,
    calls,
    invoke,
    dispose: () => state.dispose(),
  };
};

/** The exit a token projects, computed only through the delivered projection. */
type DispatchToken = DeliveryResultToken;

export const exitOf = (value: DispatchToken): number => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === value);
  if (row === undefined) throw new Error("token is not in the taxonomy");
  return projectExitCode(row.projectionClass);
};

/* ------------------------------------------------------------------------- */
/* GH-413 — the dispatch-owned peak-window fixture family                     */
/* ------------------------------------------------------------------------- */

export type PeakFixtureOptions = {
  readonly startMs: number;
  readonly rules?: Readonly<Record<string, ProviderProfilePeakRules>>;
  readonly killGraceMs?: number;
  readonly preservation?: QueueParkPreservation;
  readonly watchEnabled?: boolean;
  readonly recoverParks?: () =>
    | { readonly ok: true }
    | { readonly ok: false; readonly kind: "queue" | "state"; readonly code: string };
  readonly holdActive?: () => boolean;
  readonly resumeSucceeds?: () => boolean;
  readonly reenterSucceeds?: () => boolean;
  readonly restartCount?: number;
  readonly restartBound?: number;
  readonly prefillCost?: number | null;
  readonly uniqueProgress?: number | null;
};

export type PeakFixture = {
  readonly clock: {
    readonly nowMs: () => number;
    readonly iso: () => string;
    readonly advance: (ms: number) => void;
  };
  readonly peak: DispatchPeakWatchPorts;
  readonly parks: QueueParkRecord[];
  readonly stopCalls: { readonly handle?: unknown; readonly graceMs: number }[];
  readonly resumed: () => number;
  readonly reentered: () => readonly number[];
  readonly recoveryCalls: () => number;
  readonly escalated: () => readonly string[];
  readonly setOnStop: (hook: () => void) => void;
  readonly waitForCadence: (ms: number) => DispatchCadenceWait;
};

/** One deterministic dispatch-owned watch fixture over an injected clock. */
export const createPeakFixture = (options: PeakFixtureOptions): PeakFixture => {
  let nowMs = options.startMs;
  let episode = 0;
  let resumed = 0;
  let recoveryCalls = 0;
  const reenteredOrdinals: number[] = [];
  const escalatedCodes: string[] = [];
  const parks: QueueParkRecord[] = [];
  const stopCalls: { readonly handle?: unknown; readonly graceMs: number }[] = [];
  let onStop: (() => void) | undefined;
  const rules = options.rules ?? {};
  const clock = {
    nowMs: () => nowMs,
    iso: () => new Date(nowMs).toISOString(),
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
  const peak: DispatchPeakWatchPorts = {
    watchEnabled: options.watchEnabled ?? true,
    rulesFor: (profile) => rules[profile],
    parks: () => parks,
    recoverParks: () => {
      recoveryCalls += 1;
      return options.recoverParks?.() ?? { ok: true };
    },
    unexpiredStandingPark: (ref) => {
      if (
        options.standingParkVisibleAtMs !== undefined &&
        nowMs < options.standingParkVisibleAtMs
      ) {
        return undefined;
      }
      const latest = [...parks]
        .reverse()
        .find((park) => park.ref === ref && park.cause === "peak-window");
      if (latest === undefined) return undefined;
      if (latest.recoveryState !== "parked" && latest.recoveryState !== "clear-observed") {
        return undefined;
      }
      const untilMs = latest.until === undefined ? undefined : Date.parse(latest.until);
      if (untilMs !== undefined && Number.isFinite(untilMs) && untilMs > nowMs) {
        return {
          cause: latest.cause,
          ...(latest.until === undefined ? {} : { until: latest.until }),
        };
      }
      return undefined;
    },
    stop: async ({ handle, graceMs }) => {
      stopCalls.push({ ...(handle === undefined ? {} : { handle }), graceMs });
      onStop?.();
      return options.preservation ?? "preserved";
    },
    appendPark: (record) => {
      parks.push(record);
      return true;
    },
    appendRecovery: (record) => {
      parks.push(record);
      return true;
    },
    holdActive: () => options.holdActive?.() ?? false,
    newEpisodeId: (ref) => {
      episode += 1;
      return `episode-${ref}-${episode}`;
    },
    branch: () => "feat/GH-413/peak-pausing-dispatch-lane",
    resumeSession: async () => {
      if (options.resumeSucceeds !== undefined && !options.resumeSucceeds()) return false;
      resumed += 1;
      return true;
    },
    reenter: async ({ ordinal }) => {
      if (options.reenterSucceeds !== undefined && !options.reenterSucceeds()) return false;
      reenteredOrdinals.push(ordinal);
      return true;
    },
    restartCount: () => options.restartCount ?? 0,
    restartBound: () => options.restartBound ?? 3,
    economics: () => ({
      prefillCost: options.prefillCost ?? null,
      uniqueProgress: options.uniqueProgress ?? null,
    }),
    escalate: ({ code }) => {
      escalatedCodes.push(code);
    },
  };
  return {
    clock,
    peak,
    parks,
    stopCalls,
    resumed: () => resumed,
    reentered: () => reenteredOrdinals,
    recoveryCalls: () => recoveryCalls,
    escalated: () => escalatedCodes,
    setOnStop: (hook) => {
      onStop = hook;
    },
    waitForCadence: (ms) => {
      clock.advance(ms);
      return { promise: Promise.resolve(), cancel: () => {} };
    },
  };
};

export type PeakScenarioOptions = {
  readonly label: string;
  readonly startMs: number;
  readonly rules: Readonly<Record<string, ProviderProfilePeakRules | undefined>>;
  readonly nomination: string;
  readonly preservation?: QueueParkPreservation;
  readonly watchEnabled?: boolean;
  /** The instant from which a seeded standing park is visible at admission. */
  readonly standingParkVisibleAtMs?: number;
  readonly holdActive?: () => boolean;
  readonly restartCount?: number;
  readonly restartBound?: number;
  readonly prefillCost?: number | null;
  readonly uniqueProgress?: number | null;
  readonly recoverParks?: PeakFixtureOptions["recoverParks"];
  readonly collectAfterPolls?: number;
  readonly resumeSucceeds?: () => boolean;
  readonly reenterSucceeds?: () => boolean;
};

/** A command scenario with the GH-413 dispatch-owned watch composed. */
export const createPeakScenario = (options: PeakScenarioOptions) => {
  const peak = createPeakFixture({
    startMs: options.startMs,
    rules: options.rules as Readonly<Record<string, ProviderProfilePeakRules>>,
    ...(options.preservation === undefined ? {} : { preservation: options.preservation }),
    ...(options.watchEnabled === undefined ? {} : { watchEnabled: options.watchEnabled }),
    ...(options.standingParkVisibleAtMs === undefined
      ? {}
      : { standingParkVisibleAtMs: options.standingParkVisibleAtMs }),
    ...(options.holdActive === undefined ? {} : { holdActive: options.holdActive }),
    ...(options.restartCount === undefined ? {} : { restartCount: options.restartCount }),
    ...(options.restartBound === undefined ? {} : { restartBound: options.restartBound }),
    ...(options.prefillCost === undefined ? {} : { prefillCost: options.prefillCost }),
    ...(options.uniqueProgress === undefined ? {} : { uniqueProgress: options.uniqueProgress }),
    ...(options.recoverParks === undefined ? {} : { recoverParks: options.recoverParks }),
    ...(options.resumeSucceeds === undefined ? {} : { resumeSucceeds: options.resumeSucceeds }),
    ...(options.reenterSucceeds === undefined ? {} : { reenterSucceeds: options.reenterSucceeds }),
  });
  const scenario = createCommandScenario({
    label: options.label,
    evidence: COMPLETED_EVIDENCE,
    reads: readsFrom(),
    laneOwner: { processId: process.pid, startedAt: new Date(options.startMs).toISOString() },
    nowIso: peak.clock.iso,
    livenessIntervalMs: 30_000,
    leaseTtlMs: 90_000,
    collectAfterPolls: options.collectAfterPolls ?? 2,
    livenessOf: (poll) => ({
      readings: [
        { kind: "session-traffic", status: "sourced", value: poll, observedAt: peak.clock.iso() },
        { kind: "process", status: "sourced", value: poll, observedAt: peak.clock.iso() },
      ],
    }),
    nominate: () => ({ ok: true, profile: options.nomination }),
    peak: peak.peak,
    waitForCadence: peak.waitForCadence,
  });
  peak.setOnStop(() => scenario.scripted.finishCollect());
  return { peak, scenario };
};
