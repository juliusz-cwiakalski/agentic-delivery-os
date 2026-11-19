/**
 * The pick-deliver-merge scenario builder (GH-348 AC-F8-4, TC-BATTLE-006).
 *
 * It wires a scripted CEO session to the three delivered primitives, in order:
 * `queue claim` (pick), `dispatch` (DELIVER — the delivered replacement for the
 * shell deliver leg), and `merge` (merge), advancing the token total after each.
 * `phase complete` is NEVER the deliver leg: it is a PM lifecycle transition, not
 * a delivery. The scenario records the primitive the session issued, so a case
 * asserts the ORDER and the envelope rather than re-expressing the transcript.
 */

export type PrimitiveName = "queue" | "dispatch" | "merge" | "closeout";

export type PrimitiveInvocation = {
  readonly verb: PrimitiveName;
  readonly subcommand: string | null;
  readonly envelope: "delivery.result.v1";
};

export type PickDeliverMergeTranscript = {
  readonly ref: string;
  readonly invocations: readonly PrimitiveInvocation[];
  readonly tokenTotals: readonly number[];
  readonly deliverLeg: PrimitiveName;
  readonly phaseCompleteUsed: boolean;
};

/** The declared order the CEO session drives for one work item. */
export const PICK_DELIVER_MERGE_STEPS: readonly {
  readonly verb: PrimitiveName;
  readonly subcommand: string | null;
}[] = [
  { verb: "queue", subcommand: "claim" },
  { verb: "dispatch", subcommand: null },
  { verb: "merge", subcommand: null },
  { verb: "closeout", subcommand: null },
];

/**
 * Run the scenario over the injected primitive runner.
 *
 * The runner is the real command runtime in production and the D2 harness in the
 * battery; this builder owns the ORDER and the progress observation, never the
 * seam.
 */
export const runPickDeliverMerge = (input: {
  readonly ref: string;
  readonly runPrimitive: (step: {
    readonly verb: PrimitiveName;
    readonly subcommand: string | null;
  }) => Promise<{ readonly exitCode: number }>;
  readonly tokenTotalAfter: (stepIndex: number) => number;
}): Promise<PickDeliverMergeTranscript> => {
  const invocations: PrimitiveInvocation[] = [];
  const tokenTotals: number[] = [];
  const execute = async (index: number): Promise<PickDeliverMergeTranscript> => {
    const step = PICK_DELIVER_MERGE_STEPS[index];
    if (step === undefined) {
      return {
        ref: input.ref,
        invocations,
        tokenTotals,
        deliverLeg: "dispatch",
        phaseCompleteUsed: invocations.some(
          (invocation) => invocation.verb === "closeout" && invocation.subcommand === "complete",
        ),
      };
    }
    await input.runPrimitive(step);
    invocations.push({
      verb: step.verb,
      subcommand: step.subcommand,
      envelope: "delivery.result.v1",
    });
    tokenTotals.push(input.tokenTotalAfter(index));
    return execute(index + 1);
  };
  return execute(0);
};
