/**
 * TC-EVT-020 — a `queue.graph` subscriber observes `entry` then
 * `dependency-edge` through the real session/server, with the full envelope, a
 * per-lane sequence, and no snapshot frame.
 */
import { describe, expect, test } from "bun:test";
import { readQueueEntries } from "../../packages/core/src/app/index";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { createEventHarness, dataOf, ENVELOPE_KEYS, NOW } from "../fixtures/events/event-harness";

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

describe("TC-EVT-020 queue.graph end to end", () => {
  test("entry then dependency-edge, with the envelope and no snapshot frame", async () => {
    const harness = await createEventHarness({ label: "queue-graph" });
    try {
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await Promise.resolve();

      // The baseline tick over the empty store emits nothing.
      await harness.step();
      expect(eventFrames(client.drain())).toHaveLength(0);

      harness.appendEntry({
        schema: "delivery.queue.entry.v1" as never,
        ref: "GH-999",
        priority: 5,
        recordedAt: NOW,
      } as never);
      await harness.step();
      let frames = eventFrames(client.drain());
      expect(frames).toHaveLength(1);
      const entry = frames[0] as Record<string, unknown>;
      expect(Object.keys(entry)).toEqual([...ENVELOPE_KEYS]);
      expect(entry).toMatchObject({
        topic: "queue.graph",
        kind: "entry",
        lane: "GH-999",
        ref: "GH-999",
        sequence: 1,
        taxonomyVersion: "v1",
      });
      expect(entry).not.toHaveProperty("cursor");
      const entryRecord = readQueueEntries(harness.store);
      expect(entryRecord.ok).toBe(true);
      if (entryRecord.ok) {
        expect(entry.occurredAt).toBe(entryRecord.records[0]?.recordedAt as string);
        expect(entry.payload).toEqual({
          ref: "GH-999",
          priority: 5,
          recordedAt: entryRecord.records[0]?.recordedAt as string,
        });
      }

      const added = harness.store.acquireFence("queue-graph-dep");
      if (!added.ok) throw new Error("fence refused");
      harness.store.append(added.value.handle, {
        kind: "queue.dependency",
        recordKey: "queue.deps:GH-999:1",
        payload: {
          schema: "delivery.queue.dependency.v1",
          ref: "GH-999",
          edges: ["GH-777"],
          recordedAt: "2026-11-12T10:00:05.000Z",
        } as never,
      });
      harness.store.releaseFence(added.value.handle);
      await harness.step();
      frames = eventFrames(client.drain());
      expect(frames).toHaveLength(1);
      const edge = frames[0] as Record<string, unknown>;
      expect(edge).toMatchObject({
        kind: "dependency-edge",
        lane: "GH-999",
        ref: "GH-999",
        sequence: 2,
      });
      expect(edge.payload).toEqual({
        ref: "GH-999",
        edges: ["GH-777"],
        added: ["GH-777"],
        removed: [],
        recordedAt: "2026-11-12T10:00:05.000Z",
      });

      // No third frame and no snapshot frame on this topic.
      await harness.step();
      expect(eventFrames(client.drain())).toHaveLength(0);
      const records = harness.store.readRecords();
      expect(records.ok).toBe(true);
      if (records.ok) {
        const appended = records.value.records.filter(
          (record) => record.kind === "queue.entry" || record.kind === "queue.dependency",
        );
        expect(appended).toHaveLength(2);
      }
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
