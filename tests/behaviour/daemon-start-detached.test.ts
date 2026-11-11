/**
 * The detached-start family (TC-DAEMON-030, 031, 032, 040, 090).
 *
 * Every case invokes the composed `daemon` handler directly (or the composed
 * command runtime), never `runEntrypoint`: the selection/containment surface is
 * TC-DAEMON-015's at the Phase-6 gate. The spawn request is captured from a
 * recording process port, so no real child is created.
 */
import { describe, expect, test } from "bun:test";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { projectExitCode } from "../../packages/cli/src/projection";
import { readDaemonHeartbeat, readDaemonInstance } from "../../packages/core/src/app/index";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { resolveStateDirectoryScope } from "../../packages/core/src/config/index";
import {
  createMountHarness,
  mountComposition,
  stateDirectoryName,
} from "../fixtures/daemon/mount-harness";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";

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
  return definition.handler({
    positionals,
    flags,
    global: {},
  } as unknown as { positionals: readonly string[] } & Record<string, unknown>);
};

const isSuccess = (value: unknown): value is { readonly data: Record<string, unknown> } =>
  typeof value === "object" && value !== null && "data" in value;

describe("TC-DAEMON-030 detached start", () => {
  test("a bare start re-enters the entry path with the declared argv", async () => {
    const harness = createMountHarness({ label: "start-030" });
    try {
      harness.processPort.setSpawn(undefined);
      const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
      const runtime = createDaemonCommandRuntime(mountComposition(harness, { daemonEntry: entry }));
      const result = await invoke(runtime, ["start"]);
      expect(harness.processPort.spawns).toHaveLength(1);
      const spawn = harness.processPort.spawns[0];
      expect(spawn?.entry).toBe(entry);
      expect(spawn?.args).toEqual(["daemon", "start", "--foreground"]);
      // The spawn failed, so nothing durable exists and no success is claimed.
      expect(isSuccess(result)).toBe(false);
    } finally {
      harness.dispose();
    }
  });

  test("success is reported only after a durable acquired instance, from durable state", async () => {
    const harness = createMountHarness({ label: "start-030b" });
    try {
      const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
      harness.processPort.onSpawn(() => {
        appendInstance(harness.store, { pid: 987, scope: scopeOf(harness.stateDirectory) });
        appendHeartbeat(harness.store, { instanceId: "instance-live" });
      });
      const runtime = createDaemonCommandRuntime(mountComposition(harness, { daemonEntry: entry }));
      const result = await invoke(runtime, ["start"]);
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      const data = result.data as {
        instance: { pid: number };
        socket: { path: string };
        heartbeat: { intervalMs: number; ageMs: number };
        degraded: readonly string[];
      };
      expect(data.instance.pid).toBe(987);
      expect(data.socket.path).toBe(harness.settings.socketPath);
      expect(data.heartbeat.intervalMs).toBe(harness.settings.heartbeatIntervalMs);
      // The age is computed from the durable beatAt and the injected now.
      const durable = readDaemonHeartbeat(harness.store);
      expect(durable.ok).toBe(true);
      if (durable.ok) {
        expect(data.heartbeat.ageMs).toBe(
          harness.clock.nowMs() - Date.parse(durable.latest?.beatAt as string),
        );
      }
      // At most 20 polls of the declared interval, never 21.
      expect(harness.clock.sleeps().length).toBeLessThanOrEqual(20);
      expect(new Set(harness.clock.sleeps())).toEqual(new Set([50]));
      expect(["resident", "supervise-only", "foreground"]).toContain(
        (data.instance as { mode?: string }).mode ??
          (data as { instance: { mode: string } }).instance.mode,
      );
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-031 readiness timeout", () => {
  test("an exhausted poll is a classified failure that appends nothing", async () => {
    const harness = createMountHarness({ label: "start-031" });
    try {
      const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
      const runtime = createDaemonCommandRuntime(mountComposition(harness, { daemonEntry: entry }));
      const before = { instances: 0, heartbeats: 0 };
      const instanceRead = readDaemonInstance(harness.store);
      const heartbeatRead = readDaemonHeartbeat(harness.store);
      expect(instanceRead.ok && instanceRead.latest === undefined).toBe(true);
      expect(heartbeatRead.ok && heartbeatRead.latest === undefined).toBe(true);

      const result = await invoke(runtime, ["start"]);
      expect(isSuccess(result)).toBe(false);
      if (isSuccess(result)) return;
      const failure = result as { error: { code: string; summary?: string } };
      expect(failure.error.code).toBe("daemon.state-recovery-failed");
      expect(failure.error.summary ?? "").toContain("readiness");
      expect(harness.clock.sleeps()).toHaveLength(20);
      const afterInstance = readDaemonInstance(harness.store);
      const afterHeartbeat = readDaemonHeartbeat(harness.store);
      expect(afterInstance.ok && afterInstance.latest === undefined).toBe(true);
      expect(afterHeartbeat.ok && afterHeartbeat.latest === undefined).toBe(true);
      expect(before).toEqual({ instances: 0, heartbeats: 0 });

      // The read side stays truthful after the failed start.
      const status = await invoke(runtime, ["status"]);
      expect(isSuccess(status)).toBe(true);
      if (isSuccess(status)) {
        expect((status.data as { live: boolean }).live).toBe(false);
        expect((status.data as { instance: unknown }).instance).toBeNull();
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-030 detached readiness is tied to this spawn", () => {
  const exitFor = (code: string): number => {
    const row = ERROR_TABLE.find((entry) => entry.code === code);
    return row === undefined ? -1 : projectExitCode(row.projectionClass);
  };

  test("(a) a live pre-spawn acquisition refuses daemon.already-running with zero spawns", async () => {
    const harness = createMountHarness({ label: "start-030-live" });
    try {
      const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
      appendInstance(harness.store, { pid: 111, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, { instanceId: "instance-live" });
      const before = readDaemonInstance(harness.store);
      expect(before.ok).toBe(true);
      if (!before.ok || before.latest === undefined) return;
      const beat = readDaemonHeartbeat(harness.store);
      expect(beat.ok).toBe(true);
      if (!beat.ok || beat.latest === undefined) return;

      const runtime = createDaemonCommandRuntime(mountComposition(harness, { daemonEntry: entry }));
      const result = await invoke(runtime, ["start"]);
      expect(isSuccess(result)).toBe(false);
      if (isSuccess(result)) return;
      const failure = result as { error: { code: string; summary?: string } };
      expect(failure.error.code).toBe("daemon.already-running");
      expect(exitFor("daemon.already-running")).toBe(1);
      // The remediation hint names the instance, the process, the acquisition
      // time, and the heartbeat age; the refusal detail carries all four.
      expect(failure.error.summary).toBe(
        `instance=instance-live pid=111 acquired_at=${before.latest.acquiredAt} heartbeat_at=${beat.latest.beatAt} heartbeat_age_ms=${harness.clock.nowMs() - Date.parse(beat.latest.beatAt)}`,
      );
      expect(harness.processPort.spawns).toHaveLength(0);
      // The refusal precedes the poll: no sleep was taken.
      expect(harness.clock.sleeps()).toHaveLength(0);
      const after = readDaemonInstance(harness.store);
      expect(after.ok).toBe(true);
      if (after.ok) {
        expect(after.records).toHaveLength(before.records.length);
        expect(after.latest?.pid).toBe(111);
      }
    } finally {
      harness.dispose();
    }
  });

  test("(b) a legitimate taken-over acquisition of a new instance is accepted", async () => {
    const harness = createMountHarness({ label: "start-030-takeover" });
    try {
      const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
      // A crashed daemon left a stale acquisition behind; the child takes over.
      appendInstance(harness.store, {
        pid: 111,
        scope: scopeOf(harness.stateDirectory),
        recordedAt: "2026-11-11T09:59:00Z",
        heartbeatAt: "2026-11-11T09:59:00Z",
      });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: "2000-01-01T00:00:00Z",
      });
      harness.processPort.onSpawn(() => {
        appendInstance(harness.store, {
          instanceId: "instance-taken-over",
          pid: 222,
          scope: scopeOf(harness.stateDirectory),
          operation: "taken-over",
          takeover: {
            previousInstanceId: "instance-live",
            previousLockToken: "lock-token-fixture",
            lastHeartbeatAt: "2000-01-01T00:00:00Z",
            heartbeatAgeMs: 999,
            takenOverAt: harness.clock.nowIso(),
          },
          recordedAt: harness.clock.nowIso(),
          heartbeatAt: harness.clock.nowIso(),
        });
      });
      const runtime = createDaemonCommandRuntime(mountComposition(harness, { daemonEntry: entry }));
      const result = await invoke(runtime, ["start"]);
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      const data = result.data as { instance: { instanceId: string; pid: number } };
      expect(data.instance.pid).toBe(222);
      expect(data.instance.instanceId).toBe("instance-taken-over");
      // A takeover is accepted on the first readiness poll, never a timeout.
      expect(harness.clock.sleeps().length).toBeLessThanOrEqual(1);
    } finally {
      harness.dispose();
    }
  });

  test("(c) a stale pre-spawn record no new instance replaces is the readiness timeout at exit 2", async () => {
    const harness = createMountHarness({ label: "start-030-stale" });
    try {
      const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
      appendInstance(harness.store, {
        pid: 111,
        scope: scopeOf(harness.stateDirectory),
        recordedAt: "2026-11-11T09:59:00Z",
        heartbeatAt: "2026-11-11T09:59:00Z",
      });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: "2000-01-01T00:00:00Z",
      });
      // The child was spawned but recorded nothing: the stale record is not ours.
      const runtime = createDaemonCommandRuntime(mountComposition(harness, { daemonEntry: entry }));
      const result = await invoke(runtime, ["start"]);
      expect(isSuccess(result)).toBe(false);
      if (isSuccess(result)) return;
      const failure = result as { error: { code: string; summary?: string } };
      expect(failure.error.code).toBe("daemon.state-recovery-failed");
      expect(failure.error.summary ?? "").toContain("readiness");
      expect(exitFor("daemon.state-recovery-failed")).toBe(2);
      expect(harness.processPort.spawns).toHaveLength(1);
      expect(harness.clock.sleeps()).toHaveLength(20);
      // The crash victim is never reported as this start's pid.
      expect(JSON.stringify(result)).not.toContain("pid=111");
      const after = readDaemonInstance(harness.store);
      expect(after.ok && after.latest?.pid).toBe(111);
      expect(after.ok && after.latest?.operation).toBe("acquired");
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-032 in-process start with no entry path", () => {
  test("no entry path spawns nothing and returns the readiness receipt at exit 0", async () => {
    const harness = createMountHarness({ label: "start-032" });
    try {
      const runtime = createDaemonCommandRuntime(mountComposition(harness));
      const result = await invoke(runtime, ["start"]);
      expect(harness.processPort.spawns).toHaveLength(0);
      expect(isSuccess(result)).toBe(true);
      if (!isSuccess(result)) return;
      const data = result.data as { instance: { pid: number }; degraded: readonly string[] };
      expect(harness.processPort.spawns).toHaveLength(0);
      const durable = readDaemonInstance(harness.store);
      expect(durable.ok).toBe(true);
      if (durable.ok) expect(durable.latest?.operation).toBe("acquired");
      // Supervise-only: the lane-executor marker, never `daemon-unreachable`.
      expect(data.degraded).toContain("lane-executor-unavailable");
      expect(data.degraded).not.toContain("daemon-unreachable");
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-090 composing pid", () => {
  test("an in-process start records the injected composing pid, never 0", async () => {
    const harness = createMountHarness({ label: "pid-090" });
    try {
      const runtime = createDaemonCommandRuntime(mountComposition(harness, { pid: 4242 }));
      const result = await invoke(runtime, ["start"]);
      expect(isSuccess(result)).toBe(true);
      const durable = readDaemonInstance(harness.store);
      expect(durable.ok).toBe(true);
      if (!durable.ok) return;
      expect(durable.latest?.pid).toBe(4242);
      expect(Number.isInteger(durable.latest?.pid)).toBe(true);
      expect(durable.latest?.pid).not.toBe(0);
      if (isSuccess(result)) {
        expect((result.data as { instance: { pid: number } }).instance.pid).toBe(4242);
      }

      // A fresh composition reports the same pid from durable state.
      const reader = createDaemonCommandRuntime(
        mountComposition(harness, { store: harness.store, clock: harness.clock }),
      );
      const status = await invoke(reader, ["status"]);
      expect(isSuccess(status)).toBe(true);
      if (isSuccess(status)) {
        const instance = (status.data as { instance: { pid: number } | null }).instance;
        expect(instance?.pid).toBe(4242);
      }
    } finally {
      harness.dispose();
    }
  });

  test("a non-positive or absent pid keeps the delivered fallback and never a positive record", async () => {
    for (const pid of [0, undefined] as const) {
      const harness = createMountHarness({ label: "pid-090-fallback" });
      try {
        const runtime = createDaemonCommandRuntime(
          mountComposition(harness, pid === undefined ? {} : { pid }),
        );
        const result = await invoke(runtime, ["start"]);
        expect(isSuccess(result)).toBe(true);
        const durable = readDaemonInstance(harness.store);
        expect(durable.ok).toBe(true);
        if (!durable.ok) continue;
        expect(durable.latest?.pid).toBe(0);
      } finally {
        harness.dispose();
      }
    }
  });

  test("the pid is the injected value, not a derived or random one", async () => {
    const first = createMountHarness({ label: "pid-090-a" });
    const second = createMountHarness({ label: "pid-090-b" });
    try {
      for (const harness of [first, second]) {
        const runtime = createDaemonCommandRuntime(mountComposition(harness, { pid: 5150 }));
        await invoke(runtime, ["start"]);
      }
      const firstRead = readDaemonInstance(first.store);
      const secondRead = readDaemonInstance(second.store);
      expect(firstRead.ok && firstRead.latest?.pid).toBe(5150);
      expect(secondRead.ok && secondRead.latest?.pid).toBe(5150);
    } finally {
      first.dispose();
      second.dispose();
    }
  });
});

describe("TC-DAEMON-040 re-entry environment", () => {
  const environmentOf = async (
    harnessOptions: Parameters<typeof createMountHarness>[0],
    overrides: Record<string, unknown> = {},
  ) => {
    const harness = createMountHarness(harnessOptions);
    try {
      harness.processPort.setSpawn(undefined);
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          reentryEnvironment: reentryFrom(harness.environment, harness.brand),
          ...overrides,
        }),
      );
      await invoke(runtime, ["start"]);
      const spawn = harness.processPort.spawns[0];
      return {
        environment: spawn?.environment ?? {},
        stateDirectory: harness.stateDirectory,
        brand: harness.brand,
        harness,
      };
    } finally {
      harness.dispose();
    }
  };

  test("fixture (a): the key set is exactly the state binding, PATH, and HOME", async () => {
    const result = await environmentOf({ label: "env-040a" });
    expect([...Object.keys(result.environment)].sort()).toEqual(
      ["HOME", "PATH", stateDirectoryName(result.brand)].sort(),
    );
  });

  test("the state binding is the last own property and carries the resolved directory", async () => {
    const result = await environmentOf({ label: "env-040b" });
    const keys = Object.keys(result.environment);
    const binding = stateDirectoryName(result.brand);
    expect(keys[keys.length - 1]).toBe(binding);
    expect(result.environment[binding]).toBe(result.stateDirectory);
  });

  test("fixture (b): the working-name override appears once and the binding stays last", async () => {
    const result = await environmentOf({
      label: "env-040c",
      environment: { DELIVERY_OS_WORKING_NAME: "renamed-product" },
    });
    const keys = Object.keys(result.environment);
    expect(keys.filter((key) => key === "DELIVERY_OS_WORKING_NAME")).toHaveLength(1);
    expect(result.environment.DELIVERY_OS_WORKING_NAME).toBe("renamed-product");
    expect(keys[keys.length - 1]).toBe(stateDirectoryName(result.brand));
  });

  test("fixture (c): USERPROFILE substitutes for an empty HOME", async () => {
    const result = await environmentOf({
      label: "env-040d",
      environment: { HOME: undefined, USERPROFILE: "/users/fixture" },
    });
    const keys = Object.keys(result.environment);
    expect(keys).not.toContain("HOME");
    expect(result.environment.USERPROFILE).toBe("/users/fixture");
    expect(keys[keys.length - 1]).toBe(stateDirectoryName(result.brand));
  });

  test("fixture (d): an absolute override wins and reaches the store the child opens", async () => {
    const result = await environmentOf({ label: "env-040e", override: "absolute" });
    const binding = stateDirectoryName(result.brand);
    expect(result.environment[binding]).toBe(result.stateDirectory);
    expect(result.stateDirectory).not.toBe(
      `${result.harness.home}/${result.brand.stateDirectoryName}`,
    );
    const childView = resolveStateDirectoryScope({
      environment: result.environment,
      environmentPrefix: result.brand.environmentPrefix,
      stateDirectoryName: result.brand.stateDirectoryName,
    });
    expect(childView.ok).toBe(true);
    if (childView.ok) expect(childView.value).toBe(result.stateDirectory);
  });

  test("the derived environment is a pure function of the injected facts", async () => {
    const first = await environmentOf({ label: "env-040f" });
    const second = await environmentOf({ label: "env-040f-repeat" });
    expect(Object.keys(first.environment)).toEqual(Object.keys(second.environment));
    const normalize = (environment: Record<string, string>, root: string) =>
      Object.fromEntries(
        Object.entries(environment).map(([key, value]) => [
          key,
          key.endsWith("_STATE_DIR") ? "<state-directory>" : value.replace(root, "<root>"),
        ]),
      );
    expect(normalize(first.environment, first.harness.root)).toEqual(
      normalize(second.environment, second.harness.root),
    );
    for (const key of Object.keys(first.environment)) {
      expect(key).toMatch(
        /^(PATH|HOME|USERPROFILE|DELIVERY_OS_WORKING_NAME|[A-Z0-9_]*_STATE_DIR)$/u,
      );
    }
  });

  test("a mutant that writes the binding first lets a forwarded look-alike win", async () => {
    const harness = createMountHarness({ label: "env-040h" });
    try {
      const binding = stateDirectoryName(harness.brand);
      const environment = bindingFirst(
        { PATH: "/usr/bin", [binding]: "/forwarded/other" },
        binding,
        harness.stateDirectory,
      );
      const keys = Object.keys(environment);
      expect(keys[0]).toBe(binding);
      expect(environment[binding]).toBe(harness.stateDirectory);
      // The ordering is what carries authority: the forwarded value is gone only
      // because it was overwritten in place, which is exactly the mutant's bug.
      const mutant = { [binding]: "/forwarded/other", PATH: "/usr/bin" };
      const mutantKeys = Object.keys(mutant);
      expect(mutantKeys[0]).toBe(binding);
      const childView = resolveStateDirectoryScope({
        environment: mutant,
        environmentPrefix: harness.brand.environmentPrefix,
        stateDirectoryName: harness.brand.stateDirectoryName,
      });
      expect(childView.ok).toBe(true);
      if (childView.ok) expect(childView.value).toBe("/forwarded/other");
    } finally {
      harness.dispose();
    }
  });
});

/** The re-entry variables the production composer derives from its own facts. */
export const reentryFrom = (
  environment: Readonly<Record<string, string | undefined>>,
  _brand: { readonly environmentPrefix: string },
): Record<string, string> => {
  const path = environment.PATH;
  const homeVariable =
    environment.HOME !== undefined && environment.HOME.length > 0
      ? "HOME"
      : environment.USERPROFILE !== undefined && environment.USERPROFILE.length > 0
        ? "USERPROFILE"
        : undefined;
  const workingName = environment.DELIVERY_OS_WORKING_NAME;
  return {
    ...(path === undefined ? {} : { PATH: path }),
    ...(homeVariable === undefined ? {} : { [homeVariable]: environment[homeVariable] as string }),
    ...(workingName === undefined || workingName.length === 0
      ? {}
      : { DELIVERY_OS_WORKING_NAME: workingName }),
  };
};

const bindingFirst = (
  forwarded: Record<string, string>,
  binding: string,
  value: string,
): Record<string, string> => {
  const rest = Object.fromEntries(Object.entries(forwarded).filter(([key]) => key !== binding));
  return { [binding]: value, ...rest };
};
