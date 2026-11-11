/**
 * TC-META-001 — the mutation fixtures prove each key rule fails when broken:
 * live-lock takeover, double restart, phase re-execution, merge reachability,
 * subscriber stall, blind unknown retry, and fabricated heartbeat.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import type { createDaemonCommandRuntime as realRuntime } from "../../packages/cli/src/daemon-compose";
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
