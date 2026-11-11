/**
 * TC-EVT-075 — an unknown subscribe topic is refused as `events.topic-unknown`
 * before any store read, a known event topic is accepted without a synthetic
 * baseline, `since` is ignored, and the delivered snapshot topics are unchanged.
 */
import { describe, expect, test } from "bun:test";
import {
  CONTROL_PROTOCOL_CURRENT,
  type ControlFrame,
  type ControlRequestFrame,
  LOCAL_CALLER_PRINCIPAL,
} from "../../packages/core/src/contracts/index";
import { encodeControlFrame } from "../../packages/core/src/domain/control-codec";
import { createEventHarness, dataOf, NOW } from "../fixtures/events/event-harness";

const errorOf = (frames: readonly ControlFrame[]): Record<string, unknown> | undefined =>
  (frames.find((frame) => frame.kind === "error")?.error ?? undefined) as
    | Record<string, unknown>
    | undefined;

const eventsOf = (frames: readonly ControlFrame[]): Record<string, unknown>[] =>
  frames.filter((frame) => frame.kind === "event").map(dataOf);

describe("TC-EVT-075 unknown-topic refusal and event-topic acceptance", () => {
  test("the refusal is classified, decided before any read, and leaves the connection usable", async () => {
    const harness = await createEventHarness({ label: "refusal" });
    try {
      // Prime the projection over the empty store so the later append is a change.
      await harness.step();
      let reads = 0;
      const original = harness.store.readRecords.bind(harness.store);
      harness.store.readRecords = () => {
        reads += 1;
        return original();
      };
      const client = await harness.connect();
      let ordinal = 0;
      const subscribe = (topic: string, since?: number): void => {
        ordinal += 1;
        const request: ControlRequestFrame = {
          v: CONTROL_PROTOCOL_CURRENT,
          kind: "request",
          type: "subscribe",
          id: `refusal-${ordinal}`,
          payload: { topic, ...(since === undefined ? {} : { since }) } as never,
          callerPrincipal: LOCAL_CALLER_PRINCIPAL,
        };
        client.connection.write(encodeControlFrame(request));
      };

      const before = reads;
      subscribe("status");
      await Promise.resolve();
      const refused = errorOf(client.frames);
      expect(refused?.code).toBe("events.topic-unknown");
      expect(refused).toMatchObject({
        code: "events.topic-unknown",
        category: "user",
        retryable: false,
        consequence: "not_landed",
      });
      expect(reads).toBe(before);
      expect(Object.keys(refused ?? {}).sort()).toEqual(
        ["category", "code", "consequence", "remediationHint", "retryable", "summary"].sort(),
      );

      // No error identity other than the declared one, and no lanes snapshot
      // labelled with the unknown topic.
      for (const frame of client.frames) {
        expect(JSON.stringify(frame)).not.toContain("daemon.state-recovery-failed");
        expect(JSON.stringify(frame)).not.toContain('"topic":"status"');
      }
      client.drain();

      // A known event topic is accepted, with no baseline frame.
      subscribe("queue.graph");
      await Promise.resolve();
      const accepted = client.drain();
      expect(accepted.some((frame) => frame.kind === "response")).toBe(true);
      expect(eventsOf(accepted)).toHaveLength(0);

      // `since` is accepted and ignored: the first frame after a change is 1.
      subscribe("queue.graph", 42);
      await Promise.resolve();
      client.drain();
      const acquired = harness.store.acquireFence("refusal-fence");
      if (!acquired.ok) throw new Error("fence refused");
      harness.store.append(acquired.value.handle, {
        kind: "queue.dependency",
        recordKey: "queue.deps:GH-999:refusal",
        payload: {
          schema: "delivery.queue.dependency.v1",
          ref: "GH-999",
          edges: ["GH-701"],
          recordedAt: NOW,
        } as never,
      });
      harness.store.releaseFence(acquired.value.handle);
      await harness.step();
      const replay = eventsOf(client.drain()).filter((data) => data.topic === "queue.graph");
      // Each subscription is an independent session subscription: the first
      // (no-since) subscription and the `since: 42` one both receive the event,
      // and both carry sequence 1 (no replay from the requested cursor).
      expect(replay.length).toBeGreaterThanOrEqual(1);
      for (const event of replay) expect(event.sequence).toBe(1);

      // A snapshot topic keeps the delivered cursor-0 baseline.
      subscribe("queue");
      await Promise.resolve();
      const baseline = eventsOf(client.drain()).filter((data) => data.topic === "queue");
      expect(baseline).toHaveLength(1);
      expect(baseline[0]?.cursor).toBe(0);
    } finally {
      await harness.stop();
      harness.close();
    }
  });
});
