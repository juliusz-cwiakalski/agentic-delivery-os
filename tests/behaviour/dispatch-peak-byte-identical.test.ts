/**
 * TC-PEAK-013 — with no park open the additive members are absent, never null,
 * and the only intended delivered-payload change is `peakEnforcement.mode`
 * (GH-413 F-6, AC-F6-3, NFR-9).
 */
import { describe, expect, test } from "bun:test";
import { readOperatorStatus } from "../../packages/core/src/app/dispatch-lane-view";
import type { StateRecord, StateStorePort } from "../../packages/core/src/contracts/index";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

const REPOSITORY = "github.com/owner/repo";
const NOW = "2026-11-19T00:00:00.000Z";

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

const storeOf = (records: readonly StateRecord[]): StateStorePort =>
  ({
    readRecords: () => ({
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
    }),
  }) as unknown as StateStorePort;

describe("TC-PEAK-013 the no-park additive members are absent", () => {
  test("dispatch status carries no park member when no park stands", () => {
    const result = readOperatorStatus({
      store: storeOf([laneRecord()]),
      repository: REPOSITORY,
      ref: "GH-413",
      probe: () => "live",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.hasOwn(result.data, "park")).toBe(false);
    // Every delivered member is still present and unchanged.
    expect(result.data.query).toBe("status");
    expect(result.data.marker).toBe("active");
    expect(result.data.delivering).toBe(true);
    expect(result.data.stale).toBe(false);
  });

  test("a dispatch result with no episode carries no episode member", async () => {
    const scenario = createCommandScenario({
      label: "gh413-byte-identical",
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom(),
      nowIso: () => new Date("2026-11-12T11:00:00.000Z").toISOString(),
      livenessIntervalMs: 30_000,
      leaseTtlMs: 90_000,
      collectAfterPolls: 2,
      nominate: () => ({ ok: true, profile: "delivery" }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(Object.hasOwn(run.envelope?.data ?? {}, "episode")).toBe(false);
    } finally {
      scenario.dispose();
    }
  });
});
