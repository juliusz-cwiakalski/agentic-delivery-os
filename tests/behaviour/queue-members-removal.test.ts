/**
 * TC-XQUEUE-003 (GH-310 F-2, F-5, AC-F2-3, DM-6, OQ-5): one member's observed
 * landing removes exactly that member's entry with the delivered `landed`
 * reason, leaves the other member's entry, and re-evaluates its readiness.
 */
import { describe, expect, test } from "bun:test";
import {
  queueRemovalForCloseout,
  readQueueFold,
  readQueueRemovals,
} from "../../packages/core/src/app/queue";
import { CHANGE_REF } from "../fixtures/cross-repository/constants";
import { createMemberQueueHarness, MEMBER_REFS } from "../fixtures/cross-repository/queue";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const entries = (text: string): Array<Record<string, unknown>> =>
  (json(text).data as Record<string, unknown>).entries as Array<Record<string, unknown>>;

describe("TC-XQUEUE-003 one landing removes only its member entry", () => {
  test("apply removes A with reason landed, retains B, and recomputes B's readiness", async () => {
    const world = createMemberQueueHarness("removal");
    const harness = world.harness;
    expect((await harness.run(["queue", "add", CHANGE_REF, "--json"])).exitCode).toBe(0);

    const fence = harness.composition.store.acquireFence("member-removal-fence");
    expect(fence.ok).toBe(true);
    if (!fence.ok) return;
    try {
      const removed = queueRemovalForCloseout(harness.composition.store, {
        mode: "apply",
        workItemRef: MEMBER_REFS.api,
        mergedObserved: true,
        recordedAt: harness.nowIso(),
        nowMs: harness.nowMs(),
        handle: fence.value.handle,
      });
      expect(removed).toEqual({
        outcome: "removed",
        ref: MEMBER_REFS.api,
        reason: "landed",
      });
    } finally {
      harness.composition.store.releaseFence(fence.value.handle);
    }

    const removals = readQueueRemovals(harness.composition.store);
    expect(removals.ok).toBe(true);
    if (!removals.ok) return;
    expect(removals.records.map((record) => [record.ref, record.reason])).toEqual([
      [MEMBER_REFS.api, "landed"],
    ]);
    expect(removals.records.some((record) => record.ref === MEMBER_REFS.web)).toBe(false);
    expect(removals.records.some((record) => record.ref === CHANGE_REF)).toBe(false);

    const fold = readQueueFold(harness.composition.store);
    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    expect(fold.value.entries.map((entry) => entry.ref)).toEqual([MEMBER_REFS.web]);

    // The prerequisite landing is now observable, so B no longer blocks on it.
    world.land();
    const listed = await harness.run(["queue", "list", "--json"]);
    expect(listed.exitCode).toBe(0);
    const web = entries(listed.stdout).find((entry) => entry.ref === MEMBER_REFS.web);
    const blocking = (web?.blocking ?? []) as Array<Record<string, unknown>>;
    expect(blocking.some((block) => block.reason === "dependency-open")).toBe(false);

    // A repeat with the same observation converges truthfully and appends nothing.
    const again = world.harness.composition.store.acquireFence("member-removal-fence-2");
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    try {
      const repeat = queueRemovalForCloseout(harness.composition.store, {
        mode: "apply",
        workItemRef: MEMBER_REFS.api,
        mergedObserved: true,
        recordedAt: harness.nowIso(),
        nowMs: harness.nowMs(),
        handle: again.value.handle,
      });
      expect(repeat).toEqual({ outcome: "satisfied", ref: MEMBER_REFS.api });
    } finally {
      harness.composition.store.releaseFence(again.value.handle);
    }
    const after = readQueueRemovals(harness.composition.store);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.records.length).toBe(1);
  });
});
