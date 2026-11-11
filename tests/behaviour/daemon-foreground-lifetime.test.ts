/**
 * The signal-owned foreground lifetime (TC-DAEMON-033, 034, 035, 037, 038).
 *
 * The composition runs a direct `createDaemonCommandRuntime` over a recording
 * signal host and a manual clock, so the resident loop is driven one iteration
 * at a time and the signal ordering is deterministic. No case goes through
 * `runEntrypoint`.
 */
import { describe, expect, test } from "bun:test";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import {
  readDaemonHeartbeat,
  readDaemonInstance,
  readDaemonLanes,
} from "../../packages/core/src/app/index";
import type { DaemonLockPort } from "../../packages/core/src/contracts/index";
import { appendLane } from "../fixtures/daemon/mount-states";
import {
  createMountClock,
  createMountHarness,
  mountComposition,
  openMountStore,
} from "../fixtures/daemon/mount-harness";

/** A recording signal host: it never touches the test process's signals. */
export const createSignalHost = () => {
  const listeners = new Map<string, Set<() => void>>();
  const onceCalls: string[] = [];
  const removeCalls: string[] = [];
  return {
    host: {
      once: (event: "SIGINT" | "SIGTERM", listener: () => void) => {
        onceCalls.push(event);
        const set = listeners.get(event) ?? new Set();
        set.add(listener);
        listeners.set(event, set);
      },
      removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => {
        removeCalls.push(event);
        listeners.get(event)?.delete(listener);
      },
    },
    onceCalls,
    removeCalls,
    registered: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
    deliver: (event: "SIGINT" | "SIGTERM") => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener();
    },
  };
};

const isFailure = (value: unknown): value is { error: { code: string } } =>
  typeof value === "object" && value !== null && "error" in value;

const invoke = async (
  runtime: ReturnType<typeof createDaemonCommandRuntime>,
  argv: readonly string[],
) => {
  const definition = createDaemonCommandDefinition(runtime);
  const [subcommand, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = subcommand === undefined ? [] : [subcommand];
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index] as string;
    if (token === "--mode") {
      flags["--mode"] = rest[index + 1] as string;
      index += 1;
      continue;
    }
    flags[token] = true;
  }
  return definition.handler({ positionals, flags, global: {} } as never);
};

const startForeground = (
  runtime: ReturnType<typeof createDaemonCommandRuntime>,
): Promise<unknown> => invoke(runtime, ["start", "--foreground"]);

/** Let the loop reach its pending sleep. */
const settle = async (times = 3): Promise<void> => {
  for (let index = 0; index < times; index += 1) await Promise.resolve();
};

