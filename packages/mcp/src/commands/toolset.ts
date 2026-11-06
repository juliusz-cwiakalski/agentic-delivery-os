/**
 * The pure MCP toolset seam (F-5, F-7, DEC-7, OQ-2).
 *
 * `createToolset` accepts the engine runtimes the corresponding CLI command
 * definitions take and exposes `listTools()` plus `callTool(id, args)`. Boundary
 * validation happens exactly once here: a missing, empty, or non-string ref
 * maps to the CLI grammar-rejection analogue `input.value.rejected`. Handlers
 * call engine functions only, never other tools. Calls are serialized in
 * arrival order (OQ-2): the read-only engines make either policy safe, and
 * serialization keeps determinism and single-frame writes.
 */
import type { BrandIdentity } from "@delivery-os/core/contracts";
import { inputRejection, type McpToolResult } from "../output/payload.js";
import { type CanonicalToolId, describeTools, type ToolDescriptor } from "./catalog.js";
import { type GateReportToolRuntime, runGateReportTool } from "./gate-report.js";
import { runStatusTool, type StatusToolRuntime } from "./status.js";
import { runVerifyArtifactTool, type VerifyArtifactToolRuntime } from "./verify-artifact.js";

/** The engine runtimes injected into the toolset. */
export type ToolsetRuntimes = {
  readonly status?: StatusToolRuntime;
  readonly verify?: VerifyArtifactToolRuntime;
  readonly gates?: GateReportToolRuntime;
};

/** The toolset construction options: one brand and the engine runtimes. */
export type ToolsetOptions = {
  readonly brand: BrandIdentity;
} & ToolsetRuntimes;

/** The callable toolset seam the stdio protocol adapts. */
export type Toolset = {
  readonly listTools: () => readonly ToolDescriptor[];
  readonly callTool: (id: CanonicalToolId, args?: unknown) => Promise<McpToolResult>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Validate the one ref parameter once at the boundary (DEC-7). */
const refArgument = (args: unknown): string | undefined => {
  if (!isRecord(args)) return undefined;
  const ref = args.ref;
  return typeof ref === "string" && ref.length > 0 ? ref : undefined;
};

const missingRuntime = (): McpToolResult => {
  const failure = inputRejection();
  return failure;
};

/** Build a toolset over the injected runtimes. */
export const createToolset = (options: ToolsetOptions): Toolset => {
  let queue: Promise<unknown> = Promise.resolve();

  const serialize = <T>(task: () => Promise<T>): Promise<T> => {
    const result = queue.then(task, task);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const dispatch = async (id: CanonicalToolId, args: unknown): Promise<McpToolResult> => {
    switch (id) {
      case "status": {
        const runtime = options.status;
        return runtime === undefined ? missingRuntime() : runStatusTool(runtime);
      }
      case "verify-artifact": {
        const runtime = options.verify;
        const ref = refArgument(args);
        if (runtime === undefined || ref === undefined) return inputRejection();
        return runVerifyArtifactTool(runtime, ref);
      }
      case "gate-report": {
        const runtime = options.gates;
        const ref = refArgument(args);
        if (runtime === undefined || ref === undefined) return inputRejection();
        return runGateReportTool(runtime, ref);
      }
      default: {
        return inputRejection();
      }
    }
  };

  return {
    listTools: () => describeTools(options.brand),
    callTool: (id, args) => serialize(() => dispatch(id, args)),
  };
};
