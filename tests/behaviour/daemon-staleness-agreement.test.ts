/**
 * The DM-4 staleness agreement matrix (AC-F5-6; GH-286 NF-4).
 *
 * The reachability rule has three production copies — `liveHolder`
 * (`packages/cli/src/daemon-compose.ts`, module-local and observed here through
 * the composed start handler), `daemonReachable` (`packages/cli/src/production.ts`),
 * and `evaluateDaemonLock` (`packages/core/src/domain/daemon-lock.ts`) — and no
 * predicate is merged by this suite. It asserts they agree over the boundary
 * matrix with injected `nowMs` and `lockStalenessMs`, so a drift between the
 * pre-spawn refusal and the queue/lanes marker cannot regress silently.
 *
 * Deliberately excluded (the declared divergence, header and AC-F5-8): a cell
 * where the lock and the instance describe DIFFERENT holders — an absent lock
 * beside a live owned instance, a fresh lock beside an absent instance, and an
 * unowned or foreign-owner heartbeat. There `daemonReachable` degrades and
 * `liveHolder` returns no evidence while `evaluateDaemonLock` still reads the
 * lock, so the refusal moves to the engine's exclusive-create busy path. Every
 * cell below has one holder, or nothing at all.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { createDaemonCommandDefinition } from "../../packages/cli/src/commands/daemon";
import { createDaemonCommandRuntime } from "../../packages/cli/src/daemon-compose";
import { daemonReachable } from "../../packages/cli/src/production";
import { evaluateDaemonLock } from "../../packages/core/src/domain/daemon-lock";
import {
  createMountHarness,
  mountComposition,
  type MountHarness,
} from "../fixtures/daemon/mount-harness";
import { appendHeartbeat, appendInstance, scopeOf } from "../fixtures/daemon/mount-states";

/** The harness clock's start instant, shared by all three evaluations. */
const NOW = "2026-11-11T10:00:00Z";
const NOW_MS = Date.parse(NOW);
const BOUND = 30_000;

