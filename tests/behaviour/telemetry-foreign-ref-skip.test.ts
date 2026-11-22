/**
 * GH-381 TC-TELEMETRY-040..047 — the per-ref telemetry families read skips
 * well-formed foreign-ref family keys instead of tearing (spec §5.1 F-2
 * table): the bare family prefix tears `state.store.torn` at its own position,
 * the requested ref's key keeps the delivered kind-mismatch tear and payload
 * validation, and a well-formed key under the prefix naming another ref is
 * skipped in ledger order with no kind inspection, no payload inspection, and
 * no evidence contribution. The read stays one verified pass over the ledger,
 * the ledger bytes are never mutated, and single-ref behavior is
 * golden-equal to the captured delivered behavior.
 *
 * GH-384 TC-TELEMETRY-048..056 — the same delivered rule applied unchanged at
 * the two remaining reads: the per-ref steps read `readTelemetrySteps`
 * (composed by the window-scoped zero-spend evidence reading and inherited by
 * the versioned composition) and the per-ref baseline records read
 * `readTelemetryBaselines` (the composition seam of `appendTelemetryBaseline`'s
 * fence-scoped idempotency pre-read and post-verified read). Healthy
 * baselines go through the real helper; the golden-before-fix pin asserts the
 * captured pre-fix halves (FX-R1/FX-R2) and the corrected halves over the
 * committed fixtures, and the FX-13 single-ref section pins byte-identical
 * delivered behavior.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { classifyDomainKind } from "../../packages/cli/src/classify";
import {
  ERROR_TABLE,
  type StateResult,
  type StateStoreIdentity,
  type StateStorePort,
  type TelemetryFamiliesRead,
} from "../../packages/core/src/contracts/index";
import { computeSpendReport } from "../../packages/core/src/domain/spend";
import {
  appendTelemetryBaseline,
  readSpendLedger,
  readTelemetryBaselines,
  readTelemetryFamilies,
  readTelemetrySteps,
  readTelemetryStepsAtVersion,
  TELEMETRY_STORAGE_NEXT_VERSION,
} from "../../packages/core/src/state/index";
import {
  ledgerDigest,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";
import { FOREIGN_REF_SKIP_GOLDEN } from "../fixtures/telemetry/foreign-ref-skip-golden";
import {
  buildGh381GoldenCases,
  buildGh384RegressionCases,
  buildGh384SingleRefCases,
  GH381_ABSENT_REF,
  GH381_FOREIGN_REF,
  GH381_REF,
  GH381_SCALE_REQUESTED_STEPS,
  GH381_SCALE_TOTAL_RECORDS,
  GH384_ABSENT_REF,
  GH384_FOREIGN_REF,
  GH384_REF,
  type Gh381RequestedDamageArm,
  type Gh384CaptureOutcome,
  type Gh384MultiRefReadsGolden,
  type Gh384StepsRead,
  gh384Baseline,
  gh384Step,
  normalizeGh381Read,
  normalizeGh381Tear,
  normalizeGh384AppendOutcome,
  normalizeGh384CaptureTear,
  normalizeGh384StepsRead,
  normalizeGh384StepsTear,
  seedBarePrefixRecord,
  seedBaselines,
  seedForeignFamilyDamage,
  seedForeignFirstRegression,
  seedGh384ForeignFirstRegression,
  seedInterleavedFamilies,
  seedMultiRefStepsFixture,
  seedObservedScaleLedger,
  seedRequestedRefDamage,
  seedSecondRefBaselineFixture,
  seedSteps,
} from "../fixtures/telemetry/index";
import { MULTI_REF_READS_GOLDEN } from "../fixtures/telemetry/multi-ref-reads-golden";

const roots: string[] = [];

/**
 * The observed-scale fixture, built lazily and shared by the suite's scale
 * arms: the delivered verified write re-verifies the whole ledger per append,
 * so seeding 4,806 records is inherently quadratic and one build per suite run
 * is the budget. The store is cleaned up with the rest of the roots.
 */
let scaleFixture: { identity: StateStoreIdentity; store: StateStorePort } | undefined;
const observedScaleStore = (): { identity: StateStoreIdentity; store: StateStorePort } => {
  if (scaleFixture === undefined) {
    const fixture = gh381Store("observed-scale");
    seedObservedScaleLedger(fixture.store, fixture.identity, GH381_REF, GH381_FOREIGN_REF);
    scaleFixture = fixture;
  }
  return scaleFixture;
};

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
  scaleFixture = undefined;
  gh384ScaleFixture = undefined;
});

/** One fresh per-test temp store (removed in afterEach). */
const gh381Store = (label: string): { identity: StateStoreIdentity; store: StateStorePort } => {
  const root = makeTempRoot(`gh381-${label}`);
  roots.push(root);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  return { identity, store };
};

/** The exact projection result one ref's family set must produce in one shared ledger. */
const expectExactlyRef = (
  read: StateResult<TelemetryFamiliesRead>,
  ref: string,
  recordCount: number,
): void => {
  expect(read.ok).toBe(true);
  if (!read.ok) return;
  expect(read.value.steps.map((step) => step.sessionId)).toEqual([
    `ses-gh381-${ref}-s1`,
    `ses-gh381-${ref}-s2`,
  ]);
  expect(read.value.baselines.map((baseline) => baseline.sessionId)).toEqual([
    `ses-gh381-${ref}-baseline`,
  ]);
  expect(read.value.records.map((record) => record.sessionId)).toEqual([`ses-gh381-${ref}-v1`]);
  expect(read.value.outcomes.map((outcome) => outcome.runId)).toEqual([`run-gh381-${ref}`]);
  expect(read.value.verifiedEmpty).toBe(false);
  expect(read.value.evidence.recordCount).toBe(recordCount);
};

/** The delivered torn identity, kind, consequence, and safe location, asserted exactly. */
const expectTornAt = (
  read: StateResult<TelemetryFamiliesRead>,
  identity: StateStoreIdentity,
  record: number,
): void => {
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.error.kind).toBe("state");
  expect(read.error.code).toBe("state.store.torn");
  expect(read.error.consequence).toBe("not_landed");
  expect(read.error.location.path).toBe(ledgerPath(identity));
  expect(read.error.location.record).toBe(record);
  // The delivered identity keeps its delivered projection class.
  const tornEntry = ERROR_TABLE.find((entry) => entry.code === "state.store.torn");
  expect(tornEntry?.projectionClass).toBe("platform-provider");
  expect(classifyDomainKind("state", "state.store.torn").projectionClass).toBe("platform-provider");
};

