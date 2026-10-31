/**
 * GH-180 fake session I/O harness (test-plan §4.1).
 *
 * The fake implements `OpencodeSessionIo` and records an ordered call log. It
 * never spawns a process, opens a database, reads a home directory, or touches
 * the network. Query answers are scripted per call; mutation hooks change the
 * scripted state between calls, never a live store.
 */
import type { SessionFileFacts } from "../../../packages/adapters/src/session/index";
import type { OpencodeSessionIo } from "../../../packages/adapters/src/session/index";
import type { SessionAdminError } from "../../../packages/core/src/contracts/index";

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
      return step.rows ?? [];
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
