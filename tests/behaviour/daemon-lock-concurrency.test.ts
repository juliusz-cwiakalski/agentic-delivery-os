/**
 * TC-LOCK-005 — 100 scheduled contenders at a staleness read barrier yield
 * exactly one live acquisition and 99 evidenced refusals.
 */
import { describe, expect, test } from "bun:test";
import { daemonScopeDigest, evaluateDaemonLock } from "../../packages/core/src/domain/index";
import type { DaemonLockRecord } from "../../packages/core/src/contracts/index";
import { createDaemonLockPort } from "../../packages/core/src/state/index";
import { createTestEdge, makeTempRoot, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";
const NOW_MS = Date.parse(NOW);
const STALENESS = 30_000;

const contender = (index: number, scope: string): DaemonLockRecord => ({
  lockToken: `token-${index}`,
  instanceId: `instance-${index}`,
  pid: 1000 + index,
  scope,
  acquiredAt: NOW,
  heartbeatAt: NOW,
});

describe("GH-238 daemon lock concurrency", () => {
  test("100 contenders released at one barrier acquire exactly once", () => {
    const root = makeTempRoot("gh238-lock-100");
    try {
      const edge = createTestEdge();
      edge.ensureDirectory(root);
      const port = createDaemonLockPort(edge, root);
      const scope = daemonScopeDigest(root);
      // The barrier: every contender reads the same absent/stale observation.
      const decisions = Array.from({ length: 100 }, () =>
        evaluateDaemonLock({ lock: port.read(), nowMs: NOW_MS, stalenessMs: STALENESS }),
      );
      expect(decisions.filter((decision) => decision.kind === "acquire")).toHaveLength(100);
      const outcomes = Array.from({ length: 100 }, (_, index) =>
        port.acquire(contender(index, scope)),
      );
      expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => !outcome.ok && outcome.code === "state.lock.busy"),
      ).toHaveLength(99);
      const held = port.read();
      expect(held.state).toBe("held");
    } finally {
      removeRoot(root);
    }
  });

  test("the successful holder can heartbeat; no other contender can", () => {
    const root = makeTempRoot("gh238-lock-holder");
    try {
      const edge = createTestEdge();
      edge.ensureDirectory(root);
      const port = createDaemonLockPort(edge, root);
      const scope = daemonScopeDigest(root);
      expect(port.acquire(contender(0, scope))).toEqual({ ok: true });
      expect(port.heartbeat("token-0", "2026-11-08T10:00:01Z")).toEqual({ ok: true });
      for (let index = 1; index < 100; index += 1) {
        expect(port.heartbeat(`token-${index}`, NOW)).toMatchObject({ ok: false });
      }
    } finally {
      removeRoot(root);
    }
  });
});
