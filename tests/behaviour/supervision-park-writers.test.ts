/**
 * TC-SUP-100 / TC-SUP-101 / TC-SUP-102 — the park-writer hardening
 * (GH-295 DEC-9(a), AC-F5-1, DM-2, NFR-6).
 *
 * The class rule under test: every member of the closed cause set either
 * round-trips a park record its own read validator accepts through its
 * sanctioned writer, or is refused by name on the operator path. A
 * provider-window-mapped park can never be appended from an empty or missing
 * expiry, through any writer, and the store stays readable.
 */
import { describe, expect, test } from "bun:test";
import {
  claimQueueLease,
  declareQueueEntry,
  readQueueEntries,
  readQueueLeases,
  readQueueParks,
  releaseQueueLease,
} from "../../packages/core/src/app/index";
import { createStateSupervisionWritePort } from "../../packages/core/src/app/index";
import {
  QUEUE_BATTERY_ONLY_PARK_CAUSES,
  QUEUE_PARK_CAUSES,
  QUEUE_PARK_RECHECK_DEFAULTS,
  type QueueParkCause,
  type QueueParkCondition,
} from "../../packages/core/src/contracts/index";
import { parkConditionForCause } from "../../packages/core/src/domain/index";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-17T00:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const UNTIL = "2026-11-17T01:00:00.000Z";
const REPOSITORY = "github.com/example/repo-alpha";
const ROOT = "/work/repo-alpha";

const isBatteryOnly = (cause: QueueParkCause): boolean =>
  (QUEUE_BATTERY_ONLY_PARK_CAUSES as readonly string[]).includes(cause);

const parkArgsFor = (cause: QueueParkCause): readonly string[] => {
  const untilCarrying = cause === "provider-window" || cause === "peak-window";
  return [
    "queue",
    "release",
    "GH-320",
    "--holder",
    "holder-a",
    "--park",
    cause,
    ...(untilCarrying ? ["--until", UNTIL] : []),
    "--json",
  ];
};

const seedClaimableLane = (store: Parameters<typeof declareQueueEntry>[0]): void => {
  const declared = declareQueueEntry(store, {
    ref: "GH-320",
    repository: REPOSITORY,
    repositoryRoot: ROOT,
    priority: 1,
    recordedAt: NOW,
    fenceToken: "seed-entry",
  });
  expect(declared.ok).toBe(true);
  const claimed = claimQueueLease(store, {
    ref: "GH-320",
    holder: "holder-a",
    runner: "runner-a",
    weightClass: "standard",
    nowIso: NOW,
    nowMs: NOW_MS,
    fenceToken: "seed-claim",
  });
  expect(claimed.ok).toBe(true);
};

describe("TC-SUP-100 every cause–writer pair round-trips or is refused by name", () => {
  test("one accounting row per closed-set member, validated on read-back", async () => {
    const rows: { cause: QueueParkCause; writer: string; outcome: string }[] = [];
    for (const cause of QUEUE_PARK_CAUSES) {
      if (isBatteryOnly(cause)) {
        // The operator path refuses by name and appends nothing.
        const refused = createQueueEdgeHarness(`writers-refuse-${cause}`);
        const refusedStore = refused.composition.store;
        seedClaimableLane(refusedStore);
        const parksBefore = readQueueParks(refusedStore);
        if (!parksBefore.ok) throw new Error("park read failed");
        const run = await refused.run(parkArgsFor(cause));
        expect(run.exitCode).toBe(1);
        expect(run.stdout).toContain("fallback.invocation");
        expect(run.stdout).toContain(cause);
        const parksAfter = readQueueParks(refusedStore);
        if (!parksAfter.ok) throw new Error("park read failed after refusal");
        expect(parksAfter.records).toHaveLength(parksBefore.records.length);

        // The battery writer is the sanctioned writer and always supplies until.
        const batteryRoot = makeTempRoot(`supervision-writer-${cause}`);
        try {
          const { store } = openStore(makeIdentity(batteryRoot));
          const write = createStateSupervisionWritePort({
            store,
            newFenceToken: () => `fence-${cause}`,
          });
          const appended = write.appendPark({
            ref: "GH-320",
            repository: REPOSITORY,
            until: UNTIL,
            recheckMs: QUEUE_PARK_RECHECK_DEFAULTS["provider-window"],
            nowIso: NOW,
          });
          expect(appended.ok).toBe(true);
          const read = readQueueParks(store);
          expect(read.ok).toBe(true);
          if (!read.ok) continue;
          expect(read.records.at(-1)?.cause).toBe(cause);
          rows.push({ cause, writer: "battery", outcome: "accepted; operator refused" });
        } finally {
          removeRoot(batteryRoot);
        }
        continue;
      }

      const harness = createQueueEdgeHarness(`writers-${cause}`);
      const store = harness.composition.store;
      seedClaimableLane(store);
      const run = await harness.run(parkArgsFor(cause));
      expect(run.exitCode, cause).toBe(0);
      const read = readQueueParks(store);
      expect(read.ok, cause).toBe(true);
      if (!read.ok) continue;
      // Read-back through the delivered park family is the validator the
      // ecosystem uses, so write/read agreement is asserted rather than assumed.
      expect(read.records.at(-1)?.cause, cause).toBe(cause);
      rows.push({ cause, writer: "operator", outcome: "accepted" });
    }

    expect(rows.map((row) => row.cause)).toEqual([...QUEUE_PARK_CAUSES]);
    expect(rows.filter((row) => row.writer === "operator")).toHaveLength(
      QUEUE_PARK_CAUSES.length - QUEUE_BATTERY_ONLY_PARK_CAUSES.length,
    );
    expect(rows.filter((row) => row.writer === "battery")).toHaveLength(
      QUEUE_BATTERY_ONLY_PARK_CAUSES.length,
    );
  });
});

