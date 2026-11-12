/**
 * TC-EVT-024 — dispatch emits `started`, `refused` for a refusal, and
 * `completed` for every other outcome with the outcome named.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame, DispatchAttemptRecord } from "../../packages/core/src/contracts/index";
import {
  attemptRecord,
  createEventHarness,
  dataOf,
  laneRecord,
  NOW,
} from "../fixtures/events/event-harness";

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

describe("TC-EVT-024 dispatch.attempt mapping", () => {
  test("started, refused, then completed for every other outcome, once per record", async () => {
    const harness = await createEventHarness({ label: "dispatch" });
    try {
      const client = await harness.connect();
      client.subscribe("dispatch.attempt");
      await Promise.resolve();
      await harness.step();

      harness.appendLane(laneRecord("GH-999"));
      await harness.step();
      let frames = eventFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]).toMatchObject({ kind: "started", lane: "GH-999", ref: "GH-999" });
      expect(frames[0]?.payload).toMatchObject({
        ref: "GH-999",
        spawnOrdinal: 1,
        sessionId: "session-GH-999",
        harnessKind: "opencode",
        recordedAt: NOW,
      });

      harness.appendAttempt(attemptRecord("GH-999", "refused"));
      await harness.step();
      frames = eventFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]?.kind).toBe("refused");
      expect(frames[0]?.payload).toMatchObject({
        attemptId: "ATT-GH-999-refused",
        ref: "GH-999",
        repository: "github.com/example/repo",
        harness: "opencode",
        evidenceClass: "pilot",
        token: "finished",
        startedAt: NOW,
        finishedAt: NOW,
        evidenceRefs: ["evidence-1"],
      });

      harness.appendAttempt(attemptRecord("GH-999", "completed"));
      await harness.step();
      frames = eventFrames(client.drain());
      expect(frames).toHaveLength(1);
      expect(frames[0]?.kind).toBe("completed");
      expect(frames[0]?.payload).toMatchObject({
        outcome: "completed",
        handoverState: "dual-run",
        comparisonClass: "verify-change",
        falseSuccess: false,
      });

      for (const outcome of ["failed", "timed-out", "premature-end"] as const) {
        harness.appendAttempt(attemptRecord("GH-999", outcome));
        await harness.step();
        const emitted = eventFrames(client.drain());
        expect(emitted).toHaveLength(1);
        expect(emitted[0]?.kind).toBe("completed");
        expect((emitted[0]?.payload as { outcome?: string } | undefined)?.outcome).toBe(outcome);
      }

      // A re-tick emits nothing: one frame per source record.
      await harness.step();
      expect(eventFrames(client.drain())).toHaveLength(0);

      const outcomes = ["refused", "completed", "failed", "timed-out", "premature-end"] as const;
      for (const outcome of outcomes) {
        const record: DispatchAttemptRecord = attemptRecord("GH-999", outcome);
        expect(record.outcome).toBe(outcome);
      }
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
