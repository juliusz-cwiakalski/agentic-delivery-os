/**
 * The composed control plane and the status surface (TC-DAEMON-060, 061, 062,
 * 063, 122).
 *
 * Every case composes `createDaemonCommandRuntime` directly over an injected
 * control transport and socket path (both `DaemonComposition` inputs) and reads
 * a store written by one handle through a fresh handle, so the read side is
 * proved against durable state rather than against a cached in-process value.
 * No case goes through `runEntrypoint`.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { readDaemonHeartbeat, readDaemonInstance } from "../../packages/core/src/app/index";
import {
  CONTROL_PROTOCOL_CURRENT,
  type ControlConnection,
  type ControlTransport,
  DAEMON_MAX_FRAME_BYTES,
  LOCAL_CALLER_PRINCIPAL,
} from "../../packages/core/src/contracts/index";
import {
  decodeControlLine,
  encodeControlFrame,
} from "../../packages/core/src/domain/control-codec";
import { renderDaemonStatusHuman } from "../../packages/core/src/index";
import { canonicalJson, normalizeStatus } from "../fixtures/daemon/mount-golden/normalize";
import {
  createMountClock,
  createMountHarness,
  mountComposition,
  mountSettings,
  openMountStore,
} from "../fixtures/daemon/mount-harness";
import {
  appendHeartbeat,
  appendInstance,
  MOUNT_NOW,
  scopeOf,
} from "../fixtures/daemon/mount-states";

type ProbeTransport = {
  readonly transport: ControlTransport;
  readonly counters: { connects: number; listens: number; writes: number };
};

/** A control transport that answers the probe synchronously, or refuses it. */
export const createProbeTransport = (options: { readonly reachable: boolean }): ProbeTransport => {
  const counters = { connects: 0, listens: 0, writes: 0 };
  const transport: ControlTransport = {
    listen: async () => {
      counters.listens += 1;
      throw { code: "daemon.socket-unreachable" } as never;
    },
    connect: async (): Promise<ControlConnection> => {
      counters.connects += 1;
      if (!options.reachable) throw { code: "daemon.socket-unreachable" } as never;
      let onLine: ((line: string) => void) | undefined;
      const connection = {
        onLine: (callback: (line: string) => void) => {
          onLine = callback;
        },
        onClose: () => undefined,
        write: (line: string) => {
          counters.writes += 1;
          const decoded = decodeControlLine(line.replace(/\r?\n$/u, ""));
          if (!decoded.ok) return;
          const frame = decoded.frame;
          if (!("id" in frame)) return;
          onLine?.(
            encodeControlFrame({
              v: CONTROL_PROTOCOL_CURRENT,
              kind: "response",
              type: "status",
              id: frame.id,
              data: { live: true },
              callerPrincipal: LOCAL_CALLER_PRINCIPAL,
            } as never).trimEnd(),
          );
        },
        close: () => undefined,
      };
      return connection as unknown as ControlConnection;
    },
  };
  return { transport, counters };
};

