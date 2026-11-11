/**
 * TC-DAEMON-039 (integration-marked) — one bounded real detached re-entry.
 *
 * The only case in the change that spawns a real child: a `#!/usr/bin/env bun`
 * fixture entry inside a temp root that invokes the delivered
 * `createDaemonMainEntry` as a library seam (its one permitted consumer), over
 * the real process port and the real clock. The case is temp-rooted, reaped in
 * `finally`, and hard-bounded; it never touches the real user state directory,
 * systemd, the network, or the test process's own environment.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createDaemonCommandDefinition } from "../../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../../packages/cli/src/daemon-compose";
import {
  createNodeClock,
  createNodeProcessPort,
} from "../../../packages/adapters/src/daemon/index";
import { readDaemonHeartbeat, readDaemonInstance } from "../../../packages/core/src/app/index";
import {
  createMountHarness,
  mountComposition,
  reentryEnvironmentFrom,
  stateDirectoryName,
} from "../../fixtures/daemon/mount-harness";

const HARD_TIMEOUT_MS = 20_000;

const fixtureScript = (repoRoot: string, bindingName: string): string => `#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { createDaemonMainEntry } from ${JSON.stringify(`${repoRoot}/packages/cli/src/daemon-main.ts`)};
import {
  createDaemonLockPort,
  createNodeStateEdge,
  createStateStore,
} from ${JSON.stringify(`${repoRoot}/packages/core/src/state/index.ts`)};
import { resolveDaemonSettings } from ${JSON.stringify(`${repoRoot}/packages/core/src/config/index.ts`)};
import { STATE_SCHEMA_VERSION } from ${JSON.stringify(`${repoRoot}/packages/core/src/contracts/index.ts`)};

const binding = ${JSON.stringify(bindingName)};
const stateDirectory = process.env[binding] ?? "";
writeFileSync(
  stateDirectory + "/probe.json",
  JSON.stringify({
    keys: Object.keys(process.env).sort(),
    execPath: process.execPath,
    argv1: process.argv[1] ?? null,
  }),
);
const settings = resolveDaemonSettings({}, {}, { stateDirectory });
if (!settings.ok) process.exit(3);
const store = createStateStore(
  {
    level: "local",
    workspaceId: "default",
    fenceNamespace: "cli",
    schemaVersion: STATE_SCHEMA_VERSION,
    stateDirectory,
  },
  { driver: "jsonl", edge: createNodeStateEdge() },
);
const lock = createDaemonLockPort(createNodeStateEdge(), stateDirectory);
const result = await createDaemonMainEntry(
  {
    store,
    lock,
    settings: settings.value,
    restartBound: 3,
    stateDirectory,
    unit: "example-product-daemon.service",
    binary: process.argv[1] ?? "",
    environmentName: binding,
    pid: process.pid,
    newFenceToken: () => crypto.randomUUID(),
    newLockToken: () => crypto.randomUUID(),
    newInstanceId: () => crypto.randomUUID(),
    daemonEntry: process.argv[1] ?? "",
  },
  {
    waitForStop: () =>
      new Promise((resolve) => {
        process.once("SIGTERM", () => resolve("drain"));
        process.once("SIGINT", () => resolve("immediate"));
      }),
  },
)();
process.exit(result.ok ? 0 : 2);
`;

const invoke = async (
  runtime: ReturnType<typeof createDaemonCommandRuntime>,
  argv: readonly string[],
) => {
  const definition = createDaemonCommandDefinition(runtime);
  const [subcommand, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = subcommand === undefined ? [] : [subcommand];
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index] as string;
    if (token === "--mode") {
      flags["--mode"] = rest[index + 1] as string;
      index += 1;
      continue;
    }
    flags[token] = true;
  }
  return definition.handler({ positionals, flags, global: {} } as never);
};

const isFailure = (value: unknown): value is { error: { code: string } } =>
  typeof value === "object" && value !== null && "error" in value;

describe("TC-DAEMON-039 real detached re-entry", () => {
  test(
    "a bounded `#!/usr/bin/env bun` child reaches a durable acquired instance and is reaped",
    async () => {
      const repoRoot = process.cwd();
      const harness = createMountHarness({ label: "real-039" });
      const processPort = createNodeProcessPort();
      let pid: number | undefined;
      try {
        // The bun directory must sit outside the shell fallback, so the
        // interpreter proof cannot be satisfied by a system bun.
        const bunDirectory = dirname(process.execPath);
        expect(["/usr/bin", "/bin"]).not.toContain(bunDirectory);

        const entry = join(harness.stateDirectory, "entry.ts");
        mkdirSync(harness.stateDirectory, { recursive: true, mode: 0o700 });
        writeFileSync(entry, fixtureScript(repoRoot, stateDirectoryName(harness.brand)));
        chmodSync(entry, 0o755);

        const environment = {
          ...harness.environment,
          PATH: `${bunDirectory}:/usr/bin:/bin`,
          HOME: harness.home,
        };
        const runtime = createDaemonCommandRuntime(
          mountComposition(harness, {
            daemonEntry: entry,
            processPort,
            // The real clock: the readiness window must be the delivered one.
            clock: createNodeClock(),
            reentryEnvironment: reentryEnvironmentFrom(environment),
            settings: harness.settings,
          }),
        );

        const started = await invoke(runtime, ["start"]);
        expect(isFailure(started)).toBe(false);
        if (isFailure(started)) return;
        const receipt = started.data as { instance: { pid: number } };
        pid = receipt.instance.pid;
        expect(Number.isInteger(pid) && pid > 0).toBe(true);

        // The child's own evidence: declared key set and interpreter resolution.
        const probePath = `${harness.stateDirectory}/probe.json`;
        expect(existsSync(probePath)).toBe(true);
        const probe = JSON.parse(readFileSync(probePath, "utf8")) as {
          keys: string[];
          execPath: string;
          argv1: string | null;
        };
        const binding = stateDirectoryName(harness.brand);
        const declared = new Set(["PATH", "HOME", binding]);
        expect(probe.keys.filter((key) => declared.has(key)).sort()).toEqual(
          ["HOME", "PATH", binding].sort(),
        );
        expect(dirname(probe.execPath)).toBe(bunDirectory);
        expect(probe.execPath.endsWith("/bun")).toBe(true);
        expect(probe.argv1).toBe(entry);

        const drained = await invoke(runtime, ["stop", "--mode", "drain"]);
        expect(isFailure(drained)).toBe(false);
        if (!isFailure(drained)) {
          const data = drained.data as { result: string; instance: { pid: number } | null };
          expect(data.result).toBe("draining");
          expect(data.instance?.pid).toBe(pid);
        }

        // Bounded poll for exactly one drain release: at most 40 x 50 ms.
        let released = 0;
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const instance = readDaemonInstance(harness.store);
          if (instance.ok && instance.latest?.operation === "released") {
            released = 1;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(released).toBe(1);
        const instance = readDaemonInstance(harness.store);
        if (instance.ok) {
          expect(instance.latest?.releaseReason).toBe("drain");
        }
        const heartbeat = readDaemonHeartbeat(harness.store);
        expect(heartbeat.ok).toBe(true);

        const childIsAlive = (): boolean =>
          pid !== undefined && Number.isInteger(pid) && pid > 0 && processPort.isAlive(pid);
        for (let attempt = 0; attempt < 40 && childIsAlive(); attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(childIsAlive()).toBe(false);
      } finally {
        // Only a positive pid is ever signalled: a zero pid would address the
        // whole process group (which includes this test runner).
        if (pid !== undefined && Number.isInteger(pid) && pid > 0 && processPort.isAlive(pid)) {
          processPort.signal(pid, "SIGKILL");
        }
        harness.dispose();
      }
    },
    HARD_TIMEOUT_MS,
  );
});
