/**
 * Driver D1 — one composed PRODUCTION program per run (GH-347 test plan §5
 * driver D1, §6.2).
 *
 * It composes the real `createProductionComposer` over a temporary checkout and
 * its derived state root, injecting only the declared seams: the guarded
 * process runner, the scripted provider transport, the git runner, the
 * credential port, `processId`, the fixed clock, the id sequence, and the one
 * injected `delay(ms, reason)` fact. No network call, no real child process, no
 * wall-clock wait. The fixtures expose no attempt/lane/divergence writer: every
 * record is produced by the command path itself.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type GitChildRunner } from "../../../../packages/adapters/src/git/index";
import { type CliStreams, runCli } from "../../../../packages/cli/src/index";
import { createProductionComposer } from "../../../../packages/cli/src/production";
import {
  readDispatchAttempts,
  readDispatchDivergences,
  readDispatchLanes,
} from "../../../../packages/core/src/app/dispatch-ledger";
import { claimQueueLease, declareQueueEntry } from "../../../../packages/core/src/app/queue";
import { resolveBrandIdentity } from "../../../../packages/core/src/branding/index";
import type {
  BrandIdentity,
  CredentialPort,
  DispatchAttemptRecord,
  DispatchDelay,
  DispatchEnvelopeData,
  DispatchLaneRecord,
  StateFenceHandle,
  StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import {
  createNodeStateEdge,
  createStateStore,
  readEconomicsRecords,
  STATE_SCHEMA_VERSION,
} from "../../../../packages/core/src/state/index";
import { createDispatchClock, DISPATCH_NOW } from "../harness";
import { makeCheckout } from "../../queue/production/harness";
import { projectScopeFor } from "../../projects/state-scope";
import { createGuardedRunner, type GuardedInvocation, type GuardedRunner } from "./process-runner";

const ROOT = process.cwd();
const BASE = join(ROOT, "tmp", "tmpdir");
const GITHUB_ORIGIN = "https://github.com/owner/repo.git";
export const PARITY_REPOSITORY = "github.com/owner/repo";
export const PARITY_CANARY = "planted-gh347-parity-canary";

export type TransportResponse = { readonly status: number; readonly body: unknown };

export type ParityTransport = {
  readonly send: (request: {
    readonly url: string;
    readonly method: string;
  }) => Promise<TransportResponse>;
};

export type ParityEnvelope = {
  readonly exitCode: number;
  readonly data?: DispatchEnvelopeData;
  /** The record-shaped envelope-root detail (the single-flight holder). */
  readonly detail?: { readonly holder?: string };
  readonly error?: {
    readonly code: string;
    readonly category: string;
    readonly retryable: boolean;
    readonly consequence: string;
    readonly remediationHint: string;
    readonly summary?: string;
    readonly detail?: { readonly kind: string; readonly code: string; readonly field?: string };
    readonly holder?: string;
  };
};

export type ParityWait = { readonly ms: number; readonly reason: string };

export type ParityRunResult = {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: ParityEnvelope;
};

export type ParityObservation = {
  readonly exit: number;
  readonly token: string | undefined;
  readonly results: readonly ParityRunResult[];
  readonly attempts: readonly DispatchAttemptRecord[];
  readonly lanes: readonly DispatchLaneRecord[];
  readonly divergences: number;
  readonly economicsRestarts: number;
  readonly leaseRecords: number;
  /** Lease records that acquired the repository (acquired/taken-over). */
  readonly leaseAcquisitions: number;
  readonly spawns: number;
  readonly resumes: number;
  readonly waits: readonly ParityWait[];
  readonly violations: readonly string[];
  readonly invocations: readonly GuardedInvocation[];
  readonly envelopes: readonly ParityEnvelope[];
};

export type ParityHarnessOptions = {
  readonly label?: string;
  readonly ref?: string;
  /** Additional refs to declare in the queue ledger (same repository). */
  readonly extraRefs?: readonly string[];
  /** The injected delay fact; the default records and advances the virtual clock. */
  readonly delay?: DispatchDelay;
  /** A shared guarded runner (the artifact-observing cases read its records). */
  readonly guarded?: GuardedRunner;
  readonly transport?: ParityTransport;
  readonly processId?: number;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly secrets?: readonly string[];
  readonly originUrl?: string;
  /** Observes every landed store append (the interleaving latch wires its release). */
  readonly onAppend?: (record: { readonly kind: string }) => void;
};

