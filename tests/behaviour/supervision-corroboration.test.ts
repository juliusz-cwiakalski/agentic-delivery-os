/**
 * TC-SUP-023 — the corroboration bound cells: below, at, and above the delivered
 * 300,000 ms bound with zero artifact progress, plus the advancing twin
 * (GH-295 AC-F2-1, NFR-1). The boundary is read from the imported constant, so a
 * hard-coded `>` instead of `>=` fails the at-bound cell.
 */
import { describe, expect, test } from "bun:test";
import { readQueueParks } from "../../packages/core/src/app/index";
import {
  SUPERVISION_CORROBORATION_BOUND_MS,
  WATCHDOG_STALL_HEARTBEAT_MS,
} from "../../packages/core/src/contracts/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import { LANE_REF, seedCommitEffect, seedHeartbeat, seedLane } from "../fixtures/supervise/records";

const classifyCell = async (input: { ageMs: number; advancing: boolean }) => {
  const harness = createSupervisionHarness({
    label: `bound-${input.ageMs}-${input.advancing ? "adv" : "flat"}`,
  });
  try {
    seedLane(harness.seed, LANE_REF);
    seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -input.ageMs });
    if (input.advancing) seedCommitEffect(harness.seed, { offsetMs: -60_000 });
    const run = await harness.runCli(["supervise", "--json"]);
    expect(run.exitCode).toBe(0);
    const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
    if (data === undefined) throw new Error("report data missing");
    const parks = readQueueParks(harness.store);
    if (!parks.ok) throw new Error("park read failed");
    return {
      classification: (data.lanes as readonly Record<string, unknown>[])[0]?.classification,
      parks: parks.records.length,
    };
  } finally {
    harness.remove();
  }
};

describe("TC-SUP-023 the corroboration bound is inclusive and imported", () => {
  test("the supervision bound is the delivered stall bound", () => {
    expect(SUPERVISION_CORROBORATION_BOUND_MS).toBe(WATCHDOG_STALL_HEARTBEAT_MS);
  });

  test("299_999 is progressing without a park", async () => {
    const cell = await classifyCell({ ageMs: 299_999, advancing: false });
    expect(cell.classification).toBe("progressing");
    expect(cell.parks).toBe(0);
  });

  test("300_000 is stalled with a park (the inclusive boundary)", async () => {
    const cell = await classifyCell({ ageMs: 300_000, advancing: false });
    expect(cell.classification).toBe("stalled");
    expect(cell.parks).toBe(1);
  });

  test("300_001 is stalled with a park", async () => {
    const cell = await classifyCell({ ageMs: 300_001, advancing: false });
    expect(cell.classification).toBe("stalled");
    expect(cell.parks).toBe(1);
  });

  test("the advancing twin at 300_001 stays progressing with no park", async () => {
    const cell = await classifyCell({ ageMs: 300_001, advancing: true });
    expect(cell.classification).toBe("progressing");
    expect(cell.parks).toBe(0);
  });
});
