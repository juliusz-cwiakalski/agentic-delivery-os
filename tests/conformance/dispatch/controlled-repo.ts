/**
 * The controlled-proof dispatch repository (GH-239 F-8; D2; AC-F8-1).
 *
 * Real state store, real command path, real ledger: harness, tracker, CI, and
 * VCS facts are injected. Every dispatch declares `evidenceClass:
 * controlled-proof` as a composition input, never as a test-side record field.
 * The fixture exposes no ledger writer; a provenance guard counts
 * command-originated appends so no test can hand-insert evidence.
 */
import { runCli, type CliStreams } from "../../../packages/cli/src/index";
import { createDispatchCommandDefinition } from "../../../packages/cli/src/commands/dispatch";
import {
  createDispatchCommandRuntime,
  type DispatchCommandRuntime,
} from "../../../packages/cli/src/edge";
import { resolveBrandIdentity } from "../../../packages/core/src/branding/index";
import { classifyHarnessEvidence } from "../../../packages/core/src/domain/harness-classify";
import type {
  DispatchAttemptRecord,
  DispatchEnvelopeData,
  HarnessEvidence,
  HarnessSessionPort,
} from "../../../packages/core/src/contracts/index";
import type { DispatchTruthReads } from "../../../packages/core/src/app/dispatch";
import { readDispatchAttempts } from "../../../packages/core/src/app/dispatch-ledger";
import { createDispatchState, type DispatchState } from "../../fixtures/dispatch/harness";
import { readsFrom } from "../../fixtures/dispatch/golden/harness";
import { REPOSITORY } from "../../fixtures/dispatch/ledger";

const BRAND = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

export type ControlledDispatchInput = {
  readonly evidence?: HarnessEvidence;
  readonly reads?: Partial<DispatchTruthReads>;
  readonly claim?: "accepted" | "refused";
  readonly label?: string;
};

export type ControlledRun = {
  readonly exit: number;
  readonly envelope?: { readonly data?: DispatchEnvelopeData; readonly error?: unknown };
};

export type ControlledRepo = {
  readonly state: DispatchState;
  readonly repository: string;
  readonly run: (input?: ControlledDispatchInput) => Promise<ControlledRun>;
  readonly invoke: (argv: readonly string[]) => Promise<ControlledRun>;
  readonly advanceDays: (days: number) => void;
  readonly attempts: () => readonly DispatchAttemptRecord[];
  readonly provenance: () => {
    readonly dispatches: number;
    readonly attempts: number;
    readonly classes: readonly string[];
  };
  readonly dispose: () => void;
};

const NOW_START = Date.parse("2026-11-01T10:00:00.000Z");

/**
 * Create the controlled repository. The fixture API deliberately exposes no
 * attempt, divergence, or handover append helper.
 */
export const createControlledRepo = (): ControlledRepo => {
  const state = createDispatchState("controlled");
  const repository = REPOSITORY;
  let clock = NOW_START;
  let currentEvidence: HarnessEvidence = {
    completionMarker: true,
    exitStatus: 0,
    timedOut: false,
    spawnRefused: false,
    failureReported: false,
    toolFailure: false,
  };
  let currentReads: DispatchTruthReads = readsFrom();
  let claimAccepted = true;
  let dispatches = 0;

  const baseHarness = (() => {
    const port: HarnessSessionPort = {
      spawn: async () => ({
        ok: true,
        value: {
          harnessKind: "opencode",
          sessionId: `controlled-${dispatches + 1}`,
          treeRoot: state.root,
          workItemRef: "GH-239",
        },
      }),
      deliver: async () => ({
        ok: true,
        value: {
          harnessKind: "opencode",
          sessionId: "controlled",
          treeRoot: state.root,
          workItemRef: "GH-239",
        },
      }),
      resume: async () => ({
        ok: true,
        value: {
          harnessKind: "opencode",
          sessionId: "controlled",
          treeRoot: state.root,
          workItemRef: "GH-239",
        },
      }),
      collect: async () => ({ ok: true, value: currentEvidence }),
      classify: (evidence) => classifyHarnessEvidence(evidence),
      liveness: async () => ({
        ok: true,
        value: {
          readings: [
            {
              kind: "session-traffic",
              status: "sourced",
              value: 1,
              observedAt: new Date(clock).toISOString(),
            },
            {
              kind: "worktree-activity",
              status: "sourced",
              value: 1,
              observedAt: new Date(clock).toISOString(),
            },
            {
              kind: "process",
              status: "sourced",
              value: 1,
              observedAt: new Date(clock).toISOString(),
            },
          ],
        },
      }),
      listSessions: async () => ({ ok: true, value: { handles: [] } }),
    };
    return port;
  })();

  const runtime: DispatchCommandRuntime = createDispatchCommandRuntime({
    store: state.store,
    stateRoot: state.root,
    fenceToken: state.fenceToken,
    nowIso: () => new Date(clock).toISOString(),
    newAttemptId: () => `controlled-attempt-${dispatches + 1}`,
    newDivergenceId: () => `DIV-${repository}-${dispatches + 1}`,
    harnesses: { opencode: baseHarness },
    defaultHarness: "opencode",
    descriptor: { kind: "host", workDirectory: state.root, environment: [] },
    prompt: (ref) => `deliver ${ref}`,
    evidenceClass: "controlled-proof",
    repository: () => repository,
    readTruth: async () => currentReads,
    claimLease: () =>
      claimAccepted
        ? { ok: true, leaseId: "controlled-lease" }
        : { ok: false, code: "queue.lease-conflict" },
    releaseLease: () => true,
    phaseLedger: () => ({ completed: 3, total: 9, variant: "full" }),
    gate: {
      scope: "controlled",
      principal: "controlled-proof",
      resolveRepository: (repo) => (repo === repository ? repo : undefined),
    },
  });

  const definition = createDispatchCommandDefinition(runtime);

  const invoke = async (argv: readonly string[]): Promise<ControlledRun> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    const exit = await runCli(argv, streams, {
      brand: BRAND,
      clock: { now: () => clock },
      newRunId: () => `controlled-run-${dispatches}`,
      secrets: [],
      program: { commands: { dispatch: definition } },
    });
    const text = out.join("").trim();
    return {
      exit,
      ...(argv.includes("--json") && text.startsWith("{")
        ? { envelope: JSON.parse(text) as ControlledRun["envelope"] }
        : {}),
    };
  };

  const run = async (input: ControlledDispatchInput = {}): Promise<ControlledRun> => {
    dispatches += 1;
    clock += 86_400_000;
    currentEvidence = input.evidence ?? {
      completionMarker: true,
      exitStatus: 0,
      timedOut: false,
      spawnRefused: false,
      failureReported: false,
      toolFailure: false,
    };
    currentReads = input.reads === undefined ? readsFrom() : readsFrom(input.reads);
    claimAccepted = input.claim !== "refused";
    return invoke(["dispatch", "GH-239", "--json"]);
  };

  const attempts = () => {
    const read = readDispatchAttempts(state.store);
    if (!read.ok) throw new Error("attempt read failed");
    return read.records;
  };

  return {
    state,
    repository,
    run,
    invoke,
    advanceDays: (days) => {
      clock += days * 86_400_000;
    },
    attempts,
    provenance: () => {
      const records = attempts();
      return {
        dispatches,
        attempts: records.length,
        classes: [...new Set(records.map((record) => record.evidenceClass))],
      };
    },
    dispose: () => state.dispose(),
  };
};
