/**
 * TC-PEAK-010 — the running lane's lease stays live at the derived renewal
 * cadence and is keyed on its own last heartbeat write (GH-413 F-5, AC-F5-2,
 * NFR-10, DM-9, DEC-13, TDR-0078).
 *
 * The lease clock is injected; no wall clock and no sleep participates.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dispatchRenewalCadenceMs } from "../../packages/core/src/app/dispatch";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { dispatchAdmissionRefusal } from "../../packages/core/src/app/index";
import type { HarnessLivenessReport } from "../../packages/core/src/contracts/index";
import { createCommandScenario, createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import {
  activeLease,
  claim,
  claimLane,
  recordCount,
  renewLane,
  secondDispatchRefusal,
  singleFlightStore,
  TTL,
} from "../fixtures/queue/single-flight/harness";

const REF = "GH-413";
const LIFENESS = 30_000;

const status = (renewed: Awaited<ReturnType<typeof renewLane>>) =>
  renewed.ok ? "renewed" : "result" in renewed ? renewed.result : renewed.code;

describe("TC-PEAK-010 the renewal cadence is min(liveness, TTL/2)", () => {
  test("the default interval keeps the liveness cadence and an interval above the TTL halves", () => {
    expect(dispatchRenewalCadenceMs(30_000, 90_000)).toBe(30_000);
    expect(dispatchRenewalCadenceMs(120_000, 90_000)).toBe(45_000);
    expect(dispatchRenewalCadenceMs(90_000, 90_000)).toBe(45_000);
  });
});

describe("TC-PEAK-010 a running lane's lease stays live across several TTLs", () => {
  test("a second dispatch is refused queue.single-flight before, at and after each boundary", async () => {
    const single = singleFlightStore("gh413-running-lease", REF);
    try {
      const t0 = single.nowMs();
      const claimed = await claimLane(single, REF);
      expect(claimed.ok).toBe(true);
      if (!claimed.ok) return;
      expect(claimed.heartbeatAt).toBeDefined();
      let heartbeat = claimed.heartbeatAt as string;
      const cadence = dispatchRenewalCadenceMs(LIFENESS, TTL);
      expect(cadence).toBe(30_000);
      const boundaries = [TTL, 2 * TTL, 3 * TTL];
      for (let elapsed = 0; elapsed <= 3 * TTL; elapsed += cadence) {
        single.setNowMs(t0 + elapsed);
        // The second dispatch is refused at the wall-clock point, including
        // just before, exactly at, and just after each TTL multiple.
        const refused = dispatchAdmissionRefusal(single.store, {
          ref: REF,
          nowMs: single.nowMs(),
        });
        expect(refused?.code, `at ${elapsed}`).toBe("queue.single-flight");
        expect(refused?.holder).toBe("dispatch");
        const probe = await secondDispatchRefusal(single, REF);
        expect(probe.ok, `probe at ${elapsed}`).toBe(false);
        const renewed = renewLane(single, {
          ref: REF,
          holder: "dispatch",
          expectedHeartbeatAt: heartbeat,
        });
        expect(status(renewed), `renew at ${elapsed}`).toBe("renewed");
        if (!renewed.ok) continue;
        heartbeat = renewed.heartbeatAt;
        const live = activeLease(single).find((lease) => lease.ref === REF);
        expect(live?.heartbeatAgeMs).toBeLessThan(TTL);
      }
      expect(boundaries.every((boundary) => boundary % cadence === 0)).toBe(true);
    } finally {
      single.dispose();
    }
  });

  test("without renewal the heartbeat reaches the TTL and the delivered stale takeover admits", async () => {
    const single = singleFlightStore("gh413-running-stale", REF);
    try {
      const t0 = single.nowMs();
      const claimed = await claimLane(single, REF);
      expect(claimed.ok).toBe(true);
      single.setNowMs(t0 + TTL);
      expect(
        dispatchAdmissionRefusal(single.store, { ref: REF, nowMs: single.nowMs() }),
      ).toBeUndefined();
      const takeover = await secondDispatchRefusal(single, REF);
      expect(takeover.ok).toBe(true);
    } finally {
      single.dispose();
    }
  });

  test("an interval at or above the TTL still keeps the heartbeat below the TTL", async () => {
    const single = singleFlightStore("gh413-interval-above-ttl", REF);
    try {
      const t0 = single.nowMs();
      const claimed = await claimLane(single, REF);
      expect(claimed.ok).toBe(true);
      if (!claimed.ok) return;
      let heartbeat = claimed.heartbeatAt as string;
      const cadence = dispatchRenewalCadenceMs(120_000, TTL);
      expect(cadence).toBe(45_000);
      for (let elapsed = 0; elapsed <= 3 * TTL; elapsed += cadence) {
        single.setNowMs(t0 + elapsed);
        const refused = dispatchAdmissionRefusal(single.store, {
          ref: REF,
          nowMs: single.nowMs(),
        });
        expect(refused?.code, `at ${elapsed}`).toBe("queue.single-flight");
        const renewed = renewLane(single, {
          ref: REF,
          holder: "dispatch",
          expectedHeartbeatAt: heartbeat,
        });
        expect(status(renewed), `renew at ${elapsed}`).toBe("renewed");
        if (!renewed.ok) continue;
        heartbeat = renewed.heartbeatAt;
        expect(activeLease(single).find((lease) => lease.ref === REF)?.heartbeatAgeMs).toBeLessThan(
          TTL,
        );
      }
    } finally {
      single.dispose();
    }
  });
});

describe("TC-PEAK-010 heartbeat ownership is the invocation's own last write", () => {
  test("a later writer's heartbeat makes the earlier renewal a no-op that appends nothing", async () => {
    const single = singleFlightStore("gh413-heartbeat-ownership", REF);
    try {
      const t0 = single.nowMs();
      const claimed = await claimLane(single, REF);
      expect(claimed.ok).toBe(true);
      if (!claimed.ok) return;
      const firstHeartbeat = claimed.heartbeatAt as string;
      // A second writer takes the delivered same-holder renewed arm through the
      // queue claim (the dispatch admission itself never renews).
      single.setNowMs(t0 + 10_000);
      const successor = claim(single, { ref: REF, holder: "dispatch" });
      expect(successor.ok).toBe(true);
      if (!successor.ok) return;
      expect(successor.value.lease.heartbeatAt).not.toBe(firstHeartbeat);
      const before = recordCount(single);
      const noop = renewLane(single, {
        ref: REF,
        holder: "dispatch",
        expectedHeartbeatAt: firstHeartbeat,
      });
      expect(status(noop)).toBe("not-owned");
      expect(recordCount(single)).toBe(before);
      const live = activeLease(single).find((lease) => lease.ref === REF);
      expect(live?.heartbeatAt).toBe(successor.value.lease.heartbeatAt);
    } finally {
      single.dispose();
    }
  });

  test("a same-holder re-dispatch preserves the lease id; the earlier invocation loses ownership", async () => {
    const single = singleFlightStore("gh413-redispatch", REF);
    try {
      const t0 = single.nowMs();
      const claimed = await claimLane(single, REF);
      expect(claimed.ok).toBe(true);
      if (!claimed.ok) return;
      const firstHeartbeat = claimed.heartbeatAt as string;
      const firstLeaseId = claimed.leaseId;
      // After the TTL a second dispatch takes the delivered `renewed` arm.
      single.setNowMs(t0 + TTL + 1_000);
      const successor = await claimLane(single, REF);
      expect(successor.ok).toBe(true);
      if (!successor.ok) return;
      expect(successor.leaseId).toBe(firstLeaseId);
      const before = recordCount(single);
      const noop = renewLane(single, {
        ref: REF,
        holder: "dispatch",
        expectedHeartbeatAt: firstHeartbeat,
      });
      expect(status(noop)).toBe("not-owned");
      expect(recordCount(single)).toBe(before);
      const live = activeLease(single).find((lease) => lease.ref === REF);
      expect(live?.leaseId).toBe(firstLeaseId);
      expect(live?.heartbeatAt).toBe(successor.heartbeatAt);
    } finally {
      single.dispose();
    }
  });
});

describe("TC-PEAK-010 the renewal never passes the owner-hold gate", () => {
  test("the run-path renewal source names no owner hold", () => {
    const source = readFileSync(join(process.cwd(), "packages/core/src/app/queue.ts"), "utf8");
    const start = source.indexOf("export const renewDispatchLease");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = source.indexOf("\n/**", start);
    const body = source.slice(start, end === -1 ? undefined : end);
    expect(body).not.toContain("ownerHold");
    expect(body).not.toContain("OwnerHold");
  });
});

describe("TC-PEAK-010 the engine surfaces a renewal failure and retries the next cadence", () => {
  const sourced = (value: number): HarnessLivenessReport => ({
    readings: [
      { kind: "session-traffic", status: "sourced", value, observedAt: "2026-11-08T10:00:00.000Z" },
      { kind: "process", status: "sourced", value, observedAt: "2026-11-08T10:00:00.000Z" },
    ],
  });

  test("one failing renewal is bounded evidence and the next cadence succeeds", async () => {
    let clockMs = Date.parse("2026-11-08T10:00:00.000Z");
    let renewals = 0;
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      livenessIntervalMs: LIFENESS,
      leaseTtlMs: TTL,
      nowIso: () => {
        clockMs += 5_000;
        return new Date(clockMs).toISOString();
      },
      claim: {
        ok: true,
        leaseId: "lease-1",
        heartbeatAt: new Date(clockMs).toISOString(),
      },
      renewLease: () => {
        renewals += 1;
        return renewals === 1
          ? { ok: false, kind: "state", code: "state.lock.busy" }
          : {
              ok: true,
              result: "renewed",
              heartbeatAt: new Date(clockMs).toISOString(),
              leaseId: "lease-1",
            };
      },
      livenessOf: (poll) => sourced(poll),
      collectAfterPolls: 6,
      restartBudget: 3,
    });
    try {
      const run = await scenario.invoke(["dispatch", REF, "--json"]);
      expect(run.exit).toBe(0);
      expect(renewals).toBeGreaterThanOrEqual(2);
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.evidenceRefs).toContain("lease:renewal-failed");
    } finally {
      scenario.dispose();
    }
  });

  test("a lost lease takes no owner act and returns with lease:not-owned", async () => {
    let clockMs = Date.parse("2026-11-08T10:00:00.000Z");
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      livenessIntervalMs: LIFENESS,
      leaseTtlMs: TTL,
      nowIso: () => {
        clockMs += 5_000;
        return new Date(clockMs).toISOString();
      },
      claim: {
        ok: true,
        leaseId: "lease-1",
        heartbeatAt: new Date(clockMs).toISOString(),
      },
      renewLease: () => ({ ok: false, result: "not-owned" }),
      livenessOf: () => sourced(1),
      collectAfterPolls: 4,
      restartBudget: 3,
    });
    try {
      const run = await scenario.invoke(["dispatch", REF, "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.error?.code).toBe("dispatch.state-unverified");
      expect(scenario.calls.restarts).toHaveLength(0);
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.evidenceRefs).toContain("lease:not-owned");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-010 the lease stays live across a park through the engine", () => {
  test("the own-heartbeat renewal runs during the wait and the lane resumes", async () => {
    const renewals: string[] = [];
    let heartbeat = new Date(Date.parse("2026-11-12T06:30:00.000Z")).toISOString();
    const { scenario } = createPeakScenario({
      label: "gh413-engine-park-lease",
      startMs: Date.parse("2026-11-12T06:30:00.000Z"),
      rules: {
        delivery: {
          windows: [
            {
              timezone: "UTC",
              startSecondsOfDay: 6 * 3_600,
              endSecondsOfDay: 10 * 3_600,
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
      claim: { ok: true, leaseId: "lease-1", heartbeatAt: heartbeat },
      renewLease: ({ expectedHeartbeatAt }) => {
        renewals.push(expectedHeartbeatAt);
        heartbeat = new Date(Date.parse(heartbeat) + 1_000).toISOString();
        return { ok: true, result: "renewed", heartbeatAt: heartbeat, leaseId: "lease-1" };
      },
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(renewals.length).toBeGreaterThan(1);
      expect(renewals[0]).toBe("2026-11-12T06:30:00.000Z");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-010 a lost lease on a clean session exit takes no owner act", () => {
  test("the invocation returns state-unverified with no release and lease:not-owned", async () => {
    let clockMs = Date.parse("2026-11-08T10:00:00.000Z");
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      livenessIntervalMs: 30_000,
      leaseTtlMs: 90_000,
      nowIso: () => {
        clockMs += 5_000;
        return new Date(clockMs).toISOString();
      },
      claim: { ok: true, leaseId: "lease-1", heartbeatAt: new Date(clockMs).toISOString() },
      renewLease: () => ({ ok: false, result: "not-owned" }),
      livenessOf: (poll) => ({
        readings: [
          {
            kind: "session-traffic",
            status: "sourced",
            value: poll,
            observedAt: "2026-11-08T10:00:00.000Z",
          },
          {
            kind: "process",
            status: "sourced",
            value: poll,
            observedAt: "2026-11-08T10:00:00.000Z",
          },
        ],
      }),
      collectAfterPolls: 4,
      restartBudget: 3,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(2);
      expect(run.envelope?.data?.result).toBe("state-unverified");
      expect(run.envelope?.data?.lastMessage).toContain(
        "the lease was no longer this invocation's",
      );
      expect(scenario.calls.releases).toHaveLength(0);
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.evidenceRefs).toContain("lease:not-owned");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-PEAK-010 the withhold renews rather than letting the heartbeat reach the TTL", () => {
  test("a clean session end renews inside the grace-plus-cadence withhold", async () => {
    const renewals: string[] = [];
    let heartbeat = "2026-11-12T11:00:00.000Z";
    const { scenario } = createPeakScenario({
      label: "gh413-withhold-renewal",
      startMs: Date.parse("2026-11-12T11:00:00.000Z"),
      rules: { delivery: undefined },
      nomination: "delivery",
      watchEnabled: false,
      claim: { ok: true, leaseId: "lease-1", heartbeatAt: heartbeat },
      renewLease: ({ expectedHeartbeatAt }) => {
        renewals.push(expectedHeartbeatAt);
        heartbeat = new Date(Date.parse(heartbeat) + 1_000).toISOString();
        return { ok: true, result: "renewed", heartbeatAt: heartbeat, leaseId: "lease-1" };
      },
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(renewals.length).toBeGreaterThan(0);
    } finally {
      scenario.dispose();
    }
  });
});
