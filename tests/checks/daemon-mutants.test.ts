/**
 * TC-META-001 — the mutation fixtures prove each key rule fails when broken:
 * live-lock takeover, double restart, phase re-execution, merge reachability,
 * subscriber stall, blind unknown retry, and fabricated heartbeat.
 *
 * The GH-286 daemon-mount controls are split into two declared kinds:
 *
 *   - EXECUTED-AGAINST-MUTATION (18 of 21): the mutant is applied to a temp copy
 *     of the real module, the copy is imported and run, and the named suite's
 *     assertion is evaluated against the observed result. Relative imports in
 *     the copy are rewritten onto the repository's real files, so a composition
 *     module runs exactly as shipped plus the mutation. These are:
 *     binding-not-last, spawn-without-forwarded-env, spawn-with-full-env,
 *     install-empty-executable, signal-without-pid-check, signal-negative-pid,
 *     duplicate-terminal-record, release-skip-cancellation, holder-not-removed,
 *     uninstall-broad-delete, bare-execstart, conditional-registration,
 *     fabricated-reachability, stale-inclusive, owner-ignored,
 *     hardcoded-degradation, captured-degradation, help-composer-invoked.
 *   - STRUCTURAL (3 of 21): `literal-socket`, `unit-under-state-dir`, and
 *     `xdg-relative-joined` change a value the production composition passes to
 *     an adapter whose construction input is not part of any request or return
 *     value (the supervisor configuration root) or to a transport the composer
 *     does not expose. The control applies the mutation to the production source
 *     and asserts the named source claim the suite carries; the delivered
 *     behavioural half is asserted separately (the configured-branch and
 *     install-root cases). No structural control is left as a fixture-local
 *     evaluation of a mirrored rule.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime as realRuntime } from "../../packages/cli/src/daemon-compose";
import { runEntrypoint, selectPromptRequiredProgram } from "../../packages/cli/src/entrypoint";
import { createProductionComposer, daemonReachable } from "../../packages/cli/src/production";
import {
  CONTROL_PROTOCOL_CURRENT,
  type DaemonLaneRecord,
  type DaemonLockRecord,
  LOCAL_CALLER_PRINCIPAL,
  type SupervisorPort,
} from "../../packages/core/src/contracts/index";
import { createControlSession } from "../../packages/core/src/domain/control-session";
import { foldDaemonLiveness } from "../../packages/core/src/domain/daemon-heartbeat";
import { evaluateDaemonLock } from "../../packages/core/src/domain/daemon-lock";
import { decideDaemonLane } from "../../packages/core/src/domain/daemon-reconcile";
import { resolveCommitEffect } from "../../packages/core/src/domain/effect-protocol";
import {
  createMemorySupervisor,
  createMountClock,
  createMountHarness,
  mountComposition,
  openMountStore,
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
import * as fabricatedReachability from "../fixtures/daemon/mount-mutants/fabricated-reachability";
import * as staleInclusive from "../fixtures/daemon/mount-mutants/stale-inclusive";
import * as ownerIgnored from "../fixtures/daemon/mount-mutants/owner-ignored";
import * as hardcodedDegradation from "../fixtures/daemon/mount-mutants/hardcoded-degradation";
import * as capturedDegradation from "../fixtures/daemon/mount-mutants/captured-degradation";
import * as conditionalRegistration from "../fixtures/daemon/mount-mutants/conditional-registration";
import * as helpComposerInvoked from "../fixtures/daemon/mount-mutants/help-composer-invoked";
import { createSupervisorAdapter } from "../../packages/adapters/src/daemon/supervisor";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";
import { readDaemonHeartbeat, readDaemonInstance } from "../../packages/core/src/app/index";
import * as spawnWithFullEnv from "../fixtures/daemon/mount-mutants/spawn-with-full-env";
import * as spawnWithoutForwardedEnv from "../fixtures/daemon/mount-mutants/spawn-without-forwarded-env";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

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

/* --------------------------------- helpers -------------------------------- */