describe("TC-TELEMETRY-040 interleaved two-ref ledgers read cleanly and exactly scoped", () => {
  test("both read directions return exactly their own ref's records from one shared ledger", () => {
    const { identity, store } = gh381Store("interleaved-requested-first");
    seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
    const readA = readTelemetryFamilies(store, GH381_REF);
    expectExactlyRef(readA, GH381_REF, 10);
    const readB = readTelemetryFamilies(store, GH381_FOREIGN_REF);
    expectExactlyRef(readB, GH381_FOREIGN_REF, 10);
    // One shared ledger disclosed to both reads, never a per-ref slice path.
    if (readA.ok && readB.ok) {
      expect(readB.value.evidence.storePath).toBe(readA.value.evidence.storePath);
      expect(readA.value.evidence.storePath).toBe(ledgerPath(identity));
    }
  });

  test("the reversed interleaving is equally exact — zero foreign in, zero own dropped", () => {
    const { store } = gh381Store("interleaved-foreign-first");
    seedInterleavedFamilies(store, GH381_FOREIGN_REF, GH381_REF);
    expectExactlyRef(readTelemetryFamilies(store, GH381_REF), GH381_REF, 10);
    expectExactlyRef(readTelemetryFamilies(store, GH381_FOREIGN_REF), GH381_FOREIGN_REF, 10);
  });

  test("a ref absent from the ledger reads verified-empty without tearing on foreign records", () => {
    const { store } = gh381Store("interleaved-absent-ref");
    seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
    const read = readTelemetryFamilies(store, GH381_ABSENT_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.verifiedEmpty).toBe(true);
    expect(read.value.steps).toHaveLength(0);
    expect(read.value.baselines).toHaveLength(0);
    expect(read.value.records).toHaveLength(0);
    expect(read.value.outcomes).toHaveLength(0);
    // The evidence still discloses the whole shared ledger.
    expect(read.value.evidence.recordCount).toBe(10);
  });
});

