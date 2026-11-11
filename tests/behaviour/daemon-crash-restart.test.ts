/**
 * The post-crash restart family (the post-crash takeover cell of the extended
 * TC-DAEMON-030; GH-286 NF-1 contract conformance).
 *
 * A killed daemon leaves `daemon.lock` and its acquisition record behind. The
 * staleness evaluation stays the only liveness decision; once it classifies the
 * leftover lock as stale, the next start removes exactly the record it observed
 * (a compare-and-delete keyed on `lockToken`) and appends a `taken-over`
 * instance naming the dead holder. The hermetic cases reproduce the durable
 * residue of a crash over the composed command runtime with the recording
 * process port and the injected clock; the last case performs the actual
 * SIGKILL of a real `#!/usr/bin/env bun` child, is bounded, and reaps every
 * root in `finally`. No case invokes `runEntrypoint` (the selection surface is
 * TC-DAEMON-015's) and no case writes outside its temp root.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createNodeClock, createNodeProcessPort } from "../../packages/adapters/src/daemon/index";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { readDaemonInstance } from "../../packages/core/src/app/index";
import type { DaemonLockPort } from "../../packages/core/src/contracts/index";
import {
  createMountHarness,
  mountComposition,
  reentryEnvironmentFrom,
  stateDirectoryName,
} from "../fixtures/daemon/mount-harness";

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

const isFailure = (value: unknown): value is { error: { code: string; summary?: string } } =>
  typeof value === "object" && value !== null && "error" in value;

const isSuccess = (value: unknown): value is { data: Record<string, unknown> } =>
  typeof value === "object" && value !== null && "data" in value;

type Harness = ReturnType<typeof createMountHarness>;

/**
 * Production mints a fresh token per use (a UUID). The fixture's default keeps
 * one counter per composition, so a second composition would replay the same
 * `instance-*`/`lock-*` names; this counter is shared across compositions so a
 * restarted process never reuses the crash victim's identity.
 */
let tokenOrdinal = 0;
const freshTokens = (): Record<string, () => string> => {
  const next = (prefix: string) => () => {
    tokenOrdinal += 1;
    return `${prefix}-${tokenOrdinal}`;
  };
  return {
    newFenceToken: next("fence"),
    newLockToken: next("lock"),
    newInstanceId: next("instance"),
  };
};

/** One in-process start over the harness seams, with the composing pid injected. */
const startInProcess = async (harness: Harness, pid: number) =>
  invoke(createDaemonCommandRuntime(mountComposition(harness, { pid, ...freshTokens() })), [
    "start",
  ]);

/**
 * A racing lock port: the first `read` returns the record the caller observed
 * BEFORE the race, so both contenders classify the same proved-dead lock and
 * then meet at the real exclusive create. Every removal outcome is recorded, so
 * the case can show that a refused compare-and-delete never deleted the fresh
 * winner's lock.
 */
const createRacingLockPort = (
  inner: DaemonLockPort,
): {
  readonly port: DaemonLockPort;
  readonly removals: readonly { readonly ok: boolean; readonly code?: string }[];
} => {
  const observed = inner.read();
  const removals: { readonly ok: boolean; readonly code?: string }[] = [];
  let first = true;
  return {
    port: {
      read: () => {
        if (first) {
          first = false;
          return observed;
        }
        return inner.read();
      },
      acquire: inner.acquire,
      heartbeat: inner.heartbeat,
      remove: (lockToken) => {
        const outcome = inner.remove(lockToken);
        removals.push(outcome.ok ? { ok: true } : { ok: false, code: outcome.code });
        return outcome;
      },
    },
    removals,
  };
};

const lockFiles = (directory: string): readonly string[] =>
  readdirSync(directory).filter((name) => name === "daemon.lock");

