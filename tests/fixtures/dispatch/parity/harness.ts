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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  GitChildRunner,
  GitPushRunnerResult,
} from "../../../../packages/adapters/src/git/index";
import { type EntrypointComposer, runEntrypoint } from "../../../../packages/cli/src/entrypoint";
import { type CliStreams, runCli } from "../../../../packages/cli/src/index";
import {
  createProductionComposer,
  type ProductionCompositionFacts,
} from "../../../../packages/cli/src/production";
import type { DispatchTranscriptRead } from "../../../../packages/core/src/app/dispatch-last-message";
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
  CredentialReference,
  DispatchAttemptRecord,
  DispatchDelay,
  DispatchEnvelopeData,
  DispatchLaneRecord,
  DispatchLogFileSystem,
  DispatchOwnerProbe,
  HarnessKind,
  StateFenceHandle,
  StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import {
  appendEconomicsRestartEvent,
  createNodeStateEdge,
  createStateStore,
  readEconomicsRecords,
  STATE_SCHEMA_VERSION,
} from "../../../../packages/core/src/state/index";
import { projectScopeFor } from "../../projects/state-scope";
import { makeCheckout } from "../../queue/production/harness";
import { createDispatchClock, DISPATCH_NOW } from "../harness";
import { createGuardedRunner } from "./process-runner";

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

/* ------------------------------------------------------------------------- */
/* The on-disk pm-notes fixture (GH-347 DM-3): a real document the production  */
/* reader locates in the checkout's change folder.                            */
/* ------------------------------------------------------------------------- */

const PM_NOTES_MONTH = "2026-11";
const PM_NOTES_FOLDER = "2026-11-19--GH-347--parity-fixture";

const pmNotesDocument = (deliveryCompleted: string | null, branch?: string): string =>
  `change_id: GH-347
title: "Parity fixture document"
delivery_mode: autonomous
${branch === undefined ? "" : `branch: "${branch}"\n`}phases:
  clarify_scope: { started: null, completed: "2026-11-19T00:00:00.000Z" }
  specification: { started: null, completed: "2026-11-19T00:00:00.000Z" }
  test_planning: { started: null, completed: "2026-11-19T00:00:00.000Z" }
  delivery_planning: { started: null, completed: "2026-11-19T00:00:00.000Z" }
  dor_check: { started: null, completed: "2026-11-19T00:00:00.000Z" }
  delivery: { started: null, completed: ${deliveryCompleted === null ? "null" : `"${deliveryCompleted}"`} }
open_questions: []
blockers: []
notes: []
`;

export const COMPLETE_PM_NOTES = pmNotesDocument("2026-11-19T12:00:00.000Z");
export const INCOMPLETE_PM_NOTES = pmNotesDocument(null);
export const MALFORMED_PM_NOTES = "change_id: [unterminated\nphases: {";

export type PmNotesFixtureKind = "complete" | "incomplete" | "absent" | "malformed";

