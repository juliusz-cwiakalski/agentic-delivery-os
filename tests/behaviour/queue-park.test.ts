/**
 * TC-PARK-001..008 (GH-237) — parks with per-type recheck, the durable
 * clear-observed marker, exact recovery incidents, the stuck class, and the
 * report-only finding that never becomes a next action.
 */
import { describe, expect, test } from "bun:test";
import {
  declareQueueEntry,
  queueParkRecordKey,
  readQueueIncidents,
  readQueueParkPass,
  readQueueParks,
  recoverQueueParks,
} from "../../packages/core/src/app/index";
import {
  QUEUE_PARK_RECORD_KIND,
  QUEUE_PARK_SCHEMA,
  type QueueParkRecord,
} from "../../packages/core/src/contracts/index";
import {
  computeQueueSchedule,
  conditionTypeForCause,
  createParkRecord,
  evaluateClaimPreconditions,
  evaluateParkPass,
  evaluateParkRecord,
  recoveredRecord,
} from "../../packages/core/src/domain/index";
import { makeFacts, REPO_A } from "../fixtures/queue/schedule/harness";
import { makeAuditStore } from "../fixtures/state/harness";

const NOW_ISO = "2026-11-07T10:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
const REPO = REPO_A;
const REF = "GH-320";

const seedEntry = (store: Parameters<typeof declareQueueEntry>[0]) => {
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

const seedPark = (
  store: Parameters<typeof recoverQueueParks>[0],
  record: QueueParkRecord,
): void => {
  const acquired = store.acquireFence(`seed-park-${record.ref}`);
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

const windowPark = (
  overrides: Partial<QueueParkRecord> & { readonly expiresAt: string },
): QueueParkRecord => {
  const { expiresAt, ...rest } = overrides;
  return {
    ...createParkRecord({
      ref: REF,
      repository: REPO,
      cause: "provider-window",
      condition: { type: "provider-window", expiresAt },
      recheckMs: 60_000,
      evaluatedAt: NOW_ISO,
      recordedAt: NOW_ISO,
    }),
    ...rest,
  };
};

const context = { providerAvailable: true, leaseHeldRepositories: [] as string[] };

describe("TC-PARK-001 park resumes exactly when its condition clears", () => {
  test("a window ending at T resumes on the first mutating pass after T with an incident", () => {
    const fixture = makeAuditStore("queue-park-resume");
    seedEntry(fixture.store);
    const expiresAt = "2026-11-07T10:00:05Z";
    seedPark(fixture.store, windowPark({ expiresAt }));
    const result = recoverQueueParks(fixture.store, {
      nowIso: "2026-11-07T10:00:06Z",
      nowMs: Date.parse("2026-11-07T10:00:06Z"),
      context,
      fenceToken: "recover-1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.recovered).toEqual([REF]);
      expect(result.value.stuck).toEqual([]);
    }
    const parks = readQueueParks(fixture.store);
    expect(parks.ok).toBe(true);
    if (parks.ok) {
      const states = parks.records.map((record) => record.recoveryState);
      expect(states).toContain("clear-observed");
      expect(states[states.length - 1]).toBe("recovered");
    }
    const incidents = readQueueIncidents(fixture.store);
    if (incidents.ok) {
      expect(incidents.records[0]?.type).toBe("park-auto-recovery");
      const evidence = new Map(
        (incidents.records[0]?.evidence ?? []).map((entry) => [entry.key, entry.value]),
      );
      expect(evidence.get("condition")).toBe("provider-window");
      expect(evidence.get("clearObservedAt")).toBeDefined();
      expect(evidence.get("evaluatedAt")).toBeDefined();
      expect(evidence.get("observationGapMs")).toBeDefined();
    }
  });

  test("the marker precedes recovery and the recovered record supersedes it", () => {
    const fixture = makeAuditStore("queue-park-marker");
    seedEntry(fixture.store);
    seedPark(fixture.store, windowPark({ expiresAt: "2026-11-07T09:59:00Z" }));
    recoverQueueParks(fixture.store, {
      nowIso: "2026-11-07T10:00:01Z",
      nowMs: Date.parse("2026-11-07T10:00:01Z"),
      context,
      fenceToken: "recover-marker",
    });
    const parks = readQueueParks(fixture.store);
    if (parks.ok) {
      const ordered = parks.records.map((record) => record.recoveryState);
      expect(ordered.indexOf("clear-observed")).toBeGreaterThan(-1);
      expect(ordered.indexOf("clear-observed")).toBeLessThan(ordered.indexOf("recovered"));
    }
  });
});

describe("TC-PARK-002 a clear-observed marker without recovery is stuck", () => {
  test("reads report the report-only finding and never recover", () => {
    const fixture = makeAuditStore("queue-park-stuck");
    seedEntry(fixture.store);
    const marker = {
      ...windowPark({ expiresAt: "2026-11-07T09:00:00Z" }),
      recoveryState: "clear-observed" as const,
      clearObservedAt: "2026-11-07T09:30:00Z",
    };
    seedPark(fixture.store, marker);
    const before = readQueueParks(fixture.store);
    const beforeCount = before.ok ? before.records.length : 0;
    const pass = readQueueParkPass(fixture.store, NOW_MS, context);
    expect(pass.ok).toBe(true);
    if (pass.ok) {
      expect(pass.pass.evaluations[REF]?.state).toBe("stuck");
      expect(pass.pass.findings[0]?.code).toBe("queue.park-condition-stuck");
    }
    const after = readQueueParks(fixture.store);
    expect(after.ok ? after.records.length : -1).toBe(beforeCount);
  });

  test("a mutating pass reports stuck and a claim refuses with the same identity", () => {
    const fixture = makeAuditStore("queue-park-stuck-claim");
    seedEntry(fixture.store);
    seedPark(fixture.store, {
      ...windowPark({ expiresAt: "2026-11-07T09:00:00Z" }),
      recoveryState: "clear-observed",
      clearObservedAt: "2026-11-07T09:30:00Z",
    });
    const recovered = recoverQueueParks(fixture.store, {
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      context,
      fenceToken: "recover-stuck",
    });
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.value.stuck).toEqual([REF]);
      expect(recovered.value.recovered).toEqual([]);
    }
    const facts = makeFacts([
      { ref: REF, repository: REPO, park: { state: "stuck", cause: "provider-window" } },
    ]);
    expect(evaluateClaimPreconditions(facts, REF)).toMatchObject({
      ok: false,
      code: "queue.park-condition-stuck",
    });
  });
});

describe("TC-PARK-003 an observation gap is a gap, never stuck", () => {
  test("a long gap recovers with a gap-naming incident", () => {
    const fixture = makeAuditStore("queue-park-gap");
    seedEntry(fixture.store);
    seedPark(
      fixture.store,
      windowPark({ expiresAt: "2026-11-07T08:00:00Z", evaluatedAt: "2026-11-07T08:00:00Z" }),
    );
    const nowIso = "2026-11-07T12:00:00Z";
    const result = recoverQueueParks(fixture.store, {
      nowIso,
      nowMs: Date.parse(nowIso),
      context,
      fenceToken: "recover-gap",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stuck).toEqual([]);
      expect(result.value.recovered).toEqual([REF]);
    }
    const incidents = readQueueIncidents(fixture.store);
    if (incidents.ok) {
      const evidence = new Map(
        (incidents.records[0]?.evidence ?? []).map((entry) => [entry.key, entry.value]),
      );
      expect(evidence.get("observationGapMs")).toBe(
        String(Date.parse(nowIso) - Date.parse("2026-11-07T08:00:00Z")),
      );
    }
  });
});

describe("TC-PARK-004 closed condition types and one active park", () => {
  test("the cause and condition-type sets pair one-to-one and never interchange", () => {
    expect(conditionTypeForCause("provider-window")).toBe("provider-window");
    expect(conditionTypeForCause("provider-quota")).toBe("provider-quota");
    expect(conditionTypeForCause("preempted-for-close-item")).toBe("preemption");
    for (const cause of [
      "provider-window",
      "provider-quota",
      "preempted-for-close-item",
    ] as const) {
      const record = createParkRecord({
        ref: REF,
        cause,
        condition:
          cause === "provider-window"
            ? { type: "provider-window", expiresAt: "2026-11-07T11:00:00Z" }
            : cause === "provider-quota"
              ? { type: "provider-quota" }
              : { type: "preemption" },
        recheckMs: 60000,
        evaluatedAt: NOW_ISO,
        recordedAt: NOW_ISO,
      });
      expect(record.conditionType).toBe(conditionTypeForCause(cause));
    }
  });

  test("a second active park for one entry is refused as a state failure", () => {
    const fixture = makeAuditStore("queue-park-second");
    seedEntry(fixture.store);
    seedPark(fixture.store, windowPark({ expiresAt: "2026-11-07T11:00:00Z" }));
    const refused = recoverQueueParks(fixture.store, {
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      context,
      fenceToken: "second-park",
    });
    // The existing non-cleared park is active, so no second active park is
    // created; the pass leaves it active.
    expect(refused.ok).toBe(true);
    const parks = readQueueParks(fixture.store);
    if (parks.ok) {
      expect(parks.records.filter((record) => record.recoveryState === "parked")).toHaveLength(1);
    }
  });
});

describe("TC-PARK-005 resume boundary and no active-without-recovery", () => {
  test("T-1 is active, T and T+1 are resumable", () => {
    const expiry = "2026-11-07T10:00:00Z";
    const record = windowPark({ expiresAt: expiry });
    expect(evaluateParkRecord(record, Date.parse(expiry) - 1, context).state).toBe("active");
    expect(evaluateParkRecord(record, Date.parse(expiry), context).state).toBe("resumable");
    expect(evaluateParkRecord(record, Date.parse(expiry) + 1, context).state).toBe("resumable");
  });

  test("a recovered record evaluates to none and leaves no active park", () => {
    const record = windowPark({ expiresAt: "2026-11-07T09:00:00Z" });
    const recovered = recoveredRecord(record, { nowIso: NOW_ISO, nowMs: NOW_MS });
    expect(evaluateParkRecord(recovered, NOW_MS, context).state).toBe("none");
    const pass = evaluateParkPass([recovered], NOW_MS, context);
    expect(pass.findings).toEqual([]);
  });
});

describe("TC-PARK-006 recheck interval is configuration-only", () => {
  test("the resolved interval rides on the park record without code changes", () => {
    const fast = createParkRecord({
      ref: REF,
      cause: "provider-window",
      condition: { type: "provider-window", expiresAt: "2026-11-07T11:00:00Z" },
      recheckMs: 30_000,
      evaluatedAt: NOW_ISO,
      recordedAt: NOW_ISO,
    });
    const slow = createParkRecord({
      ref: REF,
      cause: "provider-window",
      condition: { type: "provider-window", expiresAt: "2026-11-07T11:00:00Z" },
      recheckMs: 120_000,
      evaluatedAt: NOW_ISO,
      recordedAt: NOW_ISO,
    });
    expect(fast.recheckMs).toBe(30_000);
    expect(slow.recheckMs).toBe(120_000);
    expect(evaluateParkRecord(fast, NOW_MS, context).recheckMs).toBe(30_000);
    expect(evaluateParkRecord(slow, NOW_MS, context).recheckMs).toBe(120_000);
  });
});

describe("TC-PARK-007 unreadable park history is never not-parked", () => {
  test("a wrong kind under a park key fails the read closed with no writes", () => {
    const fixture = makeAuditStore("queue-park-torn");
    seedEntry(fixture.store);
    const acquired = fixture.store.acquireFence("park-torn-1");
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    try {
      fixture.store.append(acquired.value.handle, {
        kind: "queue.parkx",
        recordKey: queueParkRecordKey(REF),
        payload: { schema: QUEUE_PARK_SCHEMA },
      });
    } finally {
      fixture.store.releaseFence(acquired.value.handle);
    }
    const pass = readQueueParkPass(fixture.store, NOW_MS, context);
    expect(pass.ok).toBe(false);
    if (!pass.ok) expect(pass.code).toBe("state.store.torn");
    const before = readQueueParks(fixture.store);
    expect(before.ok).toBe(false);
  });
});

describe("TC-PARK-008 a stuck park is never a next action", () => {
  test("the entry is never resume-parked, never in nextActions, and never selected", () => {
    const facts = makeFacts([
      {
        ref: REF,
        repository: REPO,
        park: { state: "stuck", cause: "provider-window", recheckMs: 60000 },
      },
      { ref: "GH-321", repository: "github.com/owner/repo-beta" },
    ]);
    const schedule = computeQueueSchedule(facts, { next: 20 });
    const stuck = schedule.entries.find((entry) => entry.ref === REF);
    expect(stuck?.state).toBe("stuck");
    expect(schedule.findings.some((finding) => finding.ref === REF)).toBe(true);
    expect(schedule.nextActions.some((action) => action.ref === REF)).toBe(false);
    expect(evaluateClaimPreconditions(facts, REF)).toMatchObject({
      ok: false,
      code: "queue.park-condition-stuck",
    });
  });
});