export type ParityHarness = {
  readonly brand: BrandIdentity;
  readonly home: string;
  readonly checkout: string;
  readonly store: StateStorePort;
  readonly clock: ReturnType<typeof createDispatchClock>;
  readonly guarded: GuardedRunner;
  readonly waits: readonly ParityWait[];
  readonly run: (argv?: readonly string[]) => Promise<ParityRunResult>;
  readonly observe: () => ParityObservation;
  readonly seedLease: (input: {
    readonly ref: string;
    readonly holder: string;
    readonly ageMs?: number;
  }) => void;
  readonly holdFence: () => StateFenceHandle;
  readonly releaseFence: (handle: StateFenceHandle) => void;
  readonly dispose: () => void;
};

const resolveBrand = (): BrandIdentity => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
};

/** The default transport: one readable issue per id, no pull requests. */
export const readableParityTransport = (requests?: string[]): ParityTransport => ({
  send: async (request) => {
    requests?.push(request.url);
    const issue = /\/issues\/(\d+)(?:[?/]|$)/u.exec(request.url);
    if (issue !== null) {
      const number = Number(issue[1]);
      return {
        status: 200,
        body: { number, title: `Change ${number}`, state: "open", labels: [], body: "" },
      };
    }
    if (request.url.includes("/pulls?")) return { status: 200, body: [] };
    if (request.url.includes("/issues?")) return { status: 200, body: [] };
    if (request.url.includes("/check-runs")) {
      return { status: 200, body: { total_count: 0, check_runs: [] } };
    }
    return { status: 200, body: { items: [] } };
  },
});

