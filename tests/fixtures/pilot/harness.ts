/**
 * The fixture-backed pilot J1 harness (spec F-10, AC-F10-1..3, Appendix D).
 *
 * The composition is test-only: real command definitions over a real temp git
 * repository, a real JSONL state ledger, real change-folder files, and real
 * envelopes/exit codes. Tracker, CI, PR-platform, and provider surfaces are the
 * recording stubs from `stubs.ts`; clock, run ids, and fence tokens are fixed.
 *
 * The J1 sequence is exactly:
 *   status -> blockers answer -> verify change -> phase list -> merge ->
 *   closeout --apply -> queue plan --next 1
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createCommitlintProbe,
  createSecretScanner,
  nodeFileSystemFacts,
  nodePmNotesFileSystemFacts,
  readPmNotesText,
  relativeChangeFolder,
} from "../../../packages/adapters/src/file/index";
import { createGitCommitSeam } from "../../../packages/adapters/src/git/commit";
import { createGitBranchSeam } from "../../../packages/adapters/src/git/index";
import { createGitMergeSeam } from "../../../packages/adapters/src/git/merge";
import { nodeRepositoryIo } from "../../../packages/adapters/src/repo/index";
import { createBlockersCommandDefinition } from "../../../packages/cli/src/commands/blockers";
import { createCloseoutCommandDefinition } from "../../../packages/cli/src/commands/closeout";
import { createCommitCommandDefinition } from "../../../packages/cli/src/commands/commit";
import { createLintCommandDefinition } from "../../../packages/cli/src/commands/lint";
import { createMergeCommandDefinition } from "../../../packages/cli/src/commands/merge";
import { createPhaseCommandDefinition } from "../../../packages/cli/src/commands/phase";
import { createPlanCommandDefinition } from "../../../packages/cli/src/commands/plan";
import { createQueueCommandDefinition } from "../../../packages/cli/src/commands/queue";
import { createStatusCommandDefinition } from "../../../packages/cli/src/commands/status";
import { createVerifyCommandDefinition } from "../../../packages/cli/src/commands/verify";
import {
  type CloseoutComposition,
  type CommitRuntimeOptions,
  createBlockersCommandRuntime,
  createCloseoutCommandRuntime,
  createCloseoutStateRuntime,
  createCommitCommandRuntime,
  createMergeCommandRuntime,
  createPhaseCommandRuntime,
  createPhaseCommitExtension,
  createPlanCommandRuntime,
  createQueueCommandRuntime,
  createStatusCommandRuntime,
  createVerifyCommandRuntime,
  type PhaseRuntimeOptions,
  type QueueComposition,
  type StatusComposition,
} from "../../../packages/cli/src/edge";
import type { CliDependencies, CommandProgram } from "../../../packages/cli/src/index";
import { runCli } from "../../../packages/cli/src/index";
import { declareQueueEntry } from "../../../packages/core/src/app/queue";
import {
  BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  type BlockerQuestionRecord,
  MERGE_GATE_VERIFICATION_SCHEMA,
  type MergeGateVerificationRecord,
  STATE_SCHEMA_VERSION,
  type StateStoreIdentity,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../../packages/core/src/domain/merge-gate-set";
import {
  appendBlockerQuestion,
  appendMergeGateVerification,
  appendPhaseTransition,
  createNodeStateEdge,
  createStateStore,
  readBlockerLedger,
  readChangeTransitionsTolerant,
  readCloseoutHistory,
  readCommitTelemetry,
  readMergeTransactions,
} from "../../../packages/core/src/state/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import {
  createPilotRepo,
  PILOT_BASE,
  PILOT_BRANCH,
  PILOT_CHANGE_FOLDER,
  PILOT_REF,
  PILOT_REPOSITORY,
  type PilotRepo,
} from "./repo";
import {
  createPilotStubs,
  createRecordingChildRunner,
  installFetchGuard,
  installSleepGuard,
  type PilotSpawn,
  type PilotStubs,
  pilotDeliveryRequest,
  pilotGreenRuns,
  pilotWorkItem,
} from "./stubs";

export const PILOT_NOW_ISO = "2026-11-07T00:00:00Z";
export const PILOT_NOW_MS = Date.parse(PILOT_NOW_ISO);
export const PILOT_WORKSPACE_ID = "pilot-workspace";
export const PILOT_FENCE_NAMESPACE = "pilot-fence";
export const PILOT_QUESTION_ID = "Q-0001";
export const PILOT_BUDGET = { maxSteps: 24, maxRetries: 0 } as const;

const nowIsoOf = (iso: string): string => iso;
const parseIso = (iso: string): number => Date.parse(iso);

const pilotSpec = (): string => `# Pilot change specification

## Problem

The pilot repository exists to prove one coordinator J1 iteration on the
delivered tooling primitives without any live tracker, CI, or network surface.

## Acceptance

- The state ledger, git objects, change-folder files, and envelopes are real.
- Tracker, CI, PR-platform, and provider reads are in-process stubs.
- The clock, run ids, and fence tokens are fixed.
`;

const pilotTestPlan = (): string => `# Pilot test plan

- TC-PILOT-001 seeds the repository.
- TC-PILOT-002 drives the J1 sequence.
`;

const pilotPlan = (): string => `schemaVersion: delivery.plan.v1
workItemRef: ${PILOT_REF}
tier:
  name: full
  phases: [1, 2]
defaultLeases:
  - repo:main-tools
defaultWeightClass: standard
phases:
  - id: 1
    title: "Pilot planning"
    kind: planning
    summary: "Record the pilot change artifacts."
    scope:
      folders:
        - ${PILOT_CHANGE_FOLDER}
  - id: 2
    title: "Pilot delivery"
    kind: delivery
    summary: "Deliver the pilot change."
    scope:
      folders:
        - src
`;

const pilotPmNotes = (): string => `change_id: ${PILOT_REF}
title: "Pilot delivery"
delivery_mode: autonomous
milestone: M1
story_code: M1-S20
variant: full
phases:
  clarify_scope: { started: "2026-11-07T00:00:00Z", completed: "2026-11-07T00:01:00Z" }
  specification: { started: "2026-11-07T00:01:00Z", completed: "2026-11-07T00:02:00Z" }
  test_planning: { started: "2026-11-07T00:02:00Z", completed: "2026-11-07T00:03:00Z" }
  delivery_planning: { started: "2026-11-07T00:03:00Z", completed: "2026-11-07T00:04:00Z" }
  dor_check: { started: "2026-11-07T00:04:00Z", completed: "2026-11-07T00:05:00Z" }
  delivery: { started: "2026-11-07T00:05:00Z", completed: null }
  system_spec_update: { started: null, completed: null }
  review_fix: { started: null, completed: null }
  quality_gates: { started: null, completed: null }
  dod_check: { started: null, completed: null }
  pr_creation: { started: null, completed: null }
decisions: []
open_questions: []
blockers: []
notes:
  - text: "Pilot fixture note."
`;

export const pilotChangeFolderFiles = (): Readonly<Record<string, string>> => ({
  [`${PILOT_CHANGE_FOLDER}/chg-${PILOT_REF}-spec.md`]: pilotSpec(),
  [`${PILOT_CHANGE_FOLDER}/chg-${PILOT_REF}-test-plan.md`]: pilotTestPlan(),
  [`${PILOT_CHANGE_FOLDER}/chg-${PILOT_REF}-plan.yaml`]: pilotPlan(),
  [`${PILOT_CHANGE_FOLDER}/chg-${PILOT_REF}-pm-notes.yaml`]: pilotPmNotes(),
});

const pilotQuestion = (): BlockerQuestionRecord => ({
  schemaId: BLOCKER_QUESTION_PAYLOAD_SCHEMA,
  id: PILOT_QUESTION_ID,
  type: "decision-needed",
  audience: "coordinator",
  lane: "pm-gh-310",
  ref: PILOT_REF,
  question: "Which delivery variant should the pilot use?",
  options: ["full", "lite"],
  askedAt: PILOT_NOW_ISO,
});

export type PilotRun = {
  readonly argv: readonly string[];
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type PilotSnapshot = {
  readonly outputs: readonly {
    readonly argv: readonly string[];
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
  }[];
  readonly ledger: string;
  readonly changeFolder: readonly { readonly path: string; readonly text: string }[];
  readonly branches: readonly string[];
  readonly baseHead: string;
  readonly logSubjects: readonly string[];
  readonly head: string;
};

export type Pilot = {
  readonly repo: PilotRepo;
  readonly stateRoot: string;
  readonly identity: StateStoreIdentity;
  readonly store: StateStorePort;
  readonly stubs: PilotStubs;
  readonly spawns: PilotSpawn[];
  readonly steps: { count: number; retries: number };
  readonly nowIso: string;
  readonly deliveryHead: string;
  readonly program: CommandProgram;
  run(argv: readonly string[]): Promise<PilotRun>;
  runSequence(): Promise<PilotSequence>;
  snapshot(): PilotSnapshot;
  cleanup(): void;
};

export type PilotSequence = {
  readonly status: PilotRun;
  readonly answer: PilotRun;
  readonly verify: PilotRun;
  readonly phaseList: PilotRun;
  readonly merge: PilotRun;
  readonly closeout: PilotRun;
  readonly queuePlan: PilotRun;
  readonly nextActions: readonly { readonly ref: string; readonly reason: string }[];
};

export type PilotOptions = {
  readonly iso?: string;
  readonly baseDirectory?: string;
};

const envelopeData = (run: PilotRun): Record<string, unknown> => {
  const data = run.envelope?.data;
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
};

const gateCitation = (): MergeGateVerificationRecord["gates"][number]["citation"] => ({
  sources: [],
  identity: { changeRef: PILOT_REF },
  counts: [],
  names: [],
  reasons: ["pilot-fixture"],
});

const gateVerdicts = (
  ids: readonly string[],
): readonly MergeGateVerificationRecord["gates"][number][] =>
  ids.map((id) => ({
    id,
    verdict: "pass" as const,
    reason: "pilot-fixture",
    citation: gateCitation(),
  }));

/**
 * Build the pilot repository, state store, stubs, and the prepared
 * (delivery-complete) fixture. Preparation itself goes through the real
 * `phase complete` command so the transition, telemetry, and commit are real.
 */
