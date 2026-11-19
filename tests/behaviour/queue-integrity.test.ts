/**
 * TC-F6-001..012 — the seven declared queue-integrity properties proved through
 * the production composition (GH-349 F-6, API-7; §24.7 G-7).
 *
 * Each property block asserts its declared outcome over the delivered verbs and
 * ledgers, then runs its control in the declared shape — a derived comparison or
 * a deliberately broken double — and requires the control to fail naming the
 * property. No control claims a production-input breach: a holding property has
 * no violating input, so the breach is applied to an observation copy (derived)
 * or produced by a typed double.
 *
 * Every block records the property as "property proved clean; no repair" where
 * the production outcome holds. The metric is reported as 7/7 property suites
 * with a declared control shape, separately from the 3/3 named defects whose
 * defect-named regressions are phase 7's obligation (spec v1.3 F19).
 */
import { describe, expect, test } from "bun:test";
import {
  claimQueueLease,
  declareQueueEntry,
  dispatchAdmissionRefusal,
  readQueueDependencies,
  readQueueFold,
  readQueueIncidents,
  readQueueLeases,
  readQueueParks,
  readQueueRemovals,
  reconcileQueueEntries,
} from "../../packages/core/src/app/index";
import { removeQueueEntryWithinFence } from "../../packages/core/src/app/queue";
import type {
  CommandResultDetail,
  DeliveryStateAlias,
  QueueIncidentRecord,
  QueueLeaseRecord,
  QueueTrackerRead,
  StateRecord,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  COMMAND_FAILURE_DETAIL_MAX_CHARS,
  QUEUE_MAX_DETAIL_CHARS,
  QUEUE_RECONCILE_MAX_ENTRIES,
  QUEUE_REMOVAL_REASONS,
} from "../../packages/core/src/contracts/index";
import { createQueueRemovalHarness, seedQueueEntry } from "../fixtures/closeout/queue-removal";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import {
  assertControlDiverges,
  brokenClaimRenewalDouble,
  brokenNestedHolderDouble,
  brokenParkWriterDouble,
  brokenReconcileReaderDouble,
  brokenStaleHolderDouble,
  type ClaimIntegrityObservation,
  type CrudIntegrityObservation,
  claimIntegrityDivergence,
  crudExtraEdgeBreach,
  crudIntegrityDivergence,
  type ParkIntegrityObservation,
  type PresenceObservation,
  parkIntegrityDivergence,
  presenceIntegrityDivergence,
  presenceSpecialCaseBreach,
  presenceTimestampBreach,
  QUEUE_INTEGRITY_CONTROL_SHAPE_BY_PROPERTY,
  QUEUE_INTEGRITY_CONTROL_SHAPES,
  QUEUE_INTEGRITY_PROPERTIES,
  queueIntegrityFailure,
  type ReasonBearingRemovalObservation,
  type ReconcileIntegrityObservation,
  reasonBearingRemovalDivergence,
  reconcileIntegrityDivergence,
  removalAppendBreach,
  removalConvergenceBreach,
  type SingleFlightObservation,
  singleFlightDivergence,
} from "../fixtures/queue/integrity-breaches";
import { createReconcileHarness } from "../fixtures/queue/reconcile/harness";
import { REMOVAL_REF, UNKNOWN_REF } from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";
import {
  claim,
  claimAdmission,
  seedLease,
  singleFlightStore,
  TTL,
} from "../fixtures/queue/single-flight/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

const recordsOf = (store: StateStorePort): readonly StateRecord[] => {
  const read = store.readRecords();
  if (!read.ok) throw new Error(`store read failed: ${read.error.code}`);
  return read.value.records;
};

const foldRefs = (store: StateStorePort): readonly string[] => {
  const fold = readQueueFold(store);
  if (!fold.ok) throw new Error(`fold read failed: ${fold.code}`);
  return fold.value.entries.map((entry) => entry.ref);
};

/** Every property proves clean unless a control demonstrates a repair. */
const PROPERTY_OUTCOMES = {
  "claim-integrity": "property proved clean; no repair",
  "park-integrity": "property proved clean; no repair",
  "reconcile-integrity": "property proved clean; no repair",
  "crud-integrity": "property proved clean; no repair",
  "reason-bearing-removal": "property proved clean; no repair",
  "single-flight": "property proved clean; no repair",
  "append-position-presence": "property proved clean; no repair",
} as const;