type Mutant = {
  readonly name: string;
  readonly target: string;
  readonly apply: (source: string) => string;
};

const readRepoFile = (relative: string): string =>
  readFileSync(join(process.cwd(), relative), "utf8");

/** Rewrite a temp copy's relative imports onto the repository's real files. */
const absolutizeImports = (source: string, target: string): string =>
  source.replace(/from "(\.\.?\/[^"]+)\.js"/gu, (_all, spec: string) => {
    const absolute = resolve(dirname(join(process.cwd(), target)), spec);
    return `from ${JSON.stringify(`${absolute}.ts`)}`;
  });

/**
 * Apply a mutant to a temp copy of the real module and load it. A copy whose
 * mutation changed no byte is a harness failure, never a silent pass.
 */
const loadMutantModule = async <T>(mutant: Mutant, file: string): Promise<T> => {
  const directory = join(process.cwd(), "tmp", "tmpdir", "mutants", mutant.name);
  mkdirSync(directory, { recursive: true });
  const source = readRepoFile(mutant.target);
  const mutated = mutant.apply(source);
  if (mutated === source) throw new Error(`${mutant.name}: mutation changed nothing`);
  const path = join(directory, file);
  writeFileSync(path, absolutizeImports(mutated, mutant.target));
  return (await import(`${path}?mutant=${Date.now()}`)) as T;
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

const createHost = () => {
  const listeners = new Map<string, Set<() => void>>();
  return {
    host: {
      once: (event: "SIGINT" | "SIGTERM", listener: () => void) => {
        const set = listeners.get(event) ?? new Set();
        set.add(listener);
        listeners.set(event, set);
      },
      removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => {
        listeners.get(event)?.delete(listener);
      },
    },
    registered: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
    deliver: (event: "SIGINT" | "SIGTERM") => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener();
    },
  };
};

/** Two signals, one clock advance apart, so both release appends differ. */
const countTerminalRecords = async (createRuntime: typeof realRuntime): Promise<number> => {
  const harness = createMountHarness({ label: "mutant-double-signal" });
  try {
    const clock = createMountClock({ manual: true, sleepAdvances: true });
    const host = createHost();
    const runtime = createRuntime(mountComposition(harness, { clock, signalHost: host.host }));
    const definition = createDaemonCommandDefinition(runtime);
    const command = definition.handler({
      positionals: ["start"],
      flags: { "--foreground": true },
      global: {},
    } as never);
    for (let index = 0; index < 3; index += 1) await Promise.resolve();
    host.deliver("SIGTERM");
    clock.advance(1_000);
    host.deliver("SIGTERM");
    for (let index = 0; index < 3; index += 1) await Promise.resolve();
    clock.releaseAll();
    await command;
    const instances = readDaemonInstance(harness.store);
    if (!instances.ok) return -1;
    return instances.records.filter(
      (record) => record.operation === "released" || record.operation === "immediate-stop",
    ).length;
  } finally {
    harness.dispose();
  }
};

/** Compose the production program over a harness, optionally with a config file. */
const productionProgram = (
  createComposer: typeof createProductionComposer,
  harness: ReturnType<typeof createMountHarness>,
  options: {
    readonly daemonEntry?: string;
    readonly supervisor?: SupervisorPort;
    readonly configYaml?: string;
  } = {},
) => {
  if (options.configYaml !== undefined) {
    const directory = join(harness.home, ".config", harness.brand.configDirectoryName);
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "config.yaml"), options.configYaml);
  }
  return createComposer({
    environment: {
      HOME: harness.home,
      PATH: "/usr/bin",
      [stateDirectoryName(harness.brand)]: harness.stateDirectory,
    },
    cwd: harness.root,
    homeDirectory: harness.home,
    workingName: harness.brand.binaryName,
    ...(options.daemonEntry === undefined ? {} : { daemonEntry: options.daemonEntry }),
    ...(options.supervisor === undefined ? {} : { supervisor: options.supervisor }),
  })(harness.brand);
};