export const createPilot = async (options: PilotOptions = {}): Promise<Pilot> => {
  const nowIso = nowIsoOf(options.iso ?? PILOT_NOW_ISO);
  const nowMs = parseIso(nowIso);
  const baseDirectory = options.baseDirectory ?? join(process.cwd(), "tmp", "tmpdir");
  const repo = createPilotRepo({ baseDirectory, changeFolderFiles: pilotChangeFolderFiles() });
  const stateRoot = mkdtempSync(join(baseDirectory, "pilot-state-"));
  const identity: StateStoreIdentity = {
    level: "local",
    workspaceId: PILOT_WORKSPACE_ID,
    fenceNamespace: PILOT_FENCE_NAMESPACE,
    schemaVersion: STATE_SCHEMA_VERSION,
    stateDirectory: stateRoot,
  };
  const store = createStateStore(identity, { driver: "jsonl", edge: createNodeStateEdge() });

  const credential = `pilot-${String(Date.parse(nowIso)).slice(-6)}-credential-canary`;
  const spawns: PilotSpawn[] = [];
  const stubs = createPilotStubs({ headSha: () => repo.head(), credential });
  const runner = createRecordingChildRunner(spawns, repo.environment);

  let fence = 0;
  const nextFence = (): string => {
    fence += 1;
    return `pilot-fence-${String(fence).padStart(4, "0")}`;
  };

  let runCounter = 0;
  const steps = { count: 0, retries: 0 };
  const runs: PilotRun[] = [];
  let deliveryHead = repo.head();

  const notesFs = nodePmNotesFileSystemFacts();
  const changesDirectory = join(repo.root, "doc", "changes");
  const localContextPath = join(stateRoot, "pm-context.yaml");
  writeFileSync(
    localContextPath,
    `active_change:\n  workItemRef: ${PILOT_REF}\n  branch: ${PILOT_BRANCH}\n  change_folder: ${PILOT_CHANGE_FOLDER}\nparked_changes: []\n`,
  );

  const readChangeFolder = (changeRef: string): string | undefined =>
    relativeChangeFolder({
      changeRef,
      changesDirectory,
      repoRoot: repo.root,
      fs: notesFs,
    });

  const commitOptions: CommitRuntimeOptions = {
    store,
    changesDirectory,
    fs: notesFs,
    git: createGitCommitSeam({ cwd: repo.root, childRunner: runner }),
    safety: { scan: createSecretScanner({ cwd: repo.root }) },
    commitlint: createCommitlintProbe({ cwd: repo.root }),
    transports: {},
    availability: {
      coreInference: { available: false, reason: "no-provider-route" },
      harnessOneShot: { available: false, reason: "no-harness-credentials" },
    },
    sessionFacts: { insideDeliverySession: false },
    phaseCommit: true,
    nowIso: () => nowIso,
    newFenceToken: nextFence,
    readChangeFolder,
  };
  const phaseOptions: PhaseRuntimeOptions = {
    store,
    changesDirectory,
    fs: notesFs,
    writeFile: (file, text) => {
      writeFileSync(file, text);
    },
    nowIso: () => nowIso,
    newFenceToken: nextFence,
    readChangeFolder,
  };
  const phaseRuntime = createPhaseCommandRuntime(phaseOptions);
  const phaseExtension = createPhaseCommitExtension(commitOptions);
  const committedPhaseRuntime = { ...phaseRuntime, commit: phaseExtension };

  const statusComposition: StatusComposition = {
    store,
    credentials: stubs.credentials,
    transport: stubs.transport,
    repository: { cwd: repo.root, io: nodeRepositoryIo() },
    localContext: { path: localContextPath, fs: nodeFileSystemFacts() },
    clock: { nowMs: () => nowMs, nowIso: () => nowIso },
    github: { instance: stubs.instance },
  };
  const statusRuntime = createStatusCommandRuntime(statusComposition, () => ({
    ok: false,
    reason: "provider-chain-not-declared",
    failureCode: "config.value.invalid",
  }));

  const branchSeam = createGitBranchSeam({
    cwd: repo.root,
    timeoutMs: 20_000,
    childRunner: runner,
  });
  const closeoutComposition: CloseoutComposition = {
    planFacts: async (workItemRef) => {
      const checkout = await branchSeam.readCheckout({
        deliveryBranch: PILOT_BRANCH,
        baseRef: PILOT_BASE,
        ...(stubs.mergedRequest().headSha === undefined
          ? {}
          : { deliveryHead: stubs.mergedRequest().headSha }),
      });
      const cleanWorktree = await branchSeam.isClean();
      const baseRefExists = await branchSeam.resolveRef({ ref: PILOT_BASE });
      const branches = await branchSeam.listBranches({ workItemRef: PILOT_REF });
      return {
        workspaceId: PILOT_WORKSPACE_ID,
        workItemRef,
        provider: { systemName: "github", capabilities: stubs.closeoutProvider.capabilities },
        observedWorkItem: { observation: "observed", value: stubs.workItem() },
        mergedRequest: { observation: "observed", value: stubs.mergedRequest() },
        dependents: { observation: "observed", value: [] },
        checkout: {
          state: checkout.state,
          ...(checkout.branch === undefined ? {} : { branch: checkout.branch }),
          ...(checkout.head === undefined ? {} : { head: checkout.head }),
        },
        cleanWorktree,
        baseRefExists,
        branches,
        checkedOutElsewhere: [],
        persisted: {},
      };
    },
    provider: stubs.closeoutProvider,
    git: branchSeam,
    state: createCloseoutStateRuntime(store),
    nowIso: () => nowIso,
    newFenceToken: nextFence,
  };

  const queueComposition: QueueComposition = {
    store,
    facts: stubs.queueFacts,
    settings: {
      leaseTtlMs: 90_000,
      parkRecheckMs: {
        "provider-window": 60_000,
        "provider-quota": 300_000,
        preemption: 60_000,
      },
    },
    repositoryBinding: {
      repository: PILOT_REPOSITORY,
      repositoryRoot: `/pilot/${PILOT_REPOSITORY}`,
    },
    runner: "runner-a",
    nowIso: () => nowIso,
    nowMs: () => nowMs,
    newFenceToken: nextFence,
    degraded: ["daemon-unreachable"],
  };

  const planRuntime = createPlanCommandRuntime({ changesDirectory, fs: notesFs });
  const lintRuntime = {
    readPmNotes: (changeRef: string) =>
      readPmNotesText({ changeRef, changesDirectory, fs: notesFs }),
    readRegistry: (changeRef: string) => {
      const read = readChangeTransitionsTolerant(store, changeRef);
      if (!read.ok) return { ok: false as const, error: read.error };
      return {
        ok: true as const,
        verifiedEmpty: read.value.verifiedEmpty,
        recordCount: read.value.evidence.recordCount,
        verification: read.value.evidence.verification,
        projection: { present: true },
      };
    },
    readPlan: planRuntime.readPlan,
    parseYaml: planRuntime.parseYaml,
  };

  const mergeRuntime = createMergeCommandRuntime({
    store,
    git: createGitMergeSeam({ cwd: repo.root, timeoutMs: 20_000, childRunner: runner }),
    values: () => ({}),
    readWorkItem: async () => ({
      ok: true,
      item: pilotWorkItem({ labels: [], updatedAt: nowIso }),
    }),
    readCheckRuns: async (sha) => ({
      ok: true,
      items: pilotGreenRuns(sha),
      pageItemCount: 2,
      sha,
    }),
    readRequestDetail: async () => ({
      ok: true,
      request: pilotDeliveryRequest(deliveryHead),
    }),
    baseRef: PILOT_BASE,
    branch: PILOT_BRANCH,
    nowIso: () => nowIso,
    nowMs: () => nowMs,
    newFenceToken: nextFence,
  });

  const program: CommandProgram = {
    commands: {
      status: createStatusCommandDefinition(statusRuntime),
      blockers: createBlockersCommandDefinition(
        createBlockersCommandRuntime(
          { store, clock: { nowMs: () => nowMs, nowIso: () => nowIso }, newFenceToken: nextFence },
          SYNTHETIC_BRAND,
          [credential],
          { EXAMPLE_PRODUCT_CALLER_AUDIENCE: "coordinator" },
        ),
      ),
      phase: createPhaseCommandDefinition(committedPhaseRuntime),
      commit: createCommitCommandDefinition(
        createCommitCommandRuntime(commitOptions, {
          runtime: committedPhaseRuntime,
          extension: phaseExtension,
        }),
      ),
      verify: createVerifyCommandDefinition(
        createVerifyCommandRuntime({ store, changesDirectory, fs: notesFs }),
      ),
      merge: createMergeCommandDefinition(mergeRuntime),
      closeout: createCloseoutCommandDefinition(createCloseoutCommandRuntime(closeoutComposition)),
      queue: createQueueCommandDefinition(createQueueCommandRuntime(queueComposition)),
      plan: createPlanCommandDefinition(planRuntime),
      lint: createLintCommandDefinition(lintRuntime),
    },
  };

  const run = async (argv: readonly string[]): Promise<PilotRun> => {
    steps.count += 1;
    if (steps.count > PILOT_BUDGET.maxSteps) {
      throw new Error(
        `pilot step budget exceeded: ${String(steps.count)} > ${String(PILOT_BUDGET.maxSteps)}`,
      );
    }
    runCounter += 1;
    let tick = 0;
    const deps: CliDependencies = {
      brand: SYNTHETIC_BRAND,
      clock: {
        now: () => {
          tick += 1;
          return tick === 1 ? nowMs : nowMs + 7;
        },
      },
      newRunId: () => `run-${String(runCounter).padStart(4, "0")}`,
      secrets: [credential],
      program,
    };
    const stdout = bufferSink();
    const stderr = bufferSink();
    const exitCode = await runCli(argv, { stdout, stderr }, deps);
    const text = stdout.value.trim();
    const envelope =
      text.startsWith("{") && text.endsWith("}")
        ? (JSON.parse(text) as Record<string, unknown>)
        : undefined;
    const result: PilotRun = {
      argv: [...argv],
      exitCode,
      stdout: stdout.value,
      stderr: stderr.value,
      ...(envelope === undefined ? {} : { envelope }),
    };
    runs.push(result);
    return result;
  };

  // Seed the typed question and the real queue entries in the real ledger.
  const seededQuestion = readBlockerLedger(store);
  if (!seededQuestion.ok) throw new Error(`blocker read failed: ${seededQuestion.error.code}`);
  const questionAppend = appendBlockerQuestion(store, {
    record: pilotQuestion(),
    fenceToken: nextFence(),
  });
  if (!questionAppend.ok) throw new Error(`question seed failed: ${questionAppend.error.code}`);

  for (const [ref, priority] of [
    ["GH-310", 9],
    ["GH-320", 0],
    ["GH-321", 2],
  ] as const) {
    const declared = declareQueueEntry(store, {
      ref,
      repository: PILOT_REPOSITORY,
      // Internal-only producer-root discovery input; a fixed synthetic value
      // keeps the ledger payload deterministic across temp roots.
      repositoryRoot: `/pilot/${PILOT_REPOSITORY}`,
      priority,
      recordedAt: nowIso,
      fenceToken: nextFence(),
    });
    if (!declared.ok) throw new Error(`queue seed failed for ${ref}: ${declared.code}`);
  }

  const pilot: Pilot = {
    repo,
    stateRoot,
    identity,
    store,
    stubs,
    spawns,
    steps,
    nowIso,
    get deliveryHead() {
      return deliveryHead;
    },
    program,
    run,
    runSequence,
    snapshot,
    cleanup,
  };

  // Real completion: the transition is written before the commit act, the
  // change folder and mapped plan scope are staged, and the ledger gets both a
  // phase.transition and a commit.telemetry record.
  const completion = await run(["phase", "complete", PILOT_REF, "delivery", "--json"]);
  if (completion.exitCode !== 0) {
    throw new Error(`pilot preparation failed: ${completion.stderr || completion.stdout}`);
  }
  deliveryHead = repo.head();

  // Record the post-delivery lifecycle transitions for the ready-to-merge item.
  for (const phaseId of [
    "system_spec_update",
    "review_fix",
    "quality_gates",
    "dod_check",
    "pr_creation",
  ]) {
    const appended = appendPhaseTransition(store, {
      changeRef: PILOT_REF,
      phaseId,
      operation: "complete",
      timestamp: nowIso,
      fenceToken: nextFence(),
      commitIntent: "record-only",
      commitIntentBasis: "opt-out-flag",
    });
    if (!appended.ok) throw new Error(`phase transition seed failed: ${appended.error.code}`);
  }

  const gateSet = resolveMergeGateSet(undefined);
  if (!gateSet.ok) throw new Error(`default gate set invalid: ${gateSet.failure.detail}`);
  const verification: MergeGateVerificationRecord = {
    schema: MERGE_GATE_VERIFICATION_SCHEMA,
    changeRef: PILOT_REF,
    headSha: deliveryHead,
    verifiedAt: nowIso,
    gateSet: { schemaVersion: gateSet.value.schemaVersion, ids: gateSet.value.ids },
    gates: gateVerdicts(gateSet.value.ids),
    trackerPosture: { labels: [], ownerLabels: [] },
  };
  const verificationAppend = appendMergeGateVerification(store, {
    record: verification,
    fenceToken: nextFence(),
  });
  if (!verificationAppend.ok) {
    throw new Error(`verification seed failed: ${verificationAppend.error.code}`);
  }

  function snapshot(): PilotSnapshot {
    const canonical = (text: string): string =>
      text
        .split(repo.root)
        .join("<REPO>")
        .split(stateRoot)
        .join("<STATE>")
        .split(baseDirectory)
        .join("<BASE>");
    return {
      outputs: runs.map((entry) => ({
        argv: entry.argv,
        exitCode: entry.exitCode,
        stdout: canonical(entry.stdout),
        stderr: canonical(entry.stderr),
      })),
      ledger: canonical(
        readFileSync(join(stateRoot, `ledger.${PILOT_WORKSPACE_ID}.jsonl`), "utf8"),
      ),
      changeFolder: repo.changeFolderFiles().map((path) => ({
        path,
        text: canonical(repo.read(path)),
      })),
      branches: repo.listBranches().map(canonical),
      baseHead: repo.branchHead(PILOT_BASE) ?? "",
      logSubjects: repo.logSubjects().map(canonical),
      head: repo.head(),
    };
  }

  async function runSequence(): Promise<PilotSequence> {
    const status = await run(["--json", "status"]);
    const answer = await run(["--json", "blockers", "answer", PILOT_QUESTION_ID, "--choice", "2"]);
    const verify = await run(["--json", "verify", "change", PILOT_REF]);
    const phaseList = await run(["--json", "phase", "list", PILOT_REF]);
    const merge = await run(["--json", "merge", PILOT_REF]);
    const mergeData = envelopeData(merge);
    const squashSha = typeof mergeData.squashSha === "string" ? mergeData.squashSha : undefined;
    if (squashSha !== undefined) stubs.setMerged(squashSha);
    const closeout = await run(["--json", "closeout", PILOT_REF, "--apply"]);
    stubs.markClosed();
    const queuePlan = await run(["--json", "queue", "plan", "--next", "1"]);
    const data = envelopeData(queuePlan);
    const nextActions = Array.isArray(data.nextActions)
      ? data.nextActions.flatMap((action) => {
          if (typeof action !== "object" || action === null) return [];
          const record = action as Record<string, unknown>;
          return typeof record.ref === "string" && typeof record.reason === "string"
            ? [{ ref: record.ref, reason: record.reason }]
            : [];
        })
      : [];
    return { status, answer, verify, phaseList, merge, closeout, queuePlan, nextActions };
  }

  function cleanup(): void {
    repo.cleanup();
    rmSync(stateRoot, { recursive: true, force: true });
  }

  return pilot;
};

/** Run a sequence with the network and sleep guards installed. */
export const withGuards = async <T>(
  body: (guards: {
    readonly fetch: ReturnType<typeof installFetchGuard>;
    readonly sleep: ReturnType<typeof installSleepGuard>;
  }) => Promise<T>,
): Promise<T> => {
  const fetchGuard = installFetchGuard();
  const sleepGuard = installSleepGuard();
  try {
    return await body({ fetch: fetchGuard, sleep: sleepGuard });
  } finally {
    sleepGuard.restore();
    fetchGuard.restore();
  }
};

/** Re-exported record readers used by the pilot record suite. */
export const readPilotRecords = (store: StateStorePort) => ({
  transitions: readChangeTransitionsTolerant(store, PILOT_REF),
  telemetry: readCommitTelemetry(store, PILOT_REF),
  mergeTransactions: readMergeTransactions(store, PILOT_REF),
  closeoutHistory: readCloseoutHistory(store, PILOT_REF),
  blockers: readBlockerLedger(store),
});

export { PILOT_BASE, PILOT_BRANCH, PILOT_CHANGE_FOLDER, PILOT_REF, PILOT_REPOSITORY };