const invokeHandler = async (
  runtime: ReturnType<typeof createDaemonCommandRuntime>,
  argv: readonly string[],
) => {
  const definition = createDaemonCommandDefinition(runtime);
  const [subcommand, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = subcommand === undefined ? [] : [subcommand];
  for (const token of rest) flags[token] = true;
  return definition.handler({ positionals, flags, global: {} } as never);
};

const isFailure = (value: unknown): value is { error: { code: string; kind: string } } =>
  typeof value === "object" && value !== null && "error" in value;

type StatusData = {
  instance: {
    instanceId: string;
    pid: number;
    scope: string;
    acquiredAt: string;
    mode: string;
  } | null;
  heartbeat: { ageMs: number | null; intervalMs: number; state: string };
  socket: { path: string; reachable: boolean; transport: string };
  supervisor: {
    kind: string;
    unit: string;
    scope: string;
    installed: boolean;
    linger: boolean;
    commandForm: string;
    serviceType: string;
    restartPolicy: string;
  };
  degraded: readonly string[];
  live: boolean;
  queueDepth: number;
  lanes: readonly unknown[];
  reconciliation: unknown;
  mergeCodePath: string;
};

describe("TC-DAEMON-060 plain status reports the durable projection", () => {
  test("a live/fresh instance reports every field from durable state", async () => {
    const harness = createMountHarness({ label: "status-060" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, { instanceId: "instance-live" });
      const probe = createProbeTransport({ reachable: true });
      const fresh = openMountStore(harness.stateDirectory);
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          store: fresh,
          clock: createMountClock(),
          transport: probe.transport,
        }),
      );
      const status = await invokeHandler(runtime, ["status"]);
      expect(isFailure(status)).toBe(false);
      if (isFailure(status)) return;
      const data = status.data as StatusData;
      expect(data.instance).not.toBeNull();
      expect(data.instance?.instanceId).toBe("instance-live");
      expect(data.instance?.pid).toBe(4321);
      expect(data.instance?.scope).toBe(scopeOf(harness.stateDirectory));
      expect(data.instance?.acquiredAt).toBe(MOUNT_NOW);
      expect(data.instance?.mode).toBe("supervise-only");
      expect(data.heartbeat.ageMs).toBe(0);
      expect(data.heartbeat.intervalMs).toBe(harness.settings.heartbeatIntervalMs);
      expect(data.socket.path).toBe(harness.settings.socketPath);
      expect(data.socket.reachable).toBe(true);
      expect(data.supervisor).toMatchObject({
        kind: "systemd-user",
        unit: `${harness.brand.binaryName}-daemon.service`,
        scope: scopeOf(harness.stateDirectory),
        installed: false,
        commandForm: "foreground",
        serviceType: "simple",
        restartPolicy: "on-failure",
      });
      // Supervise-only is `lane-executor-unavailable`, never `daemon-unreachable`.
      expect(data.degraded).not.toContain("daemon-unreachable");
      expect(data.live).toBe(false);
      // The probe was consulted exactly once and appended nothing.
      expect(probe.counters.connects).toBe(1);
      expect(readDaemonInstance(fresh).ok).toBe(true);
      expect(readDaemonHeartbeat(fresh).ok).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("released and absent stores stay exit 0 and report `daemon-unreachable`", async () => {
    for (const shape of ["released", "absent"] as const) {
      const harness = createMountHarness({ label: `status-060-${shape}` });
      try {
        if (shape === "released") {
          appendInstance(harness.store);
          appendInstance(harness.store, { operation: "released", releaseReason: "drain" });
        }
        // No daemon is running for these shapes, so the socket refuses.
        const probe = createProbeTransport({ reachable: false });
        const fresh = openMountStore(harness.stateDirectory);
        const runtime = createDaemonCommandRuntime(
          mountComposition(harness, {
            store: fresh,
            clock: createMountClock(),
            transport: probe.transport,
          }),
        );
        const status = await invokeHandler(runtime, ["status"]);
        expect(isFailure(status)).toBe(false);
        if (isFailure(status)) continue;
        const data = status.data as StatusData;
        expect(data.live).toBe(false);
        expect(data.socket.reachable).toBe(false);
        expect(data.degraded).toContain("daemon-unreachable");
        if (shape === "absent") expect(data.instance).toBeNull();
        expect(probe.counters.connects).toBe(1);
      } finally {
        harness.dispose();
      }
    }
  });

  test("an unreachable socket is reported, not thrown, and the payload is deterministic", async () => {
    const harness = createMountHarness({ label: "status-060-unreachable" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, { instanceId: "instance-live" });
      const probe = createProbeTransport({ reachable: false });
      const fresh = openMountStore(harness.stateDirectory);
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          store: fresh,
          clock: createMountClock(),
          transport: probe.transport,
        }),
      );
      const first = await invokeHandler(runtime, ["status"]);
      expect(isFailure(first)).toBe(false);
      if (isFailure(first)) return;
      const data = first.data as StatusData;
      expect(data.socket.reachable).toBe(false);
      expect(data.degraded).toContain("daemon-unreachable");

      const second = await invokeHandler(runtime, ["status"]);
      expect(isFailure(second)).toBe(false);
      if (isFailure(second)) return;
      expect(canonicalJson(second.data)).toBe(canonicalJson(first.data));

      // The recorded normalized matrix is stable across runs.
      const normalized = normalizeStatus(first.data, {
        root: harness.root,
        stateDirectory: harness.stateDirectory,
        scopeDigest: scopeOf(harness.stateDirectory),
      });
      const recorded = JSON.parse(
        readFileSync(
          join(process.cwd(), "tests/fixtures/daemon/mount-golden/status-unreachable.json"),
          "utf8",
        ),
      ) as unknown;
      expect(canonicalJson(normalized)).toBe(canonicalJson(recorded));
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-061 and TC-DAEMON-062 the live surface", () => {
  test("--live against a reachable resident returns the live envelope at exit 0", async () => {
    const harness = createMountHarness({ label: "status-061" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, { instanceId: "instance-live" });
      const probe = createProbeTransport({ reachable: true });
      const fresh = openMountStore(harness.stateDirectory);
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          store: fresh,
          clock: createMountClock(),
          transport: probe.transport,
        }),
      );
      const live = await invokeHandler(runtime, ["status", "--live"]);
      expect(isFailure(live)).toBe(false);
      if (isFailure(live)) return;
      const data = live.data as StatusData;
      expect(data.live).toBe(true);
      expect(data.socket.reachable).toBe(true);
      expect(data.heartbeat.state).toBe("running");
      expect(probe.counters.connects).toBe(1);

      const plain = await invokeHandler(runtime, ["status"]);
      expect(isFailure(plain)).toBe(false);
      if (isFailure(plain)) return;
      const plainData = plain.data as StatusData;
      expect(plainData.live).toBe(false);
      expect(plainData.socket.reachable).toBe(true);
      expect(plainData.instance?.instanceId).toBe(data.instance?.instanceId);
      expect(probe.counters.connects).toBe(2);
      // No write was performed by either read.
      const instances = readDaemonInstance(fresh);
      const heartbeats = readDaemonHeartbeat(fresh);
      expect(instances.ok && heartbeats.ok).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("--live fails closed for an unreachable socket and a stale beat while plain status stays degraded", async () => {
    // Unreachable socket.
    const unreachable = createMountHarness({ label: "status-062a" });
    try {
      appendInstance(unreachable.store, { pid: 4321, scope: scopeOf(unreachable.stateDirectory) });
      appendHeartbeat(unreachable.store, { instanceId: "instance-live" });
      const probe = createProbeTransport({ reachable: false });
      const fresh = openMountStore(unreachable.stateDirectory);
      const runtime = createDaemonCommandRuntime(
        mountComposition(unreachable, {
          store: fresh,
          clock: createMountClock(),
          transport: probe.transport,
        }),
      );
      const live = await invokeHandler(runtime, ["status", "--live"]);
      expect(isFailure(live)).toBe(true);
      if (isFailure(live)) expect(live.error.code).toBe("daemon.socket-unreachable");
      const plain = await invokeHandler(runtime, ["status"]);
      expect(isFailure(plain)).toBe(false);
      if (!isFailure(plain)) {
        expect((plain.data as StatusData).live).toBe(false);
        expect((plain.data as StatusData).degraded).toContain("daemon-unreachable");
      }
    } finally {
      unreachable.dispose();
    }

    // Reachable socket with a stale heartbeat.
    const stale = createMountHarness({ label: "status-062b" });
    try {
      appendInstance(stale.store, { pid: 4321, scope: scopeOf(stale.stateDirectory) });
      appendHeartbeat(stale.store, { instanceId: "instance-live", beatAt: "2000-01-01T00:00:00Z" });
      const probe = createProbeTransport({ reachable: true });
      const fresh = openMountStore(stale.stateDirectory);
      const runtime = createDaemonCommandRuntime(
        mountComposition(stale, {
          store: fresh,
          clock: createMountClock(),
          transport: probe.transport,
        }),
      );
      const live = await invokeHandler(runtime, ["status", "--live"]);
      expect(isFailure(live)).toBe(true);
      if (isFailure(live)) expect(live.error.code).toBe("daemon.heartbeat-stale");
      expect(canonicalJson(live)).not.toContain("lock-token-fixture");
      const plain = await invokeHandler(runtime, ["status"]);
      expect(isFailure(plain)).toBe(false);
    } finally {
      stale.dispose();
    }

    // The fresh control still succeeds, so the failures are not vacuous.
    const control = createMountHarness({ label: "status-062c" });
    try {
      appendInstance(control.store, { pid: 4321, scope: scopeOf(control.stateDirectory) });
      appendHeartbeat(control.store, { instanceId: "instance-live" });
      const probe = createProbeTransport({ reachable: true });
      const fresh = openMountStore(control.stateDirectory);
      const runtime = createDaemonCommandRuntime(
        mountComposition(control, {
          store: fresh,
          clock: createMountClock(),
          transport: probe.transport,
        }),
      );
      const live = await invokeHandler(runtime, ["status", "--live"]);
      expect(isFailure(live)).toBe(false);
    } finally {
      control.dispose();
    }
  });
});

describe("TC-DAEMON-063 the configured control plane", () => {
  test("the configured socket path and interval reach the runtime", () => {
    const harness = createMountHarness({ label: "config-063" });
    try {
      const settings = mountSettings(harness.stateDirectory, {
        daemon: {
          "socket-path": `${harness.stateDirectory}/configured.sock`,
          "heartbeat-interval": 1234,
        },
      });
      expect(settings.socketPath).toBe(`${harness.stateDirectory}/configured.sock`);
      expect(settings.heartbeatIntervalMs).toBe(1234);

      const status = async () => {
        const probe = createProbeTransport({ reachable: true });
        const fresh = openMountStore(harness.stateDirectory);
        const runtime = createDaemonCommandRuntime(
          mountComposition(harness, {
            store: fresh,
            settings,
            clock: createMountClock(),
            transport: probe.transport,
          }),
        );
        return invokeHandler(runtime, ["status"]);
      };
      return status().then((result) => {
        expect(isFailure(result)).toBe(false);
        if (!isFailure(result)) {
          const data = result.data as StatusData;
          expect(data.socket.path).toBe(`${harness.stateDirectory}/configured.sock`);
          expect(data.heartbeat.intervalMs).toBe(1234);
        }
      });
    } finally {
      harness.dispose();
    }
  });

  test("the empty-branch fallback is the same delivered resolver", () => {
    const harness = createMountHarness({ label: "config-063b" });
    try {
      const defaults = mountSettings(harness.stateDirectory);
      expect(defaults.socketPath).toBe(`${harness.stateDirectory}/daemon.sock`);
      expect(defaults.heartbeatIntervalMs).toBe(5_000);
      // Determinism: the same facts resolve identically twice.
      expect(mountSettings(harness.stateDirectory)).toEqual(defaults);
    } finally {
      harness.dispose();
    }
  });

  test("no literal socket name or interval is re-derived in the composition", () => {
    const source = readFileSync(join(process.cwd(), "packages/cli/src/production.ts"), "utf8");
    expect(source).not.toContain("daemon.sock");
    expect(source).not.toContain("5_000");
    expect(source).toContain("resolveDaemonSettings");
  });
});

describe("TC-DAEMON-122 status latency and output bounds", () => {
  test("p95 is inside the declared bounds and the payload stays bounded", async () => {
    const harness = createMountHarness({ label: "perf-122" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, { instanceId: "instance-live" });
      const probe = createProbeTransport({ reachable: true });
      const fresh = openMountStore(harness.stateDirectory);
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          store: fresh,
          clock: createMountClock(),
          transport: probe.transport,
        }),
      );

      const sample = async (live: boolean, iterations: number): Promise<number> => {
        const durations: number[] = [];
        for (let index = 0; index < iterations; index += 1) {
          const startedAt = performance.now();
          await invokeHandler(runtime, live ? ["status", "--live"] : ["status"]);
          durations.push(performance.now() - startedAt);
        }
        durations.sort((left, right) => left - right);
        return (
          durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)] ?? 0
        );
      };

      const plainP95 = await sample(false, 20);
      const liveP95 = await sample(true, 20);
      // Recorded method: the command function directly, process startup excluded.
      expect(plainP95).toBeLessThanOrEqual(1_000);
      expect(liveP95).toBeLessThanOrEqual(2_000);

      const status = await invokeHandler(runtime, ["status"]);
      if (!isFailure(status)) {
        const machineBytes = new TextEncoder().encode(JSON.stringify(status.data)).length;
        expect(machineBytes).toBeLessThanOrEqual(DAEMON_MAX_FRAME_BYTES);
        const human = renderDaemonStatusHuman(status.data as never);
        expect(human.length).toBeGreaterThan(0);
        expect(human.split("\n").length).toBeLessThanOrEqual(200);
      }
      expect(probe.counters.listens).toBe(0);
    } finally {
      harness.dispose();
    }
  });
});