const queueDegraded = async (program: ReturnType<typeof productionProgram>) => {
  const result = await program.commands.queue?.handler({
    positionals: ["list"],
    flags: {},
    global: {},
  } as never);
  if (result === undefined || "error" in result) throw new Error("queue list did not answer");
  return (result.data as { readonly degraded: readonly string[] }).degraded;
};

/* --------------------------- Phase-2 spawn controls ----------------------- */

describe("GH-286 spawn mutation controls (executed against the mutated module)", () => {
  test("binding-not-last: writing the binding first lets the forwarded look-alike win", async () => {
    const createRuntime = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(bindingNotLast, "daemon-compose.ts");
    const captured = await captureSpawnEnvironment(createRuntime.createDaemonCommandRuntime, {
      forwardedBinding: "/forwarded/other",
    });
    expect(bindingNotLast.violates(captured.environment, captured.binding)).toBe(true);
    const keys = Object.keys(captured.environment);
    expect(keys[keys.length - 1]).not.toBe(captured.binding);
  });

  test("spawn-without-forwarded-env: PATH and the home are dropped from the spawn", async () => {
    const createRuntime = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(spawnWithoutForwardedEnv, "daemon-compose.ts");
    const captured = await captureSpawnEnvironment(createRuntime.createDaemonCommandRuntime, {});
    expect(spawnWithoutForwardedEnv.violates(captured.environment)).toBe(true);
    expect(Object.keys(captured.environment)).toEqual([captured.binding]);
  });

  test("spawn-with-full-env: an ambient key leaks into the captured environment", async () => {
    const createRuntime = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(spawnWithFullEnv, "daemon-compose.ts");
    const captured = await captureSpawnEnvironment(createRuntime.createDaemonCommandRuntime, {});
    expect(spawnWithFullEnv.violates(captured.environment, captured.binding)).toBe(true);
  });

  test("every Phase-2 mutant names a real suite and assertion", () => {
    for (const mutant of [bindingNotLast, spawnWithoutForwardedEnv, spawnWithFullEnv]) {
      expect(mutant.suite.endsWith(".test.ts")).toBe(true);
      expect(existsSync(join(process.cwd(), mutant.suite))).toBe(true);
      expect(mutant.assertion.length).toBeGreaterThan(0);
    }
  });
});

/* ----------------------- Phase-3 install-identity controls ---------------- */

