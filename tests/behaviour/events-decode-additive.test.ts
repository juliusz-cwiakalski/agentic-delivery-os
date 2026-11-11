/**
 * TC-EVT-005 and TC-EVT-071 — a v1 peer decodes the event envelope and the
 * stamped degraded frame, tolerates extra `data` fields, and keeps every
 * delivered negative control.
 */
import { describe, expect, test } from "bun:test";
import {
  CONTROL_PROTOCOL_CURRENT,
  CONTROL_PROTOCOL_FLOOR,
  type ControlEventFrame,
  DAEMON_MAX_FRAME_BYTES,
  LOCAL_CALLER_PRINCIPAL,
} from "../../packages/core/src/contracts/index";
import {
  decodeControlLine,
  encodeControlFrame,
} from "../../packages/core/src/domain/control-codec";

const eventFrame = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  v: CONTROL_PROTOCOL_CURRENT,
  kind: "event",
  type: "frame",
  callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  data: {
    topic: "queue.graph",
    kind: "entry",
    lane: "GH-999",
    ref: "GH-999",
    sequence: 1,
    occurredAt: "2026-11-12T00:00:00.000Z",
    payload: { ref: "GH-999", priority: 5, recordedAt: "2026-11-12T00:00:00.000Z" },
    taxonomyVersion: "v1",
    ...overrides,
  },
});

const degradedFrame = (): Record<string, unknown> => ({
  v: CONTROL_PROTOCOL_CURRENT,
  kind: "event",
  type: "degraded",
  callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  data: {
    degraded: "subscriber-overflow",
    topic: "queue.graph",
    overflow: "repoll",
    taxonomyVersion: "v1",
  },
});

const decode = (frame: Record<string, unknown>) =>
  decodeControlLine(encodeControlFrame(frame as never).trimEnd());

const dataOf = (frame: Record<string, unknown>): Record<string, unknown> =>
  decode(frame).ok
    ? ((decode(frame) as { frame: ControlEventFrame }).frame.data as Record<string, unknown>)
    : {};

describe("TC-EVT-071 additive decode", () => {
  test("the eight-field envelope decodes as an event body with no field moved outside data", () => {
    const decoded = decode(eventFrame());
    expect(decoded.ok).toBe(true);
    const data = dataOf(eventFrame());
    expect(Object.keys(data)).toEqual([
      "topic",
      "kind",
      "lane",
      "ref",
      "sequence",
      "occurredAt",
      "payload",
      "taxonomyVersion",
    ]);
    expect(data.taxonomyVersion).toBe("v1");
  });

  test("the stamped degraded frame decodes and keeps both additive fields", () => {
    const decoded = decode(degradedFrame());
    expect(decoded.ok).toBe(true);
    const data = dataOf(degradedFrame());
    expect(data.degraded).toBe("subscriber-overflow");
    expect(data.overflow).toBe("repoll");
    expect(data.taxonomyVersion).toBe("v1");
  });

  test("an unknown data field is tolerated", () => {
    const decoded = decode(eventFrame({ futureField: "x" }));
    expect(decoded.ok).toBe(true);
    expect(dataOf(eventFrame({ futureField: "x" })).futureField).toBe("x");
  });

  test("encode then decode round-trips every additive field", () => {
    const frame = eventFrame();
    const decoded = decode(frame);
    if (!decoded.ok) throw new Error(`decode refused: ${decoded.code}`);
    expect(decodeControlLine(encodeControlFrame(decoded.frame).trimEnd()).ok).toBe(true);
    expect((decoded.frame as ControlEventFrame).data).toEqual(frame.data as never);
  });

  test("the delivered negative controls are still refused with their identities", () => {
    const noBody = eventFrame();
    delete noBody.data;
    expect(decode(noBody)).toEqual({
      ok: false,
      code: "fallback.invocation",
      path: "body",
    });

    const twoBodies = { ...eventFrame(), payload: {} };
    expect(decode(twoBodies).ok).toBe(false);

    const idOnEvent = { ...eventFrame(), id: "event-1" };
    expect(decode(idOnEvent)).toEqual({
      ok: false,
      code: "fallback.invocation",
      path: "event-id",
    });

    const wrongVersion = { ...eventFrame(), v: CONTROL_PROTOCOL_FLOOR + 5 };
    expect(decode(wrongVersion)).toEqual({ ok: false, code: "daemon.protocol.unsupported" });
  });

  test("additive frames stay inside the frame bound and carry no truncation marker", () => {
    const line = encodeControlFrame(eventFrame() as never).trimEnd();
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(DAEMON_MAX_FRAME_BYTES);
    const data = dataOf(eventFrame());
    expect(data).not.toHaveProperty("truncated");
    expect(data).not.toHaveProperty("truncationReason");
    const payload = data.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("truncated");
    expect(payload).not.toHaveProperty("truncationReason");
  });
});
