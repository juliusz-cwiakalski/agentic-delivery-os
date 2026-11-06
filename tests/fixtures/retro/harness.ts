/**
 * The GH-232 retro two-store harness (test plan §4.1).
 *
 * A temp state directory hosts the real sidecar runtime edge (production file
 * primitives and keyed hash) beside a real JSONL state store. Every read seam is
 * scriptable, and the adversary helpers mutate sidecar bytes directly on disk
 * exactly as a same-user delivery agent could.
 */
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AUDIT_INVOCATION_PAYLOAD_SCHEMA,
  type AuditChainVerdict,
  type AuditInvocationFacts,
  type AuditInvocationRecord,
  type AuditReadOutcome,
  type AuditReadQuery,
  type AuditReservationOrphanFinding,
  type PhaseTransitionRecord,
  RETRO_CANONICAL_FIELD_ORDER,
  RETRO_CHAIN_ANCHOR,
  RETRO_CHAIN_KEY_PAYLOAD_SCHEMA,
  RETRO_EVIDENCE_PAYLOAD_SCHEMA,
  type RetroChangeFacts,
  type RetroEvidenceDraft,
  type RetroEvidenceRecord,
  type RetroLevelName,
  type RetroNotesRead,
  type RetroStateFamilies,
  retroChainKeyPath,
  retroEvidencePath,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  appendAuditInvocation,
  createNodeRetroSidecarIo,
  createRetroSidecar,
  ensureAuditChainKey,
  type RetroSidecar,
  readRetroRegistry,
  readRetroRuns,
  recordRetroRun,
  seedRetroRegistry,
} from "../../../packages/core/src/state/index";
import { createTestEdge, makeIdentity, openStore, type TestEdge } from "../state/harness";

export const NOW_MS = Date.UTC(2026, 10, 6, 12, 0, 0);
export const WORKSPACE = "workspace-a";

export type RetroFixture = {
  readonly root: string;
  readonly stateDirectory: string;
  readonly workspaceId: string;
  readonly io: ReturnType<typeof createNodeRetroSidecarIo>;
  readonly sidecar: RetroSidecar;
  readonly store: StateStorePort;
  readonly edge: TestEdge;
  /** Replace the scripted audit read outcome. */
  scriptAudit(outcome: AuditReadOutcome): void;
  /** The audit queries the collector recorded. */
  readonly auditQueries: readonly AuditReadQuery[];
  scriptStateFamilies(changeRef: string, families: RetroStateFamilies): void;
  readonly stateFamilyReads: readonly string[];
  scriptNotes(changeRef: string, notes: RetroNotesRead): void;
  readonly noteReads: readonly string[];
  scriptDeliveryChanges(changes: readonly RetroChangeFacts[]): void;
  readonly readAuditLedgerQuery: (query: AuditReadQuery) => AuditReadOutcome;
  readonly readStateFamilies: (changeRef: string) => RetroStateFamilies;
  readonly readNotes: (changeRef: string) => RetroNotesRead;
  readonly readDeliveryChanges: () => readonly RetroChangeFacts[];
};

const counters = { trace: 0, run: 0 };

export const resetCounters = (): void => {
  counters.trace = 0;
  counters.run = 0;
};

export const newTraceId = (): string => {
  counters.trace += 1;
  return `ev-${String(counters.trace).padStart(4, "0")}`;
};

export const newRunId = (): string => {
  counters.run += 1;
  return `run-${String(counters.run).padStart(4, "0")}`;
};

export const emptyAuditOutcome = (): AuditReadOutcome => ({
  verifiedEmpty: true,
  records: [],
  matched: 0,
  truncated: false,
  chain: {
    verified: true,
    records: 0,
    breaks: [],
    orphans: [],
    storePath: "audit-ledger",
  },
  storePath: "audit-ledger",
});

export const auditOutcome = (input: {
  readonly records?: readonly AuditInvocationRecord[];
  readonly orphans?: readonly AuditReservationOrphanFinding[];
  readonly verified?: boolean;
  readonly truncated?: boolean;
  readonly matched?: number;
}): AuditReadOutcome => {
  const records = input.records ?? [];
  const verified = input.verified ?? true;
  const chain: AuditChainVerdict = {
    verified,
    records: records.length,
    breaks: verified ? [] : [{ position: 1, auditSeq: 1 }],
    orphans: input.orphans ?? [],
    storePath: "audit-ledger",
  };
  return {
    verifiedEmpty: records.length === 0,
    records,
    matched: input.matched ?? records.length,
    truncated: input.truncated ?? false,
    chain,
    storePath: "audit-ledger",
  };
};

