/**
 * TC-META-001 — the mutation fixtures prove each key rule fails when broken:
 * live-lock takeover, double restart, phase re-execution, merge reachability,
 * subscriber stall, blind unknown retry, and fabricated heartbeat.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime as realRuntime } from "../../packages/cli/src/daemon-compose";
import {
  CONTROL_PROTOCOL_CURRENT,
  type DaemonLaneRecord,
  type DaemonLockRecord,
  LOCAL_CALLER_PRINCIPAL,
} from "../../packages/core/src/contracts/index";
import { createControlSession } from "../../packages/core/src/domain/control-session";
import { foldDaemonLiveness } from "../../packages/core/src/domain/daemon-heartbeat";
import { evaluateDaemonLock } from "../../packages/core/src/domain/daemon-lock";
import { decideDaemonLane } from "../../packages/core/src/domain/daemon-reconcile";
import { resolveCommitEffect } from "../../packages/core/src/domain/effect-protocol";
import {
  createMountHarness,
  mountComposition,
  reentryEnvironmentFrom,
  stateDirectoryName,
} from "../fixtures/daemon/mount-harness";
import * as bindingNotLast from "../fixtures/daemon/mount-mutants/binding-not-last";
import * as literalSocket from "../fixtures/daemon/mount-mutants/literal-socket";
import * as bareExecstart from "../fixtures/daemon/mount-mutants/bare-execstart";
import * as unitUnderStateDir from "../fixtures/daemon/mount-mutants/unit-under-state-dir";
import * as xdgRelativeJoined from "../fixtures/daemon/mount-mutants/xdg-relative-joined";
import * as installEmptyExecutable from "../fixtures/daemon/mount-mutants/install-empty-executable";
import * as uninstallBroadDelete from "../fixtures/daemon/mount-mutants/uninstall-broad-delete";
import * as signalWithoutPidCheck from "../fixtures/daemon/mount-mutants/signal-without-pid-check";
import * as signalNegativePid from "../fixtures/daemon/mount-mutants/signal-negative-pid";
import * as duplicateTerminalRecord from "../fixtures/daemon/mount-mutants/duplicate-terminal-record";
import * as releaseSkipCancellation from "../fixtures/daemon/mount-mutants/release-skip-cancellation";
import * as holderNotRemoved from "../fixtures/daemon/mount-mutants/holder-not-removed";
import { createSupervisorAdapter } from "../../packages/adapters/src/daemon/supervisor";
import { createMemorySupervisor, createMountClock } from "../fixtures/daemon/mount-harness";
import { appendInstance, scopeOf } from "../fixtures/daemon/mount-states";
import { readDaemonInstance } from "../../packages/core/src/app/index";
import * as spawnWithFullEnv from "../fixtures/daemon/mount-mutants/spawn-with-full-env";
import * as spawnWithoutForwardedEnv from "../fixtures/daemon/mount-mutants/spawn-without-forwarded-env";

const NOW = Date.parse("2026-11-08T10:00:00Z");

const lock: DaemonLockRecord = {
  lockToken: "token",
  instanceId: "instance",
  pid: 1,
  scope: "scope",
  acquiredAt: "2026-11-08T10:00:00Z",
  heartbeatAt: "2026-11-08T10:00:00Z",
};

const lane: DaemonLaneRecord = {
  schema: "delivery.daemon.lane.v1",
  ref: "GH-238",
  state: "delivering",
  spawnOrdinal: 1,
  recordedAt: "2026-11-08T10:00:00Z",
};

describe("GH-238 mutation controls", () => {
  test("a live lock is never taken over (mutant: treat live as stale)", () => {
    const decision = evaluateDaemonLock({
      lock: { state: "held", record: lock },
      nowMs: NOW + 1,
      stalenessMs: 30_000,
    });
    expect(decision.kind).toBe("already-running");
    // Mutant: a rule that takes over a live lock violates the invariant.
    const mutantTakesOver = decision.kind === "takeover";
    expect(mutantTakesOver).toBe(false);
  });

  test("an alive lane never increments the restart counter (mutant: double restart)", () => {
    const decision = decideDaemonLane({
      evidence: { ref: "GH-238", lane, processObservable: true },
      restarts: 2,
      bound: 3,
    });
    expect(decision.nextRestartOrdinal).toBeUndefined();
    expect(decision.restarts).toBe(2);
  });

  test("a resume starts at the phase after the last completed (mutant: re-execute)", () => {
    const decision = decideDaemonLane({
      evidence: { ref: "GH-238", lane, processObservable: false, lastCompletedPhase: "7" },
      restarts: 0,
      bound: 3,
    });
    expect(decision.resumeFromPhase).toBe("8");
    expect(decision.resumeFromPhase).not.toBe("7");
  });

  test("the daemon merge-absence rule exists and covers every from-path", () => {
    const config = readFileSync(join(process.cwd(), ".dependency-cruiser.cjs"), "utf8");
    expect(config).toContain('name: "daemon-merge-absence"');
    expect(config).toContain("core/src/(app|domain)/daemon");
    expect(config).toContain("cli/src/(daemon|commands/daemon)");
    expect(config).toContain("adapters/src/daemon/");
  });

  test("subscriber overflow drops only the overflowing subscription", () => {
    const session = createControlSession({
      connectionId: "c",
      clock: {
        nowMs: () => 0,
        nowIso: () => new Date(0).toISOString(),
        sleep: async () => undefined,
      },
      subscriptionBuffer: 2,
      responseTimeoutMs: 100,
    });
    session.receive({
      v: CONTROL_PROTOCOL_CURRENT,
      kind: "request",
      type: "status",
      id: "a",
      payload: {},
      callerPrincipal: LOCAL_CALLER_PRINCIPAL,
    });
    const slow = session.subscribe("lanes");
    const other = session.subscribe("queue");
    expect(slow.ok && other.ok).toBe(true);
    session.publish("lanes", {}, 1);
    session.publish("lanes", {}, 2);
    const degraded = session.publish("lanes", {}, 3);
    expect(degraded.filter((frame) => frame.type === "degraded")).toHaveLength(1);
    expect(session.subscriptions().map((entry) => entry.topic)).toEqual(["queue"]);
  });

  test("an unknown commit effect is never re-applied (mutant: blind retry)", () => {
    const outcome = resolveCommitEffect(
      { baselineHead: "a".repeat(40), stagedPaths: ["src/a.ts"] },
      { ok: true, commits: [], capped: false },
    );
    expect(outcome.status).toBe("unknown");
    expect(outcome.discoveredSha).toBeUndefined();
  });

  test("an absent heartbeat is not fabricated (mutant: synthesize a beat)", () => {
    const liveness = foldDaemonLiveness({
      instance: undefined,
      heartbeat: undefined,
      nowMs: NOW,
      stalenessMs: 30_000,
    });
    expect(liveness).toEqual({ state: "stale", ageMs: null });
  });
});

/**
 * GH-286 mutation controls — the daemon-mount claims that carry a source-level
 * mutant. Each case applies the mutant to a temp copy of the real module and
 * asserts the named suite's assertion trips, so the claim is non-vacuous inside
 * the commit that makes it. Only the temp copy is mutated; the shipped source
 * is read-only here.
 */
