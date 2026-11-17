/**
 * TC-SUP-050 — live supervision claims are inventoried with tri-state, holder,
 * and scope evidence (GH-295 AC-F6-1, DEC-3).
 */
import { describe, expect, test } from "bun:test";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import {
  coordinatorClaim,
  daemonClaim,
  LANE_REF,
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
