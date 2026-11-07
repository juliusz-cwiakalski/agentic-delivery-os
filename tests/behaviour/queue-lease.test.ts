/**
 * TC-LEASE-001..013 (GH-237) — the domain/state lease rows: single-flight,
 * conflict identity, staleness and takeover evidence, renewal, release,
 * repository-key contention, scope, fail-closed history, and the daemon-free
 * plan → claim → release path.
 */
import { describe, expect, test } from "bun:test";
import {
  claimQueueLease,
  declareQueueEntry,
  queueLeaseRecordKey,
  readActiveLeases,
  readQueueIncidents,
  readQueueLeases,
  readQueueParks,
  releaseQueueLease,
} from "../../packages/core/src/app/index";
import {
  QUEUE_LEASE_RECORD_KIND,
  QUEUE_LEASE_SCHEMA,
  type QueueLeaseRecord,
} from "../../packages/core/src/contracts/index";
import {
  computeQueueSchedule,
  evaluateClaimPreconditions,
} from "../../packages/core/src/domain/index";
import { REPO, recordingStore } from "../fixtures/queue/leases/fence-harness";
import { makeFacts, REPO_A, REPO_B } from "../fixtures/queue/schedule/harness";
import { armAppendFailure, makeAuditStore } from "../fixtures/state/harness";

const NOW_ISO = "2026-11-07T10:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
const ROOT = "/work/repo-alpha";
const TTL = 90_000;

const seedEntry = (
  store: Parameters<typeof declareQueueEntry>[0],
  ref = "GH-320",
  repository = REPO,
) => {
  const result = declareQueueEntry(store, {
    ref,
    repository,
    repositoryRoot: ROOT,
    priority: 1,
    recordedAt: NOW_ISO,
    fenceToken: `seed-entry-${ref}`,
  });
  expect(result.ok).toBe(true);
};

