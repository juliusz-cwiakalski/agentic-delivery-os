/**
 * In-process commit/phase behaviour harness (GH-227 test-plan §4.1).
 *
 * Every run composes the real command definition with injected brand, clock,
 * state root, and a real temporary git repository; the only child process is
 * `git` (and the commitlint adapter probe in its own suite). Transport,
 * safety, commitlint, and session facts are injected fakes.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  nodePmNotesFileSystemFacts,
  parseConfigYaml,
  stagePmNotesPhaseEntry,
} from "../../../packages/adapters/src/file";
import { createGitCommitSeam } from "../../../packages/adapters/src/git";
import { createCommitCommandDefinition } from "../../../packages/cli/src/commands/commit";
import { createPhaseCommandDefinition } from "../../../packages/cli/src/commands/phase";
import {
  createCommitCommandRuntime,
  createPhaseCommitExtension,
} from "../../../packages/cli/src/edge";
import type { CommandDefinition } from "../../../packages/cli/src/index";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type {
  CommitSafetyOutcome,
  CommitSessionFacts,
  CommitTransportAvailability,
  StateStoreIdentity,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  appendPhaseTransition,
  readChangeTransitionsTolerant,
  replacePhaseProjection,
} from "../../../packages/core/src/state/index";
import {
  createSafetyScanner,
  createScriptedCommitlint,
  createScriptedTransport,
  createTempGitRepository,
  type ScriptedCommitlint,
  type ScriptedSafetyScanner,
  type ScriptedTransport,
  type TempGitRepository,
  transportAvailability,
} from "../../../packages/testkit/src/commit/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import { ledgerLines, ledgerPath, makeIdentity, openStore, removeRoot } from "../state/harness";

export const COMMIT_REF = "GH-310";
export const COMMIT_CHANGE_DIRECTORY = "doc/changes/2026-11/2026-11-05--GH-310--commit-fixture";

export const COMMIT_PLAN_YAML = `schemaVersion: delivery.plan.v1
workItemRef: GH-310
tier:
  name: full
  phases: [6]
phases:
  - id: 6
    title: "Delivery phase"
    kind: delivery
    scope:
      files:
        - src/new-file.ts
        - src/existing.ts
    summary: "deliver the fixture change"
`;

export const COMMIT_NOTES_YAML = `change_id: GH-310
title: "commit fixture"
delivery_mode: interactive
phases:
  clarify_scope: { started: "2026-11-05T01:00:00Z", completed: "2026-11-05T01:10:00Z" }
  specification: { started: "2026-11-05T01:11:00Z", completed: "2026-11-05T01:20:00Z" }
  test_planning: { started: "2026-11-05T01:21:00Z", completed: "2026-11-05T01:30:00Z" }
  delivery_planning: { started: "2026-11-05T01:31:00Z", completed: "2026-11-05T01:40:00Z" }
  dor_check: { started: "2026-11-05T01:41:00Z", completed: "2026-11-05T01:50:00Z" }
  delivery: { started: null, completed: null, reopened: null, commits: [] }
  system_spec_update: { started: null, completed: null }
  review_fix: { started: null, completed: null }
  quality_gates: { started: null, completed: null }
  dod_check: { started: null, completed: null }
  pr_creation: { started: null, completed: null, url: null }
decisions: []
open_questions: []
blockers: []
notes: []
`;

export type HarnessClock = {
  nextIso(): string;
  nowMs(): number;
  readonly issued: readonly string[];
};

export const makeHarnessClock = (): HarnessClock => {
  const issued: string[] = [];
  let index = 0;
  return {
    nextIso: () => {
      const iso = new Date(Date.UTC(2026, 10, 5, 12, index, 0)).toISOString().replace(".000Z", "Z");
      index += 1;
      issued.push(iso);
      return iso;
    },
    nowMs: () => {
      index += 1;
      return index * 1_000;
    },
    get issued() {
      return [...issued];
    },
  };
};

export type CommitRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type CommitHarnessOptions = {
  readonly planYaml?: string;
  readonly notesYaml?: string;
  readonly omitPlan?: boolean;
  readonly seedFiles?: Readonly<Record<string, string>>;
  readonly availability?: Partial<CommitTransportAvailability>;
  readonly sessionFacts?: Partial<CommitSessionFacts>;
  readonly phaseCommit?: boolean;
  /** `null` makes ref resolution fail; omitted resolves the fixture ref. */
  readonly resolvedRef?: {
    readonly ref: string;
    readonly refSource: "argument" | "branch" | "change-folder";
  } | null;
};

