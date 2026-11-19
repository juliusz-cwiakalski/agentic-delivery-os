/**
 * Driver D1 for the operator surface (GH-354 test plan §5, §6.1).
 *
 * One composed PRODUCTION program per run — `createProductionComposer` over a
 * temporary checkout and its derived state root — with the four operator facts
 * this change adds injected the same way the delivered seams are: the advisory
 * owner probe, the artifact-family root and its filesystem edge, the transcript
 * read, and the fixed clock. Nothing is reimplemented here: the queries the
 * cases drive are the production read functions mounted at the same CLI edge
 * that mounts `attempts`/`lease`/`existence`.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createNodeDispatchLogFileSystem } from "../../../../packages/adapters/src/file/dispatch-logs";
import { createOpencodeSession } from "../../../../packages/adapters/src/harness/opencode";
import { readDispatchLanes } from "../../../../packages/core/src/app/dispatch-ledger";
import { createDispatchLogSink } from "../../../../packages/core/src/app/dispatch-log-sink";
import type {
  DispatchLaneRecord,
  DispatchLogFileSystem,
  DispatchOwnerProbe,
  HarnessSessionPort,
  StateRecord,
  StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import {
  assembleHarnessLiveness,
  classifyHarnessEvidence,
} from "../../../../packages/core/src/domain/index";
import { countStore, type StoreCounters } from "../attempts-harness";
import { createParityHarness, PARITY_REPOSITORY } from "../parity/harness";
import type { GuardedRunner } from "../parity/process-runner";
import {
  type LaneSeed,
  seedDaemonLane,
  seedDispatchLane,
  seedDispatchLaneSequence,
  seedForeignRepositoryLane,
} from "../parity/lane";
import { createScriptedStreams, type ScriptedStream, type StreamsFixture } from "./streams";

/** The reference every operator case addresses unless it says otherwise. */
export const OPERATOR_REF = "GH-354";
export const OPERATOR_REPOSITORY = PARITY_REPOSITORY;

/** The delivered envelope, read from the command's own stdout. */
export type OperatorEnvelope = {
  readonly schemaVersion?: string;
  readonly runId?: string;
  readonly exitCode?: number;
  readonly timing?: { readonly totalMs: number };
  readonly data?: unknown;
  readonly error?: {
    readonly code: string;
    readonly category: string;
    readonly retryable: boolean;
    readonly consequence: string;
    readonly remediationHint: string;
    readonly summary?: string;
  };
};

export type OperatorResult = {
  readonly exit: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly envelope?: OperatorEnvelope;
  /** The envelope's `data`, when the answer succeeded. */
  readonly data?: unknown;
  /** The envelope's error code, when it refused. */
  readonly errorCode?: string;
};

export type OperatorCounters = StoreCounters;

export type OperatorHarnessOptions = {
  readonly label?: string;
  readonly ref?: string;
  readonly extraRefs?: readonly string[];
  /** The advisory owner probe; the default reports `live` for every owner. */
  readonly probe?: DispatchOwnerProbe;
  /** The registered credential values the run's envelope is redacted with. */
  readonly secrets?: readonly string[];
  /** The artifact-family root; defaults to `<state>/dispatch-logs.<workspace>`. */
  readonly artifactRoot?: string;
  /** The artifact-family filesystem edge; absent means the family is unreadable. */
  readonly artifactFs?: DispatchLogFileSystem;
  /** A store wrapper around the counted store (the read-failure rows). */
  readonly wrap?: (store: StateStorePort) => StateStorePort;
  /** A shared guarded runner (the scripted session's stdout is injected there). */
  readonly guarded?: GuardedRunner;
};

export type OperatorHarness = {
  readonly ref: string;
  readonly repository: string;
  readonly checkout: string;
  readonly home: string;
  readonly stateDirectory: string;
  readonly artifactRoot: string;
  readonly store: StateStorePort;
  readonly counters: OperatorCounters;
  readonly clock: { readonly nowIso: () => string };
  readonly run: (argv: readonly string[]) => Promise<OperatorResult>;
  readonly seedLane: (seed: LaneSeed) => DispatchLaneRecord;
  readonly seedLanes: (seeds: readonly LaneSeed[]) => readonly DispatchLaneRecord[];
  readonly seedForeignLane: (seed: LaneSeed, repository?: string) => DispatchLaneRecord;
  readonly seedDaemon: (seed: {
    readonly ref: string;
    readonly state: "delivering" | "detached" | "preempted" | "completed";
    readonly sessionId?: string;
  }) => void;
  readonly lanes: () => readonly DispatchLaneRecord[];
  readonly records: () => readonly StateRecord[];
  /** The ledger file's bytes (the read-only posture's byte comparison). */
  readonly ledgerBytes: () => string;
  readonly dispose: () => void;
};