const seedLease = (
  store: Parameters<typeof claimQueueLease>[0],
  input: {
    readonly holder: string;
    readonly ref: string;
    readonly repository: string;
    readonly heartbeatAt: string;
    readonly ttlMs?: number;
  },
): void => {
  const acquired = store.acquireFence(`seed-lease-${input.holder}`);
  expect(acquired.ok).toBe(true);
  if (!acquired.ok) return;
  try {
    const record: QueueLeaseRecord = {
      schema: QUEUE_LEASE_SCHEMA,
      leaseId: `${input.repository}#${input.holder}@${input.heartbeatAt}`,
      scope: "repo-exclusive",
      repository: input.repository,
      holder: input.holder,
      ref: input.ref,
      runner: "runner-a",
      weightClass: "standard",
      operation: "acquired",
      acquiredAt: input.heartbeatAt,
      heartbeatAt: input.heartbeatAt,
      ttlMs: input.ttlMs ?? TTL,
      recordedAt: input.heartbeatAt,
    };
    const appended = store.append(acquired.value.handle, {
      kind: QUEUE_LEASE_RECORD_KIND,
      recordKey: queueLeaseRecordKey(input.repository),
      payload: record as never,
    });
    expect(appended.ok).toBe(true);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};

const claim = (
  store: Parameters<typeof claimQueueLease>[0],
  holder: string,
  overrides: { readonly ttlMs?: number; readonly nowMs?: number; readonly nowIso?: string } = {},
) =>
  claimQueueLease(store, {
    ref: "GH-320",
    holder,
    runner: "runner-a",
    weightClass: "standard",
    ...(overrides.ttlMs === undefined ? {} : { ttlMs: overrides.ttlMs }),
    nowIso: overrides.nowIso ?? NOW_ISO,
    nowMs: overrides.nowMs ?? NOW_MS,
    fenceToken: `claim-${holder}`,
  });

const heartbeatAgo = (ageMs: number): string => new Date(NOW_MS - ageMs).toISOString();

describe("TC-LEASE-001 same-repo single-flight", () => {
  test("one repo-exclusive holder and the other entry held lease-held", () => {
    const fixture = makeAuditStore("queue-lease-single");
    seedEntry(fixture.store);
    expect(claim(fixture.store, "holder-a").ok).toBe(true);
    const schedule = computeQueueSchedule(
      makeFacts([{ ref: "GH-320", repository: REPO_A }], {
        leases: [
          {
            leaseId: "lease-1",
            repository: REPO_A,
            holder: "holder-a",
            ref: "GH-320",
            runner: "runner-a",
            weightClass: "standard",
            scope: "repo-exclusive",
            acquiredAt: NOW_ISO,
            heartbeatAt: NOW_ISO,
            ttlMs: TTL,
            heartbeatAgeMs: 0,
          },
        ],
      }),
    );
    expect(schedule.nextActions).toHaveLength(0);
    expect(schedule.entries[0]?.blocking[0]?.reason).toBe("lease-held");
    expect(schedule.entries[0]?.blocking[0]?.detail).toContain("holder-a");
  });

  test("a second distinct holder refuses with queue.lease-conflict", () => {
    const fixture = makeAuditStore("queue-lease-conflict");
    seedEntry(fixture.store);
    expect(claim(fixture.store, "holder-a").ok).toBe(true);
    const refused = claim(fixture.store, "holder-b");
    expect(refused.ok).toBe(false);
    if (!refused.ok && refused.kind === "queue" && refused.code === "queue.lease-conflict") {
      expect(refused.conflict.holder).toBe("holder-a");
      expect(refused.conflict.leaseId).toContain("holder-a");
      expect(refused.conflict.heartbeatAgeMs).toBe(0);
      expect(refused.conflict.earliestTakeoverAt).toBe(new Date(NOW_MS + TTL).toISOString());
    } else {
      throw new Error("expected a lease conflict");
    }
  });
});

describe("TC-LEASE-003 staleness and takeover", () => {
  test("the staleness bound is inclusive: bound-1 live, bound and bound+1 takeover", () => {
    for (const [age, expected] of [
      [TTL - 1, "conflict"],
      [TTL, "taken-over"],
      [TTL + 1, "taken-over"],
    ] as const) {
      const fixture = makeAuditStore(`queue-lease-stale-${age}`);
      seedEntry(fixture.store);
      seedLease(fixture.store, {
        holder: "holder-a",
        ref: "GH-320",
        repository: REPO,
        heartbeatAt: heartbeatAgo(age),
      });
      const result = claim(fixture.store, "holder-b");
      if (expected === "conflict") {
        expect(result.ok, String(age)).toBe(false);
      } else {
        expect(result.ok, String(age)).toBe(true);
        if (result.ok) expect(result.value.result).toBe("taken-over");
      }
    }
  });

  test("a takeover records previous holder, lease, heartbeat age, and last heartbeat", () => {
    const fixture = makeAuditStore("queue-lease-takeover");
    seedEntry(fixture.store);
    seedLease(fixture.store, {
      holder: "holder-a",
      ref: "GH-320",
      repository: REPO,
      heartbeatAt: heartbeatAgo(TTL + 5_000),
    });
    const result = claim(fixture.store, "holder-b");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.result).toBe("taken-over");
      expect(result.value.lease.takeover?.previousHolder).toBe("holder-a");
      expect(result.value.lease.takeover?.heartbeatAgeMs).toBe(TTL + 5_000);
      expect(result.value.incident?.type).toBe("lease-stale-takeover");
    }
    const incidents = readQueueIncidents(fixture.store);
    expect(incidents.ok).toBe(true);
    if (incidents.ok) {
      expect(incidents.records).toHaveLength(1);
      expect(incidents.records[0]?.type).toBe("lease-stale-takeover");
      expect(incidents.records[0]?.repository).toBe(REPO);
    }
  });

  test("a live lease is never taken over", () => {
    const fixture = makeAuditStore("queue-lease-live");
    seedEntry(fixture.store);
    seedLease(fixture.store, {
      holder: "holder-a",
      ref: "GH-320",
      repository: REPO,
      heartbeatAt: heartbeatAgo(TTL - 1),
    });
    expect(claim(fixture.store, "holder-b").ok).toBe(false);
    const active = readActiveLeases(fixture.store, NOW_MS);
    if (active.ok) expect(active.active[0]?.holder).toBe("holder-a");
  });
});

