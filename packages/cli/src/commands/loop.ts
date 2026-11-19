/**
 * The `loop` command family (GH-348 F-1; API-1..API-5, API-7).
 *
 * Grammar mounted by phase: this phase mounts `start --foreground` and the
 * READ-ONLY `status` verb. `stop`, `reset`, the bounded `log` read and the final
 * refusal coverage arrive in later phases (the incremental verb surface). The
 * handler never writes streams and never chooses an exit code: the envelope and
 * the `{0,1,2}` projection are the command surface's.
 */
import type { LoopResult, LoopStartReceipt, LoopStopData } from "@delivery-os/core";
import type { LoopLogProjection, LoopStatusProjection } from "@delivery-os/core/contracts";
import { FALLBACK_INVOCATION_CODE } from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandInvocation } from "../index.js";
import {
  renderLoopExhaustion,
  renderLoopStartHuman,
  renderLoopStatusHuman,
} from "../output/loop-text.js";

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
  readonly stop: (input: {
    readonly mode: "drain" | "immediate";
  }) => Promise<LoopResult<LoopStopData>>;
  readonly reset: () => Promise<LoopResult<LoopStopData>>;
  readonly log: (input: { readonly lines: number }) => Promise<LoopResult<LoopLogProjection>>;
};

const refused = (summary: string): Failure => ({
  error: { kind: "fallback", code: FALLBACK_INVOCATION_CODE, summary },
});

const grammar = (): Failure => refused("result=refused; reason=grammar");

const foregroundRequired = (): Failure =>
  refused("loop start requires --foreground in v1; detached hosting is not declared");

export const createLoopCommandDefinition = (runtime: LoopCommandRuntime): CommandDefinition => ({
  flags: ["--foreground", "--fresh-budget", "--mode", "--lines"],
  requiresValue: ["--mode", "--lines"],
  positionals: { max: 1 },
  humanSuccess: true,
  humanFailureText: (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null) return undefined;
    const value = error as { readonly code?: unknown; readonly summary?: unknown };
    if (value.code !== "coordinator.restart-budget-exhausted") return undefined;
    return typeof value.summary === "string" ? renderLoopExhaustion(value.summary) : undefined;
  },
  humanText: (data: unknown): string => {
    if (typeof data !== "object" || data === null) return "";
    const value = data as Record<string, unknown>;
    if ("state" in value && "loopId" in value && !("schemaVersion" in value)) {
      const stop = data as LoopStopData;
      return `loop ${stop.state}  loop_id=${stop.loopId}  mode=${stop.mode ?? ""}\n`;
    }
    if (value.schemaVersion === "delivery.loop.log.v1") {
      const log = data as LoopLogProjection;
      const header = `loop log  lines=${String(log.returnedLines)}/${String(
        log.requestedLines,
      )}  bytes=${String(log.totalBytes)}  truncated=${
        log.truncated ? "yes" : "no"
      }  unreadable=${log.unreadable ? "yes" : "no"}`;
      return `${[header, ...log.lines].join("\n")}\n`;
    }
    if (value.schemaVersion !== "delivery.loop.v1") return "";
    return "released" in value
      ? renderLoopStartHuman(data as LoopStartReceipt)
      : renderLoopStatusHuman(data as LoopStatusProjection);
  },
  handler: async (invocation: CommandInvocation) => {
    const [subcommand, ...rest] = invocation.positionals;
    if (subcommand === undefined || rest.length > 0) return grammar();
    const foreground = invocation.flags["--foreground"] === true;
    const freshBudget = invocation.flags["--fresh-budget"] === true;
    const modeFlag = invocation.flags["--mode"];
    const linesFlag = invocation.flags["--lines"];
    if (linesFlag !== undefined && subcommand !== "log") return grammar();
    if (subcommand === "start") {
      if (modeFlag !== undefined || linesFlag !== undefined) return grammar();
      if (!foreground) return foregroundRequired();
      return runtime.start({ foreground: true, freshBudget });
    }
    if (subcommand === "status") {
      if (foreground || freshBudget || modeFlag !== undefined || linesFlag !== undefined) {
        return grammar();
      }
      return runtime.status();
    }
    if (subcommand === "stop") {
      if (foreground || freshBudget || linesFlag !== undefined) return grammar();
      if (modeFlag !== undefined && modeFlag !== "drain" && modeFlag !== "immediate") {
        return grammar();
      }
      return runtime.stop({ mode: modeFlag === "immediate" ? "immediate" : "drain" });
    }
    if (subcommand === "log") {
      if (foreground || freshBudget || modeFlag !== undefined) return grammar();
      if (linesFlag === undefined) return runtime.log({ lines: 50 });
      if (typeof linesFlag !== "string" || !/^\d+$/u.test(linesFlag)) return grammar();
      const parsed = Number(linesFlag);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return grammar();
      return runtime.log({ lines: parsed });
    }
    if (subcommand === "reset") {
      if (foreground || freshBudget || modeFlag !== undefined || linesFlag !== undefined) {
        return grammar();
      }
      return runtime.reset();
    }
    return grammar();
  },
});
