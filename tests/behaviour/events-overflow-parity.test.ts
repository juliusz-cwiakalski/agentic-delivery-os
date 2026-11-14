/**
 * TC-EVT-040, TC-EVT-041 (behaviour), TC-EVT-042 (behaviour) — for each of the
 * six topics, overflow yields exactly one stamped degraded frame, drops only
 * that subscription, and spares the rest; the capacity bound is unchanged.
 *
 * The delivered server flushes a subscription after each tick, so a subscriber
 * that keeps reading never accumulates a buffer. Overflow is therefore proven
 * where the delivered bound lives — the session's bounded per-subscription
 * buffer — for all six topics, and once end to end on the wire for a
 * `queue.graph` burst that exceeds the buffer inside one publish tick.
 */
import { describe, expect, test } from "bun:test";
import {
  CONTROL_DEGRADED_REASONS,
  CONTROL_PROTOCOL_CURRENT,
  type ControlEnvelopeEventData,
  type ControlFrame,
  type ControlRequestFrame,
  type ControlTopic,
  LOCAL_CALLER_PRINCIPAL,
  TAXONOMY_OVERFLOW,
} from "../../packages/core/src/contracts/index";
import { createControlSession } from "../../packages/core/src/domain/control-session";
import { createEventHarness, dataOf, NOW } from "../fixtures/events/event-harness";
import {
  DEGRADED_DATA_KEYS,
  OVERFLOW_BUFFER,
  OVERFLOW_TOPICS,
  overflowRow,
} from "../fixtures/events/overflow-cases";

const degradedFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event" && frame.type === "degraded").map(dataOf);

const _frameFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event" && frame.type === "frame").map(dataOf);

const clock = () => ({ nowMs: () => 1_000, nowIso: () => NOW, sleep: async () => undefined });
const request = (id: string): ControlRequestFrame => ({
  v: CONTROL_PROTOCOL_CURRENT,
  kind: "request",
  type: "poke",
  id,
  payload: { cursor: 0 },
  callerPrincipal: LOCAL_CALLER_PRINCIPAL,
});

/** One event-topic frame body, built from the declaration's field order. */
const envelope = (topic: ControlTopic, sequence: number): ControlEnvelopeEventData => ({
  topic,
  kind: "completed",
  lane: "GH-290",
  ref: "GH-290",
  sequence,
  occurredAt: NOW,
  payload: {},
  taxonomyVersion: "v2",
});

/** Publish one frame of the row's topic through the delivered session seam. */
const publishRow = (
  session: ReturnType<typeof createControlSession>,
  topic: ControlTopic,
  sequence: number,
): readonly ControlFrame[] =>
  topic === "queue" || topic === "lanes"
    ? session.publish(topic, { sequence }, sequence)
    : session.publishEvent(topic, envelope(topic, sequence));

describe("TC-EVT-042 the single capacity bound is unchanged", () => {
  test("a third subscription on one connection is refused with daemon.subscriber-degraded and closes nothing", () => {
    const session = createControlSession({
      connectionId: "c1",
      clock: clock(),
      subscriptionBuffer: 2,
      responseTimeoutMs: 1_000,
    });
    session.receive(request("a"));
    const first = session.subscribe("queue");
    const second = session.subscribe("lanes");
    const third = session.subscribe("queue.graph");
    expect(first.ok && second.ok).toBe(true);
    expect(third).toEqual({ ok: false, code: "daemon.subscriber-degraded" });
    expect(session.closed()).toBe(false);
    expect(session.subscriptions().map((entry) => entry.topic)).toEqual(["queue", "lanes"]);
    expect([...CONTROL_DEGRADED_REASONS]).toEqual([
      "subscriber-overflow",
      "daemon-unreachable",
      "daemon-heartbeat-stale",
    ]);
  });
});