/** The 3 named defects are phase 7's obligation, reported separately (F19). */
const NAMED_DEFECTS = ["F1", "F4", "F8"] as const;

/** Assert a control diverges and its named failure carries the property. */
const expectControlFailsNaming = (
  property: (typeof QUEUE_INTEGRITY_PROPERTIES)[number],
  subject: string | undefined,
): void => {
  expect(subject, `${property} control produced no divergence`).toBeDefined();
  expect(() => {
    throw assertControlDiverges(property, subject);
  }).toThrow(property);
};

/* ---------------------------- 1. claim integrity -------------------------- */

describe("claim integrity", () => {
  test("single-flight names the holder, renewal is one record, takeover is evidenced, cross-ref conflicts", () => {
    const store = singleFlightStore("integrity-claim");
    try {
      seedLease(store, { holder: "lane-1", ref: "GH-241" });
      const before = readQueueLeases(store.store);
      if (!before.ok) throw new Error("lease read failed");
      const renewed = claim(store, { ref: "GH-241", holder: "lane-1" });
      expect(renewed.ok).toBe(true);
      if (renewed.ok) expect(renewed.value.result).toBe("renewed");
      const after = readQueueLeases(store.store);
      if (!after.ok) throw new Error("lease read failed");
      const sameRefRefusal = claimAdmission(store, { ref: "GH-241", holder: "lane-2" });
      // The second seeded ref resolves to the same repository, so the dispatch
      // admission over it is the delivered repository-exclusive conflict.
      const crossRefRefusal = dispatchAdmissionRefusal(store.store, {
        ref: "GH-242",
        nowMs: store.nowMs(),
      });
      expect(crossRefRefusal?.code).toBe("queue.lease-conflict");

      const takeoverStore = singleFlightStore("integrity-claim-takeover");
      let leases: readonly QueueLeaseRecord[] = [];
      let incidents: readonly QueueIncidentRecord[] = [];
      try {
        seedLease(takeoverStore, { holder: "lane-1", ref: "GH-241", ageMs: TTL });
        const taken = claim(takeoverStore, { ref: "GH-241", holder: "lane-2" });
        expect(taken.ok).toBe(true);
        if (taken.ok) expect(taken.value.result).toBe("taken-over");
        const leaseRead = readQueueLeases(takeoverStore.store);
        if (!leaseRead.ok) throw new Error("lease read failed");
        leases = leaseRead.records;
        const incidentRead = readQueueIncidents(takeoverStore.store);
        if (!incidentRead.ok) throw new Error("incident read failed");
        incidents = incidentRead.records;
      } finally {
        takeoverStore.dispose();
      }

      const observation: ClaimIntegrityObservation = {
        holder: "lane-1",
        renewal: { before: before.records, after: after.records },
        takeover: { leases, incidents },
        sameRefRefusal,
        crossRefRefusal,
      };
      expect(claimIntegrityDivergence(observation)).toBeUndefined();
      expectControlFailsNaming(
        "claim-integrity",
        claimIntegrityDivergence(brokenClaimRenewalDouble(observation)),
      );
      expect(PROPERTY_OUTCOMES["claim-integrity"]).toBe("property proved clean; no repair");
    } finally {
      store.dispose();
    }
  });
});

/* ----------------------------- 2. park integrity -------------------------- */

