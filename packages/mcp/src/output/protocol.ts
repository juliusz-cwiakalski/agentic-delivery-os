/**
 * The minimal in-package stdio JSON-RPC 2.0 protocol (F-1, F-5, DEC-4, OQ-1).
 *
 * Newline-delimited JSON-RPC 2.0 with deterministic id echo and per-request
 * response matching. The pinned subset is `initialize`, the `initialized`
 * notification, `tools/list`, and `tools/call`; unknown methods and unknown
 * tools are protocol-level errors and serving continues. Frames that parse as
 * JSON but are not JSON-RPC 2.0 objects (including batch arrays) are answered
 * with `-32600 Invalid Request` and serving continues; only unparseable bytes
 * are a transport fault below the tool layer and are returned to the lifecycle.
 *
 * Runtime-neutral: the transport lines and frame writer are injected; this
 * module imports no runtime API and writes no diagnostics.
 */
import type { BrandIdentity } from "@delivery-os/core/contracts";
import { toolIdByName } from "../commands/catalog.js";
import type { Toolset } from "../commands/toolset.js";
import type { McpToolResult } from "./payload.js";

/** A JSON-RPC request identifier. */
type JsonRpcId = string | number | null;

/** The injected transport: an async line source and a frame writer. */
export type ProtocolTransport = {
  readonly lines: AsyncIterable<string>;
  readonly writeFrame: (frame: string) => void;
};

/** Options for one protocol run. */
export type ProtocolOptions = {
  readonly brand: BrandIdentity;
  readonly toolset: Toolset;
  readonly serverName: string;
  readonly serverVersion: string;
};

/** The run outcome the lifecycle maps to an exit code. */
export type ProtocolOutcome =
  | { readonly kind: "clean" }
  | { readonly kind: "transport-fault"; readonly detail: string };

const PROTOCOL_VERSION = "2024-11-05";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const errorResponse = (id: JsonRpcId, code: number, message: string): string =>
  JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });

const resultResponse = (id: JsonRpcId, result: unknown): string =>
  JSON.stringify({ jsonrpc: "2.0", id, result });

const contentFor = (result: McpToolResult): Record<string, unknown> => {
  const text = JSON.stringify(result.ok ? result.data : result.error);
  return {
    content: [{ type: "text", text }],
    ...(result.ok ? {} : { isError: true }),
  };
};

const toolResult = async (
  options: ProtocolOptions,
  name: unknown,
  args: unknown,
): Promise<Record<string, unknown> | undefined> => {
  if (typeof name !== "string") return undefined;
  const canonical = toolIdByName(options.brand, name);
  if (canonical === undefined) return undefined;
  const result = await options.toolset.callTool(canonical, args);
  return contentFor(result);
};

/** Answer one parsed request frame; returns the response frame, or undefined. */
const respond = async (
  message: Record<string, unknown>,
  options: ProtocolOptions,
): Promise<string | undefined> => {
  const method = message.method;
  const id = (message.id ?? null) as JsonRpcId;
  const isNotification = !Object.hasOwn(message, "id");
  if (typeof method !== "string") {
    return isNotification ? undefined : errorResponse(id, -32600, "Invalid Request");
  }
  if (method === "notifications/initialized") return undefined;
  if (method === "initialize") {
    return resultResponse(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      serverInfo: { name: options.serverName, version: options.serverVersion },
    });
  }
  if (method === "tools/list") {
    return resultResponse(id, { tools: options.toolset.listTools() });
  }
  if (method === "tools/call") {
    const params = isRecord(message.params) ? message.params : {};
    const content = await toolResult(options, params.name, params.arguments);
    return content === undefined
      ? errorResponse(id, -32602, "Unknown tool")
      : resultResponse(id, content);
  }
  return isNotification ? undefined : errorResponse(id, -32601, "Method not found");
};

/** Run the protocol until EOF (clean) or a framing fault. */
export const runProtocol = async (
  transport: ProtocolTransport,
  options: ProtocolOptions,
): Promise<ProtocolOutcome> => {
  for await (const line of transport.lines) {
    if (line.trim().length === 0) continue;
    let message: unknown;
    try {
      message = JSON.parse(line) as unknown;
    } catch {
      return { kind: "transport-fault", detail: "malformed JSON frame" };
    }
    if (!isRecord(message) || message.jsonrpc !== "2.0") {
      // A valid-JSON non-frame (including a JSON-RPC batch array) is a client
      // mistake, not a dead transport (review F-3): answer Invalid Request and
      // keep serving. Only unparseable bytes exit the process.
      transport.writeFrame(errorResponse(null, -32600, "Invalid Request"));
      continue;
    }
    const response = await respond(message, options);
    if (response !== undefined) transport.writeFrame(response);
  }
  return { kind: "clean" };
};