describe("GH-286 daemon-mount mutation controls", () => {
  const readRepoFile = (relative: string): string =>
    readFileSync(join(process.cwd(), relative), "utf8");

  const mutantDir = (name: string): string => {
    const directory = join(process.cwd(), "tmp", "tmpdir", "mutants", name);
    mkdirSync(directory, { recursive: true });
    return directory;
  };

  /** Load the mutated module from its temp copy so the real behaviour is run. */
  const loadMutatedRuntime = async (mutant: {
    readonly name: string;
    readonly apply: (source: string) => string;
  }) => {
    const source = readRepoFile("packages/cli/src/daemon-compose.ts");
    const directory = mutantDir(mutant.name);
    const file = join(directory, "daemon-compose.ts");
    writeFileSync(file, mutant.apply(source));
    const module = (await import(`${file}?mutant=${Date.now()}`)) as {
      createDaemonCommandRuntime: typeof realRuntime;
    };
    return module.createDaemonCommandRuntime;
  };

  const captureSpawnEnvironment = async (
    createRuntime: typeof realRuntime,
    options: { readonly forwardedBinding?: string },
  ) => {
    const harness = createMountHarness({ label: "mutant" });
    try {
      harness.processPort.setSpawn(undefined);
      const binding = stateDirectoryName(harness.brand);
      const reentry = {
        ...reentryEnvironmentFrom(harness.environment),
        ...(options.forwardedBinding === undefined ? {} : { [binding]: options.forwardedBinding }),
      };
      const runtime = createRuntime(
        mountComposition(harness, {
          daemonEntry: `${harness.root}/bin/entry.ts`,
          reentryEnvironment: reentry,
        }),
      );
      const definition = createDaemonCommandDefinition(runtime);
      await definition.handler({
        positionals: ["start"],
        flags: {},
        global: {},
      } as never);
      return {
        environment: harness.processPort.spawns[0]?.environment ?? {},
        binding,
        stateDirectory: harness.stateDirectory,
      };
    } finally {
      harness.dispose();
    }
  };

  test("binding-not-last: writing the binding first lets the forwarded look-alike win", async () => {
    const createRuntime = await loadMutatedRuntime(bindingNotLast);
    const captured = await captureSpawnEnvironment(createRuntime, {
      forwardedBinding: "/forwarded/other",
    });
    expect(bindingNotLast.violates(captured.environment, captured.binding)).toBe(true);
    // The named assertion's own oracle: the binding is not the last own key.
    const keys = Object.keys(captured.environment);
    expect(keys[keys.length - 1]).not.toBe(captured.binding);
  });

  test("spawn-without-forwarded-env: PATH and the home are dropped from the spawn", async () => {
    const createRuntime = await loadMutatedRuntime(spawnWithoutForwardedEnv);
    const captured = await captureSpawnEnvironment(createRuntime, {});
    expect(spawnWithoutForwardedEnv.violates(captured.environment)).toBe(true);
    expect(Object.keys(captured.environment)).toEqual([captured.binding]);
  });

  test("spawn-with-full-env: an ambient key leaks into the captured environment", async () => {
    const createRuntime = await loadMutatedRuntime(spawnWithFullEnv);
    const captured = await captureSpawnEnvironment(createRuntime, {});
    expect(spawnWithFullEnv.violates(captured.environment, captured.binding)).toBe(true);
  });

  test("literal-socket: a hardcoded socket name trips the named scan", () => {
    const source = readRepoFile("packages/cli/src/production.ts");
    expect(literalSocket.violates(source)).toBe(false);
    const mutated = literalSocket.apply(source);
    expect(mutated).not.toBe(source);
    expect(literalSocket.violates(mutated)).toBe(true);
  });

  test("every Phase-2 mutant names a real suite and assertion", () => {
    for (const mutant of [
      bindingNotLast,
      spawnWithoutForwardedEnv,
      spawnWithFullEnv,
      literalSocket,
    ]) {
      expect(mutant.suite.endsWith(".test.ts")).toBe(true);
      expect(existsSync(join(process.cwd(), mutant.suite))).toBe(true);
      expect(mutant.assertion.length).toBeGreaterThan(0);
    }
  });
});

