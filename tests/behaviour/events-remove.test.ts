/**
 * TC-QLC-065 (GH-292, AC-F6-1, NFR-5) — exactly-once emission: each durable
 * removal is emitted once, on the first tick observing its record, in its own
 * lane; repeated ticks do not duplicate; the payload keys are exactly the
 * declared `ref`, `reason`, `recordedAt`.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { createEventHarness } from "../fixtures/events/event-harness";

/** Event frames are the control frames whose kind is "event", data-extracted. */
const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames
    .filter((frame) => frame.kind === "event")
    .map((frame) => (frame as { data?: Record<string, unknown> }).data ?? {});

import { projectCaseEvents } from "../fixtures/events/projection-cases";

describe("TC-QLC-065 exactly-once remove emission", () => {
  test("the case view emits the durable removal exactly once with the declared payload", () => {
    const removes = projectCaseEvents().filter((event) => event.kind === "remove");
    expect(removes).toHaveLength(1);
    const remove = removes[0];
    if (remove === undefined) return;
    expect(remove.topic).toBe("queue.graph");
    expect(remove.lane).toBe("GH-700");
    expect(Object.keys(remove.payload).sort()).toEqual(["reason", "recordedAt", "ref"]);
    expect(remove.payload.ref).toBe("GH-700");
    expect(remove.payload.reason).toBe("landed");
  });

  test("a harness removal emits once on the first observing tick and never again", async () => {
    const harness = await createEventHarness({ label: "events-remove" });
    try {
      const client = await harness.connect();
      client.subscribe("queue.graph");
      await harness.step();
      expect(client.drain().filter((frame) => frame.kind === "remove")).toEqual([]);
      const acquired = harness.store.acquireFence("events-remove-fence");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const appended = harness.store.append(acquired.value.handle, {
        kind: "queue.removal",
        recordKey: "queue.removals:GH-800",
        payload: {
          schema: "delivery.queue.removal.v1",
          ref: "GH-800",
          reason: "reconciled",
          recordedAt: "2026-11-12T10:00:06.000Z",
        } as never,
      });
      expect(appended.ok).toBe(true);
      await harness.step();
      const removes = eventFrames(client.drain()).filter((data) => data.kind === "remove");
      expect(removes).toHaveLength(1);
      const data = removes[0] ?? {};
      expect(data.lane).toBe("GH-800");
      expect((data.payload as Record<string, unknown>)?.reason).toBe("reconciled");
      // Repeated ticks with no new records emit nothing further.
      await harness.step();
      expect(eventFrames(client.drain()).filter((frame) => frame.kind === "remove")).toEqual([]);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
