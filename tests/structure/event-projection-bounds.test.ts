/**
 * TC-EVT-082 (structure half) — the projection's per-tick cap, its pending
 * remainder, its per-`(topic, lane, source family)` watermark bound, and the
 * cumulative-artifact identity. Pure over synthetic store views: no store, no
 * clock, no transport.
 */
import { describe, expect, test } from "bun:test";
import { PHASE_TRANSITION_KIND } from "../../packages/core/src/contracts/registry";
import type { StateRecord } from "../../packages/core/src/contracts/state";
import {
  createEventProjector,
  EVENT_PROJECTION_MAX_PER_TOPIC_PER_TICK,
  EVENT_TOPICS,
  type ProjectedEvent,
} from "../../packages/core/src/domain/event-projection";
import { phaseTransitionRecordKey } from "../../packages/core/src/state/registry";

let ordinal = 0;

export const record = (
  kind: string,
  key: string,
  payload: Record<string, unknown>,
): StateRecord => {
  ordinal += 1;
  return {
    schemaVersion: "delivery.state.v1",
    kind,
    key,
    sequence: ordinal,
    checksum: `checksum-${ordinal}`,
    payload: payload as never,
  };
};

const dependency = (ref: string, edges: readonly string[]): StateRecord =>
  record("queue.dependency", `queue.deps:${ref}:${ordinal}`, {
    schema: "delivery.queue.dependency.v1",
    ref,
    edges,
    recordedAt: `2026-11-12T00:00:${String(ordinal % 60).padStart(2, "0")}.000Z`,
  });

const sequenceOf = (events: readonly ProjectedEvent[]): number[] =>
  events.map((event) => event.sequence);

const at = (second: number): string =>
  `2026-11-12T00:00:${String(second % 60).padStart(2, "0")}.000Z`;

const completion = (phaseId: string, second: number): Record<string, unknown> => ({
  phaseId,
  operation: "complete",
  timestamp: at(second),
  outcome: "landed",
});

const reopen = (phaseId: string, second: number): Record<string, unknown> => ({
  phaseId,
  operation: "reopen",
  reason: "review-feedback",
  timestamp: at(second),
});

/** One change's cumulative phase artifact carrying the given transitions. */
const phaseArtifact = (
  changeRef: string,
  transitions: readonly Record<string, unknown>[],
): StateRecord => {
  const last = transitions[transitions.length - 1];
  return record(PHASE_TRANSITION_KIND, phaseTransitionRecordKey(changeRef), {
    changeRef,
    phaseId: String(last?.phaseId ?? ""),
    operation: "complete",
    timestamp: String(last?.timestamp ?? ""),
    outcome: "landed",
    transitions,
  });
};