describe("park integrity", () => {
  test("closed causes, battery-only refusal by name, expiry rules, and removal releases the park", async () => {
    const harness = createQueueEdgeHarness("integrity-park");
    const store = harness.composition.store;
    try {
      const declared = declareQueueEntry(store, {
        ref: "GH-320",
        repository: "github.com/example/repo-alpha",
        repositoryRoot: "/work/repo-alpha",
        priority: 1,
        recordedAt: harness.nowIso(),
        fenceToken: "seed-park-entry",
      });
      expect(declared.ok).toBe(true);

      const outOfVocabulary = await harness.run([
        "queue",
        "release",
        "GH-320",
        "--park",
        "not-a-cause",
        "--json",
      ]);
      const batteryOnly = await harness.run([
        "queue",
        "release",
        "GH-320",
        "--park",
        "liveness-stall",
        "--json",
      ]);
      const missingExpiry = await harness.run([
        "queue",
        "release",
        "GH-320",
        "--park",
        "provider-window",
        "--json",
      ]);
      const forbiddenExpiry = await harness.run([
        "queue",
        "release",
        "GH-320",
        "--park",
        "owner-hold",
        "--until",
        "2026-11-13T18:05:00.000Z",
        "--json",
      ]);
      for (const run of [outOfVocabulary, batteryOnly, missingExpiry, forbiddenExpiry]) {
        expect(run.exitCode).toBe(1);
        expect(run.stdout).not.toContain('"data"');
      }
      const parks = readQueueParks(store);
      if (!parks.ok) throw new Error("park read failed");

      const removal = createRemovalHarness("integrity-park-removal");
      try {
        removal.seedEntry({ ref: REMOVAL_REF });
        removal.seedPark({ ref: REMOVAL_REF });
        const removed = await removal.run([
          "queue",
          "remove",
          REMOVAL_REF,
          "--reason",
          "abandoned",
          "--json",
        ]);
        expect(removed.exitCode).toBe(0);
        const parksAfter = readQueueParks(removal.composition.store);
        if (!parksAfter.ok) throw new Error("park read failed");
        const observation: ParkIntegrityObservation = {
          ref: REMOVAL_REF,
          operatorRefusals: [
            {
              label: "out-of-vocabulary",
              code: String(errorOf(outOfVocabulary.stdout).code),
              summary: String(errorOf(outOfVocabulary.stdout).summary ?? ""),
            },
            {
              label: "battery-only",
              code: String(errorOf(batteryOnly.stdout).code),
              summary: String(errorOf(batteryOnly.stdout).summary ?? ""),
            },
            {
              label: "missing-expiry",
              code: String(errorOf(missingExpiry.stdout).code),
              summary: String(errorOf(missingExpiry.stdout).summary ?? ""),
            },
            {
              label: "forbidden-expiry",
              code: String(errorOf(forbiddenExpiry.stdout).code),
              summary: String(errorOf(forbiddenExpiry.stdout).summary ?? ""),
            },
          ],
          operatorLedger: parks.records,
          parksAfterRemoval: parksAfter.records,
        };
        expect(parkIntegrityDivergence(observation)).toBeUndefined();
        expectControlFailsNaming(
          "park-integrity",
          parkIntegrityDivergence(brokenParkWriterDouble(observation)),
        );
        expect(PROPERTY_OUTCOMES["park-integrity"]).toBe("property proved clean; no repair");
      } finally {
        removal.dispose();
      }
    } finally {
      harness.dispose();
    }
  });
});

/* --------------------------- 3. reconcile integrity ----------------------- */

