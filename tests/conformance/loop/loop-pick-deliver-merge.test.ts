/**
 * TC-BATTLE-006 (GH-348 AC-F8-4, F-8, Appendix C item (b)): the pick-deliver-merge
 * cycle drives the REAL composed command runtime over the delivered dispatch
 * conformance fixtures — `queue claim` (pick), `dispatch` (DELIVER) and `merge` —
 * asserts their REAL envelopes, the lane evidence the real dispatch appended,
 * and zero shell invocations; the loop then observes that deliver evidence and
 * stays healthy. The proof level is command-runtime and no further, and the
 * boundary constant stays nine proven / six not-proven (a live pick-deliver-merge
 * remains not-proven).
 */
import { describe, expect, test } from "bun:test";
import { corroborateDelivery } from "../../../packages/core/src/app/index";
import { createParityHarness } from "../../fixtures/dispatch/parity/harness";
import { createLoopHarness } from "../../fixtures/loop/harness";
import { runPickDeliverMerge } from "../../fixtures/loop/parity/e2e";
import {
  LOOP_NOT_PROVEN_SURFACES,
  LOOP_PROVEN_SURFACES,
} from "../../fixtures/loop/parity/evidence";

describe("TC-BATTLE-006 the pick-deliver-merge cycle over the real command runtime", () => {
  test("the real runtime answers the three primitives with production-derived envelopes", async () => {
    const parity = createParityHarness({ ref: "GH-348", label: "loop-battle-006" });
    try {
      const transcript = await runPickDeliverMerge({ ref: "GH-348", run: parity.run });

      // The three primitives really ran, in order, each with a real envelope.
      expect(transcript.invocations.map((entry) => entry.argv[0])).toEqual([
        "queue",
        "dispatch",
        "merge",
      ]);
      const [pick, deliver, merge] = transcript.invocations;
      // PICK: the delivered refusal identity, not a stub's constant.
      expect(pick?.exitCode).toBe(1);
      expect(pick?.errorCode).toBe("queue.precondition.unmet");
      // DELIVER: a real dispatch token from the declared vocabulary.
      expect(deliver?.exitCode).toBe(0);
      expect(deliver?.token).toBe("noop-lane-nothing-to-do");
      // MERGE: the delivered gate identity, not a stub's constant.
      expect(merge?.exitCode).toBe(2);
      expect(merge?.errorCode).toBe("merge.state-unverified");

      // The deliver leg is `dispatch`, derived from the argv, and `phase complete`
      // was never issued (a lifecycle transition is not a delivery).
      expect(transcript.deliverLeg).toBe("dispatch");
      expect(transcript.phaseCompleteUsed).toBe(false);
      expect(transcript.shellUsed).toBe(false);
      // The guarded runner recorded no shell invocation for any of the three.
      expect(parity.guarded.violations).toEqual([]);

      // The real dispatch appended real lane evidence for the ref.
      const lane = parity.observe().lanes.find((entry) => entry.ref === "GH-348");
      expect(lane).toBeDefined();
      expect(["active", "terminal"]).toContain(lane?.state ?? "");

      // The loop reads that real lane through the real corroborator and stays
      // healthy: a delivery in progress vetoes a kill (INV-DM-3, AC-F5-3).
      const delivery = corroborateDelivery({
        storeReadable: true,
        dispatchLanes: [
          {
            state: lane?.state === "active" ? "active" : "terminal",
            pid: lane?.owner?.processId ?? null,
            liveness: "alive",
          },
        ],
        daemonLane: null,
      });
      expect(["in-progress", "none"]).toContain(delivery);
      const loop = createLoopHarness({
        label: "battle-006-loop",
        progressReading: { state: "positive", observedAtMs: 1_000_000 },
        delivery,
        cycles: 2,
      });
      const started = await loop.run(["loop", "start", "--foreground", "--json"]);
      expect(started.code).toBe(0);
      expect(loop.verdicts.kills).toHaveLength(0);
      const records = loop.coordinatorRecords();
      if (records.ok) expect(records.restarts).toHaveLength(0);
    } finally {
      parity.dispose();
    }
  });

  test("the boundary keeps a live pick-deliver-merge NOT proven", () => {
    expect([...LOOP_PROVEN_SURFACES]).toHaveLength(9);
    expect([...LOOP_NOT_PROVEN_SURFACES]).toContain("real-pick-deliver-merge");
  });
});