export type CommitHarnessFaults = {
  commitObject: boolean;
  ledgerAppend: boolean;
  telemetryAppend: boolean;
};

export type CommitHarness = {
  readonly root: string;
  readonly repo: TempGitRepository;
  readonly changeDirectory: string;
  readonly stateRoot: string;
  readonly identity: StateStoreIdentity;
  readonly store: StateStorePort;
  readonly clock: HarnessClock;
  readonly coreTransport: ScriptedTransport;
  readonly harnessTransport: ScriptedTransport;
  readonly safety: ScriptedSafetyScanner & {
    scan: (files: readonly { readonly path: string }[]) => Promise<CommitSafetyOutcome>;
  };
  readonly commitlint: ScriptedCommitlint;
  readonly sessionFacts: CommitSessionFacts;
  readonly availability: CommitTransportAvailability;
  readonly faults: CommitHarnessFaults;
  readonly phaseDefinition: CommandDefinition;
  readonly commitDefinition: CommandDefinition;
  runCommit(args: readonly string[], options?: { readonly json?: boolean }): Promise<CommitRun>;
  runPhase(args: readonly string[], options?: { readonly json?: boolean }): Promise<CommitRun>;
  runDefinition(
    definition: CommandDefinition,
    command: string,
    args: readonly string[],
    options?: { readonly json?: boolean },
  ): Promise<CommitRun>;
  transitionPayloads(): Record<string, unknown>[];
  telemetryPayloads(): Record<string, unknown>[];
  targetText(): string;
  projectionContent(): unknown;
  planText(): string | undefined;
  planPhase(): Record<string, unknown> | undefined;
  cleanup(): void;
};

const recordsOf = (lines: readonly string[]): Record<string, unknown>[] =>
  lines.map((line) => {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("ledger line is not a record");
    }
    return parsed as Record<string, unknown>;
  });

const writeIfPresent = (root: string, relative: string, content: string): string => {
  const path = join(root, relative);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
  return path;
};

