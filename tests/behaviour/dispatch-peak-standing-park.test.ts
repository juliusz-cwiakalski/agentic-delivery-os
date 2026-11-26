/**
 * TC-PEAK-038 — a standing peak-window park is recovered or refused before a
 * new episode; occupancy prevents a double park (GH-413 F-3, F-5, AC-F3-4,
 * NFR-2, DM-1, RSK-14, DEC-22, DEC-23).
 */
import { describe, expect, test } from "bun:test";
import {
  declareQueueEntry,
  queueParkRecordKey,
  recoverQueueParks,
} from "../../packages/core/src/app/index";
import type { QueueParkRecord } from "../../packages/core/src/contracts/index";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";
import { makeAuditStore, removeRoot } from "../fixtures/state/harness";

const standingPark = (until: string): QueueParkRecord => ({
  schema: "delivery.queue.park.v1",
  ref: "GH-413",
  cause: "peak-window",
  conditionType: "provider-window",
  condition: { type: "provider-window", expiresAt: until },
  recheckMs: 60_000,
  evaluatedAt: "2026-11-12T05:00:00.000Z",
  recoveryState: "parked",
  providerProfile: "delivery",
  until,
  graceDeadline: "2026-11-12T05:00:20.000Z",
  windowEnd: until,
  stoppedAt: "2026-11-12T05:00:20.000Z",
  preservation: "preserved",
  episodeId: "episode-old",
  recordedAt: "2026-11-12T05:00:20.000Z",
});

describe("TC-PEAK-038 an un-expired standing park refuses the resume before any session", () => {
  test("the run is refused dispatch.resume-parked at exit 2 and writes nothing", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-standing-unexpired",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    peak.parks.push(standingPark("2026-11-12T10:00:00.000Z"));
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.error?.code ?? run.envelope?.data?.error?.code).toBe(
        "dispatch.resume-parked",
      );
      expect(scenario.calls.claims).toHaveLength(0);
      expect(scenario.scripted.calls.filter((call) => call === "spawn")).toHaveLength(0);
      expect(peak.stopCalls).toHaveLength(0);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-038 occupancy suppresses a second stop", () => {
  test("an expired standing park kept by the pass suppresses the new stop and appends nothing", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-standing-occupancy",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    peak.parks.push(standingPark("2026-11-12T05:30:00.000Z"));
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(peak.stopCalls).toHaveLength(0);
      expect(peak.parks).toHaveLength(1);
      expect(peak.recoveryCalls()).toBeGreaterThanOrEqual(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-038 an expired standing park is recovered before the next episode", () => {
  test("the pass runs first and the open window then parks exactly once", async () => {
    let fixture: { readonly parks: QueueParkRecord[] } | undefined;
    const { peak, scenario } = createPeakScenario({
      label: "gh413-standing-recovered",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
      recoverParks: () => {
        if (fixture !== undefined) fixture.parks.length = 0;
        return { ok: true };
      },
    });
    fixture = peak;
    peak.parks.push(standingPark("2026-11-12T05:30:00.000Z"));
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(peak.recoveryCalls()).toBe(1);
      expect(peak.stopCalls).toHaveLength(1);
      const parked = peak.parks.filter((park) => park.recoveryState === "parked");
      expect(parked).toHaveLength(1);
      expect(parked[0]?.episodeId).not.toBe("episode-old");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-038 an unrecoverable standing park refuses the run", () => {
  test("the classified refusal starts no episode and writes no park", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-standing-unrecoverable",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
      recoverParks: () => ({ ok: false, kind: "queue", code: "queue.park-condition-stuck" }),
    });
    peak.parks.push(standingPark("2026-11-12T05:30:00.000Z"));
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.error?.code ?? run.envelope?.data?.error?.code).toBe(
        "queue.park-condition-stuck",
      );
      expect(peak.stopCalls).toHaveLength(0);
      expect(peak.parks).toHaveLength(1);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-038 the real mutating pass reports a stuck marker", () => {
  test("a clear-observed marker is surfaceable as queue.park-condition-stuck", () => {
    const fixture = makeAuditStore("gh413-stuck-marker");
    try {
      const declared = declareQueueEntry(fixture.store, {
        ref: "GH-413",
        repository: "github.com/owner/repo",
        repositoryRoot: "/work/repo",
        priority: 1,
        recordedAt: "2026-11-12T06:00:00.000Z",
        fenceToken: "gh413-stuck-seed",
      });
      expect(declared.ok).toBe(true);
      const acquired = fixture.store.acquireFence("gh413-stuck-park");
      if (!acquired.ok) throw new Error("fence refused");
      const appended = fixture.store.append(acquired.value.handle, {
        kind: "queue.park",
        recordKey: queueParkRecordKey("GH-413"),
        payload: {
          schema: "delivery.queue.park.v1",
          ref: "GH-413",
          repository: "github.com/owner/repo",
          cause: "peak-window",
          conditionType: "provider-window",
          condition: { type: "provider-window", expiresAt: "2026-11-12T06:30:00.000Z" },
          recheckMs: 60_000,
          evaluatedAt: "2026-11-12T06:00:00.000Z",
          recoveryState: "clear-observed",
          clearObservedAt: "2026-11-12T06:00:00.000Z",
          recordedAt: "2026-11-12T06:00:00.000Z",
        } as never,
      });
      fixture.store.releaseFence(acquired.value.handle);
      expect(appended.ok).toBe(true);
      const pass = recoverQueueParks(fixture.store, {
        nowIso: "2026-11-12T06:31:00.000Z",
        nowMs: Date.parse("2026-11-12T06:31:00.000Z"),
        context: { providerAvailable: true, leaseHeldRepositories: ["github.com/owner/repo"] },
        fenceToken: "gh413-stuck-pass",
      });
      expect(pass.ok).toBe(true);
      if (!pass.ok) return;
      expect(pass.value.stuck).toContain("GH-413");
    } finally {
      removeRoot(fixture.root);
    }
  });
});
