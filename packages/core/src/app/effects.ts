/**
 * The owner-side outbox and receipt ledgers (GH-238 F-10; EVT-6, EVT-7; DM-9,
 * DM-10, DM-18; TDR-0014 INV-1..INV-4).
 *
 * Exactly one `outbox.effect` intent is durable before the delivered commit
 * primitive is invoked; receipts carry bounded evidence only. This composition
 * is the lane/one-shot owner path and is never imported by the daemon.
 */

import type { CommitLogRead } from "#contracts";
import {
  COMMAND_RECEIPT_PAYLOAD_SCHEMA,
  COMMAND_RECEIPT_RECORD_KIND,
  type CommandReceiptRecord,
  type CommitLogPort,
  commandReceiptRecordKey,
  OUTBOX_EFFECT_PAYLOAD_SCHEMA,
  OUTBOX_EFFECT_RECORD_KIND,
  type OutboxEffectRecord,
  outboxEffectRecordKey,
  type StateJsonValue,
  type StateStorePort,
} from "#contracts";
import {
  commitIdempotencyKey,
  normalizeStagedPaths,
  resolveCommitEffect,
} from "../domain/effect-protocol.js";

export type EffectLedgerRead<T> =
  | {
      readonly ok: true;
      readonly records: readonly T[];
      readonly latest: ReadonlyMap<string, T>;
      readonly verifiedEmpty: boolean;
      readonly path: string;
    }
  | { readonly ok: false; readonly code: string; readonly path: string };

export type EffectAppendResult<T> =
  | { readonly ok: true; readonly appended: boolean; readonly record: T }
  | { readonly ok: false; readonly code: string; readonly path: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOutboxRecord = (value: unknown): value is OutboxEffectRecord =>
  isRecord(value) &&
  value.schema === OUTBOX_EFFECT_PAYLOAD_SCHEMA &&
  typeof value.effectId === "string" &&
  typeof value.idempotencyKey === "string" &&
  ["accepted", "in-flight", "applied", "failed", "unknown"].includes(String(value.state)) &&
  ["tracker-transition", "tracker-comment", "commit"].includes(String(value.effectKind));

const isReceiptRecord = (value: unknown): value is CommandReceiptRecord =>
  isRecord(value) &&
  value.schema === COMMAND_RECEIPT_PAYLOAD_SCHEMA &&
  typeof value.effectId === "string" &&
  typeof value.attempt === "number" &&
  ["found", "not-found", "unreadable"].includes(String(value.queryVerdict)) &&
  ["applied", "already-applied", "failed", "unknown"].includes(String(value.status));

const readLedger = <T>(
  store: StateStorePort,
  kind: string,
  keyPrefix: string,
  guard: (value: unknown) => value is T,
): EffectLedgerRead<T> => {
  const read = store.readRecords();
  if (!read.ok) return { ok: false, code: read.error.code, path: read.error.location.path };
  const records: T[] = [];
  const latest = new Map<string, T>();
  for (const record of read.value.records) {
    if (!record.key.startsWith(keyPrefix)) continue;
    if (record.kind !== kind || !guard(record.payload)) {
      return { ok: false, code: "state.store.torn", path: read.value.evidence.storePath };
    }
    records.push(record.payload);
    const key = (record.payload as { effectId: string }).effectId;
    latest.set(key, record.payload);
  }
  return {
    ok: true,
    records,
    latest,
    verifiedEmpty: records.length === 0,
    path: read.value.evidence.storePath,
  };
};

const appendRecord = <T extends { readonly effectId: string }>(
  store: StateStorePort,
  fenceToken: string,
  kind: string,
  keyPrefix: string,
  record: T,
): EffectAppendResult<T> => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok)
    return { ok: false, code: acquired.error.code, path: acquired.error.location.path };
  const appended = store.append(acquired.value.handle, {
    kind,
    recordKey: `${keyPrefix}${record.effectId}`,
    payload: record as unknown as StateJsonValue,
  });
  const released = store.releaseFence(acquired.value.handle);
  if (!appended.ok)
    return { ok: false, code: appended.error.code, path: appended.error.location.path };
  if (!released.ok)
    return { ok: false, code: released.error.code, path: released.error.location.path };
  return { ok: true, appended: true, record };
};

export const readOutboxEffects = (store: StateStorePort): EffectLedgerRead<OutboxEffectRecord> =>
  readLedger(store, OUTBOX_EFFECT_RECORD_KIND, "outbox.effects:", isOutboxRecord);

export const readCommandReceipts = (
  store: StateStorePort,
): EffectLedgerRead<CommandReceiptRecord> =>
  readLedger(store, COMMAND_RECEIPT_RECORD_KIND, "command.receipts:", isReceiptRecord);

const intentIdentityOf = (record: OutboxEffectRecord): string => {
  const { recordedAt: _recordedAt, ...identity } = record;
  return JSON.stringify(identity);
};

