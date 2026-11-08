/** TC-INSTALL-002/006 — install/uninstall envelopes are deterministic and honest. */
import { describe, expect, test } from "bun:test";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { runProgram } from "../fixtures/queue-ready/harness";

const descriptor = {
  kind: "systemd-user" as const,
  installed: true,
  unit: "ados.service",
  scope: "0123456789abcdef",
  linger: true,
  commandForm: "foreground" as const,
  serviceType: "simple" as const,
  restartPolicy: "on-failure" as const,
};

const program = (unsupported = false) =>
  ({
    commands: {
      daemon: createDaemonCommandDefinition({
        start: async () => ({ error: { kind: "daemon", code: "daemon.already-running" } }),
        stop: async () => ({
          data: { result: "noop", instance: null, detachedLanes: [], degraded: [] },
        }),
        status: async () => ({ error: { kind: "daemon", code: "daemon.heartbeat-stale" } }),
        install: async () =>
          unsupported
            ? { error: { kind: "daemon", code: "daemon.supervisor-unsupported" } }
            : { data: { result: "installed", supervisor: descriptor, degraded: [] } },
        uninstall: async () => ({
          data: {
            result: "noop",
            supervisor: { ...descriptor, installed: false, linger: false },
            degraded: [],
          },
        }),
      }),
    },
  }) as never;

describe("GH-238 daemon install golden", () => {
  test("install exits 0 with a deterministic, path-free envelope", async () => {
    const run = await runProgram(["daemon", "install", "--json"], program());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('"commandForm": "foreground"');
    expect(run.stdout).not.toContain("/home/");
    expect(run.stdout).not.toContain("lock-");
  });

  test("an unsupported platform exits 2", async () => {
    const run = await runProgram(["daemon", "install", "--json"], program(true));
    expect(run.exitCode).toBe(2);
    expect(run.stdout).toContain("daemon.supervisor-unsupported");
  });
});