const invoke = async (
  runtime: ReturnType<typeof createDaemonCommandRuntime>,
  argv: readonly string[],
) => {
  const definition = createDaemonCommandDefinition(runtime);
  const [subcommand, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = subcommand === undefined ? [] : [subcommand];
  for (const token of rest) flags[token] = true;
  return definition.handler({ positionals, flags, global: {} } as never);
};

const isFailure = (value: unknown): value is { error: { code: string; summary?: string } } =>
  typeof value === "object" && value !== null && "error" in value;

const isSuccess = (value: unknown): value is { data: Record<string, unknown> } =>
  typeof value === "object" && value !== null && "data" in value;

type Owner = { readonly lockToken: string; readonly instanceId: string; readonly pid: number };

const OWNER: Owner = { lockToken: "lock-agree", instanceId: "instance-agree", pid: 111 };

const at = (offsetMs: number): string => new Date(NOW_MS - offsetMs).toISOString();

/** Arrange one holder whose lock and instance carry the same heartbeat age. */
const arrangeOwner = (harness: MountHarness, ageMs: number): void => {
  const beatAt = at(ageMs);
  const acquired = harness.lock.acquire({
    lockToken: OWNER.lockToken,
    instanceId: OWNER.instanceId,
    pid: OWNER.pid,
    scope: scopeOf(harness.stateDirectory),
    acquiredAt: beatAt,
    heartbeatAt: beatAt,
  });
  if (!acquired.ok) throw new Error(`lock fixture did not acquire: ${acquired.code}`);
  appendInstance(harness.store, {
    instanceId: OWNER.instanceId,
    pid: OWNER.pid,
    scope: scopeOf(harness.stateDirectory),
    acquiredAt: beatAt,
    heartbeatAt: beatAt,
    recordedAt: beatAt,
  });
  appendHeartbeat(harness.store, { instanceId: OWNER.instanceId, beatAt });
};

type Agreement = {
  readonly reachable: boolean;
  readonly lockKind: ReturnType<typeof evaluateDaemonLock>["kind"];
  readonly heartbeatAgeMs?: number;
  /** The composed start handler's verdict: refused live, or a spawn attempt. */
  readonly start: "refused-live" | "spawned" | "state-recovery-failed";
  readonly spawns: number;
  readonly summary?: string;
};

/** Evaluate the three production copies at one instant over one harness. */
const agree = async (
  harness: MountHarness,
  options: { readonly detached?: boolean } = {},
): Promise<Agreement> => {
  const decision = evaluateDaemonLock({
    lock: harness.lock.read(),
    nowMs: NOW_MS,
    stalenessMs: BOUND,
  });
  const reachable = daemonReachable({
    store: harness.store,
    nowMs: NOW_MS,
    lockStalenessMs: BOUND,
  });
  // A spawn attempt with no spawnable child stops at the spawn, so the handler
  // verdict is observable without a readiness poll.
  harness.processPort.setSpawn(undefined);
  const runtime = createDaemonCommandRuntime(
    mountComposition(
      harness,
      options.detached === true ? { daemonEntry: `${harness.root}/bin/entry.ts` } : {},
    ),
  );
  const result = await invoke(runtime, ["start"]);
  const spawns = harness.processPort.spawns.length;
  const start =
    spawns > 0
      ? "spawned"
      : isFailure(result) && result.error.code === "daemon.already-running"
        ? "refused-live"
        : "state-recovery-failed";
  return {
    reachable,
    lockKind: decision.kind,
    ...(decision.kind === "already-running" ? { heartbeatAgeMs: decision.heartbeatAgeMs } : {}),
    start,
    spawns,
    ...(isFailure(result) && result.error.summary !== undefined
      ? { summary: result.error.summary }
      : {}),
  };
};

describe("TC-DAEMON-030 the three staleness evaluations agree over the boundary matrix", () => {
  test("one millisecond below the bound is live for all three", async () => {
    const harness = createMountHarness({ label: "agree-below" });
    try {
      arrangeOwner(harness, BOUND - 1);
      const agreement = await agree(harness, { detached: true });
      expect(agreement.reachable).toBe(true);
      expect(agreement.lockKind).toBe("already-running");
      expect(agreement.start).toBe("refused-live");
      expect(agreement.spawns).toBe(0);
      expect(agreement.heartbeatAgeMs).toBe(BOUND - 1);
    } finally {
      harness.dispose();
    }
  });

  test("exactly at the bound is stale for all three (the STRICT rule)", async () => {
    const harness = createMountHarness({ label: "agree-at" });
    try {
      arrangeOwner(harness, BOUND);
      const agreement = await agree(harness, { detached: true });
      expect(agreement.reachable).toBe(false);
      expect(agreement.lockKind).toBe("takeover");
      expect(agreement.start).toBe("spawned");
      expect(agreement.spawns).toBe(1);
    } finally {
      harness.dispose();
    }
  });

  test("one millisecond above the bound is stale for all three", async () => {
    const harness = createMountHarness({ label: "agree-above" });
    try {
      arrangeOwner(harness, BOUND + 1);
      const agreement = await agree(harness, { detached: true });
      expect(agreement.reachable).toBe(false);
      expect(agreement.lockKind).toBe("takeover");
      expect(agreement.start).toBe("spawned");
      expect(agreement.spawns).toBe(1);
    } finally {
      harness.dispose();
    }
  });

  test("an absent lock and an absent instance are not live for any of the three", async () => {
    const harness = createMountHarness({ label: "agree-absent" });
    try {
      const agreement = await agree(harness, { detached: true });
      expect(agreement.reachable).toBe(false);
      expect(agreement.lockKind).toBe("acquire");
      expect(agreement.start).toBe("spawned");
      expect(agreement.spawns).toBe(1);
    } finally {
      harness.dispose();
    }
  });

  test("a negative age is live everywhere and the clamp changes the reported age only", async () => {
    const harness = createMountHarness({ label: "agree-negative" });
    try {
      // The heartbeat is timestamped 5 s in the future.
      arrangeOwner(harness, -5_000);
      const agreement = await agree(harness, { detached: true });
      expect(agreement.reachable).toBe(true);
      expect(agreement.lockKind).toBe("already-running");
      expect(agreement.start).toBe("refused-live");
      expect(agreement.spawns).toBe(0);
      // `evaluateDaemonLock` clamps with `Math.max(0, ...)`; the composed
      // refusal reports the raw negative age. The classification is identical.
      expect(agreement.heartbeatAgeMs).toBe(0);
      expect(agreement.summary ?? "").toContain("heartbeat_age_ms=-5000");
    } finally {
      harness.dispose();
    }
  });

  test("a torn lock read is unreadable, degrades reachability, and fabricates nothing", async () => {
    const harness = createMountHarness({ label: "agree-torn" });
    try {
      const lockPath = `${harness.stateDirectory}/daemon.lock`;
      mkdirSync(harness.stateDirectory, { recursive: true, mode: 0o700 });
      writeFileSync(lockPath, "{not-a-lock-record");
      chmodSync(lockPath, 0o600);
      const torn = harness.lock.read();
      expect(torn.state).toBe("unreadable");
      if (torn.state === "unreadable") expect(torn.code).toBe("state.store.torn");
      const agreement = await agree(harness);
      expect(agreement.reachable).toBe(false);
      expect(agreement.lockKind).toBe("unreadable");
      expect(agreement.start).toBe("state-recovery-failed");
      expect(agreement.spawns).toBe(0);
      expect(agreement.summary).toBe(lockPath);
    } finally {
      harness.dispose();
    }
  });
});
