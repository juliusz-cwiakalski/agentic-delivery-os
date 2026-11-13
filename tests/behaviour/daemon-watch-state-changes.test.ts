/**
 * TC-WATCH-001/002/005 — the production daemon composition publishes a bounded
 * watch event when the projected content changes, even when the row count does
 * not, and never republishes unchanged content.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createDaemonCommandRuntime,
  type DaemonComposition,
} from "../../packages/cli/src/daemon-compose";
import {
  appendDaemonLane,
  declareQueueEntry,
  prioritizeQueueEntry,
} from "../../packages/core/src/app/index";
import {
  CONTROL_PROTOCOL_CURRENT,
  type ControlConnection,
  type ControlFrame,
  type ControlRequestFrame,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  DAEMON_MAX_FRAME_BYTES,
  type DaemonClockPort,
  type DaemonSettings,
  type DaemonWakeKind,
  type DaemonWakePort,
  type LaneExecutorPort,
  LOCAL_CALLER_PRINCIPAL,
} from "../../packages/core/src/contracts/index";
import {
  decodeControlLine,
  encodeControlFrame,
} from "../../packages/core/src/domain/control-codec";
import { createDaemonLockPort } from "../../packages/core/src/state/index";
import { createMemoryTransportPair } from "../fixtures/daemon/transport/pair";
import { createTestEdge, makeIdentity, openStore } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";
const LATER = "2026-11-08T10:00:05Z";

const temp = (): string => {
  mkdirSync(join(process.cwd(), "tmp", "tmpdir"), { recursive: true });
  return mkdtempSync(join(process.cwd(), "tmp", "tmpdir", "gh238-watch-state-"));
};

const clock = (): DaemonClockPort => ({
  nowMs: () => Date.parse(NOW),
  nowIso: () => NOW,
  sleep: async () => undefined,
});

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

const executor = (): LaneExecutorPort => ({
  availability: () => ({ available: true }),
  start: async () => ({ sessionId: "session-1", harnessKind: "opencode" }),
  observe: async () => ({ observable: true, progress: "progressing", done: false }),
  collect: async () => ({ ok: true }),
  resume: async () => true,
});

/** A wake port whose ticks are released one at a time by the test. */
const createManualWake = () => {
  let pending: ((kind: DaemonWakeKind) => void) | undefined;
  const waiting: Array<() => void> = [];
  const notify = (): void => {
    for (const resolve of waiting.splice(0)) resolve();
  };
  const next = (): Promise<DaemonWakeKind> =>
    new Promise((resolve) => {
      pending = resolve;
      notify();
    });
  const whenWaiting = async (): Promise<void> => {
    if (pending !== undefined) return;
    await new Promise<void>((resolve) => waiting.push(resolve));
  };
  return {
    port: { next } satisfies DaemonWakePort,
    /** Release one tick and wait until the loop is waiting for the next one. */
    step: async (): Promise<void> => {
      await whenWaiting();
      const resolve = pending;
      pending = undefined;
      resolve?.("poke");
      await whenWaiting();
    },
    release: (): void => {
      const resolve = pending;
      pending = undefined;
      resolve?.("poke");
    },
  };
};

type WatchClient = {
  readonly connection: ControlConnection;
  readonly frames: ControlFrame[];
  readonly subscribe: (topic: "queue" | "lanes") => void;
};

const connect = async (
  pair: ReturnType<typeof createMemoryTransportPair>,
): Promise<WatchClient> => {
  const connection = await pair.client.connect();
  const frames: ControlFrame[] = [];
  connection.onLine((line) => {
    const decoded = decodeControlLine(line);
    if (decoded.ok) frames.push(decoded.frame);
  });
  let ordinal = 0;
  return {
    connection,
    frames,
    subscribe: (topic) => {
      ordinal += 1;
      const request: ControlRequestFrame = {
        v: CONTROL_PROTOCOL_CURRENT,
        kind: "request",
        type: "subscribe",
        id: `watch-${ordinal}`,
        payload: { topic },
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      };
      connection.write(encodeControlFrame(request));
    },
  };
};

const events = (client: WatchClient): ControlFrame[] =>
  client.frames.filter((frame) => frame.kind === "event");

const snapshots = (client: WatchClient): unknown[] =>
  events(client).map((frame) => (frame.data as { readonly snapshot?: unknown }).snapshot);

/** The initial subscribe snapshot is the cursor-0 event the daemon publishes. */
const initialSnapshot = (client: WatchClient): unknown =>
  (events(client)[0]?.data as { readonly snapshot?: unknown } | undefined)?.snapshot;

const openFixture = (label: string) => {
  const root = temp();
  const edge = createTestEdge();
  edge.ensureDirectory(root);
  const { store } = openStore(makeIdentity(root));
  const lock = createDaemonLockPort(edge, root);
  const wake = createManualWake();
  const pair = createMemoryTransportPair();
  let fence = 0;
  const composition: DaemonComposition = {
    store,
    lock,
    settings: settings(root),
    restartBound: 3,
    stateDirectory: root,
    unit: "ados.service",
    binary: "ados",
    environmentName: "ADOS_STATE_DIR",
    clock: clock(),
    executor: executor(),
    transport: pair.server,
    wake: wake.port,
    newFenceToken: () => {
      fence += 1;
      return `fence-${label}-${fence}`;
    },
    newLockToken: () => `lock-${label}`,
    newInstanceId: () => `instance-${label}`,
  };
  return {
    root,
    store,
    wake,
    pair,
    runtime: createDaemonCommandRuntime(composition),
    close: () => rmSync(root, { recursive: true, force: true }),
  };
};

