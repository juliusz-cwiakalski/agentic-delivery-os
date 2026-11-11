/**
 * TC-DAEMON-121 — a foreground stop lands inside 1 000 ms with cancellation
 * observed inside 250 ms.
 *
 * The measurement excludes process startup (the command function is called
 * directly) and runs on the delivered real clock, so the cancellation split is
 * the delivered poll granularity (a ≤250 ms poll), not an instant test clock.
 * Five samples; every sample's cancellation instant, stop instant, and durable
 * release are recorded, and the durable record count equals the sample count.
 */
import { describe, expect, test } from "bun:test";
import { createNodeClock } from "@delivery-os/adapters/daemon";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { readDaemonInstance } from "../../packages/core/src/app/index";
import { createMountHarness, mountComposition } from "../fixtures/daemon/mount-harness";
import { appendLane } from "../fixtures/daemon/mount-states";

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

/**
 * The delivered node clock with the loop's cancellation wake instrumented: the
 * instant the loop's own sleep observes `cancelled()` is the cancellation
 * observation the criterion names.
 */
/** A recording signal host: it never touches the test process's signals. */
const createHost = () => {
  const listeners = new Map<string, Set<() => void>>();
  return {
    host: {
      once: (event: "SIGINT" | "SIGTERM", listener: () => void) => {
        const set = listeners.get(event) ?? new Set();
        set.add(listener);
        listeners.set(event, set);
      },
      removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => {
        listeners.get(event)?.delete(listener);
      },
    },
    deliver: (event: "SIGINT" | "SIGTERM") => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener();
    },
  };
};

const measuredClock = () => {
  const base = createNodeClock();
  let observedAt: number | undefined;
  return {
    clock: {
      nowMs: base.nowMs,
      nowIso: base.nowIso,
      sleep: (ms: number, signal?: { readonly cancelled: () => boolean }) =>
        base.sleep(ms, signal).then(() => {
          if (signal?.cancelled() === true && observedAt === undefined) {
            observedAt = performance.now();
          }
        }),
    },
    observedAt: () => observedAt,
  };
};

describe("TC-DAEMON-121 foreground stop latency", () => {
  test("cancellation is inside 250 ms and the stop inside 1 000 ms over five samples", async () => {
    const cancellations: number[] = [];
    const stops: number[] = [];
    const terminalRecords: string[] = [];
    for (let iteration = 0; iteration < 5; iteration += 1) {
      // One fresh store per sample: the delivered heartbeat append requires a
      // monotonic ordinal, so samples never share a record set.
      const harness = createMountHarness({ label: `stop-121-${iteration}` });
      try {
        const measured = measuredClock();
        const signals = createHost();
        appendLane(harness.store, { ref: "GH-286", state: "delivering", spawnOrdinal: 1 });
        const runtime = createDaemonCommandRuntime(
          mountComposition(harness, {
            clock: measured.clock,
            signalHost: signals.host,
          }),
        );
        const command = invoke(runtime, ["start", "--foreground"]);
        // The start snapshot is captured before the loop waits; give the loop a
        // real tick to enter its sleep before the signal arrives.
        await new Promise((resolve) => setTimeout(resolve, 20));
        const t0 = performance.now();
        signals.deliver("SIGTERM");
        const result = await command;
        stops.push(performance.now() - t0);
        expect("data" in result).toBe(true);
        const observed = measured.observedAt();
        expect(observed).toBeDefined();
        cancellations.push((observed ?? Number.POSITIVE_INFINITY) - t0);
        const durable = readDaemonInstance(harness.store);
        if (durable.ok && durable.latest !== undefined) {
          terminalRecords.push(durable.latest.operation);
        }
      } finally {
        harness.dispose();
      }
    }
    const recorded = {
      case: "TC-DAEMON-121",
      samples: 5,
      cancellationMs: cancellations.map((value) => Number(value.toFixed(2))),
      stopMs: stops.map((value) => Number(value.toFixed(2))),
    };
    console.log(JSON.stringify(recorded));
    expect(cancellations).toHaveLength(5);
    expect(stops).toHaveLength(5);
    // The declared split: cancellation observed inside 250 ms, stop inside 1 000 ms.
    expect(Math.max(...cancellations)).toBeLessThanOrEqual(250);
    expect(Math.max(...stops)).toBeLessThanOrEqual(1_000);
    // The bound is met without skipping the release: one terminal record each.
    expect(terminalRecords).toEqual(["released", "released", "released", "released", "released"]);
  });
});
