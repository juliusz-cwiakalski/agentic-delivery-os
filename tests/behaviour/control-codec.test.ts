/**
 * TC-WIRE-001/002/005/007 — the transport-free codec: round-trip, version
 * negotiation shape, malformed refusal, and the byte bound checked before parse.
 */
import { describe, expect, test } from "bun:test";
import {
  decodeControlLine,
  encodeControlFrame,
} from "../../packages/core/src/domain/control-codec";
import {
  CONTROL_PROTOCOL_CURRENT,
  LOCAL_CALLER_PRINCIPAL,
  type ControlRequestFrame,
} from "../../packages/core/src/contracts/index";

const request = (overrides: Partial<ControlRequestFrame> = {}): ControlRequestFrame => ({
  v: CONTROL_PROTOCOL_CURRENT,
  kind: "request",
  type: "poke",
  id: "id-1",
  payload: { cursor: 1 },
  callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  ...overrides,
});

describe("GH-238 control codec", () => {
  test("encode/decode round-trips byte-identically for canonical input", () => {
    const line = encodeControlFrame(request());
    expect(line.endsWith("\n")).toBe(true);
    expect(line.split("\n").filter((part) => part.length > 0)).toHaveLength(1);
    const decoded = decodeControlLine(line.slice(0, -1));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(encodeControlFrame(decoded.frame)).toBe(line);
    }
  });

  test("v1 requires callerPrincipal and v0 must omit it", () => {
    const missing = decodeControlLine(
      JSON.stringify({ v: 1, kind: "request", type: "poke", id: "a", payload: {} }),
    );
    expect(missing).toMatchObject({ ok: false, code: "fallback.invocation" });
    const v0With = decodeControlLine(
      JSON.stringify({
        v: 0,
        kind: "request",
        type: "poke",
        id: "a",
        payload: {},
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      }),
    );
    expect(v0With).toMatchObject({ ok: false, code: "fallback.invocation" });
    const v0 = decodeControlLine(
      JSON.stringify({ v: 0, kind: "request", type: "poke", id: "a", payload: {} }),
    );
    expect(v0.ok).toBe(true);
  });

  test("an unsupported version is refused with the declared identity", () => {
    const decoded = decodeControlLine(
      JSON.stringify({
        v: 9,
        kind: "request",
        type: "poke",
        id: "a",
        payload: {},
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      }),
    );
    expect(decoded).toMatchObject({ ok: false, code: "daemon.protocol.unsupported" });
  });

  test("unknown kinds, types, and body shapes are refused", () => {
    for (const frame of [
      {
        v: 1,
        kind: "nope",
        type: "poke",
        id: "a",
        payload: {},
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      },
      {
        v: 1,
        kind: "request",
        type: "nope",
        id: "a",
        payload: {},
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      },
      {
        v: 1,
        kind: "request",
        type: "poke",
        id: "a",
        payload: {},
        data: {},
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      },
      {
        v: 1,
        kind: "event",
        type: "frame",
        data: {},
        id: "a",
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      },
    ]) {
      expect(decodeControlLine(JSON.stringify(frame))).toMatchObject({ ok: false });
    }
  });

  test("the byte bound is checked before JSON parsing", () => {
    const oversized = `${"x".repeat(200)}`;
    const decoded = decodeControlLine(oversized, { maxBytes: 10 });
    expect(decoded).toMatchObject({
      ok: false,
      code: "fallback.invocation",
      path: "frame-max-bytes",
    });
  });
});
