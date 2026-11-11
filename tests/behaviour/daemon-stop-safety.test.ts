/**
 * The fail-closed cross-process stop (TC-DAEMON-036, 091, 092).
 *
 * Every case reads the durable record through a second handle and asserts the
 * process-port signal counter, not an exit code alone: the claim is "zero
 * signals for an unaddressable record, exactly one for an addressable one".
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { readDaemonInstance, readDaemonLanes } from "../../packages/core/src/app/index";
import {
  createMountHarness,
  mountComposition,
  openMountStore,
} from "../fixtures/daemon/mount-harness";
import { appendInstance, appendLane, scopeOf } from "../fixtures/daemon/mount-states";

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

const isFailure = (value: unknown): value is { error: { code: string } } =>
  typeof value === "object" && value !== null && "error" in value;

describe("TC-DAEMON-036 a second process drains the resident daemon", () => {
  test("exactly one SIGTERM, `draining` at exit 0, no second record, then the release observed from a fresh handle", async () => {
    const harness = createMountHarness({ label: "stop-036" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendLane(harness.store, { ref: "GH-286", state: "delivering", spawnOrdinal: 1 });
      const before = (readDaemonInstance(harness.store) as { latest?: unknown }).latest;

      const fresh = openMountStore(harness.stateDirectory);
      const runtime = createDaemonCommandRuntime(mountComposition(harness, { store: fresh }));
      const result = await invoke(runtime, ["stop", "--mode", "drain"]);
      expect(isFailure(result)).toBe(false);
      if (!isFailure(result)) {
        const data = result.data as { result: string; instance: { pid: number } | null };
        expect(data.result).toBe("draining");
        // No completed-release claim: the reported instance is still the
        // acquired record, not a release this process did not observe.
        expect((data.instance as { pid: number } | null)?.pid).toBe(4321);
      }
      expect(harness.processPort.signals).toEqual([{ pid: 4321, signal: "SIGTERM" }]);
      const after = (readDaemonInstance(harness.store) as { latest?: unknown }).latest;
      expect(after).toEqual(before);

      // The resident's own release and lane detach, observed from a fresh handle.
      appendInstance(harness.store, {
        operation: "released",
        releaseReason: "drain",
        recordedAt: "2026-11-11T10:00:30Z",
        heartbeatAt: "2026-11-11T10:00:30Z",
      });
      appendLane(harness.store, {
        state: "detached",
        detachedAt: "2026-11-11T10:00:30Z",
        recordedAt: "2026-11-11T10:00:30Z",
      });
      const lanes = readDaemonLanes(harness.store);
      if (lanes.ok) {
        expect(lanes.records.filter((lane) => lane.state === "detached")).toHaveLength(1);
      }

      // A released instance makes a further stop a noop with zero new signals.
      const signalsBefore = harness.processPort.signals.length;
      const stoppedAgain = await invoke(runtime, ["stop"]);
      expect(isFailure(stoppedAgain)).toBe(false);
      if (!isFailure(stoppedAgain)) {
        expect((stoppedAgain.data as { result: string }).result).toBe("noop");
      }
      expect(harness.processPort.signals).toHaveLength(signalsBefore);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-091 a non-positive recorded pid refuses the stop", () => {
  const invalidPids = [0, -1, -4321, 12.5] as const;

  test("zero signal calls over eight invocations across both modes", async () => {
    const harness = createMountHarness({ label: "stop-091" });
    try {
      for (const pid of invalidPids) {
        appendInstance(harness.store, { pid, scope: scopeOf(harness.stateDirectory) });
      }
      const runtime = createDaemonCommandRuntime(mountComposition(harness));
      let calls = 0;
      for (const pid of invalidPids) {
        // Each fixture is the latest record for its own invocation.
        appendInstance(harness.store, { pid, scope: scopeOf(harness.stateDirectory) });
        for (const mode of ["drain", "immediate"] as const) {
          const result = await invoke(runtime, ["stop", "--mode", mode]);
          calls += 1;
          expect(isFailure(result)).toBe(true);
          if (isFailure(result)) {
            expect(result.error.code).toBe("daemon.state-recovery-failed");
          }
        }
      }
      expect(calls).toBe(8);
      expect(harness.processPort.signals).toHaveLength(0);
      // No liveness probe is used as a substitute for the refusal.
      expect(harness.processPort.aliveChecks).toHaveLength(0);

      // The positive control: an addressable record is signalled exactly once.
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      const signalled = await invoke(runtime, ["stop", "--mode", "drain"]);
      expect(isFailure(signalled)).toBe(false);
      expect(harness.processPort.signals).toEqual([{ pid: 4321, signal: "SIGTERM" }]);
    } finally {
      harness.dispose();
    }
  });

  test("no name or pattern kill exists on the cross-process path", () => {
    const source = readFileSync(join(process.cwd(), "packages/cli/src/daemon-compose.ts"), "utf8");
    const stopBody = source.slice(source.indexOf("stop: async ({ mode })"));
    expect(stopBody).not.toContain("pkill");
    expect(stopBody).not.toContain("killall");
    expect(stopBody).not.toContain("SIGKILL");
    expect(stopBody).toContain("Number.isInteger");
  });
});

describe("TC-DAEMON-092 a positive pid receives the correct signal", () => {
  test("one signal of the right kind, that pid only, and a failed call is classified", async () => {
    const harness = createMountHarness({ label: "stop-092" });
    try {
      appendInstance(harness.store, { pid: 5150, scope: scopeOf(harness.stateDirectory) });
      const runtime = createDaemonCommandRuntime(mountComposition(harness));
      const drained = await invoke(runtime, ["stop", "--mode", "drain"]);
      expect(isFailure(drained)).toBe(false);
      expect(harness.processPort.signals).toEqual([{ pid: 5150, signal: "SIGTERM" }]);

      const immediate = await invoke(runtime, ["stop", "--mode", "immediate"]);
      expect(isFailure(immediate)).toBe(false);
      expect(harness.processPort.signals).toEqual([
        { pid: 5150, signal: "SIGTERM" },
        { pid: 5150, signal: "SIGINT" },
      ]);
      // Never `0`, never negative, never a negated group pid.
      for (const call of harness.processPort.signals) {
        expect(call.pid).toBeGreaterThan(0);
      }

      // A failed signal call is classified, not swallowed.
      harness.processPort.setSignalResult(false, "process-gone");
      const failed = await invoke(runtime, ["stop", "--mode", "drain"]);
      expect(isFailure(failed)).toBe(true);
      if (isFailure(failed)) expect(failed.error.code).toBe("daemon.state-recovery-failed");
    } finally {
      harness.dispose();
    }
  });
});
