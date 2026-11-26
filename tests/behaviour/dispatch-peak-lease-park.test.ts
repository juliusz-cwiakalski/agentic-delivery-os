/**
 * TC-PEAK-010 / TC-PEAK-035 — the parked-interval lease over a real store with
 * the production renewal path bound (GH-413 F-5, AC-F5-2, NFR-10, DM-9).
 */
import { describe, expect, test } from "bun:test";
import type { DispatchLeaseClaim } from "../../packages/core/src/app/dispatch";
import {
  claimDispatchLease,
  declareQueueEntry,
  readActiveLeases,
  renewDispatchLease,
} from "../../packages/core/src/app/index";
import type { HarnessLivenessReport } from "../../packages/core/src/contracts/index";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour } from "../fixtures/provider/profile/gh413-rules";

const REPOSITORY = "github.com/owner/repo";

const sourced = (value: number): HarnessLivenessReport => ({
  readings: [
    { kind: "session-traffic", status: "sourced", value, observedAt: "2026-11-12T06:30:00.000Z" },
    { kind: "process", status: "sourced", value, observedAt: "2026-11-12T06:30:00.000Z" },
  ],
});

describe("TC-PEAK-010 a park renews the real repository lease through the delivered path", () => {
  test("the lease stays live across several renewals over a real store", async () => {
    const claim: DispatchLeaseClaim = { ok: true, leaseId: "lease-1" };
    let peakRef: { readonly clock: { iso: () => string; nowMs: () => number } } | undefined;
    let scenarioRef:
      | { readonly state: { readonly store: Parameters<typeof claimDispatchLease>[0] } }
      | undefined;
    const renewals: string[] = [];
    const { peak, scenario } = createPeakScenario({
      label: "gh413-real-store-lease-park",
      startMs: atUtcHour(6, 30),
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
      renewLease: ({ expectedHeartbeatAt }) => {
        const store = scenarioRef?.state.store;
        const clock = peakRef?.clock;
        if (store === undefined || clock === undefined) return { ok: false, result: "not-owned" };
        const outcome = renewDispatchLease(store, {
          repository: REPOSITORY,
          ref: "GH-413",
          holder: "dispatch",
          expectedHeartbeatAt,
          ttlMs: 90_000,
          nowIso: clock.iso(),
          nowMs: clock.nowMs(),
          fenceToken: `renew-${renewals.length}`,
        });
        if (outcome.ok) renewals.push(outcome.heartbeatAt);
        return outcome;
      },
      livenessOf: (poll) => sourced(poll),
      collectAfterPolls: 2,
    });
    peakRef = peak;
    scenarioRef = scenario;
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
      ttlMs: 90_000,
    });
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    Object.assign(claim, { leaseId: claimed.leaseId, heartbeatAt: claimed.heartbeatAt });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(renewals.length).toBeGreaterThan(1);
      const active = readActiveLeases(scenario.state.store, peak.clock.nowMs());
      expect(active.ok).toBe(true);
      if (!active.ok) return;
      const lease = active.active.find((entry) => entry.ref === "GH-413");
      expect(lease?.leaseId).toBe(claimed.leaseId);
      expect(lease?.heartbeatAgeMs).toBeLessThan(90_000);
    } finally {
      scenario.dispose();
    }
  });
});