export const auditRecord = (
  overrides: Partial<AuditInvocationRecord> = {},
): AuditInvocationRecord => ({
  schemaId: AUDIT_INVOCATION_PAYLOAD_SCHEMA,
  runId: "run-audit-1",
  command: "status",
  arguments: ["status", "--json"],
  exitCode: 0,
  timing: { totalMs: 1 },
  resultSchemaVersion: "delivery.result.v1",
  outcomeClass: "success",
  scope: WORKSPACE,
  startedAt: NOW_MS - 1000,
  auditSeq: 1,
  chainValue: "0".repeat(32),
  ...overrides,
});

export const transitionRecord = (
  overrides: Partial<PhaseTransitionRecord> = {},
): PhaseTransitionRecord => ({
  changeRef: "GH-232",
  phaseId: "pr_creation",
  operation: "complete",
  timestamp: "2026-11-06T10:00:00Z",
  outcome: "landed",
  ...overrides,
});

export const makeRetroDir = (label = "retro"): RetroFixture => {
  resetCounters();
  const root = mkdtempSync(join(tmpdir(), `gh232-${label}-`));
  const stateDirectory = join(root, "state");
  mkdirSync(stateDirectory, { recursive: true, mode: 0o700 });
  chmodSync(stateDirectory, 0o700);
  const edge = createTestEdge();
  const { store } = openStore(
    makeIdentity(stateDirectory, {
      workspaceId: WORKSPACE,
      fenceNamespace: "retro-registry",
    }),
    { edge },
  );
  const io = createNodeRetroSidecarIo({ stateDirectory, workspaceId: WORKSPACE });
  const sidecar = createRetroSidecar(io);
  let currentAudit: AuditReadOutcome = emptyAuditOutcome();
  const auditQueries: AuditReadQuery[] = [];
  const families = new Map<string, RetroStateFamilies>();
  const stateFamilyReads: string[] = [];
  const notes = new Map<string, RetroNotesRead>();
  const noteReads: string[] = [];
  let changes: readonly RetroChangeFacts[] = [];

  return {
    root,
    stateDirectory,
    workspaceId: WORKSPACE,
    io,
    sidecar,
    store,
    edge,
    scriptAudit: (outcome) => {
      currentAudit = outcome;
    },
    get auditQueries() {
      return auditQueries;
    },
    scriptStateFamilies: (changeRef, value) => {
      families.set(changeRef, value);
    },
    get stateFamilyReads() {
      return stateFamilyReads;
    },
    scriptNotes: (changeRef, value) => {
      notes.set(changeRef, value);
    },
    get noteReads() {
      return noteReads;
    },
    scriptDeliveryChanges: (value) => {
      changes = value;
    },
    readAuditLedgerQuery: (query) => {
      auditQueries.push(query);
      return currentAudit;
    },
    readStateFamilies: (changeRef) => {
      stateFamilyReads.push(changeRef);
      return families.get(changeRef) ?? { transitions: [], closeouts: [], telemetry: [] };
    },
    readNotes: (changeRef) => {
      noteReads.push(changeRef);
      return notes.get(changeRef) ?? { retroNotes: [] };
    },
    readDeliveryChanges: () => changes,
  };
};

export const appendEvidence = (
  fixture: RetroFixture,
  overrides: Partial<RetroEvidenceDraft> = {},
): RetroEvidenceRecord => {
  const appended = fixture.sidecar.append({
    traceId: newTraceId(),
    level: "change" satisfies RetroLevelName,
    source: "pm-notes",
    windowStart: NOW_MS - 3_600_000,
    windowEnd: NOW_MS,
    collectedAt: NOW_MS,
    payloadRefs: ["note:0", "text:synthetic retro note"],
    payloadSchemaId: RETRO_EVIDENCE_PAYLOAD_SCHEMA,
    ...overrides,
  });
  if (!appended.ok) throw new Error(`append failed: ${appended.error.code}`);
  return appended.value;
};

export const sidecarLines = (fixture: RetroFixture): string[] => {
  const path = retroEvidencePath(fixture.stateDirectory, fixture.workspaceId);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line !== "");
};

export const writeSidecarLines = (fixture: RetroFixture, lines: readonly string[]): void => {
  const path = retroEvidencePath(fixture.stateDirectory, fixture.workspaceId);
  writeFileSync(path, lines.length === 0 ? "" : `${lines.join("\n")}\n`);
};

export const readSidecarBytes = (fixture: RetroFixture): Buffer => {
  const path = retroEvidencePath(fixture.stateDirectory, fixture.workspaceId);
  return existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
};

const recordAt = (fixture: RetroFixture, position: number): Record<string, unknown> => {
  const line = sidecarLines(fixture)[position - 1];
  if (line === undefined) throw new Error(`sidecar record ${position} is absent`);
  return JSON.parse(line) as Record<string, unknown>;
};

