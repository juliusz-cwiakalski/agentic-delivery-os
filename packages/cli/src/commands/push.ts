/**
 * `push` command — the lane's own evidence push (GH-416 F-1..F-4, DM-5).
 *
 * Grammar runs first: exactly one positional work-item reference. The injected
 * runtime performs the one fast-forward act and appends the durable record; a
 * pre-act resolution refusal is the delivered `input.value.rejected` row, and a
 * refused act is a data-bearing answer (exit 1) with no top-level error
 * identity — the delivered lifecycle push-failure shape.
 */
import type { DispatchLanePushResult } from "@delivery-os/core";
import type { CommandDefinition } from "../index.js";
import { renderPushText } from "../output/push-text.js";

/** The injected push surface runtime; every I/O edge is a port. */
export type PushCommandRuntime = {
  readonly run: (ref: string) => Promise<DispatchLanePushResult> | DispatchLanePushResult;
};

const REF_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;

const failure = (summary: string): { readonly error: Record<string, unknown> } => ({
  error: { kind: "input", code: "input.value.rejected", summary },
});

/**
 * The exit class: `0` exactly when the verdict is `pushed` (already-up-to-date
 * included), `1` for a refused act as a data-bearing answer.
 */
const exitProjectionFor = (data: unknown): "success" | "user-validation" => {
  if (typeof data !== "object" || data === null) return "success";
  const lanePush = (data as { readonly lanePush?: { readonly verdict?: unknown } }).lanePush;
  return lanePush?.verdict === "pushed" ? "success" : "user-validation";
};

/** Build the push command definition over the injected runtime. */
export const createPushCommandDefinition = (runtime: PushCommandRuntime): CommandDefinition => ({
  positionals: { max: 1 },
  flags: [],
  humanSuccess: true,
  humanText: (data) => renderPushText(data),
  exitProjection: (data) => exitProjectionFor(data),
  handler: async ({ positionals }) => {
    const [ref, ...extra] = positionals;
    if (extra.length > 0) return failure(`unexpected argument "${extra[0] as string}"`);
    if (ref === undefined || ref.length === 0) return failure("a work-item reference is required");
    if (!REF_PATTERN.test(ref)) return failure(`"${ref}" is not a work item ref`);
    const result = await runtime.run(ref);
    if (result.kind === "refused") return failure(result.detail);
    return { data: result.data };
  },
});
