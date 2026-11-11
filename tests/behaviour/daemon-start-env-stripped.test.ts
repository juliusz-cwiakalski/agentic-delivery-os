/**
 * TC-DAEMON-041 — the stripped-environment residual, split into its two
 * distinct outcomes.
 *
 * Fixtures (a) and (c) are directly composed runtimes over a recording process
 * port (the spawn request and the poll count are `DaemonComposition` inputs).
 * Fixture (b) uses the production composer, because the assertion is the
 * composer's own three-outcome classification and no spawn is expected. Every
 * step invokes a composed command handler directly; no step goes through
 * `runEntrypoint` and none asserts selection or `fallback.internal`.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { createProductionComposer } from "../../packages/cli/src/production";
import { readDaemonHeartbeat, readDaemonInstance } from "../../packages/core/src/app/index";
import type { ControlTransport } from "../../packages/core/src/contracts/index";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import {
  createMountHarness,
  listDirectory,
  mountBrand,
  mountComposition,
  reentryEnvironmentFrom,
  removeMountRoot,
  stateDirectoryName,
} from "../fixtures/daemon/mount-harness";
import {
  forbiddenConstructions,
  refusingRuntimeSpan,
} from "../fixtures/daemon/mount-mutants/source-scan";

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

const failureOf = (value: unknown) =>
  value as { error: { code: string; kind: string; summary?: string } } | { data: unknown };

const isFailure = (value: unknown): value is { error: { code: string; kind: string } } =>
  typeof value === "object" && value !== null && "error" in value;

/** A counting lock that records every acquire/read and never touches the root. */
const countingLock = (inner: ReturnType<typeof createMountHarness>["lock"]) => {
  const counters = { acquires: 0, reads: 0, heartbeats: 0 };
  return {
    counters,
    lock: {
      ...inner,
      acquire: (request: Parameters<typeof inner.acquire>[0]) => {
        counters.acquires += 1;
        return inner.acquire(request);
      },
      read: () => {
        counters.reads += 1;
        return inner.read();
      },
      heartbeat: (token: string, at: string) => {
        counters.heartbeats += 1;
        return inner.heartbeat(token, at);
      },
    } as typeof inner,
  };
};

/** A transport that records connects and always refuses. */
const countingTransport = () => {
  const counters = { connects: 0, listens: 0 };
  const transport: ControlTransport = {
    listen: async () => {
      counters.listens += 1;
      throw { code: "daemon.socket-unreachable" } as never;
    },
    connect: async () => {
      counters.connects += 1;
      throw { code: "daemon.socket-unreachable" } as never;
    },
  };
  return { counters, transport };
};