/** Write one fixture document into the checkout and return its path (or none). */
export const writePmNotesFixture = (
  checkout: string,
  kind: PmNotesFixtureKind,
  ref = "GH-347",
  branch?: string,
): string | undefined => {
  if (kind === "absent") return undefined;
  const folder = join(checkout, "doc", "changes", PM_NOTES_MONTH, PM_NOTES_FOLDER);
  mkdirSync(folder, { recursive: true });
  const file = join(folder, `chg-${ref}-pm-notes.yaml`);
  writeFileSync(
    file,
    kind === "complete"
      ? branch === undefined
        ? COMPLETE_PM_NOTES
        : pmNotesDocument("2026-11-19T12:00:00.000Z", branch)
      : kind === "incomplete"
        ? branch === undefined
          ? INCOMPLETE_PM_NOTES
          : pmNotesDocument(null, branch)
        : MALFORMED_PM_NOTES,
  );
  return file;
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
  /**
   * The RESOLVED base branch the lifecycle prompt interpolates (GH-347
   * AC-F7-3, DM-6). The default is the delivered integration base, so a case
   * that omits it proves the resolved default; a non-default value proves the
   * prompt follows the resolution.
   */
  readonly baseBranch?: string;
  /** Observes every landed store append (the interleaving latch wires its release). */
  readonly onAppend?: (record: { readonly kind: string }) => void;
  /** The on-disk pm-notes fixture; defaults to a complete document. */
  readonly pmNotes?: PmNotesFixtureKind;
  /** The optional opaque `branch:` declaration the fixture document carries. */
  readonly pmNotesBranch?: string;
  /**
   * The advisory owner-liveness probe (GH-354 API-10). Absent keeps the
   * delivered dispatch family's behaviour; the operator queries refuse when the
   * composition supplies no probe.
   */
  readonly ownerProbe?: DispatchOwnerProbe;
  /** The artifact-family root (GH-354 DM-2); absent uses the state directory. */
  readonly artifactRoot?: string;
  /** The artifact-family filesystem edge (GH-354 DM-2). */
  readonly artifactFs?: DispatchLogFileSystem;
  /** The injected transcript read (GH-354 API-9). */
  readonly transcriptRead?: DispatchTranscriptRead;
  /** The adapter capability the transcript read is gated by (GH-354 DM-3). */
  readonly supportsIntrospection?: (kind: HarnessKind) => boolean;
  /**
   * The declared credential references the production entrypoint resolves
   * against the injected environment (GH-354 AC-F4-7). Present routes each run
   * through `runEntrypoint`, so the composed program receives the registered
   * set as an invocation fact — the same values the serializer redacts with.
   * Absent keeps the direct `runCli` path.
   */
  readonly credentialReferences?: readonly CredentialReference[];
  /**
   * An observability seam over the main state store (GH-354 §7.2). The composed
   * program keeps using the returned port, so a case can count reads without
   * changing the state location. Absent leaves the store exactly as opened.
   */
  readonly storeWrap?: (store: StateStorePort) => StateStorePort;
  /**
   * The full-hex local head the default git script declares (GH-386 DM-1): the
   * local parity fact. Absent keeps the delivered fixture head literal, which
   * every scripted open pull also carries — so every delivered pr-open scenario
   * resolves equal heads mechanically and the ensure-push act never fires.
   */
  readonly localHead?: string;
  /**
   * The scripted push outcome for the default guarded runner (GH-386 F-1). The
   * declared classes: fast-forward-accepted, non-fast-forward-rejected,
   * protected-branch-rejected, credential-rejected, timed-out, spawn-failed.
   * Absent keeps the loud unexpected-push refusal.
   */
  readonly push?: (invocation: GuardedInvocation) => GitPushRunnerResult;
  /**
   * The open-request head fact per `/pulls?state=open` read, in call order (the
   * last entry repeats): a full-hex SHA, or `unreadable` for a failing read.
   * Call 1 is the truth read; call 2 is the parity read; call 3 is the re-read
   * after an accepted push. Absent passes the transport through untouched.
   */
  readonly pullHeadCalls?: readonly (string | "unreadable")[];
  /**
   * The injected ensure-push act budget (GH-386 NFR-1): a small test value
   * proving the seam timeout is injectable with no new configuration key. The
   * delivered default is the seam's 60 000 ms.
   */
  readonly pushTimeoutMs?: number;
};

