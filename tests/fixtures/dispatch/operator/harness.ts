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
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readDispatchLanes } from "../../../../packages/core/src/app/dispatch-ledger";
import type {
  DispatchLaneRecord,
  DispatchLogFileSystem,
  DispatchOwnerProbe,
  StateRecord,
  StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import { countStore, type StoreCounters } from "../attempts-harness";
import { createParityHarness, PARITY_REPOSITORY } from "../parity/harness";
import {
  type LaneSeed,
  seedDaemonLane,
  seedDispatchLane,
  seedDispatchLaneSequence,
  seedForeignRepositoryLane,
} from "../parity/lane";

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