describe("TC-EVT-082 projection bounds", () => {
  test("the projection declares four event topics and a 64-per-topic per-tick cap", () => {
    expect([...EVENT_TOPICS]).toEqual([
      "queue.graph",
      "dispatch.attempt",
      "phase.state",
      "blockers.state",
    ]);
    expect(EVENT_PROJECTION_MAX_PER_TOPIC_PER_TICK).toBe(64);
  });

  test("a burst above the cap emits 64 in order and keeps the remainder pending", () => {
    const projector = createEventProjector();
    const baselineView: StateRecord[] = [];
    expect(projector.project(baselineView)).toEqual([]);

    const records = Array.from({ length: 100 }, (_, index) =>
      dependency("GH-999", [`GH-${700 + index}`]),
    );
    const first = projector.project(records);
    expect(first).toHaveLength(64);
    expect(first.every((event) => event.topic === "queue.graph")).toBe(true);
    expect(first.map((event) => (event.payload.added as string[])[0])).toEqual(
      Array.from({ length: 64 }, (_, index) => `GH-${700 + index}`),
    );

    const second = projector.project(records);
    expect(second).toHaveLength(36);
    expect(second.map((event) => (event.payload.added as string[])[0])).toEqual(
      Array.from({ length: 36 }, (_, index) => `GH-${764 + index}`),
    );
    expect(sequenceOf([...first, ...second])).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );

    // Nothing is left and nothing is duplicated.
    expect(projector.project(records)).toEqual([]);
  });

  test("the pending remainder is emitted before newly observed changes", () => {
    const projector = createEventProjector();
    projector.project([]);
    const records = Array.from({ length: 100 }, (_, index) =>
      dependency("GH-999", [`GH-${700 + index}`]),
    );
    projector.project(records);
    const withNew = [...records, dependency("GH-999", ["GH-999"])];
    const remainder = projector.project(withNew);
    expect(remainder).toHaveLength(37);
    expect(((remainder[35]?.payload.added ?? []) as string[])[0]).toBe("GH-799");
    expect(((remainder[36]?.payload.added ?? []) as string[])[0]).toBe("GH-999");
  });

  test("the watermark holds one entry per (topic, lane, source family), not per record", () => {
    const projector = createEventProjector();
    projector.project([]);
    projector.project(
      Array.from({ length: 100 }, (_, index) => dependency("GH-999", [`GH-${700 + index}`])),
    );
    const watermark = projector.watermark();
    expect(watermark).toHaveLength(1);
    expect(watermark[0]).toMatchObject({
      topic: "queue.graph",
      lane: "GH-999",
      family: "queue.dependency",
    });
    expect(typeof watermark[0]?.key).toBe("string");
    expect(typeof watermark[0]?.position).toBe("number");
  });

  test("a cumulative phase artifact is one watermark entry carrying the last emitted index", () => {
    const projector = createEventProjector();
    const key = phaseTransitionRecordKey("GH-290");
    const transitions = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        changeRef: "GH-290",
        phaseId: `phase-${index}`,
        operation: "complete",
        timestamp: `2026-11-12T00:00:${String(index).padStart(2, "0")}.000Z`,
        outcome: "landed",
      }));
    const artifact = (count: number): StateRecord =>
      record(PHASE_TRANSITION_KIND, key, {
        changeRef: "GH-290",
        phaseId: `phase-${count - 1}`,
        operation: "complete",
        timestamp: "2026-11-12T00:00:00.000Z",
        outcome: "landed",
        transitions: transitions(count),
      });

    expect(projector.project([])).toEqual([]);
    const first = projector.project([artifact(1)]);
    expect(first.map((event) => [event.kind, event.payload.phaseId])).toEqual([
      ["began", "phase-0"],
      ["completed", "phase-0"],
    ]);
    const afterOne = projector.watermark();
    expect(afterOne).toHaveLength(1);
    expect(afterOne[0]).toMatchObject({ topic: "phase.state", lane: "GH-290" });
    expect(afterOne[0]?.position).toBe(0);

    const second = projector.project([artifact(2)]);
    expect(second.map((event) => [event.kind, event.payload.phaseId])).toEqual([
      ["began", "phase-1"],
      ["completed", "phase-1"],
    ]);
    expect(projector.watermark()).toHaveLength(1);
    expect(projector.watermark()[0]?.position).toBe(1);

    const third = projector.project([artifact(3)]);
    expect(third.map((event) => [event.kind, event.payload.phaseId])).toEqual([
      ["began", "phase-2"],
      ["completed", "phase-2"],
    ]);
    expect(projector.watermark()).toHaveLength(1);
    expect(projector.watermark()[0]?.position).toBe(2);
  });

  test("at cap 2 the `began`/`completed` pair is one unit: both frames or neither", () => {
    const projector = createEventProjector({ maxPerTopicPerTick: 2 });
    expect(projector.project([])).toEqual([]);
    const view = [phaseArtifact("GH-290", [completion("phase-0", 1), completion("phase-1", 2)])];
    const first = projector.project(view);
    // Both frames of the first pair, never a lone `began`.
    expect(first.map((event) => `${event.kind}:${String(event.payload.phaseId)}`)).toEqual([
      "began:phase-0",
      "completed:phase-0",
    ]);
    expect(projector.watermark()[0]?.position).toBe(0);
    const second = projector.project(view);
    expect(second.map((event) => `${event.kind}:${String(event.payload.phaseId)}`)).toEqual([
      "began:phase-1",
      "completed:phase-1",
    ]);
    expect(projector.watermark()[0]?.position).toBe(1);
    expect(projector.project(view)).toEqual([]);
  });

  test("at the 64 cap a pair that exactly fills it emits both and a pair that cannot fit emits neither", () => {
    // 62 single-frame transitions then a pair: 62 + 2 = 64 fits exactly.
    const exact = createEventProjector();
    exact.project([]);
    const exactView = [
      phaseArtifact(
        "GH-PRE",
        Array.from({ length: 62 }, (_, index) => reopen(`pre-${index}`, index)),
      ),
      phaseArtifact("GH-PAIR", [completion("target", 90)]),
    ];
    const filled = exact.project(exactView);
    expect(filled).toHaveLength(64);
    expect(filled.filter((event) => event.lane === "GH-PAIR").map((event) => event.kind)).toEqual([
      "began",
      "completed",
    ]);

    // 63 single-frame transitions then a pair: 63 + 2 = 65 does not fit, so the
    // whole pair is skipped and the watermark never advances past it.
    const tight = createEventProjector();
    tight.project([]);
    const tightView = [
      phaseArtifact(
        "GH-PRE",
        Array.from({ length: 63 }, (_, index) => reopen(`pre-${index}`, index)),
      ),
      phaseArtifact("GH-PAIR", [completion("target", 90)]),
    ];
    const blocked = tight.project(tightView);
    expect(blocked).toHaveLength(63);
    expect(blocked.filter((event) => event.lane === "GH-PAIR")).toEqual([]);
    expect(tight.watermark().some((entry) => entry.lane === "GH-PAIR")).toBe(false);

    // The next tick emits the held pair in full; nothing was dropped.
    const retried = tight.project(tightView);
    expect(retried.map((event) => `${event.lane}:${event.kind}`)).toEqual([
      "GH-PAIR:began",
      "GH-PAIR:completed",
    ]);
    expect(tight.watermark().find((entry) => entry.lane === "GH-PAIR")?.position).toBe(0);
  });

  test("an all-pairs burst emits 64 frames per tick, not 42", () => {
    const projector = createEventProjector();
    projector.project([]);
    const view = [
      phaseArtifact(
        "GH-290",
        Array.from({ length: 40 }, (_, index) => completion(`phase-${index}`, index)),
      ),
    ];
    const first = projector.project(view);
    expect(first).toHaveLength(64);
    // 32 whole pairs, each in `began`, `completed` order.
    for (let pair = 0; pair < 32; pair += 1) {
      expect(first[pair * 2]?.kind).toBe("began");
      expect(first[pair * 2 + 1]?.kind).toBe("completed");
      expect(first[pair * 2]?.payload.phaseId).toBe(first[pair * 2 + 1]?.payload.phaseId);
    }
    const second = projector.project(view);
    expect(second).toHaveLength(16);
    expect(second.map((event) => event.kind)).toEqual(
      Array.from({ length: 8 }, () => ["began", "completed"]).flat(),
    );
    expect(projector.project(view)).toEqual([]);
  });

  test("the watermark bound is lanes x three source families over four topics", () => {
    const projector = createEventProjector();
    projector.project([]);
    projector.project([
      dependency("GH-999", ["GH-777"]),
      dependency("GH-888", ["GH-777"]),
      record("queue.entry", "queue.entries:GH-999", {
        ref: "GH-999",
        priority: 5,
        recordedAt: "2026-11-12T00:00:00.000Z",
      }),
    ]);
    expect(projector.watermark().length).toBeLessThanOrEqual(4 * 2 * 3);
    const families = new Set(projector.watermark().map((entry) => entry.family));
    expect(families.size).toBeLessThanOrEqual(3);
  });

  test("no payload carries a truncation marker and the projection never reads a store", () => {
    const projector = createEventProjector();
    projector.project([]);
    const events = projector.project([dependency("GH-999", ["GH-777"])]);
    for (const event of events) {
      const keys = Object.keys(event.payload);
      expect(keys).not.toContain("truncated");
      expect(keys).not.toContain("truncationReason");
    }
    // `project` takes the view as its only argument; it cannot perform a read.
    expect(createEventProjector().project.length).toBe(1);
  });
});
