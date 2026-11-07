/**
 * A small newline-delimited JSON-RPC 2.0 client for the spawned serve entry.
 *
 * Deterministic ids, per-request timeouts that name the unanswered method, the
 * initialize/initialized handshake, and JSON parsing of every `tools/call`
 * content. Used by the lifecycle and Node smoke suites; tests may spawn either
 * Node or Bun with it.
 */
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

export type JsonRpcFrame = Record<string, unknown>;

export type ClientOptions = {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly requestTimeoutMs?: number;
};

export type Client = {
  readonly request: (method: string, params?: unknown) => Promise<JsonRpcFrame>;
  readonly notify: (method: string, params?: unknown) => void;
  readonly initialize: (protocolVersion: string) => Promise<JsonRpcFrame>;
  readonly listTools: () => Promise<JsonRpcFrame>;
  readonly callTool: (
    name: string,
    args?: unknown,
  ) => Promise<{
    readonly payload: unknown;
    readonly isError: boolean;
    readonly content: readonly JsonRpcFrame[];
  }>;
  readonly writeRaw: (text: string) => void;
  readonly close: () => Promise<{ readonly code: number | null; readonly signal: string | null }>;
  readonly kill: () => void;
  readonly stdoutLines: () => readonly string[];
  readonly stderrText: () => string;
};

const DEFAULT_TIMEOUT_MS = 10_000;

export const startClient = (options: ClientOptions): Client => {
  const child: ChildProcessWithoutNullStreams = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    env: options.env as NodeJS.ProcessEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const reader: Interface = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const stdoutLines: string[] = [];
  let stderr = "";
  const pending = new Map<number, (frame: JsonRpcFrame) => void>();
  let nextId = 1;

  reader.on("line", (line) => {
    stdoutLines.push(line);
    const frame = JSON.parse(line) as JsonRpcFrame;
    const id = frame.id;
    if (typeof id === "number") {
      const resolve = pending.get(id);
      if (resolve !== undefined) {
        pending.delete(id);
        resolve(frame);
      }
    }
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });

  const request = async (method: string, params?: unknown): Promise<JsonRpcFrame> => {
    const id = nextId;
    nextId += 1;
    const timeoutMs = options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    const response = new Promise<JsonRpcFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`request timed out: ${method} (id ${id})`));
      }, timeoutMs);
      pending.set(id, (frame) => {
        clearTimeout(timer);
        resolve(frame);
      });
    });
    const frame = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params }),
    };
    child.stdin.write(`${JSON.stringify(frame)}\n`);
    return response;
  };

  const notify = (method: string, params?: unknown): void => {
    const frame = {
      jsonrpc: "2.0",
      method,
      ...(params === undefined ? {} : { params }),
    };
    child.stdin.write(`${JSON.stringify(frame)}\n`);
  };

  const initialize = async (protocolVersion: string): Promise<JsonRpcFrame> => {
    const result = await request("initialize", {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: "mcp-fixture-client", version: "0.0.0" },
    });
    notify("notifications/initialized");
    return result;
  };

  const listTools = (): Promise<JsonRpcFrame> => request("tools/list");

  const callTool = async (
    name: string,
    args?: unknown,
  ): Promise<{
    readonly payload: unknown;
    readonly isError: boolean;
    readonly content: readonly JsonRpcFrame[];
  }> => {
    const response = await request("tools/call", {
      name,
      ...(args === undefined ? {} : { arguments: args }),
    });
    const result = (response.result ?? {}) as { content?: unknown; isError?: unknown };
    const content = Array.isArray(result.content) ? (result.content as JsonRpcFrame[]) : [];
    const first = content[0];
    const text = typeof first?.text === "string" ? first.text : "null";
    return { payload: JSON.parse(text) as unknown, isError: result.isError === true, content };
  };

  const writeRaw = (text: string): void => {
    child.stdin.write(text);
  };

  const close = (): Promise<{ readonly code: number | null; readonly signal: string | null }> =>
    new Promise((resolve) => {
      try {
        child.stdin.end();
      } catch {
        // The child may have exited before the channel closed.
      }
      child.once("close", (code, signal) => {
        resolve({ code, signal });
      });
    });

  const kill = (): void => {
    child.kill("SIGKILL");
  };

  return {
    request,
    notify,
    initialize,
    listTools,
    callTool,
    writeRaw,
    close,
    kill,
    stdoutLines: () => [...stdoutLines],
    stderrText: () => stderr,
  };
};

/** The pinned protocol version the fixture and the server share. */
export const PINNED_PROTOCOL_VERSION = "2024-11-05";
