/**
 * The `loop` command family (GH-348 F-1; API-1..API-5, API-7).
 *
 * Grammar mounted by phase: this phase mounts `start --foreground` and the
 * READ-ONLY `status` verb. `stop`, `reset`, the bounded `log` read and the final
 * refusal coverage arrive in later phases (the incremental verb surface). The
 * handler never writes streams and never chooses an exit code: the envelope and
 * the `{0,1,2}` projection are the command surface's.
 */
import type { LoopResult, LoopStartReceipt } from "@delivery-os/core";
import type { LoopStatusProjection } from "@delivery-os/core/contracts";
import { FALLBACK_INVOCATION_CODE } from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandInvocation } from "../index.js";
import { renderLoopStartHuman, renderLoopStatusHuman } from "../output/loop-text.js";

type Failure = {
  readonly error: {
    readonly kind: string;
    readonly code: string;
    readonly summary?: string;
  };
};

/** The mounted runtime: one operation per verb this phase declares. */
export type LoopCommandRuntime = {
  readonly start: (input: {
    readonly foreground: boolean;
    readonly freshBudget: boolean;
  }) => Promise<LoopResult<LoopStartReceipt>>;
  readonly status: () => Promise<LoopResult<LoopStatusProjection>>;
};

const refused = (summary: string): Failure => ({
  error: { kind: "fallback", code: FALLBACK_INVOCATION_CODE, summary },
});

const grammar = (): Failure => refused("result=refused; reason=grammar");

const foregroundRequired = (): Failure =>
  refused("loop start requires --foreground in v1; detached hosting is not declared");

export const createLoopCommandDefinition = (runtime: LoopCommandRuntime): CommandDefinition => ({
  flags: ["--foreground", "--fresh-budget"],
  positionals: { max: 1 },
  humanSuccess: true,
  humanText: (data: unknown): string => {
    if (typeof data !== "object" || data === null) return "";
    const value = data as Record<string, unknown>;
    if (value["schemaVersion"] !== "delivery.loop.v1") return "";
    return "released" in value
      ? renderLoopStartHuman(data as LoopStartReceipt)
      : renderLoopStatusHuman(data as LoopStatusProjection);
  },
  handler: async (invocation: CommandInvocation) => {
    const [subcommand, ...rest] = invocation.positionals;
    if (subcommand === undefined || rest.length > 0) return grammar();
    const foreground = invocation.flags["--foreground"] === true;
    const freshBudget = invocation.flags["--fresh-budget"] === true;
    if (subcommand === "start") {
      if (!foreground) return foregroundRequired();
      return runtime.start({ foreground: true, freshBudget });
    }
    if (subcommand === "status") {
      if (foreground || freshBudget) return grammar();
      return runtime.status();
    }
    return grammar();
  },
});