describe("GH-238 composed daemon watch state changes", () => {
  test("a queue content change with an unchanged count publishes one bounded event", async () => {
    const fixture = openFixture("queue");
    try {
      const seeded = declareQueueEntry(fixture.store, {
        ref: "GH-238",
        priority: 50,
        recordedAt: NOW,
        fenceToken: "seed-queue",
      });
      expect(seeded.ok).toBe(true);

      const started = await fixture.runtime.start({ foreground: true });
      expect("data" in started).toBe(true);
      const client = await connect(fixture.pair);
      client.subscribe("queue");

      const before = initialSnapshot(client) as {
        readonly entries?: readonly { readonly priority?: number }[];
      };
      expect(before.entries).toHaveLength(1);
      expect(before.entries?.[0]?.priority).toBe(50);
      expect(events(client)).toHaveLength(1);

      // The first tick observes unchanged content: no duplicate event.
      await fixture.wake.step();
      expect(events(client)).toHaveLength(1);

      // A content-only change: same row count, different priority.
      const changed = prioritizeQueueEntry(fixture.store, {
        ref: "GH-238",
        priority: 10,
        recordedAt: LATER,
        fenceToken: "change-queue",
      });
      expect(changed.ok).toBe(true);

      await fixture.wake.step();
      expect(events(client)).toHaveLength(2);
      const published = snapshots(client)[1] as {
        readonly entries?: readonly { readonly priority?: number }[];
        readonly counts?: { readonly entries?: number };
        readonly truncated?: boolean;
      };
      expect(published.entries).toHaveLength(1);
      expect(published.entries?.[0]?.priority).toBe(10);
      expect(published.counts?.entries).toBe(1);
      expect(published.truncated).toBe(false);
      expect(JSON.stringify(events(client)[1])).not.toContain(fixture.root);

      // A no-change tick republishes nothing.
      await fixture.wake.step();
      expect(events(client)).toHaveLength(2);
    } finally {
      fixture.wake.release();
      await fixture.runtime.stop({ mode: "immediate" });
      fixture.close();
    }
  });

  test("a lane content change with an unchanged count publishes one bounded event", async () => {
    const fixture = openFixture("lanes");
    try {
      const seeded = appendDaemonLane(fixture.store, "seed-lane", {
        schema: DAEMON_LANE_PAYLOAD_SCHEMA,
        ref: "GH-238",
        state: "delivering",
        spawnOrdinal: 1,
        recordedAt: NOW,
      });
      expect(seeded.ok).toBe(true);

      const started = await fixture.runtime.start({ foreground: true });
      expect("data" in started).toBe(true);
      const client = await connect(fixture.pair);
      client.subscribe("lanes");

      const before = initialSnapshot(client) as {
        readonly lanes?: readonly { readonly ref?: string }[];
      };
      expect(before.lanes).toHaveLength(1);
      expect(events(client)).toHaveLength(1);

      await fixture.wake.step();
      expect(events(client)).toHaveLength(1);

      // A content-only change: same ref and count, different execution state.
      const changed = appendDaemonLane(fixture.store, "change-lane", {
        schema: DAEMON_LANE_PAYLOAD_SCHEMA,
        ref: "GH-238",
        state: "completed",
        spawnOrdinal: 1,
        recordedAt: LATER,
      });
      expect(changed.ok).toBe(true);

      await fixture.wake.step();
      expect(events(client)).toHaveLength(2);
      const published = snapshots(client)[1] as {
        readonly lanes?: readonly { readonly ref?: string; readonly state?: string }[];
        readonly counts?: { readonly lanes?: number };
        readonly truncated?: boolean;
      };
      expect(published.lanes).toHaveLength(1);
      expect(published.lanes?.[0]?.ref).toBe("GH-238");
      expect(published.lanes?.[0]?.state).toBe("completed");
      expect(published.counts?.lanes).toBe(1);
      expect(published.truncated).toBe(false);

      await fixture.wake.step();
      expect(events(client)).toHaveLength(2);
    } finally {
      fixture.wake.release();
      await fixture.runtime.stop({ mode: "immediate" });
      fixture.close();
    }
  });

  test("the lanes snapshot is bounded and marks the dropped rows", async () => {
    const fixture = openFixture("bounds");
    try {
      const started = await fixture.runtime.start({ foreground: true });
      expect("data" in started).toBe(true);
      const client = await connect(fixture.pair);
      client.subscribe("lanes");

      for (let index = 0; index < 205; index += 1) {
        const appended = appendDaemonLane(fixture.store, `bulk-${index}`, {
          schema: DAEMON_LANE_PAYLOAD_SCHEMA,
          ref: `GH-${9000 + index}`,
          state: "delivering",
          spawnOrdinal: 1,
          recordedAt: NOW,
        });
        expect(appended.ok).toBe(true);
      }

      await fixture.wake.step();
      expect(events(client)).toHaveLength(2);
      const published = snapshots(client)[1] as {
        readonly lanes?: readonly unknown[];
        readonly counts?: { readonly lanes?: number };
        readonly truncated?: boolean;
        readonly truncationReason?: string;
      };
      expect(published.lanes).toHaveLength(200);
      expect(published.counts?.lanes).toBe(200);
      expect(published.truncated).toBe(true);
      expect(published.truncationReason).toBe("watch-count-bound");
      expect(
        new TextEncoder().encode(JSON.stringify(events(client)[1])).length,
      ).toBeLessThanOrEqual(DAEMON_MAX_FRAME_BYTES);
    } finally {
      fixture.wake.release();
      await fixture.runtime.stop({ mode: "immediate" });
      fixture.close();
    }
  });
});