describe("TC-DAEMON-041 fixture (a): stripped PATH with a home", () => {
  test("the spawn is attempted without inventing a PATH and fails closed at exit 2", async () => {
    const harness = createMountHarness({
      label: "stripped-a",
      environment: { PATH: undefined },
    });
    try {
      const { lock, counters } = countingLock(harness.lock);
      const { transport } = countingTransport();
      harness.processPort.setSpawn(4321);
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          reentryEnvironment: reentryEnvironmentFrom(harness.environment),
          lock,
          transport,
        }),
      );
      const before = {
        instances: (readDaemonInstance(harness.store) as { latest?: unknown }).latest,
        heartbeats: (readDaemonHeartbeat(harness.store) as { latest?: unknown }).latest,
      };
      const result = await invoke(runtime, ["start"]);
      expect(harness.processPort.spawns).toHaveLength(1);
      const spawn = harness.processPort.spawns[0];
      const keys = Object.keys(spawn?.environment ?? {});
      expect(keys).not.toContain("PATH");
      expect(spawn?.environment.HOME).toBe(harness.home);
      expect(keys[keys.length - 1]).toBe(stateDirectoryName(harness.brand));
      expect(spawn?.environment[stateDirectoryName(harness.brand)]).toBe(harness.stateDirectory);

      expect(isFailure(result)).toBe(true);
      const failure = failureOf(result) as { error: { code: string; summary?: string } };
      expect(failure.error.code).toBe("daemon.state-recovery-failed");
      expect(failure.error.summary ?? "").toContain("readiness");
      expect("data" in (result as object)).toBe(false);
      expect(harness.clock.sleeps()).toHaveLength(20);
      expect(harness.clock.sleeps()).not.toContain(51);

      // Nothing was acquired, appended, or held.
      const after = {
        instances: (readDaemonInstance(harness.store) as { latest?: unknown }).latest,
        heartbeats: (readDaemonHeartbeat(harness.store) as { latest?: unknown }).latest,
      };
      expect(after).toEqual(before);
      expect(counters.acquires).toBe(0);
    } finally {
      harness.dispose();
    }
  });

  test("the control: a restored PATH and home reaches a durable acquired instance", async () => {
    const harness = createMountHarness({ label: "stripped-control" });
    try {
      const runtime = createDaemonCommandRuntime(mountComposition(harness));
      const result = await invoke(runtime, ["start"]);
      expect(isFailure(result)).toBe(false);
      const durable = readDaemonInstance(harness.store);
      expect(durable.ok).toBe(true);
      if (durable.ok) expect(durable.latest?.operation).toBe("acquired");
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-041 fixture (c): stripped PATH with no home and an absolute override", () => {
  test("the override wins, no PATH is invented, and the start fails closed at exit 2", async () => {
    const harness = createMountHarness({
      label: "stripped-c",
      override: "absolute",
      environment: { PATH: undefined, HOME: undefined },
    });
    try {
      const { transport } = countingTransport();
      harness.processPort.setSpawn(4321);
      const runtime = createDaemonCommandRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          reentryEnvironment: reentryEnvironmentFrom(harness.environment),
          transport,
        }),
      );
      const result = await invoke(runtime, ["start"]);
      expect(harness.processPort.spawns).toHaveLength(1);
      const spawn = harness.processPort.spawns[0];
      const keys = Object.keys(spawn?.environment ?? {});
      expect(keys).not.toContain("PATH");
      expect(keys[keys.length - 1]).toBe(stateDirectoryName(harness.brand));
      expect(spawn?.environment[stateDirectoryName(harness.brand)]).toBe(harness.stateDirectory);
      expect(isFailure(result)).toBe(true);
      const failure = failureOf(result) as { error: { code: string } };
      expect(failure.error.code).toBe("daemon.state-recovery-failed");
      const durable = readDaemonInstance(harness.store);
      expect(durable.ok && durable.latest === undefined).toBe(true);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-DAEMON-041 fixture (b): no home and no override", () => {
  test("the family stays mounted over the unavailable runtime and refuses at exit 1", async () => {
    const brand = mountBrand();
    const root = join(process.cwd(), "tmp", `gh286-stripped-b-${brand.stateDirectoryName}`);
    const rootLevel = `/${brand.stateDirectoryName}`;
    const existedBefore = existsSync(rootLevel);
    try {
      const composer = createProductionComposer({
        environment: {},
        cwd: root,
        homeDirectory: "",
        workingName: brand.binaryName,
        daemonEntry: `/abs/${brand.binaryName}`,
      });
      const program = composer(brand);
      expect(program.commands.daemon).toBeDefined();
      const definition = program.commands.daemon;
      if (definition === undefined) throw new Error("daemon is not registered");

      for (const argv of [["start"], ["start", "--foreground"]]) {
        const [subcommand, ...rest] = argv as readonly string[];
        const flags: Record<string, string | boolean> = {};
        for (const token of rest) flags[token] = true;
        const result = await definition.handler({
          positionals: [subcommand as string],
          flags,
          global: {},
        } as never);
        expect(isFailure(result)).toBe(true);
        const failure = failureOf(result) as { error: { code: string; kind: string } };
        expect(failure.error.code).toBe("config.value.invalid");
        const row = ERROR_TABLE.find((entry) => entry.code === "config.value.invalid");
        expect(row?.projectionClass).toBe("user-validation");
        expect(row?.consequence).toBe("not_landed");
        const exitCode = row?.projectionClass === "user-validation" ? 1 : -1;
        expect(exitCode).toBe(1);
        expect("data" in (result as object)).toBe(false);
      }

      // The refusal is the state-directory identity, never a `daemon.*` row.
      const refusal = await definition.handler({
        positionals: ["status"],
        flags: {},
        global: {},
      } as never);
      const code = (failureOf(refusal) as { error: { code: string } }).error.code;
      expect(code).toBe("config.value.invalid");
      expect(code.startsWith("daemon.")).toBe(false);

      // The source boundary constructs none of the composition's inputs.
      const span = refusingRuntimeSpan(
        readFileSync(join(process.cwd(), "packages/cli/src/production.ts"), "utf8"),
      );
      expect(span).toBeDefined();
      expect(forbiddenConstructions(span as string)).toEqual([]);

      // Filesystem and socket absence.
      expect(existsSync(rootLevel)).toBe(existedBefore);
      expect(existsSync(`${rootLevel}/daemon.sock`)).toBe(false);
      expect(listDirectory(root)).toEqual([]);
    } finally {
      if (existsSync(root) && listDirectory(root).length === 0) removeMountRoot(root);
    }
  });
});
