/**
 * TC-RETRO-007 (registry half) / TC-RETRO-055 / TC-RETRO-057 — the retro
 * registry boundary: three additive kinds, verdict matrix, classified write
 * refusal, and idempotent seeding.
 */
import { describe, expect, test } from "bun:test";
import {
  RETRO_LEVEL_RECORD_KEY_PREFIX,
  RETRO_LEVEL_RECORD_KIND,
  RETRO_MEMORY_AUDIT_TRIGGER_CADENCE,
  RETRO_MEMORY_AUDIT_TRIGGER_NAME,
  RETRO_RUN_RECORD_KIND,
  RETRO_TRIGGER_RECORD_KIND,
  type RetroRunRecord,
} from "../../packages/core/src/contracts/index";
import {
  appendRetroRegistryRecord,
  readRetroLevels,
  readRetroRegistry,
  readRetroRuns,
  readRetroTriggers,
  recordRetroRun,
  seedRetroRegistry,
} from "../../packages/core/src/state/index";
import { makeRetroDir } from "../fixtures/retro/harness";

const runRecord = (overrides: Partial<RetroRunRecord> = {}): RetroRunRecord => ({
  schemaId: "delivery.retro.run.v1",
  runId: "run-1",
  level: "change",
  mode: "collect",
  scope: "GH-232",
  counts: { collected: 3, malformed: 0, skippedSource: 0 },
  consumed: [
    { source: "audit-ledger", verified: true, records: 1, truncated: false },
  ],
  truth: { clean: true, blocking: null, checks: [] },
  ...overrides,
});

describe("TC-RETRO-007 level declaration registry", () => {
  test("an empty registry is verified-empty with no silent zeroes", () => {
    const fixture = makeRetroDir("registry-empty");
    const read = readRetroRegistry(fixture.store);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.verdict).toBe("verified-empty");
    expect(readRetroLevels(read.value)).toEqual([]);
    expect(readRetroTriggers(read.value)).toEqual([]);
  });

  test("seeding declares exactly six levels, one implemented, plus the memory-audit trigger", () => {
    const fixture = makeRetroDir("registry-seed");
    const first = seedRetroRegistry(fixture.store, "seed-1");
    expect(first.ok).toBe(true);
    const read = readRetroRegistry(fixture.store);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const levels = readRetroLevels(read.value);
    expect(levels).toHaveLength(6);
    expect(levels.map((level) => level.name)).toEqual([
      "change",
      "session",
      "incident",
      "window",
      "project",
      "fleet",
    ]);
    expect(levels.filter((level) => level.status === "implemented").map((level) => level.name)).toEqual(
      ["change"],
    );
    const triggers = readRetroTriggers(read.value);
    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      name: RETRO_MEMORY_AUDIT_TRIGGER_NAME,
      kind: "schedule",
      cadence: RETRO_MEMORY_AUDIT_TRIGGER_CADENCE,
    });
    const second = seedRetroRegistry(fixture.store, "seed-2");
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value).toEqual([]);
    const reread = readRetroRegistry(fixture.store);
    expect(reread.ok).toBe(true);
    if (reread.ok) expect(reread.value.artifacts).toHaveLength(7);
  });
});

describe("TC-RETRO-057 registry record shapes are validated and additive", () => {
  test("level, run, and trigger records interleave and validate at the boundary", () => {
    const fixture = makeRetroDir("registry-shapes");
    expect(seedRetroRegistry(fixture.store, "seed").ok).toBe(true);
    const run = runRecord();
    expect(recordRetroRun(fixture.store, run, "run-writer").ok).toBe(true);
    const read = readRetroRegistry(fixture.store);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.artifacts.map((artifact) => artifact.kind)).toEqual([
      ...Array.from({ length: 6 }, () => RETRO_LEVEL_RECORD_KIND),
      RETRO_TRIGGER_RECORD_KIND,
      RETRO_RUN_RECORD_KIND,
    ]);
    const runs = readRetroRuns(read.value);
    expect(runs).toEqual([run]);
    expect(read.value.verdict).toBe("valid");
  });
});

describe("TC-RETRO-055 classified write refusal and verdict matrix", () => {
  test("bad kind, schema, missing field, and closed-vocabulary writes are state.store.unknown with nothing appended", () => {
    const fixture = makeRetroDir("registry-refusal");
    const before = fixture.store.readRecords();
    expect(before.ok).toBe(true);
    const cases: Array<{ kind: string; payload: Record<string, unknown> }> = [
      {
        kind: "retro.unknown",
        payload: { schemaId: "delivery.retro.level.v1" },
      },
      {
        kind: RETRO_LEVEL_RECORD_KIND,
        payload: {
          schemaId: "delivery.retro.level.v0",
          name: "change",
          levelId: "R1",
          scopeKind: "change",
          trigger: { kind: "lifecycle" },
          status: "implemented",
        },
      },
      {
        kind: RETRO_LEVEL_RECORD_KIND,
        payload: {
          schemaId: "delivery.retro.level.v1",
          name: "change",
          levelId: "R1",
          scopeKind: "change",
          trigger: { kind: "lifecycle" },
        },
      },
      {
        kind: RETRO_LEVEL_RECORD_KIND,
        payload: {
          schemaId: "delivery.retro.level.v1",
          name: "quarter",
          levelId: "R9",
          scopeKind: "change",
          trigger: { kind: "lifecycle" },
          status: "implemented",
        },
      },
    ];
    for (const [index, candidate] of cases.entries()) {
      const result = appendRetroRegistryRecord(fixture.store, {
        kind: candidate.kind,
        recordKey: `${RETRO_LEVEL_RECORD_KEY_PREFIX}:refused-${String(index)}`,
        payload: candidate.payload,
        fenceToken: `refusal-${String(index)}`,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("state.store.unknown");
        expect(result.error.consequence).toBe("not_landed");
      }
    }
    const after = fixture.store.readRecords();
    expect(after.ok).toBe(true);
    if (before.ok && after.ok) {
      expect(after.value.records.length).toBe(before.value.records.length);
    }
  });
});
