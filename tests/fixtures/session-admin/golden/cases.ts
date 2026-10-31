/**
 * Deterministic human-golden data (test-plan §6.2). No absolute paths, no host
 * timestamps, no content fields; the binary name comes from the injected brand.
 */
import {
  DB_SCHEMA_VERSION,
  type ListData,
  type PruneData,
  type RebootData,
  type SizeData,
} from "../../../../packages/core/src/contracts/index";
import { DAY_MS, NOW_MS, SYNTHETIC_DB_PATH } from "../harness";
import { makeSession } from "../store";

const iso = (offsetMs: number): string => new Date(NOW_MS - offsetMs).toISOString();

const summary = (id: string, offset: number, live = false) => {
  const session = makeSession({
    id,
    timeCreated: NOW_MS - offset - DAY_MS,
    timeUpdated: NOW_MS - offset,
    messageCount: 2,
    partCount: 1,
    dataBytes: 11,
  });
  return {
    id: session.id,
    createdAt: new Date(session.timeCreated).toISOString(),
    updatedAt: new Date(session.timeUpdated).toISOString(),
    messageCount: session.messageCount,
    partCount: session.partCount,
    dataBytes: session.dataBytes,
    archived: false,
    live,
  };
};

export const GOLDEN_SIZE: SizeData = {
  schemaVersion: DB_SCHEMA_VERSION,
  command: "size",
  database: {
    path: SYNTHETIC_DB_PATH,
    dbBytes: 4096,
    walBytes: 512,
    shmBytes: 0,
    walPresent: true,
    shmPresent: false,
  },
  counts: { sessions: 3, messages: 7, parts: 9 },
  oldestSessionUpdatedAt: iso(30 * DAY_MS),
  newestSessionUpdatedAt: iso(1_000),
};

export const GOLDEN_LIST: ListData = {
  schemaVersion: DB_SCHEMA_VERSION,
  command: "list",
  limit: 20,
  total: 3,
  omitted: 0,
  truncated: false,
  items: [
    summary("ses_alpha", 1_000, true),
    summary("ses_beta", 2_000),
    summary("ses_gamma", 3_000),
  ],
};

export const GOLDEN_PRUNE_DRY: PruneData = {
  schemaVersion: DB_SCHEMA_VERSION,
  command: "prune",
  mode: "dry-run",
  olderThanDays: 30,
  limit: 50,
  liveWindowMinutes: 15,
  cutoff: iso(30 * DAY_MS),
  counts: { selected: 2, deleted: 0, failed: 0, skipped: 0, liveExcluded: 0 },
  candidates: [summary("ses_alpha", 30 * DAY_MS + 1_000), summary("ses_beta", 30 * DAY_MS + 2_000)],
};

export const GOLDEN_PRUNE_APPLIED: PruneData = {
  ...GOLDEN_PRUNE_DRY,
  mode: "applied",
  counts: { selected: 2, deleted: 2, failed: 0, skipped: 0, liveExcluded: 0 },
};

export const GOLDEN_REBOOT_DRY: RebootData = {
  schemaVersion: DB_SCHEMA_VERSION,
  command: "reboot",
  mode: "dry-run",
  liveWindowMinutes: 15,
  liveSessions: 1,
  blockedByLiveSession: true,
  checkpointPerformed: false,
  database: {
    path: SYNTHETIC_DB_PATH,
    walBytesBefore: 19_800_000,
    walPresent: true,
    shmPresent: true,
  },
};

export const GOLDEN_REBOOT_APPLIED: RebootData = {
  schemaVersion: DB_SCHEMA_VERSION,
  command: "reboot",
  mode: "applied",
  liveWindowMinutes: 15,
  liveSessions: 0,
  blockedByLiveSession: false,
  checkpointPerformed: true,
  database: {
    path: SYNTHETIC_DB_PATH,
    walBytesBefore: 19_800_000,
    walBytesAfter: 0,
    walPresent: true,
    shmPresent: true,
  },
};

export const GOLDEN_DATA = {
  size: GOLDEN_SIZE,
  list: GOLDEN_LIST,
  "prune-dry": GOLDEN_PRUNE_DRY,
  "prune-applied": GOLDEN_PRUNE_APPLIED,
  "reboot-dry": GOLDEN_REBOOT_DRY,
  "reboot-applied": GOLDEN_REBOOT_APPLIED,
} as const;
