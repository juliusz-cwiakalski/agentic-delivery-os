/**
 * TC-PEAK-011 — `dispatch status` reports the additive park fact and the three
 * parked-lane probe arms over the delivered `stale`/`delivering` derivation
 * (GH-413 F-6, AC-F6-1, AC-F6-5, DM-3, DEC-9, NFR-9).
 */
import { describe, expect, test } from "bun:test";
import type { StateRecord, StateStorePort } from "../../packages/core/src/contracts/index";
import { readOperatorStatus } from "../../packages/core/src/app/dispatch-lane-view";

const REPOSITORY = "github.com/owner/repo";
const NOW = "2026-11-19T00:00:00.000Z";
const UNTIL = "2026-11-19T02:00:00.000Z";

const laneRecord = (): StateRecord => ({
  schemaVersion: "delivery.state.v1",
  kind: "dispatch.lane",
  key: "dispatch.lanes:GH-413",
  sequence: 1,
  checksum: "fixture",
  payload: {
    schema: "delivery.dispatch.lane.v1",
    ref: "GH-413",
    repository: REPOSITORY,
    attemptId: "attempt-1",
    sessionId: "ses-1",
    harnessKind: "opencode",
    owner: { processId: 4242, startedAt: NOW },
    iterationOrdinal: 1,
    restartsConsumed: 0,
    state: "active",
    recordedAt: NOW,
  } as never,
});

const parkRecord = (overrides: Record<string, unknown> = {}): StateRecord => ({
  schemaVersion: "delivery.state.v1",
  kind: "queue.park",
  key: "queue.parks:GH-413",
  sequence: 2,
  checksum: "fixture",
  payload: {
    schema: "delivery.queue.park.v1",
    ref: "GH-413",
    repository: REPOSITORY,
    cause: "peak-window",
    conditionType: "provider-window",
    condition: { type: "provider-window", expiresAt: UNTIL },
    recheckMs: 60_000,
    evaluatedAt: NOW,
    recoveryState: "parked",
    providerProfile: "delivery",
    until: UNTIL,
    graceDeadline: NOW,
    windowEnd: UNTIL,
    stoppedAt: NOW,
    preservation: "preserved",
    episodeId: "episode-1",
    recordedAt: NOW,
    ...overrides,
  } as never,
});

const storeOf = (records: readonly StateRecord[]) => {
  let reads = 0;
  const store = {
    readRecords: () => {
      reads += 1;
      return {
        ok: true as const,
        value: {
          records,
          evidence: {
            storePath: "state/ledger.jsonl",
            verification: ["framing", "terminal", "sequence", "checksum"],
            verifiedEmpty: records.length === 0,
            recordCount: records.length,
          },
        },
      };
    },
  } as unknown as StateStorePort;
  return { store, reads: () => reads };
};

const statusOf = (probe: "live" | "unknown" | "dead", park = true) => {
  const fixture = storeOf(park ? [laneRecord(), parkRecord()] : [laneRecord()]);
  const result = readOperatorStatus({
    store: fixture.store,
    repository: REPOSITORY,
    ref: "GH-413",
    probe: () => probe,
  });
  if (!result.ok) throw new Error(result.code);
  return { data: result.data, reads: fixture.reads() };
};

describe("TC-PEAK-011 the status park fact and the three probe arms", () => {
  test("the park fact carries the cause, end, stop instant, preservation, and refusal", () => {
    const fixture = storeOf([
      laneRecord(),
      parkRecord({ recoveryRefusal: "dispatch.resume-uneconomical" }),
    ]);
    const result = readOperatorStatus({
      store: fixture.store,
      repository: REPOSITORY,
      ref: "GH-413",
      probe: () => "live",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.park).toEqual({
      cause: "peak-window",
      until: UNTIL,
      stoppedAt: NOW,
      preservation: "preserved",
      recoveryRefusal: "dispatch.resume-uneconomical",
    });
    // One bounded lane read plus at most one bounded park read.
    expect(fixture.reads()).toBe(2);
  });

  test("live and unknown report stale false with delivering true and the park fact present", () => {
    for (const probe of ["live", "unknown"] as const) {
      const { data } = statusOf(probe);
      expect(data.stale, probe).toBe(false);
      expect(data.delivering, probe).toBe(true);
      expect(data.park?.until, probe).toBe(UNTIL);
    }
  });

  test("dead reports stale true and delivering false with the recorded end visible", () => {
    const { data } = statusOf("dead");
    expect(data.stale).toBe(true);
    expect(data.delivering).toBe(false);
    expect(data.park?.until).toBe(UNTIL);
  });

  test("the park fact is absent, never null, when no park stands", () => {
    const { data } = statusOf("live", false);
    expect(Object.hasOwn(data, "park")).toBe(false);
  });
});
