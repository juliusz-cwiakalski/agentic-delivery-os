/**
 * Shared verify fixtures and recording seams (test-plan §4.1/§4.2).
 *
 * Phase 2 (this file): committed fixture readers, temp change-tree materialisers,
 * a recording state-store wrapper that forbids mutation, and real-history
 * builders over the state harness. The in-process CLI runner is added with the
 * command in Phase 3 so the pure suites never depend on a command module.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import type {
  PhaseTransitionOperation,
  StateJsonValue,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  appendPhaseTransition,
  foldPhaseState,
  phaseStateDocumentName,
} from "../../packages/core/src/state/index";
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

export const ROOT = process.cwd();
export const VERIFY_REF = "GH-177";
export const FIXTURE_ROOT = "tests/fixtures/verify/classification";

export type VerifyCallRecorder = {
  readonly calls: string[];
};

export const createVerifyRecorder = (): VerifyCallRecorder => ({ calls: [] });

export const readFixture = (relative: string): string =>
  readFileSync(join(ROOT, FIXTURE_ROOT, relative), "utf8");

export const parseFixture = (relative: string): unknown => parse(readFixture(relative));

export const fullBase = (): Record<string, unknown> =>
  parseFixture("full/base-complete.yaml") as Record<string, unknown>;

export const fullReversed = (): Record<string, unknown> =>
  parseFixture("full/reversed-complete.yaml") as Record<string, unknown>;

export const liteCompleteAbsent = (): Record<string, unknown> =>
  parseFixture("lite/complete-absent.yaml") as Record<string, unknown>;

export const liteCompleteNull = (): Record<string, unknown> =>
  parseFixture("lite/complete-null.yaml") as Record<string, unknown>;

export const liteWrongTyped = (): Record<string, unknown> =>
  parseFixture("lite/wrong-typed-non-lite.yaml") as Record<string, unknown>;

export const partialA = (): Record<string, unknown> =>
  parseFixture("partial-identities/A-declared-incomplete.yaml") as Record<string, unknown>;

export const partialB = (): Record<string, unknown> =>
  parseFixture("partial-identities/B-key-absent.yaml") as Record<string, unknown>;

export const partialC = (): Record<string, unknown> =>
  parseFixture("partial-identities/C-mixed.yaml") as Record<string, unknown>;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const phaseMapOf = (document: Record<string, unknown>): Record<string, unknown> => {
  const phases = document.phases;
  if (typeof phases !== "object" || phases === null || Array.isArray(phases)) {
    throw new Error("fixture has no phases map");
  }
  return phases as Record<string, unknown>;
};

const entryOf = (document: Record<string, unknown>, phaseId: string): Record<string, unknown> => {
  const entry = phaseMapOf(document)[phaseId];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(`fixture has no entry for ${phaseId}`);
  }
  return entry as Record<string, unknown>;
};

/** Derive a single-missing fixture and assert the mutation is present. */
export const withOpenPhase = (
  phaseId: string,
  base: Record<string, unknown> = fullBase(),
): Record<string, unknown> => {
  const document = clone(base);
  const entry = entryOf(document, phaseId);
  entry.completed = null;
  if (entry.completed !== null) throw new Error(`failed to open ${phaseId}`);
  return document;
};

/** Restore a single phase completion and assert the mutation is present. */
export const withCompletedPhase = (
  phaseId: string,
  base: Record<string, unknown>,
  timestamp = "2026-10-31T00:30:00Z",
): Record<string, unknown> => {
  const document = clone(base);
  const phases = phaseMapOf(document);
  const existing = phases[phaseId];
  phases[phaseId] =
    typeof existing === "object" && existing !== null && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>), completed: timestamp }
      : { started: timestamp, completed: timestamp };
  const entry = entryOf(document, phaseId);
  if (entry.completed !== timestamp) throw new Error(`failed to complete ${phaseId}`);
  return document;
};

