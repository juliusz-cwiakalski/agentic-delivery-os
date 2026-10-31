/**
 * GH-180 fake session I/O harness (test-plan §4.1).
 *
 * The fake implements `OpencodeSessionIo` and records an ordered call log. It
 * never spawns a process, opens a database, reads a home directory, or touches
 * the network. Query answers are scripted per call; mutation hooks change the
 * scripted state between calls, never a live store.
 */
import type {
  OpencodeSessionIo,
  SessionFileFacts,
} from "../../../packages/adapters/src/session/index";
import {
  createDbCommandDefinition,
  type DbCommandRuntime,
} from "../../../packages/cli/src/commands/db";
import { createDbCommandRuntime } from "../../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import {
  DB_SCHEMA_VERSION,
  type ListData,
  type PruneData,
  type RebootData,
  type SessionAdminError,
  type SessionListRead,
  type SessionPruneRead,
  type SessionRebootRead,
  type SessionSizeRead,
  type SizeData,
} from "../../../packages/core/src/contracts/index";
import {
  classifyPruneCandidate,
  computeDbCutoffMs,
  computeDbLiveBoundaryMs,
  isLiveDbSession,
  selectPruneCandidates,
} from "../../../packages/core/src/domain/session-admin";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";

/** The pure policy the adapter receives from the composition root. */
export const SESSION_POLICY = {
  isLive: isLiveDbSession,
  cutoff: computeDbCutoffMs,
  liveBoundary: computeDbLiveBoundaryMs,
  classify: classifyPruneCandidate,
  select: selectPruneCandidates,
};

/**
 * The `AS <alias>` column names a single-statement SELECT projects. `CAST(...
 * AS BLOB)` carries a type name, not a column, so it is filtered out.
 */
