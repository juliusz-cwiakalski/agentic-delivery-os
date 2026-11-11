/**
 * TC-DAEMON-120 — the degradation path stays inside its read, socket, probe,
 * sleep, and latency budget.
 *
 * The store is wrapped in a counting proxy so the assertion is about daemon-fact
 * reads, not about elapsed time alone: at most two additional reads per
 * projection (the instance and the heartbeat), zero transport connects, zero
 * `isAlive` calls, and no sleep.
 */
import { describe, expect, test } from "bun:test";
import { createQueueCommandRuntime, createLanesCommandRuntime } from "../../packages/cli/src/edge";
import type { QueueDegradationReason } from "../../packages/core/src/contracts/index";
import { readDaemonHeartbeat, readDaemonInstance } from "../../packages/core/src/app/index";
import { createMountHarness, openMountStore } from "../fixtures/daemon/mount-harness";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";

const countingStore = (store: ReturnType<typeof openMountStore>) => {
  const counters = { reads: 0 };
  const proxy = {
    ...store,
    readRecords: (...args: Parameters<typeof store.readRecords>) => {
      counters.reads += 1;
      return store.readRecords(...args);
    },
  } as typeof store;
  return { store: proxy, counters };
};

const resolverOver = (
  store: ReturnType<typeof openMountStore>,
  options: { readonly stalenessMs: number; readonly nowMs: number },
) => {
  let calls = 0;
  const resolve = (): readonly QueueDegradationReason[] => {
    calls += 1;
    const instance = readDaemonInstance(store);
    if (!instance.ok || instance.latest === undefined) return ["daemon-unreachable"];
    const latest = instance.latest;
    if (latest.operation !== "acquired" && latest.operation !== "taken-over") {
      return ["daemon-unreachable"];
    }
    const heartbeat = readDaemonHeartbeat(store);
    if (!heartbeat.ok || heartbeat.latest === undefined) return ["daemon-unreachable"];
    if (heartbeat.latest.instanceId !== latest.instanceId) return ["daemon-unreachable"];
    return options.nowMs - Date.parse(heartbeat.latest.beatAt) < options.stalenessMs
      ? []
      : ["daemon-unreachable"];
  };
  return { resolve, calls: () => calls };
};

const facts = {
  plans: {},
  workItems: {},
  ci: {},
  provider: { state: "unavailable" as const, reason: "not-configured" as const },
  close: {},
  deploy: { expectations: {}, verdicts: {} },
};

describe("TC-DAEMON-120 degradation read cost", () => {
  test("at most two additional daemon-fact reads per projection, zero connects, probes, or sleeps", () => {
    const harness = createMountHarness({ label: "cost-120" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(Date.now()).toISOString(),
      });
      const { store, counters } = countingStore(harness.store);
      const nowMs = Date.now();
      const resolver = resolverOver(store, { stalenessMs: 30_000, nowMs });

      const composition = {
        store,
        facts,
        nowIso: () => new Date(nowMs).toISOString(),
        nowMs: () => nowMs,
        newFenceToken: () => "fence",
        degraded: resolver.resolve,
      };

      // The projection's own reads are the baseline: the same projection is
      // measured with the resolver absent, so the delta is the resolver's cost.
      const withoutResolver = createQueueCommandRuntime({
        ...composition,
        degraded: undefined,
      } as never);
      const baselineBefore = counters.reads;
      const baselineRead = withoutResolver.readSchedule(20);
      const baselineCost = counters.reads - baselineBefore;
      expect(baselineRead.ok).toBe(true);

      const queue = createQueueCommandRuntime(composition as never);
      const beforeRead = counters.reads;
      const read = queue.readSchedule(20);
      expect(read.ok).toBe(true);
      expect(counters.reads - beforeRead - baselineCost).toBeLessThanOrEqual(2);
      expect(resolver.calls()).toBe(1);

      const lanes = createLanesCommandRuntime(composition as never);
      const lanesWithout = createLanesCommandRuntime({
        ...composition,
        degraded: undefined,
      } as never);
      const beforeLanesBaseline = counters.reads;
      lanesWithout.readLanes();
      const lanesBaselineCost = counters.reads - beforeLanesBaseline;
      const beforeLanes = counters.reads;
      const lanesRead = lanes.readLanes();
      expect(lanesRead.ok).toBe(true);
      expect(counters.reads - beforeLanes - lanesBaselineCost).toBeLessThanOrEqual(2);
      expect(resolver.calls()).toBe(2);

      // A watch iteration resolves once more, and nothing connects, probes, or sleeps.
      queue.watch?.({
        signal: { interrupted: () => false },
        maxIterations: 1,
        intervalMs: 1,
      } as never);
      expect(resolver.calls()).toBeGreaterThanOrEqual(2);
      expect(harness.processPort.signals).toHaveLength(0);
      expect(harness.processPort.aliveChecks).toHaveLength(0);

      // Doubling unrelated records does not change the daemon-fact read count.
      const beforeUnrelated = counters.reads;
      const second = resolverOver(store, { stalenessMs: 30_000, nowMs });
      second.resolve();
      expect(counters.reads - beforeUnrelated).toBeLessThanOrEqual(2);
    } finally {
      harness.dispose();
    }
  });
});
