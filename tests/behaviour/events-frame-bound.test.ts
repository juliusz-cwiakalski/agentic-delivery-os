/**
 * TC-EVT-083 — the frame bound holds from the declared caps, the worst case is
 * an order of magnitude below it, nothing is silently shortened, and v1 has no
 * truncation marker.
 */
import { describe, expect, test } from "bun:test";
import {
  BLOCKER_MAX_ANSWER_CHARS,
  BLOCKER_MAX_OPTION_CHARS,
  BLOCKER_MAX_OPTIONS,
  BLOCKER_MAX_QUESTION_CHARS,
  type ControlFrame,
  DAEMON_MAX_FRAME_BYTES,
  DISPATCH_MAX_EVIDENCE_REFS,
  QUEUE_MAX_EDGES_PER_ENTRY,
  QUEUE_MAX_REF_CHARS,
} from "../../packages/core/src/contracts/index";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import {
  answerRecord,
  attemptRecord,
  createEventHarness,
  dataOf,
  NOW,
  questionRecord,
} from "../fixtures/events/event-harness";

const eventsOf = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

const payloadKeys = (kind: string, topic: string): readonly string[] => {
  const declared = TAXONOMY.topics
    .find((candidate) => candidate.name === topic)
    ?.kinds.find((candidate) => candidate.name === kind);
  return (declared?.payloadFields ?? []).map((field) => field.replace(/[?[\]]/gu, ""));
};

describe("TC-EVT-083 frame bound and bounded payloads", () => {
  test("the declared worst case fits far below the frame bound", () => {
    // 32 edges x 64 characters per list, three lists, plus identifiers.
    const worstList = QUEUE_MAX_EDGES_PER_ENTRY * QUEUE_MAX_REF_CHARS;
    const worstPayloadBytes = worstList * 3 + 1_024;
    expect(worstPayloadBytes).toBeLessThan(DAEMON_MAX_FRAME_BYTES / 8);
    expect(BLOCKER_MAX_OPTIONS * BLOCKER_MAX_OPTION_CHARS).toBeLessThan(DAEMON_MAX_FRAME_BYTES);
  });

  test("worst-case emitted frames stay inside the bound with every declared field", async () => {
    const harness = await createEventHarness({ label: "frame-bound" });
    try {
      const graph = await harness.connect();
      graph.subscribe("queue.graph");
      const attempts = await harness.connect();
      attempts.subscribe("dispatch.attempt");
      const blockers = await harness.connect();
      blockers.subscribe("blockers.state");
      await Promise.resolve();
      await harness.step();

      const longRefs = Array.from({ length: QUEUE_MAX_EDGES_PER_ENTRY }, (_, index) =>
        `GH-${String(index).padStart(4, "0")}-${"x".repeat(QUEUE_MAX_REF_CHARS - 9)}`.slice(
          0,
          QUEUE_MAX_REF_CHARS,
        ),
      );
      const acquired = harness.store.acquireFence("frame-bound-fence");
      if (!acquired.ok) throw new Error("fence refused");
      harness.store.append(acquired.value.handle, {
        kind: "queue.dependency",
        recordKey: "queue.deps:GH-999:worst",
        payload: {
          schema: "delivery.queue.dependency.v1",
          ref: "GH-999",
          edges: longRefs,
          recordedAt: NOW,
        } as never,
      });
      harness.store.releaseFence(acquired.value.handle);

      harness.appendAttempt(attemptRecord("GH-999", "refused", NOW));
      const question = questionRecord("Q-WORST", "GH-290");
      harness.appendQuestion({
        ...question,
        question: "q".repeat(BLOCKER_MAX_QUESTION_CHARS),
        options: Array.from(
          { length: BLOCKER_MAX_OPTIONS },
          (_, index) => `${index}${"o".repeat(BLOCKER_MAX_OPTION_CHARS - 1)}`,
        ),
      });
      const baseAnswer = answerRecord("Q-WORST");
      harness.appendAnswer({
        schemaId: baseAnswer.schemaId,
        questionId: baseAnswer.questionId,
        answeringAudience: baseAnswer.answeringAudience,
        text: "a".repeat(BLOCKER_MAX_ANSWER_CHARS),
        answeredAt: baseAnswer.answeredAt,
        applied: false,
        laneResume: baseAnswer.laneResume,
      });
      await harness.step();

      const frames = [
        ...eventsOf(graph.drain()),
        ...eventsOf(attempts.drain()),
        ...eventsOf(blockers.drain()),
      ];
      expect(frames.length).toBeGreaterThanOrEqual(4);
      for (const frame of frames) {
        const line = JSON.stringify(frame);
        expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(DAEMON_MAX_FRAME_BYTES);
        expect(Object.keys(frame).length).toBe(8);
        for (const marker of ["truncated", "truncationReason"]) {
          expect(frame).not.toHaveProperty(marker);
          const payload = frame.payload as Record<string, unknown>;
          expect(payload).not.toHaveProperty(marker);
        }
      }

      const dependency = frames.find((frame) => frame.kind === "dependency-edge");
      expect(Object.keys((dependency?.payload ?? {}) as Record<string, unknown>).sort()).toEqual(
        [...payloadKeys("dependency-edge", "queue.graph")].sort(),
      );
      expect(((dependency?.payload ?? {}) as { edges: string[] }).edges).toHaveLength(
        QUEUE_MAX_EDGES_PER_ENTRY,
      );
      expect(
        ((dependency?.payload ?? {}) as { edges: string[] }).edges.every(
          (edge) => edge.length <= QUEUE_MAX_REF_CHARS,
        ),
      ).toBe(true);

      const refused = frames.find((frame) => frame.kind === "refused");
      expect(
        ((refused?.payload ?? {}) as { evidenceRefs: string[] }).evidenceRefs.length,
      ).toBeLessThanOrEqual(DISPATCH_MAX_EVIDENCE_REFS);

      const published = frames.find((frame) => frame.kind === "published");
      expect(Object.keys((published?.payload ?? {}) as Record<string, unknown>).sort()).toEqual(
        [...payloadKeys("published", "blockers.state")].sort(),
      );
      expect(((published?.payload ?? {}) as { question: string }).question).toHaveLength(
        BLOCKER_MAX_QUESTION_CHARS,
      );
      expect(((published?.payload ?? {}) as { options: string[] }).options).toHaveLength(
        BLOCKER_MAX_OPTIONS,
      );
      expect(((published?.payload ?? {}) as { options: string[] }).options[0]).toHaveLength(
        BLOCKER_MAX_OPTION_CHARS,
      );

      const updated = frames.find((frame) => frame.kind === "updated");
      expect(((updated?.payload ?? {}) as { text: string }).text).toHaveLength(
        BLOCKER_MAX_ANSWER_CHARS,
      );
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("no declared kind advertises a truncation field", () => {
    for (const topic of TAXONOMY.topics) {
      for (const kind of topic.kinds) {
        expect(kind.payloadFields).not.toContain("truncated");
        expect(kind.payloadFields).not.toContain("truncationReason");
      }
    }
  });
});
