/**
 * TC-HOLDQUEUE-007/008/012 (GH-280) — the held pass skips park auto-recovery
 * and leaves the park bytes unchanged; removal recovers the overdue park
 * through the delivered pass without rewriting any preserved record; a
 * delivering lane stays delivering and is never signalled, killed, or parked.
 */
import { describe, expect, test } from "bun:test";
import {
  claimQueueLease,
  declareQueueEntry,
  queueParkRecordKey,
  readQueueIncidents,
  readQueueParkPass,
  readQueueParks,
  recoverQueueParks,
} from "../../packages/core/src/app/index";
import {
  QUEUE_PARK_RECORD_KIND,
  type OwnerHoldFact,
  type QueueParkRecord,
} from "../../packages/core/src/contracts/index";
import {
  computeQueueSchedule,
  createParkRecord,
  foldLanes,
} from "../../packages/core/src/domain/index";
import { activeLease, makeFacts, REPO_A } from "../fixtures/queue/schedule/harness";
import { makeAuditStore } from "../fixtures/state/harness";

const NOW_ISO = "2026-11-07T10:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
const REPO = REPO_A;
const REF = "GH-320";
const HOLD: OwnerHoldFact = {
  active: true,
  source: "marker",
  reason: "peak-hour cost pause",
};
const context = { providerAvailable: true, leaseHeldRepositories: [] as string[] };

const seedEntry = (store: Parameters<typeof declareQueueEntry>[0]): void => {
  const declared = declareQueueEntry(store, {
    ref: REF,
    repository: REPO,
    repositoryRoot: "/work/repo-alpha",
    priority: 1,
    recordedAt: NOW_ISO,
    fenceToken: "seed-entry",
  });
  expect(declared.ok).toBe(true);
};

const seedPark = (store: Parameters<typeof recoverQueueParks>[0]): void => {
  const record: QueueParkRecord = {
    ...createParkRecord({
      ref: REF,
      repository: REPO,
      cause: "provider-window",
      condition: { type: "provider-window", expiresAt: "2026-11-07T09:00:00Z" },
      recheckMs: 60_000,
      evaluatedAt: "2026-11-07T08:58:00Z",
      recordedAt: NOW_ISO,
    }),
  };
  const acquired = store.acquireFence("seed-park");
  expect(acquired.ok).toBe(true);
  if (!acquired.ok) return;
  try {
    const appended = store.append(acquired.value.handle, {
      kind: QUEUE_PARK_RECORD_KIND,
      recordKey: queueParkRecordKey(record.ref),
      payload: record as never,
    });
    expect(appended.ok).toBe(true);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const parkBytes = (store: Parameters<typeof readQueueParks>[0]): string => {
  const read = readQueueParks(store);
  return read.ok ? JSON.stringify(read.records) : "unreadable";
};

describe("TC-HOLDQUEUE-007 park auto-recovery is skipped and the park bytes are unchanged", () => {
  test("a resumable park stays parked while held and recovers only after removal", () => {
    const fixture = makeAuditStore("owner-hold-park");
    seedEntry(fixture.store);
    seedPark(fixture.store);

    const pass = readQueueParkPass(fixture.store, NOW_MS, context);
    expect(pass.ok && pass.pass.evaluations[REF]?.state).toBe("resumable");
    expect(pass.ok && pass.pass.records.length).toBe(1);

    const before = parkBytes(fixture.store);
    const held = recoverQueueParks(fixture.store, {
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      context,
      fenceToken: "held-recovery",
      ownerHold: HOLD,
    });
    expect(held.ok && held.value.recovered).toEqual([]);
    expect(parkBytes(fixture.store)).toBe(before);
    const heldIncidents = readQueueIncidents(fixture.store);
    expect(heldIncidents.ok ? heldIncidents.records : []).toEqual([]);

    const removed = recoverQueueParks(fixture.store, {
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      context,
      fenceToken: "recovery-after-removal",
    });
    expect(removed.ok && removed.value.recovered).toEqual([REF]);
    const after = readQueueParks(fixture.store);
    const states = after.ok ? after.records.map((record) => record.recoveryState) : [];
    expect(states).toContain("clear-observed");
    expect(states[states.length - 1]).toBe("recovered");
    const incidents = readQueueIncidents(fixture.store);
    expect(incidents.ok ? incidents.records.map((record) => record.type) : []).toEqual([
      "park-auto-recovery",
    ]);
  });
});

describe("TC-HOLDQUEUE-008 removal resumes preserved state with no duplicate session", () => {
  test("hold entry and removal rewrite no entry, lease, or park record beyond delivered recovery", () => {
    const fixture = makeAuditStore("owner-hold-resume");
    seedEntry(fixture.store);
    const claimed = claimQueueLease(fixture.store, {
      ref: REF,
      holder: "session-holder",
      runner: "runner-a",
      weightClass: "standard",
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "seed-lease",
    });
    expect(claimed.ok).toBe(true);
    const leaseId = claimed.ok ? claimed.value.lease.leaseId : "";
    seedPark(fixture.store);

    const entriesBefore = fixture.store.readRecords();
    const snapshot = entriesBefore.ok ? JSON.stringify(entriesBefore.value.records) : "";

    const held = recoverQueueParks(fixture.store, {
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      context,
      fenceToken: "held-resume",
      ownerHold: HOLD,
    });
    expect(held.ok).toBe(true);
    const afterHold = fixture.store.readRecords();
    expect(afterHold.ok ? JSON.stringify(afterHold.value.records) : "").toBe(snapshot);

    const removed = recoverQueueParks(fixture.store, {
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      context,
      fenceToken: "resume-after-removal",
    });
    expect(removed.ok && removed.value.recovered).toEqual([REF]);

    const afterRemoval = fixture.store.readRecords();
    const records = afterRemoval.ok ? afterRemoval.value.records : [];
    const leases = records.filter((record) => record.kind === "queue.lease");
    expect(leases).toHaveLength(1);
    const lease = leases[0]?.payload as { leaseId?: string } | undefined;
    expect(lease?.leaseId).toBe(leaseId);
    const entries = records.filter((record) => record.kind === "queue.entry");
    expect(entries).toHaveLength(1);
    const parks = records.filter((record) => record.kind === "queue.park");
    expect(
      parks.map((record) => (record.payload as { recoveryState?: string }).recoveryState),
    ).toEqual(["parked", "clear-observed", "recovered"]);
  });
});

describe("TC-HOLDQUEUE-012 a delivering lane is not signalled, killed, or parked", () => {
  test("the leased lane stays delivering under an active hold", () => {
    const facts = {
      ...makeFacts([{ ref: REF, repository: REPO }], {
        leases: [
          activeLease({ repository: REPO, holder: "session-holder", ref: REF, leaseId: "lease-1" }),
        ],
      }),
      ownerHold: HOLD,
    };
    const schedule = computeQueueSchedule(facts);
    const entry = schedule.entries.find((candidate) => candidate.ref === REF);
    expect(entry?.state).toBe("held");
    expect(entry?.blocking.map((reason) => reason.reason)).toEqual(["owner-hold", "lease-held"]);
    const lanes = foldLanes({ schedule, economics: {}, degraded: [] });
    const lane = lanes.lanes.find((candidate) => candidate.ref === REF);
    expect(lane?.state).toBe("delivering");
    expect(lane?.reason).toBeUndefined();
    expect(schedule.nextActions).toEqual([]);
  });
});
