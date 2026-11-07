/**
 * Shared harness for the GH-174 state suites.
 *
 * Builds temp store roots, an injected test edge with deterministic named
 * faults and a mutable clock, and the normalization used by the conformance
 * suite. No test ever writes the live tree or the real user state directory.
 */
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  AUDIT_CHAIN_KEY_ARTIFACT_PREFIX,
  AUDIT_CHAIN_KEY_ARTIFACT_SUFFIX,
  AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA,
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_RESERVATION_RECORD_KIND,
  type AuditInvocationFacts,
  type AuditOutcomeClass,
  type AuditReadOutcome,
  STATE_SCHEMA_VERSION,
  type StateDriverKind,
  type StateFenceHandle,
  type StateStoreIdentity,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  type AuditAppendOutcome,
  appendAuditInvocation,
  createNodeStateEdge,
  createStateStore,
  readAuditLedger,
  type StateEdgeFaultPoint,
  type StateRuntimeEdge,
} from "../../../packages/core/src/state/index";
import { storageExhaustionFailure } from "../../../packages/core/src/state/storage-error";

export type TestFault = { readonly point: StateEdgeFaultPoint };

export type TestEdge = StateRuntimeEdge & {
  readonly raised: StateEdgeFaultPoint[];
  arm(points: readonly StateEdgeFaultPoint[]): void;
  /** Arms the ASM-3 pre-commit points to raise the exhaustion-shaped failure. */
  armExhaustion(points: readonly StateEdgeFaultPoint[]): void;
  disarm(): void;
};
export type TestClock = { value: number };

export const createTestEdge = (
  options: {
    readonly faults?: readonly StateEdgeFaultPoint[];
    readonly exhaustion?: readonly StateEdgeFaultPoint[];
    readonly clock?: TestClock;
    readonly randomHex?: (bytes: number) => string;
  } = {},
): TestEdge => {
  const base = createNodeStateEdge();
  let armed = new Set<StateEdgeFaultPoint>(options.faults ?? []);
  let exhaustion = new Set<StateEdgeFaultPoint>(options.exhaustion ?? []);
  const raised: StateEdgeFaultPoint[] = [];
  return {
    ...base,
    now: () => (options.clock === undefined ? base.now() : options.clock.value),
    randomHex: (bytes) =>
      options.randomHex === undefined ? base.randomHex(bytes) : options.randomHex(bytes),
    raiseFault: (point) => {
      raised.push(point);
      if (exhaustion.has(point)) throw storageExhaustionFailure("ENOSPC");
      if (armed.has(point)) throw { point } satisfies TestFault;
    },
    raised,
    arm: (points) => {
      armed = new Set(points);
      exhaustion = new Set();
    },
    armExhaustion: (points) => {
      armed = new Set();
      exhaustion = new Set(points);
    },
    disarm: () => {
      armed = new Set();
      exhaustion = new Set();
    },
  };
};

export const makeTempRoot = (label = "state"): string =>
  mkdtempSync(join(tmpdir(), `gh174-${label}-`));

export const removeRoot = (root: string): void => rmSync(root, { recursive: true, force: true });

export const makeIdentity = (
  stateDirectory: string,
  overrides: Partial<StateStoreIdentity> = {},
): StateStoreIdentity => ({
  level: "local",
  workspaceId: "workspace-a",
  fenceNamespace: "fence-a",
  schemaVersion: STATE_SCHEMA_VERSION,
  stateDirectory,
  ...overrides,
});

export const openStore = (
  identity: StateStoreIdentity,
  options: { driver?: StateDriverKind; edge?: TestEdge; staleFenceMs?: number } = {},
): { store: StateStorePort; edge: TestEdge } => {
  const edge = options.edge ?? createTestEdge();
  const store = createStateStore(identity, {
    driver: options.driver ?? "jsonl",
    edge,
    ...(options.staleFenceMs !== undefined ? { staleFenceMs: options.staleFenceMs } : {}),
  });
  return { store, edge };
};

/** Deterministic FNV-1a 64-bit used as an independent checksum oracle. */
export const independentChecksum = (payload: unknown): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let hash = 14695981039346656037n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 1099511628211n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
};

