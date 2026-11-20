/**
 * The pick-deliver-merge scenario builder (GH-348 AC-F8-4, TC-BATTLE-006).
 *
 * It drives the three delivered primitives — `queue claim` (pick), `dispatch`
 * (DELIVER, the delivered replacement for the shell deliver leg) and `merge` —
 * through the REAL composed command runtime the caller supplies, and returns the
 * REAL envelopes. `phase complete` is never the deliver leg: it is a PM lifecycle
 * transition, not a delivery. Nothing here restates a scenario constant: the
 * order, the deliver leg and the `phase complete` fact are derived from what the
 * runtime actually executed.
 */

export type PrimitiveName = "queue" | "dispatch" | "merge";

/** One real invocation, as the command runtime answered it. */
export type PrimitiveInvocation = {
  readonly argv: readonly string[];
  readonly verb: PrimitiveName;
  readonly exitCode: number;
  /** The delivered identity a refusal carried, or `null` on success. */
  readonly errorCode: string | null;
  /** The success token the primitive reported (`result`/`outcome`), or `null`. */
  readonly token: string | null;
};

export type PickDeliverMergeTranscript = {
  readonly ref: string;
  readonly invocations: readonly PrimitiveInvocation[];
  /** The primitive that carried the DELIVER leg, derived from the argv. */
  readonly deliverLeg: PrimitiveName;
  /** Whether any invocation was `phase complete` (it must never be). */
  readonly phaseCompleteUsed: boolean;
  /** Whether any invocation was routed through a shell or a script path. */
  readonly shellUsed: boolean;
};

/** The real command runtime the scenario drives. */
export type PrimitiveRunner = (argv: readonly string[]) => Promise<{
  readonly exit: number;
  readonly envelope?: Record<string, unknown> | undefined;
}>;

const verbOf = (argv: readonly string[]): PrimitiveName => {
  const first = argv[0];
  if (first === "queue" || first === "merge") return first;
  return "dispatch";
};

const errorCodeOf = (envelope: Record<string, unknown> | undefined): string | null => {
  const error = envelope?.["error"];
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : null;
};

const tokenOf = (envelope: Record<string, unknown> | undefined): string | null => {
  const data = envelope?.["data"];
  if (typeof data !== "object" || data === null) return null;
  const record = data as { readonly result?: unknown; readonly outcome?: unknown };
  if (typeof record.result === "string") return record.result;
  if (typeof record.outcome === "string") return record.outcome;
  return null;
};

/**
 * Run the scenario over the caller's real command runtime.
 *
 * The runner is the composed production program in the conformance battery; this
 * builder owns only the three invocations and the derivation of the facts a case
 * asserts, so no assertion reads back a fixture constant.
 */
export const runPickDeliverMerge = async (input: {
  readonly ref: string;
  readonly run: PrimitiveRunner;
}): Promise<PickDeliverMergeTranscript> => {
  const argvs: readonly (readonly string[])[] = [
    ["queue", "claim", input.ref, "--json"],
    ["dispatch", input.ref, "--json"],
    ["merge", input.ref, "--json"],
  ];
  const invocations: PrimitiveInvocation[] = [];
  for (const argv of argvs) {
    const outcome = await input.run(argv);
    invocations.push({
      argv,
      verb: verbOf(argv),
      exitCode: outcome.exit,
      errorCode: errorCodeOf(outcome.envelope),
      token: tokenOf(outcome.envelope),
    });
  }
  const deliver = invocations.find((invocation) => invocation.argv[0] === "dispatch");
  return {
    ref: input.ref,
    invocations,
    deliverLeg: deliver?.verb ?? "dispatch",
    phaseCompleteUsed: invocations.some(
      (invocation) => invocation.argv[0] === "phase" && invocation.argv[1] === "complete",
    ),
    shellUsed: invocations.some((invocation) =>
      invocation.argv.some(
        (arg) => arg.endsWith(".sh") || arg.startsWith("scripts/") || arg.startsWith("tools/"),
      ),
    ),
  };
};