/** Remove a required phase key and assert the omission is present. */
export const withoutPhaseKey = (
  phaseId: string,
  base: Record<string, unknown> = fullBase(),
): Record<string, unknown> => {
  const document = clone(base);
  const phases = phaseMapOf(document);
  delete phases[phaseId];
  if (Object.hasOwn(phases, phaseId)) throw new Error(`failed to remove ${phaseId}`);
  return document;
};

/**
 * A state store wrapper that records reads and forbids (or records) mutation.
 * `throwOnMutation` is true for verify runs; false for the mutating control.
 */
export type GuardedStore = {
  readonly store: StateStorePort;
  readonly recorder: VerifyCallRecorder;
};

export const guardStore = (
  inner: StateStorePort,
  recorder: VerifyCallRecorder,
  options: { readonly throwOnMutation?: boolean } = {},
): GuardedStore => {
  const throwOnMutation = options.throwOnMutation ?? true;
  const mutation = (name: string): never | void => {
    recorder.calls.push(name);
    if (throwOnMutation) throw new Error(`verify attempted a forbidden ${name} call`);
  };
  const store: StateStorePort = {
    identity: inner.identity,
    read: (request) => {
      recorder.calls.push("read");
      return inner.read(request);
    },
    readRecords: () => {
      recorder.calls.push("readRecords");
      return inner.readRecords();
    },
    append: (handle, request) => {
      mutation("append");
      return inner.append(handle, request);
    },
    replaceDocument: (handle, request) => {
      mutation("replaceDocument");
      return inner.replaceDocument(handle, request);
    },
    acquireFence: (token) => {
      mutation("acquireFence");
      return inner.acquireFence(token);
    },
    releaseFence: (handle) => {
      mutation("releaseFence");
      return inner.releaseFence(handle);
    },
    fenceStatus: () => {
      recorder.calls.push("fenceStatus");
      return inner.fenceStatus();
    },
    recoverFence: (token) => {
      mutation("recoverFence");
      return inner.recoverFence(token);
    },
    checkIntegrity: () => {
      recorder.calls.push("checkIntegrity");
      return inner.checkIntegrity();
    },
    repairTornTail: () => {
      mutation("repairTornTail");
      return inner.repairTornTail();
    },
  };
  return { store, recorder };
};

export type VerifyState = {
  readonly root: string;
  readonly identity: ReturnType<typeof makeIdentity>;
  readonly store: StateStorePort;
  cleanup(): void;
};

export const createVerifyState = (
  options: { readonly omitStore?: boolean; readonly workspaceId?: string } = {},
): VerifyState => {
  const root = makeTempRoot("gh177-verify-state");
  const stateRoot = options.omitStore === true ? join(root, "absent-state") : root;
  const identity = makeIdentity(stateRoot, {
    workspaceId: options.workspaceId ?? "verify-fixture",
  });
  const { store } = openStore(identity);
  return { root, identity, store, cleanup: () => removeRoot(root) };
};

/** Append one real `phase.transition` landing with a fresh fence token. */
export const appendLanding = (
  state: VerifyState,
  phaseId: string,
  operation: PhaseTransitionOperation,
  timestamp: string,
  reason?: string,
): void => {
  const outcome = appendPhaseTransition(state.store, {
    changeRef: VERIFY_REF,
    phaseId,
    operation,
    timestamp,
    fenceToken: `verify-writer-${phaseId}-${operation}-${timestamp}`,
    ...(reason === undefined ? {} : { reason }),
  });
  if (!outcome.ok) throw new Error(`append failed: ${outcome.error.code}`);
};

export const appendLandingForRef = (
  state: VerifyState,
  changeRef: string,
  phaseId: string,
  operation: PhaseTransitionOperation,
  timestamp: string,
): void => {
  const outcome = appendPhaseTransition(state.store, {
    changeRef,
    phaseId,
    operation,
    timestamp,
    fenceToken: `verify-writer-${changeRef}-${phaseId}-${timestamp}`,
  });
  if (!outcome.ok) throw new Error(`append failed: ${outcome.error.code}`);
};

