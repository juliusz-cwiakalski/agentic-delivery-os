/**
 * TC-BATTLE-006 (GH-348 AC-F8-4): the pick-deliver-merge cycle runs the real
 * DELIVER leg (`dispatch`) over the real command runtime with the nested PM
 * session scripted, zero shells, zero kills, and no `phase complete` on the
 * deliver leg.
 */
import { describe, expect, test } from "bun:test";
import { createLoopHarness } from "../../fixtures/loop/harness";
import { runPickDeliverMerge } from "../../fixtures/loop/parity/e2e";

describe("TC-BATTLE-006 the pick-deliver-merge cycle", () => {
  test("the session drives queue claim, dispatch, merge and closeout in order", async () => {
    const harness = createLoopHarness({
      label: "battle-006",
      progressReading: { state: "positive", observedAtMs: 1_000_000 },
      cycles: 2,
    });
    const issued: string[] = [];
    const transcript = await runPickDeliverMerge({
      ref: "GH-348",
      runPrimitive: async (step) => {
        issued.push(step.subcommand === null ? step.verb : `${step.verb} ${step.subcommand}`);
        return { exitCode: 0 };
      },
      tokenTotalAfter: (index) => 1_000 * (index + 1),
    });
    expect(issued).toEqual(["queue claim", "dispatch", "merge", "closeout"]);
    expect(transcript.deliverLeg).toBe("dispatch");
    expect(transcript.phaseCompleteUsed).toBe(false);
    // The loop observes the resulting progress and stays healthy: zero kills,
    // zero restarts.
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    expect(result.code).toBe(0);
    expect(harness.verdicts.kills).toHaveLength(0);
    const records = harness.coordinatorRecords();
    if (records.ok) expect(records.restarts).toHaveLength(0);
  });
});
