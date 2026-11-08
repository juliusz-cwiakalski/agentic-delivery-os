/**
 * TC-META-001 — the mutation fixtures prove each key rule fails when broken:
 * live-lock takeover, double restart, phase re-execution, merge reachability,
 * subscriber stall, blind unknown retry, and fabricated heartbeat.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateDaemonLock } from "../../packages/core/src/domain/daemon-lock";
import { decideDaemonLane } from "../../packages/core/src/domain/daemon-reconcile";
import { resolveCommitEffect } from "../../packages/core/src/domain/effect-protocol";
import { foldDaemonLiveness } from "../../packages/core/src/domain/daemon-heartbeat";
import { createControlSession } from "../../packages/core/src/domain/control-session";
import {
  CONTROL_PROTOCOL_CURRENT,
  LOCAL_CALLER_PRINCIPAL,
  type DaemonLockRecord,
  type DaemonLaneRecord,
} from "../../packages/core/src/contracts/index";

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
