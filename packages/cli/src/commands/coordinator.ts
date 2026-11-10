/**
 * The `coordinator` command family (GH-241 F-1; Appendix G).
 *
 * Grammar: `coordinator start --foreground [--fresh-budget]`, `coordinator stop`,
 * `coordinator status [--live]`, and `coordinator tick`. Handlers never write
 * streams and never choose an exit code; the envelope and the `{0,1,2}`
 * projection are the command surface's.
 */

import type { CoordinatorObservation } from "@delivery-os/core/contracts";
import { FALLBACK_INVOCATION_CODE } from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandInvocation } from "../index.js";
import { renderCoordinatorHuman, renderCoordinatorStopHuman } from "../output/coordinator-text.js";
import type { CoordinatorResult, CoordinatorStopData } from "./coordinator-loop.js";

type Failure = {
  readonly error: { readonly kind: string; readonly code: string; readonly summary?: string };
};

export type CoordinatorCommandRuntime = {
  readonly start: (input: {
    readonly foreground: boolean;
    readonly freshBudget: boolean;
  }) => Promise<CoordinatorResult<CoordinatorObservation>>;
  readonly stop: () => Promise<CoordinatorResult<CoordinatorStopData>>;
  readonly status: (input: {
    readonly live: boolean;
  }) => Promise<CoordinatorResult<CoordinatorObservation>>;
  readonly tick: () => Promise<CoordinatorResult<CoordinatorObservation>>;
};

const refused = (summary: string): Failure => ({
  error: { kind: "fallback", code: FALLBACK_INVOCATION_CODE, summary },
});

const foregroundRequired = (): Failure =>
  refused(
    "coordinator start requires --foreground in v1; detached and OS-unit hosting is the M1-S18 seam",
  );

export const createCoordinatorCommandDefinition = (
  runtime: CoordinatorCommandRuntime,
): CommandDefinition => ({
  flags: ["--foreground", "--fresh-budget", "--live"],
  positionals: { max: 1 },
  humanSuccess: true,
  humanText: (data: unknown): string => {
    if (typeof data !== "object" || data === null) return "";
    const value = data as Record<string, unknown>;
    if ("requested" in value) return renderCoordinatorStopHuman(data as CoordinatorStopData);
    if ("schemaVersion" in value) return renderCoordinatorHuman(data as CoordinatorObservation);
    return "";
  },
  handler: async (invocation: CommandInvocation) => {
    const [subcommand, ...rest] = invocation.positionals;
    if (subcommand === undefined || rest.length > 0) {
      return refused("result=refused; reason=grammar");
    }
    const foreground = invocation.flags["--foreground"] === true;
    const freshBudget = invocation.flags["--fresh-budget"] === true;
    const live = invocation.flags["--live"] === true;
    if (subcommand === "start") {
      if (live) return refused("result=refused; reason=grammar");
      if (!foreground) return foregroundRequired();
      return runtime.start({ foreground: true, freshBudget });
    }
    if (subcommand === "stop") {
      if (foreground || freshBudget || live) return refused("result=refused; reason=grammar");
      return runtime.stop();
    }
    if (subcommand === "status") {
      if (foreground || freshBudget) return refused("result=refused; reason=grammar");
      return runtime.status({ live });
    }
    if (subcommand === "tick") {
      if (foreground || freshBudget || live) return refused("result=refused; reason=grammar");
      return runtime.tick();
    }
    return refused("result=refused; reason=grammar");
  },
});
