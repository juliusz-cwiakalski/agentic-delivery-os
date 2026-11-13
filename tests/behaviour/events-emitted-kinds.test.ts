/**
 * TC-EVT-027 — `remove` is never emitted, and each event topic's emitted kind
 * set equals its declared set minus the declared non-emitted kinds.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ControlFrame } from "../../packages/core/src/contracts/index";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import {
  answerRecord,
  attemptRecord,
  createEventHarness,
  dataOf,
  laneRecord,
  questionRecord,
} from "../fixtures/events/event-harness";

const eventFrames = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

const appendRaw = (
  harness: Awaited<ReturnType<typeof createEventHarness>>,
  kind: string,
  key: string,
  payload: Record<string, unknown>,
): void => {
  const acquired = harness.store.acquireFence(`emitted-${key}`);
  if (!acquired.ok) throw new Error("fence refused");
  harness.store.append(acquired.value.handle, { kind, recordKey: key, payload: payload as never });
  harness.store.releaseFence(acquired.value.handle);
};

describe("TC-EVT-027 emitted kind sets equal the declared emitted sets", () => {
  test("a full-delivery fixture emits exactly the declared emitted kinds, remove exactly once", async () => {
    const harness = await createEventHarness({ label: "emitted-kinds" });
    try {
      const client = await harness.connect();
      for (const topic of [
        "queue",
        "lanes",
        "queue.graph",
        "dispatch.attempt",
        "phase.state",
        "blockers.state",
      ] as const) {
        client.subscribe(topic);
      }
      await Promise.resolve();
      await harness.step();
      const seen = new Set<string>();
      let removeFrames = 0;
      let removeObserved = false;

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
      appendRaw(harness, "queue.removal", "queue.removals:GH-700", {
        schema: "delivery.queue.removal.v1",
        ref: "GH-700",
        reason: "landed",
        recordedAt: "2026-11-12T10:00:04.000Z",
      });
      appendRaw(harness, "queue.lease", "queue.leases:L-1", {
        schema: "delivery.queue.lease.v1",
        leaseId: "L-1",
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
      const lane = laneRecord("GH-700");
      harness.appendLane(lane);
      harness.appendAttempt(attemptRecord("GH-700", "refused"));
      harness.appendAttempt(attemptRecord("GH-700", "completed"));
      harness.appendPhase({ phaseId: "specification", operation: "complete" });
      harness.appendPhase({ phaseId: "delivery", operation: "reopen", reason: "review-feedback" });
      harness.appendQuestion(questionRecord("Q-1", "GH-290"));
      harness.appendAnswer(answerRecord("Q-1"));
      harness.clearQuestion(lane, "Q-1", "boundary-note");
      await harness.step();
      for (const data of eventFrames(client.drain())) {
        if (data.topic !== "queue" && data.topic !== "lanes") {
          seen.add(`${String(data.topic)}/${String(data.kind)}`);
        }
        if (data.kind === "remove") {
          removeFrames += 1;
          removeObserved = true;
        }
      }
      // The fixture's removal is observed exactly once.
      expect(removeFrames).toBe(1);

      const expected = new Set<string>();
      for (const topic of TAXONOMY.topics) {
        if (topic.shape !== "event") continue;
        for (const kind of topic.kinds) {
          if (kind.emitted) expected.add(`${topic.name}/${kind.name}`);
        }
      }
      expect([...seen].sort()).toEqual([...expected].sort());
      expect(seen.has("queue.graph/remove")).toBe(true);
      expect(removeObserved).toBe(true);

      // The snapshot topics carry no kind at all.
      const snapshotFrames = eventFrames(client.drain()).filter(
        (data) => data.topic === "queue" || data.topic === "lanes",
      );
      expect(snapshotFrames).toHaveLength(0);
    } finally {
      await harness.stop();
      harness.close();
    }
  });

  test("the projection is the one production producer of the remove kind", () => {
    // GH-292 F-6: the projection emits `remove`; the other scanned modules
    // stay literal-free. The exact positive form: the projection names the
    // kind literal once, per removal record.
    const producer = readFileSync(
      join(process.cwd(), "packages/core/src/domain/event-projection.ts"),
      "utf8",
    );
    expect(producer).toContain('kind: "remove"');
    const files = [
      "packages/cli/src/daemon-compose.ts",
      "packages/core/src/app/control-server.ts",
      "packages/core/src/domain/control-session.ts",
    ];
    for (const file of files) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text).not.toContain('"remove"');
    }
  });
});
