/**
 * TC-BOUNDS-001 (frame and buffer half) — the frame-size refusal happens before
 * parsing and the per-subscription buffer never exceeds its bound.
 */
import { describe, expect, test } from "bun:test";
import { decodeControlLine } from "../../packages/core/src/domain/control-codec";
import { createControlSession } from "../../packages/core/src/domain/control-session";
import {
  CONTROL_PROTOCOL_CURRENT,
  DAEMON_MAX_FRAME_BYTES,
  LOCAL_CALLER_PRINCIPAL,
  type DaemonClockPort,
} from "../../packages/core/src/contracts/index";

const clock = (): DaemonClockPort => ({
  nowMs: () => 1_000,
  nowIso: () => new Date(1_000).toISOString(),
  sleep: async () => undefined,
});

describe("GH-238 control bounds", () => {
  test("a frame over the default bound is refused before JSON parsing", () => {
    const oversized = `{"v":1,"kind":"request","type":"poke","id":"${"x".repeat(DAEMON_MAX_FRAME_BYTES)}"}`;
    expect(decodeControlLine(oversized)).toMatchObject({
      ok: false,
      path: "frame-max-bytes",
    });
  });

  test("a subscription never buffers more than its bound", () => {
    const session = createControlSession({
      connectionId: "c1",
      clock: clock(),
      subscriptionBuffer: 3,
      responseTimeoutMs: 1_000,
    });
    session.receive({
      v: CONTROL_PROTOCOL_CURRENT,
      kind: "request",
      type: "status",
      id: "a",
      payload: {},
      callerPrincipal: LOCAL_CALLER_PRINCIPAL,
    });
    const subscription = session.subscribe("lanes");
    expect(subscription.ok).toBe(true);
    let overflows = 0;
    for (let cursor = 0; cursor < 10; cursor += 1) {
      overflows += session
        .publish("lanes", { cursor }, cursor)
        .filter((frame) => frame.type === "degraded").length;
    }
    expect(overflows).toBe(1);
    expect(session.subscriptions()).toHaveLength(0);
  });
});

import { appendDaemonLane, reconcileDaemon } from "../../packages/core/src/app/index";
import { DAEMON_LANE_PAYLOAD_SCHEMA } from "../../packages/core/src/contracts/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

describe("GH-238 reconciliation lane bound", () => {
  // 205 durable lane appends plus reconciliation use real filesystem I/O and can
  // exceed Bun's 5s default under full-suite load on CI hardware.
  test("excess lanes are reported truncated, never silently dropped", () => {
    const root = makeTempRoot("gh238-bounds-recon");
    try {
      const { store } = openStore(makeIdentity(root));
      for (let index = 0; index < 205; index += 1) {
        const appended = appendDaemonLane(store, `seed-${index}`, {
          schema: DAEMON_LANE_PAYLOAD_SCHEMA,
          ref: `GH-${index}`,
          state: "delivering",
          spawnOrdinal: 1,
          recordedAt: "2026-11-08T10:00:00Z",
        });
        expect(appended.ok).toBe(true);
      }
      const result = reconcileDaemon({
        store,
        fenceToken: "recon-bound",
        instanceId: "instance-bound",
        nowIso: "2026-11-08T10:00:00Z",
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: {
          readRestarts: () => ({ ok: true, records: [] }),
          appendRestart: (record) => ({ ok: true, appended: true, record }),
          ensureExhaustion: (record) => ({ ok: true, appended: true, record }),
          raiseQuestion: () => ({ ok: true, questionId: "q" }),
        },
        evidence: () => ({ processObservable: true }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.record.lanes).toHaveLength(200);
        expect(result.record.truncated).toBe(true);
      }
    } finally {
      removeRoot(root);
    }
  }, 20_000);
});
