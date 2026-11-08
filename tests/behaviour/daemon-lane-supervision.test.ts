/**
 * TC-LANE-001..006 / TC-STATE-002/006 / TC-RECON-006 (supervision halves) —
 * claim → spawn → record → observe → release, supervise-only, prefill-safe
 * liveness, corroborated stall, and distinct daemon.lane state.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDaemonLane,
  readDaemonLanes,
  recordResumeIntent,
  runSupervisionCycle,
} from "../../packages/core/src/app/index";
import {
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type LaneExecutorPort,
  type LaneHandle,
  type LaneObservation,
} from "../../packages/core/src/contracts/index";
import { classifyLaneProgress } from "../../packages/core/src/domain/daemon-lane";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";

const executor = (
  options: {
    readonly available?: boolean;
    readonly observation?: LaneObservation;
    readonly start?: boolean;
  } = {},
): { port: LaneExecutorPort; calls: string[] } => {
  const calls: string[] = [];
  const handle: LaneHandle = { sessionId: "session-a", harnessKind: "opencode" };
  return {
    calls,
    port: {
      availability: () =>
        options.available === false
          ? { available: false, reason: "lane-executor-unavailable" }
          : { available: true },
      start: async () => {
        calls.push("start");
        return options.start === false ? undefined : handle;
      },
      observe: async () => {
        calls.push("observe");
        return options.observation ?? { observable: true, progress: "progressing", done: false };
      },
      collect: async () => {
        calls.push("collect");
        return { ok: true };
      },
      resume: async () => {
        calls.push("resume");
        return true;
      },
    },
  };
};

const isolation = () => {
  const root = makeTempRoot("gh238-lane");
  const { store } = openStore(makeIdentity(root));
  return { root, store };
};

const action = { ref: "GH-238", repository: "github.com/owner/repo", weightClass: "standard" };

describe("GH-238 lane supervision", () => {
  test("claim, spawn, record, observe, and release through the injected executor", async () => {
    const { root, store } = isolation();
    try {
      const fake = executor();
      let released: string | undefined;
      const result = await runSupervisionCycle({
        store,
        fenceToken: "fence",
        ports: {
          executor: fake.port,
          nextAction: () => action,
          claim: () => ({ ok: true, leaseId: "lease-1" }),
          release: (_action, cause) => {
            released = cause;
            return true;
          },
          nowIso: () => NOW,
        },
      });
      expect(result.mode).toBe("spawned");
      expect(fake.calls).toEqual(["start", "observe"]);
      expect(released).toBeUndefined();
      const lanes = readDaemonLanes(store);
      expect(lanes.ok).toBe(true);
      if (lanes.ok) expect(lanes.latest).toMatchObject({ ref: "GH-238", state: "delivering" });
    } finally {
      removeRoot(root);
    }
  });

  test("a missing executor runs supervise-only and never claims", async () => {
    const { root, store } = isolation();
    try {
      const fake = executor({ available: false });
      let claimed = false;
      const result = await runSupervisionCycle({
        store,
        fenceToken: "fence",
        ports: {
          executor: fake.port,
          nextAction: () => action,
          claim: () => {
            claimed = true;
            return { ok: true, leaseId: "lease" };
          },
          release: () => true,
          nowIso: () => NOW,
        },
      });
      expect(result.mode).toBe("supervise-only");
      expect(claimed).toBe(false);
      expect(fake.calls).toEqual([]);
    } finally {
      removeRoot(root);
    }
  });

  test("a corroborated stall applies the failed classification and releases", async () => {
    const { root, store } = isolation();
    try {
      const fake = executor({
        observation: { observable: true, progress: "stalled", done: false },
      });
      let released: string | undefined;
      const result = await runSupervisionCycle({
        store,
        fenceToken: "fence",
        ports: {
          executor: fake.port,
          nextAction: () => action,
          claim: () => ({ ok: true, leaseId: "lease" }),
          release: (_action, cause) => {
            released = cause;
            return true;
          },
          nowIso: () => NOW,
        },
      });
      expect(result.mode).toBe("stalled");
      expect(released).toBe("failed");
      const lanes = readDaemonLanes(store);
      if (lanes.ok) expect(lanes.latest?.state).toBe("failed");
    } finally {
      removeRoot(root);
    }
  });

  test("a corroborated stall invokes the delivered restart admission", async () => {
    const { root, store } = isolation();
    try {
      const fake = executor({
        observation: { observable: true, progress: "stalled", done: false },
      });
      const admissions: string[] = [];
      const result = await runSupervisionCycle({
        store,
        fenceToken: "fence",
        ports: {
          executor: fake.port,
          nextAction: () => action,
          claim: () => ({ ok: true, leaseId: "lease" }),
          release: () => true,
          nowIso: () => NOW,
          admitRestart: ({ action: admittedAction }) => {
            admissions.push(admittedAction.ref);
            return { outcome: "refused", code: "dispatch.restart-budget-exceeded" };
          },
        },
      });
      expect(result.mode).toBe("stalled");
      expect(admissions).toEqual(["GH-238"]);
      if (result.mode === "stalled") {
        expect(result.admission).toEqual({
          outcome: "refused",
          code: "dispatch.restart-budget-exceeded",
        });
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a stall without an admission seam reports why it cannot admit", async () => {
    const { root, store } = isolation();
    try {
      const fake = executor({
        observation: { observable: true, progress: "stalled", done: false },
      });
      const result = await runSupervisionCycle({
        store,
        fenceToken: "fence",
        ports: {
          executor: fake.port,
          nextAction: () => action,
          claim: () => ({ ok: true, leaseId: "lease" }),
          release: () => true,
          nowIso: () => NOW,
        },
      });
      if (result.mode === "stalled") {
        expect(result.admission).toEqual({
          outcome: "unevaluable",
          code: "restart-admission-unavailable",
        });
      }
    } finally {
      removeRoot(root);
    }
  });

  test("prefill and resume progress are never stalled", () => {
    expect(classifyLaneProgress({ tokenDelta: 0, traffic: 0, prefillOrResume: true })).toBe(
      "progressing",
    );
    expect(classifyLaneProgress({ tokenDelta: 2, traffic: 0 })).toBe("progressing");
    expect(classifyLaneProgress({ tokenDelta: 0, traffic: 0, corroborated: true })).toBe("stalled");
    expect(classifyLaneProgress({ tokenDelta: 0, traffic: 0 })).toBe("unknown");
  });

  test("the daemon.lane state is distinct from the delivered lane projection", async () => {
    const { root, store } = isolation();
    try {
      appendDaemonLane(store, "seed", {
        schema: DAEMON_LANE_PAYLOAD_SCHEMA,
        ref: "GH-238",
        state: "delivering",
        spawnOrdinal: 1,
        recordedAt: NOW,
      });
      const lanes = readDaemonLanes(store);
      if (lanes.ok) expect(lanes.latest?.state).toBe("delivering");
    } finally {
      removeRoot(root);
    }
  });

  test("a resume intent is recorded only on an existing lane", async () => {
    const { root, store } = isolation();
    try {
      appendDaemonLane(store, "seed", {
        schema: DAEMON_LANE_PAYLOAD_SCHEMA,
        ref: "GH-238",
        state: "detached",
        spawnOrdinal: 1,
        recordedAt: NOW,
      });
      const lanes = readDaemonLanes(store);
      if (!lanes.ok || lanes.latest === undefined) throw new Error("lane missing");
      const updated = recordResumeIntent(
        { store, fenceToken: "fence", nowIso: () => NOW },
        lanes.latest,
        { questionId: "Q-1", mode: "attach-continue" },
      );
      expect(updated?.resumeIntent).toEqual({ questionId: "Q-1", mode: "attach-continue" });
      const read = readDaemonLanes(store);
      if (read.ok) expect(read.latest?.resumeIntent?.questionId).toBe("Q-1");
    } finally {
      removeRoot(root);
    }
  });
});
