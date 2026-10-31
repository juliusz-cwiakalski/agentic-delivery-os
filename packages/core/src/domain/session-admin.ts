/**
 * Pure session-admin policy and human rendering (GH-180 PIN-2, PIN-8).
 *
 * No I/O, clock, randomness, or ambient environment: every variable fact
 * arrives through an argument. This module is the single home of the
 * cold/live/leaf predicate, so selection and the pre-delete re-check cannot
 * drift.
 */
import type { BrandIdentity } from "../contracts/index.js";
import {
  DB_LIVE_WINDOW_MINUTES,
  DB_MAX_HUMAN_BYTES,
  DB_MAX_HUMAN_ITEMS,
  DB_MAX_HUMAN_LINES,
  type ListData,
  type PruneData,
  type RebootData,
  type SessionSummary,
  type SizeData,
} from "../contracts/session.js";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** One candidate fact carried by selection and the pre-delete re-check. */
export type PruneCandidateFact = {
  readonly id: string;
  readonly updatedAtMs: number;
  readonly hasChildren: boolean;
  readonly summary: SessionSummary;
};

/** The single cold/live/leaf decision. */
export type PruneCandidateDecision =
  | { readonly eligible: true }
  | { readonly eligible: false; readonly reason: "live" | "warm" | "parent" };

/** The prune cutoff for an injected clock and threshold (spec §3.10). */
export function computeDbCutoffMs(nowMs: number, olderThanDays: number): number {
  return nowMs - olderThanDays * DAY_MS;
}

/** The inclusive live-window lower boundary for an injected clock. */
export function computeDbLiveBoundaryMs(nowMs: number): number {
  return nowMs - DB_LIVE_WINDOW_MINUTES * MINUTE_MS;
}

/** A session is live when it was updated inside the inclusive window. */
export function isLiveDbSession(updatedAtMs: number, nowMs: number): boolean {
  return updatedAtMs >= computeDbLiveBoundaryMs(nowMs);
}

/**
 * Classify one candidate. Order is normative: live first, then warm, then
 * parent; only a cold, non-live, childless session is eligible.
 */
export function classifyPruneCandidate(
  fact: PruneCandidateFact,
  input: { readonly nowMs: number; readonly olderThanDays: number },
): PruneCandidateDecision {
  if (isLiveDbSession(fact.updatedAtMs, input.nowMs)) {
    return { eligible: false, reason: "live" };
  }
  if (fact.updatedAtMs >= computeDbCutoffMs(input.nowMs, input.olderThanDays)) {
    return { eligible: false, reason: "warm" };
  }
  if (fact.hasChildren) {
    return { eligible: false, reason: "parent" };
  }
  return { eligible: true };
}

/** Filter eligible facts, order oldest-first then by id, and cap at `limit`. */
export function selectPruneCandidates(
  facts: readonly PruneCandidateFact[],
  input: { readonly nowMs: number; readonly olderThanDays: number; readonly limit: number },
): readonly PruneCandidateFact[] {
  const cap = Math.max(0, Math.trunc(input.limit));
  return facts
    .filter((fact) => classifyPruneCandidate(fact, input).eligible)
    .sort((left, right) => {
      if (left.updatedAtMs !== right.updatedAtMs) return left.updatedAtMs - right.updatedAtMs;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    })
    .slice(0, cap);
}

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

const moreLine = (count: number): string => `  +${count} more`;

const bounded = (header: readonly string[], items: readonly string[], total: number): string => {
  let rendered = Math.min(items.length, DB_MAX_HUMAN_ITEMS);
  const build = (count: number): string[] => {
    const lines = [...header, ...items.slice(0, count)];
    const more = total - count;
    if (more > 0) lines.push(moreLine(more));
    return lines;
  };
  let lines = build(rendered);
  while (
    rendered > 0 &&
    (lines.length > DB_MAX_HUMAN_LINES || byteLength(lines.join("\n")) > DB_MAX_HUMAN_BYTES)
  ) {
    rendered -= 1;
    lines = build(rendered);
  }
  return `${lines.join("\n")}\n`;
};

const itemLine = (summary: SessionSummary): string => {
  const parent = summary.parentId === undefined ? "" : `  parent ${summary.parentId}`;
  const archived = summary.archived ? "  archived" : "";
  return `  ${summary.id}  ${summary.live ? "live" : "idle"}  updated ${summary.updatedAt}  messages ${summary.messageCount} | parts ${summary.partCount} | bytes ${summary.dataBytes}${parent}${archived}`;
};

const candidateLine = (summary: SessionSummary): string =>
  `  ${summary.id}  updated ${summary.updatedAt}  messages ${summary.messageCount} | parts ${summary.partCount} | bytes ${summary.dataBytes}`;

const renderSize = (data: SizeData, brand: BrandIdentity): string => {
  const { database, counts } = data;
  const sidecar = (bytes: number, present: boolean): string =>
    `${bytes} B (${present ? "present" : "absent"})`;
  const header = [
    `${brand.binaryName} db size  ${database.path}  db ${database.dbBytes} B | wal ${sidecar(database.walBytes, database.walPresent)} | shm ${sidecar(database.shmBytes, database.shmPresent)}`,
    `sessions ${counts.sessions} | messages ${counts.messages} | parts ${counts.parts}  oldest ${data.oldestSessionUpdatedAt ?? "none"} | newest ${data.newestSessionUpdatedAt ?? "none"}`,
  ];
  return bounded(header, [], 0);
};

const renderList = (data: ListData, brand: BrandIdentity): string => {
  const live = data.items.filter((item) => item.live).length;
  const header = [
    `${brand.binaryName} db list  ${data.items.length} of ${data.total} sessions  limit ${data.limit}  live in page ${live}`,
  ];
  return bounded(header, data.items.map(itemLine), data.total);
};

const renderPrune = (data: PruneData, brand: BrandIdentity): string => {
  const header = [
    `${brand.binaryName} db prune  ${data.mode}  older than ${data.olderThanDays} d | live window ${data.liveWindowMinutes} min | limit ${data.limit}`,
    `  candidates ${data.counts.selected} | deleted ${data.counts.deleted} | failed ${data.counts.failed} | skipped ${data.counts.skipped} | live excluded ${data.counts.liveExcluded}`,
  ];
  return bounded(header, data.candidates.map(candidateLine), data.candidates.length);
};

const renderReboot = (data: RebootData, brand: BrandIdentity): string => {
  const after =
    data.database.walBytesAfter === undefined ? "unchanged" : `${data.database.walBytesAfter}`;
  const lines = [
    `${brand.binaryName} db reboot  ${data.mode}  live sessions ${data.liveSessions} | checkpoint ${data.checkpointPerformed ? "performed" : "not-performed"}`,
    `  wal ${data.database.walBytesBefore} B -> ${after} B`,
    "  restart the opencode host manually; this command only prepares the database",
  ];
  return `${lines.join("\n")}\n`;
};

/** Deterministic human text from the data and the injected brand only. */
export function renderSessionAdminHuman(
  data: SizeData | ListData | PruneData | RebootData,
  brand: BrandIdentity,
): string {
  switch (data.command) {
    case "size":
      return renderSize(data, brand);
    case "list":
      return renderList(data, brand);
    case "prune":
      return renderPrune(data, brand);
    case "reboot":
      return renderReboot(data, brand);
    default:
      return "";
  }
}
