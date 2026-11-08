/**
 * TC-PREEMPT-001..005 — pending/live-session preemption, boundary apply,
 * restart survival, immediate no-session release, and single-flight.
 */
import { describe, expect, test } from "bun:test";
import {
  applyPreemption,
  readDaemonPreemptions,
  reevaluatePendingPreemptions,
} from "../../packages/core/src/app/index";
import { decidePreemption } from "../../packages/core/src/domain/daemon-preemption";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";

const input = (overrides: Partial<Parameters<typeof decidePreemption>[0]> = {}) => ({
  ref: "GH-238",
  repository: "github.com/owner/repo",
  closeRef: "GH-999",
  holder: "lane-holder",
  hasActiveSession: false,
  requestedAt: NOW,
  ...overrides,
});

const isolation = () => {
  const root = makeTempRoot("gh238-preempt");
  const { store } = openStore(makeIdentity(root));
  return { root, store };
};

describe("GH-238 preemption", () => {
  test("an active session records pending and never signals", () => {
    const { root, store } = isolation();
    try {
      let released = 0;
      const result = applyPreemption({
        store,
        fenceToken: "f",
        decisionInput: input({ hasActiveSession: true }),
        nowIso: NOW,
        release: {
          releaseAndPark: () => {
            released += 1;
            return { ok: true };
          },
        },
      });
      expect(result.ok && result.applied).toBe(false);
      expect(released).toBe(0);
      const read = readDaemonPreemptions(store);
      if (read.ok) expect(read.latest?.state).toBe("pending");
    } finally {
      removeRoot(root);
    }
  });

  test("a phase boundary applies the release and names the close item", () => {
    const decision = decidePreemption(
      input({
        hasActiveSession: true,
        boundary: { phase: "7", observedAt: NOW },
      }),
    );
    expect(decision).toMatchObject({ state: "applied", boundary: { phase: "7" } });
  });

  test("a boundary apply releases, parks, and records the close item", () => {
    const { root, store } = isolation();
    try {
      let released = 0;
      const result = applyPreemption({
        store,
        fenceToken: "f",
        decisionInput: input({
          hasActiveSession: true,
          boundary: { phase: "7", observedAt: NOW },
        }),
        nowIso: NOW,
        release: {
          releaseAndPark: () => {
            released += 1;
            return { ok: true };
          },
        },
      });
      expect(result.ok && result.applied).toBe(true);
      expect(released).toBe(1);
      if (result.ok) {
        expect(result.record.closeRef).toBe("GH-999");
        expect(result.record.parkCause).toBe("preempted-for-close-item");
        expect(result.record.boundary).toEqual({ phase: "7", observedAt: NOW });
      }
    } finally {
      removeRoot(root);
    }
  });

  test("no active session releases and parks immediately", () => {
    const { root, store } = isolation();
    try {
      let released = 0;
      const result = applyPreemption({
        store,
        fenceToken: "f",
        decisionInput: input({ hasActiveSession: false }),
        nowIso: NOW,
        release: {
          releaseAndPark: () => {
            released += 1;
            return { ok: true };
          },
        },
      });
      expect(result.ok && result.applied).toBe(true);
      expect(released).toBe(1);
    } finally {
      removeRoot(root);
    }
  });

  test("pending preemption survives restart and re-evaluates", () => {
    const { root, store } = isolation();
    try {
      applyPreemption({
        store,
        fenceToken: "f",
        decisionInput: input({ hasActiveSession: true }),
        nowIso: NOW,
        release: { releaseAndPark: () => ({ ok: true }) },
      });
      const observable = reevaluatePendingPreemptions({
        store,
        fenceToken: "f2",
        nowIso: NOW,
        release: { releaseAndPark: () => ({ ok: true }) },
        sessionObservable: () => true,
      });
      expect(observable).toEqual({ ok: true, applied: [] });
      let released = 0;
      const gone = reevaluatePendingPreemptions({
        store,
        fenceToken: "f3",
        nowIso: NOW,
        release: {
          releaseAndPark: () => {
            released += 1;
            return { ok: true };
          },
        },
        sessionObservable: () => false,
      });
      expect(gone).toEqual({ ok: true, applied: ["GH-238"] });
      expect(released).toBe(1);
      const read = readDaemonPreemptions(store);
      if (read.ok) expect(read.latest?.state).toBe("applied");
    } finally {
      removeRoot(root);
    }
  });

  test("a target/close pair never duplicates a record", () => {
    const { root, store } = isolation();
    try {
      const first = applyPreemption({
        store,
        fenceToken: "f",
        decisionInput: input({ hasActiveSession: false }),
        nowIso: NOW,
        release: { releaseAndPark: () => ({ ok: true }) },
      });
      const second = applyPreemption({
        store,
        fenceToken: "f2",
        decisionInput: input({ hasActiveSession: false }),
        nowIso: "2026-11-08T10:01:00Z",
        release: { releaseAndPark: () => ({ ok: true }) },
      });
      expect(first.ok && second.ok).toBe(true);
      const read = readDaemonPreemptions(store);
      if (read.ok) expect(read.records).toHaveLength(1);
    } finally {
      removeRoot(root);
    }
  });
});
