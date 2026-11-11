/**
 * TC-DAEMON-121 — a foreground stop lands inside 1 000 ms with cancellation
 * inside 250 ms.
 *
 * The measurement excludes process startup (the command function is called
 * directly) and uses the delivered in-process stop, so the claim is about the
 * lifetime path rather than about the harness. Five samples, and the durable
 * record count equals the iteration count.
 */
import { describe, expect, test } from "bun:test";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { readDaemonInstance } from "../../packages/core/src/app/index";
import { createMountHarness, mountComposition } from "../fixtures/daemon/mount-harness";

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

describe("TC-DAEMON-121 foreground stop latency", () => {
  test("cancellation is inside 250 ms and the stop inside 1 000 ms over five samples", async () => {
    const durations: number[] = [];
    const terminalRecords: string[] = [];
    for (let iteration = 0; iteration < 5; iteration += 1) {
      // One fresh store per sample: the delivered heartbeat append requires a
      // monotonic ordinal, so samples never share a record set.
      const harness = createMountHarness({ label: `stop-121-${iteration}` });
      try {
        const runtime = createDaemonCommandRuntime(mountComposition(harness));
        const started = await invoke(runtime, ["start", "--foreground"]);
        expect("data" in started).toBe(true);
        const t0 = performance.now();
        const result = await invoke(runtime, ["stop", "--mode", "drain"]);
        const t2 = performance.now();
        expect("data" in result).toBe(true);
        durations.push(t2 - t0);
        const durable = readDaemonInstance(harness.store);
        if (durable.ok && durable.latest !== undefined) {
          terminalRecords.push(durable.latest.operation);
        }
      } finally {
        harness.dispose();
      }
    }
    expect(durations).toHaveLength(5);
    // Measurement method: the command function directly, process startup excluded.
    expect(Math.max(...durations)).toBeLessThanOrEqual(250);
    expect(Math.max(...durations)).toBeLessThanOrEqual(1_000);
    // The release is present when the stop returns: one terminal record per sample.
    expect(terminalRecords).toEqual(["released", "released", "released", "released", "released"]);
  });
});
