/**
 * TC-EVT-032 — a second daemon incarnation over the same store restarts the
 * per-lane counter, replays nothing, and the declaration documents the
 * discontinuity and the repoll remedy.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { createEventHarness, dataOf, NOW } from "../fixtures/events/event-harness";

const eventsOf = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

const rawDependency = (
  harness: Awaited<ReturnType<typeof createEventHarness>>,
  edges: readonly string[],
  suffix: string,
): void => {
  const acquired = harness.store.acquireFence(`restart-${suffix}`);
  if (!acquired.ok) throw new Error("fence refused");
  harness.store.append(acquired.value.handle, {
    kind: "queue.dependency",
    recordKey: `queue.deps:GH-999:${suffix}`,
    payload: {
      schema: "delivery.queue.dependency.v1",
      ref: "GH-999",
      edges,
      recordedAt: NOW,
    } as never,
  });
  harness.store.releaseFence(acquired.value.handle);
};

describe("TC-EVT-032 the restart discontinuity", () => {
  test("a fresh incarnation replays nothing and restarts the lane counter at one", async () => {
    const first = await createEventHarness({ label: "restart-a" });
    let root: string | undefined;
    try {
      const client = await first.connect();
      client.subscribe("queue.graph");
      await Promise.resolve();
      await first.step();
      for (const edge of ["GH-701", "GH-702", "GH-703"]) {
        rawDependency(first, [edge], edge);
      }
      await first.step();
      const observed = eventsOf(client.drain());
      expect(observed.map((event) => event.sequence)).toEqual([1, 2, 3]);
      const lastSequence = observed[observed.length - 1]?.sequence as number;

      root = first.root;
      await first.stop();

      // Incarnation B over the same store: a fresh projector, a populated store.
      const second = await createEventHarness({ label: "restart-b", root });
      try {
        const continuation = await second.connect();
        continuation.subscribe("queue.graph");
        await Promise.resolve();
        await second.step();
        expect(eventsOf(continuation.drain())).toHaveLength(0);

        rawDependency(second, ["GH-704"], "b1");
        await second.step();
        const replayed = eventsOf(continuation.drain());
        expect(replayed).toHaveLength(1);
        expect(replayed[0]?.sequence).toBe(1);
        expect(replayed[0]?.sequence as number).toBeLessThanOrEqual(lastSequence);
      } finally {
        await second.stop();
      }
    } finally {
      if (root !== undefined) first.close();
    }
  });

  test("the reference page documents the restart discontinuity and the repoll remedy", async () => {
    const { createSurfaceHarness } = await import("../fixtures/events/surface-harness");
    const run = await createSurfaceHarness().run(["events", "describe", "queue.graph"]);
    expect(run.stdout).toContain("restart");
    expect(run.stdout).toContain("repoll");
    const json = await createSurfaceHarness().run(["events", "describe", "queue.graph", "--json"]);
    expect(json.data?.topics[0]?.ordering).toBe("sequence-per-lane");
    expect(run.stdout).not.toContain("snapshot-revision");
  });
});