/** Write an arbitrary derived projection document (never evidence for verify). */
export const writeProjectionDocument = (
  state: VerifyState,
  changeRef: string,
  phases: Record<string, { started: string | null; completed: string | null }>,
): void => {
  const acquired = state.store.acquireFence(`projection-${changeRef}`);
  if (!acquired.ok) throw new Error(`fence failed: ${acquired.error.code}`);
  try {
    const replaced = state.store.replaceDocument(acquired.value.handle, {
      name: phaseStateDocumentName(changeRef),
      content: {
        schemaVersion: "delivery.registry.v1",
        changeRef,
        phases,
      },
    });
    if (!replaced.ok) throw new Error(`projection write failed: ${replaced.error.code}`);
  } finally {
    state.store.releaseFence(acquired.value.handle);
  }
};

export const foldedProjection = (
  state: VerifyState,
  changeRef: string,
): Record<string, unknown> => {
  const read = state.store.read({ requiredKeys: [] });
  if (!read.ok) throw new Error(read.error.code);
  const key = `document:${phaseStateDocumentName(changeRef)}`;
  const projection = read.value.values[key];
  return typeof projection === "object" && projection !== null
    ? (projection as Record<string, unknown>)
    : {};
};

/** Fold the same history through the production fold for oracle comparisons. */
export const foldedState = (
  transitions: readonly {
    readonly changeRef: string;
    readonly phaseId: string;
    readonly operation: PhaseTransitionOperation;
    readonly timestamp: string;
    readonly outcome: "landed";
  }[],
): ReturnType<typeof foldPhaseState> => foldPhaseState(VERIFY_REF, transitions);

/** A fresh temp change tree holding one materialised pm-notes target. */
export type MaterializedTarget = {
  readonly root: string;
  readonly changesDirectory: string;
  readonly file: string;
};

export const materializeTarget = (
  text: string,
  label = "gh177-verify-target",
): MaterializedTarget => {
  const root = mkdtempSync(join(tmpdir(), `${label}-`));
  const changesDirectory = join(root, "doc/changes");
  const directory = join(changesDirectory, "2026-10", `2026-10-31--${VERIFY_REF}--fixture`);
  mkdirSync(directory, { recursive: true });
  const file = join(directory, `chg-${VERIFY_REF}-pm-notes.yaml`);
  writeFileSync(file, text);
  return { root, changesDirectory, file };
};

export const removeMaterialized = (target: MaterializedTarget): void =>
  rmSync(target.root, { recursive: true, force: true });

/** A changes directory with no target for the ref. */
export const materializeAbsentTarget = (): { root: string; changesDirectory: string } => {
  const root = mkdtempSync(join(tmpdir(), "gh177-verify-absent-"));
  const changesDirectory = join(root, "doc/changes");
  mkdirSync(changesDirectory, { recursive: true });
  return { root, changesDirectory };
};

export const ledgerFile = (identity: ReturnType<typeof makeIdentity>): string =>
  ledgerPath(identity);

export { createVerifyState as createState };

import { readPmNotesText } from "../../packages/adapters/src/file";
import {
  createVerifyCommandDefinition,
  type VerifyCommandRuntime,
} from "../../packages/cli/src/commands/verify";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { readChangeTransitionsTolerant } from "../../packages/core/src/state/index";
import { checksumOfPayload } from "../../packages/core/src/state/ledger";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

export type VerifyRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: Record<string, unknown>;
};

export type VerifyHarnessOptions = {
  readonly changesDirectory?: string;
  readonly targetText?: string;
  readonly omitTarget?: boolean;
  readonly state?: VerifyState;
  readonly recorder?: VerifyCallRecorder;
  readonly throwOnMutation?: boolean;
  readonly runId?: string;
  readonly ticks?: readonly [number, number];
};

export type VerifyHarness = {
  readonly changesDirectory: string;
  readonly state: VerifyState;
  readonly recorder: VerifyCallRecorder;
  readonly runtime: VerifyCommandRuntime;
  run(args: readonly string[], options?: { readonly json?: boolean }): Promise<VerifyRun>;
  cleanup(): void;
};

