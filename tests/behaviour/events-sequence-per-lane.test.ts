/**
 * TC-EVT-030 and the behaviour half of TC-EVT-031 — two subscribers of one topic
 * agree on every sequence, a lane's series has no gaps, lanes and topics are
 * independent, and no order is inferred from `occurredAt` or a cursor.
 */
import { describe, expect, test } from "bun:test";
import { declareQueueEntry } from "../../packages/core/src/app/index";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { createEventHarness, dataOf, NOW } from "../fixtures/events/event-harness";

const eventsOf = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

const rawDependency = (
  harness: Awaited<ReturnType<typeof createEventHarness>>,
  ref: string,
  edges: readonly string[],
  suffix: string,
  recordedAt = NOW,
): void => {
  const acquired = harness.store.acquireFence(`seq-${suffix}`);
  if (!acquired.ok) throw new Error("fence refused");
  harness.store.append(acquired.value.handle, {
    kind: "queue.dependency",
    recordKey: `queue.deps:${ref}:${suffix}`,
    payload: { schema: "delivery.queue.dependency.v1", ref, edges, recordedAt } as never,
  });
  harness.store.releaseFence(acquired.value.handle);
};

describe("TC-EVT-030 one shared per-lane sequence", () => {
  test("two subscribers agree exactly and a lane's series has no gap", async () => {
    const harness = await createEventHarness({ label: "sequence" });
    try {
      const first = await harness.connect();
      const second = await harness.connect();
      first.subscribe("queue.graph");
      second.subscribe("queue.graph");
      await Promise.resolve();
      await harness.step();

      for (const edge of ["GH-701", "GH-702", "GH-703"]) {
        rawDependency(harness, "GH-999", [edge], edge);
      }
      declareQueueEntry(harness.store, {
        ref: "GH-888",
        priority: 10,
        recordedAt: NOW,
        fenceToken: "seq-entry-1",
      });
      declareQueueEntry(harness.store, {
        ref: "GH-889",
        priority: 10,
        recordedAt: NOW,
        fenceToken: "seq-entry-2",
      });
      await harness.step();

      const left = eventsOf(first.drain());
      const right = eventsOf(second.drain());
      expect(left).toHaveLength(5);
      expect(right).toHaveLength(5);
      for (let index = 0; index < left.length; index += 1) {
        const a = left[index] as Record<string, unknown>;
        const b = right[index] as Record<string, unknown>;
        expect(b.sequence).toBe(a.sequence as number);
        expect(b.kind).toBe(a.kind as string);
        expect(b.lane).toBe(a.lane as string);
        expect(b.ref).toBe(a.ref as string);
        expect(b.occurredAt).toBe(a.occurredAt as string);
      }
      const series = (lane: string): number[] =>
        left.filter((event) => event.lane === lane).map((event) => event.sequence as number);
      expect(series("GH-999")).toEqual([1, 2, 3]);
      expect(series("GH-888")).toEqual([1]);
      expect(series("GH-889")).toEqual([1]);
      const distinct = new Set(
        left.map((event) => `${String(event.lane)}:${String(event.sequence)}`),
      );
      expect(distinct.size).toBe(left.length);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});

describe("TC-EVT-031 ordering scope", () => {
  test("lanes and topics are independent and occurredAt is not an ordering signal", async () => {
    const harness = await createEventHarness({ label: "ordering" });
    try {
      const graph = await harness.connect();
      const attempts = await harness.connect();
      graph.subscribe("queue.graph");
      attempts.subscribe("dispatch.attempt");
      await Promise.resolve();
      await harness.step();

      rawDependency(harness, "GH-999", ["GH-701"], "a");
      rawDependency(harness, "GH-999", ["GH-702"], "b");
      rawDependency(harness, "GH-999", ["GH-703"], "c");
      rawDependency(harness, "GH-888", ["GH-704"], "d");
      await harness.step();
      harness.appendLane({
        schema: "delivery.daemon.lane.v1" as never,
        ref: "GH-999",
        state: "delivering",
        sessionId: "session-1",
        spawnOrdinal: 1,
        recordedAt: NOW,
      } as never);
      await harness.step();

      const graphEvents = eventsOf(graph.drain());
      const attemptEvents = eventsOf(attempts.drain());
      expect(
        graphEvents.filter((event) => event.lane === "GH-999").map((event) => event.sequence),
      ).toEqual([1, 2, 3]);
      expect(
        graphEvents.filter((event) => event.lane === "GH-888").map((event) => event.sequence),
      ).toEqual([1]);
      // The same ref on another topic starts its own counter at one.
      expect(attemptEvents.map((event) => event.sequence)).toEqual([1]);

      // A later observation whose source timestamp descends still ascends by sequence.
      declareQueueEntry(harness.store, {
        ref: "GH-888",
        priority: 20,
        recordedAt: "2026-11-12T09:00:00.000Z",
        fenceToken: "ordering-late",
      });
      await harness.step();
      const descending = eventsOf(graph.drain()).filter((event) => event.lane === "GH-888");
      expect(descending).toHaveLength(1);
      const priorEvent = graphEvents.find((event) => event.lane === "GH-888");
      expect(descending[0]?.sequence).toBe((priorEvent?.sequence as number) + 1);
      expect(String(descending[0]?.occurredAt) < String(priorEvent?.occurredAt)).toBe(true);

      // No event frame carries a cursor.
      for (const event of [...graphEvents, ...attemptEvents, ...descending]) {
        expect(event).not.toHaveProperty("cursor");
      }
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("a re-observation of the same records emits nothing (no cursor-derived order)", async () => {
    const harness = await createEventHarness({ label: "ordering-stable" });
    try {
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await Promise.resolve();
      await harness.step();
      rawDependency(harness, "GH-999", ["GH-701"], "stable");
      await harness.step();
      expect(eventsOf(client.drain())).toHaveLength(1);
      await harness.step();
      expect(eventsOf(client.drain())).toHaveLength(0);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