describe("TC-LEASE-004 post-append verification and duplicate refusal", () => {
  test("one new lease record per operation and no duplicate acquisition", () => {
    const fixture = makeAuditStore("queue-lease-verify");
    seedEntry(fixture.store);
    const recording = recordingStore(fixture.store);
    expect(
      claimQueueLease(recording.store, {
        ref: "GH-320",
        holder: "holder-a",
        runner: "runner-a",
        weightClass: "standard",
        nowIso: NOW_ISO,
        nowMs: NOW_MS,
        fenceToken: "verify-1",
      }).ok,
    ).toBe(true);
    expect(recording.leaseRecords()).toHaveLength(1);
    const history = readQueueLeases(fixture.store);
    if (history.ok) {
      expect(history.records.filter((record) => record.operation === "acquired")).toHaveLength(1);
    }
  });

  test("a duplicate acquisition history fails closed", () => {
    const fixture = makeAuditStore("queue-lease-duplicate");
    seedEntry(fixture.store);
    const acquired = fixture.store.acquireFence("dup-1");
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    try {
      const record: QueueLeaseRecord = {
        schema: QUEUE_LEASE_SCHEMA,
        leaseId: "lease-dup",
        scope: "repo-exclusive",
        repository: REPO,
        holder: "holder-a",
        ref: "GH-320",
        runner: "runner-a",
        weightClass: "standard",
        operation: "acquired",
        acquiredAt: NOW_ISO,
        heartbeatAt: NOW_ISO,
        ttlMs: TTL,
        recordedAt: NOW_ISO,
      };
      for (let index = 0; index < 2; index += 1) {
        fixture.store.append(acquired.value.handle, {
          kind: QUEUE_LEASE_RECORD_KIND,
          recordKey: queueLeaseRecordKey(REPO),
          payload: record as never,
        });
      }
    } finally {
      fixture.store.releaseFence(acquired.value.handle);
    }
    const active = readActiveLeases(fixture.store, NOW_MS);
    expect(active.ok).toBe(false);
    if (!active.ok) expect(active.code).toBe("state.store.torn");
  });
});

describe("TC-LEASE-005 conflict identity", () => {
  test("the conflict names holder, lease, acquisition time, heartbeat age, and takeover time", () => {
    const fixture = makeAuditStore("queue-lease-identity");
    seedEntry(fixture.store);
    seedLease(fixture.store, {
      holder: "holder-a",
      ref: "GH-320",
      repository: REPO,
      heartbeatAt: heartbeatAgo(10_000),
    });
    const refused = claim(fixture.store, "holder-b");
    expect(refused.ok).toBe(false);
    if (!refused.ok && refused.kind === "queue" && refused.code === "queue.lease-conflict") {
      expect(refused.conflict.holder).toBe("holder-a");
      expect(refused.conflict.leaseId).toContain("holder-a");
      expect(refused.conflict.acquiredAt).toBe(heartbeatAgo(10_000));
      expect(refused.conflict.heartbeatAgeMs).toBe(10_000);
      expect(refused.detail).toContain("earliestTakeoverAt");
    }
  });
});

describe("TC-LEASE-006 unreadable lease history fails closed", () => {
  test("a wrong kind under a lease key refuses state.store.torn with zero appends", () => {
    const fixture = makeAuditStore("queue-lease-torn");
    seedEntry(fixture.store);
    const acquired = fixture.store.acquireFence("torn-1");
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    try {
      fixture.store.append(acquired.value.handle, {
        kind: "queue.leasex",
        recordKey: queueLeaseRecordKey(REPO),
        payload: { schema: QUEUE_LEASE_SCHEMA },
      });
    } finally {
      fixture.store.releaseFence(acquired.value.handle);
    }
    const recording = recordingStore(fixture.store);
    const refused = claim(recording.store, "holder-a");
    expect(refused.ok).toBe(false);
    if (!refused.ok && refused.kind === "state") {
      expect(refused.code).toBe("state.store.torn");
    }
    expect(recording.appends()).toBe(0);
  });
});

describe("TC-LEASE-008 repository key defines the contention domain", () => {
  test("different repositories never contend", () => {
    const fixture = makeAuditStore("queue-lease-repo-keys");
    seedEntry(fixture.store, "GH-320", REPO_A);
    seedEntry(fixture.store, "GH-321", REPO_B);
    const first = claimQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "holder-a",
      runner: "runner-a",
      weightClass: "standard",
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "repo-a",
    });
    const second = claimQueueLease(fixture.store, {
      ref: "GH-321",
      holder: "holder-b",
      runner: "runner-a",
      weightClass: "standard",
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "repo-b",
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    const active = readActiveLeases(fixture.store, NOW_MS);
    if (active.ok)
      expect(active.active.map((lease) => lease.repository).sort()).toEqual([REPO_A, REPO_B]);
  });
});

describe("TC-LEASE-009 scope is repo-exclusive; no worktree path", () => {
  test("every landed lease record carries the single implemented scope", () => {
    const fixture = makeAuditStore("queue-lease-scope");
    seedEntry(fixture.store);
    expect(claim(fixture.store, "holder-a").ok).toBe(true);
    const history = readQueueLeases(fixture.store);
    expect(history.ok).toBe(true);
    if (history.ok) {
      expect(history.records.every((record) => record.scope === "repo-exclusive")).toBe(true);
      expect(history.records.some((record) => record.scope === "worktree")).toBe(false);
    }
  });
});