const countTarget = (): {
  readRecords: number;
  append: number;
  acquireFence: number;
  releaseFence: number;
  replaceDocument: number;
} => ({
  readRecords: 0,
  append: 0,
  acquireFence: 0,
  releaseFence: 0,
  replaceDocument: 0,
});

/** One recorded artifact-family operation, with its absolute path. */
export type LogFsRecord = {
  readonly op:
    | "ensureDirectory"
    | "create"
    | "append"
    | "remove"
    | "list"
    | "read"
    | "size"
    | "mode";
  readonly path: string;
  readonly text?: string;
};

/** One refused operation: a path outside the addressed family root. */
export type LogFsViolation = { readonly op: string; readonly path: string };

export type RecordingLogFs = {
  readonly fs: DispatchLogFileSystem;
  readonly records: LogFsRecord[];
  readonly violations: LogFsViolation[];
  /** The exact order of creates and removes (the retention-order proof). */
  readonly mutations: readonly { readonly op: "create" | "remove"; readonly path: string }[];
  readonly clear: () => void;
};

/**
 * A recording filesystem edge over the real node edge (GH-354 §6.2).
 *
 * Every listing, stat, open, read, create, append, and remove is recorded with
 * an absolute path; any path outside the addressed family root is REFUSED by
 * name rather than performed, so "only the addressed directory is listed",
 * "0 deletions" and "0 in-place modification" are measurements.
 */
export const createRecordingLogFs = (options: {
  readonly familyRoot: string;
  readonly inner?: DispatchLogFileSystem;
  /** Fail the listed operation on a path containing this fragment. */
  readonly fail?: {
    readonly op: "create" | "append" | "remove" | "read" | "list" | "exists";
    readonly path: string;
  };
  /** Serve this text on read regardless of the file's bytes (in-flight append). */
  readonly readOverride?: (path: string) => string | undefined;
  /**
   * Kill the writer mid-value: on the Nth append to the named path, write only
   * the first half of the text and refuse the rest, so the file ends mid-line.
   */
  readonly truncateAppend?: { readonly path: string; readonly at: number };
}): RecordingLogFs => {
  const inner = options.inner ?? createNodeDispatchLogFileSystem();
  const records: LogFsRecord[] = [];
  const violations: LogFsViolation[] = [];
  const mutations: { readonly op: "create" | "remove"; readonly path: string }[] = [];
  const appendCounts = new Map<string, number>();
  const root = options.familyRoot;

  const allowed = (path: string): boolean => path === root || path.startsWith(`${root}/`);
  const refuse = (op: string, path: string): boolean => {
    violations.push({ op, path });
    return false;
  };
  const fails = (op: string, path: string): boolean =>
    options.fail !== undefined && options.fail.op === op && path.includes(options.fail.path);

  return {
    fs: {
      ensureDirectory: (directory) => {
        records.push({ op: "ensureDirectory", path: directory });
        if (!allowed(directory)) return refuse("ensureDirectory", directory);
        return inner.ensureDirectory(directory);
      },
      create: (path) => {
        records.push({ op: "create", path });
        if (!allowed(path)) return refuse("create", path);
        if (fails("create", path)) return false;
        const created = inner.create(path);
        if (created) mutations.push({ op: "create", path });
        return created;
      },
      append: (path, text) => {
        records.push({ op: "append", path, text });
        if (!allowed(path)) return refuse("append", path);
        if (fails("append", path)) return false;
        const truncation = options.truncateAppend;
        if (truncation !== undefined && path.includes(truncation.path)) {
          appendCounts.set(path, (appendCounts.get(path) ?? 0) + 1);
          if (appendCounts.get(path) === truncation.at) {
            const half = text.slice(0, Math.floor(text.length / 2));
            inner.append(path, half);
            return false;
          }
        }
        return inner.append(path, text);
      },
      remove: (path) => {
        records.push({ op: "remove", path });
        if (!allowed(path)) return refuse("remove", path);
        if (fails("remove", path)) return false;
        const removed = inner.remove(path);
        if (removed) mutations.push({ op: "remove", path });
        return removed;
      },
      size: (path) => {
        records.push({ op: "size", path });
        if (!allowed(path)) {
          refuse("size", path);
          return undefined;
        }
        return inner.size(path);
      },
      mode: (path) => {
        records.push({ op: "mode", path });
        if (!allowed(path)) {
          refuse("mode", path);
          return undefined;
        }
        return inner.mode(path);
      },
      list: (directory) => {
        records.push({ op: "list", path: directory });
        if (!allowed(directory)) {
          refuse("list", directory);
          return undefined;
        }
        if (fails("list", directory)) return undefined;
        return inner.list(directory);
      },
      exists: (path) => {
        records.push({ op: "exists", path });
        if (!allowed(path)) {
          refuse("exists", path);
          return false;
        }
        if (fails("exists", path)) return false;
        return inner.exists(path);
      },
      read: (path) => {
        records.push({ op: "read", path });
        if (!allowed(path)) {
          refuse("read", path);
          return undefined;
        }
        const override = options.readOverride?.(path);
        if (override !== undefined) return override;
        if (fails("read", path)) return undefined;
        return inner.read(path);
      },
    },
    records,
    violations,
    mutations,
    clear: () => {
      records.length = 0;
      violations.length = 0;
      mutations.length = 0;
    },
  };
};

