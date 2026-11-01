/**
 * The `closeout` command definition (GH-183 F-1, PIN-17).
 *
 * The handler validates the canonical ref case-sensitively, delegates plan or
 * apply to the injected runtime, and returns data or the classified failure.
 * The shared CLI edge owns rendering and exit projection; the handler never
 * inspects `--json` and performs no source read before grammar validation.
 */
import { renderCloseoutHuman } from "@delivery-os/core";
import type { CloseoutData } from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

/** The outcome the command runtime returns (shape of `runCloseout`). */
export type CloseoutCommandOutcome =
  | { readonly ok: true; readonly data: CloseoutData }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: string;
        readonly code: string;
        readonly summary?: string;
      };
    };

/** Everything the closeout handler reads, injected at the edge. */
export type CloseoutCommandRuntime = {
  plan(input: { readonly workItemRef: string }): Promise<CloseoutCommandOutcome>;
  apply(input: { readonly workItemRef: string }): Promise<CloseoutCommandOutcome>;
};

const REF_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;

const reject = (detail: string): { readonly error: unknown } => ({
  error: { kind: "input", code: "input.value.rejected", summary: `closeout: ${detail}` },
});

const isCloseoutData = (value: unknown): value is CloseoutData =>
  typeof value === "object" &&
  value !== null &&
  "schemaId" in value &&
  value.schemaId === "delivery.closeout.v1";

/** Build the `closeout` command definition over the injected runtime. */
export const createCloseoutCommandDefinition = (
  runtime: CloseoutCommandRuntime,
): CommandDefinition => ({
  flags: ["--apply"],
  positionals: { max: 2 },
  humanText: (data: unknown): string => (isCloseoutData(data) ? renderCloseoutHuman(data) : ""),
  handler: async (invocation) => {
    if (invocation.positionals.length !== 1) {
      return reject(
        invocation.positionals.length === 0
          ? "missing work item ref"
          : "exactly one work item ref is accepted",
      );
    }
    const workItemRef = invocation.positionals[0];
    if (workItemRef === undefined || !REF_PATTERN.test(workItemRef)) {
      return reject("the work item ref must match <PREFIX>-<digits> exactly");
    }
    const outcome =
      invocation.flags["--apply"] === true
        ? await runtime.apply({ workItemRef })
        : await runtime.plan({ workItemRef });
    return outcome.ok ? { data: outcome.data } : { error: outcome.error };
  },
});
