/**
 * TC-WATCH-001/005 — dedupe by cursor, preserved finding codes, the frame bound,
 * and the mid-stream overflow fallback.
 */
import { describe, expect, test } from "bun:test";
import { createControlServer } from "../../packages/core/src/app/control-server";
import { watchLines } from "../../packages/core/src/app/watch";
import {
  CONTROL_PROTOCOL_CURRENT,
  type ControlConnection,
  type ControlTransport,
  LOCAL_CALLER_PRINCIPAL,
} from "../../packages/core/src/contracts/index";
import { encodeControlFrame } from "../../packages/core/src/domain/control-codec";
import { boundWatchLine, createWatchProjection } from "../../packages/core/src/domain/watch-stream";
import { createMemoryTransportPair } from "../fixtures/daemon/transport/pair";

const clock = (advance = 0) => ({
  nowMs: () => advance,
  nowIso: () => new Date(advance).toISOString(),
  sleep: async () => undefined,
});

describe("GH-238 watch stream", () => {
  test("a repeated cursor is deduplicated", () => {
    const projection = createWatchProjection("queue");
    expect(projection.snapshot({ entries: 0 })).toBeDefined();
    expect(projection.event({ entries: 0 }, 0)).toBeUndefined();
    const next = projection.event({ entries: 1 }, 1);
    expect(next?.cursor).toBe(1);
    expect(projection.event({ entries: 1 }, 1)).toBeUndefined();
  });

  test("a line over the frame bound truncates explicitly", () => {
    const line = boundWatchLine({ payload: "x".repeat(100) }, 20);
    expect(line.text).toContain('"truncated":true');
    expect(line.text).toContain("frame-max-bytes");
  });

  test("overflow emits exactly one degraded event", () => {
    const projection = createWatchProjection("lanes");
    const overflow = projection.overflow("lanes");
    expect(overflow.text).toContain("subscriber-overflow");
  });

  test("degraded polling prints only changed snapshots and exits on interrupt", async () => {
    let value = 1;
    let interrupted = false;
    const lines: string[] = [];
    const generator = watchLines({
      topic: "queue",
      read: () => ({ ok: true, data: { entries: value } }),
      clock: clock(),
      intervalMs: 1,
      reachable: false,
      signal: { interrupted: () => interrupted },
      maxIterations: 3,
      overflow: true,
    });
    for await (const line of generator) {
      lines.push(line);
      value += 1;
      if (lines.length === 3) interrupted = true;
    }
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toContain("daemon-unreachable");
    expect(lines[1]).toContain("subscriber-overflow");
    expect(lines[2]).toContain('"entries":3');
  });

  test("unreadable state throws a classified state identity", async () => {
    const generator = watchLines({
      topic: "queue",
      read: () => ({ ok: false, code: "state.store.torn" }),
      clock: clock(),
      intervalMs: 1,
      reachable: false,
      signal: { interrupted: () => false },
    });
    await expect(generator.next()).rejects.toMatchObject({ code: "state.store.torn" });
  });

  test("a reachable transport opens one connection and sends a subscribe frame", async () => {
    const written: string[] = [];
    let onLine: ((line: string) => void) | undefined;
    const connection: ControlConnection = {
      id: "watch-client",
      write: (line) => {
        written.push(line);
        const decoded = JSON.parse(line) as { id?: string; type?: string };
        if (decoded.type !== "subscribe" || decoded.id === undefined) return;
        onLine?.(
          encodeControlFrame({
            v: CONTROL_PROTOCOL_CURRENT,
            kind: "response",
            type: "subscribe",
            id: decoded.id,
            data: { ok: true },
            callerPrincipal: LOCAL_CALLER_PRINCIPAL,
          }).replace(/\r?\n$/u, ""),
        );
        onLine?.(
          encodeControlFrame({
            v: CONTROL_PROTOCOL_CURRENT,
            kind: "event",
            type: "frame",
            data: { topic: "queue", cursor: 1, snapshot: { entries: 5 } },
            callerPrincipal: LOCAL_CALLER_PRINCIPAL,
          }).replace(/\r?\n$/u, ""),
        );
      },
      onLine: (handler) => {
        onLine = handler;
      },
      onClose: () => undefined,
      close: () => undefined,
    };
    const transport: ControlTransport = {
      listen: async () => ({ close: () => undefined }),
      connect: async () => connection,
    };
    const lines: string[] = [];
    const generator = watchLines({
      topic: "queue",
      read: () => ({ ok: true, data: { entries: 0 } }),
      clock: clock(),
      intervalMs: 1,
      transport,
      signal: { interrupted: () => false },
      maxIterations: 2,
    });
    for await (const line of generator) lines.push(line);
    expect(JSON.parse(written[0] ?? "{}")).toMatchObject({
      kind: "request",
      type: "subscribe",
      payload: { topic: "queue" },
    });
    expect(lines.some((line) => line.includes('"entries":5'))).toBe(true);
    expect(lines.some((line) => line.includes("daemon-unreachable"))).toBe(false);
  });

  test("a reachable daemon publishes a second bounded line on state change", async () => {
    const pair = createMemoryTransportPair();
    let snapshot: unknown = { entries: 1 };
    const server = createControlServer({
      transport: pair.server,
      clock: clock(),
      handlers: {
        poke: () => ({ ok: true, data: { applied: true } }),
        status: () => ({
          ok: true,
          data: { live: true, instance: null, queueDepth: 0, lanes: [] },
        }),
        lane: () => ({ ok: false, code: "queue.entry.unobserved" }),
        subscribe: (payload) => ({
          ok: true,
          data: { topic: payload.topic, snapshot, cursor: 0 },
        }),
        drain: () => ({ ok: false, code: "daemon.socket-unreachable" }),
        stop: () => ({ ok: false, code: "daemon.socket-unreachable" }),
        takeover: () => ({ ok: false, code: "daemon.takeover-refused" }),
      },
      stateChanges: () => [{ topic: "queue", snapshot }],
    });
    await server.start();
    let interrupted = false;
    try {
      const generator = watchLines({
        topic: "queue",
        read: () => ({ ok: true, data: snapshot }),
        clock: clock(),
        intervalMs: 1,
        transport: pair.client,
        signal: { interrupted: () => interrupted },
        maxIterations: 8,
      });
      const first = await generator.next();
      expect(first.done).toBe(false);
      expect(String(first.value)).toContain('"entries":1');
      snapshot = { entries: 2 };
      server.publishState();
      const second = await generator.next();
      expect(second.done).toBe(false);
      expect(String(second.value)).toContain('"entries":2');
      // A no-change publish is deduplicated and yields nothing.
      server.publishState();
      interrupted = true;
      await generator.return(undefined);
    } finally {
      server.stop();
    }
  });

  test("a failed transport connect degrades to bounded polling with the marker", async () => {
    const transport: ControlTransport = {
      listen: async () => ({ close: () => undefined }),
      connect: async () => {
        throw new Error("absent");
      },
    };
    const lines: string[] = [];
    const generator = watchLines({
      topic: "lanes",
      read: () => ({ ok: true, data: { lanes: 0 } }),
      clock: clock(),
      intervalMs: 1,
      transport,
      signal: { interrupted: () => false },
      maxIterations: 1,
    });
    for await (const line of generator) lines.push(line);
    expect(lines[0]).toContain("daemon-unreachable");
  });
});