export const createOperatorHarness = (options: OperatorHarnessOptions = {}): OperatorHarness => {
  const label = options.label ?? "operator";
  // The approved repository-local base; `mkdtemp` never escapes the repo.
  const base = join(process.cwd(), "tmp", "tmpdir");
  mkdirSync(base, { recursive: true });
  let counters = countTarget();
  const probe: DispatchOwnerProbe = options.probe ?? (() => "live");
  const parity = createParityHarness({
    label,
    ref: options.ref ?? OPERATOR_REF,
    ...(options.extraRefs === undefined ? {} : { extraRefs: options.extraRefs }),
    ownerProbe: probe,
    ...(options.secrets === undefined ? {} : { secrets: options.secrets }),
    ...(options.artifactRoot === undefined ? {} : { artifactRoot: options.artifactRoot }),
    ...(options.artifactFs === undefined ? {} : { artifactFs: options.artifactFs }),
    ...(options.guarded === undefined ? {} : { guarded: options.guarded }),
    storeWrap: (opened) => {
      const counted = countStore(opened);
      counters = counted.counters as OperatorCounters;
      const wrapped = options.wrap === undefined ? counted.store : options.wrap(counted.store);
      return wrapped;
    },
  });
  const artifactRoot = options.artifactRoot ?? join(parity.stateDirectory, "dispatch-logs.default");
  const repository = OPERATOR_REPOSITORY;

  const run = async (argv: readonly string[]): Promise<OperatorResult> => {
    const result = await parity.run(argv);
    const trimmed = result.stdout.trim();
    const envelope =
      trimmed.startsWith("{") && trimmed.endsWith("}")
        ? (JSON.parse(trimmed) as OperatorEnvelope)
        : undefined;
    return {
      exit: result.exit,
      stdout: result.stdout,
      stderr: result.stderr,
      ...(envelope === undefined ? {} : { envelope }),
      ...(envelope?.data === undefined ? {} : { data: envelope.data }),
      ...(envelope?.error === undefined ? {} : { errorCode: envelope.error.code }),
    };
  };

  return {
    ref: options.ref ?? OPERATOR_REF,
    repository,
    checkout: parity.checkout,
    home: parity.home,
    stateDirectory: parity.stateDirectory,
    artifactRoot,
    store: parity.store,
    get counters() {
      return counters;
    },
    clock: { nowIso: parity.clock.nowIso },
    run,
    seedLane: (seed) => seedDispatchLane(parity.store, { repository, ...seed }),
    seedLanes: (seeds) =>
      seedDispatchLaneSequence(
        parity.store,
        seeds.map((seed) => ({ repository, ...seed })),
      ),
    seedForeignLane: (seed, foreignRepository) =>
      seedForeignRepositoryLane(parity.store, { repository, ...seed }, foreignRepository),
    seedDaemon: (seed) => seedDaemonLane(parity.store, seed),
    lanes: () => {
      const read = readDispatchLanes(parity.store);
      if (!read.ok) throw new Error(`lane read failed: ${read.code}`);
      return read.records;
    },
    records: () => {
      const read = parity.store.readRecords();
      if (!read.ok) throw new Error(`store read failed: ${read.error.code}`);
      return read.value.records;
    },
    ledgerBytes: () => {
      const name = readdirSync(parity.stateDirectory).find(
        (entry) => entry.startsWith("ledger.") && entry.endsWith(".jsonl"),
      );
      if (name === undefined) throw new Error("the state ledger file was not found");
      return readFileSync(join(parity.stateDirectory, name), "utf8");
    },
    dispose: () => parity.dispose(),
  };
};

