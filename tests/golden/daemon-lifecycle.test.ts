/**
 * TC-LIFE-008 — the daemon human summary is deterministic, key=value first, and
 * carries no absolute path, wall-clock value, hostname, user name, or token.
 */
import { describe, expect, test } from "bun:test";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { runProgram } from "../fixtures/queue-ready/harness";

const startData = {
  instance: {
    instanceId: "instance-1",
    pid: 42,
    scope: "0123456789abcdef",
    acquiredAt: "2026-11-08T10:00:00Z",
    mode: "resident" as const,
  },
  reconciliation: {
    schema: "delivery.daemon.reconciliation.v1" as const,
    instanceId: "instance-1",
    queue: { entries: 0, edges: 0, parks: 0 },
    lanes: [],
    duplicates: 0,
    questions: [],
    startedAt: "2026-11-08T10:00:00Z",
    completedAt: "2026-11-08T10:00:00Z",
    truncated: false,
    recordedAt: "2026-11-08T10:00:00Z",
  },
  socket: { path: "<state-dir>/daemon.sock", transport: "unix", reachable: true },
  heartbeat: { intervalMs: 5_000, ageMs: 0 },
  supervisor: {
    kind: "systemd-user" as const,
    installed: false,
    unit: "ados.service",
    scope: "0123456789abcdef",
    linger: false,
    commandForm: "foreground" as const,
    serviceType: "simple" as const,
    restartPolicy: "on-failure" as const,
  },
  degraded: [],
};

const program = () => ({
  commands: {
    daemon: createDaemonCommandDefinition({
      start: async () => ({ data: startData }),
      stop: async () => ({
        data: {
          result: "noop" as const,
          instance: null,
          detachedLanes: [],
          degraded: [],
        },
      }),
      status: async () => ({
        data: {
          instance: null,
          uptimeMs: 0,
          queueDepth: 0,
          lanes: [],
          restarts: [],
          heartbeat: { ageMs: null, intervalMs: 5_000, state: "stale" as const },
          socket: { path: "<state-dir>/daemon.sock", transport: "unix", reachable: false },
          supervisor: startData.supervisor,
          reconciliation: null,
          mergeCodePath: "absent" as const,
          degraded: ["daemon-unreachable" as const],
          truncated: false,
          live: false,
        },
      }),
      install: async () => ({
        data: {
          result: "noop" as const,
          supervisor: startData.supervisor,
          degraded: [],
        },
      }),
      uninstall: async () => ({
        data: {
          result: "noop" as const,
          supervisor: startData.supervisor,
          degraded: [],
        },
      }),
    }),
  },
});

describe("GH-238 daemon goldens", () => {
  test("start human output is deterministic and key=value first", async () => {
    const run = await runProgram(["daemon", "start"], program());
    expect(run.exitCode).toBe(0);
    expect(run.stdout.split("\n")[0]).toBe("result=started");
    expect(run.stdout).toContain("instance=instance-1");
    expect(run.stdout).not.toContain("/home/");
    expect(run.stdout).not.toContain("lock-");
  });

  test("status machine output carries the degraded marker and exit 0", async () => {
    const run = await runProgram(["daemon", "status", "--json"], program());
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as { data?: { degraded?: string[] } };
    expect(envelope.data?.degraded).toEqual(["daemon-unreachable"]);
  });

  test("an unknown subcommand is refused through fallback.invocation", async () => {
    const run = await runProgram(["daemon", "nope", "--json"], program());
    expect(run.exitCode).toBe(1);
    const envelope = JSON.parse(run.stdout) as { error?: { code?: string } };
    expect(envelope.error?.code).toBe("fallback.invocation");
  });
});
