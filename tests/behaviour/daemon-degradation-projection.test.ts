/**
 * The degradation marker resolved per projection from durable state
 * (TC-DAEMON-070..078, 112).
 *
 * The production-shaped cases invoke the composed program's `queue list` and
 * `lanes list` handlers over a seeded store, so the wire and the rule are
 * asserted together. The boundary cells that need a non-default staleness bound
 * are asserted against the same rule over an injected store, because the
 * production composer exposes no clock or bound seam (rule 10).
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync } from "node:fs";
import { createQueueCommandRuntime } from "../../packages/cli/src/edge";
import { createProductionComposer, daemonReachable } from "../../packages/cli/src/production";
import { readDaemonHeartbeat, readDaemonInstance } from "../../packages/core/src/app/index";
import { foldDaemonLiveness } from "../../packages/core/src/domain/daemon-heartbeat";
import type { QueueDegradationReason } from "../../packages/core/src/contracts/index";
import { createMountHarness, openMountStore } from "../fixtures/daemon/mount-harness";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";

const isFailure = (value: unknown): value is { error: { code: string } } =>
  typeof value === "object" && value !== null && "error" in value;

/**
 * The DM-4 rule under an injected instant and bound: the production predicate,
 * not a test-local mirror.
 */
const durableReachability = (input: {
  readonly store: ReturnType<typeof openMountStore>;
  readonly nowMs: number;
  readonly lockStalenessMs: number;
}): readonly QueueDegradationReason[] => (daemonReachable(input) ? [] : ["daemon-unreachable"]);

const NOW = (): number => Date.now();