/* ------------------------------------------------------------------------- */
/* S1 — the real opencode adapter over the scripted streaming starter.        */
/* ------------------------------------------------------------------------- */

export type ArtifactObservationOptions = {
  readonly label?: string;
  readonly ref?: string;
  readonly scripts: readonly ScriptedStream[];
  readonly artifactFs?: DispatchLogFileSystem;
  /** Build the edge once the family root is known (recording/fault variants). */
  readonly wrapFs?: (familyRoot: string) => DispatchLogFileSystem;
  readonly now?: string;
  /** Called at each stream's first pull (the creation-order probe). */
  readonly onFirstPull?: (invocation: {
    readonly index: number;
    readonly args: readonly string[];
  }) => void;
};

export type ArtifactObservation = {
  readonly ref: string;
  readonly familyRoot: string;
  readonly directory: string;
  readonly session: HarnessSessionPort;
  readonly streams: StreamsFixture;
  readonly logFs: RecordingLogFs;
  /** The family listing at each stream's first pull (the creation-order proof). */
  readonly firstPullListings: readonly (readonly string[])[];
  /** The real directory's file names in lexical order. */
  readonly fileNames: () => readonly string[];
  readonly fileText: (name: string) => string;
  readonly fileMode: (name: string) => number | undefined;
  readonly dispose: () => void;
};

/**
 * Compose the real adapter, the real sink orchestration, and a recording
 * filesystem edge over one temporary family root.
 */
export const createArtifactObservation = (
  options: ArtifactObservationOptions,
): ArtifactObservation => {
  const label = options.label ?? "artifact";
  const ref = options.ref ?? OPERATOR_REF;
  const base = join(process.cwd(), "tmp", "tmpdir");
  mkdirSync(base, { recursive: true });
  const root = join(base, `gh354-${label}-${Math.abs(hashOf(label + ref))}`);
  mkdirSync(root, { recursive: true });
  const familyRoot = join(root, "dispatch-logs.default");
  const directory = join(familyRoot, ref);
  const nodeFs = createNodeDispatchLogFileSystem();
  const listNames = (): readonly string[] =>
    (nodeFs.list(directory) ?? [])
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, "en"));
  const firstPullListings: string[][] = [];
  const logFs = createRecordingLogFs({
    familyRoot,
    inner: options.wrapFs?.(familyRoot) ?? options.artifactFs ?? createNodeDispatchLogFileSystem(),
  });
  const streams = createScriptedStreams({
    scripts: options.scripts,
    onFirstPull: (invocation) => {
      firstPullListings.push([...listNames()]);
      options.onFirstPull?.(invocation);
    },
  });
  const session = createOpencodeSession({
    command: "synthetic-opencode",
    runner: async () => ({ stdout: "", stderr: "", status: 0, timedOut: false }),
    starter: streams.starter,
    buildEnvironment: () => ({ ok: true, value: {} }),
    classify: classifyHarnessEvidence,
    assembleLiveness: assembleHarnessLiveness,
    now: () => options.now ?? "2026-11-19T00:00:00.000Z",
    handleTimeoutMs: 50,
    streamSinkFor: (context) =>
      createDispatchLogSink({
        context: {
          ref: context.workItemRef,
          familyRoot,
          recordedAt: context.recordedAt,
          streamKind: context.streamKind,
          ...(context.attemptId === undefined ? {} : { attemptId: context.attemptId }),
          ...(context.iterationOrdinal === undefined
            ? {}
            : { iterationOrdinal: context.iterationOrdinal }),
        },
        fs: logFs.fs,
      }),
  });
  return {
    ref,
    familyRoot,
    directory,
    session,
    streams,
    logFs,
    firstPullListings,
    fileNames: listNames,
    fileText: (name) => readFileSync(join(directory, name), "utf8"),
    fileMode: (name) => nodeFs.mode(join(directory, name)),
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** A deterministic, dependency-free label hash (never a random value). */
const hashOf = (value: string): number => {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + (character.codePointAt(0) ?? 0)) | 0;
  return hash;
};
