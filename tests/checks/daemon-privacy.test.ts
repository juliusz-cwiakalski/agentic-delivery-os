/**
 * TC-DAEMON-123 — no new output carries sensitive content, and the only new
 * environment value is an absolute directory path.
 *
 * Canaries are planted in the content-bearing facts of every mounted path; the
 * spawn environment, the unit text, and every envelope are then inspected for
 * them. The lock token is asserted absent from every rendered surface.
 */
import { describe, expect, test } from "bun:test";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { daemonScopeDigest } from "../../packages/core/src/domain/daemon-lock";
import { renderSystemdUnit } from "../../packages/core/src/domain/daemon-supervisor";
import { createSupervisorAdapter } from "../../packages/adapters/src/daemon/supervisor";
import { readDaemonHeartbeat, readDaemonInstance } from "../../packages/core/src/app/index";
import {
  createMemorySupervisor,
  createMountHarness,
  mountComposition,
  reentryEnvironmentFrom,
  stateDirectoryName,
} from "../fixtures/daemon/mount-harness";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";

const CANARIES = [
  "CANARY-CREDENTIAL-9f3a",
  "CANARY-PROMPT-2b7c",
  "CANARY-TRANSCRIPT-4d1e",
  "CANARY-DIFF-7a6f",
] as const;

const LOCK_TOKEN_CANARY = "CANARY-LOCK-TOKEN-5c2d";

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

const assertClean = (text: string, where: string): void => {
  for (const canary of CANARIES) {
    expect(text.includes(canary), `${where} leaked ${canary}`).toBe(false);
  }
  expect(text.includes(LOCK_TOKEN_CANARY), `${where} leaked the lock token`).toBe(false);
};

describe("TC-DAEMON-123 privacy of the mounted paths", () => {
  test("no mounted path renders a credential, prompt, transcript, diff, or lock token", async () => {
    const harness = createMountHarness({ label: "privacy-123" });
    try {
      // Canaries planted in the facts a path could echo.
      const environment = {
        ...harness.environment,
        GITHUB_TOKEN: CANARIES[0],
        DELIVERY_OS_PROMPT: CANARIES[1],
        DELIVERY_OS_TRANSCRIPT: CANARIES[2],
      };
      harness.processPort.setSpawn(4321);
      const memory = createMemorySupervisor();
      const adapter = createSupervisorAdapter({
        platform: "linux",
        configDirectory: `${harness.root}/config`,
        unit: `${harness.brand.binaryName}-daemon.service`,
        scope: daemonScopeDigest(harness.stateDirectory),
        environmentName: stateDirectoryName(harness.brand),
        stateDirectory: harness.stateDirectory,
        fs: memory.fs,
        run: memory.run,
      });
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          reentryEnvironment: reentryEnvironmentFrom(environment),
          supervisor: adapter,
          pid: 4242,
        }),
      );

      // Every mounted path, its human rendering, and its envelope.
      const definition = createDaemonCommandDefinition(runtime);
      const outputs: string[] = [];
      for (const argv of [
        ["start"],
        ["stop"],
        ["stop", "--mode", "drain"],
        ["status"],
        ["status", "--live"],
        ["install"],
        ["uninstall"],
      ] as const) {
        const result = await invoke(runtime, argv as readonly string[]);
        outputs.push(JSON.stringify(result));
        if (!("error" in result)) {
          outputs.push(definition.humanText?.(result.data) ?? "");
        }
      }
      for (const [index, output] of outputs.entries()) assertClean(output, `output ${index}`);

      // The spawn environment is exactly the declared set: no credential, no
      // canary, no ambient key, and one absolute directory binding.
      const spawn = harness.processPort.spawns[0];
      const keys = Object.keys(spawn?.environment ?? {});
      const binding = stateDirectoryName(harness.brand);
      expect(keys.sort()).toEqual(["HOME", "PATH", binding].sort());
      assertClean(JSON.stringify(spawn?.environment ?? {}), "spawn environment");
      expect(spawn?.environment[binding]?.startsWith("/")).toBe(true);

      // The unit text carries the absolute entry path and the resolved binding only.
      const unitText = renderSystemdUnit({
        binary: `${harness.root}/bin/entry.ts`,
        stateDirectory: harness.stateDirectory,
        environmentName: binding,
        unit: `${harness.brand.binaryName}-daemon.service`,
      });
      assertClean(unitText, "unit");
      expect(unitText.split("\n").filter((line) => line.startsWith("Environment="))).toHaveLength(
        1,
      );

      // Records carry identities, paths, counts, durations, pids, and closed
      // vocabulary values only.
      const instance = readDaemonInstance(harness.store);
      const heartbeat = readDaemonHeartbeat(harness.store);
      assertClean(JSON.stringify(instance), "instance records");
      assertClean(JSON.stringify(heartbeat), "heartbeat records");
    } finally {
      harness.dispose();
    }
  });

  test("a record carrying the lock token never renders it", async () => {
    const harness = createMountHarness({ label: "privacy-123b" });
    try {
      appendInstance(harness.store, {
        pid: 4321,
        scope: scopeOf(harness.stateDirectory),
        lockToken: LOCK_TOKEN_CANARY,
      });
      appendHeartbeat(harness.store, { instanceId: "instance-live" });
      const runtime = createDaemonCommandRuntime(mountComposition(harness));
      const status = await invoke(runtime, ["status"]);
      assertClean(JSON.stringify(status), "status envelope");
      const stop = await invoke(runtime, ["stop"]);
      assertClean(JSON.stringify(stop), "stop envelope");
    } finally {
      harness.dispose();
    }
  });
});
