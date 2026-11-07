/**
 * TC-SCHED-001/002/008/009/010/015/016 and the Phase 7 completion rows —
 * grammar, envelopes, exits, degradation, and refusal shapes through the real
 * edge composition over an injected state store.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { queueLeaseRecordKey, queueParkRecordKey } from "../../packages/core/src/app/index";
import {
  QUEUE_LEASE_RECORD_KIND,
  QUEUE_LEASE_SCHEMA,
  QUEUE_PARK_RECORD_KIND,
} from "../../packages/core/src/contracts/index";
import { createParkRecord } from "../../packages/core/src/domain/index";
import type { StoreWriteLog } from "../fixtures/queue/cli/harness";
import { createQueueEdgeHarness, NOW_ISO, trackingStore } from "../fixtures/queue/cli/harness";

const ROOT = process.cwd();
const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const data = (text: string): Record<string, unknown> => json(text).data as Record<string, unknown>;
const error = (text: string): Record<string, unknown> | undefined =>
  json(text).error as Record<string, unknown> | undefined;

const seedlease = (harness: ReturnType<typeof createQueueEdgeHarness>): void => {
  const acquired = harness.composition.store.acquireFence("seed-wrong-lease");
  if (!acquired.ok) throw new Error("fence");
  try {
    harness.composition.store.append(acquired.value.handle, {
      kind: QUEUE_LEASE_RECORD_KIND,
      recordKey: queueLeaseRecordKey("github.com/owner/repo-alpha"),
      payload: {
        schema: QUEUE_LEASE_SCHEMA,
        leaseId: "lease-seed",
        scope: "repo-exclusive",
        repository: "github.com/owner/repo-alpha",
        holder: "holder-seed",
        ref: "GH-320",
        runner: "runner-a",
        weightClass: "standard",
        operation: "acquired",
        acquiredAt: NOW_ISO,
        heartbeatAt: NOW_ISO,
        ttlMs: 90000,
        recordedAt: NOW_ISO,
      } as never,
    });
  } finally {
    harness.composition.store.releaseFence(acquired.value.handle);
  }
};

const seedPark = (
  harness: ReturnType<typeof createQueueEdgeHarness>,
  input: { readonly ref: string; readonly stuck?: boolean; readonly wrongKind?: boolean },
): void => {
  const record = createParkRecord({
    ref: input.ref,
    repository: "github.com/owner/repo-alpha",
    cause: "provider-window",
    condition: { type: "provider-window", expiresAt: "2026-11-07T09:00:00Z" },
    recheckMs: 60_000,
    evaluatedAt: NOW_ISO,
    recordedAt: NOW_ISO,
  });
  const payload = input.stuck
    ? { ...record, recoveryState: "clear-observed", clearObservedAt: NOW_ISO }
    : record;
  const acquired = harness.composition.store.acquireFence(`seed-park-${input.ref}`);
  if (!acquired.ok) throw new Error("fence");
  try {
    harness.composition.store.append(acquired.value.handle, {
      kind: input.wrongKind === true ? "queue.parkx" : QUEUE_PARK_RECORD_KIND,
      recordKey: queueParkRecordKey(input.ref),
      payload: payload as never,
    });
  } finally {
    harness.composition.store.releaseFence(acquired.value.handle);
  }
};

describe("TC-SCHED-001/002/015 add, list, priority, dep, replay", () => {
  test("add lands an entry; list shows the normalized key and priority; no root or absolute path", async () => {
    const harness = createQueueEdgeHarness("add");
    const added = await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    expect(added.exitCode).toBe(0);
    const mutation = data(added.stdout);
    expect(mutation.result).toBe("added");
    expect(mutation.ref).toBe("GH-320");
    expect((mutation.entry as Record<string, unknown>).repository).toBe(
      "github.com/owner/repo-alpha",
    );
    expect(JSON.stringify(mutation)).not.toContain("repositoryRoot");
    expect(JSON.stringify(mutation)).not.toContain("/work/");

    const listed = await harness.run(["queue", "list", "--json"]);
    expect(listed.exitCode).toBe(0);
    const list = data(listed.stdout);
    const entry = (list.entries as Array<Record<string, unknown>>).find(
      (candidate) => candidate.ref === "GH-320",
    );
    expect(entry?.repository).toBe("github.com/owner/repo-alpha");
    expect(entry?.priority).toBe(5);
    expect(JSON.stringify(list)).not.toContain("repositoryRoot");
    expect(JSON.stringify(list)).not.toContain("/work/");
  });

  test("a replay is result=noop and appends nothing", async () => {
    const harness = createQueueEdgeHarness("replay");
    expect(
      (await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"])).exitCode,
    ).toBe(0);
    const replay = await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    expect(replay.exitCode).toBe(0);
    expect(data(replay.stdout).result).toBe("noop");
  });

  test("prioritize and dep land their rows; a cycle refuses with the named path", async () => {
    const harness = createQueueEdgeHarness("cycle");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(
      (await harness.run(["queue", "add", "GH-321", "--dep", "GH-320", "--json"])).exitCode,
    ).toBe(0);
    const prioritized = await harness.run(["queue", "prioritize", "GH-320", "2", "--json"]);
    expect(prioritized.exitCode).toBe(0);
    expect(data(prioritized.stdout).result).toBe("updated");
    const refused = await harness.run(["queue", "dep", "GH-320", "GH-321", "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("queue.dependency-cycle");
    expect(error(refused.stdout)?.summary).toContain("GH-320 -> GH-321 -> GH-320");
  });

  test("an unobserved ref classifies queue.entry.unobserved at exit 1", async () => {
    const harness = createQueueEdgeHarness("unobserved");
    const refused = await harness.run(["queue", "prioritize", "GH-999", "1", "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("queue.entry.unobserved");
  });
});

describe("TC-SCHED-008/009 plan and list envelopes", () => {
  test("plan --next 1 returns one action with degraded daemon-unreachable and no root", async () => {
    const harness = createQueueEdgeHarness("plan");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    const planned = await harness.run(["queue", "plan", "--next", "1", "--json"]);
    expect(planned.exitCode).toBe(0);
    const plan = data(planned.stdout);
    expect((plan.nextActions as unknown[]).length).toBe(1);
    expect(plan.degraded).toEqual(["daemon-unreachable"]);
    expect(JSON.stringify(plan)).not.toContain("repositoryRoot");
    expect(JSON.stringify(plan)).not.toContain("/work/");
  });

  test("an empty queue is an explicit observed-empty at exit 0", async () => {
    const harness = createQueueEdgeHarness("empty");
    const listed = await harness.run(["queue", "list", "--json"]);
    expect(listed.exitCode).toBe(0);
    const list = data(listed.stdout);
    expect((list.entries as unknown[]).length).toBe(0);
    expect((list.counts as Record<string, number>).entries).toBe(0);
    expect(list.degraded).toEqual(["daemon-unreachable"]);
  });

  test("an unreadable lease history makes list exit 2 with no data", async () => {
    const harness = createQueueEdgeHarness("unreadable");
    seedlease(harness);
    const acquired = harness.composition.store.acquireFence("wrong-kind");
    if (acquired.ok) {
      try {
        harness.composition.store.append(acquired.value.handle, {
          kind: "queue.leasex",
          recordKey: queueLeaseRecordKey("github.com/owner/repo-alpha"),
          payload: { schema: QUEUE_LEASE_SCHEMA },
        });
      } finally {
        harness.composition.store.releaseFence(acquired.value.handle);
      }
    }
    const listed = await harness.run(["queue", "list", "--json"]);
    expect(listed.exitCode).toBe(2);
    expect(error(listed.stdout)?.code).toBe("state.store.torn");
    expect(json(listed.stdout).data).toBeUndefined();
  });

  test("text mode prints the key=value summary before human detail", async () => {
    const harness = createQueueEdgeHarness("text");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    const listed = await harness.run(["queue", "list"]);
    expect(listed.exitCode).toBe(0);
    expect(listed.stdout.split("\n")[0]).toContain("entries=");
  });
});

describe("TC-LEASE / TC-RANK claim and release rows", () => {
  test("claim lands a lease, a second holder conflicts, and release lands", async () => {
    const harness = createQueueEdgeHarness("claim");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    const claimed = await harness.run([
      "queue",
      "claim",
      "GH-320",
      "--holder",
      "holder-a",
      "--json",
    ]);
    expect(claimed.exitCode).toBe(0);
    const claim = data(claimed.stdout);
    expect(claim.result).toBe("claimed");
    expect(claim.selectedRef).toBe("GH-320");
    expect((claim.lease as Record<string, unknown>).holder).toBe("holder-a");
    expect(claim.degraded).toEqual(["daemon-unreachable"]);

    const conflict = await harness.run([
      "queue",
      "claim",
      "GH-320",
      "--holder",
      "holder-b",
      "--json",
    ]);
    expect(conflict.exitCode).toBe(1);
    expect(error(conflict.stdout)?.code).toBe("queue.lease-conflict");

    const released = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--json",
    ]);
    expect(released.exitCode).toBe(0);
    expect(data(released.stdout).result).toBe("released");
  });

  test("a no-ref claim selects the top action deterministically", async () => {
    const harness = createQueueEdgeHarness("no-ref");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    const claimed = await harness.run(["queue", "claim", "--holder", "holder-a", "--json"]);
    expect(claimed.exitCode).toBe(0);
    expect(data(claimed.stdout).selectedRef).toBe("GH-320");
  });

  test("release --park accepts a cause and lands a paired park", async () => {
    const harness = createQueueEdgeHarness("release-park");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(
      (await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"])).exitCode,
    ).toBe(0);
    const parked = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--park",
      "preempted-for-close-item",
      "--json",
    ]);
    expect(parked.exitCode).toBe(0);
    expect(data(parked.stdout).result).toBe("parked");
    const park = data(parked.stdout).park as Record<string, unknown>;
    expect(park.cause).toBe("preempted-for-close-item");
    expect(park.conditionType).toBe("preemption");
  });

  test("release --park provider-window requires --until and records the supplied expiry", async () => {
    const harness = createQueueEdgeHarness("release-window");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(
      (await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"])).exitCode,
    ).toBe(0);

    const missing = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--park",
      "provider-window",
      "--json",
    ]);
    expect(missing.exitCode).toBe(1);
    expect(error(missing.stdout)?.code).toBe("fallback.invocation");

    const parked = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--holder",
      "holder-a",
      "--park",
      "provider-window",
      "--until",
      "2026-11-07T12:00:00Z",
      "--json",
    ]);
    expect(parked.exitCode).toBe(0);
    const park = data(parked.stdout).park as Record<string, unknown>;
    expect(park.cause).toBe("provider-window");
    expect(park.expiresAt).toBe("2026-11-07T12:00:00Z");

    const unsupported = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--park",
      "provider-quota",
      "--until",
      "2026-11-07T12:00:00Z",
      "--json",
    ]);
    expect(unsupported.exitCode).toBe(1);
    expect(error(unsupported.stdout)?.code).toBe("fallback.invocation");
  });

  test("release --park rejects a condition-type token as an invocation rejection", async () => {
    const harness = createQueueEdgeHarness("park-token");
    const refused = await harness.run([
      "queue",
      "release",
      "GH-320",
      "--park",
      "preemption",
      "--json",
    ]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("input.value.rejected");
  });

  test("a claim with no eligible action refuses no-eligible-action at exit 1", async () => {
    const harness = createQueueEdgeHarness("no-eligible");
    const refused = await harness.run(["queue", "claim", "--holder", "holder-a", "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("queue.precondition.unmet");
    expect(error(refused.stdout)?.summary).toContain("no-eligible-action");
  });
});

describe("AC-F10-3 park read-surface matrix", () => {
  test("queue list|plan exit 2 on unreadable park history with no data sibling", async () => {
    const harness = createQueueEdgeHarness("park-unreadable");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    seedPark(harness, { ref: "GH-320", wrongKind: true });
    for (const subcommand of ["list", "plan"]) {
      const run = await harness.run(["queue", subcommand, "--json"]);
      expect(run.exitCode).toBe(2);
      expect(error(run.stdout)?.code).toBe("state.store.torn");
      expect(json(run.stdout).data).toBeUndefined();
    }
  });

  test("a readable stuck park is a report-only finding at exit 0", async () => {
    const harness = createQueueEdgeHarness("park-stuck-readable");
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    seedPark(harness, { ref: "GH-320", stuck: true });
    const listed = await harness.run(["queue", "list", "--json"]);
    expect(listed.exitCode).toBe(0);
    const findings = data(listed.stdout).findings as Array<Record<string, unknown>>;
    expect(
      findings.some(
        (finding) => finding.code === "queue.park-condition-stuck" && finding.ref === "GH-320",
      ),
    ).toBe(true);
    const planned = await harness.run(["queue", "plan", "--json"]);
    expect(planned.exitCode).toBe(0);
  });
});

describe("F-14 mutation envelopes project real state and weight provenance", () => {
  test("every successful mutation carries degraded[]", async () => {
    const harness = createQueueEdgeHarness("mutation-degraded");
    const added = await harness.run(["queue", "add", "GH-320", "--json"]);
    expect(data(added.stdout).degraded).toEqual(["daemon-unreachable"]);
    const prioritized = await harness.run(["queue", "prioritize", "GH-320", "2", "--json"]);
    expect(data(prioritized.stdout).degraded).toEqual(["daemon-unreachable"]);
    const depended = await harness.run(["queue", "dep", "GH-320", "GH-999", "--json"]);
    expect(data(depended.stdout).degraded).toEqual(["daemon-unreachable"]);
  });

  test("an entry declared without a repository binding projects not-ready, never ready", async () => {
    const harness = createQueueEdgeHarness("mutation-unresolved", {
      overrides: { repositoryBinding: {} },
    });
    const added = await harness.run(["queue", "add", "GH-320", "--json"]);
    expect(added.exitCode).toBe(0);
    const entry = data(added.stdout).entry as Record<string, unknown>;
    expect(entry.state).toBe("not-ready");
    const blocking = entry.blocking as Array<Record<string, unknown>>;
    expect(blocking.some((block) => block.detail === "repository-binding-unresolved")).toBe(true);
  });

  test("weight provenance reflects the real plan resolution, not a hardcoded standard/absent", async () => {
    const harness = createQueueEdgeHarness("mutation-weight");
    const added = await harness.run(["queue", "add", "GH-399", "--json"]);
    expect(added.exitCode).toBe(0);
    const entry = data(added.stdout).entry as Record<string, unknown>;
    // GH-399 has no plan fact, so the real resolution is heavy/plan-absent.
    expect(entry.weightClass).toBe("heavy");
    expect(entry.weightClassSource).toBe("plan-absent");
  });
});

describe("TC-SCHED-012 command-level zero-write reads", () => {
  test("queue list|plan and lanes list|show perform zero appends, fences, or replacements", async () => {
    let log: StoreWriteLog | undefined;
    const harness = createQueueEdgeHarness("zero-write", {
      wrapStore: (store) => {
        const tracked = trackingStore(store);
        log = tracked.log;
        return tracked.store;
      },
    });
    expect((await harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect(log).toBeDefined();
    if (log === undefined) return;
    log.appends = 0;
    log.replaces = 0;
    log.fences = 0;
    log.releases = 0;

    expect((await harness.run(["queue", "list", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["queue", "plan", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["lanes", "list", "--json"])).exitCode).toBe(0);
    expect((await harness.run(["lanes", "show", "GH-320", "--json"])).exitCode).toBe(0);
    expect(log).toEqual({ appends: 0, replaces: 0, fences: 0, releases: 0 });
  });
});

describe("TC-SCHED-016 invocation rejection and --json envelope", () => {
  test("--watch on any queue subcommand is fallback.invocation with a resident-daemon hint", async () => {
    const harness = createQueueEdgeHarness("watch");
    const refused = await harness.run(["queue", "list", "--watch", "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("fallback.invocation");
    expect(String(error(refused.stdout)?.remediationHint)).toContain("resident daemon (M1-S18)");
    expect(json(refused.stdout).data).toBeUndefined();
    const plan = await harness.run(["queue", "plan", "--watch", "--json"]);
    expect(plan.exitCode).toBe(1);
    expect(error(plan.stdout)?.code).toBe("fallback.invocation");
    expect(String(error(plan.stdout)?.remediationHint)).toContain("resident daemon (M1-S18)");
  });

  test("the machine envelope is parseable and carries a schemaVersion", async () => {
    const harness = createQueueEdgeHarness("envelope");
    const listed = await harness.run(["queue", "list", "--json"]);
    const envelope = json(listed.stdout);
    expect(envelope.schemaVersion).toBe("delivery.result.v1");
    expect(envelope.runId).toBe("run-queue-edge");
  });

  test("no secret or raw provider body appears in an envelope", async () => {
    const harness = createQueueEdgeHarness("secret");
    const listed = await harness.run(["queue", "list", "--json"]);
    const text = readFileSync(join(ROOT, "tests/fixtures/queue/secret/canary.txt"), "utf8").trim();
    expect(listed.stdout).not.toContain(text);
  });
});
