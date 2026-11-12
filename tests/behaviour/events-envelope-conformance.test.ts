/**
 * TC-EVT-022 — every emitted frame on all four event topics carries exactly the
 * eight declared fields in order, with `lane` always a non-empty string, `ref`
 * nullable only on `blockers.state`, and no `cursor`.
 */
import { describe, expect, test } from "bun:test";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import {
  answerRecord,
  attemptRecord,
  createEventHarness,
  dataOf,
  ENVELOPE_KEYS,
  laneRecord,
  questionRecord,
} from "../fixtures/events/event-harness";

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

const payloadKey = (field: string): string => field.replace(/[?]$/u, "").replace(/\[\]$/u, "");

const declaredKind = (topic: string, kind: string) =>
  TAXONOMY.topics
    .find((candidate) => candidate.name === topic)
    ?.kinds.find((entry) => entry.name === kind);

const appendRaw = (
  harness: Awaited<ReturnType<typeof createEventHarness>>,
  kind: string,
  key: string,
  payload: Record<string, unknown>,
): void => {
  const acquired = harness.store.acquireFence(`envelope-${key}`);
  if (!acquired.ok) throw new Error("fence refused");
  harness.store.append(acquired.value.handle, { kind, recordKey: key, payload: payload as never });
  harness.store.releaseFence(acquired.value.handle);
};

describe("TC-EVT-022 envelope conformance across a full-delivery stream", () => {
  test("100% of frames carry the eight ordered fields and the declared rules", async () => {
    const harness = await createEventHarness({ label: "envelope" });
    try {
      const client = await harness.connect();
      for (const topic of [
        "queue.graph",
        "dispatch.attempt",
        "phase.state",
        "blockers.state",
      ] as const) {
        client.subscribe(topic);
      }
      await Promise.resolve();
      await harness.step();
      const collected: Record<string, unknown>[] = [];

      // queue.graph: entry, dependency-edge, release.
      harness.appendEntry({
        schema: "delivery.queue.entry.v1" as never,
        ref: "GH-700",
        priority: 5,
        recordedAt: "2026-11-12T10:00:01.000Z",
      } as never);
      appendRaw(harness, "queue.dependency", "queue.deps:GH-700:1", {
        schema: "delivery.queue.dependency.v1",
        ref: "GH-700",
        edges: ["GH-701"],
        recordedAt: "2026-11-12T10:00:02.000Z",
      });
      appendRaw(harness, "queue.lease", "queue.leases:L-1", {
        schema: "delivery.queue.lease.v1",
        leaseId: "L-1",
        scope: { kind: "repository", value: "github.com/example/repo" },
        repository: "github.com/example/repo",
        holder: "lane-1",
        ref: "GH-700",
        runner: "runner-1",
        weightClass: "standard",
        operation: "released",
        acquiredAt: "2026-11-12T09:00:00.000Z",
        heartbeatAt: "2026-11-12T09:30:00.000Z",
        ttlMs: 90_000,
        recordedAt: "2026-11-12T10:00:03.000Z",
      });
      await harness.step();
      collected.push(...eventFrames(client.drain()));

      // dispatch.attempt: started, refused, completed.
      const lane = laneRecord("GH-700");
      harness.appendLane(lane);
      harness.appendAttempt(attemptRecord("GH-700", "refused", "2026-11-12T10:00:04.000Z"));
      harness.appendAttempt(attemptRecord("GH-700", "completed", "2026-11-12T10:00:05.000Z"));
      await harness.step();
      collected.push(...eventFrames(client.drain()));

      // phase.state: began, completed, reopened.
      harness.appendPhase({ phaseId: "specification", operation: "complete" });
      harness.appendPhase({ phaseId: "delivery", operation: "reopen", reason: "review-feedback" });
      await harness.step();
      collected.push(...eventFrames(client.drain()));

      // blockers.state: published, updated, cleared.
      harness.appendQuestion(questionRecord("Q-1", "GH-290"));
      harness.appendAnswer(answerRecord("Q-1"));
      await harness.step();
      collected.push(...eventFrames(client.drain()));
      harness.clearQuestion(lane, "Q-1", "boundary-note");
      await harness.step();
      collected.push(
        ...eventFrames(client.drain()).filter((frame) => frame.topic === "blockers.state"),
      );

      expect(collected.length).toBeGreaterThanOrEqual(12);
      for (const data of collected) {
        expect(Object.keys(data)).toEqual([...ENVELOPE_KEYS]);
        expect("cursor" in data).toBe(false);
        const topic = data.topic as string;
        const kind = data.kind as string;
        const declared = declaredKind(topic, kind);
        expect(declared, `${topic}/${kind}`).toBeDefined();
        expect(typeof data.lane).toBe("string");
        expect((data.lane as string).length).toBeGreaterThan(0);
        expect(data.sequence).toBeGreaterThan(0);
        expect(Number.isInteger(data.sequence)).toBe(true);
        expect(data.taxonomyVersion).toBe("v1");
        expect(String(data.occurredAt)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/u);
        const payload = data.payload as Record<string, unknown>;
        const declaredFields = new Set((declared?.payloadFields ?? []).map(payloadKey));
        for (const key of Object.keys(payload)) expect(declaredFields.has(key), key).toBe(true);

        if (topic === "blockers.state") {
          expect(data.ref === null || typeof data.ref === "string").toBe(true);
          expect(data.ref).toBeNull();
        } else {
          expect(typeof data.ref).toBe("string");
          expect((data.ref as string).length).toBeGreaterThan(0);
        }
      }

      // The lane equals the declared rule's subject.
      for (const data of collected) {
        switch (data.topic) {
          case "queue.graph": {
            expect(data.lane).toBe(data.ref);
            break;
          }
          case "dispatch.attempt": {
            expect(data.lane).toBe(data.ref);
            break;
          }
          case "phase.state": {
            expect(data.lane).toBe("GH-290");
            expect(data.ref).toBe("GH-290");
            break;
          }
          default: {
            expect(data.lane).toBe("GH-290");
          }
        }
      }

      // Payloads carry no truncation marker and nothing undeclared leaks in.
      for (const data of collected) {
        const payload = data.payload as Record<string, unknown>;
        expect(payload).not.toHaveProperty("truncated");
        expect(payload).not.toHaveProperty("truncationReason");
      }
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