describe("TC-LEASE-010 release is an explicit idempotent no-op", () => {
  test("release lands once and a second release is a noop", () => {
    const fixture = makeAuditStore("queue-lease-release");
    seedEntry(fixture.store);
    expect(claim(fixture.store, "holder-a").ok).toBe(true);
    const released = releaseQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "holder-a",
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "release-1",
    });
    expect(released.ok).toBe(true);
    if (released.ok) expect(released.value.result).toBe("released");
    const again = releaseQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "holder-a",
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "release-2",
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.value.result).toBe("noop");
    const active = readActiveLeases(fixture.store, NOW_MS);
    if (active.ok) expect(active.active).toHaveLength(0);
  });
});

describe("TC-LEASE-011 release another holder refuses", () => {
  test("a release by a different holder is a lease conflict", () => {
    const fixture = makeAuditStore("queue-lease-release-other");
    seedEntry(fixture.store);
    seedLease(fixture.store, {
      holder: "holder-a",
      ref: "GH-320",
      repository: REPO,
      heartbeatAt: NOW_ISO,
    });
    const refused = releaseQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "holder-b",
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "release-other",
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok && refused.kind === "queue") {
      expect(refused.code).toBe("queue.lease-conflict");
    }
  });
});

describe("TC-LEASE-012 claim precondition names the reason", () => {
  test("parks, readiness, outranking, and weight refuse with named reasons", () => {
    const deps = makeFacts([
      {
        ref: "GH-320",
        repository: REPO_A,
        workItem: {
          state: "observed",
          deliveryState: "ready",
          labels: ["priority:high"],
          blockedBy: ["GH-300"],
        },
      },
      { ref: "GH-300", repository: REPO_B },
    ]);
    expect(evaluateClaimPreconditions(deps, "GH-320")).toMatchObject({
      ok: false,
      code: "queue.precondition.unmet",
      reason: "dependency-open",
    });

    const parked = makeFacts([
      {
        ref: "GH-320",
        repository: REPO_A,
        park: { state: "active", cause: "provider-quota", recheckMs: 300000 },
      },
    ]);
    expect(evaluateClaimPreconditions(parked, "GH-320")).toMatchObject({
      ok: false,
      code: "queue.precondition.unmet",
      reason: "parked:provider-quota",
    });

    const stuck = makeFacts([
      { ref: "GH-320", repository: REPO_A, park: { state: "stuck", cause: "provider-window" } },
    ]);
    expect(evaluateClaimPreconditions(stuck, "GH-320")).toMatchObject({
      ok: false,
      code: "queue.park-condition-stuck",
    });

    const healthy = makeFacts([{ ref: "GH-320", repository: REPO_A }]);
    expect(evaluateClaimPreconditions(healthy, "GH-320", { outrankedBy: "GH-301" })).toMatchObject({
      ok: false,
      reason: "outranked",
    });
    expect(evaluateClaimPreconditions(healthy, "GH-320", { weightHeldBy: "GH-309" })).toMatchObject(
      { ok: false, reason: "weight-class" },
    );
    expect(evaluateClaimPreconditions(healthy, "GH-320").ok).toBe(true);
  });
});

describe("TC-LEASE-013 renewal keeps the holder", () => {
  test("a repeated claim by the holder refreshes the heartbeat without changing identity", () => {
    const fixture = makeAuditStore("queue-lease-renew");
    seedEntry(fixture.store);
    const first = claim(fixture.store, "holder-a");
    expect(first.ok).toBe(true);
    const second = claimQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "holder-a",
      runner: "runner-a",
      weightClass: "standard",
      nowIso: "2026-11-07T10:00:30Z",
      nowMs: NOW_MS + 30_000,
      fenceToken: "renew-2",
    });
    expect(second.ok).toBe(true);
    if (second.ok && first.ok) {
      expect(second.value.result).toBe("renewed");
      expect(second.value.lease.leaseId).toBe(first.value.lease.leaseId);
      expect(second.value.lease.holder).toBe("holder-a");
      expect(second.value.lease.heartbeatAt).toBe("2026-11-07T10:00:30Z");
    }
    const active = readActiveLeases(fixture.store, NOW_MS + 30_000);
    if (active.ok) expect(active.active[0]?.heartbeatAgeMs).toBe(0);
  });
});

