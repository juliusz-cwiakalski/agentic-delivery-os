/**
 * TC-SUP-046 (behaviour half) — the battery appends only through the delivered
 * park path: no new record kind appears, pre-change records replay unchanged,
 * and a read-only run leaves the ledger byte-identical (GH-295 DM-4, EVT-1).
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import {
  claimQueueLease,
  createStateSupervisionReadPort,
  readQueueParks,
  releaseQueueLease,
  runSupervisionBattery,
} from "../../packages/core/src/app/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import { LANE_REF, seedHeartbeat, seedLane } from "../fixtures/supervise/records";

const DELIVERED_RECORD_KINDS = new Set([
  "queue.entry",
  "queue.dependency",
  "queue.lease",
  "queue.park",
  "queue.incident",
  "queue.removal",
  "daemon.instance",
  "daemon.heartbeat",
  "daemon.lane",
  "daemon.reconciliation",
  "daemon.preemption",
  "command.receipt",
  "outbox.effect",
  "dispatch.attempt",
  "dispatch.divergence",
  "dispatch.handover",
  "economics.restart",
  "economics.budget-exhaustion",
  "coordinator.iteration",
  "coordinator.restart",
  "coordinator.stuck",
  "coordinator.exhaustion",
  "coordinator.wake",
  "coordinator.fence",
  // The store's derived documents (queue graph) are one delivered kind.
  "document",
]);

const stateDirectoryOf = (harness: ReturnType<typeof createSupervisionHarness>): string =>
  `${harness.directory}/.supervision-state`;

const ledgerDigest = (directory: string): string => {
  const ledger = readdirSync(directory).find((name) => name.startsWith("ledger."));
  if (ledger === undefined) throw new Error("ledger missing");
  return readFileSync(`${directory}/${ledger}`).toString("base64");
};

/** Seed a park written before this change: a delivered provider-window cause. */
const seedPreChangePark = (harness: ReturnType<typeof createSupervisionHarness>): void => {
  const claimed = claimQueueLease(harness.store, {
    ref: LANE_REF,
    holder: "holder-pre",
    runner: "runner-a",
    weightClass: "standard",
    nowIso: harness.nowIso,
    nowMs: harness.nowMs,
    fenceToken: "pre-claim",
  });
  if (!claimed.ok) throw new Error("pre-change claim failed");
  const released = releaseQueueLease(harness.store, {
    ref: LANE_REF,
    holder: "holder-pre",
    park: {
      cause: "provider-window",
      condition: {
        type: "provider-window",
        expiresAt: new Date(harness.nowMs + 60_000).toISOString(),
      },
    },
    nowIso: harness.nowIso,
    nowMs: harness.nowMs,
    fenceToken: "pre-release",
  });
  if (!released.ok) throw new Error("pre-change release failed");
};

describe("TC-SUP-046 no new record kind and no pre-change rewrite", () => {
  test("a stalled run appends only the delivered park record", async () => {
    const harness = createSupervisionHarness({ label: "additivity-run" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const records = harness.store.readRecords();
      if (!records.ok) throw new Error("ledger read failed");
      const kinds = new Set(records.value.records.map((record) => record.kind));
      for (const kind of kinds) {
        expect(DELIVERED_RECORD_KINDS.has(kind), kind).toBe(true);
      }
      const parks = readQueueParks(harness.store);
      if (!parks.ok) throw new Error("park read failed");
      expect(parks.records).toHaveLength(1);
    } finally {
      harness.remove();
    }
  });

  test("pre-change records replay unchanged and a read-only run writes nothing", async () => {
    const harness = createSupervisionHarness({ label: "additivity-replay" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -1_000 });
      seedPreChangePark(harness);
      const before = ledgerDigest(stateDirectoryOf(harness));
      // A read-only battery (no write seam) classifies and appends nothing.
      const readOnly = runSupervisionBattery({
        repository: harness.repository,
        nowMs: harness.nowMs,
        nowIso: harness.nowIso,
        read: createStateSupervisionReadPort(harness.store),
      });
      expect(readOnly.ok).toBe(true);
      if (!readOnly.ok) return;
      expect(readOnly.report.lanes[0]?.classification).toBe("progressing");
      expect(readOnly.report.actions).toEqual([]);
      expect(ledgerDigest(stateDirectoryOf(harness))).toBe(before);
      const parks = readQueueParks(harness.store);
      if (!parks.ok) throw new Error("park read failed");
      expect(parks.records).toHaveLength(1);
      expect(parks.records[0]?.cause).toBe("provider-window");
    } finally {
      harness.remove();
    }
  });
});
