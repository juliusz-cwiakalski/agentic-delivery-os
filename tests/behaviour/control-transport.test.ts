/**
 * TC-TRANSPORT-002/003/004 — the unix transport binds 0700/0600, refuses a path
 * outside the state directory, and declared-not-delivered transports are refused.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, statSync } from "node:fs";
import { createUnixTransport } from "../../packages/adapters/src/daemon/unix";
import { createControlServer } from "../../packages/core/src/app/control-server";
import { resolveDaemonSettings } from "../../packages/core/src/config/index";
import {
  CONTROL_PROTOCOL_CURRENT,
  LOCAL_CALLER_PRINCIPAL,
  type ControlFrame,
  type DaemonClockPort,
} from "../../packages/core/src/contracts/index";
import { createTestEdge, makeTempRoot, removeRoot } from "../fixtures/state/harness";

const clock = (): DaemonClockPort => ({
  nowMs: () => 1_000,
  nowIso: () => new Date(1_000).toISOString(),
  sleep: async () => undefined,
});

const handlers = {
  poke: () => ({ ok: true as const, data: { applied: true as const } }),
  status: () => ({
    ok: true as const,
    data: { live: true as const, instance: null, queueDepth: 0, lanes: [] },
  }),
  lane: () => ({ ok: false as const, code: "queue.entry.unobserved" }),
  subscribe: () => ({
    ok: true as const,
    data: { topic: "queue" as const, snapshot: {}, cursor: 0 },
  }),
  drain: () => ({ ok: false as const, code: "daemon.takeover-refused" }),
  stop: () => ({ ok: false as const, code: "daemon.takeover-refused" }),
  takeover: () => ({ ok: false as const, code: "daemon.takeover-refused" }),
};

describe("GH-238 unix transport", () => {
  test("binds a 0700 directory and a 0600 socket and serves frames", async () => {
    const root = makeTempRoot("gh238-unix");
    try {
      const edge = createTestEdge();
      edge.ensureDirectory(root);
      chmodSync(root, 0o700);
      const socketPath = `${root}/daemon.sock`;
      const transport = createUnixTransport({ stateDirectory: root, socketPath });
      const server = createControlServer({ transport, clock: clock(), handlers });
      await server.start();
      try {
        expect(existsSync(socketPath)).toBe(true);
        expect(statSync(socketPath).mode & 0o777).toBe(0o600);
        const client = await transport.connect();
        const frames: ControlFrame[] = [];
        client.onLine((line) => frames.push(JSON.parse(line) as ControlFrame));
        client.write(
          `${JSON.stringify({
            v: CONTROL_PROTOCOL_CURRENT,
            kind: "request",
            type: "status",
            id: "u1",
            payload: {},
            callerPrincipal: LOCAL_CALLER_PRINCIPAL,
          })}\n`,
        );
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(frames[0]).toMatchObject({ kind: "response", id: "u1" });
      } finally {
        server.stop();
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a socket path outside the state directory is refused", () => {
    expect(() =>
      createUnixTransport({ stateDirectory: "/var/lib/ados", socketPath: "/tmp/elsewhere.sock" }),
    ).toThrow();
    const settings = resolveDaemonSettings(
      { daemon: { "socket-path": "/tmp/elsewhere.sock" } },
      {},
      { stateDirectory: "/var/lib/ados" },
    );
    expect(settings.ok).toBe(false);
    if (!settings.ok) expect(settings.error.code).toBe("config.value.invalid");
  });

  test("a non-private state directory is refused with state.permission.denied", async () => {
    const root = makeTempRoot("gh238-unix-perm");
    try {
      chmodSync(root, 0o755);
      const transport = createUnixTransport({
        stateDirectory: root,
        socketPath: `${root}/daemon.sock`,
      });
      const server = createControlServer({ transport, clock: clock(), handlers });
      await expect(server.start()).rejects.toMatchObject({ code: "state.permission.denied" });
    } finally {
      removeRoot(root);
    }
  });

  test("declared-not-delivered transports are refused, not downgraded", () => {
    for (const transport of ["tcp", "tls", "ssh", "container-pipe"]) {
      const resolved = resolveDaemonSettings(
        { daemon: { transport } },
        {},
        { stateDirectory: "/var/lib/ados" },
      );
      expect(resolved.ok).toBe(false);
      if (!resolved.ok) expect(resolved.error.code).toBe("config.value.invalid");
    }
  });
});