export const mutateContent = (
  fixture: RetroFixture,
  position: number,
  mutate: (record: Record<string, unknown>) => void,
): void => {
  const lines = sidecarLines(fixture);
  const record = recordAt(fixture, position);
  mutate(record);
  lines[position - 1] = JSON.stringify(record);
  writeSidecarLines(fixture, lines);
};

export const mutateDelete = (fixture: RetroFixture, position: number): void => {
  const lines = sidecarLines(fixture);
  lines.splice(position - 1, 1);
  writeSidecarLines(fixture, lines);
};

export const mutateReorder = (fixture: RetroFixture, position: number): void => {
  const lines = sidecarLines(fixture);
  const [moved] = lines.splice(position - 1, 1);
  if (moved === undefined) throw new Error("record not found");
  lines.splice(position, 0, moved);
  writeSidecarLines(fixture, lines);
};

export const mutateTruncateReappend = (fixture: RetroFixture, position: number): void => {
  const lines = sidecarLines(fixture);
  const removed = lines.splice(position - 1);
  const first = removed[0];
  if (first !== undefined) lines.push(first);
  writeSidecarLines(fixture, lines);
};

const canonicalContent = (record: Record<string, unknown>): string => {
  const ordered: Record<string, unknown> = {};
  for (const field of RETRO_CANONICAL_FIELD_ORDER) {
    if (Object.hasOwn(record, field)) ordered[field] = record[field];
  }
  return JSON.stringify(ordered);
};

const fnv1a64 = (text: string): string => {
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * 1099511628211n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

/** Recompute an unkeyed link (the mutation the keyed construction must reject). */
export const mutateUnkeyedRecompute = (fixture: RetroFixture, position: number): void => {
  const lines = sidecarLines(fixture);
  const record = recordAt(fixture, position);
  const previous =
    position === 1
      ? RETRO_CHAIN_ANCHOR
      : String(recordAt(fixture, position - 1).chainValue ?? RETRO_CHAIN_ANCHOR);
  const content = canonicalContent(record);
  const digest = `${fnv1a64(`${previous}\u0000${content}`)}${fnv1a64(`${previous}\u0000${content}`)}`;
  record.chainValue = digest.slice(0, 64);
  lines[position - 1] = JSON.stringify(record);
  writeSidecarLines(fixture, lines);
};

export const keyArtifactPath = (fixture: RetroFixture): string =>
  retroChainKeyPath(fixture.stateDirectory, fixture.workspaceId);

export const readKeyArtifact = (fixture: RetroFixture): string =>
  readFileSync(keyArtifactPath(fixture), "utf8");

export const readKeyValue = (fixture: RetroFixture): string => {
  const parsed = JSON.parse(readKeyArtifact(fixture)) as { key?: unknown };
  if (typeof parsed.key !== "string") throw new Error("key artifact is malformed");
  return parsed.key;
};

export const substituteKey = (fixture: RetroFixture): void => {
  writeFileSync(
    keyArtifactPath(fixture),
    `${JSON.stringify({ schemaId: RETRO_CHAIN_KEY_PAYLOAD_SCHEMA, key: "b".repeat(64) })}\n`,
  );
  chmodSync(keyArtifactPath(fixture), 0o600);
};

export const removeKeyArtifact = (fixture: RetroFixture): void => {
  fixture.io.removeFile(keyArtifactPath(fixture));
};

export const corruptKeyArtifact = (fixture: RetroFixture): void => {
  writeFileSync(keyArtifactPath(fixture), "{ not json");
  chmodSync(keyArtifactPath(fixture), 0o600);
};

export const chmodKeyArtifact = (fixture: RetroFixture, mode: number): void => {
  chmodSync(keyArtifactPath(fixture), mode);
};

export const chmodEvidence = (fixture: RetroFixture, mode: number): void => {
  chmodSync(retroEvidencePath(fixture.stateDirectory, fixture.workspaceId), mode);
};

export const seedAuditKey = (fixture: RetroFixture): string => {
  const ensured = ensureAuditChainKey(fixture.store);
  if (!ensured.ok) throw new Error(`audit key seed failed: ${ensured.error.code}`);
  return ensured.value;
};

export const appendAudit = (fixture: RetroFixture, facts: AuditInvocationFacts): void => {
  const appended = appendAuditInvocation(fixture.store, facts);
  if (!appended.ok) throw new Error(`audit append failed: ${appended.error.code}`);
};

export type RetroDepsOverrides = Partial<
  import("../../../packages/core/src/domain/retro").RetroCollectDeps
>;

let fenceCounter = 0;

/** Build the injected collection seams over the fixture. */
export const collectDeps = (
  fixture: RetroFixture,
  overrides: RetroDepsOverrides = {},
): import("../../../packages/core/src/domain/retro").RetroCollectDeps => ({
  sidecar: fixture.sidecar,
  registry: {
    read: () => readRetroRegistry(fixture.store),
    runs: (read) => readRetroRuns(read),
    recordRun: (run, token) => recordRetroRun(fixture.store, run, token),
    seed: (token) => seedRetroRegistry(fixture.store, token),
  },
  collectors: {
    readAuditLedger: (query) => ({ ok: true, value: fixture.readAuditLedgerQuery(query) }),
    readStateFamilies: (changeRef) => ({
      ok: true,
      value: fixture.readStateFamilies(changeRef),
    }),
    readNotes: (changeRef) => ({ ok: true, value: fixture.readNotes(changeRef) }),
  },
  readChanges: fixture.readDeliveryChanges,
  clock: { nowMs: () => NOW_MS },
  newTraceId,
  newRunId,
  newFenceToken: () => {
    fenceCounter += 1;
    return `fence-${String(fenceCounter)}`;
  },
  level: "change",
  ...overrides,
});

/** Build the injected report seams over the fixture. */
export const reportDeps = (
  fixture: RetroFixture,
  overrides: Partial<import("../../../packages/core/src/domain/retro").RetroReportDeps> = {},
): import("../../../packages/core/src/domain/retro").RetroReportDeps => ({
  sidecar: fixture.sidecar,
  registry: {
    read: () => readRetroRegistry(fixture.store),
    runs: (read) => readRetroRuns(read),
    recordRun: (run, token) => recordRetroRun(fixture.store, run, token),
    seed: (token) => seedRetroRegistry(fixture.store, token),
  },
  level: "change",
  ...overrides,
});

/** Build the injected export seams with an in-memory destination. */
export const exportDeps = (
  fixture: RetroFixture,
  destination = "/temp/export.json",
  limit = 10,
  overrides: Partial<import("../../../packages/core/src/domain/retro").RetroExportDeps> = {},
): {
  readonly deps: import("../../../packages/core/src/domain/retro").RetroExportDeps;
  readonly written: { readonly destination?: string; readonly content?: string };
} => {
  const written: { destination?: string; content?: string } = {};
  return {
    written,
    deps: {
      sidecar: fixture.sidecar,
      level: "change",
      destination,
      limit,
      write: (target, content) => {
        written.destination = target;
        written.content = content;
      },
      ...overrides,
    },
  };
};

/** One in-process retro invocation's observable output. */
export type RetroRunResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly data?: unknown;
  readonly error?: unknown;
};