describe("TC-EVT-040 overflow parity across the six topics", () => {
  test("two subscriptions of one topic on one connection: only the overflowing one is dropped", () => {
    const session = createControlSession({
      connectionId: "shared-connection",
      clock: clock(),
      subscriptionBuffer: OVERFLOW_BUFFER,
      responseTimeoutMs: 1_000,
    });
    session.receive(request("a"));
    const slow = session.subscribe("queue.graph");
    const sibling = session.subscribe("queue.graph");
    expect(slow.ok && sibling.ok).toBe(true);
    if (!slow.ok || !sibling.ok) throw new Error("subscribe refused");

    const degraded: Record<string, unknown>[] = [];
    const siblingFrames: ControlFrame[] = [];
    for (const sequence of [1, 2, 3]) {
      degraded.push(...degradedFrames(publishRow(session, "queue.graph", sequence)));
      // Only the sibling drains; the other subscription keeps buffering.
      siblingFrames.push(...session.flush(sibling.id));
    }

    expect(degraded).toHaveLength(1);
    expect(degraded[0]).toMatchObject({
      degraded: "subscriber-overflow",
      topic: "queue.graph",
      overflow: TAXONOMY_OVERFLOW,
      taxonomyVersion: "v2",
    });
    // Same connection, same topic: the dropping is per subscription.
    expect(session.subscriptions().map((entry) => entry.id)).toEqual([sibling.id]);
    expect(siblingFrames).toHaveLength(3);
    // The surviving sibling keeps receiving after the overflow.
    expect(publishRow(session, "queue.graph", 4)).toEqual([]);
    expect(session.flush(sibling.id)).toHaveLength(1);
  });

  test("each topic yields one identical stamped row and drops only the non-draining subscription", () => {
    const rows = OVERFLOW_TOPICS.map((topic) => {
      const slow = createControlSession({
        connectionId: `slow-${topic}`,
        clock: clock(),
        subscriptionBuffer: OVERFLOW_BUFFER,
        responseTimeoutMs: 1_000,
      });
      const reading = createControlSession({
        connectionId: `reading-${topic}`,
        clock: clock(),
        subscriptionBuffer: OVERFLOW_BUFFER,
        responseTimeoutMs: 1_000,
      });
      const bystander = createControlSession({
        connectionId: `bystander-${topic}`,
        clock: clock(),
        subscriptionBuffer: OVERFLOW_BUFFER,
        responseTimeoutMs: 1_000,
      });
      slow.receive(request("a"));
      reading.receive(request("a"));
      bystander.receive(request("a"));
      const slowSub = slow.subscribe(topic);
      const readingSub = reading.subscribe(topic);
      const other: ControlTopic = topic === "queue" ? "lanes" : "queue";
      const bystanderSub = bystander.subscribe(other);
      expect(slowSub.ok && readingSub.ok && bystanderSub.ok).toBe(true);
      if (!slowSub.ok || !readingSub.ok || !bystanderSub.ok) throw new Error("subscribe refused");

      const degraded: Record<string, unknown>[] = [];
      const readingFrames: ControlFrame[] = [];
      for (const sequence of [1, 2, 3]) {
        degraded.push(...degradedFrames(publishRow(slow, topic, sequence)));
        publishRow(reading, topic, sequence);
        readingFrames.push(...reading.flush(readingSub.id));
      }
      // The reading subscriber received every frame; the slow one lost all
      // buffered frames with its subscription and got exactly one degraded.
      expect(readingFrames).toHaveLength(3);
      expect(degraded).toHaveLength(1);
      expect(Object.keys(degraded[0] ?? {}).sort()).toEqual([...DEGRADED_DATA_KEYS].sort());
      expect(degraded[0]).toMatchObject({
        degraded: "subscriber-overflow",
        topic,
        overflow: TAXONOMY_OVERFLOW,
        taxonomyVersion: "v2",
      });
      expect(slow.subscriptions().map((entry) => entry.topic)).not.toContain(topic);
      // The bystander's subscription is unaffected and still receives.
      expect(publishRow(bystander, other, 1)).toEqual([]);
      const bystanderFrames = bystander.flush(bystanderSub.id);
      expect(bystanderFrames.length).toBeGreaterThanOrEqual(1);
      expect(overflowRow(topic).degradedKeys).toEqual([...DEGRADED_DATA_KEYS]);
      return { topic, shape: overflowRow(topic).shape, degraded };
    });
    // A parity table: six rows, the same four `data` keys and value on every row.
    expect(rows).toHaveLength(6);
    const keySets = new Set(
      rows.map((row) =>
        Object.keys(row.degraded[0] ?? {})
          .sort()
          .join(","),
      ),
    );
    expect(keySets.size).toBe(1);
    expect(new Set(rows.map((row) => row.shape))).toEqual(new Set(["snapshot", "event"]));
  });

  test("a queue.graph burst inside one publish tick overflows with the stamped frame on the wire", async () => {
    const harness = await createEventHarness({
      label: "overflow-wire",
      subscriptionBuffer: OVERFLOW_BUFFER,
    });
    try {
      await harness.step();
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await Promise.resolve();
      for (const edge of ["GH-701", "GH-702", "GH-703"]) {
        const acquired = harness.store.acquireFence(`wire-${edge}`);
        if (!acquired.ok) throw new Error("fence refused");
        harness.store.append(acquired.value.handle, {
          kind: "queue.dependency",
          recordKey: `queue.deps:GH-999:${edge}`,
          payload: {
            schema: "delivery.queue.dependency.v1",
            ref: "GH-999",
            edges: [edge],
            recordedAt: NOW,
          } as never,
        });
        harness.store.releaseFence(acquired.value.handle);
      }
      await harness.step();
      const frames = client.drain();
      const degraded = degradedFrames(frames);
      expect(degraded).toHaveLength(1);
      expect(degraded[0]).toEqual({
        degraded: "subscriber-overflow",
        topic: "queue.graph",
        overflow: TAXONOMY_OVERFLOW,
        taxonomyVersion: "v2",
      });
      expect(frames.filter((frame) => frame.type === "frame")).toHaveLength(0);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});

describe("TC-EVT-041 one constant, two surfaces", () => {
  test("every degraded frame carries the declaration constant, not a typed literal", () => {
    for (const topic of OVERFLOW_TOPICS) {
      const session = createControlSession({
        connectionId: `constant-${topic}`,
        clock: clock(),
        subscriptionBuffer: 1,
        responseTimeoutMs: 1_000,
      });
      session.receive(request("a"));
      session.subscribe(topic);
      expect(degradedFrames(publishRow(session, topic, 1))).toEqual([]);
      const degraded = degradedFrames(publishRow(session, topic, 2));
      expect(degraded).toHaveLength(1);
      expect(degraded[0]?.overflow).toBe(TAXONOMY_OVERFLOW);
      expect(degraded[0]?.degraded).toBe("subscriber-overflow");
    }
  });
});
