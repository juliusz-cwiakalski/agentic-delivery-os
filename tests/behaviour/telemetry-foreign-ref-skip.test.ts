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
import { readSpendLedger, readTelemetryFamilies } from "../../packages/core/src/state/index";
import {
  ledgerDigest,
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";
import { FOREIGN_REF_SKIP_GOLDEN } from "../fixtures/telemetry/foreign-ref-skip-golden";
import {
  buildGh381GoldenCases,
  GH381_ABSENT_REF,
  GH381_FOREIGN_REF,
  GH381_REF,
  GH381_SCALE_REQUESTED_STEPS,
  GH381_SCALE_TOTAL_RECORDS,
  normalizeGh381Read,
  normalizeGh381Tear,
  seedBarePrefixRecord,
  seedForeignFamilyDamage,
  seedForeignFirstRegression,
  seedInterleavedFamilies,
  seedObservedScaleLedger,
  seedRequestedRefDamage,
} from "../fixtures/telemetry/index";

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