export const createParityHarness = (options: ParityHarnessOptions = {}): ParityHarness => {
  const brand = resolveBrand();
  mkdirSync(BASE, { recursive: true });
  const home = mkdtempSync(join(BASE, `${options.label ?? "gh347-parity"}-`));
  const checkoutRoot = makeCheckout(home, "checkout", options.originUrl ?? GITHUB_ORIGIN);
  const checkout = checkoutRoot.directory;
  const stateDirectory = projectScopeFor({
    cwd: checkout,
    hostRoot: join(home, brand.stateDirectoryName),
    home,
    brand,
  }).scope.stateLocation;

  const openStore = (): StateStorePort =>
    createStateStore(
      {
        level: "local",
        workspaceId: "default",
        fenceNamespace: "cli",
        schemaVersion: STATE_SCHEMA_VERSION,
        stateDirectory,
      },
      { driver: "jsonl", edge: createNodeStateEdge() },
    );

  const rawStore = openStore();
  const store: StateStorePort = rawStore;

  const clock = createDispatchClock(DISPATCH_NOW);
  const waits: ParityWait[] = [];
  const delayed: DispatchDelay = async (ms, reason) => {
    waits.push({ reason, ms });
    clock.advanceMs(ms);
  };
  const injected = options.delay;
  const delay: DispatchDelay = async (ms, reason) => {
    if (injected === undefined) return delayed(ms, reason);
    waits.push({ reason, ms });
    clock.advanceMs(ms);
    return injected(ms, reason);
  };

  const ref = options.ref ?? "GH-347";
  const seededAt = clock.nowIso();
  for (const seededRef of [ref, ...(options.extraRefs ?? [])]) {
    const seeded = declareQueueEntry(rawStore, {
      ref: seededRef,
      repository: PARITY_REPOSITORY,
      repositoryRoot: ROOT,
      recordedAt: seededAt,
      fenceToken: `seed-${seededRef}`,
    });
    if (!seeded.ok) throw new Error(`queue seeding failed: ${JSON.stringify(seeded)}`);
  }

  const guarded = options.guarded ?? createGuardedRunner();
  const transport = options.transport ?? readableParityTransport();
  const credentialPort: CredentialPort = {
    resolve: () => ({ ok: true, material: { value: PARITY_CANARY } }),
  };

  const runs: ParityRunResult[] = [];
  let runIndex = 0;

  const program = createProductionComposer({
    harnessVersionProbe: async () => ({ status: "answered" as const, stdout: "opencode v2.3.2" }),
    environment: {
      HOME: home,
      PATH: "/synthetic/bin:/synthetic/usr/bin",
      HARNESS_MODEL: "synthetic/model-large",
      HARNESS_SMALL_MODEL: "synthetic/model-small",
      ...(options.environment ?? {}),
    },
    cwd: checkout,
    homeDirectory: home,
    workingName: "delivery-os",
    repositoryFacts: { originUrl: options.originUrl ?? GITHUB_ORIGIN },
    harnessSpawnRunner: guarded.runner,
    harnessSpawnStarter: guarded.starter,
    credentials: credentialPort,
    githubTransport: transport,
    gitChildRunner: guarded.gitRunner as GitChildRunner,
    processId: options.processId ?? 4242,
    dispatchDelay: delay,
    clock: { nowMs: clock.nowMs, nowIso: clock.nowIso },
    ...(options.onAppend === undefined
      ? {}
      : {
          stateStoreWrap: (opened: StateStorePort): StateStorePort => ({
            ...opened,
            append: (handle, request) => {
              const outcome = opened.append(handle, request);
              if (outcome.ok) options.onAppend?.({ kind: request.kind });
              return outcome;
            },
          }),
        }),
  })(brand);

  const run = async (argv?: readonly string[]): Promise<ParityRunResult> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    runIndex += 1;
    const exit = await runCli(argv ?? ["dispatch", ref, "--json"], streams, {
      brand,
      clock: { now: () => clock.nowMs() },
      newRunId: () => `run-parity-${runIndex}`,
      secrets: [...(options.secrets ?? [])],
      program,
    });
    const stdout = out.join("");
    const stderr = err.join("");
    const envelope = stdout.trim().startsWith("{")
      ? (JSON.parse(stdout) as ParityEnvelope)
      : undefined;
    const result: ParityRunResult = {
      exit,
      stdout,
      stderr,
      ...(envelope === undefined ? {} : { envelope }),
    };
    runs.push(result);
    return result;
  };

  const secondHandle = (): StateStorePort => openStore();
  const externalStores: StateStorePort[] = [];

  const observe = (): ParityObservation => {
    const attempts = readDispatchAttempts(rawStore);
    if (!attempts.ok) throw new Error("attempt read failed");
    const lanes = readDispatchLanes(rawStore);
    if (!lanes.ok) throw new Error("lane read failed");
    const divergences = readDispatchDivergences(rawStore);
    if (!divergences.ok) throw new Error("divergence read failed");
    const economics = readEconomicsRecords(rawStore, ref);
    const records = rawStore.readRecords();
    if (!records.ok) throw new Error("store read failed");
    const last = runs[runs.length - 1];
    return {
      exit: last?.exit ?? 0,
      token: last?.envelope?.data?.result,
      results: [...runs],
      attempts: attempts.records,
      lanes: lanes.records,
      divergences: divergences.records.length,
      economicsRestarts: economics.ok ? economics.restarts.length : -1,
      leaseRecords: records.value.records.filter((record) => record.kind === "queue.lease").length,
      leaseAcquisitions: records.value.records.filter(
        (record) =>
          record.kind === "queue.lease" &&
          typeof record.payload === "object" &&
          record.payload !== null &&
          ((record.payload as { readonly operation?: unknown }).operation === "acquired" ||
            (record.payload as { readonly operation?: unknown }).operation === "taken-over"),
      ).length,
      spawns: guarded.spawns,
      resumes: guarded.resumes,
      waits: [...waits],
      violations: [...guarded.violations],
      invocations: [...guarded.records],
      envelopes: runs.flatMap((entry) =>
        entry.envelope === undefined ? [] : [entry.envelope],
      ),
    };
  };

  const seedLease = (input: {
    readonly ref: string;
    readonly holder: string;
    readonly ageMs?: number;
  }): void => {
    const at = clock.nowMs() - (input.ageMs ?? 0);
    const claimed = claimQueueLease(rawStore, {
      ref: input.ref,
      holder: input.holder,
      runner: `runner-${input.holder}`,
      weightClass: "standard",
      nowIso: new Date(at).toISOString(),
      nowMs: at,
      fenceToken: `seed-lease-${input.holder}-${input.ref}`,
    });
    if (!claimed.ok) throw new Error(`lease seed failed: ${JSON.stringify(claimed)}`);
  };

  const releaseFence = (handle: StateFenceHandle): void => {
    for (const candidate of externalStores) {
      const released = candidate.releaseFence(handle);
      if (released.ok) return;
    }
    throw new Error("external fence handle is not owned by an external store handle");
  };

  return {
    brand,
    home,
    checkout,
    store,
    clock,
    guarded,
    get waits() {
      return waits;
    },
    run,
    observe,
    seedLease,
    holdFence: () => {
      const handleStore = secondHandle();
      const acquired = handleStore.acquireFence(`external-fence-${externalStores.length + 1}`);
      if (!acquired.ok) throw new Error(`external fence acquisition failed: ${acquired.error.code}`);
      externalStores.push(handleStore);
      return acquired.value.handle;
    },
    releaseFence,
    dispose: () => rmSync(home, { recursive: true, force: true }),
  };
};
