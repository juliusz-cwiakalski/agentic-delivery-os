/**
 * `@delivery-os/mcp` output tier (`#output/*` alias target).
 *
 * The payload contract is the pure seam; the stdio protocol adapter lands in
 * the serve composition (phase 3) and stays runtime-neutral here.
 */
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
} from "./payload.js";
