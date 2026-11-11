/**
 * TC-EVT-082 (behaviour half) — a burst above the per-tick cap emits the cap,
 * keeps the remainder pending through the watermark, and loses nothing.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { createEventHarness, dataOf, NOW } from "../fixtures/events/event-harness";

const eventsOf = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

describe("TC-EVT-082 burst handling through the real server", () => {
  test("one hundred changes emit 64 then 36 with contiguous sequences and zero loss", async () => {
    const harness = await createEventHarness({ label: "burst" });
    try {
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await Promise.resolve();
      await harness.step();

      const edges = Array.from({ length: 100 }, (_, index) => `GH-${700 + index}`);
      for (const [index, edge] of edges.entries()) {
        const acquired = harness.store.acquireFence(`burst-${index}`);
        if (!acquired.ok) throw new Error("fence refused");
        harness.store.append(acquired.value.handle, {
          kind: "queue.dependency",
          recordKey: `queue.deps:GH-999:${index}`,
          payload: {
            schema: "delivery.queue.dependency.v1",
            ref: "GH-999",
            edges: edge === undefined ? [] : [edge],
            recordedAt: NOW,
          } as never,
        });
        harness.store.releaseFence(acquired.value.handle);
      }

      await harness.step();
      const first = eventsOf(client.drain());
      expect(first).toHaveLength(64);
      expect(first.map((event) => (event.payload as { added: string[] }).added[0])).toEqual(
        edges.slice(0, 64),
      );

      await harness.step();
      const second = eventsOf(client.drain());
      expect(second).toHaveLength(36);
      expect(second.map((event) => (event.payload as { added: string[] }).added[0])).toEqual(
        edges.slice(64),
      );

      const sequences = [...first, ...second].map((event) => event.sequence as number);
      expect(sequences).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
      expect(new Set(sequences).size).toBe(100);

      await harness.step();
      expect(eventsOf(client.drain())).toHaveLength(0);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
