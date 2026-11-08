/**
 * TC-RECON-001..006/009 — startup reconciliation: alive/interrupted/crashed,
 * evidence-insufficient hold, replay idempotence, budget exhaustion, and
 * fail-closed unreadable state.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDaemonLane,
  readDaemonLanes,
  readDaemonReconciliations,
  reconcileDaemon,
} from "../../packages/core/src/app/index";
import {
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type DaemonLaneRecord,
  type DaemonRecoveryPort,
  type EconomicsExhaustionRecord,
  type EconomicsRestartRecord,
  QUEUE_PARK_KEY_PREFIX,
  QUEUE_PARK_RECORD_KIND,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import { createParkRecord } from "../../packages/core/src/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";

const lane = (ref: string, overrides: Partial<DaemonLaneRecord> = {}): DaemonLaneRecord => ({
  schema: DAEMON_LANE_PAYLOAD_SCHEMA,
  ref,
  state: "delivering",
  sessionId: `session-${ref}`,
  processId: 100,
  ledgerPosition: { lastCompletedPhase: "6" },
  spawnOrdinal: 1,
  recordedAt: NOW,
  ...overrides,
});

const recovery = () => {
  const restarts = new Map<string, EconomicsRestartRecord[]>();
  const exhausted: EconomicsExhaustionRecord[] = [];
  const questions: string[] = [];
  const port: DaemonRecoveryPort = {
    readRestarts: (ref) => ({ ok: true, records: restarts.get(ref) ?? [] }),
    appendRestart: (record) => {
      const list = restarts.get(record.workItemRef) ?? [];
      list.push(record);
      restarts.set(record.workItemRef, list);
      return { ok: true, appended: true, record };
    },
    ensureExhaustion: (record) => {
      exhausted.push(record);
      return { ok: true, appended: true, record };
    },
    raiseQuestion: ({ ref }) => {
      const id = `q-${ref}`;
      questions.push(id);
      return { ok: true, questionId: id };
    },
  };
  return { port, restarts, exhausted, questions };
};

const fixture = () => {
  const root = makeTempRoot("gh238-recon");
  const { store } = openStore(makeIdentity(root));
  return { root, store };
};

const seed = (store: StateStorePort, ref: string, overrides: Partial<DaemonLaneRecord> = {}) => {
  const appended = appendDaemonLane(store, `seed-${ref}`, lane(ref, overrides));
  expect(appended.ok).toBe(true);
};

describe("GH-238 startup reconciliation", () => {
  test("L1 alive/reattach, L2 interrupted/resume at phase 8, L3 crashed with its reason", () => {
    const { root, store } = fixture();
    try {
      seed(store, "L1");
      seed(store, "L2");
      seed(store, "L3");
      const rec = recovery();
      const result = reconcileDaemon({
        store,
        fenceToken: "recon-1",
        instanceId: "instance-1",
        nowIso: NOW,
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: rec.port,
        evidence: (record) => {
          if (record.ref === "L1") return { processObservable: true, sessionObservable: true };
          if (record.ref === "L2") {
            return { processObservable: false, sessionObservable: false, lastCompletedPhase: "7" };
          }
          return {
            processObservable: false,
            sessionObservable: false,
            failureReason: "crash",
          };
        },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const byRef = new Map(result.decisions.map((decision) => [decision.ref, decision]));
      expect(byRef.get("L1")).toMatchObject({
        classification: "alive",
        action: "reattach",
        restarts: 0,
      });
      expect(byRef.get("L2")).toMatchObject({
        classification: "interrupted",
        action: "resume",
        resumeFromPhase: "8",
        nextRestartOrdinal: 1,
      });
      expect(byRef.get("L3")).toMatchObject({ classification: "crashed", action: "resume" });
      expect(result.record.duplicates).toBe(0);
      expect(rec.restarts.get("L2")?.[0]?.ordinal).toBe(1);
      expect(readDaemonLanes(store).ok).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("insufficient evidence holds the lane instead of guessing", () => {
    const { root, store } = fixture();
    try {
      seed(store, "HOLD");
      const rec = recovery();
      const result = reconcileDaemon({
        store,
        fenceToken: "recon-2",
        instanceId: "instance-2",
        nowIso: NOW,
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: rec.port,
        evidence: () => ({ evidenceComplete: false }),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.decisions[0]).toMatchObject({
        action: "hold",
        reason: "evidence-insufficient",
      });
    } finally {
      removeRoot(root);
    }
  });

  test("a replayed reconciliation appends no second report and increments nothing", () => {
    const { root, store } = fixture();
    try {
      seed(store, "L2");
      const rec = recovery();
      const input = {
        store,
        fenceToken: "recon-3",
        instanceId: "instance-3",
        nowIso: NOW,
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: rec.port,
        evidence: () => ({ processObservable: false, sessionObservable: false }),
      } as const;
      const first = reconcileDaemon(input);
      const second = reconcileDaemon(input);
      expect(first.ok && second.ok).toBe(true);
      expect(rec.restarts.get("L2")).toHaveLength(1);
      const reports = readDaemonReconciliations(store);
      expect(reports.ok).toBe(true);
      if (reports.ok)
        expect(reports.records.filter((report) => report.instanceId === "instance-3")).toHaveLength(
          1,
        );
    } finally {
      removeRoot(root);
    }
  });

  test("budget exhaustion is terminal, records economics, and raises a typed question", () => {
    const { root, store } = fixture();
    try {
      seed(store, "GH-315");
      const rec = recovery();
      rec.restarts.set("GH-315", [
        {
          schemaId: "delivery.economics.restart.v1",
          workItemRef: "GH-315",
          runId: "r",
          sessionId: "s",
          ordinal: 1,
          reason: "session-interrupted",
          recordedAt: NOW,
        },
        {
          schemaId: "delivery.economics.restart.v1",
          workItemRef: "GH-315",
          runId: "r",
          sessionId: "s",
          ordinal: 2,
          reason: "session-interrupted",
          recordedAt: NOW,
        },
        {
          schemaId: "delivery.economics.restart.v1",
          workItemRef: "GH-315",
          runId: "r",
          sessionId: "s",
          ordinal: 3,
          reason: "session-interrupted",
          recordedAt: NOW,
        },
      ]);
      const result = reconcileDaemon({
        store,
        fenceToken: "recon-4",
        instanceId: "instance-4",
        nowIso: NOW,
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: rec.port,
        evidence: () => ({
          processObservable: false,
          sessionObservable: false,
          failureReason: "spawn-failed",
        }),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.decisions[0]).toMatchObject({
        action: "terminal-failed",
        reason: "restart-budget-exhausted",
      });
      expect(rec.exhausted).toHaveLength(1);
      expect(rec.questions).toEqual(["q-GH-315"]);
      const laneRead = readDaemonLanes(store);
      expect(laneRead.ok).toBe(true);
      if (laneRead.ok) expect(laneRead.latest?.state).toBe("failed");
    } finally {
      removeRoot(root);
    }
  });

  test("the reconciliation report carries the folded active park count", () => {
    const { root, store } = fixture();
    try {
      const acquired = store.acquireFence("park-seed");
      expect(acquired.ok).toBe(true);
      if (acquired.ok) {
        const park = createParkRecord({
          ref: "GH-1",
          cause: "provider-quota",
          condition: { type: "provider-quota" },
          recheckMs: 60_000,
          evaluatedAt: NOW,
          recordedAt: NOW,
        });
        expect(
          store.append(acquired.value.handle, {
            kind: QUEUE_PARK_RECORD_KIND,
            recordKey: `${QUEUE_PARK_KEY_PREFIX}${park.ref}`,
            payload: park as never,
          }).ok,
        ).toBe(true);
        store.releaseFence(acquired.value.handle);
      }
      const result = reconcileDaemon({
        store,
        fenceToken: "recon-parks",
        instanceId: "instance-parks",
        nowIso: NOW,
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: recovery().port,
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.record.queue.parks).toBe(1);
    } finally {
      removeRoot(root);
    }
  });

  test("the duplicate count is computed from the verified ledger", () => {
    const { root, store } = fixture();
    try {
      const duplicate = lane("DUP");
      const acquired = store.acquireFence("dup-fence");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      for (let index = 0; index < 2; index += 1) {
        const appended = store.append(acquired.value.handle, {
          kind: "daemon.lane",
          recordKey: "daemon.lanes:DUP",
          payload: duplicate as never,
        });
        expect(appended.ok).toBe(true);
      }
      store.releaseFence(acquired.value.handle);
      const result = reconcileDaemon({
        store,
        fenceToken: "recon-dup",
        instanceId: "instance-dup",
        nowIso: NOW,
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: recovery().port,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.record.duplicates).toBe(1);
    } finally {
      removeRoot(root);
    }
  });

  test("unreadable state refuses the start with daemon.state-recovery-failed", () => {
    const { root, store } = fixture();
    try {
      const broken: StateStorePort = {
        ...store,
        readRecords: () => ({
          ok: false,
          error: {
            kind: "state",
            code: "state.store.torn",
            consequence: "not_landed",
            location: { path: "/broken" },
          },
        }),
      };
      const result = reconcileDaemon({
        store: broken,
        fenceToken: "recon-5",
        instanceId: "instance-5",
        nowIso: NOW,
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: recovery().port,
      });
      expect(result).toMatchObject({ ok: false, code: "daemon.state-recovery-failed" });
    } finally {
      removeRoot(root);
    }
  });
});