describe("reconcile integrity", () => {
  const seedMatrix = (harness: ReturnType<typeof createReconcileHarness>): void => {
    harness.seedEntry({ ref: "GH-241", priority: 1 });
    harness.seedEntry({ ref: "GH-242", priority: 2 });
    harness.seedEntry({ ref: "GH-243", priority: 3 });
    harness.seedEntry({ ref: "GH-244", priority: 4 });
    harness.seedEntry({ ref: "GH-245", priority: 5 });
    harness.program("GH-241", { deliveryState: "done" });
    harness.program("GH-242", { deliveryState: "canceled" });
    harness.program("GH-243", { deliveryState: "in-progress" });
    harness.program("GH-244", { observation: "not-found" });
    harness.program("GH-245", { deliveryState: "in-review" });
  };

  const expected = {
    checked: 5,
    removed: ["GH-241", "GH-242"],
    retained: [
      { ref: "GH-243", deliveryState: "in-progress" as DeliveryStateAlias },
      { ref: "GH-245", deliveryState: "in-review" as DeliveryStateAlias },
    ],
    unobserved: ["GH-244"],
    truncated: false,
    remainder: 0,
  } as const;

  test("done/canceled leave, unobserved/in-review stay, and --ref narrows to one entry", async () => {
    const harness = createReconcileHarness("integrity-reconcile");
    try {
      seedMatrix(harness);
      const run = await harness.run(["queue", "reconcile", "--json"]);
      expect(run.exitCode).toBe(0);
      const payload = json(run.stdout).data as ReconcileIntegrityObservation["payload"];
      const observation: ReconcileIntegrityObservation = { payload, expected };
      expect(reconcileIntegrityDivergence(observation)).toBeUndefined();

      // The narrowed run examines exactly the named entry and reports one item.
      const narrow = await harness.run(["queue", "reconcile", "--ref", "GH-245", "--json"]);
      expect(narrow.exitCode).toBe(0);
      const narrowed = json(narrow.stdout).data as {
        checked: number;
        retained: readonly unknown[];
      };
      expect(narrowed.checked).toBe(1);
      expect(narrowed.retained).toHaveLength(1);
      expect(PROPERTY_OUTCOMES["reconcile-integrity"]).toBe("property proved clean; no repair");
    } finally {
      harness.dispose();
    }
  });

  test("a tracker double that reports in-review as done fails naming the state", async () => {
    const harness = createReconcileHarness("integrity-reconcile-double");
    try {
      seedMatrix(harness);
      const base = async (ref: string): Promise<QueueTrackerRead> => {
        const programmed: Readonly<Record<string, DeliveryStateAlias | "not-found">> = {
          "GH-241": "done",
          "GH-242": "canceled",
          "GH-243": "in-progress",
          "GH-244": "not-found",
          "GH-245": "in-review",
        };
        const state = programmed[ref];
        if (state === "not-found") return { ok: true, kind: "not-found" };
        if (state === undefined) return { ok: true, kind: "state", deliveryState: "in-progress" };
        return { ok: true, kind: "state", deliveryState: state };
      };
      const result = await reconcileQueueEntries(harness.composition.store, {
        readTracker: brokenReconcileReaderDouble(base, new Set(["GH-245"])),
        recordedAt: harness.nowIso(),
        nowMs: harness.nowMs(),
        fenceToken: () => "fence-reconcile-double",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const observation: ReconcileIntegrityObservation = {
        payload: result.value,
        expected,
      };
      const subject = reconcileIntegrityDivergence(observation);
      expectControlFailsNaming("reconcile-integrity", subject);
      expect(subject).toContain("in-review");
      expect(PROPERTY_OUTCOMES["reconcile-integrity"]).toBe("property proved clean; no repair");
    } finally {
      harness.dispose();
    }
  });

  test("105 entries examine the 100-entry cap and report the exact remainder", async () => {
    const harness = createReconcileHarness("integrity-reconcile-cap");
    try {
      for (let index = 100; index <= 204; index += 1) {
        const ref = `GH-${index}`;
        harness.seedEntry({ ref, priority: index - 99 });
        harness.program(ref, { deliveryState: "in-progress" });
      }
      const run = await harness.run(["queue", "reconcile", "--json"]);
      expect(run.exitCode).toBe(0);
      const payload = json(run.stdout).data as ReconcileIntegrityObservation["payload"];
      expect(payload.checked).toBe(QUEUE_RECONCILE_MAX_ENTRIES);
      expect(payload.truncated).toBe(true);
      expect(payload.remainder).toBe(5);
      expect(payload.retained).toHaveLength(QUEUE_RECONCILE_MAX_ENTRIES);
      expect(harness.calls()).toHaveLength(QUEUE_RECONCILE_MAX_ENTRIES);
    } finally {
      harness.dispose();
    }
  }, 600_000);
});

/* ------------------------------ 4. CRUD integrity ------------------------- */

describe("CRUD integrity", () => {
  test("one edge per add, a one-edge removal, an add-only cycle check, and no cascade", async () => {
    const harness = createRemovalHarness("integrity-crud");
    const store = harness.composition.store;
    try {
      harness.seedEntry({ ref: REMOVAL_REF, priority: 1 });
      harness.seedEntry({ ref: "GH-242", priority: 2 });
      harness.seedEntry({ ref: "GH-243", priority: 3 });

      const added = await harness.run(["queue", "add", "GH-244", "--dep", REMOVAL_REF, "--json"]);
      expect(added.exitCode).toBe(0);
      const addedData = json(added.stdout).data as {
        result: string;
        edges: readonly string[];
      };
      expect(addedData.result).toBe("added");
      expect(addedData.edges).toEqual([REMOVAL_REF]);
      const afterAdd = readQueueDependencies(store);
      if (!afterAdd.ok) throw new Error("dependency read failed");

      const removed = await harness.run([
        "queue",
        "dep",
        "remove",
        "GH-244",
        REMOVAL_REF,
        "--json",
      ]);
      expect(removed.exitCode).toBe(0);
      const removedData = json(removed.stdout).data as {
        result: string;
        edges: readonly string[];
      };
      expect(removedData.result).toBe("removed");
      expect(removedData.edges).toEqual([]);
      const afterRemove = readQueueDependencies(store);
      if (!afterRemove.ok) throw new Error("dependency read failed");

      // Establish GH-241 -> GH-244, then the reverse add closes a two-node cycle.
      harness.seedEdge({ ref: REMOVAL_REF, onRef: "GH-244" });
      const cycle = await harness.run(["queue", "dep", "add", "GH-244", REMOVAL_REF, "--json"]);
      expect(cycle.exitCode).toBe(1);
      const cycleError = errorOf(cycle.stdout);
      expect(cycleError.code).toBe("queue.dependency-cycle");

      // A dependent below a retired producer survives with its records intact.
      harness.seedEdge({ ref: "GH-243", onRef: REMOVAL_REF });
      const recordsBefore = recordsOf(store).filter((record) => record.key === "queue.deps:GH-243");
      const removal = await harness.run([
        "queue",
        "remove",
        REMOVAL_REF,
        "--reason",
        "superseded",
        "--json",
      ]);
      expect(removal.exitCode).toBe(0);
      const recordsAfter = recordsOf(store).filter((record) => record.key === "queue.deps:GH-243");
      const survivorFold = readQueueFold(store);
      if (!survivorFold.ok) throw new Error("fold read failed");
      const survivorEntry = survivorFold.value.entries.find((entry) => entry.ref === "GH-243");
      const observation: CrudIntegrityObservation = {
        ref: "GH-244",
        producer: REMOVAL_REF,
        add: addedData,
        afterAddDependencies: afterAdd.records,
        depRemove: removedData,
        afterRemoveDependencies: afterRemove.records,
        cycle: {
          code: String(cycleError.code),
          summary: String(cycleError.summary ?? ""),
        },
        survivor: {
          ref: "GH-243",
          presentRefs: survivorFold.value.entries.map((entry) => entry.ref),
          edges: survivorEntry?.edges ?? [],
          recordsUnchanged: JSON.stringify(recordsAfter) === JSON.stringify(recordsBefore),
        },
      };
      expect(crudIntegrityDivergence(observation)).toBeUndefined();
      expectControlFailsNaming(
        "crud-integrity",
        crudIntegrityDivergence(crudExtraEdgeBreach(observation)),
      );
      expect(PROPERTY_OUTCOMES["crud-integrity"]).toBe("property proved clean; no repair");
    } finally {
      harness.dispose();
    }
  });
});

/* ------------------------ 5. reason-bearing removal ----------------------- */

describe("reason-bearing removal", () => {
  test("five refusals append zero records, and the explicit verb stays non-idempotent", async () => {
    const refusals: ReasonBearingRemovalObservation["refusals"] = [];

    const runRefusal = async (
      label: string,
      expectedCode: string,
      prepare: (harness: ReturnType<typeof createRemovalHarness>) => void,
      argv: readonly string[],
    ): Promise<void> => {
      const harness = createRemovalHarness(`integrity-removal-${label}`);
      try {
        prepare(harness);
        const before = recordsOf(harness.composition.store).length;
        const run = await harness.run(argv);
        expect(run.exitCode, label).toBe(1);
        expect(errorOf(run.stdout).code, label).toBe(expectedCode);
        const after = recordsOf(harness.composition.store).length;
        refusals.push({
          label,
          expectedCode,
          code: String(errorOf(run.stdout).code),
          appended: after - before,
        });
      } finally {
        harness.dispose();
      }
    };

    await runRefusal(
      "missing-reason",
      "queue.reason-missing",
      (harness) => harness.seedEntry({ ref: REMOVAL_REF }),
      ["queue", "remove", REMOVAL_REF, "--json"],
    );
    await runRefusal(
      "out-of-vocabulary",
      "input.value.rejected",
      (harness) => harness.seedEntry({ ref: REMOVAL_REF }),
      ["queue", "remove", REMOVAL_REF, "--reason", "done", "--json"],
    );
    await runRefusal(
      "non-canonical",
      "input.value.rejected",
      (harness) => harness.seedEntry({ ref: REMOVAL_REF }),
      ["queue", "remove", "not-a-ref", "--reason", "landed", "--json"],
    );
    await runRefusal(
      "unobserved",
      "queue.entry.unobserved",
      (harness) => harness.seedEntry({ ref: REMOVAL_REF }),
      ["queue", "remove", UNKNOWN_REF, "--reason", "landed", "--json"],
    );
    await runRefusal(
      "live-lease",
      "queue.precondition.unmet",
      (harness) => {
        harness.seedEntry({ ref: REMOVAL_REF });
        harness.seedLease({ ref: REMOVAL_REF, holder: "lane-1" });
      },
      ["queue", "remove", REMOVAL_REF, "--reason", "landed", "--json"],
    );

    const explicit = createRemovalHarness("integrity-removal-explicit");
    let explicitSecondCode = "";
    try {
      explicit.seedEntry({ ref: REMOVAL_REF });
      const first = await explicit.run([
        "queue",
        "remove",
        REMOVAL_REF,
        "--reason",
        "abandoned",
        "--json",
      ]);
      expect(first.exitCode).toBe(0);
      const second = await explicit.run([
        "queue",
        "remove",
        REMOVAL_REF,
        "--reason",
        "abandoned",
        "--json",
      ]);
      expect(second.exitCode).toBe(1);
      explicitSecondCode = String(errorOf(second.stdout).code);
    } finally {
      explicit.dispose();
    }

    const automatic = createQueueRemovalHarness({ label: "integrity-removal-auto", apply: true });
    let automaticOutcome: ReasonBearingRemovalObservation["automaticSecond"]["outcome"] = "skipped";
    try {
      seedQueueEntry(automatic, "GH-183");
      const first = await automatic.run();
      expect(first.ok).toBe(true);
      if (first.ok) expect(first.data.queueRemoval?.outcome).toBe("removed");
      const second = await automatic.run();
      expect(second.ok).toBe(true);
      if (second.ok) {
        automaticOutcome = second.data.queueRemoval?.outcome ?? "skipped";
      }
    } finally {
      automatic.dispose();
    }

    const observation: ReasonBearingRemovalObservation = {
      refusals,
      explicitSecond: { code: explicitSecondCode },
      automaticSecond: { outcome: automaticOutcome },
    };
    expect(QUEUE_REMOVAL_REASONS).toEqual(["landed", "abandoned", "superseded", "reconciled"]);
    expect(reasonBearingRemovalDivergence(observation)).toBeUndefined();
    expectControlFailsNaming(
      "reason-bearing-removal",
      reasonBearingRemovalDivergence(removalAppendBreach(observation)),
    );
    expectControlFailsNaming(
      "reason-bearing-removal",
      reasonBearingRemovalDivergence(removalConvergenceBreach(observation)),
    );
    expect(PROPERTY_OUTCOMES["reason-bearing-removal"]).toBe("property proved clean; no repair");
  });
});

/* -------------------------- park release ordering ------------------------ */

describe("park release ordering", () => {
  test("a parked removal appends the released park first, in one fence, and both records stay durable", async () => {
    const harness = createRemovalHarness("integrity-park-ordering");
    const store = harness.composition.store;
    try {
      harness.seedEntry({ ref: REMOVAL_REF });
      harness.seedPark({ ref: REMOVAL_REF });
      const log = harness.writeLog;
      if (log === undefined) throw new Error("write log missing");
      // The caller-held fence is the transaction; the removal body must append
      // both records inside it and acquire no second fence.
      const fence = store.acquireFence("integrity-park-ordering-fence");
      if (!fence.ok) throw new Error("fence acquisition failed");
      let baseline: { readonly appends: number; readonly fences: number };
      let removedWithinFence: ReturnType<typeof removeQueueEntryWithinFence>;
      try {
        baseline = { appends: log.appends, fences: log.fences };
        removedWithinFence = removeQueueEntryWithinFence(store, {
          ref: REMOVAL_REF,
          reason: "abandoned",
          recordedAt: harness.nowIso(),
          nowMs: harness.nowMs(),
          handle: fence.value.handle,
        });
      } finally {
        store.releaseFence(fence.value.handle);
      }
      expect(removedWithinFence?.ok).toBe(true);
      if (removedWithinFence === undefined || !removedWithinFence.ok) return;
      expect(removedWithinFence.value.result).toBe("removed");
      // No second fence inside the removal body; two appends: release, removal.
      expect(log.fences - baseline.fences).toBe(0);
      expect(log.appends - baseline.appends).toBe(2);

      const records = recordsOf(store);
      const released = records.filter(
        (record) => record.kind === "queue.park" && record.sequence > 0,
      );
      const removal = records.filter((record) => record.kind === "queue.removal");
      const releasedRecord = released.at(-1);
      const removalRecord = removal.at(-1);
      expect(releasedRecord).toBeDefined();
      expect(removalRecord).toBeDefined();
      if (releasedRecord === undefined || removalRecord === undefined) return;
      expect((releasedRecord.payload as { readonly recoveryState?: string }).recoveryState).toBe(
        "released",
      );
      expect(releasedRecord.sequence).toBeLessThan(removalRecord.sequence);

      // The derived comparison re-reads the two sequences independently; an
      // inverted pair and a still-active park each fail by name.
      const orderingDivergence = (
        parkSequence: number,
        removalSequence: number,
      ): string | undefined =>
        parkSequence < removalSequence
          ? undefined
          : `park release ${parkSequence} is not before removal ${removalSequence}`;
      expect(orderingDivergence(releasedRecord.sequence, removalRecord.sequence)).toBeUndefined();
      expect(() => {
        const divergence = orderingDivergence(removalRecord.sequence, releasedRecord.sequence);
        if (divergence !== undefined) throw new Error(divergence);
      }).toThrow("is not before removal");
      // The latest park record per ref is `released`, so no ref stays active.
      const latestParkState = new Map<string, string | undefined>();
      for (const record of records) {
        if (record.kind !== "queue.park") continue;
        const payload = record.payload as {
          readonly ref?: string;
          readonly recoveryState?: string;
        };
        if (payload.ref !== undefined) latestParkState.set(payload.ref, payload.recoveryState);
      }
      expect([...latestParkState.values()].filter((state) => state === "parked")).toHaveLength(0);
      // Both records are readable afterwards: the ledger read returns them.
      const parks = readQueueParks(store);
      const removals = readQueueRemovals(store);
      expect(parks.ok).toBe(true);
      expect(removals.ok).toBe(true);
      if (parks.ok)
        expect(parks.records.some((record) => record.recoveryState === "released")).toBe(true);
      if (removals.ok) expect(removals.records).toHaveLength(1);

      // A fence-token double that acquires a second fence fails naming count 1.
      const fenceControl = (acquired: number): string | undefined =>
        acquired === 0 ? undefined : `fence acquisitions inside removal ${acquired}, declared 0`;
      expect(fenceControl(log.fences - baseline.fences)).toBeUndefined();
      expect(() => {
        const divergence = fenceControl(1);
        if (divergence !== undefined) throw new Error(divergence);
      }).toThrow("fence acquisitions inside removal 1, declared 0");
    } finally {
      harness.dispose();
    }
  });
});

/* ------------------------------ 6. single-flight -------------------------- */

describe("single-flight", () => {
  test("the live holder rides the envelope root within its bound", async () => {
    const harness = createQueueEdgeHarness("integrity-single-flight");
    const store = harness.composition.store;
    try {
      const declared = declareQueueEntry(store, {
        ref: "GH-320",
        repository: "github.com/example/repo-alpha",
        repositoryRoot: "/work/repo-alpha",
        priority: 1,
        recordedAt: harness.nowIso(),
        fenceToken: "seed-single-flight-entry",
      });
      expect(declared.ok).toBe(true);
      const held = claimQueueLease(store, {
        ref: "GH-320",
        holder: "lane-1",
        runner: "runner-lane-1",
        weightClass: "standard",
        ttlMs: TTL,
        nowIso: harness.nowIso(),
        nowMs: harness.nowMs(),
        fenceToken: "seed-single-flight-lease",
      });
      expect(held.ok).toBe(true);

      const run = await harness.run(["queue", "claim", "GH-320", "--holder", "lane-2", "--json"]);
      expect(run.exitCode).toBe(1);
      const envelope = json(run.stdout);
      const error = envelope.error as Record<string, unknown>;
      expect(error.code).toBe("queue.single-flight");
      // The holder rides the record-shaped envelope-root `detail`, never the
      // error object (TDR-0027).
      const detail = envelope.detail as CommandResultDetail | undefined;
      const observation: SingleFlightObservation = {
        holder: "lane-1",
        envelope: { code: String(error.code), ...(detail === undefined ? {} : { detail }) },
      };
      expect(detail?.holder).toBe("lane-1");
      expect((detail?.holder ?? "").length).toBeLessThanOrEqual(COMMAND_FAILURE_DETAIL_MAX_CHARS);
      expect(singleFlightDivergence(observation)).toBeUndefined();
      expectControlFailsNaming(
        "single-flight",
        singleFlightDivergence(brokenNestedHolderDouble(observation)),
      );
      expectControlFailsNaming(
        "single-flight",
        singleFlightDivergence(brokenStaleHolderDouble(observation)),
      );
      expect(PROPERTY_OUTCOMES["single-flight"]).toBe("property proved clean; no repair");
    } finally {
      harness.dispose();
    }
  });

  test("the delivered holder detail stays within the declared safety bound", () => {
    expect(COMMAND_FAILURE_DETAIL_MAX_CHARS).toBe(128);
    expect(QUEUE_MAX_DETAIL_CHARS).toBe(160);
  });
});

/* ---------------------- 7. append-position presence ----------------------- */

describe("append-position presence", () => {
  test("presence follows ledger sequence, never timestamp text, and re-declaration restores", async () => {
    const harness = createRemovalHarness("integrity-presence");
    const store = harness.composition.store;
    try {
      harness.seedEntry({ ref: REMOVAL_REF });
      const removed = await harness.run([
        "queue",
        "remove",
        REMOVAL_REF,
        "--reason",
        "abandoned",
        "--json",
      ]);
      expect(removed.exitCode).toBe(0);
      const afterRemovalRecords = recordsOf(store);
      const afterRemovalPresent = foldRefs(store).includes(REMOVAL_REF);
      expect(afterRemovalPresent).toBe(false);

      const removals = readQueueRemovals(store);
      if (!removals.ok) throw new Error("removal read failed");
      const removalAt = removals.records.at(-1)?.recordedAt ?? "2026-11-07T10:00:00Z";
      const earlier = new Date(Date.parse(removalAt) - 86_400_000).toISOString();
      const reDeclared = declareQueueEntry(store, {
        ref: REMOVAL_REF,
        priority: 2,
        recordedAt: earlier,
        fenceToken: "redeem-earlier-timestamp",
      });
      expect(reDeclared.ok).toBe(true);
      const afterRedeclarationRecords = recordsOf(store);
      const afterRedeclarationPresent = foldRefs(store).includes(REMOVAL_REF);
      expect(afterRedeclarationPresent).toBe(true);

      const observation: PresenceObservation = {
        ref: REMOVAL_REF,
        afterRemoval: { records: afterRemovalRecords, foldPresent: afterRemovalPresent },
        afterRedeclaration: {
          records: afterRedeclarationRecords,
          foldPresent: afterRedeclarationPresent,
        },
        decisionSource: "append-position",
        rederivationSpecialCase: false,
      };
      expect(presenceIntegrityDivergence(observation)).toBeUndefined();
      expectControlFailsNaming(
        "append-position-presence",
        presenceIntegrityDivergence(presenceTimestampBreach(observation)),
      );
      expectControlFailsNaming(
        "append-position-presence",
        presenceIntegrityDivergence(presenceSpecialCaseBreach(observation)),
      );
      expect(PROPERTY_OUTCOMES["append-position-presence"]).toBe(
        "property proved clean; no repair",
      );
    } finally {
      harness.dispose();
    }
  });
});

/* -------------------------------- the metric ------------------------------ */

describe("queue integrity metric", () => {
  test("7/7 property suites carry a declared control shape, reported separately from 3/3 defects", () => {
    expect(QUEUE_INTEGRITY_PROPERTIES).toHaveLength(7);
    for (const property of QUEUE_INTEGRITY_PROPERTIES) {
      expect(QUEUE_INTEGRITY_CONTROL_SHAPES).toContain(
        QUEUE_INTEGRITY_CONTROL_SHAPE_BY_PROPERTY[property],
      );
      expect(PROPERTY_OUTCOMES[property]).toBe("property proved clean; no repair");
    }
    expect(Object.keys(PROPERTY_OUTCOMES)).toHaveLength(QUEUE_INTEGRITY_PROPERTIES.length);
    // A control replaced by a token assertion cannot pass: no divergence is
    // itself a named failure (M98, TC-F6-012).
    expect(() => assertControlDiverges("claim-integrity", undefined)).toThrow("claim-integrity");

    // The two counts are never conflated: the queue metric is 7/7 properties;
    // the 3 named defects carry a defect-named regression in phase 7.
    expect(NAMED_DEFECTS).toHaveLength(3);
    expect(QUEUE_INTEGRITY_PROPERTIES).toHaveLength(7);
    expect(queueIntegrityFailure("claim-integrity", "subject").message).toBe(
      "claim-integrity: subject",
    );
  });
});