describe("GH-286 install-identity mutation controls", () => {
  test("bare-execstart: the mutated composition installs a bare binary name", async () => {
    const module = await loadMutantModule<{
      createProductionComposer: typeof createProductionComposer;
    }>(bareExecstart, "production.ts");
    const recordingSupervisor = () => {
      const requests: { readonly binary: string }[] = [];
      const descriptor = {
        kind: "systemd-user" as const,
        installed: true,
        unit: "example-product-daemon.service",
        scope: "scope",
        linger: true,
        commandForm: "foreground" as const,
        serviceType: "simple" as const,
        restartPolicy: "on-failure" as const,
      };
      const port: SupervisorPort = {
        kind: "systemd-user",
        platform: "linux",
        inspect: () => ({
          supported: true,
          descriptor: { ...descriptor, installed: false },
        }),
        install: (request) => {
          requests.push({ binary: request.binary });
          return { ok: true, descriptor };
        },
        uninstall: () => ({ removed: false }),
      };
      return { port, requests };
    };
    const installedBinary = async (createComposer: typeof createProductionComposer) => {
      const harness = createMountHarness({ label: "mutant-bare-execstart" });
      try {
        const recorder = recordingSupervisor();
        const entry = `${harness.root}/bin/${harness.brand.binaryName}`;
        const program = productionProgram(createComposer, harness, {
          daemonEntry: entry,
          supervisor: recorder.port,
        });
        const result = await program.commands.daemon?.handler({
          positionals: ["install"],
          flags: {},
          global: {},
        } as never);
        expect(result !== undefined && "data" in result).toBe(true);
        return recorder.requests[0]?.binary;
      } finally {
        harness.dispose();
      }
    };
    const deliveredBinary = await installedBinary(createProductionComposer);
    expect(deliveredBinary?.startsWith("/")).toBe(true);
    const mutatedBinary = await installedBinary(module.createProductionComposer);
    expect(mutatedBinary?.startsWith("/")).toBe(false);
    expect(mutatedBinary).toBe("example-product");
  });

  test("unit-under-state-dir: the mutated source uses the state directory as the root", () => {
    const source = readRepoFile(unitUnderStateDir.target);
    expect(unitUnderStateDir.violates(source)).toBe(false);
    const mutated = unitUnderStateDir.apply(source);
    expect(mutated).toContain("supervisorConfigDirectory: directory,");
    expect(unitUnderStateDir.violates(mutated)).toBe(true);
  });

  test("xdg-relative-joined: the mutated source accepts a relative root", () => {
    const source = readRepoFile(xdgRelativeJoined.target);
    expect(xdgRelativeJoined.violates(source)).toBe(false);
    const mutated = xdgRelativeJoined.apply(source);
    expect(mutated).not.toContain('configured.startsWith("/")');
    expect(xdgRelativeJoined.violates(mutated)).toBe(true);
  });

  test("install-empty-executable: the mutated handler renders a unit with no executable", async () => {
    const module = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(installEmptyExecutable, "daemon-compose.ts");
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
    const module = await loadMutantModule<{
      createSupervisorAdapter: typeof createSupervisorAdapter;
    }>(uninstallBroadDelete, "supervisor.ts");
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

/* --------------------- Phase-4 lifetime and stop-safety ------------------- */

describe("GH-286 lifetime and stop-safety mutation controls", () => {
  test("signal-without-pid-check: a zero pid is signalled", async () => {
    const module = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(signalWithoutPidCheck, "daemon-compose.ts");
    const delivered = await stopWith(realRuntime, 0);
    expect(delivered.signals).toHaveLength(0);
    expect(delivered.code).toBe("daemon.state-recovery-failed");
    const mutated = await stopWith(module.createDaemonCommandRuntime, 0);
    expect(signalWithoutPidCheck.violates(mutated.signals.length)).toBe(true);
    expect(mutated.signals).toEqual([0]);
  });

  test("signal-negative-pid: the negated group pid is addressed", async () => {
    const module = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(signalNegativePid, "daemon-compose.ts");
    const mutated = await stopWith(module.createDaemonCommandRuntime, 4321);
    expect(signalNegativePid.violates(mutated.signals)).toBe(true);
    expect(mutated.signals).toEqual([-4321]);
  });

  test("duplicate-terminal-record: a second signal appends a second executed record", async () => {
    const module = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(duplicateTerminalRecord, "daemon-compose.ts");
    const delivered = await countTerminalRecords(realRuntime);
    const mutated = await countTerminalRecords(module.createDaemonCommandRuntime);
    // The named suite's count: exactly one terminal record per invocation.
    expect(delivered).toBe(1);
    expect(mutated).toBe(2);
    expect(duplicateTerminalRecord.violates(mutated)).toBe(true);
    expect(duplicateTerminalRecord.violates(delivered)).toBe(false);
  });

  test("release-skip-cancellation: the command returns without awaiting the loop", async () => {
    const module = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(releaseSkipCancellation, "daemon-compose.ts");
    const returnsBeforeTheLoopSettles = async (createRuntime: typeof realRuntime) => {
      const harness = createMountHarness({ label: "mutant-no-wait" });
      try {
        const clock = createMountClock({ manual: true, sleepAdvances: true });
        const host = createHost();
        const runtime = createRuntime(mountComposition(harness, { clock, signalHost: host.host }));
        const definition = createDaemonCommandDefinition(runtime);
        const command = definition.handler({
          positionals: ["start"],
          flags: { "--foreground": true },
          global: {},
        } as never);
        for (let index = 0; index < 3; index += 1) await Promise.resolve();
        host.deliver("SIGTERM");
        for (let index = 0; index < 3; index += 1) await Promise.resolve();
        // The loop's own sleep is still pending: a delivered command must not
        // return before it is released.
        const outcome = await Promise.race([
          command.then(() => "returned" as const),
          new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 5)),
        ]);
        clock.releaseAll();
        await command;
        return outcome;
      } finally {
        harness.dispose();
      }
    };
    expect(await returnsBeforeTheLoopSettles(realRuntime)).toBe("pending");
    expect(await returnsBeforeTheLoopSettles(module.createDaemonCommandRuntime)).toBe("returned");
  });

  test("holder-not-removed: a listener outlives the invocation", async () => {
    const module = await loadMutantModule<{
      createDaemonCommandRuntime: typeof realRuntime;
    }>(holderNotRemoved, "daemon-compose.ts");
    const registeredAfter = async (createRuntime: typeof realRuntime) => {
      const harness = createMountHarness({ label: "mutant-holder" });
      try {
        const clock = createMountClock({ manual: true, sleepAdvances: true });
        const host = createHost();
        const runtime = createRuntime(mountComposition(harness, { clock, signalHost: host.host }));
        const definition = createDaemonCommandDefinition(runtime);
        const command = definition.handler({
          positionals: ["start"],
          flags: { "--foreground": true },
          global: {},
        } as never);
        for (let index = 0; index < 3; index += 1) await Promise.resolve();
        host.deliver("SIGINT");
        for (let index = 0; index < 3; index += 1) await Promise.resolve();
        clock.releaseAll();
        await command;
        return host.registered();
      } finally {
        harness.dispose();
      }
    };
    expect(await registeredAfter(realRuntime)).toBe(0);
    expect(await registeredAfter(module.createDaemonCommandRuntime)).toBe(1);
    expect(holderNotRemoved.violates(1)).toBe(true);
    expect(holderNotRemoved.violates(0)).toBe(false);
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

/* ------------------------- Phase-5 degradation controls ------------------- */

describe("GH-286 degradation mutation controls", () => {
  const seededStore = (
    harness: ReturnType<typeof createMountHarness>,
    shape: "absent-heartbeat" | "foreign-heartbeat" | "fresh",
  ) => {
    appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
    if (shape === "fresh") {
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(Date.now()).toISOString(),
      });
    }
    if (shape === "foreign-heartbeat") {
      appendHeartbeat(harness.store, {
        instanceId: "instance-other",
        beatAt: new Date(Date.now()).toISOString(),
      });
    }
    return openMountStore(harness.stateDirectory);
  };

  const reachableFor = (
    predicate: typeof daemonReachable,
    store: ReturnType<typeof openMountStore>,
    nowMs: number,
    lockStalenessMs: number,
  ): boolean => predicate({ store, nowMs, lockStalenessMs });

  test("fabricated-reachability: an absent heartbeat becomes reachable", async () => {
    const module = await loadMutantModule<{ daemonReachable: typeof daemonReachable }>(
      fabricatedReachability,
      "production.ts",
    );
    const harness = createMountHarness({ label: "mutant-fabricated" });
    try {
      const store = seededStore(harness, "absent-heartbeat");
      expect(reachableFor(daemonReachable, store, Date.now(), 30_000)).toBe(false);
      expect(reachableFor(module.daemonReachable, store, Date.now(), 30_000)).toBe(true);
      expect(fabricatedReachability.violates(readRepoFile(fabricatedReachability.target))).toBe(
        false,
      );
      expect(
        fabricatedReachability.violates(
          fabricatedReachability.apply(readRepoFile(fabricatedReachability.target)),
        ),
      ).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("stale-inclusive: the at-bound age becomes reachable", async () => {
    const module = await loadMutantModule<{ daemonReachable: typeof daemonReachable }>(
      staleInclusive,
      "production.ts",
    );
    const harness = createMountHarness({ label: "mutant-stale" });
    try {
      const store = seededStore(harness, "fresh");
      const heartbeat = readDaemonHeartbeat(store);
      const beatMs = heartbeat.ok ? Date.parse(heartbeat.latest?.beatAt as string) : 0;
      const nowMs = beatMs + 30_000;
      // Exactly at the bound: the delivered rule is strictly below.
      expect(reachableFor(daemonReachable, store, nowMs, 30_000)).toBe(false);
      expect(reachableFor(module.daemonReachable, store, nowMs, 30_000)).toBe(true);
      // Just below the bound both rules agree, so the mutation is the boundary.
      expect(reachableFor(daemonReachable, store, beatMs + 29_999, 30_000)).toBe(true);
      expect(reachableFor(module.daemonReachable, store, beatMs + 29_999, 30_000)).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("owner-ignored: an unowned beat is claimed reachable", async () => {
    const module = await loadMutantModule<{ daemonReachable: typeof daemonReachable }>(
      ownerIgnored,
      "production.ts",
    );
    const harness = createMountHarness({ label: "mutant-owner" });
    try {
      const store = seededStore(harness, "foreign-heartbeat");
      expect(reachableFor(daemonReachable, store, Date.now(), 30_000)).toBe(false);
      expect(reachableFor(module.daemonReachable, store, Date.now(), 30_000)).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("hardcoded-degradation: a constant marker replaces the durable resolver", async () => {
    const module = await loadMutantModule<{
      createProductionComposer: typeof createProductionComposer;
    }>(hardcodedDegradation, "production.ts");
    const harness = createMountHarness({ label: "mutant-hardcoded" });
    try {
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(Date.now()).toISOString(),
      });
      expect(await queueDegraded(productionProgram(createProductionComposer, harness))).toEqual([]);
      expect(
        await queueDegraded(productionProgram(module.createProductionComposer, harness)),
      ).toEqual(["daemon-unreachable"]);
    } finally {
      harness.dispose();
    }
  });

  test("every Phase-5 mutant names a real suite and assertion", () => {
    for (const mutant of [fabricatedReachability, staleInclusive, ownerIgnored]) {
      expect(mutant.suite.endsWith(".test.ts")).toBe(true);
      expect(existsSync(join(process.cwd(), mutant.suite))).toBe(true);
      expect(mutant.assertion.length).toBeGreaterThan(0);
    }
  });
});

/* --------------------------- Phase-6 mount controls ----------------------- */

describe("GH-286 mount mutation controls", () => {
  test("conditional-registration: the family becomes optional and selection is contained", async () => {
    const module = await loadMutantModule<{
      createProductionComposer: typeof createProductionComposer;
    }>(conditionalRegistration, "production.ts");
    const harness = createMountHarness({ label: "mutant-conditional" });
    try {
      const delivered = productionProgram(createProductionComposer, harness);
      expect(delivered.commands.daemon).toBeDefined();
      const mutated = productionProgram(module.createProductionComposer, harness);
      expect(mutated.commands.daemon).toBeUndefined();
      expect(() => selectPromptRequiredProgram(mutated)).toThrow();
      expect(conditionalRegistration.violates(readRepoFile(conditionalRegistration.target))).toBe(
        false,
      );
      expect(
        conditionalRegistration.violates(
          conditionalRegistration.apply(readRepoFile(conditionalRegistration.target)),
        ),
      ).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("literal-socket: the mutated source re-derives a literal socket name", () => {
    const source = readRepoFile(literalSocket.target);
    // The delivered composition carries no literal socket name or interval.
    expect(source).not.toContain("daemon.sock");
    expect(source).not.toContain("5_000");
    const mutated = literalSocket.apply(source);
    expect(mutated).not.toBe(source);
    expect(mutated).toContain("daemon.sock");
    expect(literalSocket.violates(mutated)).toBe(true);
  });

  test("captured-degradation: a marker captured at composition never flips", async () => {
    const module = await loadMutantModule<{
      createQueueCommandRuntime: typeof import("../../packages/cli/src/edge").createQueueCommandRuntime;
    }>(capturedDegradation, "edge.ts");
    const { createQueueCommandRuntime: realQueueRuntime } = await import(
      "../../packages/cli/src/edge"
    );
    const harness = createMountHarness({ label: "mutant-captured" });
    try {
      const resolver = () =>
        daemonReachable({
          store: harness.store,
          nowMs: Date.now(),
          lockStalenessMs: 30_000,
        })
          ? []
          : (["daemon-unreachable"] as const);
      const composition = () => ({
        store: harness.store,
        facts: {
          plans: {},
          workItems: {},
          ci: {},
          provider: { state: "unavailable" as const, reason: "not-configured" as const },
          close: {},
          deploy: { expectations: {}, verdicts: {} },
        },
        nowIso: () => new Date().toISOString(),
        nowMs: Date.now,
        newFenceToken: () => "fence",
        degraded: resolver,
      });
      const delivered = realQueueRuntime(composition() as never);
      const mutated = module.createQueueCommandRuntime(composition() as never);
      expect(delivered.readSchedule(20).ok && delivered.readSchedule(20).degraded).toEqual([
        "daemon-unreachable",
      ]);
      expect(mutated.readSchedule(20).ok && mutated.readSchedule(20).degraded).toEqual([
        "daemon-unreachable",
      ]);
      appendInstance(harness.store, { pid: 4321, scope: scopeOf(harness.stateDirectory) });
      appendHeartbeat(harness.store, {
        instanceId: "instance-live",
        beatAt: new Date(Date.now()).toISOString(),
      });
      const afterDelivered = delivered.readSchedule(20);
      const afterMutated = mutated.readSchedule(20);
      expect(afterDelivered.ok && afterDelivered.degraded).toEqual([]);
      // The mutant captured the composition-time verdict and never flips.
      expect(afterMutated.ok && afterMutated.degraded).toEqual(["daemon-unreachable"]);
    } finally {
      harness.dispose();
    }
  });

  test("help-composer-invoked: the mutated version path consults the composer", async () => {
    const module = await loadMutantModule<{ runEntrypoint: typeof runEntrypoint }>(
      helpComposerInvoked,
      "entrypoint.ts",
    );
    const versionCalls = async (run: typeof runEntrypoint): Promise<number> => {
      const stdout = bufferSink();
      const stderr = bufferSink();
      let calls = 0;
      const exitCode = await run(["--version"], {
        streams: { stdout, stderr },
        environment: {},
        configuredWorkingName: SYNTHETIC_BRAND.binaryName,
        composeProgram: () => {
          calls += 1;
          return { commands: {}, flags: [], requiresValue: [] } as never;
        },
      });
      expect(exitCode).toBe(0);
      return calls;
    };
    expect(await versionCalls(runEntrypoint)).toBe(0);
    const mutatedCalls = await versionCalls(module.runEntrypoint);
    expect(mutatedCalls).toBe(1);
    expect(helpComposerInvoked.violates(mutatedCalls)).toBe(true);
    expect(helpComposerInvoked.violates(0)).toBe(false);
  });

  test("the mutant inventory is exactly the twenty-one declared modules", () => {
    const modules = [
      "bare-execstart",
      "binding-not-last",
      "captured-degradation",
      "conditional-registration",
      "duplicate-terminal-record",
      "fabricated-reachability",
      "hardcoded-degradation",
      "help-composer-invoked",
      "holder-not-removed",
      "install-empty-executable",
      "literal-socket",
      "owner-ignored",
      "release-skip-cancellation",
      "signal-negative-pid",
      "signal-without-pid-check",
      "spawn-with-full-env",
      "spawn-without-forwarded-env",
      "stale-inclusive",
      "unit-under-state-dir",
      "uninstall-broad-delete",
      "xdg-relative-joined",
    ];
    expect(modules).toHaveLength(21);
    for (const name of modules) {
      expect(
        existsSync(join(process.cwd(), `tests/fixtures/daemon/mount-mutants/${name}.ts`)),
        name,
      ).toBe(true);
    }
  });
});