export type ParityHarness = {
  readonly brand: BrandIdentity;
  readonly home: string;
  readonly checkout: string;
  /** The resolved state location the composition writes beside the ledger. */
  readonly stateDirectory: string;
  readonly store: StateStorePort;
  readonly clock: ReturnType<typeof createDispatchClock>;
  readonly guarded: GuardedRunner;
  readonly waits: readonly ParityWait[];
  readonly run: (argv?: readonly string[]) => Promise<ParityRunResult>;
  readonly observe: () => ParityObservation;
  /** Seed N persisted economics.restart records (the operator-resume bound). */
  readonly seedRestarts: (count: number) => void;
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

/**
 * The scripted transport: one readable issue per id, no pull requests by
 * default. `trackerFailures` fails that many issue reads with a provider fault
 * before answering, so the tracker ladder's attempt count and waits are
 * observable independently of the token.
 */
export const readableParityTransport = (
  options: {
    readonly requests?: string[];
    readonly trackerFailures?: number;
    readonly openPulls?: readonly unknown[];
    readonly mergedPulls?: readonly unknown[];
  } = {},
): ParityTransport => {
  let issueReads = 0;
  const failures = options.trackerFailures ?? 0;
  return {
    send: async (request) => {
      options.requests?.push(request.url);
      const issue = /\/issues\/(\d+)(?:[?/]|$)/u.exec(request.url);
      if (issue !== null) {
        issueReads += 1;
        // The FIRST issue read is the admission preflight (one bounded read);
        // the ladder's reads follow it, so the outage starts at read 2.
        if (issueReads > 1 && issueReads <= failures + 1) {
          return { status: 500, body: { message: "synthetic tracker outage" } };
        }
        const number = Number(issue[1]);
        return {
          status: 200,
          body: { number, title: `Change ${number}`, state: "open", labels: [], body: "" },
        };
      }
      if (request.url.includes("/pulls?state=open")) {
        return { status: 200, body: options.openPulls ?? [] };
      }
      if (request.url.includes("/pulls?state=closed")) {
        return { status: 200, body: options.mergedPulls ?? [] };
      }
      if (request.url.includes("/pulls?")) return { status: 200, body: [] };
      if (request.url.includes("/issues?")) return { status: 200, body: [] };
      if (request.url.includes("/check-runs")) {
        return { status: 200, body: { total_count: 0, check_runs: [] } };
      }
      return { status: 200, body: { items: [] } };
    },
  };
};

export const createParityHarness = (options: ParityHarnessOptions = {}): ParityHarness => {
  const brand = resolveBrand();
  mkdirSync(BASE, { recursive: true });
  const home = mkdtempSync(join(BASE, `${options.label ?? "gh347-parity"}-`));
  const checkoutRoot = makeCheckout(home, "checkout", options.originUrl ?? GITHUB_ORIGIN);
  const checkout = checkoutRoot.directory;
  // The parity profile declares the `pm` seat with an EXPRESSIBLE model
  // (`provider/model`), so the production agent supply resolves the one seat.
  mkdirSync(join(checkout, brand.configDirectoryName), { recursive: true });
  writeFileSync(
    join(checkout, brand.configDirectoryName, "config.yaml"),
    `provider:
  defaultChain: default
  credentials:
    provider-a:
      sourceKey:
        style: literal
        name: PROVIDER_A_KEY
  entries:
    provider-a:
      class: subscription
  chains:
    default:
      entries:
        - provider-a
      allowPaidFallback: false
  profiles:
    tiers:
      build: {}
    profiles:
      base:
        tier: build
        providers:
          - provider-a
        seats:
          pm:
            model: provider-a/model-large
            pacingClass: judgment
            capability: text-only
    preferenceChain:
      base: base
      fallbacks: []
lane:
  disable-worktrees: true
`,
  );
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
  writePmNotesFixture(checkout, options.pmNotes ?? "complete", ref, options.pmNotesBranch);
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

  const guarded =
    options.guarded ??
    createGuardedRunner({
      ...(options.localHead === undefined ? {} : { head: options.localHead }),
      ...(options.push === undefined ? {} : { push: options.push }),
    });
  const baseTransport = options.transport ?? readableParityTransport();
  // The open-request head-fact wrap (GH-386 DM-1): call 1 is the truth read,
  // call 2 the parity read, call 3 the post-push re-read; the last entry
  // repeats. A `unreadable` fact fails that read, never an earlier one.
  const sequence = options.pullHeadCalls;
  let openPullCalls = 0;
  const transport: ParityTransport =
    sequence === undefined
      ? baseTransport
      : {
          send: async (request) => {
            if (!request.url.includes("/pulls?state=open")) return baseTransport.send(request);
            const call = openPullCalls;
            openPullCalls += 1;
            const fact = call < sequence.length ? sequence[call] : sequence.at(-1);
            if (fact === "unreadable") {
              return { status: 500, body: { message: "synthetic parity-read outage" } };
            }
            const response = await baseTransport.send(request);
            if (!Array.isArray(response.body)) return response;
            const body = response.body.map((item) => {
              const entry = item as Record<string, unknown>;
              const head = entry.head as Record<string, unknown> | undefined;
              return { ...entry, head: { ...(head ?? {}), sha: fact } };
            });
            return { status: response.status, body };
          },
        };
  const credentialPort: CredentialPort = {
    resolve: () => ({ ok: true, material: { value: PARITY_CANARY } }),
  };

  const runs: ParityRunResult[] = [];
  let runIndex = 0;

  const compositionFacts: ProductionCompositionFacts = {
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
    ...(options.baseBranch === undefined ? {} : { dispatchBaseBranch: options.baseBranch }),
    harnessSpawnRunner: guarded.runner,
    harnessSpawnStarter: guarded.starter,
    credentials: credentialPort,
    githubTransport: transport,
    gitChildRunner: guarded.gitRunner as GitChildRunner,
    gitPushRunner: guarded.pushRunner,
    ...(options.pushTimeoutMs === undefined
      ? {}
      : { dispatchPushTimeoutMs: options.pushTimeoutMs }),
    processId: options.processId ?? 4242,
    dispatchDelay: delay,
    clock: { nowMs: clock.nowMs, nowIso: clock.nowIso },
    ...(options.ownerProbe === undefined ? {} : { ownerProbe: options.ownerProbe }),
    ...(options.artifactRoot === undefined ? {} : { dispatchLogFamilyRoot: options.artifactRoot }),
    ...(options.artifactFs === undefined ? {} : { dispatchLogFileSystem: options.artifactFs }),
    ...(options.secrets === undefined ? {} : { registeredSecrets: options.secrets }),
    ...(options.transcriptRead === undefined ? {} : { operatorTranscript: options.transcriptRead }),
    ...(options.supportsIntrospection === undefined
      ? {}
      : { operatorSupportsIntrospection: options.supportsIntrospection }),
    ...(options.onAppend === undefined && options.storeWrap === undefined
      ? {}
      : {
          stateStoreWrap: (opened: StateStorePort): StateStorePort => {
            const wrapped = options.storeWrap?.(opened) ?? opened;
            if (options.onAppend === undefined) return wrapped;
            return {
              ...wrapped,
              append: (handle, request) => {
                const outcome = wrapped.append(handle, request);
                if (outcome.ok) options.onAppend?.({ kind: request.kind });
                return outcome;
              },
            };
          },
        }),
  };
  const composer: EntrypointComposer = (composedBrand, invocation) =>
    createProductionComposer(compositionFacts)(composedBrand, invocation);
  const program = composer(brand);

  const run = async (argv?: readonly string[]): Promise<ParityRunResult> => {
    const out: string[] = [];
    const err: string[] = [];
    const streams: CliStreams = {
      stdout: { write: (chunk: string) => out.push(chunk) },
      stderr: { write: (chunk: string) => err.push(chunk) },
    };
    runIndex += 1;
    const effectiveArgv = argv ?? ["dispatch", ref, "--json"];
    // The credential-wiring probe (GH-354 F-1 remediation): with declared
    // credential references the run goes through the PRODUCTION entrypoint, so
    // the registered set is resolved from the injected environment and travels
    // the same invocation fact production uses. Absent, the delivered direct
    // `runCli` path is kept byte-for-byte.
    const exit =
      options.credentialReferences === undefined
        ? await runCli(effectiveArgv, streams, {
            brand,
            clock: { now: () => clock.nowMs() },
            newRunId: () => `run-parity-${runIndex}`,
            secrets: [...(options.secrets ?? [])],
            program,
          })
        : await runEntrypoint(effectiveArgv, {
            streams,
            environment: compositionFacts.environment,
            declaredWorkingName: "delivery-os",
            credentialReferences: options.credentialReferences,
            newRunId: () => `run-parity-${runIndex}`,
            composeProgram: composer,
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
      envelopes: runs.flatMap((entry) => (entry.envelope === undefined ? [] : [entry.envelope])),
    };
  };

  const seedRestarts = (count: number): void => {
    for (let ordinal = 1; ordinal <= count; ordinal += 1) {
      const appended = appendEconomicsRestartEvent(rawStore, `seed-restart-${ordinal}`, {
        schemaId: "delivery.economics.restart.v1",
        workItemRef: ref,
        runId: "seed-run",
        sessionId: "ses-seed",
        ordinal,
        reason: "session-interrupted",
        recordedAt: clock.nowIso(),
      });
      if (!appended.ok) throw new Error(`restart seed failed: ${JSON.stringify(appended)}`);
    }
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
    stateDirectory,
    store,
    clock,
    guarded,
    get waits() {
      return waits;
    },
    run,
    observe,
    seedRestarts,
    seedLease,
    holdFence: () => {
      const handleStore = secondHandle();
      const acquired = handleStore.acquireFence(`external-fence-${externalStores.length + 1}`);
      if (!acquired.ok)
        throw new Error(`external fence acquisition failed: ${acquired.error.code}`);
      externalStores.push(handleStore);
      return acquired.value.handle;
    },
    releaseFence,
    dispose: () => rmSync(home, { recursive: true, force: true }),
  };
};

/* ------------------------------------------------------------------------- */
/* The spawn rows (GH-347 F-7, TDR-0054).                                     */
/* ------------------------------------------------------------------------- */

/** A fresh production spawn: one --agent pm, one --model, one fresh --title. */
export const spawnFreshObservation = async (
  options: { readonly ref?: string; readonly baseBranch?: string } = {},
): Promise<ParityObservation> => {
  const ref = options.ref ?? "GH-347";
  const h = createParityHarness({
    label: `spawn-fresh-${ref}`,
    ref,
    ...(options.baseBranch === undefined ? {} : { baseBranch: options.baseBranch }),
  });
  try {
    await h.run(["dispatch", ref, "--json"]);
    return h.observe();
  } finally {
    h.dispose();
  }
};

/** A resume: the recorded lane resumes with NO title. */
export const spawnResumeObservation = async (): Promise<ParityObservation> => {
  const h = createParityHarness({ label: "spawn-resume" });
  try {
    // The lane is seeded through the real append, exactly as a prior run leaves it.
    const { appendDispatchLane } = await import(
      "../../../../packages/core/src/app/dispatch-ledger"
    );
    const appended = appendDispatchLane(h.store, "seed-spawn", {
      schema: "delivery.dispatch.lane.v1",
      ref: "GH-347",
      repository: PARITY_REPOSITORY,
      attemptId: "attempt-seed-spawn",
      sessionId: "ses-spawn-1",
      harnessKind: "opencode",
      owner: { processId: 4242, startedAt: h.clock.nowIso() },
      iterationOrdinal: 1,
      restartsConsumed: 0,
      state: "terminal",
      lastToken: "pr-open",
      lastOutcome: "completed",
      recordedAt: h.clock.nowIso(),
    });
    if (!appended.ok) throw new Error("spawn lane seed failed");
    await h.run(["dispatch", "GH-347", "--resume-prompt", "continue", "--json"]);
    return h.observe();
  } finally {
    h.dispose();
  }
};
