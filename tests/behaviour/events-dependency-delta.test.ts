/**
 * TC-EVT-023 — a dependency delta publishes `added`/`removed`, and an identical
 * folded edge set publishes nothing.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import {
  createEventHarness,
  dataOf,
  type EventHarness,
  NOW,
} from "../fixtures/events/event-harness";

const eventsOf = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

const graphFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  eventsOf(frames).filter((data) => data.topic === "queue.graph");

describe("TC-EVT-023 dependency delta semantics", () => {
  test("added/removed are exact and an identical rewrite publishes nothing", async () => {
    const harness: EventHarness = await createEventHarness({ label: "delta" });
    let ordinal = 0;
    const rawDependency = (edges: readonly string[], recordedAt: string): void => {
      ordinal += 1;
      const acquired = harness.store.acquireFence(`delta-fence-${ordinal}`);
      if (!acquired.ok) throw new Error("fence refused");
      harness.store.append(acquired.value.handle, {
        kind: "queue.dependency",
        recordKey: `queue.deps:GH-999:${ordinal}`,
        payload: {
          schema: "delivery.queue.dependency.v1",
          ref: "GH-999",
          edges,
          recordedAt,
        } as never,
      });
      harness.store.releaseFence(acquired.value.handle);
    };
    try {
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await harness.step();
      expect(client.events()).toHaveLength(0);

      rawDependency(["GH-777"], NOW);
      await harness.step();
      let frames = graphFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({ kind: "dependency-edge", lane: "GH-999" });
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).edges).toEqual(["GH-777"]);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).added).toEqual(["GH-777"]);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).removed).toEqual([]);

      // An identical folded edge set under a new record key and timestamp.
      rawDependency(["GH-777"], "2026-11-12T10:00:05.000Z");
      await harness.step();
      expect(graphFrames(client.drain())).toHaveLength(0);

      rawDependency(["GH-777", "GH-888"], "2026-11-12T10:00:10.000Z");
      await harness.step();
      frames = graphFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).added).toEqual(["GH-888"]);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).removed).toEqual([]);

      rawDependency(["GH-888"], "2026-11-12T10:00:15.000Z");
      await harness.step();
      frames = graphFrames(client.drain());
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).added).toEqual([]);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).removed).toEqual(["GH-777"]);

      rawDependency([], "2026-11-12T10:00:20.000Z");
      await harness.step();
      frames = graphFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]?.kind).toBe("dependency-edge");
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).removed).toEqual(["GH-888"]);

      // Four differing folded sets, four frames; no full history array anywhere.
      expect(
        frames.every((frame) => {
          const payload = frame.payload as Record<string, unknown>;
          return !Object.hasOwn(payload, "history");
        }),
      ).toBe(true);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