export const ledgerPath = (identity: StateStoreIdentity): string =>
  `${identity.stateDirectory}/ledger.${encodeURIComponent(identity.workspaceId)}.jsonl`;

export const ledgerText = (identity: StateStoreIdentity): string =>
  readFileSync(ledgerPath(identity), "utf8");

export const ledgerLines = (text: string): string[] =>
  text.split("\n").filter((line) => line !== "");

export const digestPaths = (paths: readonly string[]): string => {
  const hash = createHash("sha256");
  for (const path of paths) {
    // Only the file name and bytes participate, so per-driver temp roots do
    // not make identical fixtures look different.
    hash.update(basename(path));
    hash.update(existsSync(path) ? readFileSync(path) : Buffer.from("absent"));
  }
  return hash.digest("hex");
};

export const listStoreFiles = (directory: string): string[] =>
  existsSync(directory)
    ? readdirSync(directory)
        .filter((name) => !name.endsWith(".sqlite") && !name.endsWith(".lock"))
        .sort()
    : [];

/** Opens a fence, runs the body, and releases the fence. */
export const withinFence = (
  store: StateStorePort,
  token: string,
  body: (handle: StateFenceHandle) => void,
): void => {
  const acquired = store.acquireFence(token);
  if (!acquired.ok) throw new Error(`acquire failed: ${acquired.error.code}`);
  try {
    body(acquired.value.handle);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

/** The quarantine directory a store owns (outside documents/index namespaces). */
export const quarantineDirectory = (identity: StateStoreIdentity): string =>
  `${identity.stateDirectory}/quarantine.${encodeURIComponent(identity.workspaceId)}`;

/** The quarantine artifacts a store currently holds, sorted by name. */
export const quarantineFiles = (identity: StateStoreIdentity): string[] => {
  const directory = quarantineDirectory(identity);
  return existsSync(directory) ? readdirSync(directory).sort() : [];
};

/** One quarantine artifact path by name. */
export const quarantinePath = (identity: StateStoreIdentity, name: string): string =>
  `${quarantineDirectory(identity)}/${name}`;

/** The ledger's raw bytes (a capture for byte-identity comparisons). */
export const ledgerBytes = (identity: StateStoreIdentity): Buffer =>
  readFileSync(ledgerPath(identity));

/** SHA-256 over the ledger's exact bytes (byte-identity evidence). */
export const ledgerDigest = (identity: StateStoreIdentity): string =>
  createHash("sha256")
    .update(readFileSync(ledgerPath(identity)))
    .digest("hex");

/** The exact post-tear bytes: everything after the given byte offset. */
export const tailBytesAfter = (
  identity: StateStoreIdentity,
  byteOffset: number,
  captured?: Buffer,
): Buffer => (captured ?? ledgerBytes(identity)).subarray(byteOffset);

/** Run the explicit salvage operation under a freshly acquired fence. */
export const salvageTail = (
  store: StateStorePort,
  token = "salvage-writer",
): ReturnType<StateStorePort["salvage"]> => {
  const acquired = store.acquireFence(token);
  if (!acquired.ok) return acquired;
  try {
    return store.salvage(acquired.value.handle);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

/** One audit-store fixture: a fresh temp root, identity, edge, and store. */
export type AuditStoreFixture = {
  readonly root: string;
  readonly identity: StateStoreIdentity;
  readonly edge: TestEdge;
  readonly store: StateStorePort;
};

/** Open a fresh audit store under a per-test temp root (`gh223-` label). */
export const makeAuditStore = (label = "audit", workspaceId = "workspace-a"): AuditStoreFixture => {
  const root = makeTempRoot(`gh223-${label}`);
  const identity = makeIdentity(root, { workspaceId });
  const edge = createTestEdge();
  const store = createStateStore(identity, { driver: "jsonl", edge });
  return { root, identity, edge, store };
};

/** Reopen the same temp root with a fresh edge/store instance. */
export const reopenStore = (identity: StateStoreIdentity): AuditStoreFixture => {
  const edge = createTestEdge();
  const store = createStateStore(identity, { driver: "jsonl", edge });
  return { root: identity.stateDirectory, identity, edge, store };
};

let auditFactCounter = 0;

/** One deterministic audited-invocation fact set. */
export const auditFactsFor = (
  overrides: Partial<AuditInvocationFacts> = {},
): AuditInvocationFacts => {
  auditFactCounter += 1;
  const ordinal = auditFactCounter;
  return {
    runId: `run-gh223-${String(ordinal).padStart(4, "0")}`,
    command: "status",
    arguments: ["status", "--json"],
    exitCode: 0,
    timing: { totalMs: 13 },
    resultSchemaVersion: "delivery.result.v1",
    outcomeClass: "success",
    scope: "workspace-a",
    startedAt: 1000 + ordinal,
    ...overrides,
  };
};

/** Append one audit pair through the consumer. */
export const appendAuditFacts = (
  store: StateStorePort,
  overrides: Partial<AuditInvocationFacts> = {},
): ReturnType<typeof appendAuditInvocation> =>
  appendAuditInvocation(store, auditFactsFor(overrides));

/** Seed `count` pairs with monotonically increasing ordinals and timestamps. */
export const seedAuditPairs = (
  store: StateStorePort,
  count: number,
  overrides: (index: number) => Partial<AuditInvocationFacts> = () => ({}),
): AuditAppendOutcome[] => {
  const outcomes: AuditAppendOutcome[] = [];
  for (let index = 0; index < count; index += 1) {
    const appended = appendAuditInvocation(
      store,
      auditFactsFor({ startedAt: 1000 + index * 1000, ...overrides(index) }),
    );
    if (!appended.ok) throw new Error(`audit seed failed: ${appended.error.code}`);
    outcomes.push(appended.value);
  }
  return outcomes;
};

/** Every raw ledger record of an audit kind. */
export const auditRecordsOf = (store: StateStorePort): readonly Record<string, unknown>[] => {
  const read = store.readRecords();
  if (!read.ok) throw new Error(`audit read failed: ${read.error.code}`);
  return read.value.records
    .filter(
      (record) =>
        record.kind === AUDIT_INVOCATION_RECORD_KIND ||
        record.kind === AUDIT_RESERVATION_RECORD_KIND,
    )
    .map((record) => record as unknown as Record<string, unknown>);
};

/** Every invocation payload, in ledger order. */
export const invocationPayloadsOf = (store: StateStorePort): readonly Record<string, unknown>[] =>
  auditRecordsOf(store)
    .filter((record) => record.kind === AUDIT_INVOCATION_RECORD_KIND)
    .map((record) => record.payload as Record<string, unknown>);

/** Every reservation payload, in ledger order. */
export const reservationPayloadsOf = (store: StateStorePort): readonly Record<string, unknown>[] =>
  auditRecordsOf(store)
    .filter((record) => record.kind === AUDIT_RESERVATION_RECORD_KIND)
    .map((record) => record.payload as Record<string, unknown>);

/** The `(reservation, invocation)` pairs sharing an auditSeq. */
export const auditPairsOf = (
  store: StateStorePort,
): readonly {
  readonly auditSeq: number;
  readonly reservation: Record<string, unknown>;
  readonly invocation: Record<string, unknown>;
}[] => {
  const reservations = reservationPayloadsOf(store);
  const invocations = invocationPayloadsOf(store);
  return reservations.flatMap((reservation) => {
    const invocation = invocations.find((candidate) => candidate.auditSeq === reservation.auditSeq);
    return invocation === undefined
      ? []
      : [{ auditSeq: Number(reservation.auditSeq), reservation, invocation }];
  });
};

/** The durable chaining-key artifact path in the store layout. */
export const keyArtifactPath = (identity: StateStoreIdentity): string =>
  `${identity.stateDirectory}/${AUDIT_CHAIN_KEY_ARTIFACT_PREFIX}${encodeURIComponent(identity.workspaceId)}${AUDIT_CHAIN_KEY_ARTIFACT_SUFFIX}`;

/** The artifact's exact bytes (tests only; single-user trust model). */
export const readKeyArtifact = (identity: StateStoreIdentity): string =>
  readFileSync(keyArtifactPath(identity), "utf8");

/** The artifact's key value. */
export const readKeyArtifactValue = (identity: StateStoreIdentity): string => {
  const parsed = JSON.parse(readKeyArtifact(identity)) as { key?: unknown };
  if (typeof parsed.key !== "string") throw new Error("key artifact is malformed");
  return parsed.key;
};

/** The artifact's POSIX mode bits (existing platform conditional in tests). */
export const keyArtifactMode = (identity: StateStoreIdentity): number =>
  (statSync(keyArtifactPath(identity)).mode & 0o777) >>> 0;

export const removeKeyArtifact = (identity: StateStoreIdentity): void =>
  rmSync(keyArtifactPath(identity), { force: true });

export const corruptKeyArtifact = (identity: StateStoreIdentity): void =>
  writeFileSync(keyArtifactPath(identity), "{ not json");

export const chmodKeyArtifact = (identity: StateStoreIdentity, mode: number): void =>
  chmodSync(keyArtifactPath(identity), mode);

/** One ledger line's parsed record shape used by the mutation helpers. */
type MutableLedgerRecord = {
  kind: string;
  sequence: number;
  checksum: string;
  payload: Record<string, unknown>;
};

/** Rewrite one audit record's payload and recompute the unkeyed checksum. */
export const mutateAuditRecord = (
  identity: StateStoreIdentity,
  match: { readonly kind: string; readonly auditSeq?: number; readonly occurrence?: number },
  mutate: (payload: Record<string, unknown>) => void,
): void => {
  const text = ledgerText(identity);
  const lines = text.split("\n").filter((line) => line !== "");
  let seen = 0;
  const next = lines.map((line) => {
    const record = JSON.parse(line) as MutableLedgerRecord;
    if (record.kind !== match.kind) return line;
    const auditSeq = record.payload["auditSeq"];
    if (match.auditSeq !== undefined && auditSeq !== match.auditSeq) return line;
    if (match.occurrence !== undefined) {
      const current = seen;
      seen += 1;
      if (current !== match.occurrence) return line;
    }
    mutate(record.payload);
    record.checksum = independentChecksum(record.payload);
    return JSON.stringify(record);
  });
  writeFileSync(ledgerPath(identity), `${next.join("\n")}\n`);
};

/** Alias documenting the recomputed-checksum tamper class. */
export const tamperWithRecomputedChecksum = mutateAuditRecord;

/** Arm a fault on the Nth `append-before-flush` only (two-phase matrix). */
export const armAppendFailure = (edge: TestEdge, occurrence: number): { restore: () => void } => {
  const original = edge.raiseFault;
  let count = 0;
  edge.raiseFault = (point) => {
    if (point === "append-before-flush") {
      count += 1;
      if (count === occurrence) throw { point };
    }
    original(point);
  };
  return {
    restore: () => {
      edge.raiseFault = original;
    },
  };
};

/** Exhaustion-shaped failure on the Nth `append-before-flush`. */
export const armAppendExhaustion = (
  edge: TestEdge,
  occurrence: number,
): { restore: () => void } => {
  const original = edge.raiseFault;
  let count = 0;
  edge.raiseFault = (point) => {
    if (point === "append-before-flush") {
      count += 1;
      if (count === occurrence) throw storageExhaustionFailure("ENOSPC");
    }
    original(point);
  };
  return {
    restore: () => {
      edge.raiseFault = original;
    },
  };
};

/** The bounded read surface over a store (library-only). */
export const readAudit = (
  store: StateStorePort,
  limit = 1000,
  filters: Omit<Parameters<typeof readAuditLedger>[1], "limit"> = {},
): ReturnType<typeof readAuditLedger> => readAuditLedger(store, { limit, ...filters });

/** A verified read outcome, failing the test when the read refuses. */
export const readAuditOrThrow = (
  store: StateStorePort,
  limit = 1000,
  filters: Omit<Parameters<typeof readAuditLedger>[1], "limit"> = {},
): AuditReadOutcome => {
  const read = readAudit(store, limit, filters);
  if (!read.ok) throw new Error(`audit read failed: ${read.error.code}`);
  return read.value;
};

/** A valid outcome class literal for fixtures. */
export const outcomeClass = (value: string): AuditOutcomeClass => {
  if (value === "success" || value === "user-validation" || value === "platform-provider") {
    return value;
  }
  throw new Error(`unknown outcome class: ${value}`);
};

/** The key artifact's declared payload schema (used by tamper fixtures). */
export const AUDIT_KEY_SCHEMA = AUDIT_CHAIN_KEY_PAYLOAD_SCHEMA;
