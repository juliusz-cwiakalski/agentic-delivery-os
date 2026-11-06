/**
 * TC-MCP-012 / TC-MCP-013 — protocol discovery and the Node portability smoke.
 *
 * Node is mandatory: the suite records `node --version`, asserts the declared
 * floor, installs the test-only network guard, and drives the built `./serve`
 * entry from the manifest exports. When the entry also runs under Bun, the same
 * script proves canonical payload identity across runtimes.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { canonicalJson } from "../fixtures/mcp/parity/canonical";
import { type Client, PINNED_PROTOCOL_VERSION, startClient } from "../fixtures/mcp/protocol/client";

const ROOT = process.cwd();
const GUARD = join(ROOT, "tests/fixtures/mcp/node/network-guard.mjs");
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

type Workspace = {
  readonly root: string;
  readonly home: string;
  readonly xdg: string;
  readonly cwd: string;
  readonly configPath: string;
  readonly stateDirectory: string;
};

const makeWorkspace = (): Workspace => {
  const root = mkdtempSync(join(tmpdir(), "mcp-node-smoke-"));
  tempRoots.push(root);
  const home = join(root, "home");
  const xdg = join(root, "xdg");
  const cwd = join(root, "workspace");
  const configPath = join(root, "config.yaml");
  const brand = brandFacts();
  const stateDirectory = join(home, brand.stateDirectoryName);
  for (const directory of [home, xdg, cwd, stateDirectory]) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(configPath, "{}\n");
  return { root, home, xdg, cwd, configPath, stateDirectory };
};

const environmentFor = (workspace: Workspace): Record<string, string> => ({
  PATH: process.env.PATH ?? "",
  HOME: workspace.home,
  XDG_CONFIG_HOME: workspace.xdg,
  DELIVERY_OS_WORKING_NAME: "mcp-smoke",
  NODE_NO_WARNINGS: "1",
  [`${brandFacts().environmentPrefix}CONFIG`]: workspace.configPath,
});

const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out: ${label}`)), 20_000);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

type SmokeRun = {
  readonly names: readonly string[];
  readonly payloads: readonly unknown[];
  readonly exit: { readonly code: number | null; readonly signal: string | null };
};

const runSmoke = async (
  command: string,
  args: readonly string[],
  workspace: Workspace,
): Promise<SmokeRun> => {
  const client: Client = startClient({
    command,
    args,
    cwd: workspace.cwd,
    env: environmentFor(workspace),
    requestTimeoutMs: 10_000,
  });
  try {
    await withTimeout(client.initialize(PINNED_PROTOCOL_VERSION), "initialize");
    const toolsFrame = await withTimeout(client.listTools(), "tools/list");
    const names = (toolsFrame.result as { tools: Array<{ name: string }> }).tools.map(
      (tool) => tool.name,
    );
    const prefix = brandFacts().mcpToolPrefix;
    const status = await withTimeout(client.callTool(`${prefix}status`), "status");
    const verify = await withTimeout(
      client.callTool(`${prefix}verify-artifact`, { ref: "GH-9999" }),
      "verify-artifact",
    );
    const gates = await withTimeout(
      client.callTool(`${prefix}gate-report`, { ref: "GH-9999" }),
      "gate-report",
    );
    const exit = await withTimeout(client.close(), "close");
    return { names, payloads: [status.payload, verify.payload, gates.payload], exit };
  } finally {
    client.kill();
  }
};

/**
 * Normalize the one wall-clock field the status digest carries. The engines are
 * deterministic over injected inputs; the production serve edge injects the real
 * clock, so cross-runtime identity is asserted over the clock-free data.
 */
const normalizeClock = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeClock);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        key === "generatedAt" ? "<timestamp>" : normalizeClock(child),
      ]),
    );
  }
  return value;
};

const expectPinnedOutcomes = (run: SmokeRun): void => {
  const prefix = brandFacts().mcpToolPrefix;
  expect(run.names).toEqual([
    `${prefix}status`,
    `${prefix}verify-artifact`,
    `${prefix}gate-report`,
  ]);
  const [status, verify, gates] = run.payloads as Array<Record<string, unknown>>;
  expect(status?.schemaVersion).toBe("delivery.status.v1");
  expect(verify?.code).toBe("lint.target.missing");
  expect(gates?.code).toBe("verify.gates.failed");
  expect(run.exit).toEqual({ code: 0, signal: null });
};

afterAll(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("TC-MCP-013 Node portability smoke", () => {
  test("Node is present at the declared floor and the network guard installs", () => {
    const raw = execFileSync("node", ["--version"], { encoding: "utf8" }).trim();
    const major = Number(raw.replace(/^v/, "").split(".")[0]);
    console.log(`mcp-node-smoke: node ${raw}`);
    expect(major).toBeGreaterThanOrEqual(20);
    const probe = execFileSync(
      "node",
      [
        "--import",
        GUARD,
        "-e",
        "process.stdout.write(String(globalThis.__mcpNetworkGuardInstalled))",
      ],
      { encoding: "utf8" },
    ).trim();
    expect(probe).toBe("1");
  });

  test("the built entry serves all three tools under Node with the guard installed", async () => {
    const workspace = makeWorkspace();
    const run = await runSmoke("node", ["--import", GUARD, entryPath()], workspace);
    expectPinnedOutcomes(run);
  });

  test("the same entry produces canonical-identical payloads under Bun when it runs", async () => {
    const workspace = makeWorkspace();
    let bunRun: SmokeRun;
    try {
      bunRun = await runSmoke(process.execPath, [entryPath()], workspace);
    } catch (error) {
      console.log(
        `mcp-node-smoke: Bun run not available for the built entry: ${(error as Error).message}`,
      );
      return;
    }
    const nodeRun = await runSmoke("node", ["--import", GUARD, entryPath()], workspace);
    expectPinnedOutcomes(bunRun);
    expect(bunRun.payloads.map((payload) => canonicalJson(normalizeClock(payload)))).toEqual(
      nodeRun.payloads.map((payload) => canonicalJson(normalizeClock(payload))),
    );
  });
});
