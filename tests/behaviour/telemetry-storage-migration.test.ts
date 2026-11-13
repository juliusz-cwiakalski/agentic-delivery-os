/**
 * TC-TELEMETRY-010 — a storage version bump migrates by re-reading: the
 * versioned payload is the source, every record stays attributable, no record
 * is dropped or mutated in place, and the pre-bump reader agrees.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { TELEMETRY_STORAGE_SCHEMA_VERSION } from "../../packages/core/src/contracts/index";
import {
  readTelemetrySteps,
  readTelemetryStepsAtVersion,
  TELEMETRY_STORAGE_NEXT_VERSION,
} from "../../packages/core/src/state/index";
import {
  ledgerDigest,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";
import {
  AGENT_ROLE,
  LANE,
  MODEL_A,
  MODEL_B,
  makeStepRecord,
  RUN_A,
  RUN_B,
  SESSION_A,
  SESSION_B,
  seedSteps,
  T1,
  T2,
  TELEMETRY_REF,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const seeded = () => {
  const root = makeTempRoot("gh291-migration");
  roots.push(root);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedSteps(store, [
    makeStepRecord({ runId: RUN_A, sessionId: SESSION_A, model: MODEL_A, calls: 2, cost: 0.0125 }),
    makeStepRecord({
      runId: RUN_B,
      sessionId: SESSION_B,
      model: MODEL_B,
      tokens: tokens({ input: 7, reasoning: null }),
      calls: 1,
      cost: null,
      warnings: [
        { reason: "optional-field-absent", field: "tokens.reasoning" },
        { reason: "cost-missing", field: "cost" },
      ],
      finishedAt: T2,
    }),
  ]);
  return { root, identity, store };
};

describe("TC-TELEMETRY-010 version bump migrates by re-reading", () => {
  test("the version-N reader and the version-(N+1) reader see the same records", () => {
    const { store } = seeded();
    const atV1 = readTelemetrySteps(store, TELEMETRY_REF);
    const atV2 = readTelemetryStepsAtVersion(store, TELEMETRY_REF, TELEMETRY_STORAGE_NEXT_VERSION);
    expect(atV1.ok).toBe(true);
    expect(atV2.ok).toBe(true);
    if (!atV1.ok || !atV2.ok) return;
    expect(atV2.value.records).toHaveLength(atV1.value.records.length);
    for (const [index, migrated] of atV2.value.records.entries()) {
      const base = atV1.value.records[index];
      expect(base).toBeDefined();
      if (base === undefined) continue;
      expect(migrated.storageVersion).toBe(TELEMETRY_STORAGE_NEXT_VERSION);
      expect(migrated.ticket).toBe(base.ticket);
      expect(migrated.repository).toBe(base.repository);
      expect(migrated.lane).toBe(base.lane);
      expect(migrated.agentRole).toBe(base.agentRole);
      expect(migrated.model).toBe(base.model);
      expect(migrated.tokens).toEqual(base.tokens);
      expect(migrated.calls).toBe(base.calls);
      expect(migrated.cost).toBe(base.cost);
      expect(migrated.startedAt).toBe(base.startedAt);
      expect(migrated.finishedAt).toBe(base.finishedAt);
      expect(migrated.warnings).toEqual(base.warnings);
    }
  });

  test("the declared version is the storage identity and nothing is stranded", () => {
    const { store } = seeded();
    const atV1 = readTelemetryStepsAtVersion(
      store,
      TELEMETRY_REF,
      TELEMETRY_STORAGE_SCHEMA_VERSION,
    );
    expect(atV1.ok).toBe(true);
    if (!atV1.ok) return;
    expect(atV1.value.records).toHaveLength(2);
    expect(atV1.value.records.every((record) => record.ticket === TELEMETRY_REF)).toBe(true);
    expect(atV1.value.records.map((record) => record.model)).toEqual([MODEL_A, MODEL_B]);
    expect(atV1.value.records.map((record) => record.lane)).toEqual([LANE, LANE]);
    expect(atV1.value.records.every((record) => record.agentRole === AGENT_ROLE)).toBe(true);
  });

  test("degradation warnings survive the re-read and the stored bytes are untouched", () => {
    const { identity, store } = seeded();
    const before = ledgerDigest(identity);
    const atV2 = readTelemetryStepsAtVersion(store, TELEMETRY_REF, TELEMETRY_STORAGE_NEXT_VERSION);
    expect(atV2.ok).toBe(true);
    if (!atV2.ok) return;
    expect(atV2.value.records[1]?.tokens.reasoning).toBeNull();
    expect(atV2.value.records[1]?.cost).toBeNull();
    expect(atV2.value.records[1]?.warnings).toHaveLength(2);
    // Re-reading is a derivation, never an in-place migration write.
    expect(ledgerDigest(identity)).toBe(before);
  });

  test("the seeded figures match the hand-written constants", () => {
    const { store } = seeded();
    const read = readTelemetrySteps(store, TELEMETRY_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records[0]?.cost).toBe(0.0125);
    expect(read.value.records[0]?.calls).toBe(2);
    expect(read.value.records[1]?.tokens.input).toBe(7);
    expect(read.value.records[0]?.finishedAt).toBe(T1);
  });
});
