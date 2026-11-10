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
  DispatchLeaseClaim,
  DispatchPreflightPort,
  DispatchTruthReads,
} from "../../../../packages/core/src/app/dispatch";
import { resolveBrandIdentity } from "../../../../packages/core/src/branding/index";
import {
  DELIVERY_RESULT_TAXONOMY,
  type DeliveryResultToken,
  type DispatchEnvelopeData,
  type DispatchEvidenceClass,
  ECONOMICS_EXHAUSTION_OPTIONS,
  ECONOMICS_EXHAUSTION_SCHEMA_ID,
  type HarnessEvidence,
  type HarnessLivenessReport,
  type HarnessSessionPort,
  type StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import { ensureEconomicsExhaustionRecord } from "../../../../packages/core/src/state/index";
import { createDispatchState, createScriptedHarness } from "../harness";
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
    };
  };
};

export type CommandScenarioOptions = {
  readonly label?: string;
  readonly evidence?: HarnessEvidence;
  readonly spawnFails?: boolean;
  readonly collectFails?: boolean;
  readonly claim?: DispatchLeaseClaim;
  readonly reads?: DispatchTruthReads;
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
  readonly newAttemptId?: (ref: string) => string;
  readonly newDivergenceId?: (ref: string) => string;
  /** The optional admission preflight; omitting it keeps the delivered order. */
  readonly preflight?: DispatchPreflightPort;
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
    descriptor: { kind: "host", workDirectory: state.root, environment: [] },
    prompt: (ref) => `deliver ${ref}`,
    ...(options.evidenceClass === undefined ? {} : { evidenceClass: options.evidenceClass }),
    repository: () => options.repository ?? "github.com/owner/repo",
    readTruth: async () => options.reads ?? readsFrom(),
    ...(options.preflight === undefined ? {} : { preflight: options.preflight }),
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
          waitForCadence: () => ({ promise: Promise.resolve(), cancel: () => {} }),
        }),
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
      secrets: [],
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