export const createCommitHarness = (options: CommitHarnessOptions = {}): CommitHarness => {
  const tempRoot = join(process.cwd(), "tmp", "tmpdir");
  mkdirSync(tempRoot, { recursive: true });
  const repo = createTempGitRepository({
    root: tempRoot,
    label: "commit",
    environment: process.env,
    seedFiles: options.seedFiles ?? { "README.md": "# fixture\n" },
  });
  const changeDirectory = join(repo.root, COMMIT_CHANGE_DIRECTORY);
  mkdirSync(changeDirectory, { recursive: true });
  const planText = options.omitPlan ? undefined : (options.planYaml ?? COMMIT_PLAN_YAML);
  if (planText !== undefined) {
    writeIfPresent(repo.root, `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-plan.yaml`, planText);
  }
  writeIfPresent(
    repo.root,
    `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-pm-notes.yaml`,
    options.notesYaml ?? COMMIT_NOTES_YAML,
  );
  // The change artifacts are committed so they are tracked and clean: the
  // commit staging set must see authored work, never the fixture's own docs.
  repo.run(["add", "-A", "--", "doc"]);
  repo.run(["commit", "--no-verify", "--no-gpg-sign", "-m", "docs: seed change artifacts"]);

  const stateRoot = join(repo.root, "state");
  const identity = makeIdentity(stateRoot, { workspaceId: "commit-fixture" });
  const store = openStore(identity).store;
  const clock = makeHarnessClock();
  const coreTransport = createScriptedTransport();
  const harnessTransport = createScriptedTransport();
  const safety = createSafetyScanner();
  const commitlint = createScriptedCommitlint();
  const availability = transportAvailability({
    harnessOneShot: { available: false },
    ...(options.availability ?? {}),
  });
  let sessionFacts: CommitSessionFacts = {
    insideDeliverySession: false,
    ...(options.sessionFacts ?? {}),
  };
  let fenceCounter = 0;
  const newFenceToken = (): string => {
    fenceCounter += 1;
    return `commit-writer-${fenceCounter}`;
  };

  const git = createGitCommitSeam({ cwd: repo.root });
  const faults: CommitHarnessFaults = {
    commitObject: false,
    ledgerAppend: false,
    telemetryAppend: false,
  };
  const gitWithFaults = {
    ...git,
    commit: async (message: Parameters<typeof git.commit>[0]) =>
      faults.commitObject
        ? { ok: false as const, detail: "injected commit-object failure" }
        : git.commit(message),
  };
  const commitStore: StateStorePort = {
    ...store,
    append: (handle, request) =>
      request.kind === "commit.telemetry" && faults.telemetryAppend
        ? {
            ok: false,
            error: {
              kind: "state",
              code: "state.write.failed",
              consequence: "not_landed",
              location: { path: "injected-telemetry" },
            },
          }
        : store.append(handle, request),
  };
  const facts = {
    readPmNotes: (changeRef: string) => {
      const file = join(changeDirectory, `chg-${changeRef}-pm-notes.yaml`);
      try {
        return { ok: true as const, file, text: readFileSync(file, "utf8"), value: undefined };
      } catch {
        return { ok: false as const, reason: "missing" as const };
      }
    },
    stageEntry: (
      text: string,
      edit: {
        readonly phaseId: string;
        readonly operation: "complete" | "reopen";
        readonly timestamp: string;
      },
    ) => stagePmNotesPhaseEntry(text, edit),
    readRegistry: (changeRef: string) => {
      const read = readChangeTransitionsTolerant(store, changeRef);
      if (!read.ok) return { ok: false as const, error: read.error };
      return {
        ok: true as const,
        verifiedEmpty: read.value.verifiedEmpty,
        transitions: read.value.transitions,
        evidence: read.value.evidence,
      };
    },
    appendTransition: (request: Parameters<typeof appendPhaseTransition>[1]) =>
      faults.ledgerAppend
        ? {
            ok: false as const,
            error: {
              kind: "state" as const,
              code: "state.write.failed" as const,
              consequence: "not_landed" as const,
              location: { path: "injected-ledger" },
            },
          }
        : appendPhaseTransition(store, request),
    replaceProjection: (request: Parameters<typeof replacePhaseProjection>[1]) =>
      replacePhaseProjection(store, request),
    writePmNotes: (file: string, text: string) => {
      try {
        writeFileSync(file, text);
        return { ok: true as const };
      } catch {
        return { ok: false as const, message: `failed to write ${file}` };
      }
    },
    nowIso: () => clock.nextIso(),
    newFenceToken,
    sessionFacts: () => sessionFacts,
  };
  const extension = createPhaseCommitExtension({
    store: commitStore,
    changesDirectory: join(repo.root, "doc", "changes"),
    fs: nodePmNotesFileSystemFacts(),
    git: gitWithFaults,
    safety: { scan: safety.scan },
    commitlint,
    transports: { coreInference: coreTransport, harnessOneShot: harnessTransport },
    availability,
    sessionFacts: () => sessionFacts,
    phaseCommit: options.phaseCommit ?? true,
    nowIso: () => clock.nextIso(),
    newFenceToken,
  });
  const phaseRuntimeWithCommit = { ...facts, commit: extension };
  const phaseAtomicDefinition = createPhaseCommandDefinition(phaseRuntimeWithCommit);
  const commitDefinition = createCommitCommandDefinition(
    createCommitCommandRuntime(
      {
        store: commitStore,
        changesDirectory: join(repo.root, "doc", "changes"),
        fs: nodePmNotesFileSystemFacts(),
        git: gitWithFaults,
        safety: { scan: safety.scan },
        commitlint,
        transports: { coreInference: coreTransport, harnessOneShot: harnessTransport },
        availability,
        sessionFacts: () => sessionFacts,
        phaseCommit: options.phaseCommit ?? true,
        nowIso: () => clock.nextIso(),
        newFenceToken,
        ...(options.resolvedRef === undefined
          ? { resolveRef: async () => ({ ref: COMMIT_REF, refSource: "branch" as const }) }
          : options.resolvedRef === null
            ? { resolveRef: async () => undefined }
            : { resolveRef: async () => options.resolvedRef ?? undefined }),
      },
      { runtime: phaseRuntimeWithCommit, extension },
    ),
  );

  const runDefinition = async (
    definition: CommandDefinition,
    command: string,
    args: readonly string[],
    runOptions: { readonly json?: boolean } = {},
  ): Promise<CommitRun> => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const deps: CliDependencies = {
      brand: SYNTHETIC_BRAND,
      clock: { now: () => clock.nowMs() },
      newRunId: () => "run-commit-fixture",
      secrets: [],
      program: { commands: { [command]: definition } },
    };
    const argv = runOptions.json === false ? [command, ...args] : ["--json", command, ...args];
    const exitCode = await runCli(argv, { stdout, stderr }, deps);
    const text = stdout.value.trim();
    const envelope = text.length === 0 ? undefined : (JSON.parse(text) as Record<string, unknown>);
    return {
      exitCode,
      stdout: stdout.value,
      stderr: stderr.value,
      ...(envelope === undefined ? {} : { envelope }),
    };
  };

  const planPhase = (): Record<string, unknown> | undefined => {
    if (planText === undefined) return undefined;
    const parsed = parseConfigYaml(planText, "project-committed", "plan.yaml");
    if (!parsed.ok) return undefined;
    const phases = parsed.facts.values.phases;
    if (!Array.isArray(phases)) return undefined;
    const first = phases[0];
    return typeof first === "object" && first !== null && !Array.isArray(first)
      ? (first as Record<string, unknown>)
      : undefined;
  };

  const allLedgerRecords = (): Record<string, unknown>[] => {
    const path = ledgerPath(identity);
    try {
      return recordsOf(ledgerLines(readFileSync(path, "utf8")));
    } catch {
      return [];
    }
  };

  return {
    root: repo.root,
    repo,
    changeDirectory,
    stateRoot,
    identity,
    store,
    clock,
    coreTransport,
    harnessTransport,
    safety,
    commitlint,
    get sessionFacts() {
      return sessionFacts;
    },
    set sessionFacts(value: CommitSessionFacts) {
      sessionFacts = value;
    },
    availability,
    faults,
    phaseDefinition: phaseAtomicDefinition,
    commitDefinition,
    runPhase: (args, runOptions) => runDefinition(phaseAtomicDefinition, "phase", args, runOptions),
    runCommit: (args, runOptions) => runDefinition(commitDefinition, "commit", args, runOptions),
    runDefinition,
    transitionPayloads: () =>
      allLedgerRecords()
        .filter((record) => record.kind === "phase.transition")
        .map((record) => (record.payload as Record<string, unknown>) ?? {}),
    telemetryPayloads: () =>
      allLedgerRecords()
        .filter((record) => record.kind === "commit.telemetry")
        .map((record) => (record.payload as Record<string, unknown>) ?? {}),
    targetText: () =>
      readFileSync(join(changeDirectory, `chg-${COMMIT_REF}-pm-notes.yaml`), "utf8"),
    projectionContent: () => {
      const key = `document:phase-state.${COMMIT_REF}.json`;
      const read = store.read({ requiredKeys: [key] });
      return read.ok ? read.value.values[key] : undefined;
    },
    planText: () => planText,
    planPhase,
    cleanup: () => {
      repo.cleanup();
      removeRoot(join(repo.root, "state"));
    },
  };
};

/** Run a body with a fresh harness and always clean up. */
export const withCommitHarness = async (
  body: (harness: CommitHarness) => Promise<void> | void,
  options: CommitHarnessOptions = {},
): Promise<void> => {
  const harness = createCommitHarness(options);
  try {
    await body(harness);
  } finally {
    harness.cleanup();
  }
};