/**
 * Append one outbox intent. An identical replay of one `effectId` (same
 * message-independent identity, state, and attempts; only the observation time
 * differs) appends nothing and returns the existing record. The dedupe read and
 * the append happen under one fence acquisition so two concurrent same-key
 * appends cannot both observe "no prior" and write a second intent. Receipts
 * remain per-attempt and use `appendRecord` directly.
 */
export const appendOutboxEffect = (
  store: StateStorePort,
  fenceToken: string,
  record: OutboxEffectRecord,
): EffectAppendResult<OutboxEffectRecord> => {
  const acquired = store.acquireFence(fenceToken);
  if (!acquired.ok) {
    // A racing writer may already hold the fence. Re-read once: an identical
    // prior intent is the idempotent outcome, otherwise the busy failure stands.
    const raced = readOutboxEffects(store);
    if (raced.ok) {
      const prior = raced.latest.get(record.effectId);
      if (prior !== undefined && intentIdentityOf(prior) === intentIdentityOf(record)) {
        return { ok: true, appended: false, record: prior };
      }
    }
    return { ok: false, code: acquired.error.code, path: acquired.error.location.path };
  }
  const existing = readOutboxEffects(store);
  if (!existing.ok) {
    store.releaseFence(acquired.value.handle);
    return { ok: false, code: existing.code, path: existing.path };
  }
  const prior = existing.latest.get(record.effectId);
  if (prior !== undefined && intentIdentityOf(prior) === intentIdentityOf(record)) {
    const released = store.releaseFence(acquired.value.handle);
    if (!released.ok) {
      return { ok: false, code: released.error.code, path: released.error.location.path };
    }
    return { ok: true, appended: false, record: prior };
  }
  const appended = store.append(acquired.value.handle, {
    kind: OUTBOX_EFFECT_RECORD_KIND,
    recordKey: outboxEffectRecordKey(record.effectId),
    payload: record as unknown as StateJsonValue,
  });
  const released = store.releaseFence(acquired.value.handle);
  if (!appended.ok) {
    return { ok: false, code: appended.error.code, path: appended.error.location.path };
  }
  if (!released.ok) {
    return { ok: false, code: released.error.code, path: released.error.location.path };
  }
  return { ok: true, appended: true, record };
};

export const appendCommandReceipt = (
  store: StateStorePort,
  fenceToken: string,
  record: CommandReceiptRecord,
): EffectAppendResult<CommandReceiptRecord> =>
  appendRecord(store, fenceToken, COMMAND_RECEIPT_RECORD_KIND, "command.receipts:", record);

export type BeginCommitEffectInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly effectId: string;
  readonly intentId: string;
  readonly ref: string;
  readonly changeRef: string;
  readonly phase: string;
  readonly baselineHead: string;
  readonly stagedPaths: readonly string[];
  readonly payloadDigest: string;
  readonly nowIso: string;
};

/**
 * Append the commit intent before the primitive is invoked (INV-1). The intent
 * carries the message-independent identity and no message content.
 */
export const beginCommitEffect = (
  input: BeginCommitEffectInput,
): EffectAppendResult<OutboxEffectRecord> => {
  const record: OutboxEffectRecord = {
    schema: OUTBOX_EFFECT_PAYLOAD_SCHEMA,
    effectId: input.effectId,
    intentId: input.intentId,
    ref: input.ref,
    effectKind: "commit",
    target: `commit:${input.changeRef}:${input.phase}`,
    payloadDigest: input.payloadDigest,
    idempotencyKey: commitIdempotencyKey(input.changeRef, input.phase, input.baselineHead),
    state: "accepted",
    attempts: 0,
    checkStrategy: "query-by-log-since",
    baselineHead: input.baselineHead,
    changeRef: input.changeRef,
    phase: input.phase,
    stagedPaths: normalizeStagedPaths(input.stagedPaths),
    recordedAt: input.nowIso,
  };
  // One intent per commit effect: a re-drive of the same effect identity reuses
  // the recorded intent and never appends a second one.
  const existing = readOutboxEffects(input.store);
  if (existing.ok) {
    const prior = existing.latest.get(record.effectId);
    if (prior !== undefined) return { ok: true, appended: false, record: prior };
  }
  return appendOutboxEffect(input.store, input.fenceToken, record);
};

export type RecoverCommitEffectInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly effectId: string;
  readonly log: CommitLogPort;
  readonly nowIso: string;
  readonly cap?: number;
};

export type RecoverCommitEffectResult =
  | { readonly ok: true; readonly status: "already-applied"; readonly sha: string }
  | { readonly ok: true; readonly status: "unknown"; readonly receipt: CommandReceiptRecord }
  | { readonly ok: false; readonly code: string; readonly path: string };

