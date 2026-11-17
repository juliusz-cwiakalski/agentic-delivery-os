/**
 * TC-SUP-082 — the report caps at 200 lanes with explicit truncation and a named
 * reason; evidence respects the delivered byte cap with a declared marker
 * (GH-295 NFR-4, DM-1).
 */
import { describe, expect, test } from "bun:test";
import { runSupervisionBattery } from "../../packages/core/src/app/index";
import {
  SUPERVISION_LANE_CAP,
  SUPERVISION_MAX_EVIDENCE_BYTES,
  SUPERVISION_TRUNCATION_REASONS,
} from "../../packages/core/src/contracts/index";
import { boundSupervisionEvidence } from "../../packages/core/src/domain/index";
import { syntheticReadPort } from "../fixtures/supervise/harness";
import { cappedScope } from "../fixtures/supervise/records";

const run = (laneCount: number) => {
  const reads = { count: 0 };
  const result = runSupervisionBattery({
    repository: "github.com/example/supervision-repo",
    nowMs: Date.parse("2026-11-17T00:00:00.000Z"),
    nowIso: "2026-11-17T00:00:00.000Z",
    read: syntheticReadPort(cappedScope(laneCount), reads),
  });
  if (!result.ok) throw new Error("battery failed");
  return result.report;
};

describe("TC-SUP-082 the lane bound and its named truncation", () => {
  test("200 lanes produce 200 entries with no truncation member", () => {
    const report = run(SUPERVISION_LANE_CAP);
    expect(report.lanes).toHaveLength(200);
    expect(report.truncated).toBe(false);
    expect(Object.hasOwn(report, "truncationReason")).toBe(false);
    expect(report.counts.lanes).toBe(200);
  });

  test("201 lanes produce 200 entries with truncated true and the named reason", () => {
    const report = run(SUPERVISION_LANE_CAP + 1);
    expect(report.lanes).toHaveLength(200);
    expect(report.truncated).toBe(true);
    expect(SUPERVISION_TRUNCATION_REASONS).toContain(report.truncationReason);
    expect(report.truncationReason).toBe("lane-cap");
    // Counts disclose the emitted population truthfully, never silently round.
    expect(report.counts.lanes).toBe(200);
    expect(report.counts.progressing + report.counts.stalled + report.counts.unknown).toBe(
      report.counts.lanes,
    );
  });

  test("evidence is bounded by the delivered cap with a declared overflow marker", () => {
    const oversized = Array.from({ length: 200 }, (_, index) => ({
      code: "artifact-progress" as const,
      ref: `GH-${String(index)}`,
      recordKind: "daemon-lane",
      instant: "2026-11-17T00:00:00.000Z",
    }));
    const bounded = boundSupervisionEvidence(oversized);
    expect(new TextEncoder().encode(JSON.stringify(bounded)).length).toBeLessThanOrEqual(
      SUPERVISION_MAX_EVIDENCE_BYTES,
    );
    expect(bounded.at(-1)?.code).toBe("evidence-truncated");
    // The report's own evidence respects the cap without a marker.
    const report = run(SUPERVISION_LANE_CAP);
    for (const lane of report.lanes) {
      expect(new TextEncoder().encode(JSON.stringify(lane.evidence)).length).toBeLessThanOrEqual(
        SUPERVISION_MAX_EVIDENCE_BYTES,
      );
    }
  });
});
