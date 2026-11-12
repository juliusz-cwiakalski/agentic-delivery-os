/**
 * TC-EVT-025 — `began` is derived once from the first completion, then
 * `completed` alone, and `reopened` carries its reason.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { readChangeTransitions } from "../../packages/core/src/state/registry";
import { createEventHarness, dataOf } from "../fixtures/events/event-harness";

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

describe("TC-EVT-025 phase.state derivation", () => {
  test("began then completed, then completed alone, then reopened with its reason", async () => {
    const harness = await createEventHarness({ label: "phase" });
    try {
      const client = await harness.connect();
      client.subscribe("phase.state");
      await Promise.resolve();
      await harness.step();

      harness.appendPhase({
        phaseId: "specification",
        operation: "complete",
        timestamp: "2026-11-12T10:00:01.000Z",
      });
      await harness.step();
      let frames = eventFrames(client.drain());
      expect(frames.map((frame) => frame.kind)).toEqual(["began", "completed"]);
      expect(frames.every((frame) => frame.lane === "GH-290")).toBe(true);
      const sequences = frames.map((frame) => frame.sequence as number);
      expect(sequences[1]).toBe((sequences[0] as number) + 1);
      expect(frames[0]?.payload).toEqual({
        changeRef: "GH-290",
        phaseId: "specification",
        timestamp: "2026-11-12T10:00:01.000Z",
      });
      expect(frames[1]?.payload).toMatchObject({
        changeRef: "GH-290",
        phaseId: "specification",
        timestamp: "2026-11-12T10:00:01.000Z",
      });

      // No begin record was appended: the history holds exactly one transition.
      const read = readChangeTransitions(harness.store, "GH-290");
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.transitions).toHaveLength(1);

      harness.appendPhase({
        phaseId: "specification",
        operation: "complete",
        timestamp: "2026-11-12T10:00:02.000Z",
      });
      await harness.step();
      frames = eventFrames(client.drain());
      expect(frames.map((frame) => frame.kind)).toEqual(["completed"]);

      harness.appendPhase({
        phaseId: "delivery",
        operation: "reopen",
        timestamp: "2026-11-12T10:00:03.000Z",
        reason: "review-feedback",
      });
      await harness.step();
      frames = eventFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]?.kind).toBe("reopened");
      expect((frames[0]?.payload as { reason?: string } | undefined)?.reason).toBe(
        "review-feedback",
      );

      // A re-observation emits nothing: `began` appeared exactly once.
      await harness.step();
      expect(eventFrames(client.drain())).toHaveLength(0);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