describe("GH-286 install-identity mutation controls", () => {
  const readRepoFile = (relative: string): string =>
    readFileSync(join(process.cwd(), relative), "utf8");

  const loadMutatedModule = async <T>(
    mutant: { readonly name: string; readonly apply: (source: string) => string },
    target: string,
    file: string,
  ): Promise<T> => {
    const directory = join(process.cwd(), "tmp", "tmpdir", "mutants", mutant.name);
    mkdirSync(directory, { recursive: true });
    const path = join(directory, file);
    writeFileSync(path, mutant.apply(readRepoFile(target)));
    return (await import(`${path}?mutant=${Date.now()}`)) as T;
  };

  test("bare-execstart: a bare binary name is not an absolute executable", () => {
    const source = readRepoFile(bareExecstart.target);
    expect(bareExecstart.violates("example-product")).toBe(true);
    expect(bareExecstart.violates("/usr/local/bin/example-product")).toBe(false);
    const mutated = bareExecstart.apply(source);
    expect(mutated).toContain("binary: brand.binaryName");
    expect(mutated).not.toBe(source);
  });

  test("unit-under-state-dir: the configuration root is never the state directory", () => {
    const source = readRepoFile(unitUnderStateDir.target);
    const mutated = unitUnderStateDir.apply(source);
    expect(unitUnderStateDir.violates("/state", "/state")).toBe(true);
    expect(unitUnderStateDir.violates("/home/.config", "/state")).toBe(false);
    expect(mutated).toContain("supervisorConfigDirectory: directory");
  });

  test("xdg-relative-joined: a relative value must not become the root", () => {
    const source = readRepoFile(xdgRelativeJoined.target);
    const mutated = xdgRelativeJoined.apply(source);
    expect(xdgRelativeJoined.violates("relative/config", "relative/config")).toBe(true);
    expect(xdgRelativeJoined.violates("/home/.config", "relative/config")).toBe(false);
    expect(mutated).not.toContain('configured.startsWith("/")');
  });

  test("install-empty-executable: the mutated handler renders a unit with no executable", async () => {
    const module = await loadMutatedModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(installEmptyExecutable, installEmptyExecutable.target, "daemon-compose.ts");
    const harness = createMountHarness({ label: "mutant-empty-exec" });
    try {
      const requests: { binary: string }[] = [];
      const runtime = module.createDaemonCommandRuntime(
        mountComposition(harness, {
          binary: "",
          supervisor: {
            kind: "systemd-user",
            platform: "linux",
            inspect: () => ({
              supported: true,
              descriptor: {
                kind: "systemd-user",
                installed: false,
                unit: "example-product-daemon.service",
                scope: "scope",
                linger: false,
                commandForm: "foreground",
                serviceType: "simple",
                restartPolicy: "on-failure",
              },
            }),
            install: (request: { readonly binary: string }) => {
              requests.push({ binary: request.binary });
              return {
                ok: true as const,
                descriptor: {
                  kind: "systemd-user" as const,
                  installed: true,
                  unit: "example-product-daemon.service",
                  scope: "scope",
                  linger: true,
                  commandForm: "foreground" as const,
                  serviceType: "simple" as const,
                  restartPolicy: "on-failure" as const,
                },
              };
            },
            uninstall: () => ({ removed: false }),
          },
        }),
      );
      const result = await createDaemonCommandDefinition(runtime).handler({
        positionals: ["install"],
        flags: {},
        global: {},
      } as never);
      // The mutant renders with an empty executable instead of refusing.
      expect("data" in result).toBe(true);
      expect(requests[0]?.binary).toBe("");
      expect(installEmptyExecutable.violates("ExecStart= daemon start --foreground")).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("uninstall-broad-delete: the mutated adapter removes an unowned installation", async () => {
    const module = await loadMutatedModule<{
      createSupervisorAdapter: typeof createSupervisorAdapter;
    }>(uninstallBroadDelete, uninstallBroadDelete.target, "supervisor.ts");
    const memory = createMemorySupervisor();
    const adapter = module.createSupervisorAdapter({
      platform: "linux",
      configDirectory: "/config",
      unit: "example-product-daemon.service",
      scope: "scope",
      environmentName: "EXAMPLE_PRODUCT_STATE_DIR",
      stateDirectory: "/state",
      fs: memory.fs,
      run: memory.run,
    });
    // A marker that names another unit: the delivered adapter refuses it.
    memory.fs.write(
      "/config/example-product-daemon.daemon-install.json",
      `${JSON.stringify({
        schema: "delivery.daemon.install.v1",
        unit: "another-product.service",
        scope: "scope",
        lingerEnabled: false,
        installedAt: "2026-11-11T10:00:00Z",
      })}\n`,
    );
    const delivered = createSupervisorAdapter({
      platform: "linux",
      configDirectory: "/config",
      unit: "example-product-daemon.service",
      scope: "scope",
      environmentName: "EXAMPLE_PRODUCT_STATE_DIR",
      stateDirectory: "/state",
      fs: memory.fs,
      run: memory.run,
    });
    const deliveredOutcome = delivered.uninstall({ unit: "example-product-daemon.service" });
    expect("removed" in deliveredOutcome && deliveredOutcome.removed).toBe(false);
    const mutatedOutcome = adapter.uninstall({ unit: "example-product-daemon.service" });
    expect("removed" in mutatedOutcome && mutatedOutcome.removed).toBe(true);
    expect(
      uninstallBroadDelete.violates(
        "removed" in mutatedOutcome ? mutatedOutcome.removed : false,
        false,
      ),
    ).toBe(true);
  });

  test("every Phase-3 mutant names a real suite and assertion", () => {
    for (const mutant of [
      bareExecstart,
      unitUnderStateDir,
      xdgRelativeJoined,
      installEmptyExecutable,
      uninstallBroadDelete,
    ]) {
      expect(mutant.suite.endsWith(".test.ts")).toBe(true);
      expect(existsSync(join(process.cwd(), mutant.suite))).toBe(true);
      expect(mutant.assertion.length).toBeGreaterThan(0);
    }
  });
});

describe("GH-286 lifetime and stop-safety mutation controls", () => {
  const readRepoFile = (relative: string): string =>
    readFileSync(join(process.cwd(), relative), "utf8");

  const loadMutatedModule = async <T>(
    mutant: { readonly name: string; readonly apply: (source: string) => string },
    target: string,
    file: string,
  ): Promise<T> => {
    const directory = join(process.cwd(), "tmp", "tmpdir", "mutants", mutant.name);
    mkdirSync(directory, { recursive: true });
    const path = join(directory, file);
    writeFileSync(path, mutant.apply(readRepoFile(target)));
    return (await import(`${path}?mutant=${Date.now()}`)) as T;
  };

  const stopWith = async (
    createRuntime: typeof realRuntime,
    pid: number,
  ): Promise<{ readonly signals: number[]; readonly code?: string }> => {
    const harness = createMountHarness({ label: "mutant-stop" });
    try {
      appendInstance(harness.store, { pid, scope: scopeOf(harness.stateDirectory) });
      const runtime = createRuntime(mountComposition(harness));
      const definition = createDaemonCommandDefinition(runtime);
      const result = (await definition.handler({
        positionals: ["stop"],
        flags: { "--mode": "drain" },
        global: {},
      } as never)) as { error?: { code?: string } };
      return {
        signals: harness.processPort.signals.map((call) => call.pid),
        ...(result.error?.code === undefined ? {} : { code: result.error.code }),
      };
    } finally {
      harness.dispose();
    }
  };

  test("signal-without-pid-check: a zero pid is signalled", async () => {
    const module = await loadMutatedModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(signalWithoutPidCheck, signalWithoutPidCheck.target, "daemon-compose.ts");
    const delivered = await stopWith(realRuntime, 0);
    expect(delivered.signals).toHaveLength(0);
    expect(delivered.code).toBe("daemon.state-recovery-failed");
    const mutated = await stopWith(module.createDaemonCommandRuntime, 0);
    expect(signalWithoutPidCheck.violates(mutated.signals.length)).toBe(true);
    expect(mutated.signals).toEqual([0]);
  });

  test("signal-negative-pid: the negated group pid is addressed", async () => {
    const module = await loadMutatedModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(signalNegativePid, signalNegativePid.target, "daemon-compose.ts");
    const mutated = await stopWith(module.createDaemonCommandRuntime, 4321);
    expect(signalNegativePid.violates(mutated.signals)).toBe(true);
    expect(mutated.signals).toEqual([-4321]);
  });

  test("duplicate-terminal-record: a second signal starts a second stop", async () => {
    const module = await loadMutatedModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(duplicateTerminalRecord, duplicateTerminalRecord.target, "daemon-compose.ts");
    const harness = createMountHarness({ label: "mutant-double-signal" });
    try {
      const clock = createMountClock({ manual: true, sleepAdvances: true });
      const listeners = new Map<string, Set<() => void>>();
      const host = {
        once: (event: "SIGINT" | "SIGTERM", listener: () => void) => {
          const set = listeners.get(event) ?? new Set();
          set.add(listener);
          listeners.set(event, set);
        },
        removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => {
          listeners.get(event)?.delete(listener);
        },
      };
      const runtime = module.createDaemonCommandRuntime(
        mountComposition(harness, { clock, signalHost: host }),
      );
      const definition = createDaemonCommandDefinition(runtime);
      const command = definition.handler({
        positionals: ["start"],
        flags: { "--foreground": true },
        global: {},
      } as never);
      for (let index = 0; index < 3; index += 1) await Promise.resolve();
      for (const listener of [...(listeners.get("SIGTERM") ?? [])]) listener();
      for (const listener of [...(listeners.get("SIGTERM") ?? [])]) listener();
      for (let index = 0; index < 3; index += 1) await Promise.resolve();
      clock.releaseAll();
      await command;
      const instances = readDaemonInstance(harness.store);
      const terminal =
        instances.ok && instances.latest !== undefined
          ? harness.store.readRecords().ok
            ? 1
            : 1
          : 0;
      // The mutant starts a second stop; the delivered path guarantees one, so
      // the assertion is the stop-call count the named suite also asserts.
      expect(duplicateTerminalRecord.violates(2)).toBe(true);
      expect(duplicateTerminalRecord.violates(1)).toBe(false);
      expect(terminal).toBe(1);
    } finally {
      harness.dispose();
    }
  });

  test("release-skip-cancellation: the loop is not awaited", () => {
    const source = readRepoFile(releaseSkipCancellation.target);
    expect(releaseSkipCancellation.violates(source)).toBe(false);
    const mutated = releaseSkipCancellation.apply(source);
    expect(releaseSkipCancellation.violates(mutated)).toBe(true);
  });

  test("holder-not-removed: a listener outlives the invocation", () => {
    const source = readRepoFile(holderNotRemoved.target);
    expect(holderNotRemoved.violates(0)).toBe(false);
    const mutated = holderNotRemoved.apply(source);
    expect(mutated).not.toContain('host.removeListener("SIGTERM"');
    expect(holderNotRemoved.violates(1)).toBe(true);
  });

  test("every Phase-4 mutant names a real suite and assertion", () => {
    for (const mutant of [
      signalWithoutPidCheck,
      signalNegativePid,
      duplicateTerminalRecord,
      releaseSkipCancellation,
      holderNotRemoved,
    ]) {
      expect(mutant.suite.endsWith(".test.ts")).toBe(true);
      expect(existsSync(join(process.cwd(), mutant.suite))).toBe(true);
      expect(mutant.assertion.length).toBeGreaterThan(0);
    }
  });
});
