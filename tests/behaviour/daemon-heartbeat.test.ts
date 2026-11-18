/**
 * TC-HEART-001/002 — heartbeat content, ordinal monotonicity, interval
 * boundaries, the three-state fold, and no fabricated beat.
 */
import { describe, expect, test } from "bun:test";
import { appendDaemonHeartbeat, readDaemonHeartbeat } from "../../packages/core/src/app/index";
import { buildHeartbeat, foldDaemonLiveness } from "../../packages/core/src/domain/index";
import {
  DAEMON_INSTANCE_PAYLOAD_SCHEMA,
  type DaemonHeartbeatRecord,
  type DaemonInstanceRecord,
} from "../../packages/core/src/contracts/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";
const NOW_MS = Date.parse(NOW);
const STALENESS = 30_000;

const heartbeatAt = (ordinal: number): DaemonHeartbeatRecord =>
  buildHeartbeat({
    instanceId: "instance-a",
    ordinal,
    beatAt: new Date(NOW_MS + ordinal * 5_000).toISOString(),
    uptimeMs: ordinal * 5_000,
    queueDepth: 3,
    laneCounts: { delivering: 1, idle: 1, parked: 1, failed: 0 },
    currentSpawn: { ref: "GH-238", sessionId: "session-a" },
    cursor: 7,
    recordedAt: new Date(NOW_MS + ordinal * 5_000).toISOString(),
  });

const instanceAt = (operation: DaemonInstanceRecord["operation"]): DaemonInstanceRecord => ({
  schema: DAEMON_INSTANCE_PAYLOAD_SCHEMA,
  instanceId: "instance-a",
  pid: 10,
  scope: "scope-a",
  lockToken: "token-a",
  operation,
  acquiredAt: NOW,
  heartbeatAt: NOW,
  recordedAt: NOW,
});

describe("GH-238 heartbeat", () => {
  test("a beat carries ordinal, depth, lane counts, current spawn, and cursor", () => {
    const beat = heartbeatAt(1);
    expect(beat.queueDepth).toBe(3);
    expect(beat.laneCounts).toEqual({ delivering: 1, idle: 1, parked: 1, failed: 0 });
    expect(beat.currentSpawn).toEqual({ ref: "GH-238", sessionId: "session-a" });
    expect(beat.cursor).toBe(7);
  });

  test("ordinals are monotone and a non-increasing ordinal is refused", () => {
    const root = makeTempRoot("gh238-heartbeat");
    try {
      const { store } = openStore(makeIdentity(root));
      expect(appendDaemonHeartbeat(store, "fence-1", heartbeatAt(1))).toMatchObject({
        ok: true,
        appended: true,
      });
      expect(appendDaemonHeartbeat(store, "fence-2", heartbeatAt(2))).toMatchObject({
        ok: true,
        appended: true,
      });
      expect(appendDaemonHeartbeat(store, "fence-3", heartbeatAt(2))).toMatchObject({ ok: false });
      const read = readDaemonHeartbeat(store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.latest?.ordinal).toBe(2);
    } finally {
      removeRoot(root);
    }
  });

  test("the fold is running below the bound, stale at the bound, stopped on release", () => {
    const running = foldDaemonLiveness({
      instance: instanceAt("acquired"),
      heartbeat: heartbeatAt(1),
      nowMs: NOW_MS + 5_000 + STALENESS - 1,
      stalenessMs: STALENESS,
    });
    expect(running.state).toBe("running");
    const stale = foldDaemonLiveness({
      instance: instanceAt("acquired"),
      heartbeat: heartbeatAt(1),
      nowMs: NOW_MS + 5_000 + STALENESS,
      stalenessMs: STALENESS,
    });
    expect(stale.state).toBe("stale");
    expect(stale.ageMs).toBe(STALENESS);
    const stopped = foldDaemonLiveness({
      instance: instanceAt("released"),
      heartbeat: heartbeatAt(1),
      nowMs: NOW_MS,
      stalenessMs: STALENESS,
    });
    expect(stopped.state).toBe("stopped");
  });

  test("an absent beat is stale evidence and a reader never fabricates one", () => {
    const root = makeTempRoot("gh238-heartbeat-absent");
    try {
      const { store } = openStore(makeIdentity(root));
      const before = readDaemonHeartbeat(store);
      expect(before.ok).toBe(true);
      if (before.ok) {
        expect(before.latest).toBeUndefined();
        expect(before.verifiedEmpty).toBe(true);
      }
      const fold = foldDaemonLiveness({
        instance: undefined,
        heartbeat: undefined,
        nowMs: NOW_MS,
        stalenessMs: STALENESS,
      });
      expect(fold.state).toBe("stale");
      expect(fold.ageMs).toBeNull();
      const after = readDaemonHeartbeat(store);
      expect(after.ok).toBe(true);
      if (after.ok) expect(after.records).toHaveLength(0);
    } finally {
      removeRoot(root);
    }
  });
});
