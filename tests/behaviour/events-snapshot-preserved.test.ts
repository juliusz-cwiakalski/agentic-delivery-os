/**
 * TC-EVT-050 — the two delivered snapshot topics stay byte-stable: three `data`
 * keys, cursor-0 baseline, change-only advancement, no envelope field, and the
 * additive overflow stamp as the only delta on a degraded frame.
 */
import { describe, expect, test } from "bun:test";
import { prioritizeQueueEntry } from "../../packages/core/src/app/index";
import {
  CONTROL_PROTOCOL_CURRENT,
  type ControlFrame,
  type ControlRequestFrame,
  LOCAL_CALLER_PRINCIPAL,
  TAXONOMY_OVERFLOW,
} from "../../packages/core/src/contracts/index";
import { createControlSession } from "../../packages/core/src/domain/control-session";
import { createEventHarness, dataOf, NOW } from "../fixtures/events/event-harness";

const SNAPSHOT_KEYS = ["topic", "cursor", "snapshot"];
const ENVELOPE_FIELDS = [
  "kind",
  "lane",
  "ref",
  "sequence",
  "occurredAt",
  "payload",
  "taxonomyVersion",
];

const framesOf = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

describe("TC-EVT-050 snapshot topics are byte-stable", () => {
  test("queue and lanes keep exactly three keys, baseline at cursor 0, and change-only publishing", async () => {
    const harness = await createEventHarness({ label: "snapshot" });
    try {
      for (const topic of ["queue", "lanes"] as const) {
        const client = await harness.connect();
        client.subscribe(topic);
        await Promise.resolve();
        const baseline = framesOf(client.drain());
        expect(baseline).toHaveLength(1);
        expect(Object.keys(baseline[0] ?? {})).toEqual(SNAPSHOT_KEYS);
        expect(baseline[0]).toMatchObject({ topic, cursor: 0 });
        for (const field of ENVELOPE_FIELDS) expect(baseline[0]).not.toHaveProperty(field);

        // An unchanged tick publishes nothing (delivered dedupe).
        await harness.step();
        expect(framesOf(client.drain())).toHaveLength(0);
      }

      const queue = await harness.connect();
      queue.subscribe("queue");
      await Promise.resolve();
      queue.drain();
      const declared = harness.store;
      const changed = prioritizeQueueEntry(declared, {
        ref: "GH-290",
        priority: 7,
        recordedAt: NOW,
        fenceToken: "snapshot-priority",
      });
      // No entry exists yet, so declare one first and then change it.
      expect(changed.ok).toBe(false);
      harness.appendEntry({
        schema: "delivery.queue.entry.v1" as never,
        ref: "GH-290",
        priority: 50,
        recordedAt: NOW,
      } as never);
      await harness.step();
      const first = framesOf(queue.drain());
      expect(first).toHaveLength(1);
      expect(Object.keys(first[0] ?? {})).toEqual(SNAPSHOT_KEYS);
      expect(first[0]?.cursor).toBe(1);
      expect(((first[0]?.snapshot ?? {}) as { entries?: unknown[] }).entries).toHaveLength(1);

      prioritizeQueueEntry(declared, {
        ref: "GH-290",
        priority: 7,
        recordedAt: NOW,
        fenceToken: "snapshot-priority-2",
      });
      await harness.step();
      const second = framesOf(queue.drain());
      expect(Object.keys(second[0] ?? {})).toEqual(SNAPSHOT_KEYS);
      expect(second[0]?.cursor).toBe(2);
      expect(
        ((second[0]?.snapshot ?? {}) as { entries?: { priority?: number }[] }).entries?.[0]
          ?.priority,
      ).toBe(7);
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("a snapshot subscription's degraded frame carries only the two additive stamps", () => {
    const session = createControlSession({
      connectionId: "snapshot-overflow",
      clock: { nowMs: () => 1_000, nowIso: () => NOW, sleep: async () => undefined },
      subscriptionBuffer: 1,
      responseTimeoutMs: 1_000,
    });
    const request: ControlRequestFrame = {
      v: CONTROL_PROTOCOL_CURRENT,
      kind: "request",
      type: "poke",
      id: "a",
      payload: { cursor: 0 },
      callerPrincipal: LOCAL_CALLER_PRINCIPAL,
    };
    session.receive(request);
    session.subscribe("queue");
    expect(session.publish("queue", { entries: [] }, 1)).toEqual([]);
    const degraded = session.publish("queue", { entries: [] }, 2);
    expect(degraded).toHaveLength(1);
    const data = dataOf(degraded[0] as ControlFrame);
    expect(Object.keys(data).sort()).toEqual(
      ["degraded", "overflow", "taxonomyVersion", "topic"].sort(),
    );
    expect(data).toEqual({
      degraded: "subscriber-overflow",
      topic: "queue",
      overflow: TAXONOMY_OVERFLOW,
      taxonomyVersion: "v2",
    });
  });
});