/** One bounded log read, then `applied` only for exactly one matching commit. */
export const recoverCommitEffect = async (
  input: RecoverCommitEffectInput,
): Promise<RecoverCommitEffectResult> => {
  const effects = readOutboxEffects(input.store);
  if (!effects.ok) return { ok: false, code: effects.code, path: effects.path };
  const record = effects.latest.get(input.effectId);
  if (record === undefined) {
    return { ok: false, code: "state.keys.missing", path: "outbox.effects" };
  }
  const read = await input.log.logSince(record.baselineHead ?? "", input.cap ?? 32);
  const outcome = resolveCommitEffect(record, read);
  const receipt: CommandReceiptRecord = {
    schema: COMMAND_RECEIPT_PAYLOAD_SCHEMA,
    effectId: record.effectId,
    attempt: record.attempts,
    queryVerdict: outcome.verdict,
    status: outcome.status,
    evidence: [{ key: "check", value: "query-by-log-since" }],
    ...(outcome.discoveredSha === undefined ? {} : { discoveredSha: outcome.discoveredSha }),
    ...(record.baselineHead === undefined ? {} : { baselineHead: record.baselineHead }),
    recordedAt: input.nowIso,
  };
  const appended = appendCommandReceipt(input.store, input.fenceToken, receipt);
  if (!appended.ok) return { ok: false, code: appended.code, path: appended.path };
  return outcome.status === "already-applied" && outcome.discoveredSha !== undefined
    ? { ok: true, status: "already-applied", sha: outcome.discoveredSha }
    : { ok: true, status: "unknown", receipt: appended.record };
};

/** The DM-18 redrive request: evidence only, `attempt: 0`, never an apply. */
export const recordRedriveRequest = (
  store: StateStorePort,
  fenceToken: string,
  request: {
    readonly effectId: string;
    readonly baselineHead?: string;
    readonly queryVerdict: "found" | "not-found" | "unreadable";
    readonly discoveredSha?: string;
    readonly nowIso: string;
  },
): EffectAppendResult<CommandReceiptRecord> =>
  appendCommandReceipt(store, fenceToken, {
    schema: COMMAND_RECEIPT_PAYLOAD_SCHEMA,
    effectId: request.effectId,
    attempt: 0,
    queryVerdict: request.queryVerdict,
    status: "unknown",
    evidence: [{ key: "redrive", value: "DM-18" }],
    ...(request.discoveredSha === undefined ? {} : { discoveredSha: request.discoveredSha }),
    ...(request.baselineHead === undefined ? {} : { baselineHead: request.baselineHead }),
    recordedAt: request.nowIso,
  });

/** Convenience exports for the effect keys (tests and composition). */
export { commandReceiptRecordKey, outboxEffectRecordKey };

export type DaemonEffectDetectionInput = {
  readonly list: () => readonly OutboxEffectRecord[];
  readonly logSince: (baselineHead: string) => Promise<CommitLogRead>;
  readonly record: (request: {
    readonly effectId: string;
    readonly baselineHead?: string;
    readonly queryVerdict: "found" | "not-found" | "unreadable";
    readonly discoveredSha?: string;
  }) => { readonly ok: true } | { readonly ok: false; readonly code: string };
  readonly nowIso: string;
  /** The one bounded read per commit effect; defaults to the effect protocol cap. */
  readonly readPath?: "log-since";
};

/**
 * The daemon's detection duty (TDR-0014 INV-7): scan unresolved effects, perform
 * exactly one bounded query per commit effect, and record the DM-18 redrive
 * request. Never applies, never creates a commit, never runs a phase.
 */
export const detectDaemonEffects = async (
  input: DaemonEffectDetectionInput,
): Promise<
  { readonly ok: true; readonly requests: number } | { readonly ok: false; readonly code: string }
> => {
  let requests = 0;
  for (const effect of input.list()) {
    if (effect.state !== "in-flight" && effect.state !== "unknown") continue;
    if (effect.effectKind === "commit" && effect.baselineHead !== undefined) {
      const read = await input.logSince(effect.baselineHead);
      // Reuse the same match rule as the owner-side recovery: `found` and a SHA
      // only for exactly one new commit whose normalized changed-path set equals
      // the recorded set. Zero, multiple, mismatch, or unreadable stays without
      // a SHA (TDR-0014 INV-5/INV-6).
      const outcome = resolveCommitEffect(
        {
          baselineHead: effect.baselineHead,
          ...(effect.stagedPaths === undefined ? {} : { stagedPaths: effect.stagedPaths }),
        },
        read,
      );
      const recorded = input.record({
        effectId: effect.effectId,
        baselineHead: effect.baselineHead,
        queryVerdict: outcome.verdict,
        ...(outcome.status === "already-applied" && outcome.discoveredSha !== undefined
          ? { discoveredSha: outcome.discoveredSha }
          : {}),
      });
      if (!recorded.ok) return { ok: false, code: recorded.code };
      requests += 1;
      continue;
    }
    const recorded = input.record({ effectId: effect.effectId, queryVerdict: "unreadable" });
    if (!recorded.ok) return { ok: false, code: recorded.code };
    requests += 1;
  }
  return { ok: true, requests };
};
