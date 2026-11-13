/**
 * TC-TELEMETRY-012 — malformed, unknown-kind, and torn telemetry records
 * classify as the delivered `state.store.torn` identity naming the path and
 * position; a damaged record is never admitted into a sum and never skipped
 * into a partial read. A paired healthy store reads clean.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { classifyDomainKind } from "../../packages/cli/src/classify";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import {
  readTelemetryBaselines,
  readTelemetrySteps,
  telemetryBaselineKey,
  telemetryStepKey,
} from "../../packages/core/src/state/index";
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../fixtures/state/harness";
import { makeStepRecord, seedSteps, TELEMETRY_REF, tokens } from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const seeded = (label: string) => {
  const root = makeTempRoot(`gh291-damage-${label}`);
  roots.push(root);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedSteps(store, [makeStepRecord({ tokens: tokens({ input: 11 }), calls: 1 })]);
  return { root, identity, store };
};

const entryOf = (code: string): ErrorTableEntry =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find(
    (entry) => entry.code === code,
  ) as ErrorTableEntry;

const expectTorn = (read: ReturnType<typeof readTelemetrySteps>, path: string): void => {
  expect(read.ok).toBe(false);
  if (read.ok) return;
  expect(read.error.code).toBe("state.store.torn");
  expect(read.error.kind).toBe("state");
  expect(read.error.location.path).toBe(path);
  // The delivered identity keeps its delivered projection class.
  expect(entryOf("state.store.torn").projectionClass).toBe("platform-provider");
  expect(classifyDomainKind("state", "state.store.torn").projectionClass).toBe("platform-provider");
};

type RawRecord = { readonly kind: string; readonly payload: Record<string, unknown> };

const appendRaw = (store: ReturnType<typeof openStore>["store"], record: RawRecord): void => {
  withinFence(store, "damage-writer", (handle) => {
    const appended = store.append(handle, {
      kind: record.kind,
      recordKey: telemetryStepKey(TELEMETRY_REF),
      payload: record.payload,
    });
    expect(appended.ok).toBe(true);
  });
};

describe("TC-TELEMETRY-012 malformed and unknown records classify as state errors", () => {
  test("a malformed step payload is torn and never admitted", () => {
    const { store, identity } = seeded("malformed");
    appendRaw(store, {
      kind: "harness.telemetry.step",
      payload: {
        schemaId: "delivery.harness.telemetry.step.v1",
        storageVersion: "delivery.telemetry.storage.v1",
        workItemRef: TELEMETRY_REF,
        runId: "run-broken",
        sessionId: "ses_broken",
        harnessKind: "opencode",
        harnessVersion: null,
        treeRoot: null,
        model: null,
        ticket: null,
        repository: null,
        lane: null,
        agentRole: null,
        // A non-integer class value: the record is malformed, not degraded.
        tokens: { input: 1.5, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
        calls: 1,
        cost: null,
        startedAt: null,
        finishedAt: null,
        warnings: [],
        capturedAt: "2026-11-12T08:00:00.000Z",
      },
    });
    const read = readTelemetrySteps(store, TELEMETRY_REF);
    expectTorn(read, ledgerPath(identity));
  });

  test("an unknown record kind under the step key is torn, never silently skipped", () => {
    const { store, identity } = seeded("unknown-kind");
    appendRaw(store, {
      kind: "harness.telemetry.unknown",
      payload: { schemaId: "delivery.harness.telemetry.step.v1", marker: "canary" },
    });
    expectTorn(readTelemetrySteps(store, TELEMETRY_REF), ledgerPath(identity));
  });

  test("a torn framing byte sequence is the delivered torn identity", () => {
    const { identity } = seeded("torn");
    const path = ledgerPath(identity);
    const text = readFileSync(path, "utf8");
    writeFileSync(path, `{not-framed\n${text.split("\n").slice(1).join("\n")}`);
    const read = readTelemetrySteps(openStore(identity).store, TELEMETRY_REF);
    expectTorn(read, path);
  });

  test("a repaired store reads clean again (paired control)", () => {
    const { identity } = seeded("repaired");
    const path = ledgerPath(identity);
    const intake = readFileSync(path, "utf8");
    writeFileSync(path, "{not-framed\n");
    expect(readTelemetrySteps(openStore(identity).store, TELEMETRY_REF).ok).toBe(false);
    writeFileSync(path, intake);
    const repaired = readTelemetrySteps(openStore(identity).store, TELEMETRY_REF);
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) return;
    expect(repaired.value.records).toHaveLength(1);
    expect(repaired.value.records[0]?.tokens.input).toBe(11);
  });

  test("a baseline family with a wrong kind is torn under the baseline key", () => {
    const { store, identity } = seeded("baseline-kind");
    withinFence(store, "damage-baseline", (handle) => {
      const appended = store.append(handle, {
        kind: "harness.telemetry.step",
        recordKey: telemetryBaselineKey(TELEMETRY_REF),
        payload: { schemaId: "delivery.harness.telemetry.baseline.v1" },
      });
      expect(appended.ok).toBe(true);
    });
    const read = readTelemetryBaselines(store, TELEMETRY_REF);
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.error.code).toBe("state.store.torn");
    expect(read.error.location.path).toBe(ledgerPath(identity));
  });
});
