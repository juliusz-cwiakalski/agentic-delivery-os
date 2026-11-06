/**
 * `@delivery-os/mcp` — the MCP surface (`.`).
 *
 * The package root is the typed pure surface: the closed catalog, the toolset
 * seam, and the payload contract types. The Node-hosted stdio entry is a
 * declared `./serve` subpath; nothing runtime-specific is re-exported here.
 */
export {
  CANONICAL_TOOL_IDS,
  type CanonicalToolId,
  createToolset,
  describeTools,
  type GateReportToolRuntime,
  type StatusToolRuntime,
  type ToolDescriptor,
  type ToolInputProperty,
  type ToolInputSchema,
  type Toolset,
  type ToolsetOptions,
  type ToolsetRuntimes,
  toolIdByName,
  type VerifyArtifactToolRuntime,
} from "./commands/index.js";
export {
  failureFromValue,
  type GateReportToolData,
  inputRejection,
  type McpToolError,
  type McpToolFailure,
  type McpToolResult,
  type McpToolSuccess,
  type StatusToolData,
  type VerifyArtifactToolData,
} from "./output/index.js";