describe("TC-DAEMON-033 SIGTERM drains a foreground daemon", () => {
  test("the drain records one release and one detach per delivering lane, then returns the start snapshot", async () => {
    const harness = createMountHarness({ label: "fg-033" });
    try {
      const clock = createMountClock({ manual: true, sleepAdvances: true });
      const signals = createSignalHost();
      appendLane(harness.store, { ref: "GH-286", state: "delivering", spawnOrdinal: 1 });
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, { clock, signalHost: signals.host }),
      );
      const command = startForeground(runtime);
      await settle();

      // Three heartbeat intervals advance three beats with contiguous ordinals.
      for (let index = 0; index < 3; index += 1) {
        clock.tick();
        await settle();
      }
      const heartbeats = readDaemonHeartbeat(harness.store);
      expect(heartbeats.ok).toBe(true);
      if (heartbeats.ok) {
        expect(heartbeats.latest?.ordinal).toBeGreaterThanOrEqual(2);
      }

      expect(signals.onceCalls).toEqual(["SIGINT", "SIGTERM"]);
      signals.deliver("SIGTERM");
      await settle();
      clock.releaseAll();
      const result = await command;

      expect(isFailure(result)).toBe(false);
      if (isFailure(result)) return;
      const data = result.data as {
        instance: { instanceId: string; pid: number };
        heartbeat: { intervalMs: number };
        degraded: readonly string[];
      };
      // The returned envelope is the snapshot captured at start: its instance
      // identity is the one the durable `acquired` record carries.
      const durable = readDaemonInstance(harness.store);
      if (durable.ok) {
        expect(data.instance.instanceId).toBe(durable.latest?.instanceId);
      }
      expect(data.instance.pid).toBe(0);
      expect(data.heartbeat.intervalMs).toBe(harness.settings.heartbeatIntervalMs);

      const instances = readDaemonInstance(harness.store);
      expect(instances.ok).toBe(true);
      if (instances.ok) {
        expect(instances.latest?.operation).toBe("released");
        expect(instances.latest?.releaseReason).toBe("drain");
      }
      const lanes = readDaemonLanes(harness.store);
      expect(lanes.ok).toBe(true);
      if (lanes.ok) {
        const detached = lanes.records.filter((lane) => lane.state === "detached");
        expect(detached).toHaveLength(1);
        expect(detached[0]?.ref).toBe("GH-286");
      }
      // Both listeners were installed once and removed once, and none remains.
      expect(signals.removeCalls).toEqual(["SIGINT", "SIGTERM"]);
      expect(signals.registered()).toBe(0);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-034 SIGINT stops immediately", () => {
  test("SIGINT records one immediate-stop, zero releases and zero detaches, and a later stop is a noop", async () => {
    const harness = createMountHarness({ label: "fg-034" });
    try {
      const clock = createMountClock({ manual: true, sleepAdvances: true });
      const signals = createSignalHost();
      appendLane(harness.store, { ref: "GH-286", state: "delivering", spawnOrdinal: 1 });
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, { clock, signalHost: signals.host }),
      );
      const command = startForeground(runtime);
      await settle();
      signals.deliver("SIGINT");
      await settle();
      clock.releaseAll();
      const result = await command;
      expect(isFailure(result)).toBe(false);

      const instances = readDaemonInstance(harness.store);
      expect(instances.ok).toBe(true);
      if (instances.ok) {
        expect(instances.latest?.operation).toBe("immediate-stop");
      }
      const lanes = readDaemonLanes(harness.store);
      if (lanes.ok) {
        expect(lanes.records.filter((lane) => lane.state === "detached")).toHaveLength(0);
      }
      expect(signals.removeCalls).toEqual(["SIGINT", "SIGTERM"]);

      // A later stop through a fresh handle is a noop with zero signals.
      const later = createDaemonCommandRuntime(mountComposition(harness));
      const stopped = await invoke(later, ["stop", "--mode", "drain"]);
      expect(isFailure(stopped)).toBe(false);
      if (!isFailure(stopped)) {
        expect((stopped.data as { result: string }).result).toBe("noop");
      }
      expect(harness.processPort.signals).toHaveLength(0);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-035 no signal host", () => {
  test("a foreground start without a signal host returns at readiness and starts no loop", async () => {
    const harness = createMountHarness({ label: "fg-035" });
    try {
      const clock = createMountClock({ manual: true, sleepAdvances: true });
      const runtime = createDaemonCommandRuntime(mountComposition(harness, { clock }));
      const result = await startForeground(runtime);
      expect(isFailure(result)).toBe(false);
      // Nothing awaited a signal: the loop was never entered.
      expect(clock.sleeps()).toHaveLength(0);
      const heartbeats = readDaemonHeartbeat(harness.store);
      if (heartbeats.ok) expect(heartbeats.latest?.ordinal).toBe(1);
    } finally {
      harness.dispose();
    }
  });

  test("the presence of a host enters the loop, so the difference is the host", async () => {
    const harness = createMountHarness({ label: "fg-035b" });
    try {
      const clock = createMountClock({ manual: true, sleepAdvances: true });
      const signals = createSignalHost();
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, { clock, signalHost: signals.host }),
      );
      const command = startForeground(runtime);
      await settle();
      expect(clock.sleeps().length).toBeGreaterThan(0);
      signals.deliver("SIGINT");
      await settle();
      clock.releaseAll();
      expect(isFailure(await command)).toBe(false);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-033/036 a stop delivered at the readiness point is buffered, never a silent terminate", () => {
  test("both listeners exist before the lock acquisition, and a signal delivered inside it still drains or stops", async () => {
    for (const [signal, operation, reason] of [
      ["SIGTERM", "released", "drain"],
      ["SIGINT", "immediate-stop", "immediate"],
    ] as const) {
      const harness = createMountHarness({ label: "fg-race" });
      try {
        const clock = createMountClock({ manual: true, sleepAdvances: true });
        const signals = createSignalHost();
        // Deliver the stop at the exact instant the readiness point is being
        // made durable: the acquisition is the last step before the `acquired`
        // record exists, so a cross-process `daemon stop` can arrive here. With
        // the listeners installed after `runtime.start`, this delivery would hit
        // the default terminate and leave a stale lock with no release record.
        const listenerCountsAtAcquire: number[] = [];
        const lock: DaemonLockPort = {
          read: harness.lock.read,
          acquire: (record) => {
            listenerCountsAtAcquire.push(signals.registered());
            signals.deliver(signal);
            return harness.lock.acquire(record);
          },
          heartbeat: harness.lock.heartbeat,
          remove: harness.lock.remove,
        };
        const runtime = createDaemonCommandRuntime(
          mountComposition(harness, { clock, signalHost: signals.host, lock }),
        );
        const command = startForeground(runtime);
        await settle();
        clock.releaseAll();
        const result = await command;

        // The signal was buffered, not dropped and not fatal: the command ends
        // through the delivered stop path and returns its start snapshot.
        expect(isFailure(result)).toBe(false);
        expect(listenerCountsAtAcquire).toEqual([2]);
        const instances = readDaemonInstance(harness.store);
        expect(instances.ok).toBe(true);
        if (!instances.ok) continue;
        expect(instances.records.map((record) => record.operation)).toEqual([
          "acquired",
          operation,
        ]);
        expect(instances.latest?.releaseReason).toBe(reason);
        expect(signals.registered()).toBe(0);
      } finally {
        harness.dispose();
      }
    }
  });
});

describe("TC-DAEMON-037 a failed release still terminates and reports the state identity", () => {
  test("the loop ends, the listeners are removed, and the failure is classified", async () => {
    const harness = createMountHarness({ label: "fg-037" });
    try {
      const clock = createMountClock({ manual: true, sleepAdvances: true });
      // Observe the loop's own cancellation predicate: the release append must
      // see the loop already cancelled (cancellation-first ordering).
      let loopSignal: { readonly cancelled: () => boolean } | undefined;
      const wrappingClock = {
        ...clock,
        sleep: (ms: number, signal?: { readonly cancelled: () => boolean }) => {
          if (signal !== undefined) loopSignal = signal;
          return clock.sleep(ms);
        },
      };
      const signals = createSignalHost();
      const attempts: { readonly cancelledBeforeAppend: boolean }[] = [];
      // A store edge that refuses the terminal (release) append only; every
      // other edge delegates, so the acquisition still lands.
      const failingStore = {
        ...harness.store,
        append: (handle: never, request: never) => {
          const append = request as { readonly payload?: { readonly operation?: string } };
          if (append.payload?.operation === "released") {
            attempts.push({ cancelledBeforeAppend: loopSignal?.cancelled() === true });
            return {
              ok: false as const,
              error: {
                kind: "state" as const,
                code: "state.write.failed" as const,
                consequence: "not_landed" as const,
                location: { path: "daemon.instance" },
              },
            };
          }
          return harness.store.append(handle, request);
        },
      };
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          clock: wrappingClock,
          signalHost: signals.host,
          store: failingStore,
        }),
      );
      const command = startForeground(runtime);
      await settle();
      const acquired = readDaemonInstance(harness.store);
      expect(acquired.ok && acquired.latest?.operation).toBe("acquired");

      signals.deliver("SIGTERM");
      await settle();
      clock.releaseAll();
      const result = await command;

      // The delivered state-write identity at exit 2, and no success `data`
      // claiming a release that never landed.
      expect(isFailure(result)).toBe(true);
      if (isFailure(result)) expect(result.error.code).toBe("state.write.failed");
      expect(result !== null && typeof result === "object" && "data" in result).toBe(false);
      // Exactly one release attempt, and cancellation was observed first.
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.cancelledBeforeAppend).toBe(true);
      // Both listeners were removed in the `finally` on the failure path.
      expect(signals.removeCalls).toEqual(["SIGINT", "SIGTERM"]);
      expect(signals.registered()).toBe(0);
      // The durable truth is unchanged: the one acquisition, no fabricated release.
      const instances = readDaemonInstance(harness.store);
      expect(instances.ok).toBe(true);
      if (!instances.ok) return;
      expect(instances.records).toHaveLength(1);
      expect(instances.latest?.operation).toBe("acquired");
      // A subsequent status reports that truth at exit 0.
      const reader = createDaemonCommandRuntime(
        mountComposition(harness, { store: openMountStore(harness.stateDirectory) }),
      );
      const status = await invoke(reader, ["status"]);
      expect(isFailure(status)).toBe(false);
      if (!isFailure(status)) {
        const instance = (status.data as { instance: { instanceId: string } | null }).instance;
        expect(instance?.instanceId).toBe(instances.latest?.instanceId);
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-038 a second signal produces exactly one stop", () => {
  test("a second SIGTERM or a mixed order cannot start a second stop", async () => {
    for (const order of [
      ["SIGTERM", "SIGTERM"],
      ["SIGTERM", "SIGINT"],
      ["SIGINT", "SIGTERM"],
    ] as const) {
      const harness = createMountHarness({ label: "fg-038" });
      try {
        const clock = createMountClock({ manual: true, sleepAdvances: true });
        const signals = createSignalHost();
        appendLane(harness.store, { ref: "GH-286", state: "delivering", spawnOrdinal: 1 });
        const runtime = createDaemonCommandRuntime(
          mountComposition(harness, { clock, signalHost: signals.host }),
        );
        const command = startForeground(runtime);
        await settle();
        signals.deliver(order[0]);
        signals.deliver(order[1]);
        await settle();
        clock.releaseAll();
        expect(isFailure(await command)).toBe(false);

        const instances = readDaemonInstance(harness.store);
        expect(instances.ok).toBe(true);
        if (!instances.ok) continue;
        const terminal = instances.records.filter(
          (record) => record.operation === "released" || record.operation === "immediate-stop",
        );
        // Exactly one terminal record, carrying the first signal's mode.
        expect(terminal).toHaveLength(1);
        expect(terminal[0]?.operation).toBe(order[0] === "SIGTERM" ? "released" : "immediate-stop");
        expect(
          instances.records.filter((record) => record.operation === "immediate-stop"),
        ).toHaveLength(order[0] === "SIGTERM" ? 0 : 1);
        const lanes = readDaemonLanes(harness.store);
        if (lanes.ok) {
          const detached = lanes.records.filter((lane) => lane.state === "detached");
          expect(detached.length).toBe(order[0] === "SIGTERM" ? 1 : 0);
        }
        // A third delivery after removal is not observed by the command.
        expect(signals.registered()).toBe(0);
        signals.deliver(order[0]);
        expect(signals.registered()).toBe(0);
        expect(harness.processPort.signals).toHaveLength(0);
      } finally {
        harness.dispose();
      }
    }
  });
});