describe("TC-SUP-101 the operator path refuses the battery-only cause and stays healthy", () => {
  test("json, human, and --until forms all refuse with zero appends and healthy reads", async () => {
    const harness = createQueueEdgeHarness("writers-refusal", { countWrites: true });
    const store = harness.composition.store;
    seedClaimableLane(store);
    const parksBefore = readQueueParks(store);
    const entriesBefore = readQueueEntries(store);
    const leasesBefore = readQueueLeases(store);
    if (!parksBefore.ok || !entriesBefore.ok || !leasesBefore.ok) {
      throw new Error("ledger read failed");
    }
    const appendsBefore = harness.writeLog?.appends ?? 0;
    const forms: readonly { readonly argv: readonly string[]; readonly json: boolean }[] = [
      {
        argv: [
          "queue",
          "release",
          "GH-320",
          "--holder",
          "holder-a",
          "--park",
          "liveness-stall",
          "--json",
        ],
        json: true,
      },
      {
        argv: ["queue", "release", "GH-320", "--holder", "holder-a", "--park", "liveness-stall"],
        json: false,
      },
      {
        argv: [
          "queue",
          "release",
          "GH-320",
          "--holder",
          "holder-a",
          "--park",
          "liveness-stall",
          "--until",
          UNTIL,
          "--json",
        ],
        json: true,
      },
    ];
    for (const form of forms) {
      const run = await harness.run(form.argv);
      expect(run.exitCode).toBe(1);
      if (form.json) {
        expect(run.stdout).toContain("fallback.invocation");
        expect(run.stdout).toContain("liveness-stall");
        expect(run.stdout).not.toContain('"data"');
      } else {
        expect(run.stdout).toContain("result=refused");
        expect(run.stdout).not.toContain("parked");
      }
    }
    expect(harness.writeLog?.appends ?? 0).toBe(appendsBefore);
    const parksAfter = readQueueParks(store);
    const entriesAfter = readQueueEntries(store);
    const leasesAfter = readQueueLeases(store);
    if (!parksAfter.ok || !entriesAfter.ok || !leasesAfter.ok) {
      throw new Error("ledger read failed after refusal");
    }
    expect(parksAfter.records).toHaveLength(parksBefore.records.length);
    expect(entriesAfter.records).toHaveLength(entriesBefore.records.length);
    expect(leasesAfter.records).toHaveLength(leasesBefore.records.length);
    const queueRead = await harness.run(["queue", "list", "--json"]);
    const lanesRead = await harness.run(["lanes", "list", "--json"]);
    expect(queueRead.exitCode).toBe(0);
    expect(lanesRead.exitCode).toBe(0);
    const parksHealthy = readQueueParks(store);
    expect(parksHealthy.ok).toBe(true);
  });
});

describe("TC-SUP-102 the park write path cannot append a provider-window park with no expiry", () => {
  test("empty and missing expiry are refused at two write entry points; state stays readable", () => {
    const root = makeTempRoot("supervision-expiry-guard");
    try {
      const { store } = openStore(makeIdentity(root));
      seedClaimableLane(store);
      const before = readQueueParks(store);
      if (!before.ok) throw new Error("park read failed");

      // Entry point 1: the delivered release path.
      const empty = releaseQueueLease(store, {
        ref: "GH-320",
        holder: "holder-a",
        park: {
          cause: "liveness-stall",
          condition: parkConditionForCause("liveness-stall"),
        },
        nowIso: NOW,
        nowMs: NOW_MS,
        fenceToken: "guard-empty",
      });
      expect(empty.ok).toBe(false);
      if (!empty.ok) {
        expect(empty.code).toBe("input.value.rejected");
        expect(empty.detail ?? "").toContain("expiresAt");
      }
      const missing = releaseQueueLease(store, {
        ref: "GH-320",
        holder: "holder-a",
        park: {
          cause: "liveness-stall",
          condition: { type: "provider-window" } as unknown as QueueParkCondition,
        },
        nowIso: NOW,
        nowMs: NOW_MS,
        fenceToken: "guard-missing",
      });
      expect(missing.ok).toBe(false);
      const afterRelease = readQueueParks(store);
      expect(afterRelease.ok).toBe(true);
      if (afterRelease.ok) expect(afterRelease.records).toHaveLength(before.records.length);

      // Entry point 2: the battery write port.
      const write = createStateSupervisionWritePort({
        store,
        newFenceToken: () => "guard-battery",
      });
      const refused = write.appendPark({
        ref: "GH-320",
        repository: REPOSITORY,
        until: "",
        recheckMs: QUEUE_PARK_RECHECK_DEFAULTS["provider-window"],
        nowIso: NOW,
      });
      expect(refused.ok).toBe(false);
      const afterRefusals = readQueueParks(store);
      expect(afterRefusals.ok).toBe(true);
      if (afterRefusals.ok) expect(afterRefusals.records).toHaveLength(before.records.length);

      // The next legitimate battery-written park appends and validates.
      const legit = write.appendPark({
        ref: "GH-320",
        repository: REPOSITORY,
        until: UNTIL,
        recheckMs: QUEUE_PARK_RECHECK_DEFAULTS["provider-window"],
        nowIso: NOW,
      });
      expect(legit.ok).toBe(true);
      const healthy = readQueueParks(store);
      expect(healthy.ok).toBe(true);
      if (healthy.ok) expect(healthy.records.at(-1)?.until).toBe(UNTIL);
    } finally {
      removeRoot(root);
    }
  });
});