describe("TC-DAEMON-030 a crashed daemon is restartable once the lock is proved dead", () => {
  test("after the staleness bound the next start acquires taken-over and names the dead holder", async () => {
    const harness = createMountHarness({ label: "crash-030" });
    try {
      const victim = await startInProcess(harness, 111);
      expect(isSuccess(victim)).toBe(true);
      const dead = readDaemonInstance(harness.store);
      expect(dead.ok).toBe(true);
      if (!dead.ok || dead.latest === undefined) return;
      expect(dead.latest.operation).toBe("acquired");
      const deadLock = harness.lock.read();
      expect(deadLock.state).toBe("held");
      if (deadLock.state !== "held") return;

      // The crash: nothing releases and nothing appends a terminal record — the
      // SIGKILL residue is exactly the lock plus the `acquired` instance. Only
      // elapsed time changes, and it crosses the bound.
      harness.clock.advance(harness.settings.lockStalenessMs + 1);

      const restarted = await startInProcess(harness, 222);
      expect(isFailure(restarted)).toBe(false);
      if (!isSuccess(restarted)) return;

      const reaped = readDaemonInstance(harness.store);
      expect(reaped.ok).toBe(true);
      if (!reaped.ok || reaped.latest === undefined) return;
      const latest = reaped.latest;
      expect(latest.operation).toBe("taken-over");
      expect(latest.instanceId).not.toBe(dead.latest.instanceId);
      expect(latest.pid).toBe(222);
      // The evidence names the instance and the token the evaluation proved dead.
      expect(latest.takeover?.previousInstanceId).toBe(dead.latest.instanceId);
      expect(latest.takeover?.previousLockToken).toBe(deadLock.record.lockToken);
      expect(latest.takeover?.lastHeartbeatAt).toBe(deadLock.record.heartbeatAt);
      expect(latest.takeover?.heartbeatAgeMs).toBe(harness.settings.lockStalenessMs + 1);
      expect(latest.takeover?.takenOverAt).toBe(harness.clock.nowIso());

      // Exactly one lock record, owned by the new holder.
      const held = harness.lock.read();
      expect(held.state).toBe("held");
      if (held.state === "held") expect(held.record.lockToken).toBe(latest.lockToken);
      expect(lockFiles(harness.stateDirectory)).toEqual(["daemon.lock"]);
      // Two instance records: the crash victim and the one takeover.
      expect(reaped.records.map((record) => record.operation)).toEqual(["acquired", "taken-over"]);

      // The receipt names the new holder, never the crash victim.
      const receipt = restarted.data as { instance: { instanceId: string; pid: number } };
      expect(receipt.instance.pid).toBe(222);
      expect(receipt.instance.instanceId).toBe(latest.instanceId);
      expect(JSON.stringify(receipt)).not.toContain(`"pid":111`);
    } finally {
      harness.dispose();
    }
  });

  test("inside the bound the same sequence still refuses daemon.already-running and appends nothing", async () => {
    const harness = createMountHarness({ label: "crash-030-bound" });
    try {
      const victim = await startInProcess(harness, 111);
      expect(isSuccess(victim)).toBe(true);
      const dead = readDaemonInstance(harness.store);
      expect(dead.ok).toBe(true);
      if (!dead.ok || dead.latest === undefined) return;
      const deadLock = harness.lock.read();
      expect(deadLock.state).toBe("held");
      if (deadLock.state !== "held") return;

      harness.clock.advance(harness.settings.lockStalenessMs - 1);

      const refused = await startInProcess(harness, 222);
      expect(isFailure(refused)).toBe(true);
      if (!isFailure(refused)) return;
      expect(refused.error.code).toBe("daemon.already-running");
      // The delivered refusal names the holder, its process, and the heartbeat age.
      expect(refused.error.summary ?? "").toContain(`instance=${dead.latest.instanceId}`);
      expect(refused.error.summary ?? "").toContain("pid=111");
      expect(refused.error.summary ?? "").toContain(
        `heartbeat_age_ms=${harness.settings.lockStalenessMs - 1}`,
      );

      // Zero appends and the dead lock left in place: the refusal deleted nothing.
      const after = readDaemonInstance(harness.store);
      expect(after.ok).toBe(true);
      if (after.ok) {
        expect(after.records).toHaveLength(dead.records.length);
        expect(after.latest?.instanceId).toBe(dead.latest.instanceId);
      }
      const stillHeld = harness.lock.read();
      expect(stillHeld.state).toBe("held");
      if (stillHeld.state === "held") {
        expect(stillHeld.record.lockToken).toBe(deadLock.record.lockToken);
      }
      expect(lockFiles(harness.stateDirectory)).toEqual(["daemon.lock"]);
    } finally {
      harness.dispose();
    }
  });

  test("two concurrent starters against one proved-dead lock admit exactly one winner", async () => {
    const harness = createMountHarness({ label: "crash-030-race" });
    try {
      const victim = await startInProcess(harness, 111);
      expect(isSuccess(victim)).toBe(true);
      const dead = readDaemonInstance(harness.store);
      expect(dead.ok).toBe(true);
      if (!dead.ok || dead.latest === undefined) return;
      const deadLock = harness.lock.read();
      expect(deadLock.state).toBe("held");
      if (deadLock.state !== "held") return;
      harness.clock.advance(harness.settings.lockStalenessMs + 1);

      // Both contenders observe the same proved-dead record, then race the one
      // real exclusive create.
      const left = createRacingLockPort(harness.lock);
      const right = createRacingLockPort(harness.lock);
      const leftRuntime = createDaemonCommandRuntime(
        mountComposition(harness, { lock: left.port, pid: 222, ...freshTokens() }),
      );
      const rightRuntime = createDaemonCommandRuntime(
        mountComposition(harness, { lock: right.port, pid: 333, ...freshTokens() }),
      );
      const outcomes = await Promise.all([
        invoke(leftRuntime, ["start"]),
        invoke(rightRuntime, ["start"]),
      ]);

      const winners = outcomes.filter((outcome) => isSuccess(outcome));
      const losers = outcomes.filter((outcome) => isFailure(outcome));
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      const loser = losers[0];
      if (loser !== undefined && isFailure(loser)) {
        expect(loser.error.code).toBe("daemon.already-running");
        // The loser's removal was refused (the winner's token differs) and its
        // exclusive create answered the delivered busy mapping: the summary is
        // the lock path, never a fabricated refusal.
        expect(loser.error.summary ?? "").toContain("daemon.lock");
      }

      // Exactly one new acquisition beside the victim, and the winner's lock intact.
      const after = readDaemonInstance(harness.store);
      expect(after.ok).toBe(true);
      if (!after.ok || after.latest === undefined) return;
      expect(after.records).toHaveLength(2);
      expect(after.latest.operation).toBe("taken-over");
      expect([222, 333]).toContain(after.latest.pid);
      const held = harness.lock.read();
      expect(held.state).toBe("held");
      if (held.state === "held") expect(held.record.lockToken).toBe(after.latest.lockToken);

      // One compare-and-delete succeeded; the other was refused with the
      // delivered busy identity, so a fresh lock was never removed.
      const removals = [...left.removals, ...right.removals];
      expect(removals.filter((removal) => removal.ok)).toHaveLength(1);
      expect(
        removals.filter((removal) => !removal.ok && removal.code === "state.lock.busy"),
      ).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });
});

/**
 * The real child: the composed runtime over the real process port, the real
 * clock, and the real state directory the spawn environment binds. It starts,
 * runs the resident loop, and releases only on a delivered signal — the crash
 * case kills it before any of that.
 */
const childScript = (repoRoot: string, bindingName: string): string => `#!/usr/bin/env bun
import { createDaemonCommandRuntime } from ${JSON.stringify(`${repoRoot}/packages/cli/src/daemon-compose.ts`)};
import {
  createDaemonLockPort,
  createNodeStateEdge,
  createStateStore,
} from ${JSON.stringify(`${repoRoot}/packages/core/src/state/index.ts`)};
import { resolveDaemonSettings } from ${JSON.stringify(`${repoRoot}/packages/core/src/config/index.ts`)};
import { STATE_SCHEMA_VERSION } from ${JSON.stringify(`${repoRoot}/packages/core/src/contracts/index.ts`)};

const binding = ${JSON.stringify(bindingName)};
const stateDirectory = process.env[binding] ?? "";
const settings = resolveDaemonSettings(
  { daemon: { "lock-staleness": 1500 } },
  {},
  { stateDirectory },
);
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
const runtime = createDaemonCommandRuntime({
  store,
  lock: createDaemonLockPort(createNodeStateEdge(), stateDirectory),
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
});
const started = await runtime.start({ foreground: true });
if ("error" in started) process.exit(2);
const running = runtime.loop?.() ?? Promise.resolve();
const mode = await new Promise((resolve) => {
  process.once("SIGTERM", () => resolve("drain"));
  process.once("SIGINT", () => resolve("immediate"));
});
await runtime.stop({ mode });
await running;
process.exit(0);
`;

describe("TC-DAEMON-030 post-crash takeover with one real killed child", () => {
  test("a SIGKILLed foreground daemon is restarted by the next start as taken-over", async () => {
    const repoRoot = process.cwd();
    const harness = createMountHarness({
      label: "crash-real",
      // The short configured bound keeps the real wait at 1.5 s, not 30 s.
      values: { daemon: { "lock-staleness": 1500 } },
    });
    const processPort = createNodeProcessPort();
    const live: number[] = [];
    try {
      expect(harness.settings.lockStalenessMs).toBe(1500);
      const bunDirectory = dirname(process.execPath);
      const entry = join(harness.stateDirectory, "entry.ts");
      mkdirSync(harness.stateDirectory, { recursive: true, mode: 0o700 });
      writeFileSync(entry, childScript(repoRoot, stateDirectoryName(harness.brand)));
      chmodSync(entry, 0o755);
      const environment = {
        ...harness.environment,
        PATH: `${bunDirectory}:/usr/bin:/bin`,
        HOME: harness.home,
      };
      const runtimeFor = () =>
        createDaemonCommandRuntime(
          mountComposition(harness, {
            daemonEntry: entry,
            processPort,
            clock: createNodeClock(),
            settings: harness.settings,
            reentryEnvironment: reentryEnvironmentFrom(environment),
          }),
        );

      const first = await invoke(runtimeFor(), ["start"]);
      expect(isFailure(first)).toBe(false);
      if (!isSuccess(first)) return;
      const victimPid = (first.data as { instance: { pid: number } }).instance.pid;
      expect(Number.isInteger(victimPid) && victimPid > 0).toBe(true);
      live.push(victimPid);
      const victim = readDaemonInstance(harness.store);
      expect(victim.ok).toBe(true);
      if (!victim.ok || victim.latest === undefined) return;
      const victimLock = harness.lock.read();
      expect(victimLock.state).toBe("held");
      if (victimLock.state !== "held") return;

      // The real crash: SIGKILL leaves the lock and the acquisition in place.
      expect(processPort.signal(victimPid, "SIGKILL").ok).toBe(true);
      for (let attempt = 0; attempt < 40 && processPort.isAlive(victimPid); attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(processPort.isAlive(victimPid)).toBe(false);
      // Bounded wait past the configured bound, so the leftover lock is stale.
      await new Promise((resolve) => setTimeout(resolve, 1700));

      const second = await invoke(runtimeFor(), ["start"]);
      expect(isFailure(second)).toBe(false);
      if (!isSuccess(second)) return;
      const successor = (second.data as { instance: { pid: number; instanceId: string } }).instance;
      expect(successor.pid).not.toBe(victimPid);
      live.push(successor.pid);

      const reaped = readDaemonInstance(harness.store);
      expect(reaped.ok).toBe(true);
      if (!reaped.ok || reaped.latest === undefined) return;
      expect(reaped.latest.operation).toBe("taken-over");
      expect(reaped.latest.instanceId).toBe(successor.instanceId);
      expect(reaped.latest.takeover?.previousInstanceId).toBe(victim.latest.instanceId);
      expect(reaped.latest.takeover?.previousLockToken).toBe(victimLock.record.lockToken);
      expect(reaped.latest.takeover?.heartbeatAgeMs).toBeGreaterThanOrEqual(1500);
      expect(lockFiles(harness.stateDirectory)).toEqual(["daemon.lock"]);
      const held = harness.lock.read();
      expect(held.state).toBe("held");
      if (held.state === "held") expect(held.record.lockToken).toBe(reaped.latest.lockToken);
    } finally {
      // Only a positive pid is ever signalled; every root is reaped.
      for (const pid of live) {
        if (Number.isInteger(pid) && pid > 0 && processPort.isAlive(pid)) {
          processPort.signal(pid, "SIGKILL");
        }
      }
      harness.dispose();
    }
  }, 30_000);
});
