/**
 * TC-LIFE-005 / TC-DEGRADE-003 — the 3x2 status matrix: plain status always
 * exits 0 with a declared state; only --live fails closed.
 */
import { describe, expect, test } from "bun:test";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { renderDaemonStatusHuman } from "../../packages/core/src/domain/daemon-status";
import type { DaemonStatusData } from "../../packages/core/src/contracts/index";
import { runProgram } from "../fixtures/queue-ready/harness";

const base = (state: "running" | "stale" | "stopped"): DaemonStatusData => ({
  instance:
    state === "stopped"
      ? null
      : {
          instanceId: "instance-1",
          pid: 1,
          scope: "s",
          acquiredAt: "2026-11-08T10:00:00Z",
          mode: "resident",
        },
  uptimeMs: 0,
  queueDepth: 0,
  lanes: [],
  restarts: [],
  heartbeat: { ageMs: state === "running" ? 0 : null, intervalMs: 5000, state },
  socket: { path: "<state-dir>/daemon.sock", transport: "unix", reachable: state === "running" },
  supervisor: {
    kind: "systemd-user",
    installed: false,
    unit: "ados.service",
    scope: "s",
    linger: false,
    commandForm: "foreground",
    serviceType: "simple",
    restartPolicy: "on-failure",
  },
  reconciliation: null,
  mergeCodePath: "absent",
  degraded: state === "running" ? [] : ["daemon-unreachable"],
  truncated: false,
});

const program = (state: "running" | "stale" | "stopped", live: boolean) =>
  ({
    commands: {
      daemon: createDaemonCommandDefinition({
        start: async () => ({ error: { kind: "daemon", code: "daemon.already-running" } }),
        stop: async () => ({
          data: { result: "noop", instance: null, detachedLanes: [], degraded: [] },
        }),
        status: async () =>
          live && state !== "running"
            ? { error: { kind: "daemon", code: "daemon.heartbeat-stale" } }
            : { data: { ...base(state), live } },
        install: async () => ({
          data: { result: "noop", supervisor: base(state).supervisor, degraded: [] },
        }),
        uninstall: async () => ({
          data: { result: "noop", supervisor: base(state).supervisor, degraded: [] },
        }),
      }),
    },
  }) as never;

describe("GH-238 daemon status matrix", () => {
  for (const state of ["running", "stale", "stopped"] as const) {
    test(`plain status in ${state} exits 0 and never fabricates liveness`, async () => {
      const run = await runProgram(["daemon", "status", "--json"], program(state, false));
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain(`"state": "${state}"`);
      expect(renderDaemonStatusHuman(base(state))).toContain(`heartbeat=${state}`);
    });
    test(`status --live in ${state} ${state === "running" ? "succeeds" : "fails closed"}`, async () => {
      const run = await runProgram(["daemon", "status", "--live", "--json"], program(state, true));
      expect(run.exitCode).toBe(state === "running" ? 0 : 2);
    });
  }
});
