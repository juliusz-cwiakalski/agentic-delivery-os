/**
 * TC-HOLDQUEUE-002/003/010/013 (GH-280) — supplied-ref and no-ref claim
 * refusals name the exact `owner-hold` token before ref selection and append
 * nothing; the fenced claim refuses before acquiring the fence; and an
 * unreadable store keeps the delivered state failure at exit 2.
 */
import { describe, expect, test } from "bun:test";
import {
  claimQueueLease,
  declareQueueEntry,
} from "../../packages/core/src/app/index";
import type { OwnerHoldFact } from "../../packages/core/src/contracts/index";
import {
  createQueueEdgeHarness,
  trackingStore,
  type StoreWriteLog,
} from "../fixtures/queue/cli/harness";
import { recordingStore, REPO } from "../fixtures/queue/leases/fence-harness";
import { makeAuditStore } from "../fixtures/state/harness";

const HOLD: OwnerHoldFact = {
  active: true,
  source: "marker",
  reason: "peak-hour cost pause",
};
const SUMMARY = "reason=owner-hold; owner hold active (marker): peak-hour cost pause";

const heldHarness = (label: string): ReturnType<typeof createQueueEdgeHarness> =>
  createQueueEdgeHarness(label, { overrides: { readOwnerHold: () => HOLD } });

const resetLog = (log: StoreWriteLog): void => {
  log.appends = 0;
  log.replaces = 0;
  log.fences = 0;
  log.releases = 0;
};

describe("TC-HOLDQUEUE-002 supplied-ref and no-ref claim refusals", () => {
  test("both legs exit 1 with the exact token and the bounded detail, appending nothing", async () => {
    const harness = heldHarness("claim-hold");
    await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);

    const supplied = await harness.run(["queue", "claim", "GH-320", "--json"]);
    expect(supplied.exitCode).toBe(1);
    const suppliedEnvelope = JSON.parse(supplied.stdout) as {
      readonly error: { readonly code: string; readonly summary: string };
    };
    expect(suppliedEnvelope.error.code).toBe("queue.precondition.unmet");
    expect(suppliedEnvelope.error.summary).toBe(SUMMARY);
    expect(suppliedEnvelope.error.summary.startsWith("reason=owner-hold")).toBe(true);

    const noRef = await harness.run(["queue", "claim", "--json"]);
    expect(noRef.exitCode).toBe(1);
    const noRefEnvelope = JSON.parse(noRef.stdout) as {
      readonly error: { readonly code: string; readonly summary: string };
    };
    expect(noRefEnvelope.error.code).toBe("queue.precondition.unmet");
    expect(noRefEnvelope.error.summary).toBe(SUMMARY);
    expect(noRefEnvelope.error.summary).not.toContain("no-eligible-action");
    expect(JSON.stringify(noRefEnvelope)).not.toContain("ownerHold");
  });

  test("the claim appends zero lease, park, or incident records", async () => {
    let log: StoreWriteLog | undefined;
    const harness = createQueueEdgeHarness("claim-hold-writes", {
      overrides: { readOwnerHold: () => HOLD },
      wrapStore: (store) => {
        const tracking = trackingStore(store);
        log = tracking.log;
        return tracking.store;
      },
    });
    await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    if (log === undefined) throw new Error("write log is missing");
    resetLog(log);
    const run = await harness.run(["queue", "claim", "GH-320", "--json"]);
    expect(run.exitCode).toBe(1);
    expect(log).toEqual({ appends: 0, replaces: 0, fences: 0, releases: 0 });
  });
});

describe("TC-HOLDQUEUE-003 the fenced claim refuses before acquiring the fence", () => {
  test("a direct caller with the hold and no precheck refuses without a fence", () => {
    const fixture = makeAuditStore("owner-hold-fenced");
    const declared = declareQueueEntry(fixture.store, {
      ref: "GH-320",
      repository: REPO,
      repositoryRoot: "/work/repo-alpha",
      priority: 5,
      recordedAt: "2026-11-07T10:00:00Z",
      fenceToken: "seed",
    });
    expect(declared.ok).toBe(true);
    const recording = recordingStore(fixture.store);
    const result = claimQueueLease(recording.store, {
      ref: "GH-320",
      holder: "local",
      runner: "runner-a",
      weightClass: "standard",
      nowIso: "2026-11-07T10:00:00Z",
      nowMs: Date.parse("2026-11-07T10:00:00Z"),
      fenceToken: "fenced-hold",
      ownerHold: HOLD,
    });
    expect(result).toMatchObject({
      ok: false,
      kind: "queue",
      code: "queue.precondition.unmet",
      reason: "owner-hold",
      detail: "owner hold active (marker): peak-hour cost pause",
    });
    expect(recording.log).not.toContain("acquireFence");
    expect(recording.appends()).toBe(0);
  });

  test("a no-hold control claims normally", () => {
    const fixture = makeAuditStore("no-hold-fenced");
    const declared = declareQueueEntry(fixture.store, {
      ref: "GH-320",
      repository: REPO,
      repositoryRoot: "/work/repo-alpha",
      priority: 5,
      recordedAt: "2026-11-07T10:00:00Z",
      fenceToken: "seed",
    });
    expect(declared.ok).toBe(true);
    const result = claimQueueLease(fixture.store, {
      ref: "GH-320",
      holder: "local",
      runner: "runner-a",
      weightClass: "standard",
      nowIso: "2026-11-07T10:00:00Z",
      nowMs: Date.parse("2026-11-07T10:00:00Z"),
      fenceToken: "control",
    });
    expect(result.ok).toBe(true);
  });
});

describe("TC-HOLDQUEUE-010 bookkeeping still works while held; claim does not", () => {
  test("add, prioritize, dep, and release append their records and never invoke recovery", async () => {
    const harness = heldHarness("claim-hold-bookkeeping");
    const added = await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    expect(added.exitCode).toBe(0);
    const prioritized = await harness.run([
      "queue",
      "prioritize",
      "GH-320",
      "9",
      "--json",
    ]);
    expect(prioritized.exitCode).toBe(0);
    const dep = await harness.run(["queue", "dep", "GH-320", "GH-321", "--json"]);
    expect(dep.exitCode).toBe(0);
    const released = await harness.run(["queue", "release", "GH-320", "--json"]);
    expect(released.exitCode).toBe(0);
    const claimed = await harness.run(["queue", "claim", "GH-320", "--json"]);
    expect(claimed.exitCode).toBe(1);
  });
});

describe("TC-HOLDQUEUE-013 an unreadable store keeps the delivered state failure", () => {
  test("the claim exits 2 with no hold-shaped payload", async () => {
    let fail = false;
    const harness = createQueueEdgeHarness("claim-hold-unreadable", {
      overrides: { readOwnerHold: () => HOLD },
      wrapStore: (store) =>
        new Proxy(store, {
          get(target, property) {
            if (property === "readRecords" && fail) {
              return () => ({
                ok: false,
                error: {
                  kind: "state",
                  code: "state.store.torn",
                  consequence: "not_landed",
                  location: { path: target.identity.stateDirectory },
                },
              });
            }
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }),
    });
    await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    fail = true;
    const run = await harness.run(["queue", "claim", "GH-320", "--json"]);
    expect(run.exitCode).toBe(2);
    const envelope = JSON.parse(run.stdout) as {
      readonly error: { readonly code: string };
    };
    expect(envelope.error.code).toBe("state.store.torn");
    expect(JSON.stringify(envelope)).not.toContain("ownerHold");
    expect(JSON.stringify(envelope)).not.toContain("owner-hold");
  });
});