/**
 * Build the in-process verify harness: injected brand/clock/run id/streams,
 * recording read seams, and a state store that throws on mutation by default.
 */
export const createVerifyHarness = (options: VerifyHarnessOptions = {}): VerifyHarness => {
  const state = options.state ?? createVerifyState();
  const ownsState = options.state === undefined;
  const recorder = options.recorder ?? createVerifyRecorder();
  let materialized: { root: string; changesDirectory: string } | undefined;
  let changesDirectory = options.changesDirectory;
  if (changesDirectory === undefined) {
    if (options.omitTarget === true) {
      const absent = materializeAbsentTarget();
      materialized = { root: absent.root, changesDirectory: absent.changesDirectory };
    } else {
      const target = materializeTarget(options.targetText ?? "");
      materialized = { root: target.root, changesDirectory: target.changesDirectory };
    }
    changesDirectory = materialized.changesDirectory;
  }
  const directory = changesDirectory;
  const guarded = guardStore(state.store, recorder, {
    throwOnMutation: options.throwOnMutation ?? true,
  });
  const runtime: VerifyCommandRuntime = {
    readPmNotes: (changeRef) => {
      recorder.calls.push("readPmNotes");
      return readPmNotesText({
        changeRef,
        changesDirectory: directory,
        fs: verifyFileSystemFacts,
      });
    },
    readRegistry: (changeRef) => {
      recorder.calls.push("readRegistry");
      const read = readChangeTransitionsTolerant(guarded.store, changeRef);
      if (!read.ok) return { ok: false, error: read.error };
      return {
        ok: true,
        present: read.value.present,
        verifiedEmpty: read.value.verifiedEmpty,
        transitions: read.value.transitions,
        recordCount: read.value.evidence.recordCount,
      };
    },
  };
  const definition = createVerifyCommandDefinition(runtime);
  const run = async (
    args: readonly string[],
    runOptions: { readonly json?: boolean } = {},
  ): Promise<VerifyRun> => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const ticks = options.ticks ?? [100, 100];
    let tick = 0;
    const deps: CliDependencies = {
      brand: SYNTHETIC_BRAND,
      clock: {
        now: () => {
          const value = ticks[Math.min(tick, 1)] as number;
          tick += 1;
          return value;
        },
      },
      newRunId: () => options.runId ?? "run-verify-fixture",
      secrets: [],
      program: { commands: { verify: definition } },
    };
    const argv = runOptions.json === false ? ["verify", ...args] : ["--json", "verify", ...args];
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
  return {
    changesDirectory: directory,
    state,
    recorder,
    runtime,
    run,
    cleanup: () => {
      if (materialized !== undefined) rmSync(materialized.root, { recursive: true, force: true });
      if (ownsState) state.cleanup();
    },
  };
};

const verifyFileSystemFacts = {
  exists: (path: string) => existsSync(path),
  readText: (path: string) => readFileSync(path, "utf8"),
  listDirectory: (path: string) => {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  },
};

export type LedgerRecord = Record<string, unknown>;

export const ledgerRecords = (identity: ReturnType<typeof makeIdentity>): LedgerRecord[] =>
  readFileSync(ledgerPath(identity), "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as LedgerRecord);

export const writeLedgerRecords = (
  identity: ReturnType<typeof makeIdentity>,
  records: readonly LedgerRecord[],
): void => {
  writeFileSync(
    ledgerPath(identity),
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
};

/** Recompute the record checksum after a payload mutation (keeps framing valid). */
export const resealLedgerRecord = (record: LedgerRecord): void => {
  record.checksum = checksumOfPayload(record.payload as StateJsonValue);
};

export const corruptHeaderVersion = (
  identity: ReturnType<typeof makeIdentity>,
  version = "delivery.state.v999",
): void => {
  writeFileSync(
    `${identity.stateDirectory}/header.${encodeURIComponent(identity.workspaceId)}.json`,
    `${JSON.stringify({ schemaVersion: version })}\n`,
  );
};
