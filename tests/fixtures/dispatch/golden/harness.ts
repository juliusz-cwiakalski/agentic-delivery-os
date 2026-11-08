/**
 * Shared command-level dispatch harness (GH-239 §6.2): an isolated state root,
 * a scripted harness session port, injected truth reads, a recording lease and
 * merge seam, and `runCli` invocation over the delivered command definition.
 *
 * The real shared classifier, the real derivation, and the real ledger are
 * used; only external I/O is scripted.
 */
import { resolveBrandIdentity } from "../../../../packages/core/src/branding/index";
import { runCli, type CliStreams } from "../../../../packages/cli/src/index";
import { createDispatchCommandDefinition } from "../../../../packages/cli/src/commands/dispatch";
import {
  createDispatchCommandRuntime,
  type DispatchCommandRuntime,
} from "../../../../packages/cli/src/edge";
import { projectExitCode } from "../../../../packages/cli/src/projection";
import {
  DELIVERY_RESULT_TAXONOMY,
  type DeliveryResultToken,
  type DispatchEnvelopeData,
  type DispatchEvidenceClass,
  type HarnessEvidence,
} from "../../../../packages/core/src/contracts/index";
import { createDispatchState, createScriptedHarness } from "../harness";
import type { DispatchTruthReads } from "../../../../packages/core/src/app/dispatch";
import type { DispatchLeaseClaim } from "../../../../packages/core/src/app/dispatch";
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
  readonly claim?: DispatchLeaseClaim;
  readonly reads?: DispatchTruthReads;
  readonly evidenceClass?: DispatchEvidenceClass;
  readonly repository?: string;
  readonly handover?: "dual-run" | "authoritative";
  readonly restartBudget?: number;
  readonly initialRestarts?: number;
  readonly harnessKind?: "opencode" | "claude-code";
  readonly newAttemptId?: (ref: string) => string;
  readonly newDivergenceId?: (ref: string) => string;
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

export const readsFrom = (
  overrides: Partial<DispatchTruthReads> = {},
): DispatchTruthReads => {
  const base = defaultTruthInput();
  return {
    artifacts: base.artifacts,
    ledger: base.ledger,
    tracker: base.tracker,
    ci: { ok: true, value: { verdict: "success" } },
    verifyOutcome: null,
    phasesComplete: true,
    ...overrides,
  };
};

let attemptSequence = 0;
let divergenceSequence = 0;

export const createCommandScenario = (options: CommandScenarioOptions = {}): CommandScenario => {
  const state = createDispatchState(options.label ?? "command");
  const scripted = createScriptedHarness(
    options.evidence === undefined && options.spawnFails === undefined
      ? { harnessKind: options.harnessKind ?? "opencode" }
      : {
          ...(options.evidence === undefined ? {} : { evidence: options.evidence }),
          ...(options.spawnFails === undefined ? {} : { spawnFails: options.spawnFails }),
          ...(options.harnessKind === undefined ? {} : { harnessKind: options.harnessKind }),
        },
  );
  const calls = {
    spawn: 0,
    resume: 0,
    merge: 0,
    claims: [] as string[],
    releases: [] as string[],
  };

  const runtime = createDispatchCommandRuntime({
    store: state.store,
    stateRoot: state.root,
    fenceToken: state.fenceToken,
    nowIso: () => "2026-11-08T10:00:00.000Z",
    newAttemptId: () => {
      attemptSequence += 1;
      return `attempt-${attemptSequence}`;
    },
    newDivergenceId: () => {
      divergenceSequence += 1;
      return `DIV-${divergenceSequence}`;
    },
    harnesses: {
      [options.harnessKind ?? "opencode"]: scripted.port,
      opencode: options.harnessKind === undefined ? scripted.port : undefined,
      "claude-code": options.harnessKind === undefined ? scripted.port : undefined,
    },
    defaultHarness: options.harnessKind ?? "opencode",
    descriptor: { kind: "host", workDirectory: state.root, environment: [] },
    prompt: (ref) => `deliver ${ref}`,
    ...(options.evidenceClass === undefined ? {} : { evidenceClass: options.evidenceClass }),
    repository: () => options.repository ?? "github.com/owner/repo",
    readTruth: async () => options.reads ?? readsFrom(),
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
