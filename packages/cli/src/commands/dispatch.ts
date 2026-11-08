/**
 * The `dispatch` command family (GH-239 F-1, F-5, F-6; DM-5, DM-6).
 *
 * Grammar runs before any runtime call. Phase 4 composes the one-shot run form;
 * phase 5 adds `--resume-prompt`, phase 6 adds `dual-run summary`,
 * `dual-run resolve`, and `handover --revert`. The handler returns data or a
 * classified failure and never chooses an exit literal.
 */
import {
  DELIVERY_RESULT_TAXONOMY,
  type DeliveryResultToken,
  type DispatchEnvelopeData,
  type DispatchSummaryData,
  type ProjectionClass,
} from "@delivery-os/core/contracts";
import type { DispatchRunResult } from "@delivery-os/core";
import type { CommandDefinition, CommandInvocation } from "../index.js";
import {
  renderDispatchHandoverText,
  renderDispatchSummaryText,
  renderDispatchText,
} from "../output/dispatch-text.js";

/** The one-shot run surface; the edge wires the real ports behind it. */
export type DispatchRunRuntime = {
  readonly run: (input: {
    readonly ref: string;
    readonly harness?: string;
    readonly resumePrompt?: string;
  }) => Promise<DispatchRunResult>;
};

/** A classified command-level failure. */
export type DispatchRuntimeFailure = {
  readonly kind: string;
  readonly code: string;
  readonly summary?: string;
};

/** The summary surface; phase 6 composes it. */
export type DispatchSummaryRuntime = {
  readonly summarize: (
    repo: string,
  ) => Promise<
    | { readonly ok: true; readonly data: DispatchSummaryData }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** The divergence-resolution surface; phase 6 composes it. */
export type DispatchResolveRuntime = {
  readonly resolve: (input: {
    readonly divergenceId: string;
    readonly note: string;
  }) => Promise<
    | { readonly ok: true; readonly data: Record<string, unknown> }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** The handover/reversal surface; phase 6 composes it. */
export type DispatchHandoverRuntime = {
  readonly handover: (input: {
    readonly repo: string;
    readonly revert: boolean;
  }) => Promise<
    | {
        readonly ok: true;
        readonly data: {
          readonly repository: string;
          readonly operation: "authoritative" | "dual-run";
          readonly recorded: boolean;
          readonly noop: boolean;
        };
      }
    | { readonly ok: false; readonly error: DispatchRuntimeFailure }
  >;
};

/** Everything the dispatch command family can be composed with. */
export type DispatchCommandRuntime = {
  readonly run: DispatchRunRuntime;
  readonly summary?: DispatchSummaryRuntime;
  readonly resolve?: DispatchResolveRuntime;
  readonly handover?: DispatchHandoverRuntime;
};

const REF_PATTERN = /^[A-Z]+-\d+$/;

const failure = (code: string, summary?: string) => ({
  ok: false as const,
  error: { kind: "input", code, ...(summary === undefined ? {} : { summary }) },
});

/** A local short alias: keeps the parameter type recognizable. */
type DispatchToken = DeliveryResultToken;

const projectionOf = (value: DispatchToken): ProjectionClass => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === value);
  if (row === undefined) throw new Error("delivery-result token is not in the taxonomy");
  return row.projectionClass;
};

const isSummaryData = (data: unknown): data is DispatchSummaryData =>
  typeof data === "object" &&
  data !== null &&
  (data as { readonly repository?: unknown }).repository !== undefined &&
  (data as { readonly verdict?: unknown }).verdict !== undefined;

/** Build the one dispatch command definition over the injected runtime. */
export const createDispatchCommandDefinition = (
  runtime: DispatchCommandRuntime,
): CommandDefinition => ({
  flags: ["--revert"],
  requiresValue: ["--harness", "--resume-prompt", "--repo", "--note"],
  positionals: { max: 3 },
  humanSuccess: true,
  exitProjection: (data) => {
    if (isSummaryData(data)) return "success";
    const result = (data as { readonly result?: DeliveryResultToken }).result;
    return result === undefined ? "success" : projectionOf(result);
  },
  humanText: (data) => {
    if (isSummaryData(data)) return renderDispatchSummaryText(data);
    const envelope = data as Partial<DispatchEnvelopeData>;
    if (envelope.result !== undefined && envelope.lastMessage !== undefined) {
      return renderDispatchText(envelope as DispatchEnvelopeData);
    }
    const handover = data as { readonly operation?: unknown; readonly recorded?: unknown };
    if (handover.operation === "authoritative" || handover.operation === "dual-run") {
      return renderDispatchHandoverText({
        repository: String((data as { readonly repository?: unknown }).repository ?? ""),
        operation: handover.operation,
        recorded: handover.recorded === true,
        noop: (data as { readonly noop?: unknown }).noop === true,
      });
    }
    return undefined;
  },
  handler: async ({ positionals, flags }: CommandInvocation) => {
    const [first, second, third] = positionals;
    const repoFlag = typeof flags["--repo"] === "string" ? flags["--repo"] : undefined;
    const noteFlag = typeof flags["--note"] === "string" ? flags["--note"] : undefined;

    if (first === "dual-run") {
      if (second === "summary") {
        if (runtime.summary === undefined) return failure("input.value.rejected");
        if (repoFlag === undefined || repoFlag.length === 0) return failure("input.value.rejected");
        const result = await runtime.summary.summarize(repoFlag);
        return result.ok ? { data: result.data } : { error: result.error };
      }
      if (second === "resolve") {
        if (runtime.resolve === undefined) return failure("input.value.rejected");
        if (third === undefined || third.length === 0 || noteFlag === undefined) {
          return failure("input.value.rejected");
        }
        const result = await runtime.resolve.resolve({ divergenceId: third, note: noteFlag });
        return result.ok ? { data: result.data } : { error: result.error };
      }
      return failure("input.value.rejected");
    }

    if (first === "handover") {
      if (runtime.handover === undefined) return failure("input.value.rejected");
      const repo = second ?? repoFlag;
      if (repo === undefined || repo.length === 0) return failure("input.value.rejected");
      const result = await runtime.handover.handover({ repo, revert: flags["--revert"] === true });
      return result.ok ? { data: result.data } : { error: result.error };
    }

    if (first === undefined || second !== undefined || !REF_PATTERN.test(first)) {
      return failure("input.value.rejected");
    }
    const harness = typeof flags["--harness"] === "string" ? flags["--harness"] : undefined;
    const resumePrompt =
      typeof flags["--resume-prompt"] === "string" ? flags["--resume-prompt"] : undefined;
    const result = await runtime.run.run({
      ref: first,
      ...(harness === undefined ? {} : { harness }),
      ...(resumePrompt === undefined ? {} : { resumePrompt }),
    });
    return result.ok ? { data: result.data } : { error: result.error };
  },
});
