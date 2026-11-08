/**
 * TC-LIFE-004 / TC-DEGRADE-003 — plain status degrades at exit 0; only
 * status --live fails closed. The fold never fabricates liveness.
 */
import { describe, expect, test } from "bun:test";
import { appendDaemonHeartbeat, readDaemonStatus } from "../../packages/core/src/app/index";
import {
  DAEMON_HEARTBEAT_PAYLOAD_SCHEMA,
  type DaemonSupervisorDescriptor,
} from "../../packages/core/src/contracts/index";
import { appendEconomicsRestartEvent } from "../../packages/core/src/state/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";
const supervisor: DaemonSupervisorDescriptor = {
  kind: "systemd-user",
  installed: false,
  unit: "ados.service",
  scope: "scope",
  linger: false,
  commandForm: "foreground",
  serviceType: "simple",
  restartPolicy: "on-failure",
};

describe("GH-238 degraded status", () => {
  test("an absent daemon is a stopped/stale report, never a failure", () => {
    const root = makeTempRoot("gh238-degrade");
    try {
      const { store } = openStore(makeIdentity(root));
      const read = readDaemonStatus({
        store,
        nowMs: Date.parse(NOW),
        socket: { path: `${root}/daemon.sock`, transport: "unix", reachable: false },
        supervisor,
        mergeCodePath: "absent",
        degraded: ["daemon-unreachable"],
      });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.data.instance).toBeNull();
        expect(read.data.heartbeat.state).toBe("stale");
        expect(read.data.heartbeat.ageMs).toBeNull();
        expect(read.data.degraded).toEqual(["daemon-unreachable", "daemon-heartbeat-stale"]);
        expect(read.data.mergeCodePath).toBe("absent");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a stale heartbeat is reported as stale with its age", () => {
    const root = makeTempRoot("gh238-degrade-stale");
    try {
      const { store } = openStore(makeIdentity(root));
      appendDaemonHeartbeat(store, "f", {
        schema: DAEMON_HEARTBEAT_PAYLOAD_SCHEMA,
        instanceId: "instance-1",
        ordinal: 1,
        beatAt: NOW,
        uptimeMs: 0,
        queueDepth: 0,
        laneCounts: { delivering: 0, idle: 0, parked: 0, failed: 0 },
        cursor: 0,
        recordedAt: NOW,
      });
      const read = readDaemonStatus({
        store,
        nowMs: Date.parse(NOW) + 30_000,
        socket: { path: `${root}/daemon.sock`, transport: "unix", reachable: false },
        supervisor,
        mergeCodePath: "absent",
        degraded: [],
      });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.data.heartbeat.state).toBe("stale");
        expect(read.data.heartbeat.ageMs).toBe(30_000);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("restart counters are folded from the delivered economics restart records", () => {
    const root = makeTempRoot("gh238-degrade-restarts");
    try {
      const { store } = openStore(makeIdentity(root));
      const appended = appendEconomicsRestartEvent(store, "fence-restart", {
        schemaId: "delivery.economics.restart.v1",
        workItemRef: "GH-238",
        runId: "run-1",
        sessionId: "session-1",
        ordinal: 1,
        reason: "session-interrupted",
        recordedAt: NOW,
      });
      expect(appended.ok).toBe(true);
      const read = readDaemonStatus({
        store,
        nowMs: Date.parse(NOW),
        socket: { path: `${root}/daemon.sock`, transport: "unix", reachable: false },
        supervisor,
        mergeCodePath: "absent",
        degraded: [],
      });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.data.restarts).toEqual([
          { ref: "GH-238", count: 1, reason: "session-interrupted", classified: true },
        ]);
      }
    } finally {
      removeRoot(root);
    }
  });
});
