/**
 * TC-SUP-050 — live supervision claims are inventoried with tri-state, holder,
 * and scope evidence (GH-295 AC-F6-1, DEC-3).
 */
import { describe, expect, test } from "bun:test";
import {
  COORDINATOR_ITERATION_RECORD_KIND,
  DAEMON_HEARTBEAT_RECORD_KIND,
  QUEUE_LEASE_RECORD_KIND,
} from "../../packages/core/src/contracts/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  actingAuthority,
  claimsOnly,
  coordinatorClaim,
  daemonClaim,
  LANE_REF,
  seedCommitEffect,
  seedDaemonInstance,
  seedHeartbeat,
  seedLane,
  seedLiveLease,
} from "../fixtures/supervise/records";

describe("TC-SUP-050 every claim kind is inventoried", () => {
  test("daemon, coordinator, and per-ref claims carry tri-state and identity", () => {
    const harness = createSupervisionHarness({ label: "claims" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedLane(harness.seed, "GH-296");
      daemonClaim(harness.seed, { live: true });
      coordinatorClaim(harness.seed, { live: true });
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "holder-a" });
      const result = harness.battery();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const kinds = result.report.supervisors.map((claim) => claim.claimKind);
      expect(kinds).toContain("daemon-instance");
      expect(kinds).toContain("coordinator-lease");
      expect(kinds).toContain("per-ref-lease");
      const daemon = result.report.supervisors.find(
        (claim) => claim.claimKind === "daemon-instance",
      );
      expect(daemon?.identity).toBe("instance-a");
      expect(daemon?.classification).toBe("progressing");
      const coordinator = result.report.supervisors.find(
        (claim) => claim.claimKind === "coordinator-lease",
      );
      expect(coordinator?.identity).toBe("coordinator-a");
      expect(coordinator?.holder).toBe("coordinator-holder");
      expect(coordinator?.classification).toBe("progressing");
      const perRef = result.report.supervisors.find((claim) => claim.claimKind === "per-ref-lease");
      expect(perRef?.holder).toBe("holder-a");
      expect(perRef?.identity).toBe("holder-a");
      expect(perRef?.classification).toBe("progressing");
      // F-7: each claim names the record kind its heartbeat instant came from.
      const heartbeatKind = (claimKind: string): string | undefined =>
        result.report.supervisors
          .find((claim) => claim.claimKind === claimKind)
          ?.evidence.find(
            (item) =>
              item.code === "artifact-heartbeat-fresh" || item.code === "artifact-heartbeat-aged",
          )?.recordKind;
      expect(heartbeatKind("daemon-instance")).toBe(DAEMON_HEARTBEAT_RECORD_KIND);
      expect(heartbeatKind("coordinator-lease")).toBe(COORDINATOR_ITERATION_RECORD_KIND);
      expect(heartbeatKind("per-ref-lease")).toBe(QUEUE_LEASE_RECORD_KIND);
      for (const claim of result.report.supervisors) {
        expect(claim.evidence.length).toBeGreaterThan(0);
      }
      // The lane entry names the recorded live holder exactly, and the
      // lease-less lane infers none.
      const lane = result.report.lanes.find((entry) => entry.ref === LANE_REF);
      expect(lane?.holder).toBe("holder-a");
      const unheld = result.report.lanes.find((entry) => entry.ref === "GH-296");
      expect(unheld?.holder).toBeUndefined();
      // Lock tokens and credentials never appear in the payload.
      const payload = JSON.stringify(result.report);
      expect(payload).not.toContain("lock-instance-a");
      expect(payload).not.toContain("session-fixture");
    } finally {
      harness.remove();
    }
  });

  test("a claim outside the delivered staleness bound is named not live", () => {
    const harness = createSupervisionHarness({ label: "claims-stale" });
    try {
      seedLane(harness.seed, LANE_REF);
      daemonClaim(harness.seed, { live: false });
      const result = harness.battery();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const daemon = result.report.supervisors.find(
        (claim) => claim.claimKind === "daemon-instance",
      );
      expect(daemon).toBeDefined();
      expect(daemon?.evidence.some((item) => item.code === "claim-not-live")).toBe(true);
      // Staleness is read from the imported bound, never re-declared.
      expect(daemon?.heartbeat).toBeDefined();
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-054 duplicate detection reads records only", () => {
  test("claim-only records ride data at exit 0 and out-of-shape noise changes nothing", async () => {
    const harness = createSupervisionHarness({ label: "claims-only" });
    try {
      seedLane(harness.seed, LANE_REF);
      claimsOnly(harness.seed, { daemonLive: true, coordinatorLive: true });
      const before = await harness.runCli(["supervise", "--json"]);
      expect(before.exitCode).toBe(0);
      // A record the classification shape does not read (an acting preemption
      // for an unrelated object) changes no claim classification.
      actingAuthority(harness.seed, { objectRef: "GH-999" });
      const after = await harness.runCli(["supervise", "--json"]);
      expect(after.exitCode).toBe(0);
      const parseClaims = (text: string) =>
        ((JSON.parse(text) as { data?: Record<string, unknown> }).data?.supervisors ??
          []) as readonly Record<string, unknown>[];
      expect(parseClaims(after.stdout)).toEqual(parseClaims(before.stdout));
      expect(parseClaims(after.stdout).map((claim) => claim.claimKind)).toEqual([
        "daemon-instance",
        "coordinator-lease",
      ]);
    } finally {
      harness.remove();
    }
  });

  test("removing the heartbeat trail flips a claim to unknown", async () => {
    // The control: the same claim records without heartbeats read unknown, which
    // proves records (not any process observation) are the input.
    const harness = createSupervisionHarness({ label: "claims-no-heartbeat" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedCommitEffect(harness.seed, { offsetMs: -60_000 });
      seedDaemonInstance(harness.seed);
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      const daemon = (data.supervisors as readonly Record<string, unknown>[]).find(
        (claim) => claim.claimKind === "daemon-instance",
      );
      expect(daemon?.classification).toBe("unknown");
    } finally {
      harness.remove();
    }
  });
});