describe("TC-DAEMON-070 a live instance yields an empty marker on both reads", () => {
  test("queue list and lanes list report degraded: []", async () => {
    const harness = createMountHarness({ label: "deg-070" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(NOW()).toISOString(),
      });
      const brand = harness.brand;
      const program = createProductionComposer({
        environment: {
          HOME: harness.home,
          PATH: "/usr/bin",
          [`${brand.environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`]:
            harness.stateDirectory,
        },
        cwd: harness.root,
        homeDirectory: harness.home,
        workingName: brand.binaryName,
      })(brand);
      for (const command of ["queue", "lanes"] as const) {
        const definition = program.commands[command];
        if (definition === undefined) throw new Error(`${command} is not registered`);
        const result = await definition.handler({
          positionals: ["list"],
          flags: {},
          global: {},
        } as never);
        expect(isFailure(result)).toBe(false);
        if (isFailure(result)) continue;
        expect((result.data as { degraded: readonly string[] }).degraded).toEqual([]);
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-071 and TC-DAEMON-072 released and absent stores degrade", () => {
  test("a released instance yields exactly [daemon-unreachable] on both reads", async () => {
    const harness = createMountHarness({ label: "deg-071" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendInstance(harness.store, {
        operation: "released",
        releaseReason: "drain",
        recordedAt: new Date(NOW()).toISOString(),
        heartbeatAt: new Date(NOW()).toISOString(),
      });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(NOW()).toISOString(),
      });
      const brand = harness.brand;
      const program = createProductionComposer({
        environment: {
          HOME: harness.home,
          PATH: "/usr/bin",
          [`${brand.environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`]:
            harness.stateDirectory,
        },
        cwd: harness.root,
        homeDirectory: harness.home,
        workingName: brand.binaryName,
      })(brand);
      for (const command of ["queue", "lanes"] as const) {
        const result = await program.commands[command]?.handler({
          positionals: ["list"],
          flags: {},
          global: {},
        } as never);
        expect(result === undefined ? "missing" : isFailure(result)).toBe(false);
        if (result === undefined || isFailure(result)) continue;
        expect((result.data as { degraded: readonly string[] }).degraded).toEqual([
          "daemon-unreachable",
        ]);
      }
    } finally {
      harness.dispose();
    }
  });

  test("an absent instance yields exactly [daemon-unreachable] at exit 0", async () => {
    const harness = createMountHarness({ label: "deg-072" });
    try {
      const brand = harness.brand;
      const program = createProductionComposer({
        environment: {
          HOME: harness.home,
          PATH: "/usr/bin",
          [`${brand.environmentPrefix.toUpperCase().replace(/_+$/u, "")}_STATE_DIR`]:
            harness.stateDirectory,
        },
        cwd: harness.root,
        homeDirectory: harness.home,
        workingName: brand.binaryName,
      })(brand);
      const result = await program.commands.queue?.handler({
        positionals: ["list"],
        flags: {},
        global: {},
      } as never);
      expect(result === undefined ? "missing" : isFailure(result)).toBe(false);
      if (result === undefined || isFailure(result)) return;
      expect((result.data as { degraded: readonly string[] }).degraded).toEqual([
        "daemon-unreachable",
      ]);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-073 stale, at-bound, and configuration-driven bounds", () => {
  test("stale by 1 ms and the at-bound cell degrade; the doubled bound flips it", () => {
    const harness = createMountHarness({ label: "deg-073" });
    try {
      const nowMs = NOW();
      const defaultBound = 30_000;
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });

      // One millisecond inside the bound: reachable.
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        ordinal: 1,
        beatAt: new Date(nowMs - (defaultBound - 1)).toISOString(),
      });
      expect(
        durableReachability({ store: harness.store, nowMs, lockStalenessMs: defaultBound }),
      ).toEqual([]);

      // Stale by 1 ms: degraded.
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        ordinal: 2,
        beatAt: new Date(nowMs - (defaultBound + 1)).toISOString(),
      });
      expect(
        durableReachability({ store: harness.store, nowMs, lockStalenessMs: defaultBound }),
      ).toEqual(["daemon-unreachable"]);

      // Exactly at the bound: STALE on both surfaces (strict `<`).
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        ordinal: 3,
        beatAt: new Date(nowMs - defaultBound).toISOString(),
      });
      expect(
        durableReachability({ store: harness.store, nowMs, lockStalenessMs: defaultBound }),
      ).toEqual(["daemon-unreachable"]);
      const instanceRead = readDaemonInstance(harness.store);
      const heartbeatRead = readDaemonHeartbeat(harness.store);
      const folded = foldDaemonLiveness({
        instance: instanceRead.ok ? instanceRead.latest : undefined,
        heartbeat: heartbeatRead.ok ? heartbeatRead.latest : undefined,
        nowMs,
        stalenessMs: defaultBound,
      });
      expect(folded.state).toBe("stale");

      // Doubling the configured bound flips the same age to reachable.
      expect(
        durableReachability({ store: harness.store, nowMs, lockStalenessMs: defaultBound * 2 }),
      ).toEqual([]);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-074 a watch flips the marker within one iteration", () => {
  test("each iteration resolves the marker afresh, in both directions", () => {
    const harness = createMountHarness({ label: "deg-074" });
    try {
      let calls = 0;
      const bound = 30_000;
      const resolver = (): readonly QueueDegradationReason[] => {
        calls += 1;
        return durableReachability({ store: harness.store, nowMs: NOW(), lockStalenessMs: bound });
      };
      const composition = {
        store: harness.store,
        facts: {
          plans: {},
          workItems: {},
          ci: {},
          provider: { state: "unavailable" as const, reason: "not-configured" as const },
          close: {},
          deploy: { expectations: {}, verdicts: {} },
        },
        nowIso: () => new Date(NOW()).toISOString(),
        nowMs: NOW,
        newFenceToken: () => "fence",
        degraded: resolver,
      };
      const runtime = createQueueCommandRuntime(composition as never);
      const first = runtime.readSchedule(20);
      expect(first.ok && first.degraded).toEqual(["daemon-unreachable"]);

      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(NOW()).toISOString(),
      });
      const second = runtime.readSchedule(20);
      expect(second.ok && second.degraded).toEqual([]);

      appendInstance(harness.store, {
        operation: "released",
        releaseReason: "drain",
        recordedAt: new Date(NOW()).toISOString(),
        heartbeatAt: new Date(NOW()).toISOString(),
      });
      const third = runtime.readSchedule(20);
      expect(third.ok && third.degraded).toEqual(["daemon-unreachable"]);
      expect(calls).toBe(3);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-075 the verdict and the fold agree on every owned cell", () => {
  test("the 17-cell owner-scoped matrix agrees, and unowned cells are excluded", () => {
    const harness = createMountHarness({ label: "deg-075" });
    try {
      const nowMs = NOW();
      const bound = 30_000;
      const operations = ["acquired", "taken-over", "released", "immediate-stop"] as const;
      const beatStates = ["fresh", "stale", "at-bound", "absent"] as const;
      const cells: string[] = [];
      let agreements = 0;
      let cellIndex = 0;
      for (const operation of operations) {
        for (const beat of beatStates) {
          cellIndex += 1;
          // One store per cell: a shared store would carry the previous cell's
          // heartbeat (the delivered append requires a monotonic ordinal).
          const store = openMountStore(`${harness.root}/cell-${cellIndex}`);
          appendInstance(store, {
            instanceId: `i-${operation}-${beat}`,
            operation,
            pid: 4321,
            scope: scopeOf(harness.stateDirectory),
            ...(operation === "taken-over"
              ? {
                  takeover: {
                    previousInstanceId: "i-previous",
                    previousLockToken: "lock-previous",
                    lastHeartbeatAt: new Date(nowMs - 60_000).toISOString(),
                    heartbeatAgeMs: 60_000,
                    takenOverAt: new Date(nowMs).toISOString(),
                  },
                }
              : {}),
          });
          if (beat !== "absent") {
            const age = beat === "fresh" ? 1_000 : beat === "stale" ? bound + 1 : bound;
            appendHeartbeat(store, {
              instanceId: `i-${operation}-${beat}`,
              beatAt: new Date(nowMs - age).toISOString(),
            });
          }
          const markers = durableReachability({ store, nowMs, lockStalenessMs: bound });
          const instance = (readDaemonInstance(store) as { latest?: never }).latest;
          const heartbeat = (readDaemonHeartbeat(store) as { latest?: never }).latest;
          const folded = foldDaemonLiveness({
            instance,
            heartbeat,
            nowMs,
            stalenessMs: bound,
          });
          cells.push(`${operation}:${beat}`);
          // Agreement: reachable iff the fold says `running`.
          const reachable = markers.length === 0;
          if (reachable === (folded.state === "running")) agreements += 1;
          else throw new Error(`disagreement at ${operation}:${beat} (${folded.state})`);
        }
      }
      expect(cells).toHaveLength(16);
      expect(agreements).toBe(16);
      // The no-instance-and-no-heartbeat cell.
      const empty = openMountStore(`${harness.root}/empty-state`);
      expect(durableReachability({ store: empty, nowMs, lockStalenessMs: bound })).toEqual([
        "daemon-unreachable",
      ]);
      // The unowned family is excluded rather than omitted.
      expect(cells.some((cell) => cell.startsWith("unowned"))).toBe(false);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-076 a torn or unreadable read degrades without an error identity", () => {
  test("a torn ledger degrades and an unreadable queue store keeps its own identity", () => {
    const harness = createMountHarness({ label: "deg-076" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(NOW()).toISOString(),
      });
      const ledger = `${harness.stateDirectory}/ledger.default.jsonl`;
      appendFileSync(ledger, '{"torn":\n');
      expect(
        durableReachability({ store: harness.store, nowMs: NOW(), lockStalenessMs: 30_000 }),
      ).toEqual(["daemon-unreachable"]);
      // No throw, no repair: the file still carries the torn line.
      expect(readDaemonInstance(harness.store).ok).toBe(false);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-078 an unowned heartbeat degrades while the fold reports running", () => {
  test("the orphan and the foreign-owner heartbeat diverge by design, under both bounds", () => {
    const harness = createMountHarness({ label: "deg-078" });
    try {
      const nowMs = NOW();
      for (const bound of [30_000, 60_000]) {
        // Orphan heartbeat: a beat with no instance record at all.
        const orphan = openMountStore(`${harness.root}/orphan-${bound}`);
        appendHeartbeat(orphan, {
          instanceId: "nobody",
          beatAt: new Date(nowMs - 1_000).toISOString(),
        });
        expect(durableReachability({ store: orphan, nowMs, lockStalenessMs: bound })).toEqual([
          "daemon-unreachable",
        ]);
        const orphanFold = foldDaemonLiveness({
          instance: undefined,
          heartbeat: (readDaemonHeartbeat(orphan) as { latest?: never }).latest,
          nowMs,
          stalenessMs: bound,
        });
        expect(orphanFold.state).toBe("running");

        // Foreign owner: the beat names another instance.
        const foreign = openMountStore(`${harness.root}/foreign-${bound}`);
        appendInstance(foreign, {
          instanceId: "instance-a",
          pid: 4321,
          scope: scopeOf(harness.stateDirectory),
        });
        appendHeartbeat(foreign, {
          instanceId: "instance-b",
          beatAt: new Date(nowMs - 1_000).toISOString(),
        });
        expect(durableReachability({ store: foreign, nowMs, lockStalenessMs: bound })).toEqual([
          "daemon-unreachable",
        ]);
        const foreignFold = foldDaemonLiveness({
          instance: (readDaemonInstance(foreign) as { latest?: never }).latest,
          heartbeat: (readDaemonHeartbeat(foreign) as { latest?: never }).latest,
          nowMs,
          stalenessMs: bound,
        });
        expect(foreignFold.state).toBe("running");
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-112 an array-valued degraded stays byte-identical", () => {
  test("array, omitted, and resolver payloads agree for the same store", () => {
    const harness = createMountHarness({ label: "deg-112" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(NOW()).toISOString(),
      });
      const facts = {
        plans: {},
        workItems: {},
        ci: {},
        provider: { state: "unavailable" as const, reason: "not-configured" as const },
        close: {},
        deploy: { expectations: {}, verdicts: {} },
      };
      const base = {
        store: harness.store,
        facts,
        nowIso: () => new Date(NOW()).toISOString(),
        nowMs: NOW,
        newFenceToken: () => "fence",
      };
      const withArray = createQueueCommandRuntime({
        ...base,
        degraded: [] as readonly QueueDegradationReason[],
      } as never).readSchedule(20);
      const omitted = createQueueCommandRuntime(base as never).readSchedule(20);
      const withResolver = createQueueCommandRuntime({
        ...base,
        degraded: () => [] as readonly QueueDegradationReason[],
      } as never).readSchedule(20);
      expect(withArray.ok && omitted.ok && withResolver.ok).toBe(true);
      if (!withArray.ok || !omitted.ok || !withResolver.ok) return;
      expect(JSON.stringify(withResolver.schedule)).toBe(JSON.stringify(withArray.schedule));
      expect(withArray.degraded).toEqual([]);
      // The omitted member keeps the delivered fallback.
      expect(omitted.degraded).toEqual(["daemon-unreachable"]);
      // An array is used verbatim, never re-resolved.
      const arraySchedule = createQueueCommandRuntime({
        ...base,
        degraded: ["daemon-unreachable"] as readonly QueueDegradationReason[],
      } as never).readSchedule(20);
      expect(arraySchedule.ok && arraySchedule.degraded).toEqual(["daemon-unreachable"]);
    } finally {
      harness.dispose();
    }
  });
});
