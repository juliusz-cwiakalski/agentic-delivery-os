/**
 * TC-EVT-026 — blockers emit `published`, `updated`, then `cleared`, once per
 * source record, with the question's lane and its nullable ref throughout.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import {
  answerRecord,
  createEventHarness,
  dataOf,
  laneRecord,
  questionRecord,
} from "../fixtures/events/event-harness";

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

describe("TC-EVT-026 blockers.state mapping", () => {
  test("published, updated (no clear before consumption), then cleared", async () => {
    const harness = await createEventHarness({ label: "blockers" });
    try {
      const client = await harness.connect();
      client.subscribe("blockers.state");
      await Promise.resolve();
      await harness.step();

      harness.appendQuestion(questionRecord("Q-1", "GH-290"));
      await harness.step();
      let frames = eventFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({ kind: "published", lane: "GH-290", ref: null });
      expect(frames[0]?.payload).toEqual({
        id: "Q-1",
        type: "decision-needed",
        audience: "owner",
        question: "Which gate applies?",
        options: ["option-a", "option-b"],
        askedAt: "2026-11-12T10:00:00.000Z",
      });

      harness.appendAnswer(answerRecord("Q-1"));
      await harness.step();
      frames = eventFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({ kind: "updated", lane: "GH-290", ref: null });
      expect(frames[0]?.payload).toMatchObject({
        id: "Q-1",
        answeringAudience: "owner",
        choice: "option-a",
        resumeMode: "boundary-note",
      });

      // A tick before the daemon consumes the answer emits no `cleared`.
      await harness.step();
      expect(eventFrames(client.drain())).toHaveLength(0);

      const lane = laneRecord("GH-290");
      harness.appendLane(lane);
      await harness.step();
      client.drain();
      harness.clearQuestion(lane, "Q-1", "boundary-note");
      await harness.step();
      frames = eventFrames(client.drain()).filter((frame) => frame.topic === "blockers.state");
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({ kind: "cleared", lane: "GH-290", ref: null });
      expect(frames[0]?.payload).toEqual({
        id: "Q-1",
        lane: "GH-290",
        resumeMode: "boundary-note",
        clearedAt: expect.any(String),
      });

      // Every frame's lane is the non-empty question lane and ref is explicit null.
      await harness.step();
      expect(eventFrames(client.drain())).toHaveLength(0);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
