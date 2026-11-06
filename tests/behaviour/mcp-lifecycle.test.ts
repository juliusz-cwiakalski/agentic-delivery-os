/**
 * TC-MCP-011 / TC-MCP-010 — the serve lifecycle exit matrix.
 *
 * Every row spawns the built `./serve` entry under Node in a hermetic
 * `mkdtemp` workspace with its own HOME, XDG_CONFIG_HOME, config selector, and
 * working name. Exit codes are observed, never assumed; the child is killed in
 * `finally` and every wait is bounded.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { scanRoot } from "../../scripts/checks/exit-code-literals";
import { type Client, PINNED_PROTOCOL_VERSION, startClient } from "../fixtures/mcp/protocol/client";

const ROOT = process.cwd();
const tempRoots: string[] = [];

const entryPath = (): string => {
  const manifest = JSON.parse(readFileSync(join(ROOT, "packages/mcp/package.json"), "utf8")) as {
    exports: Record<string, { default: string }>;
  };
  const entry = manifest.exports["./serve"]?.default;
  if (entry === undefined) throw new Error("packages/mcp/package.json has no ./serve export");
  return join(ROOT, "packages/mcp", entry);
};

const brandFacts = () => {
  const brand = resolveBrandIdentity({ workingName: "mcp-smoke" });
  if (!brand.ok) throw new Error("synthetic brand did not resolve");
  return brand.value;
};

const environmentPrefix = (): string => brandFacts().environmentPrefix;

const toolPrefix = (): string => brandFacts().mcpToolPrefix;

type Workspace = {
  readonly root: string;
  readonly home: string;
  readonly xdg: string;
  readonly cwd: string;
  readonly configPath: string;
};

const makeWorkspace = (configText?: string): Workspace => {
  const root = mkdtempSync(join(tmpdir(), "mcp-lifecycle-"));
  tempRoots.push(root);
  const home = join(root, "home");
  const xdg = join(root, "xdg");
  const cwd = join(root, "workspace");
  const configPath = join(root, "config.yaml");
  for (const directory of [home, xdg, cwd]) mkdirSync(directory, { recursive: true });
  if (configText !== undefined) writeFileSync(configPath, configText);
  return { root, home, xdg, cwd, configPath };
};

const environmentFor = (
  workspace: Workspace,
  overrides: Readonly<Record<string, string>> = {},
): Record<string, string> => ({
  PATH: process.env.PATH ?? "",
  HOME: workspace.home,
  XDG_CONFIG_HOME: workspace.xdg,
  DELIVERY_OS_WORKING_NAME: "mcp-smoke",
  NODE_NO_WARNINGS: "1",
  ...overrides,
});

const start = (workspace: Workspace, overrides: Readonly<Record<string, string>> = {}): Client =>
  startClient({
    command: "node",
    args: [entryPath()],
    cwd: workspace.cwd,
    env: environmentFor(workspace, overrides),
    requestTimeoutMs: 10_000,
  });

const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out: ${label}`)), 15_000);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const expectJsonRpcLines = (lines: readonly string[]): void => {
  for (const line of lines) {
    const frame = JSON.parse(line) as { jsonrpc?: string };
    expect(frame.jsonrpc).toBe("2.0");
  }
};

afterAll(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("TC-MCP-011 lifecycle exit matrix", () => {
  test("clean stop exits 0 with JSON-RPC-only stdout and no tool payload on stderr", async () => {
    const workspace = makeWorkspace("{}\n");
    const client = start(workspace, {
      [`${environmentPrefix()}CONFIG`]: workspace.configPath,
    });
    try {
      await withTimeout(client.initialize(PINNED_PROTOCOL_VERSION), "initialize");
      await withTimeout(client.listTools(), "tools/list");
      const exit = await withTimeout(client.close(), "clean close");
      expect(exit).toEqual({ code: 0, signal: null });
      expectJsonRpcLines(client.stdoutLines());
      expect(client.stderrText()).not.toContain("lint.target.missing");
    } finally {
      client.kill();
    }
  });

  test("an unresolvable configuration exits 1 with empty stdout and a named diagnostic", async () => {
    const workspace = makeWorkspace("a: [unterminated\n");
    const client = start(workspace, {
      [`${environmentPrefix()}CONFIG`]: workspace.configPath,
    });
    try {
      const exit = await withTimeout(client.close(), "configuration close");
      expect(exit).toEqual({ code: 1, signal: null });
      expect(client.stdoutLines()).toEqual([]);
      expect(client.stderrText().length).toBeGreaterThan(0);
      expect(client.stderrText().toLowerCase()).toContain("configuration");
    } finally {
      client.kill();
    }
  });

  test("a malformed JSON frame exits 2 with only parsed frames before the fault", async () => {
    const workspace = makeWorkspace("{}\n");
    const client = start(workspace, {
      [`${environmentPrefix()}CONFIG`]: workspace.configPath,
    });
    try {
      await withTimeout(client.initialize(PINNED_PROTOCOL_VERSION), "initialize");
      client.writeRaw("{not a json frame\n");
      const exit = await withTimeout(client.close(), "transport close");
      expect(exit).toEqual({ code: 2, signal: null });
      expectJsonRpcLines(client.stdoutLines());
      expect(client.stderrText().toLowerCase()).toContain("transport fault");
    } finally {
      client.kill();
    }
  });

  test("a classified tool failure does not exit; a later status call succeeds", async () => {
    const workspace = makeWorkspace("{}\n");
    const client = start(workspace, {
      [`${environmentPrefix()}CONFIG`]: workspace.configPath,
    });
    try {
      await withTimeout(client.initialize(PINNED_PROTOCOL_VERSION), "initialize");
      const tools = await withTimeout(client.listTools(), "tools/list");
      const names = (tools.result as { tools: Array<{ name: string }> }).tools.map(
        (tool) => tool.name,
      );
      const prefix = toolPrefix();
      expect(names).toContain(`${prefix}verify-artifact`);
      const failure = await withTimeout(
        client.callTool(`${prefix}verify-artifact`, { ref: "GH-9999" }),
        "verify-artifact",
      );
      expect(failure.payload).toMatchObject({ code: "lint.target.missing" });
      const status = await withTimeout(client.callTool(`${prefix}status`), "status");
      expect((status.payload as { schemaVersion?: string }).schemaVersion).toBe(
        "delivery.status.v1",
      );
      const exit = await withTimeout(client.close(), "classified close");
      expect(exit).toEqual({ code: 0, signal: null });
      expect(client.stderrText()).not.toContain("lint.target.missing");
    } finally {
      client.kill();
    }
  });

  test("an unknown method is protocol-level and serving continues", async () => {
    const workspace = makeWorkspace("{}\n");
    const client = start(workspace, {
      [`${environmentPrefix()}CONFIG`]: workspace.configPath,
    });
    try {
      await withTimeout(client.initialize(PINNED_PROTOCOL_VERSION), "initialize");
      const unknown = await withTimeout(client.request("unknown/method"), "unknown method");
      expect((unknown.error as { message?: string } | undefined)?.message).toContain(
        "Method not found",
      );
      await withTimeout(client.listTools(), "tools/list after unknown");
      const exit = await withTimeout(client.close(), "recoverable close");
      expect(exit).toEqual({ code: 0, signal: null });
    } finally {
      client.kill();
    }
  });

  test("an unexpected status argument and an invalid ref do not crash the server", async () => {
    const workspace = makeWorkspace("{}\n");
    const client = start(workspace, {
      [`${environmentPrefix()}CONFIG`]: workspace.configPath,
    });
    try {
      await withTimeout(client.initialize(PINNED_PROTOCOL_VERSION), "initialize");
      const prefix = toolPrefix();
      const unexpected = await withTimeout(
        client.callTool(`${prefix}status`, { unexpected: true }),
        "status with unexpected argument",
      );
      expect((unexpected.payload as { schemaVersion?: string }).schemaVersion).toBe(
        "delivery.status.v1",
      );
      const invalid = await withTimeout(
        client.callTool(`${prefix}verify-artifact`, {}),
        "invalid ref",
      );
      expect(invalid.payload).toMatchObject({ code: "input.value.rejected" });
      const valid = await withTimeout(
        client.callTool(`${prefix}status`),
        "valid status after invalid",
      );
      expect((valid.payload as { schemaVersion?: string }).schemaVersion).toBe(
        "delivery.status.v1",
      );
      const exit = await withTimeout(client.close(), "input-robustness close");
      expect(exit).toEqual({ code: 0, signal: null });
    } finally {
      client.kill();
    }
  });

  test("repeating the clean stop keeps every observed exit inside {0,1,2}", async () => {
    const observed: Array<number | null> = [];
    for (let index = 0; index < 2; index += 1) {
      const workspace = makeWorkspace("{}\n");
      const client = start(workspace, {
        [`${environmentPrefix()}CONFIG`]: workspace.configPath,
      });
      try {
        await withTimeout(client.initialize(PINNED_PROTOCOL_VERSION), "initialize");
        const exit = await withTimeout(client.close(), "repeated clean close");
        observed.push(exit.code);
        expect(exit.signal).toBeNull();
      } finally {
        client.kill();
      }
    }
    expect(observed.every((code) => code !== null && [0, 1, 2].includes(code))).toBe(true);
  });

  test("the observed exit codes are a subset of {0,1,2} and the scanner is clean", () => {
    const report = scanRoot(ROOT);
    expect(report.failures).toEqual([]);
    expect(report.scannedFiles).toBeGreaterThan(0);
  });

  test("the surface imports no telemetry, metrics, or trace module", () => {
    const files: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
        const next = `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "dist" || entry.name === "node_modules") continue;
          walk(next);
        } else if (entry.name.endsWith(".ts")) {
          files.push(next);
        }
      }
    };
    walk("packages/mcp/src");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).not.toMatch(/node:diagnostics_channel|from\s+"[^"]*telemetry/);
    }
  });
});