export type RetroRunOptions = {
  readonly collect?: RetroDepsOverrides;
  readonly report?: Partial<import("../../../packages/core/src/domain/retro").RetroReportDeps>;
  readonly target?: string;
  readonly secrets?: readonly string[];
  readonly mode?: "interactive" | "scripted";
  readonly ticks?: readonly [number, number];
};

/** Run `retro <subcommand>` in process through the delivered runCli surface. */
export const runRetro = async (
  argv: readonly string[],
  fixture: RetroFixture,
  options: RetroRunOptions = {},
): Promise<RetroRunResult> => {
  const [{ createRetroCommandDefinition }, { runCli }, { bufferSink, SYNTHETIC_BRAND }] =
    await Promise.all([
      import("../../../packages/cli/src/commands/retro"),
      import("../../../packages/cli/src/index"),
      import("../../golden/helpers"),
    ]);
  const runtime: import("@delivery-os/core/contracts").RetroCommandRuntime = {
    collect: (input) =>
      import("../../../packages/core/src/domain/retro").then(({ collectRetro }) =>
        collectRetro(
          collectDeps(fixture, {
            ...options.collect,
            level: input.level,
            ...(options.target === undefined ? {} : { target: options.target }),
          }),
        ),
      ),
    report: (input) =>
      import("../../../packages/core/src/domain/retro").then(({ reportRetro }) =>
        reportRetro(reportDeps(fixture, { ...options.report, level: input.level })),
      ),
  };
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = options.ticks ?? [1000, 1004];
  let tick = 0;
  const exitCode = await runCli(
    argv,
    { stdout, stderr },
    {
      brand: SYNTHETIC_BRAND,
      clock: { now: () => ticks[Math.min(tick++, 1)] ?? ticks[0] },
      newRunId: () => newRunId(),
      secrets: options.secrets ?? [],
      program: { commands: { retro: createRetroCommandDefinition(runtime) } },
      mode: options.mode ?? "scripted",
    },
  );
  let data: unknown;
  let error: unknown;
  const trimmed = stdout.value.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as { data?: unknown; error?: unknown };
    data = parsed.data;
    error = parsed.error;
  }
  return { exitCode, stdout: stdout.value, stderr: stderr.value, data, error };
};