describe("TC-TELEMETRY-041 the observed record-3786 shape: the foreign step records come first", () => {
  test("the read skips the leading foreign steps and the spend fold returns the scoped report", () => {
    const { store } = gh381Store("regression-foreign-first");
    seedForeignFirstRegression(store, GH381_REF, GH381_FOREIGN_REF);
    const read = readTelemetryFamilies(store, GH381_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    // Exactly the requested ref's records: the three leading foreign steps
    // contribute no record, no evidence, and no classification.
    expect(read.value.steps.map((step) => step.sessionId)).toEqual([`ses-gh381-${GH381_REF}-s1`]);
    expect(read.value.baselines).toHaveLength(1);
    expect(read.value.records).toHaveLength(1);
    expect(read.value.outcomes).toHaveLength(1);
    // Seven ledger records: three foreign steps beside the requested ref's
    // four family records, all still disclosed by the evidence.
    expect(read.value.evidence.recordCount).toBe(7);
    // The spend fold composes the same projection over the same ledger.
    const ledger = readSpendLedger(store, GH381_REF);
    expect(ledger.ok).toBe(true);
    if (!ledger.ok) return;
    expect(JSON.stringify(ledger.value.steps)).toBe(JSON.stringify(read.value.steps));
    const fold = computeSpendReport(ledger.value, { workItemRef: GH381_REF });
    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    // The figures derive solely from the requested ref's own step and v1
    // session record (10/5 stream tokens beside 40/20 closeout tokens); any
    // foreign leak would change these exact figures.
    expect(fold.data.tokensByClass).toEqual({
      input: 50,
      output: 25,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });
});

describe("TC-TELEMETRY-042 bare family prefixes tear at their own position, both families", () => {
  test("a bare step prefix tears at its own sequence for a present ref and for an absent ref", () => {
    const { identity, store } = gh381Store("bare-step-prefix");
    seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
    const sequence = seedBarePrefixRecord(store, "step");
    expect(sequence).toBe(11);
    expectTornAt(readTelemetryFamilies(store, GH381_REF), identity, sequence);
    expectTornAt(readTelemetryFamilies(store, GH381_ABSENT_REF), identity, sequence);
  });

  test("a bare baseline prefix tears symmetrically at its own sequence", () => {
    const { identity, store } = gh381Store("bare-baseline-prefix");
    seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
    const sequence = seedBarePrefixRecord(store, "baseline");
    expect(sequence).toBe(11);
    expectTornAt(readTelemetryFamilies(store, GH381_REF), identity, sequence);
    expectTornAt(readTelemetryFamilies(store, GH381_ABSENT_REF), identity, sequence);
  });
});

describe("TC-TELEMETRY-043 requested-ref damage is preserved: kind mismatch and payload validation", () => {
  const expectArm = (arm: Gh381RequestedDamageArm): void => {
    const { identity, store } = gh381Store(`damage-${arm}`);
    seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
    const sequence = seedRequestedRefDamage(store, GH381_REF, arm);
    expect(sequence).toBe(11);
    expectTornAt(readTelemetryFamilies(store, GH381_REF), identity, sequence);
  };

  test("a non-step kind under the requested step key tears as delivered", () => {
    expectArm("stepKindMismatch");
  });

  test("a non-baseline kind under the requested baseline key tears symmetrically as delivered", () => {
    expectArm("baselineKindMismatch");
  });

  test("a malformed requested-ref step payload keeps the delivered classification and location", () => {
    expectArm("stepMalformedPayload");
  });
});

describe("TC-TELEMETRY-044 foreign records are skipped without kind or payload inspection", () => {
  test("step-family variant: the foreign wrong-kind garbage record is skipped for the other ref and tears for its owner", () => {
    const { identity, store } = gh381Store("foreign-damage-step");
    seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
    const sequence = seedForeignFamilyDamage(store, GH381_FOREIGN_REF, "step");
    // The non-owning ref's read succeeds: no kind inspection, no payload
    // inspection, no evidence — the foreign record contributes nothing.
    expectExactlyRef(readTelemetryFamilies(store, GH381_REF), GH381_REF, 11);
    // The owning ref's read tears as requested-ref damage at the record's own
    // position: the boundary is jurisdictional, not "broken records vanish".
    expectTornAt(readTelemetryFamilies(store, GH381_FOREIGN_REF), identity, sequence);
  });

  test("baseline-family variant: symmetric skip for the other ref, symmetric tear for the owner", () => {
    const { identity, store } = gh381Store("foreign-damage-baseline");
    seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
    const sequence = seedForeignFamilyDamage(store, GH381_FOREIGN_REF, "baseline");
    expectExactlyRef(readTelemetryFamilies(store, GH381_REF), GH381_REF, 11);
    expectTornAt(readTelemetryFamilies(store, GH381_FOREIGN_REF), identity, sequence);
  });

  test("healthy control: the same interleaved fixture without the damaged record reads clean", () => {
    const { store } = gh381Store("foreign-damage-control");
    seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
    expectExactlyRef(readTelemetryFamilies(store, GH381_REF), GH381_REF, 10);
    expectExactlyRef(readTelemetryFamilies(store, GH381_FOREIGN_REF), GH381_FOREIGN_REF, 10);
  });
});

/** A counting wrapper over the store port: every ledger read, write, and probe is recorded. */
const countingStore = (store: StateStorePort, calls: Map<string, number>): StateStorePort => ({
  ...store,
  read: (request) => {
    calls.set("read", (calls.get("read") ?? 0) + 1);
    return store.read(request);
  },
  readRecords: () => {
    calls.set("readRecords", (calls.get("readRecords") ?? 0) + 1);
    return store.readRecords();
  },
  append: (handle, request) => {
    calls.set("append", (calls.get("append") ?? 0) + 1);
    return store.append(handle, request);
  },
  replaceDocument: (handle, request) => {
    calls.set("replaceDocument", (calls.get("replaceDocument") ?? 0) + 1);
    return store.replaceDocument(handle, request);
  },
  acquireFence: (token) => {
    calls.set("acquireFence", (calls.get("acquireFence") ?? 0) + 1);
    return store.acquireFence(token);
  },
  checkIntegrity: () => {
    calls.set("checkIntegrity", (calls.get("checkIntegrity") ?? 0) + 1);
    return store.checkIntegrity();
  },
  repairTornTail: () => {
    calls.set("repairTornTail", (calls.get("repairTornTail") ?? 0) + 1);
    return store.repairTornTail();
  },
  salvage: (handle) => {
    calls.set("salvage", (calls.get("salvage") ?? 0) + 1);
    return store.salvage(handle);
  },
});

describe("TC-TELEMETRY-045 the read stays one verified pass at the observed ledger scale", () => {
  test("exactly one readRecords call, zero other reads, zero writes, and byte-identical ledger over 4,806 records", () => {
    const { identity, store } = observedScaleStore();
    const digestBefore = ledgerDigest(identity);
    const calls = new Map<string, number>();
    const read = readTelemetryFamilies(countingStore(store, calls), GH381_REF);
    // The scoped result at observed scale: every requested step present in
    // order, every foreign step and every foreign family record excluded.
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.steps).toHaveLength(GH381_SCALE_REQUESTED_STEPS);
    expect(
      read.value.steps.every(
        (step) =>
          step.workItemRef === GH381_REF && step.sessionId.startsWith(`ses-gh381-${GH381_REF}-`),
      ),
    ).toBe(true);
    expect(read.value.baselines.map((baseline) => baseline.workItemRef)).toEqual([GH381_REF]);
    expect(read.value.records.map((record) => record.workItemRef)).toEqual([GH381_REF]);
    expect(read.value.outcomes.map((outcome) => outcome.runId)).toEqual([`run-gh381-${GH381_REF}`]);
    expect(read.value.verifiedEmpty).toBe(false);
    expect(read.value.evidence.recordCount).toBe(GH381_SCALE_TOTAL_RECORDS);
    expect(GH381_SCALE_TOTAL_RECORDS).toBeGreaterThanOrEqual(4800);
    // NFR-1's 0/0/0 clause, asserted structurally on the port counters.
    expect(calls.get("readRecords")).toBe(1);
    expect(calls.get("read")).toBeUndefined();
    expect(calls.get("append")).toBeUndefined();
    expect(calls.get("replaceDocument")).toBeUndefined();
    expect(calls.get("acquireFence")).toBeUndefined();
    expect(calls.get("checkIntegrity")).toBeUndefined();
    expect(calls.get("repairTornTail")).toBeUndefined();
    expect(calls.get("salvage")).toBeUndefined();
    // The ledger bytes are identical after the read: no mutation of any kind.
    expect(ledgerDigest(identity)).toBe(digestBefore);
  }, 300_000);
});

describe("TC-TELEMETRY-046 single-ref golden equality with the captured delivered behavior", () => {
  test("every FX-5 arm is identical to the golden captured before the branch edit", () => {
    expect(FOREIGN_REF_SKIP_GOLDEN.requestedRef).toBe(GH381_REF);
    expect(FOREIGN_REF_SKIP_GOLDEN.foreignRef).toBe(GH381_FOREIGN_REF);
    const cases = buildGh381GoldenCases();
    try {
      const actual = {
        requestedRef: GH381_REF,
        foreignRef: GH381_FOREIGN_REF,
        healthy: normalizeGh381Read(cases.healthy.identity, cases.healthy.read),
        emptyLedger: normalizeGh381Read(cases.emptyLedger.identity, cases.emptyLedger.read),
        tears: {
          bareStepPrefix: normalizeGh381Tear(
            cases.tears.bareStepPrefix.identity,
            cases.tears.bareStepPrefix.read,
          ),
          bareBaselinePrefix: normalizeGh381Tear(
            cases.tears.bareBaselinePrefix.identity,
            cases.tears.bareBaselinePrefix.read,
          ),
          stepKindMismatch: normalizeGh381Tear(
            cases.tears.stepKindMismatch.identity,
            cases.tears.stepKindMismatch.read,
          ),
          baselineKindMismatch: normalizeGh381Tear(
            cases.tears.baselineKindMismatch.identity,
            cases.tears.baselineKindMismatch.read,
          ),
          stepMalformedPayload: normalizeGh381Tear(
            cases.tears.stepMalformedPayload.identity,
            cases.tears.stepMalformedPayload.read,
          ),
        },
      };
      expect(JSON.stringify(actual)).toBe(JSON.stringify(FOREIGN_REF_SKIP_GOLDEN));
    } finally {
      cases.dispose();
    }
  });
});

describe("TC-TELEMETRY-047 determinism and hermeticity of the proof matrix", () => {
  const matrixArms = (): readonly { readonly name: string; readonly run: () => string }[] => [
    {
      name: "FX-1 requested-first",
      run: () => {
        const { identity, store } = gh381Store("matrix-fx1-a");
        seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
        return JSON.stringify(
          normalizeGh381Read(identity, readTelemetryFamilies(store, GH381_REF)),
        );
      },
    },
    {
      name: "FX-1 foreign-first",
      run: () => {
        const { identity, store } = gh381Store("matrix-fx1-b");
        seedInterleavedFamilies(store, GH381_FOREIGN_REF, GH381_REF);
        return JSON.stringify(
          normalizeGh381Read(identity, readTelemetryFamilies(store, GH381_REF)),
        );
      },
    },
    {
      name: "FX-2 foreign-first regression",
      run: () => {
        const { identity, store } = gh381Store("matrix-fx2");
        seedForeignFirstRegression(store, GH381_REF, GH381_FOREIGN_REF);
        return JSON.stringify(
          normalizeGh381Read(identity, readTelemetryFamilies(store, GH381_REF)),
        );
      },
    },
    {
      name: "FX-3 bare step prefix",
      run: () => {
        const { identity, store } = gh381Store("matrix-fx3-step");
        seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
        seedBarePrefixRecord(store, "step");
        return JSON.stringify(
          normalizeGh381Tear(identity, readTelemetryFamilies(store, GH381_REF)),
        );
      },
    },
    {
      name: "FX-3 bare baseline prefix",
      run: () => {
        const { identity, store } = gh381Store("matrix-fx3-baseline");
        seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
        seedBarePrefixRecord(store, "baseline");
        return JSON.stringify(
          normalizeGh381Tear(identity, readTelemetryFamilies(store, GH381_REF)),
        );
      },
    },
    {
      name: "FX-4 step kind mismatch",
      run: () => {
        const { identity, store } = gh381Store("matrix-fx4-kind");
        seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
        seedRequestedRefDamage(store, GH381_REF, "stepKindMismatch");
        return JSON.stringify(
          normalizeGh381Tear(identity, readTelemetryFamilies(store, GH381_REF)),
        );
      },
    },
    {
      name: "FX-4 baseline kind mismatch",
      run: () => {
        const { identity, store } = gh381Store("matrix-fx4-baseline-kind");
        seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
        seedRequestedRefDamage(store, GH381_REF, "baselineKindMismatch");
        return JSON.stringify(
          normalizeGh381Tear(identity, readTelemetryFamilies(store, GH381_REF)),
        );
      },
    },
    {
      name: "FX-4 malformed step payload",
      run: () => {
        const { identity, store } = gh381Store("matrix-fx4-payload");
        seedInterleavedFamilies(store, GH381_REF, GH381_FOREIGN_REF);
        seedRequestedRefDamage(store, GH381_REF, "stepMalformedPayload");
        return JSON.stringify(
          normalizeGh381Tear(identity, readTelemetryFamilies(store, GH381_REF)),
        );
      },
    },
  ];

  test("every small fixture rebuilds byte-identically across three runs", () => {
    for (const arm of matrixArms()) {
      const runs = [arm.run(), arm.run(), arm.run()];
      expect(runs[0]).toBe(runs[1]);
      expect(runs[1]).toBe(runs[2]);
    }
  });

  test("the observed-scale fixture reads identically across three runs with no network seam reachable", () => {
    const { identity, store } = observedScaleStore();
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (() => {
        throw new Error("network not licensed");
      }) as typeof fetch;
      const runs = [
        JSON.stringify(normalizeGh381Read(identity, readTelemetryFamilies(store, GH381_REF))),
        JSON.stringify(normalizeGh381Read(identity, readTelemetryFamilies(store, GH381_REF))),
        JSON.stringify(normalizeGh381Read(identity, readTelemetryFamilies(store, GH381_REF))),
      ];
      expect(runs[0]).toBe(runs[1]);
      expect(runs[1]).toBe(runs[2]);
      expect(runs[0]).toContain(`"verifiedEmpty":false`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }, 300_000);
});

// ---------------------------------------------------------------------------
// GH-384 TC-TELEMETRY-048..056 — the steps read and the baseline idempotency
// composition path under the delivered families rule, over the GH-384 fixture
// family (FX-8, FX-8-WE lives with its consumer in the spend suite, FX-9,
// FX-10, FX-11, FX-12, FX-R1, FX-R2, FX-13).
// ---------------------------------------------------------------------------

/** One fresh per-test GH-384 temp store (removed in afterEach). */
const gh384Store = (label: string): { identity: StateStoreIdentity; store: StateStorePort } => {
  const root = makeTempRoot(`gh384-suite-${label}`);
  roots.push(root);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  return { identity, store };
};

/**
 * The GH-384 observed-scale fixture, built lazily and shared by the suite's
 * scale arm: the delivered verified write re-verifies the whole ledger per
 * append, so seeding 4,806 records is inherently quadratic and one build per
 * suite run is the budget.
 */
let gh384ScaleFixture: { identity: StateStoreIdentity; store: StateStorePort } | undefined;
const gh384ObservedScaleStore = (): { identity: StateStoreIdentity; store: StateStorePort } => {
  if (gh384ScaleFixture === undefined) {
    const fixture = gh384Store("observed-scale");
    seedObservedScaleLedger(fixture.store, fixture.identity, GH384_REF, GH384_FOREIGN_REF);
    gh384ScaleFixture = fixture;
  }
  return gh384ScaleFixture;
};

/** The exact steps-read result one ref's two seeded steps must produce. */
const expectGh384StepsExactlyRef = (read: StateResult<Gh384StepsRead>, ref: string): void => {
  expect(read.ok).toBe(true);
  if (!read.ok) return;
  expect(read.value.records.map((step) => step.sessionId)).toEqual([
    `ses-gh384-${ref}-s1`,
    `ses-gh384-${ref}-s2`,
  ]);
  expect(read.value.records.every((step) => step.workItemRef === ref)).toBe(true);
};

/** The delivered torn identity on a steps read, asserted exactly. */
const expectStepsTornAt = (
  read: StateResult<Gh384StepsRead>,
  identity: StateStoreIdentity,
  record: number,
): void => {
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.error.kind).toBe("state");
  expect(read.error.code).toBe("state.store.torn");
  expect(read.error.consequence).toBe("not_landed");
  expect(read.error.location.path).toBe(ledgerPath(identity));
  expect(read.error.location.record).toBe(record);
};

/** The delivered torn identity on a baseline capture, asserted exactly. */
const expectCaptureTornAt = (
  result: StateResult<Gh384CaptureOutcome>,
  identity: StateStoreIdentity,
  record: number,
): void => {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.error.kind).toBe("state");
  expect(result.error.code).toBe("state.store.torn");
  expect(result.error.consequence).toBe("not_landed");
  expect(result.error.location.path).toBe(ledgerPath(identity));
  expect(result.error.location.record).toBe(record);
};

describe("TC-TELEMETRY-048 the steps read projects exactly one ref from an interleaved two-ref ledger", () => {
  test("both read directions return exactly their own ref's steps from one shared ledger", () => {
    const { identity, store } = gh384Store("fx8-requested-first");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const readRequested = readTelemetrySteps(store, GH384_REF);
    const readForeign = readTelemetrySteps(store, GH384_FOREIGN_REF);
    expectGh384StepsExactlyRef(readRequested, GH384_REF);
    expectGh384StepsExactlyRef(readForeign, GH384_FOREIGN_REF);
    if (readRequested.ok && readForeign.ok) {
      // One shared ledger disclosed to both reads, never a per-ref slice path.
      expect(readForeign.value.evidence.storePath).toBe(readRequested.value.evidence.storePath);
      expect(readRequested.value.evidence.storePath).toBe(ledgerPath(identity));
      // The delivered ledger-wide verified-empty pass-through, pinned equal to
      // the families rule's per-ref derivation while both refs hold records.
      const families = readTelemetryFamilies(store, GH384_REF);
      expect(families.ok).toBe(true);
      if (families.ok) {
        expect(readRequested.value.verifiedEmpty).toBe(false);
        expect(readRequested.value.verifiedEmpty).toBe(families.value.verifiedEmpty);
      }
    }
  });

  test("the reversed interleaving is equally exact — zero foreign in, zero own dropped", () => {
    const { store } = gh384Store("fx8-foreign-first");
    seedMultiRefStepsFixture(store, GH384_FOREIGN_REF, GH384_REF);
    expectGh384StepsExactlyRef(readTelemetrySteps(store, GH384_REF), GH384_REF);
    expectGh384StepsExactlyRef(readTelemetrySteps(store, GH384_FOREIGN_REF), GH384_FOREIGN_REF);
    const families = readTelemetryFamilies(store, GH384_FOREIGN_REF);
    expect(families.ok).toBe(true);
    const steps = readTelemetrySteps(store, GH384_FOREIGN_REF);
    if (families.ok && steps.ok) {
      expect(steps.value.verifiedEmpty).toBe(families.value.verifiedEmpty);
    }
  });

  test("a ref absent from the ledger reads empty without tearing on foreign records, over the delivered pass-through", () => {
    const { identity, store } = gh384Store("fx8-absent-ref");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const read = readTelemetrySteps(store, GH384_ABSENT_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(0);
    // The delivered ledger-wide pass-through over this non-empty ledger: the
    // flag is false for the absent ref too (the settled contract; no
    // derivation is invented in this assertion).
    expect(read.value.verifiedEmpty).toBe(false);
    // The evidence still discloses the whole shared ledger.
    expect(read.value.evidence.storePath).toBe(ledgerPath(identity));
  });

  test("the versioned composition inherits the corrected steps read unchanged", () => {
    const { store } = gh384Store("fx8-versioned");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const read = readTelemetrySteps(store, GH384_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const atVersion = readTelemetryStepsAtVersion(store, GH384_REF, TELEMETRY_STORAGE_NEXT_VERSION);
    expect(atVersion.ok).toBe(true);
    if (!atVersion.ok) return;
    expect(JSON.stringify(atVersion.value.records)).toBe(
      JSON.stringify(
        read.value.records.map((record) => ({
          ...record,
          storageVersion: TELEMETRY_STORAGE_NEXT_VERSION,
        })),
      ),
    );
    expect(atVersion.value.evidence).toEqual(read.value.evidence);
  });
});

describe("TC-TELEMETRY-049 foreign records are declined without kind or payload inspection at both sites", () => {
  test("step-family arm: the foreign wrong-kind garbage record is skipped for the other ref and tears for its owner", () => {
    const { identity, store } = gh384Store("fx12-foreign-damage-step");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const sequence = seedForeignFamilyDamage(store, GH384_FOREIGN_REF, "step");
    expect(sequence).toBe(7);
    // The non-owning ref's read succeeds: no kind inspection, no payload
    // inspection, no evidence — the classification is key-first, not
    // kind-first (the pre-fix kind branch tore exactly here).
    expectGh384StepsExactlyRef(readTelemetrySteps(store, GH384_REF), GH384_REF);
    // The owning ref's read tears as requested-ref damage at the record's own
    // position: the boundary is jurisdictional, not "broken records vanish".
    expectStepsTornAt(readTelemetrySteps(store, GH384_FOREIGN_REF), identity, sequence);
  });

  test("baseline-family arm: a third ref's damaged baseline key is skipped untouched by both idempotency reads", () => {
    const { identity, store } = gh384Store("fx12-foreign-damage-baseline");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const sequence = seedForeignFamilyDamage(store, GH384_ABSENT_REF, "baseline");
    expect(sequence).toBe(7);
    // The non-owning ref's capture proceeds through both idempotency reads —
    // a distinct-session append so the post-verified read runs too — with the
    // foreign baseline key skipped untouched by both.
    const distinct = {
      ...gh384Baseline(GH384_REF),
      sessionId: `ses-gh384-${GH384_REF}-baseline-2`,
    };
    const capture = appendTelemetryBaseline(store, "gh384-tc049-capture", distinct);
    expect(capture.ok).toBe(true);
    if (capture.ok) expect(capture.value.appended).toBe(true);
    // The damaged record's own ref tears as requested-ref damage.
    const ownerCapture = appendTelemetryBaseline(
      store,
      "gh384-tc049-owner",
      gh384Baseline(GH384_ABSENT_REF),
    );
    expectCaptureTornAt(ownerCapture, identity, sequence);
  });

  test("healthy control: the same interleaved fixture without a damaged record reads clean", () => {
    const { store } = gh384Store("fx12-control");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    expectGh384StepsExactlyRef(readTelemetrySteps(store, GH384_REF), GH384_REF);
    expectGh384StepsExactlyRef(readTelemetrySteps(store, GH384_FOREIGN_REF), GH384_FOREIGN_REF);
  });
});

describe("TC-TELEMETRY-050 second-ref baseline capture through the real append helper", () => {
  test("append, idempotent repeat, distinct-session append, and byte-identity of every pre-existing record", () => {
    const { identity, store } = gh384Store("fx9-second-ref");
    seedSecondRefBaselineFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const linesBefore = ledgerText(identity)
      .split("\n")
      .filter((line) => line !== "");
    expect(linesBefore).toHaveLength(5);
    // Ref B's capture through the real helper, its own fence token: it
    // succeeds on a ledger holding ref A's baselines — the defect site closed.
    const first = appendTelemetryBaseline(
      store,
      "gh384-tc050-first",
      gh384Baseline(GH384_FOREIGN_REF),
    );
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.appended).toBe(true);
      expect(first.value.append?.sequence).toBe(6);
    }
    // The same-identity repeat is the delivered no-op, never a duplicate:
    const repeat = appendTelemetryBaseline(
      store,
      "gh384-tc050-repeat",
      gh384Baseline(GH384_FOREIGN_REF),
    );
    expect(repeat.ok).toBe(true);
    if (repeat.ok) expect(repeat.value.appended).toBe(false);
    // A distinct session of the same ref appends as delivered:
    const distinct = {
      ...gh384Baseline(GH384_FOREIGN_REF),
      sessionId: `ses-gh384-${GH384_FOREIGN_REF}-baseline-2`,
    };
    const secondSession = appendTelemetryBaseline(store, "gh384-tc050-distinct", distinct);
    expect(secondSession.ok).toBe(true);
    if (secondSession.ok) {
      expect(secondSession.value.appended).toBe(true);
      expect(secondSession.value.append?.sequence).toBe(7);
    }
    // Every pre-existing ledger record is byte-identical; the ledger grew by
    // exactly the two appended records — no reorder, rewrite, or drop.
    const linesAfter = ledgerText(identity)
      .split("\n")
      .filter((line) => line !== "");
    expect(linesAfter).toHaveLength(7);
    expect(linesAfter.slice(0, 5)).toEqual(linesBefore);
  });
});

describe("TC-TELEMETRY-051 bare family prefixes tear at their own position, both families, both sites", () => {
  test("a bare step prefix tears the steps read at its own sequence for a present ref and for an absent ref", () => {
    const { identity, store } = gh384Store("fx10-bare-step");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const sequence = seedBarePrefixRecord(store, "step");
    expect(sequence).toBe(7);
    expectStepsTornAt(readTelemetrySteps(store, GH384_REF), identity, sequence);
    expectStepsTornAt(readTelemetrySteps(store, GH384_ABSENT_REF), identity, sequence);
  });

  test("a bare baseline prefix tears the capture's idempotency pre-read at its own sequence, and the fence is released", () => {
    const { identity, store } = gh384Store("fx10-bare-baseline");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const sequence = seedBarePrefixRecord(store, "baseline");
    expect(sequence).toBe(7);
    const distinct = {
      ...gh384Baseline(GH384_FOREIGN_REF),
      sessionId: `ses-gh384-${GH384_FOREIGN_REF}-baseline-2`,
    };
    const capture = appendTelemetryBaseline(store, "gh384-tc051-bare", distinct);
    expectCaptureTornAt(capture, identity, sequence);
    // The failed capture released its fence: the same token is acquirable again.
    const reacquired = store.acquireFence("gh384-tc051-bare");
    expect(reacquired.ok).toBe(true);
    if (reacquired.ok) store.releaseFence(reacquired.value.handle);
    // The AC's "for any ref" clause: a ref absent from the fixture tears identically.
    const absentCapture = appendTelemetryBaseline(
      store,
      "gh384-tc051-absent",
      gh384Baseline(GH384_ABSENT_REF),
    );
    expectCaptureTornAt(absentCapture, identity, sequence);
  });
});

describe("TC-TELEMETRY-052 requested-ref damage is preserved: kind mismatch and payload validation unchanged", () => {
  test("a non-step kind under the requested step key tears as delivered", () => {
    const { identity, store } = gh384Store("fx11-step-kind");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const sequence = seedRequestedRefDamage(store, GH384_REF, "stepKindMismatch");
    expect(sequence).toBe(7);
    expectStepsTornAt(readTelemetrySteps(store, GH384_REF), identity, sequence);
  });

  test("a non-baseline kind under the requested baseline key tears the capture pre-read as delivered", () => {
    const { identity, store } = gh384Store("fx11-baseline-kind");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const sequence = seedRequestedRefDamage(store, GH384_REF, "baselineKindMismatch");
    expect(sequence).toBe(7);
    const capture = appendTelemetryBaseline(store, "gh384-tc052-kind", gh384Baseline(GH384_REF));
    expectCaptureTornAt(capture, identity, sequence);
  });

  test("a malformed requested-ref step payload keeps the delivered classification and location", () => {
    const { identity, store } = gh384Store("fx11-step-payload");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const sequence = seedRequestedRefDamage(store, GH384_REF, "stepMalformedPayload");
    expect(sequence).toBe(7);
    expectStepsTornAt(readTelemetrySteps(store, GH384_REF), identity, sequence);
  });
});

describe("TC-TELEMETRY-053 the named pre-fix regression pin over the committed golden", () => {
  test("the golden holds both pre-fix halves at the fixtures' deterministic sequences and both corrected halves", () => {
    expect(MULTI_REF_READS_GOLDEN.requestedRef).toBe(GH384_REF);
    expect(MULTI_REF_READS_GOLDEN.foreignRef).toBe(GH384_FOREIGN_REF);
    // FX-R1: the steps read tore at the leading foreign step record.
    expect(MULTI_REF_READS_GOLDEN.fxR1.preFix.code).toBe("state.store.torn");
    expect(MULTI_REF_READS_GOLDEN.fxR1.preFix.location.record).toBe(1);
    // FX-R2: ref B's capture tore in the idempotency pre-read at ref A's
    // baseline record — the proof the fixtures genuinely exercise the defect.
    expect(MULTI_REF_READS_GOLDEN.fxR2.preFix.code).toBe("state.store.torn");
    expect(MULTI_REF_READS_GOLDEN.fxR2.preFix.location.record).toBe(1);
    // The corrected halves were captured after the fix.
    expect(MULTI_REF_READS_GOLDEN.fxR1.corrected).not.toBeNull();
    expect(MULTI_REF_READS_GOLDEN.fxR2.corrected).not.toBeNull();
  });

  test("FX-R1 corrected: the steps read succeeds with exactly the requested ref's records over the same builders", () => {
    const corrected = MULTI_REF_READS_GOLDEN.fxR1.corrected;
    if (corrected === null) {
      throw new Error("the golden's corrected fxR1 half is missing — rerun the capture entry");
    }
    const { identity, store } = gh384Store("fx-r1-live");
    seedGh384ForeignFirstRegression(store, GH384_REF, GH384_FOREIGN_REF);
    const read = readTelemetrySteps(store, GH384_REF);
    expect(read.ok).toBe(true);
    if (read.ok) {
      // Exactly the requested ref's records: the three leading foreign steps
      // contribute no record, no classification, and no evidence.
      expect(read.value.records.map((step) => step.sessionId)).toEqual([
        `ses-gh384-${GH384_REF}-s1`,
      ]);
    }
    expect(JSON.stringify(normalizeGh384StepsRead(identity, read))).toBe(JSON.stringify(corrected));
  });

  test("FX-R2 corrected: ref B's capture succeeds and repeats as the no-op over the same builders", () => {
    const corrected = MULTI_REF_READS_GOLDEN.fxR2.corrected;
    if (corrected === null) {
      throw new Error("the golden's corrected fxR2 half is missing — rerun the capture entry");
    }
    const cases = buildGh384RegressionCases();
    try {
      expect(cases.fxR2.first.ok).toBe(true);
      expect(cases.fxR2.repeat).toBeDefined();
      if (cases.fxR2.first.ok && cases.fxR2.repeat !== undefined) {
        expect(
          JSON.stringify({
            first: normalizeGh384AppendOutcome(cases.fxR2.first),
            repeat: normalizeGh384AppendOutcome(cases.fxR2.repeat),
          }),
        ).toBe(JSON.stringify(corrected));
      }
    } finally {
      cases.dispose();
    }
  });
});

describe("TC-TELEMETRY-054 the reads stay one verified pass with the delivered append read shape", () => {
  test("the steps read performs exactly one readRecords call with zero other port traffic", () => {
    const { identity, store } = gh384Store("fx8-counting-steps");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const digestBefore = ledgerDigest(identity);
    const calls = new Map<string, number>();
    const read = readTelemetrySteps(countingStore(store, calls), GH384_REF);
    expectGh384StepsExactlyRef(read, GH384_REF);
    // NFR-1's 0/0/0 clause, asserted structurally on the port counters.
    expect(calls.get("readRecords")).toBe(1);
    expect(calls.get("read")).toBeUndefined();
    expect(calls.get("append")).toBeUndefined();
    expect(calls.get("replaceDocument")).toBeUndefined();
    expect(calls.get("acquireFence")).toBeUndefined();
    expect(calls.get("checkIntegrity")).toBeUndefined();
    expect(calls.get("repairTornTail")).toBeUndefined();
    expect(calls.get("salvage")).toBeUndefined();
    // The ledger bytes are identical after the read: no mutation of any kind.
    expect(ledgerDigest(identity)).toBe(digestBefore);
  });

  test("each baseline idempotency read and the helper invocation keep the delivered read shape", () => {
    const { identity, store } = gh384Store("fx9-counting");
    seedSecondRefBaselineFixture(store, GH384_REF, GH384_FOREIGN_REF);
    // The pre-read context: exactly one verified pass, zero writes.
    const preCalls = new Map<string, number>();
    const pre = readTelemetryBaselines(countingStore(store, preCalls), GH384_FOREIGN_REF);
    expect(pre.ok).toBe(true);
    expect(preCalls.get("readRecords")).toBe(1);
    expect(preCalls.get("append")).toBeUndefined();
    // Ref B's capture through the real helper under the counting port:
    // exactly two reads (the fence-scoped pre-read and post-verified read)
    // and exactly one append — zero additional store reads, zero per-record
    // re-reads, zero harness or session queries.
    const captureCalls = new Map<string, number>();
    const capture = appendTelemetryBaseline(
      countingStore(store, captureCalls),
      "gh384-tc054-helper",
      gh384Baseline(GH384_FOREIGN_REF),
    );
    expect(capture.ok).toBe(true);
    if (capture.ok) {
      expect(capture.value.appended).toBe(true);
      expect(capture.value.append?.sequence).toBe(6);
    }
    expect(captureCalls.get("readRecords")).toBe(2);
    expect(captureCalls.get("append")).toBe(1);
    expect(captureCalls.get("acquireFence")).toBe(1);
    expect(captureCalls.get("read")).toBeUndefined();
    expect(captureCalls.get("replaceDocument")).toBeUndefined();
    expect(captureCalls.get("checkIntegrity")).toBeUndefined();
    expect(captureCalls.get("repairTornTail")).toBeUndefined();
    expect(captureCalls.get("salvage")).toBeUndefined();
    // The ledger grew by exactly the appended record.
    const lines = ledgerText(identity)
      .split("\n")
      .filter((line) => line !== "");
    expect(lines).toHaveLength(6);
  });

  test("the steps read at observed scale returns the scoped result with each foreign record visited exactly once", () => {
    const { identity, store } = gh384ObservedScaleStore();
    const digestBefore = ledgerDigest(identity);
    const read = readTelemetrySteps(store, GH384_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(GH381_SCALE_REQUESTED_STEPS);
    expect(read.value.records.every((step) => step.workItemRef === GH384_REF)).toBe(true);
    expect(GH381_SCALE_TOTAL_RECORDS).toBeGreaterThanOrEqual(4800);
    // The ledger bytes are identical after the read: no mutation of any kind.
    expect(ledgerDigest(identity)).toBe(digestBefore);
  }, 300_000);
});

describe("TC-TELEMETRY-055 single-ref golden equality with delivered behavior (negative controls)", () => {
  test("every FX-13 arm is identical to the golden captured before the branch edit", () => {
    expect(MULTI_REF_READS_GOLDEN.requestedRef).toBe(GH384_REF);
    const cases = buildGh384SingleRefCases();
    try {
      const actual: Gh384MultiRefReadsGolden["singleRef"] = {
        healthy: {
          stepsRead: normalizeGh384StepsRead(cases.healthy.identity, cases.healthy.stepsRead),
          first: normalizeGh384AppendOutcome(cases.healthy.first),
          repeat: normalizeGh384AppendOutcome(cases.healthy.repeat),
        },
        emptyLedger: {
          stepsRead: normalizeGh384StepsRead(
            cases.emptyLedger.identity,
            cases.emptyLedger.stepsRead,
          ),
        },
        tears: {
          bareStepPrefix: normalizeGh384StepsTear(
            cases.tears.bareStepPrefix.identity,
            cases.tears.bareStepPrefix.stepsRead,
          ),
          bareBaselinePrefix: normalizeGh384CaptureTear(
            cases.tears.bareBaselinePrefix.identity,
            cases.tears.bareBaselinePrefix.capture,
          ),
          stepKindMismatch: normalizeGh384StepsTear(
            cases.tears.stepKindMismatch.identity,
            cases.tears.stepKindMismatch.stepsRead,
          ),
          baselineKindMismatch: normalizeGh384CaptureTear(
            cases.tears.baselineKindMismatch.identity,
            cases.tears.baselineKindMismatch.capture,
          ),
          stepMalformedPayload: normalizeGh384StepsTear(
            cases.tears.stepMalformedPayload.identity,
            cases.tears.stepMalformedPayload.stepsRead,
          ),
        },
      };
      expect(JSON.stringify(actual)).toBe(JSON.stringify(MULTI_REF_READS_GOLDEN.singleRef));
    } finally {
      cases.dispose();
    }
  });
});

describe("TC-TELEMETRY-056 determinism, hermeticity, and vocabulary freeze of the proof matrix", () => {
  const matrixArms = (): readonly { readonly name: string; readonly run: () => string }[] => [
    {
      name: "FX-8 requested-first steps read",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx8-a");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        return JSON.stringify(
          normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_REF)),
        );
      },
    },
    {
      name: "FX-8 foreign-first steps read",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx8-b");
        seedMultiRefStepsFixture(store, GH384_FOREIGN_REF, GH384_REF);
        return JSON.stringify(
          normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_FOREIGN_REF)),
        );
      },
    },
    {
      name: "FX-8 absent-ref steps read",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx8-c");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        return JSON.stringify(
          normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_ABSENT_REF)),
        );
      },
    },
    {
      name: "FX-9 second-ref capture and no-op repeat",
      run: () => {
        const { store } = gh384Store("matrix-fx9");
        seedSecondRefBaselineFixture(store, GH384_REF, GH384_FOREIGN_REF);
        const first = appendTelemetryBaseline(
          store,
          "gh384-matrix-fx9-first",
          gh384Baseline(GH384_FOREIGN_REF),
        );
        const repeat = appendTelemetryBaseline(
          store,
          "gh384-matrix-fx9-repeat",
          gh384Baseline(GH384_FOREIGN_REF),
        );
        return JSON.stringify({
          first: normalizeGh384AppendOutcome(first),
          repeat: normalizeGh384AppendOutcome(repeat),
        });
      },
    },
    {
      name: "FX-10 bare step prefix tear",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx10-step");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        seedBarePrefixRecord(store, "step");
        return JSON.stringify(
          normalizeGh384StepsTear(identity, readTelemetrySteps(store, GH384_REF)),
        );
      },
    },
    {
      name: "FX-10 bare baseline prefix tear",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx10-baseline");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        seedBarePrefixRecord(store, "baseline");
        return JSON.stringify(
          normalizeGh384CaptureTear(
            identity,
            appendTelemetryBaseline(
              store,
              "gh384-matrix-fx10-baseline",
              gh384Baseline(GH384_FOREIGN_REF),
            ),
          ),
        );
      },
    },
    {
      name: "FX-11 step kind mismatch tear",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx11-step-kind");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        seedRequestedRefDamage(store, GH384_REF, "stepKindMismatch");
        return JSON.stringify(
          normalizeGh384StepsTear(identity, readTelemetrySteps(store, GH384_REF)),
        );
      },
    },
    {
      name: "FX-11 baseline kind mismatch tear",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx11-baseline-kind");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        seedRequestedRefDamage(store, GH384_REF, "baselineKindMismatch");
        return JSON.stringify(
          normalizeGh384CaptureTear(
            identity,
            appendTelemetryBaseline(
              store,
              "gh384-matrix-fx11-baseline-kind",
              gh384Baseline(GH384_REF),
            ),
          ),
        );
      },
    },
    {
      name: "FX-11 malformed step payload tear",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx11-payload");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        seedRequestedRefDamage(store, GH384_REF, "stepMalformedPayload");
        return JSON.stringify(
          normalizeGh384StepsTear(identity, readTelemetrySteps(store, GH384_REF)),
        );
      },
    },
    {
      name: "FX-12 foreign step damage skip",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx12-step");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        seedForeignFamilyDamage(store, GH384_FOREIGN_REF, "step");
        return JSON.stringify(
          normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_REF)),
        );
      },
    },
    {
      name: "FX-12 foreign baseline damage capture",
      run: () => {
        const { store } = gh384Store("matrix-fx12-baseline");
        seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
        seedForeignFamilyDamage(store, GH384_ABSENT_REF, "baseline");
        const capture = appendTelemetryBaseline(store, "gh384-matrix-fx12-baseline", {
          ...gh384Baseline(GH384_REF),
          sessionId: `ses-gh384-${GH384_REF}-baseline-2`,
        });
        return JSON.stringify(normalizeGh384AppendOutcome(capture));
      },
    },
    {
      name: "FX-R1 corrected steps read",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx-r1");
        seedGh384ForeignFirstRegression(store, GH384_REF, GH384_FOREIGN_REF);
        return JSON.stringify(
          normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_REF)),
        );
      },
    },
    {
      name: "FX-R2 corrected capture and no-op repeat",
      run: () => {
        const { store } = gh384Store("matrix-fx-r2");
        seedBaselines(store, [gh384Baseline(GH384_FOREIGN_REF)]);
        const first = appendTelemetryBaseline(
          store,
          "gh384-matrix-fx-r2-first",
          gh384Baseline(GH384_REF),
        );
        const repeat = appendTelemetryBaseline(
          store,
          "gh384-matrix-fx-r2-repeat",
          gh384Baseline(GH384_REF),
        );
        return JSON.stringify({
          first: normalizeGh384AppendOutcome(first),
          repeat: normalizeGh384AppendOutcome(repeat),
        });
      },
    },
    {
      name: "FX-13 healthy single-ref arm",
      run: () => {
        const { identity, store } = gh384Store("matrix-fx13");
        seedSteps(store, [gh384Step(GH384_REF, 1), gh384Step(GH384_REF, 2)]);
        const first = appendTelemetryBaseline(
          store,
          "gh384-matrix-fx13-first",
          gh384Baseline(GH384_REF),
        );
        const repeat = appendTelemetryBaseline(
          store,
          "gh384-matrix-fx13-repeat",
          gh384Baseline(GH384_REF),
        );
        return JSON.stringify({
          stepsRead: normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_REF)),
          first: normalizeGh384AppendOutcome(first),
          repeat: normalizeGh384AppendOutcome(repeat),
        });
      },
    },
  ];

  test("every matrix fixture rebuilds byte-identically across three runs", () => {
    for (const arm of matrixArms()) {
      const runs = [arm.run(), arm.run(), arm.run()];
      expect(runs[0]).toBe(runs[1]);
      expect(runs[1]).toBe(runs[2]);
    }
  });

  test("the matrix runs with no network seam reachable", () => {
    const { identity, store } = gh384Store("matrix-hermetic");
    seedMultiRefStepsFixture(store, GH384_REF, GH384_FOREIGN_REF);
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (() => {
        throw new Error("network not licensed");
      }) as typeof fetch;
      const runs = [
        JSON.stringify(normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_REF))),
        JSON.stringify(normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_REF))),
        JSON.stringify(normalizeGh384StepsRead(identity, readTelemetrySteps(store, GH384_REF))),
      ];
      expect(runs[0]).toBe(runs[1]);
      expect(runs[1]).toBe(runs[2]);
      expect(runs[0]).toContain('"verifiedEmpty":false');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("the change's own paths emit only delivered identities — the vocabulary is frozen", () => {
    const tornEntry = ERROR_TABLE.find((entry) => entry.code === "state.store.torn");
    expect(tornEntry?.projectionClass).toBe("platform-provider");
    expect(classifyDomainKind("state", "state.store.torn").projectionClass).toBe(
      "platform-provider",
    );
    expect(MULTI_REF_READS_GOLDEN.fxR1.preFix.code).toBe("state.store.torn");
    expect(MULTI_REF_READS_GOLDEN.fxR2.preFix.code).toBe("state.store.torn");
    for (const tear of Object.values(MULTI_REF_READS_GOLDEN.singleRef.tears)) {
      expect(tear.code).toBe("state.store.torn");
      expect(tear.kind).toBe("state");
      expect(tear.consequence).toBe("not_landed");
    }
  });
});
