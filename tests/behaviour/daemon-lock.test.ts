/**
 * TC-LOCK-001..004 / TC-LOCK-006 — the fence-style daemon lock: live refusal,
 * evidenced stale takeover, token-only removal, and separation from the state
 * writer fence.
 */
import { describe, expect, test } from "bun:test";
import {
  daemonScopeDigest,
  evaluateDaemonLock,
  takeoverEvidence,
} from "../../packages/core/src/domain/index";
import { appendDaemonInstance, readDaemonInstance } from "../../packages/core/src/app/index";
import {
  DAEMON_INSTANCE_PAYLOAD_SCHEMA,
  type DaemonInstanceRecord,
  type DaemonLockRecord,
} from "../../packages/core/src/contracts/index";
import { createDaemonLockPort } from "../../packages/core/src/state/index";
import {
  createTestEdge,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";
const NOW_MS = Date.parse(NOW);
const STALENESS = 30_000;

const lockRecord = (overrides: Partial<DaemonLockRecord> = {}): DaemonLockRecord => ({
  lockToken: "token-a",
  instanceId: "instance-a",
  pid: 4242,
  scope: daemonScopeDigest("/state/one"),
  acquiredAt: NOW,
  heartbeatAt: NOW,
  ...overrides,
});

describe("GH-238 daemon lock", () => {
  test("scope digest is the first 16 lowercase hex characters and never the path", () => {
    const digest = daemonScopeDigest("/state/one");
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
    expect(digest).not.toContain("/state");
    expect(daemonScopeDigest("/state/two")).not.toBe(digest);
  });

  test("a live holder refuses with identity, pid, and heartbeat age", () => {
    const decision = evaluateDaemonLock({
      lock: { state: "held", record: lockRecord() },
      nowMs: NOW_MS + 5_000,
      stalenessMs: STALENESS,
    });
    expect(decision.kind).toBe("already-running");
    if (decision.kind !== "already-running") return;
    expect(decision.holder.instanceId).toBe("instance-a");
    expect(decision.holder.pid).toBe(4242);
    expect(decision.heartbeatAgeMs).toBe(5_000);
  });

  test("staleness is at-bound stale and bound-1 live", () => {
    const atBound = evaluateDaemonLock({
      lock: { state: "held", record: lockRecord() },
      nowMs: NOW_MS + STALENESS,
      stalenessMs: STALENESS,
    });
    expect(atBound.kind).toBe("takeover");
    const belowBound = evaluateDaemonLock({
      lock: { state: "held", record: lockRecord() },
      nowMs: NOW_MS + STALENESS - 1,
      stalenessMs: STALENESS,
    });
    expect(belowBound.kind).toBe("already-running");
  });

  test("stale takeover evidence carries every previous-instance field", () => {
    const evidence = takeoverEvidence(lockRecord(), STALENESS, NOW);
    expect(Object.keys(evidence).sort()).toEqual([
      "heartbeatAgeMs",
      "lastHeartbeatAt",
      "previousInstanceId",
      "previousLockToken",
      "takenOverAt",
    ]);
    expect(evidence.previousLockToken).toBe("token-a");
  });

  test("exclusive create, token-only heartbeat and removal", () => {
    const root = makeTempRoot("gh238-lock");
    try {
      const edge = createTestEdge();
      edge.ensureDirectory(root);
      const port = createDaemonLockPort(edge, root);
      expect(port.read().state).toBe("absent");
      expect(port.acquire(lockRecord())).toEqual({ ok: true });
      const held = port.read();
      expect(held.state).toBe("held");
      expect(port.acquire(lockRecord({ lockToken: "token-b" }))).toMatchObject({
        ok: false,
        code: "state.lock.busy",
      });
      expect(port.heartbeat("wrong", NOW)).toMatchObject({ ok: false });
      expect(port.remove("wrong")).toMatchObject({ ok: false });
      expect(port.heartbeat("token-a", "2026-11-08T10:00:05Z")).toEqual({ ok: true });
      expect(port.remove("token-a")).toEqual({ ok: true });
      expect(port.read().state).toBe("absent");
    } finally {
      removeRoot(root);
    }
  });

  test("the daemon lock is not the state writer fence", () => {
    const root = makeTempRoot("gh238-lock-fence");
    try {
      const identity = makeIdentity(root, { fenceNamespace: "state-fence" });
      const { store, edge } = openStore(identity);
      const port = createDaemonLockPort(edge, root);
      // A held state fence does not create the daemon lock artifact.
      const fence = store.acquireFence("fence-token");
      expect(fence.ok).toBe(true);
      expect(port.read().state).toBe("absent");
      if (fence.ok) store.releaseFence(fence.value.handle);
      // A held daemon lock does not block a short append fence.
      expect(port.acquire(lockRecord())).toEqual({ ok: true });
      const second = store.acquireFence("append-token");
      expect(second.ok).toBe(true);
      if (second.ok) store.releaseFence(second.value.handle);
    } finally {
      removeRoot(root);
    }
  });

  test("two state directories hold independent locks", () => {
    const first = makeTempRoot("gh238-lock-one");
    const second = makeTempRoot("gh238-lock-two");
    try {
      const edgeA = createTestEdge();
      const edgeB = createTestEdge();
      edgeA.ensureDirectory(first);
      edgeB.ensureDirectory(second);
      const lockA = createDaemonLockPort(edgeA, first);
      const lockB = createDaemonLockPort(edgeB, second);
      expect(
        lockA.acquire(lockRecord({ instanceId: "a", scope: daemonScopeDigest(first) })),
      ).toEqual({ ok: true });
      expect(
        lockB.acquire(lockRecord({ instanceId: "b", scope: daemonScopeDigest(second) })),
      ).toEqual({ ok: true });
      expect(lockA.read().state).toBe("held");
      expect(lockB.read().state).toBe("held");
    } finally {
      removeRoot(first);
      removeRoot(second);
    }
  });
});

describe("GH-238 instance ledger", () => {
  test("acquisition round-trips, an identical replay appends nothing, and takeover carries evidence", () => {
    const fixture = { root: makeTempRoot("gh238-instance") };
    try {
      const { store } = openStore(makeIdentity(fixture.root));
      const base: DaemonInstanceRecord = {
        schema: DAEMON_INSTANCE_PAYLOAD_SCHEMA,
        instanceId: "instance-a",
        pid: 10,
        scope: daemonScopeDigest(fixture.root),
        lockToken: "token-a",
        operation: "acquired",
        acquiredAt: NOW,
        heartbeatAt: NOW,
        recordedAt: NOW,
      };
      expect(appendDaemonInstance(store, "fence-1", base)).toMatchObject({
        ok: true,
        appended: true,
      });
      expect(appendDaemonInstance(store, "fence-2", base)).toMatchObject({
        ok: true,
        appended: false,
      });
      expect(readDaemonInstance(store).ok).toBe(true);
      const second: DaemonInstanceRecord = {
        ...base,
        instanceId: "instance-b",
        lockToken: "token-b",
        operation: "acquired",
        recordedAt: "2026-11-08T10:00:01Z",
      };
      expect(appendDaemonInstance(store, "fence-3", second)).toMatchObject({
        ok: false,
        code: "state.lock.busy",
      });
      const takenOver: DaemonInstanceRecord = {
        ...second,
        operation: "taken-over",
        takeover: takeoverEvidence(lockRecord(), STALENESS, NOW),
      };
      expect(appendDaemonInstance(store, "fence-4", takenOver)).toMatchObject({
        ok: true,
        appended: true,
      });
      const read = readDaemonInstance(store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.latest?.operation).toBe("taken-over");
    } finally {
      removeRoot(fixture.root);
    }
  });
});
