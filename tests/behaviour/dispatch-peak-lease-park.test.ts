/**
 * TC-PEAK-010 / TC-PEAK-035 — the parked-interval lease over a real store with
 * the production renewal path bound (GH-413 F-5, AC-F5-2, NFR-10, DM-9).
 *
 * The lane parks inside a window that outlasts at least two 90 s lease TTLs;
 * the real `renewDispatchLease` renews the real record, a second dispatch is
 * refused `dispatch.resume-parked` at exit 2 while the park stands, and the
 * parked and recovered records are the same durable family.
 */
import { describe, expect, test } from "bun:test";
import type { DispatchLeaseClaim } from "../../packages/core/src/app/dispatch";
import {
  claimDispatchLease,
  declareQueueEntry,
  queueParkRecordKey,
  readActiveLeases,
  readQueueParks,
  renewDispatchLease,
} from "../../packages/core/src/app/index";
import type {
  HarnessLivenessReport,
  QueueParkRecord,
} from "../../packages/core/src/contracts/index";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour } from "../fixtures/provider/profile/gh413-rules";

const REPOSITORY = "github.com/owner/repo";
const TTL = 90_000;

const sourced = (value: number): HarnessLivenessReport => ({
  readings: [
    { kind: "session-traffic", status: "sourced", value, observedAt: "2026-11-12T06:00:00.000Z" },
    { kind: "process", status: "sourced", value, observedAt: "2026-11-12T06:00:00.000Z" },
  ],
});

describe("TC-PEAK-010 a park renews the real repository lease through the delivered path", () => {
  test("a park of ten minutes (several TTLs) renews and refuses a second dispatch", async () => {
    const claim: DispatchLeaseClaim = { ok: true, leaseId: "lease-1" };
    let peakRef: { readonly clock: { iso: () => string; nowMs: () => number } } | undefined;
    let scenarioRef:
      | {
          readonly state: { readonly store: Parameters<typeof claimDispatchLease>[0] };
          readonly invoke: (argv: readonly string[]) => Promise<{
            readonly exit: number;
            readonly envelope?: { readonly error?: { readonly code?: string } };
          }>;
        }
      | undefined;
    const renewals: string[] = [];
    let second: Awaited<ReturnType<NonNullable<typeof scenarioRef>["invoke"]>> | undefined;
    const { peak, scenario } = createPeakScenario({
      label: "gh413-real-store-lease-park",
      startMs: atUtcHour(6),
      rules: {
        delivery: {
          windows: [
            {
              timezone: "UTC",
              startSecondsOfDay: 6 * 3_600,
              endSecondsOfDay: 6 * 3_600 + 600,
              multiplier: 2,
              bufferBeforeSeconds: 0,
              bufferAfterSeconds: 0,
            },
          ],
          graceSecondsDefault: 20,
          graceSecondsMax: 60,
        },
      },
      nomination: "delivery",
      claim,
      renewLease: async ({ expectedHeartbeatAt }) => {
        const store = scenarioRef?.state.store;
        const clock = peakRef?.clock;
        if (store === undefined || clock === undefined) return { ok: false, result: "not-owned" };
        const outcome = renewDispatchLease(store, {
          repository: REPOSITORY,
          ref: "GH-413",
          holder: "dispatch",
          expectedHeartbeatAt,
          ttlMs: TTL,
          nowIso: clock.iso(),
          nowMs: clock.nowMs(),
          fenceToken: `renew-${renewals.length}`,
        });
        if (outcome.ok) {
          renewals.push(outcome.heartbeatAt);
          // While parked and renewed, a second dispatch meets the pre-session
          // refusal (AC-F5-2, DEC-22), not the lease claim.
          if (renewals.length === 2 && second === undefined) {
            second = await scenarioRef?.invoke(["dispatch", "GH-413", "--json"]);
          }
        }
        return outcome;
      },
      livenessOf: (poll) => sourced(poll),
      collectAfterPolls: 2,
    });
    peakRef = peak;
    scenarioRef = scenario;
    // The watch parks into the real store, not a fixture array.
    const appendPark = (record: QueueParkRecord): boolean => {
      const acquired = scenario.state.store.acquireFence(`park-${record.episodeId ?? "x"}`);
      if (!acquired.ok) return false;
      try {
        const appended = scenario.state.store.append(acquired.value.handle, {
          kind: "queue.park",
          recordKey: queueParkRecordKey(record.ref),
          payload: record as never,
        });
        return appended.ok;
      } finally {
        scenario.state.store.releaseFence(acquired.value.handle);
      }
    };
    Object.assign(peak.peak, {
      parks: () => {
        const read = readQueueParks(scenario.state.store);
        return read.ok ? read.records : [];
      },
      unexpiredStandingPark: (ref: string) => {
        const read = readQueueParks(scenario.state.store);
        if (!read.ok) return undefined;
        const latest = [...read.records]
          .reverse()
          .find((record) => record.ref === ref && record.cause === "peak-window");
        if (latest === undefined) return undefined;
        if (latest.recoveryState !== "parked" && latest.recoveryState !== "clear-observed") {
          return undefined;
        }
        const untilMs = latest.until === undefined ? undefined : Date.parse(latest.until);
        if (untilMs !== undefined && Number.isFinite(untilMs) && untilMs > peak.clock.nowMs()) {
          return {
            cause: latest.cause,
            ...(latest.until === undefined ? {} : { until: latest.until }),
          };
        }
        return undefined;
      },
      appendPark,
      appendRecovery: appendPark,
    });
    // Pre-claim the real lease and point the scenario's claim at it.
    const seeded = declareQueueEntry(scenario.state.store, {
      ref: "GH-413",
      repository: REPOSITORY,
      repositoryRoot: "/work/repo",
      priority: 1,
      recordedAt: peak.clock.iso(),
      fenceToken: "seed-entry",
    });
    expect(seeded.ok).toBe(true);
    const claimed = await claimDispatchLease(scenario.state.store, {
      ref: "GH-413",
      nowIso: peak.clock.iso,
      nowMs: peak.clock.nowMs,
      fenceToken: "claim-real",
      ttlMs: TTL,
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    Object.assign(claim, { leaseId: claimed.leaseId, heartbeatAt: claimed.heartbeatAt });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(renewals.length).toBeGreaterThan(1);
      expect(second?.exit).toBe(2);
      expect(
        second?.envelope?.error?.code ??
          (second?.envelope as { readonly data?: { readonly error?: { readonly code?: string } } })
            ?.data?.error?.code,
      ).toBe("dispatch.resume-parked");
      const parks = readQueueParks(scenario.state.store);
      expect(parks.ok).toBe(true);
      if (!parks.ok) return;
      expect(parks.records.some((record) => record.recoveryState === "parked")).toBe(true);
      expect(parks.records.some((record) => record.recoveryState === "recovered")).toBe(true);
      const active = readActiveLeases(scenario.state.store, peak.clock.nowMs());
      expect(active.ok).toBe(true);
      if (!active.ok) return;
      const lease = active.active.find((entry) => entry.ref === "GH-413");
      expect(lease?.leaseId).toBe(claimed.leaseId);
      expect(lease?.heartbeatAgeMs).toBeLessThan(TTL);
    } finally {
      scenario.dispose();
    }
  });
});
