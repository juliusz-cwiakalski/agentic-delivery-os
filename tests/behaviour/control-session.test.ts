/**
 * TC-WIRE-002/003/004/008 — session negotiation, correlation, bounded
 * subscriptions, overflow degradation, and injected-clock timeouts.
 */
import { describe, expect, test } from "bun:test";
import { createControlSession } from "../../packages/core/src/domain/control-session";
import {
  CONTROL_PROTOCOL_CURRENT,
  LOCAL_CALLER_PRINCIPAL,
  type ControlRequestFrame,
  type DaemonClockPort,
} from "../../packages/core/src/contracts/index";

const clock = (start = 1_000): DaemonClockPort & { advance: (ms: number) => void } => {
  let now = start;
  return {
    nowMs: () => now,
    nowIso: () => new Date(now).toISOString(),
    sleep: async () => undefined,
    advance: (ms) => {
      now += ms;
    },
  };
};

const request = (
  id: string,
  overrides: Partial<ControlRequestFrame> = {},
): ControlRequestFrame => ({
  v: CONTROL_PROTOCOL_CURRENT,
  kind: "request",
  type: "status",
  id,
  payload: {},
  callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  ...overrides,
});

describe("GH-238 control session", () => {
  test("version 1 is served and version 2 is refused with the offered set", () => {
    const session = createControlSession({
      connectionId: "c1",
      clock: clock(),
      subscriptionBuffer: 4,
      responseTimeoutMs: 1_000,
    });
    const accepted = session.receive(request("a"));
    expect(accepted.ok).toBe(true);
    const refused = session.receive(
      request("b", { v: 2 as never, callerPrincipal: LOCAL_CALLER_PRINCIPAL }),
    );
    expect(refused.ok).toBe(false);
    expect(session.closed()).toBe(true);
    const error = refused.replies[0];
    expect(error?.kind).toBe("error");
    if (error?.kind === "error") {
      expect(error.error.code).toBe("daemon.protocol.unsupported");
      expect(error.error.summary).toContain("[1,0]");
    }
  });

  test("correlation ids stay on their own connection", () => {
    const first = createControlSession({
      connectionId: "c1",
      clock: clock(),
      subscriptionBuffer: 4,
      responseTimeoutMs: 1_000,
    });
    const second = createControlSession({
      connectionId: "c2",
      clock: clock(),
      subscriptionBuffer: 4,
      responseTimeoutMs: 1_000,
    });
    const a = first.receive(request("same-id"));
    const b = second.receive(request("same-id"));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok || a.request === undefined || b.request === undefined) return;
    const response = first.respond(a.request, {
      live: true,
      instance: null,
      queueDepth: 0,
      lanes: [],
    });
    expect(response.id).toBe("same-id");
    expect(first.pending()).toBe(0);
    expect(second.pending()).toBe(1);
  });

  test("a bounded timeout degrades instead of blocking", () => {
    const timer = clock();
    const session = createControlSession({
      connectionId: "c1",
      clock: timer,
      subscriptionBuffer: 4,
      responseTimeoutMs: 1_000,
    });
    const received = session.receive(request("slow"));
    expect(received.ok).toBe(true);
    expect(session.expire()).toEqual([]);
    timer.advance(1_000);
    const expired = session.expire();
    expect(expired).toHaveLength(1);
    expect(expired[0]?.id).toBe("slow");
    expect(session.pending()).toBe(0);
  });

  test("a full subscription emits exactly one overflow event and drops only itself", () => {
    const session = createControlSession({
      connectionId: "c1",
      clock: clock(),
      subscriptionBuffer: 2,
      responseTimeoutMs: 1_000,
    });
    session.receive(request("a"));
    const slow = session.subscribe("lanes");
    const other = session.subscribe("queue");
    expect(slow.ok && other.ok).toBe(true);
    if (!slow.ok || !other.ok) return;
    expect(session.publish("lanes", { lanes: [] }, 1)).toEqual([]);
    expect(session.publish("lanes", { lanes: [] }, 2)).toEqual([]);
    const overflow = session.publish("lanes", { lanes: [] }, 3);
    expect(overflow).toHaveLength(1);
    expect(overflow[0]?.kind).toBe("event");
    if (overflow[0]?.kind === "event") {
      expect(overflow[0].type).toBe("degraded");
      expect(overflow[0].data).toMatchObject({ degraded: "subscriber-overflow" });
    }
    expect(session.subscriptions().map((entry) => entry.topic)).toEqual(["queue"]);
    expect(session.publish("queue", { entries: 0 }, 4)).toEqual([]);
  });

  test("100 slow subscribers keep the dispatcher loop bounded", () => {
    const sessions = Array.from({ length: 100 }, (_, index) =>
      createControlSession({
        connectionId: `c${index}`,
        clock: clock(),
        subscriptionBuffer: 1,
        responseTimeoutMs: 1_000,
      }),
    );
    for (const session of sessions) {
      session.receive(request("a"));
      session.subscribe("lanes");
    }
    const started = performance.now();
    let degraded = 0;
    for (const session of sessions) {
      session.publish("lanes", {}, 1);
      const overflow = session.publish("lanes", {}, 2);
      degraded += overflow.filter((frame) => frame.type === "degraded").length;
    }
    const elapsed = performance.now() - started;
    expect(degraded).toBe(100);
    expect(elapsed).toBeLessThan(1_000);
  });
});