describe("TC-LEASE-007 lease TTL is configuration-only tuning", () => {
  test("the same heartbeat age is live under a longer TTL and stale under a shorter one", () => {
    const longTtl = makeAuditStore("queue-lease-ttl-long");
    seedEntry(longTtl.store);
    seedLease(longTtl.store, {
      holder: "holder-a",
      ref: "GH-320",
      repository: REPO,
      heartbeatAt: heartbeatAgo(60_000),
      ttlMs: 120_000,
    });
    expect(claim(longTtl.store, "holder-b").ok).toBe(false);

    const shortTtl = makeAuditStore("queue-lease-ttl-short");
    seedEntry(shortTtl.store);
    seedLease(shortTtl.store, {
      holder: "holder-a",
      ref: "GH-320",
      repository: REPO,
      heartbeatAt: heartbeatAgo(60_000),
      ttlMs: 60_000,
    });
    const taken = claim(shortTtl.store, "holder-b");
    expect(taken.ok).toBe(true);
    if (taken.ok) expect(taken.value.result).toBe("taken-over");
  });
});

describe("TC-SCHED-010 daemon-free plan → claim → release", () => {
  test("the domain path computes, claims, and releases with consistent state", () => {
    const fixture = makeAuditStore("queue-lease-e2e");
    seedEntry(fixture.store);
    const facts = makeFacts([{ ref: "GH-320", repository: REPO_A }]);
    const plan = computeQueueSchedule(facts, { next: 1 });
    expect(plan.nextActions).toHaveLength(1);
    const claimed = claim(fixture.store, "one-shot-1");
    expect(claimed.ok).toBe(true);
    const released = releaseQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "one-shot-1",
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "e2e-release",
    });
    expect(released.ok).toBe(true);
    const history = readQueueLeases(fixture.store);
    if (history.ok) {
      const latest = history.records[history.records.length - 1];
      expect(latest?.operation).toBe("released");
    }
  });
});

describe("TC-LEASE-011 / TC-RANK-004 release plus park atomicity", () => {
  test("an accepted cause releases and records its paired park in one transaction", () => {
    const fixture = makeAuditStore("queue-lease-release-park");
    seedEntry(fixture.store);
    expect(claim(fixture.store, "holder-a").ok).toBe(true);
    const parked = releaseQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "holder-a",
      park: {
        cause: "preempted-for-close-item",
        condition: { type: "preemption" },
        recheckMs: 60_000,
      },
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "release-park",
    });
    expect(parked.ok).toBe(true);
    if (parked.ok) {
      expect(parked.value.result).toBe("parked");
      expect(parked.value.park?.cause).toBe("preempted-for-close-item");
      expect(parked.value.park?.conditionType).toBe("preemption");
    }
    const parks = readQueueParks(fixture.store);
    expect(parks.ok).toBe(true);
    if (parks.ok) expect(parks.records).toHaveLength(1);
  });

  test("a cause/condition-type mismatch is refused before any append", () => {
    const fixture = makeAuditStore("queue-lease-release-pairing");
    seedEntry(fixture.store);
    expect(claim(fixture.store, "holder-a").ok).toBe(true);
    const before = readQueueLeases(fixture.store);
    const beforeCount = before.ok ? before.records.length : 0;
    const refused = releaseQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "holder-a",
      park: {
        cause: "provider-window",
        condition: { type: "preemption" },
      },
      nowIso: NOW_ISO,
      nowMs: NOW_MS,
      fenceToken: "release-pairing",
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.kind).toBe("input");
    const after = readQueueLeases(fixture.store);
    expect(after.ok ? after.records.length : -1).toBe(beforeCount);
    const parks = readQueueParks(fixture.store);
    expect(parks.ok ? parks.records.length : -1).toBe(0);
  });

  test("a refused first append lands neither side of the transaction", () => {
    const fixture = makeAuditStore("queue-lease-release-refused");
    seedEntry(fixture.store);
    expect(claim(fixture.store, "holder-a").ok).toBe(true);
    const beforeLeases = readQueueLeases(fixture.store);
    const beforeCount = beforeLeases.ok ? beforeLeases.records.length : 0;
    const armed = armAppendFailure(fixture.edge, 1);
    try {
      const refused = releaseQueueLease(fixture.store, {
        ref: "GH-320",
        holder: "holder-a",
        park: { cause: "provider-quota", condition: { type: "provider-quota" } },
        nowIso: NOW_ISO,
        nowMs: NOW_MS,
        fenceToken: "release-refused",
      });
      expect(refused.ok).toBe(false);
    } finally {
      armed.restore();
    }
    const afterLeases = readQueueLeases(fixture.store);
    expect(afterLeases.ok ? afterLeases.records.length : -1).toBe(beforeCount);
    const parks = readQueueParks(fixture.store);
    expect(parks.ok ? parks.records.length : -1).toBe(0);
  });
});