export const projectionAliases = (sql: string): string[] => {
  const aliases: string[] = [];
  for (const match of sql.matchAll(/\bAS\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) {
    const alias = match[1];
    if (alias !== undefined && alias.toUpperCase() !== "BLOB") aliases.push(alias);
  }
  return aliases;
};

/**
 * Project a full fixture row down to exactly the columns the issued SQL
 * selects. This is the regression guard: if the adapter's re-read projection
 * loses a column, the fake loses it too, and the adapter's parse fails.
 */
export const projectSessionRow = (
  sql: string,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const projected: Record<string, unknown> = {};
  for (const alias of projectionAliases(sql)) {
    if (alias in row) projected[alias] = row[alias];
  }
  return projected;
};

export const NOW_MS = Date.UTC(2026, 9, 31, 12, 0, 0);
export const DAY_MS = 86_400_000;
export const MINUTE_MS = 60_000;
export const LIVE_BOUNDARY = NOW_MS - 15 * MINUTE_MS;
export const SYNTHETIC_DB_PATH = "/synthetic/harness/opencode/opencode.db";

export const sessionError = (
  code: SessionAdminError["code"],
  summary?: string,
  field?: string,
): SessionAdminError => ({
  kind: "db",
  code,
  ...(summary === undefined ? {} : { summary }),
  ...(field === undefined ? {} : { field }),
});

export type FakeCall = {
  readonly kind: "databasePath" | "query" | "deleteSession" | "checkpoint" | "stat" | "now";
  readonly value: string;
};

export type QueryStep = {
  readonly rows?: readonly Record<string, unknown>[];
  readonly error?: unknown;
  readonly before?: () => void;
  /** Mirror the issued SQL projection instead of returning the full row. */
  readonly projectRows?: boolean;
};

export type FakeSessionIo = OpencodeSessionIo & {
  readonly calls: FakeCall[];
  readonly steps: QueryStep[];
  readonly statFacts: Map<string, SessionFileFacts>;
  readonly children: Set<string>;
  readonly removed: Set<string>;
  readonly deleteFailures: Map<string, unknown>;
  readonly deleted: string[];
  readonly checkpointCalls: number;
  databasePathValue: string;
  databasePathError: unknown;
  nowValue: number;
  queueQuery(rows: readonly Record<string, unknown>[], before?: () => void): void;
  queueProjectedQuery(rows: readonly Record<string, unknown>[], before?: () => void): void;
  queueError(error: unknown): void;
  queueStep(step: QueryStep): void;
  resetCalls(): void;
};

export type FakeIoOptions = {
  readonly databasePath?: string;
  readonly databasePathError?: unknown;
  readonly now?: number;
  readonly stat?: Readonly<Record<string, SessionFileFacts>>;
};

/** Build one fake seam; every call is recorded in order. */
export const createFakeIo = (options: FakeIoOptions = {}): FakeSessionIo => {
  const calls: FakeCall[] = [];
  const steps: QueryStep[] = [];
  const statFacts = new Map<string, SessionFileFacts>(Object.entries(options.stat ?? {}));
  const children = new Set<string>();
  const removed = new Set<string>();
  const deleteFailures = new Map<string, unknown>();
  const deleted: string[] = [];
  let checkpointCalls = 0;
  const io: FakeSessionIo = {
    command: "opencode",
    environment: { PATH: "/synthetic/bin", HOME: "/synthetic/home" },
    calls,
    steps,
    statFacts,
    children,
    removed,
    deleteFailures,
    deleted,
    get checkpointCalls() {
      return checkpointCalls;
    },
    checkpointBefore: undefined,
    databasePathValue: options.databasePath ?? SYNTHETIC_DB_PATH,
    databasePathError: options.databasePathError,
    nowValue: options.now ?? NOW_MS,
    queueQuery(rows, before) {
      steps.push(before === undefined ? { rows } : { rows, before });
    },
    queueProjectedQuery(rows, before) {
      steps.push(
        before === undefined ? { rows, projectRows: true } : { rows, before, projectRows: true },
      );
    },
    queueError(error) {
      steps.push({ error });
    },
    queueStep(step) {
      steps.push(step);
    },
    resetCalls() {
      calls.length = 0;
    },
    async databasePath(): Promise<string> {
      calls.push({ kind: "databasePath", value: "" });
      if (io.databasePathError !== undefined) throw io.databasePathError;
      return io.databasePathValue;
    },
    async query(sql: string): Promise<readonly Record<string, unknown>[]> {
      calls.push({ kind: "query", value: sql });
      const step = steps.shift();
      if (step === undefined) throw sessionError("db.query.failed");
      step.before?.();
      if (step.error !== undefined) throw step.error;
      const rows = step.rows ?? [];
      return step.projectRows === true ? rows.map((row) => projectSessionRow(sql, row)) : rows;
    },
    async deleteSession(id: string): Promise<void> {
      calls.push({ kind: "deleteSession", value: id });
      const failure = deleteFailures.get(id);
      if (failure !== undefined) throw failure;
      deleted.push(id);
      removed.add(id);
    },
    async checkpoint(): Promise<void> {
      calls.push({ kind: "checkpoint", value: "PRAGMA wal_checkpoint(TRUNCATE)" });
      io.checkpointBefore?.();
      checkpointCalls += 1;
    },
    now(): number {
      calls.push({ kind: "now", value: String(io.nowValue) });
      return io.nowValue;
    },
    async stat(path: string): Promise<SessionFileFacts> {
      calls.push({ kind: "stat", value: path });
      return statFacts.get(path) ?? { bytes: 0, present: false };
    },
  };
  return io;
};

export const fakeSetChildren = (io: FakeSessionIo, id: string): void => {
  io.children.add(id);
};

export const fakeRemoveRow = (io: FakeSessionIo, id: string): void => {
  io.removed.add(id);
};

export const fakeFailDelete = (io: FakeSessionIo, id: string, error?: unknown): void => {
  io.deleteFailures.set(id, error ?? sessionError("db.delete.failed"));
};

export const callsOf = (io: FakeSessionIo, kind: FakeCall["kind"]): FakeCall[] =>
  io.calls.filter((call) => call.kind === kind);

export const queries = (io: FakeSessionIo): string[] =>
  callsOf(io, "query").map((call) => call.value);

export const emptySizeData = (): SizeData => ({
  schemaVersion: DB_SCHEMA_VERSION,
  command: "size",
  database: {
    path: SYNTHETIC_DB_PATH,
    dbBytes: 0,
    walBytes: 0,
    shmBytes: 0,
    walPresent: false,
    shmPresent: false,
  },
  counts: { sessions: 0, messages: 0, parts: 0 },
  oldestSessionUpdatedAt: null,
  newestSessionUpdatedAt: null,
});

export const emptyListData = (limit = 20): ListData => ({
  schemaVersion: DB_SCHEMA_VERSION,
  command: "list",
  limit,
  total: 0,
  omitted: 0,
  truncated: false,
  items: [],
});

export const emptyPruneData = (apply = false): PruneData => ({
  schemaVersion: DB_SCHEMA_VERSION,
  command: "prune",
  mode: apply ? "applied" : "dry-run",
  olderThanDays: 30,
  limit: 50,
  liveWindowMinutes: 15,
  cutoff: new Date(NOW_MS - 30 * DAY_MS).toISOString(),
  counts: { selected: 0, deleted: 0, failed: 0, skipped: 0, liveExcluded: 0 },
  candidates: [],
});

export const emptyRebootData = (apply = false): RebootData => ({
  schemaVersion: DB_SCHEMA_VERSION,
  command: "reboot",
  mode: apply ? "applied" : "dry-run",
  liveWindowMinutes: 15,
  liveSessions: 0,
  blockedByLiveSession: false,
  checkpointPerformed: apply,
  database: {
    path: SYNTHETIC_DB_PATH,
    walBytesBefore: 0,
    ...(apply ? { walBytesAfter: 0 } : {}),
    walPresent: false,
    shmPresent: false,
  },
});

export type FakeRuntimeScript = {
  readonly size?: SessionSizeRead;
  readonly list?: SessionListRead;
  readonly prune?: SessionPruneRead;
  readonly reboot?: SessionRebootRead;
};

export type RuntimeCall = {
  readonly method: "size" | "list" | "prune" | "reboot";
  readonly input?: unknown;
};

export type FakeDbRuntime = DbCommandRuntime & {
  readonly calls: RuntimeCall[];
};

export const createFakeRuntime = (script: FakeRuntimeScript = {}): FakeDbRuntime => {
  const calls: RuntimeCall[] = [];
  return {
    calls,
    async size() {
      calls.push({ method: "size" });
      return script.size ?? { ok: true, value: emptySizeData() };
    },
    async list(input) {
      calls.push({ method: "list", input });
      return script.list ?? { ok: true, value: emptyListData(input.limit) };
    },
    async prune(input) {
      calls.push({ method: "prune", input });
      return script.prune ?? { ok: true, value: emptyPruneData(input.apply) };
    },
    async reboot(input) {
      calls.push({ method: "reboot", input });
      return script.reboot ?? { ok: true, value: emptyRebootData(input.apply) };
    },
  };
};

export type DbCliRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type DbCliOptions = {
  readonly brand?: typeof SYNTHETIC_BRAND;
  readonly secrets?: readonly string[];
  readonly runId?: string;
  readonly ticks?: readonly [number, number];
};

export const runDbCli = async (
  argv: readonly string[],
  runtime: DbCommandRuntime,
  options: DbCliOptions = {},
): Promise<DbCliRun> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = options.ticks ?? [100, 110];
  let tick = 0;
  const deps: CliDependencies = {
    brand: options.brand ?? SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => options.runId ?? "run-db-fixture",
    secrets: options.secrets ?? [],
    program: { commands: { db: createDbCommandDefinition(runtime) } },
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

export const runDbWithIo = async (
  argv: readonly string[],
  io: FakeSessionIo,
  options: DbCliOptions & { readonly nowMs?: number } = {},
): Promise<DbCliRun> => {
  const runtime = createDbCommandRuntime({
    io,
    clock: { nowMs: () => options.nowMs ?? NOW_MS },
  });
  return runDbCli(argv, runtime, options);
};
