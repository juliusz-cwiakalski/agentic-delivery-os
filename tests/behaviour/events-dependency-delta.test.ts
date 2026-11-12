/**
 * TC-EVT-023 and TC-EVT-087 — a dependency delta publishes `added`/`removed`
 * against the previous record in the view, and an identical folded edge set
 * publishes nothing.
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

/** Append one raw `queue.dependency` record, returning its record key. */
const rawDependency = (
  harness: EventHarness,
  edges: readonly string[],
  recordedAt: string,
  key = `queue.deps:GH-999:${recordedAt}`,
): void => {
  const acquired = harness.store.acquireFence(`delta-fence-${key}`);
  if (!acquired.ok) throw new Error("fence refused");
  harness.store.append(acquired.value.handle, {
    kind: "queue.dependency",
    recordKey: key,
    payload: {
      schema: "delivery.queue.dependency.v1",
      ref: "GH-999",
      edges,
      recordedAt,
    } as never,
  });
  harness.store.releaseFence(acquired.value.handle);
};

describe("TC-EVT-023 dependency delta semantics", () => {
  test("added/removed are exact and an identical rewrite publishes nothing", async () => {
    const harness: EventHarness = await createEventHarness({ label: "delta" });
    try {
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await harness.step();
      expect(client.events()).toHaveLength(0);

      rawDependency(harness, ["GH-777"], NOW);
      await harness.step();
      let frames = graphFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({ kind: "dependency-edge", lane: "GH-999" });
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).edges).toEqual(["GH-777"]);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).added).toEqual(["GH-777"]);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).removed).toEqual([]);

      // An identical folded edge set under a new record key and timestamp.
      rawDependency(harness, ["GH-777"], "2026-11-12T10:00:05.000Z");
      await harness.step();
      expect(graphFrames(client.drain())).toHaveLength(0);

      rawDependency(harness, ["GH-777", "GH-888"], "2026-11-12T10:00:10.000Z");
      await harness.step();
      frames = graphFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).added).toEqual(["GH-888"]);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).removed).toEqual([]);

      rawDependency(harness, ["GH-888"], "2026-11-12T10:00:15.000Z");
      await harness.step();
      frames = graphFrames(client.drain());
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).added).toEqual([]);
      expect(((frames[0]?.payload ?? {}) as Record<string, unknown>).removed).toEqual(["GH-777"]);

      rawDependency(harness, [], "2026-11-12T10:00:20.000Z");
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

describe("TC-EVT-087 same-tick dependency deltas", () => {
  test("two records for one ref in one view diff against each other, not tick-start", async () => {
    const harness = await createEventHarness({ label: "delta-same-tick" });
    try {
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await harness.step();
      expect(client.events()).toHaveLength(0);

      // Both records land before a single publish tick observes the view.
      rawDependency(harness, ["GH-1"], NOW, "queue.deps:GH-999:one");
      rawDependency(harness, ["GH-2"], "2026-11-12T10:00:01.000Z", "queue.deps:GH-999:two");
      await harness.step();

      const frames = graphFrames(client.drain());
      expect(frames.map((frame) => frame.kind)).toEqual(["dependency-edge", "dependency-edge"]);
      const payloads = frames.map((frame) => frame.payload as Record<string, unknown>);
      expect(payloads[0]?.added).toEqual(["GH-1"]);
      expect(payloads[0]?.removed).toEqual([]);
      // The second record is the delta from the FIRST record in this view.
      expect(payloads[1]?.edges).toEqual(["GH-2"]);
      expect(payloads[1]?.added).toEqual(["GH-2"]);
      expect(payloads[1]?.removed).toEqual(["GH-1"]);

      // An idempotent re-write inside one view publishes nothing further and
      // leaves the folded set at the last observed record.
      rawDependency(harness, ["GH-2"], "2026-11-12T10:00:02.000Z", "queue.deps:GH-999:three");
      rawDependency(harness, ["GH-3"], "2026-11-12T10:00:03.000Z", "queue.deps:GH-999:four");
      await harness.step();
      const after = graphFrames(client.drain());
      expect(after.map((frame) => frame.kind)).toEqual(["dependency-edge"]);
      const tail = after[0]?.payload as Record<string, unknown> | undefined;
      expect(tail?.added).toEqual(["GH-3"]);
      expect(tail?.removed).toEqual(["GH-2"]);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
