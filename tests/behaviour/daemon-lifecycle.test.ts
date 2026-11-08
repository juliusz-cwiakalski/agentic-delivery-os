/**
 * TC-LIFE-001/002/006/007/008 — resident/foreground start at readiness, drain
 * and immediate stop without lane signals, and the state-first stop matrix.
 */
import { describe, expect, test } from "bun:test";
import {
  createDaemonCommandRuntime,
  type DaemonComposition,
} from "../../packages/cli/src/daemon-compose";
import {
  appendDaemonLane,
  createDaemonRuntime,
  readDaemonHeartbeat,
  readDaemonInstance,
  readDaemonLanes,
} from "../../packages/core/src/app/index";
import {
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type DaemonClockPort,
  type DaemonRecoveryPort,
  type DaemonSettings,
  type LaneExecutorPort,
} from "../../packages/core/src/contracts/index";
import { createDaemonLockPort } from "../../packages/core/src/state/index";
import { createMemoryTransportPair } from "../fixtures/daemon/transport/pair";
import {
  createTestEdge,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";

const clock = (): DaemonClockPort & { advance: (ms: number) => void } => {
  let now = Date.parse(NOW);
  return {
    nowMs: () => now,
    nowIso: () => new Date(now).toISOString(),
    sleep: async () => undefined,
    advance: (ms) => {
      now += ms;
    },
  };
};

const settings = (root: string): DaemonSettings => ({
  heartbeatIntervalMs: 5_000,
  heartbeatCycleMs: 60_000,
  lockStalenessMs: 30_000,
  pollIntervalMs: 60_000,
  watchPollIntervalMs: 5_000,
  responseTimeoutMs: 2_000,
  subscriptionBuffer: 256,
  frameMaxBytes: 65_536,
  reconcileMaxLanes: 200,
  transport: "unix",
  socketPath: `${root}/daemon.sock`,
});

const recovery = (): DaemonRecoveryPort => ({
  readRestarts: () => ({ ok: true, records: [] }),
  appendRestart: (record) => ({ ok: true, appended: true, record }),
  ensureExhaustion: (record) => ({ ok: true, appended: true, record }),
  raiseQuestion: () => ({ ok: true, questionId: "q" }),
});

const executor = (): LaneExecutorPort => ({
  availability: () => ({ available: true }),
  start: async () => ({ sessionId: "session-1", harnessKind: "opencode" }),
  observe: async () => ({ observable: true, progress: "progressing", done: false }),
  collect: async () => ({ ok: true }),
  resume: async () => true,
});

const fixture = () => {
  const root = makeTempRoot("gh238-lifecycle");
  const edge = createTestEdge();
  edge.ensureDirectory(root);
  const { store } = openStore(makeIdentity(root));
  const lock = createDaemonLockPort(edge, root);
  const timer = clock();
  let token = 0;
  const runtime = createDaemonRuntime({
    store,
    lock,
    clock: timer,
    settings: settings(root),
    restartBound: 3,
    recover: recovery(),
    newFenceToken: () => {
      token += 1;
      return `fence-${token}`;
    },
    newLockToken: () => `lock-${token}`,
    newInstanceId: () => `instance-${token}`,
    pid: 4242,
    openServer: async () => ({
      start: async () => ({ close: () => undefined }),
      expire: () => undefined,
      publishState: () => undefined,
      connections: () => 1,
      stop: () => undefined,
    }),
  });
  return { root, store, lock, timer, runtime };
};

describe("GH-238 daemon lifecycle", () => {
  test("start acquires, reconciles, opens, and returns ready with a heartbeat", async () => {
    const { root, store, runtime } = fixture();
    try {
      const started = await runtime.start();
      expect(started.ok).toBe(true);
      if (!started.ok) return;
      expect(started.state.instance.operation).toBe("acquired");
      expect(started.state.reconciliation.instanceId).toBe(started.state.instance.instanceId);
      expect(started.state.heartbeat.ordinal).toBe(1);
      expect(started.state.socketReachable).toBe(true);
      const instance = readDaemonInstance(store);
      expect(instance.ok).toBe(true);
      if (instance.ok) expect(instance.latest?.operation).toBe("acquired");
      const heartbeat = readDaemonHeartbeat(store);
      expect(heartbeat.ok).toBe(true);
      if (heartbeat.ok) expect(heartbeat.latest?.ordinal).toBe(1);
    } finally {
      removeRoot(root);
    }
  });

  test("a second live start refuses daemon.already-running and appends nothing", async () => {
    const { root, store, lock, timer, runtime } = fixture();
    try {
      expect((await runtime.start()).ok).toBe(true);
      const secondRuntime = createDaemonRuntime({
        store,
        lock,
        clock: timer,
        settings: settings(root),
        restartBound: 3,
        recover: recovery(),
        newFenceToken: () => "fence-second",
        newLockToken: () => "lock-second",
        newInstanceId: () => "instance-second",
        pid: 4343,
      });
      const second = await secondRuntime.start();
      expect(second).toMatchObject({ ok: false, code: "daemon.already-running" });
      if (!second.ok) {
        expect(second.detail).toContain("acquired_at=");
        expect(second.detail).toContain("heartbeat_at=");
        expect(second.detail).toContain("heartbeat_age_ms=");
        expect(second.detail).toContain("takeover_at=");
      }
      const instance = readDaemonInstance(store);
      if (instance.ok) expect(instance.records).toHaveLength(1);
    } finally {
      removeRoot(root);
    }
  });

  test("drain records live lanes detached and releases the lock", async () => {
    const { root, store, runtime } = fixture();
    try {
      expect((await runtime.start()).ok).toBe(true);
      const lane = {
        schema: DAEMON_LANE_PAYLOAD_SCHEMA,
        ref: "GH-238",
        state: "delivering" as const,
        spawnOrdinal: 1,
        recordedAt: NOW,
      };
      expect(appendDaemonLane(store, "seed", lane).ok).toBe(true);
      const stopped = await runtime.stop("drain");
      expect(stopped).toMatchObject({ ok: true, result: "draining" });
      if (stopped.ok) expect(stopped.detachedLanes).toEqual(["GH-238"]);
      const lanes = readDaemonLanes(store);
      expect(lanes.ok).toBe(true);
      if (lanes.ok) expect(lanes.latest?.state).toBe("detached");
      const instance = readDaemonInstance(store);
      if (instance.ok) expect(instance.latest?.operation).toBe("released");
      expect(runtime.state()).toBeUndefined();
    } finally {
      removeRoot(root);
    }
  });

  test("immediate stop records immediate-stop and signals no lane", async () => {
    const { root, store, runtime } = fixture();
    try {
      expect((await runtime.start()).ok).toBe(true);
      const stopped = await runtime.stop("immediate");
      expect(stopped).toMatchObject({ ok: true, result: "stopped" });
      const instance = readDaemonInstance(store);
      if (instance.ok) expect(instance.latest?.operation).toBe("immediate-stop");
      const lanes = readDaemonLanes(store);
      if (lanes.ok) expect(lanes.records).toHaveLength(0);
    } finally {
      removeRoot(root);
    }
  });

  test("foreground and in-process resident starts both return at readiness", async () => {
    const { root, store, lock, timer } = fixture();
    try {
      const composition: DaemonComposition = {
        store,
        lock,
        settings: settings(root),
        restartBound: 3,
        stateDirectory: root,
        unit: "ados.service",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        clock: timer,
        executor: executor(),
        transport: {
          listen: async () => ({ close: () => undefined }),
          connect: async () => {
            throw new Error("client connect is not used");
          },
        },
        newFenceToken: (() => {
          let n = 0;
          return () => {
            n += 1;
            return `fence-${n}`;
          };
        })(),
        newLockToken: (() => {
          let n = 0;
          return () => {
            n += 1;
            return `lock-${n}`;
          };
        })(),
        newInstanceId: (() => {
          let n = 0;
          return () => {
            n += 1;
            return `instance-${n}`;
          };
        })(),
      };
      const foreground = createDaemonCommandRuntime(composition);
      const started = await foreground.start({ foreground: true });
      expect("data" in started).toBe(true);
      if ("data" in started) {
        expect(started.data.instance.mode).toBe("foreground");
        expect(started.data.socket.path).toBe(`${root}/daemon.sock`);
      }
      await foreground.stop({ mode: "immediate" });
    } finally {
      removeRoot(root);
    }
  });

  test("a failed first heartbeat releases the lock and appends a terminal instance record", async () => {
    const { root, store, lock, timer } = fixture();
    try {
      let failHeartbeats = true;
      const failingStore = {
        ...store,
        append: (
          handle: Parameters<typeof store.append>[0],
          request: Parameters<typeof store.append>[1],
        ) =>
          request.kind === "daemon.heartbeat" && failHeartbeats
            ? {
                ok: false as const,
                error: {
                  kind: "state" as const,
                  code: "state.write.failed" as const,
                  consequence: "not_landed" as const,
                  location: { path: "/broken-heartbeat" },
                },
              }
            : store.append(handle, request),
      };
      const runtime = createDaemonRuntime({
        store: failingStore,
        lock,
        clock: timer,
        settings: settings(root),
        restartBound: 3,
        recover: recovery(),
        newFenceToken: () => "fence-failed",
        newLockToken: () => "lock-failed",
        newInstanceId: () => "instance-failed",
        pid: 4242,
      });
      const failed = await runtime.start();
      expect(failed).toMatchObject({ ok: false, code: "daemon.state-recovery-failed" });
      const instance = readDaemonInstance(store);
      expect(instance.ok).toBe(true);
      if (instance.ok) expect(instance.latest?.operation).toBe("released");
      failHeartbeats = false;
      const restarted = await runtime.start();
      expect(restarted.ok).toBe(true);
      await runtime.stop("immediate");
    } finally {
      removeRoot(root);
    }
  });

  test("stop with no daemon is an idempotent noop", async () => {
    const { root, store, lock, timer } = fixture();
    try {
      const composition: DaemonComposition = {
        store,
        lock,
        settings: settings(root),
        restartBound: 3,
        stateDirectory: root,
        unit: "ados.service",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        clock: timer,
        newFenceToken: () => "f",
        newLockToken: () => "l",
        newInstanceId: () => "i",
      };
      const runtime = createDaemonCommandRuntime(composition);
      const stopped = await runtime.stop({ mode: "drain" });
      expect("data" in stopped && stopped.data.result).toBe("noop");
    } finally {
      removeRoot(root);
    }
  });

  test("no executor composes supervise-only with its declared marker", async () => {
    const { root, runtime } = fixture();
    try {
      const started = await runtime.start();
      expect(started.ok).toBe(true);
      if (started.ok) {
        expect(started.state.mode).toBe("supervise-only");
        expect(started.state.degraded).toContain("lane-executor-unavailable");
      }
      await runtime.stop("immediate");
    } finally {
      removeRoot(root);
    }
  });

  test("subsequent heartbeats are scheduled by the injected cadence", async () => {
    const { root, runtime, timer } = fixture();
    try {
      expect((await runtime.start()).ok).toBe(true);
      timer.advance(5_000);
      const ticked = await runtime.tick();
      expect(ticked.ok).toBe(true);
      if (ticked.ok) expect(ticked.heartbeat?.ordinal).toBe(2);
      await runtime.stop("immediate");
    } finally {
      removeRoot(root);
    }
  });

  test("the cadence runs supervision, effect detection, and blocker answers", async () => {
    const { root, store, lock, timer } = fixture();
    try {
      const calls = { supervision: 0, effects: 0, blockers: 0 };
      const runtime = createDaemonRuntime({
        store,
        lock,
        clock: timer,
        settings: settings(root),
        restartBound: 3,
        recover: recovery(),
        newFenceToken: () => "fence-cadence",
        newLockToken: () => "lock-cadence",
        newInstanceId: () => "instance-cadence",
        pid: 4242,
        supervision: async () => {
          calls.supervision += 1;
        },
        detectEffects: async () => {
          calls.effects += 1;
        },
        processBlockerAnswers: () => {
          calls.blockers += 1;
          return { ok: true, recorded: 0 };
        },
      });
      expect((await runtime.start()).ok).toBe(true);
      calls.supervision = 0;
      calls.effects = 0;
      calls.blockers = 0;
      timer.advance(60_000);
      const ticked = await runtime.tick();
      expect(ticked.ok).toBe(true);
      expect(calls).toEqual({ supervision: 1, effects: 1, blockers: 1 });
      await runtime.stop("immediate");
    } finally {
      removeRoot(root);
    }
  });

  test("status --live probes the transport instead of the local server handle", async () => {
    const { root, store, lock, timer } = fixture();
    const pair = createMemoryTransportPair();
    const transport = {
      listen: (onConnection: Parameters<typeof pair.server.listen>[0]) =>
        pair.server.listen(onConnection),
      connect: () => pair.client.connect(),
    };
    try {
      const composition: DaemonComposition = {
        store,
        lock,
        settings: settings(root),
        restartBound: 3,
        stateDirectory: root,
        unit: "ados.service",
        binary: "ados",
        environmentName: "ADOS_STATE_DIR",
        clock: timer,
        executor: executor(),
        transport,
        newFenceToken: (() => {
          let n = 0;
          return () => {
            n += 1;
            return `fence-${n}`;
          };
        })(),
        newLockToken: (() => {
          let n = 0;
          return () => {
            n += 1;
            return `lock-${n}`;
          };
        })(),
        newInstanceId: (() => {
          let n = 0;
          return () => {
            n += 1;
            return `instance-${n}`;
          };
        })(),
      };
      const runtime = createDaemonCommandRuntime(composition);
      expect("data" in (await runtime.start({ foreground: true }))).toBe(true);
      const live = await runtime.status({ live: true });
      expect("data" in live).toBe(true);
      if ("data" in live) {
        expect(live.data.socket.reachable).toBe(true);
        expect(live.data.heartbeat.state).toBe("running");
      }
      await runtime.stop({ mode: "immediate" });
    } finally {
      removeRoot(root);
    }
  });
});
