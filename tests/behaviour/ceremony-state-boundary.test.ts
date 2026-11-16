/**
 * TC-CEREMONY-040 (record durability, folds, complete measurement) and the
 * state half of TC-CEREMONY-022 (torn records and nonconforming writes are
 * classified, never repaired) — the ceremony boundary over the production state
 * port, plus the `ceremony-artifact` file family.
 */
import { describe, expect, test } from "bun:test";
import { chmodSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createCeremonyArtifactStore } from "../../packages/adapters/src/file/index";
import {
  CEREMONY_RUN_RECORD_KEY_PREFIX,
  CEREMONY_RUN_RECORD_KIND,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  appendCeremonyRun,
  ceremonyRunDurationMs,
  ceremonyRunRecordKey,
  ceremonyStepRecordKey,
  foldCeremonyPhaseDurations,
  foldCeremonyRunVerdict,
  readCeremonyRuns,
  readCeremonySteps,
} from "../../packages/core/src/state/index";
import {
  makeCeremonyState,
  NOW_MS,
  runRecord,
  seedRun,
  stepRecord,
} from "../fixtures/ceremony/state";
import { withinFence } from "../fixtures/state/harness";

describe("TC-CEREMONY-040 durable run and step records with folds", () => {
  test("records land through the production append path with exactly-one re-read", () => {
    const fixture = makeCeremonyState("durable");
    try {
      seedRun(fixture, [
        stepRecord({ index: 1, phaseIndex: 0, endedAtMs: NOW_MS + 20, durationMs: 20 }),
        stepRecord({
          index: 2,
          phaseIndex: 0,
          kind: "render",
          startedAtMs: NOW_MS + 20,
          endedAtMs: NOW_MS + 55,
          durationMs: 35,
        }),
        stepRecord({
          index: 3,
          phaseIndex: 1,
          kind: "record",
          outcome: "dry-run",
          startedAtMs: NOW_MS + 55,
          endedAtMs: NOW_MS + 70,
          durationMs: 15,
        }),
      ]);
      const runs = readCeremonyRuns(fixture.store);
      expect(runs.ok).toBe(true);
      if (!runs.ok) return;
      expect(runs.value.verdict).toBe("valid");
      expect(runs.value.records).toHaveLength(1);
      const steps = readCeremonySteps(fixture.store, "run-fixture-0001");
      expect(steps.ok).toBe(true);
      if (!steps.ok) return;
      expect(steps.value.records.map((step) => step.index)).toEqual([1, 2, 3]);
      expect(foldCeremonyRunVerdict(steps.value.records)).toBe("dry-run");
      expect(ceremonyRunDurationMs(steps.value.records)).toBe(70);
      expect(foldCeremonyPhaseDurations(steps.value.records)).toEqual([
        { phaseIndex: 0, durationMs: 55 },
        { phaseIndex: 1, durationMs: 15 },
      ]);
    } finally {
      fixture.dispose();
    }
  });

  test("every executed step carries a duration and a verification verdict", () => {
    const fixture = makeCeremonyState("measurement");
    try {
      seedRun(fixture, [
        stepRecord({ index: 1, durationMs: 1 }),
        stepRecord({ index: 2, durationMs: 2 }),
      ]);
      const steps = readCeremonySteps(fixture.store, "run-fixture-0001");
      expect(steps.ok).toBe(true);
      if (!steps.ok) return;
      for (const step of steps.value.records) {
        expect(step.durationMs).toBeGreaterThanOrEqual(0);
        expect(["verified", "unverified"]).toContain(step.verification);
      }
      expect(ceremonyRunDurationMs(steps.value.records)).not.toBeNull();
    } finally {
      fixture.dispose();
    }
  });

  test("there is no derived run document to disagree with the ledger", () => {
    const fixture = makeCeremonyState("no-document");
    try {
      seedRun(fixture, [stepRecord()]);
      const documents = join(fixture.root, "documents.workspace-a");
      const files = (() => {
        try {
          return readdirSync(documents);
        } catch {
          return [];
        }
      })();
      expect(files.filter((name) => name.startsWith("ceremony"))).toEqual([]);
    } finally {
      fixture.dispose();
    }
  });

  test("the record keys are the declared ceremony prefixes", () => {
    expect(ceremonyRunRecordKey("run-x")).toBe(`${CEREMONY_RUN_RECORD_KEY_PREFIX}run-x`);
    expect(ceremonyStepRecordKey("run-x", 3)).toBe("ceremony.steps:run-x:3");
  });
});

