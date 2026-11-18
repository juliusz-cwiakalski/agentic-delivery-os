/**
 * TC-WIRE-001/003 / TC-TRANSPORT-001 — the conformance proof: identical frames
 * over stdio and the in-memory pair behave identically and transport-agnostically.
 */
import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { createStdioTransport } from "../../packages/adapters/src/daemon/stdio";
import { createControlServer } from "../../packages/core/src/app/control-server";
import {
  CONTROL_PROTOCOL_CURRENT,
  LOCAL_CALLER_PRINCIPAL,
  type ControlConnection,
  type ControlFrame,
  type ControlRequestFrame,
  type ControlTransport,
  type DaemonClockPort,
} from "../../packages/core/src/contracts/index";
import { createMemoryTransportPair } from "../fixtures/daemon/transport/pair";

const clock = (): DaemonClockPort => ({
  nowMs: () => 1_000,
  nowIso: () => new Date(1_000).toISOString(),
  sleep: async () => undefined,
});

const handlers = {
  poke: () => ({ ok: true as const, data: { applied: true as const } }),
  status: () => ({
    ok: true as const,
    data: { live: true as const, instance: null, queueDepth: 2, lanes: [] },
  }),
  lane: () => ({ ok: false as const, code: "queue.entry.unobserved" }),
  subscribe: () => ({
    ok: true as const,
    data: { topic: "queue" as const, snapshot: { entries: 2 }, cursor: 3 },
  }),
  drain: () => ({ ok: false as const, code: "daemon.takeover-refused" }),
  stop: () => ({ ok: false as const, code: "daemon.takeover-refused" }),
  takeover: () => ({ ok: false as const, code: "daemon.takeover-refused" }),
};

const frames: ControlRequestFrame[] = [
  {
    v: CONTROL_PROTOCOL_CURRENT,
    kind: "request",
    type: "poke",
    id: "a",
    payload: { cursor: 1 },
    callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  },
  {
    v: CONTROL_PROTOCOL_CURRENT,
    kind: "request",
    type: "status",
    id: "b",
    payload: {},
    callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  },
  {
    v: CONTROL_PROTOCOL_CURRENT,
    kind: "request",
    type: "lane",
    id: "c",
    payload: { ref: "GH-238" },
    callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  },
  {
    v: CONTROL_PROTOCOL_CURRENT,
    kind: "request",
    type: "subscribe",
    id: "d",
    payload: { topic: "queue" },
    callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  },
  {
    v: CONTROL_PROTOCOL_CURRENT,
    kind: "request",
    type: "drain",
    id: "e",
    payload: { lockToken: "token" },
    callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  },
];

const drive = async (
  transport: ControlTransport,
  connect: () => Promise<ControlConnection>,
): Promise<ControlFrame[]> => {
  const server = createControlServer({ transport, clock: clock(), handlers });
  await server.start();
  try {
    const connection = await connect();
    const collected: ControlFrame[] = [];
    connection.onLine((line) => collected.push(JSON.parse(line) as ControlFrame));
    for (const frame of frames) connection.write(`${JSON.stringify(frame)}\n`);
    // Subscribe publishes its initial snapshot on the same line path.
    await new Promise((resolve) => setTimeout(resolve, 10));
    return collected;
  } finally {
    server.stop();
  }
};

const shape = (framesList: readonly ControlFrame[]): unknown =>
  framesList.map((frame) => ({
    kind: frame.kind,
    type: frame.type,
    ...(frame.id === undefined ? {} : { id: frame.id }),
    ...(frame.kind === "response" ? { data: frame.data } : {}),
    ...(frame.kind === "error" ? { code: frame.error.code } : {}),
    ...(frame.kind === "event" ? { data: frame.data } : {}),
  }));

const stdJsonIds = (list: readonly ControlFrame[]): string[] =>
  list.map((frame) => frame.id).filter((id): id is string => id !== undefined);

describe("GH-238 control conformance", () => {
  test("stdio and in-memory bindings produce identical behaviour", async () => {
    const memory = createMemoryTransportPair();
    const memoryFrames = await drive(memory.server, () => memory.connectClient());

    const clientToServer = new PassThrough();
    const serverToClient = new PassThrough();
    const serverStdio = createStdioTransport({
      input: clientToServer,
      output: serverToClient,
      connectionId: "stdio-server",
    });
    const clientStdio = createStdioTransport({
      input: serverToClient,
      output: clientToServer,
      connectionId: "stdio-client",
    });
    const stdioFrames = await drive(serverStdio, () => clientStdio.connect());

    expect(shape(stdioFrames)).toEqual(shape(memoryFrames));
    expect(stdJsonIds(stdioFrames)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