describe("TC-CEREMONY-022 a nonconforming write is classified and nothing defaults", () => {
  test("a wrong payload schema is state.store.unknown with no record appended", () => {
    const fixture = makeCeremonyState("nonconforming");
    try {
      const before = fixture.store.readRecords();
      expect(before.ok).toBe(true);
      withinFence(fixture.store, "ceremony-write", (handle) => {
        const appended = appendCeremonyRun(
          fixture.store,
          handle,
          {
            ...runRecord(),
            schemaId: "delivery.ceremony.run.v0" as never,
          },
          1,
        );
        expect(appended.ok).toBe(false);
        if (!appended.ok) {
          expect(appended.error.code).toBe("state.store.unknown");
          expect(appended.error.consequence).toBe("not_landed");
        }
      });
      const after = fixture.store.readRecords();
      expect(after.ok).toBe(true);
      if (before.ok && after.ok) {
        expect(after.value.records.length).toBe(before.value.records.length);
      }
    } finally {
      fixture.dispose();
    }
  });

  test("a malformed entry is classified torn in band with its position named", () => {
    const fixture = makeCeremonyState("torn");
    try {
      withinFence(fixture.store, "ceremony-torn", (handle) => {
        fixture.store.append(handle, {
          kind: CEREMONY_RUN_RECORD_KIND,
          recordKey: ceremonyRunRecordKey("run-torn"),
          payload: { schemaId: "delivery.ceremony.run.v1", runId: "run-torn" },
        });
      });
      const read = readCeremonyRuns(fixture.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.verdict).toBe("torn");
      expect(read.value.records).toEqual([]);
      expect(read.value.malformed).toHaveLength(1);
    } finally {
      fixture.dispose();
    }
  });

  test("an unreadable store yields the unknown read verdict, never a clean empty", () => {
    const failing = {
      readRecords: () => ({
        ok: false as const,
        error: {
          kind: "state" as const,
          code: "state.store.unknown" as const,
          consequence: "not_landed" as const,
          location: { path: "unknown" },
        },
      }),
    } as unknown as StateStorePort;
    const read = readCeremonyRuns(failing);
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.value.verdict).toBe("unknown");
      expect(read.value.records).toEqual([]);
    }
  });

  test("an empty store is verified-empty, not a silent zero", () => {
    const fixture = makeCeremonyState("empty");
    try {
      const read = readCeremonyRuns(fixture.store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.verdict).toBe("verified-empty");
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-CEREMONY-040 the ceremony-artifact family is byte-level and 0600", () => {
  test("write/read round-trips bytes and the mode is 0600", () => {
    const fixture = makeCeremonyState("artifacts");
    try {
      const artifacts = createCeremonyArtifactStore({
        stateDirectory: fixture.root,
        workspaceId: "workspace-a",
      });
      const written = artifacts.write({
        runId: "run-fixture-0001",
        slot: "ceremony-artifact",
        schema: "delivery.ceremony.report.v1",
        content: '{"schemaId":"delivery.ceremony.report.v1"}',
        stepIndex: 1,
      });
      expect(written.ok).toBe(true);
      if (!written.ok) return;
      const read = artifacts.read({
        runId: "run-fixture-0001",
        slot: "ceremony-artifact",
        ref: written.ref,
      });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.content).toBe('{"schemaId":"delivery.ceremony.report.v1"}');
      const directory = join(fixture.root, "ceremony-artifacts.workspace-a");
      expect(readdirSync(directory)).toEqual(["run-fixture-0001.s1.json"]);
      const stat = statSync(join(directory, "run-fixture-0001.s1.json"));
      expect(stat.mode & 0o777).toBe(0o600);
    } finally {
      fixture.dispose();
    }
  });

  test("an absent artifact and a permission mismatch both fail the read-back", () => {
    const fixture = makeCeremonyState("artifact-failures");
    try {
      const artifacts = createCeremonyArtifactStore({
        stateDirectory: fixture.root,
        workspaceId: "workspace-a",
      });
      const absent = artifacts.read({
        runId: "run-missing",
        slot: "ceremony-artifact",
        ref: "ceremony-artifact:run-missing.json",
      });
      expect(absent.ok).toBe(false);
      const written = artifacts.write({
        runId: "run-fixture-0002",
        slot: "ceremony-artifact",
        schema: "delivery.ceremony.report.v1",
        content: "{}",
        stepIndex: 1,
      });
      expect(written.ok).toBe(true);
      if (!written.ok) return;
      chmodSync(
        join(fixture.root, "ceremony-artifacts.workspace-a", "run-fixture-0002.s1.json"),
        0o644,
      );
      const mismatched = artifacts.read({
        runId: "run-fixture-0002",
        slot: "ceremony-artifact",
        ref: written.ref,
      });
      expect(mismatched.ok).toBe(false);
    } finally {
      fixture.dispose();
    }
  });

  test("per-step artifacts never overwrite: same-step rewrites replace, other steps add files", () => {
    const fixture = makeCeremonyState("artifact-one");
    try {
      const artifacts = createCeremonyArtifactStore({
        stateDirectory: fixture.root,
        workspaceId: "workspace-a",
      });
      const first = artifacts.write({
        runId: "run-one",
        slot: "ceremony-artifact",
        schema: "delivery.ceremony.report.v1",
        content: "first",
        stepIndex: 1,
      });
      const reattempt = artifacts.write({
        runId: "run-one",
        slot: "ceremony-artifact",
        schema: "delivery.ceremony.report.v1",
        content: "re-attempt",
        stepIndex: 1,
      });
      const secondStep = artifacts.write({
        runId: "run-one",
        slot: "ceremony-artifact",
        schema: "delivery.ceremony.report.v1",
        content: "second step",
        stepIndex: 2,
      });
      expect(first.ok && reattempt.ok && secondStep.ok).toBe(true);
      if (!first.ok || !reattempt.ok || !secondStep.ok) return;
      // A re-attempt of the same step replaces that step's artifact.
      expect(first.ref).toBe(reattempt.ref);
      // A different step addresses its own file, never its neighbour's.
      expect(secondStep.ref).not.toBe(first.ref);
      expect(readdirSync(join(fixture.root, "ceremony-artifacts.workspace-a")).sort()).toEqual([
        "run-one.s1.json",
        "run-one.s2.json",
      ]);
    } finally {
      fixture.dispose();
    }
  });

  test("a state-record slot keeps its own artifact and a stable reference", () => {
    const fixture = makeCeremonyState("artifact-slots");
    try {
      const artifacts = createCeremonyArtifactStore({
        stateDirectory: fixture.root,
        workspaceId: "workspace-a",
      });
      const written = artifacts.write({
        runId: "run-slot",
        slot: "state-record",
        schema: "delivery.ceremony.record.v1",
        content: '{"n":1}',
      });
      expect(written.ok).toBe(true);
      if (!written.ok) return;
      expect(written.ref.startsWith("state-record:run-slot.")).toBe(true);
      const read = artifacts.read({ runId: "run-slot", slot: "state-record", ref: written.ref });
      expect(read.ok).toBe(true);
    } finally {
      fixture.dispose();
    }
  });
});
