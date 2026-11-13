/**
 * TC-TELEMETRY-013 — telemetry storage grows linearly with captured steps,
 * retention follows the delivered state-layer convention, and no unbounded
 * derived projection is materialized. Measured, never assumed.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { readTelemetrySteps } from "../../packages/core/src/state/index";
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";
import { makeStepRecord, SESSION_A, seedSteps, TELEMETRY_REF, tokens } from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const storeWith = (label: string, count: number) => {
  const root = makeTempRoot(`gh291-growth-${label}`);
  roots.push(root);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedSteps(
    store,
    Array.from({ length: count }, (_, index) =>
      makeStepRecord({
        sessionId: SESSION_A,
        tokens: tokens({ input: index + 1, output: 2 }),
        calls: 1,
        cost: 0.001,
        finishedAt: new Date(Date.UTC(2026, 10, 12, 8, 0, index % 60)).toISOString(),
      }),
    ),
  );
  return { root, identity, store };
};

const ledgerBytes = (identity: ReturnType<typeof makeIdentity>): number =>
  statSync(ledgerPath(identity)).size;

describe("TC-TELEMETRY-013 linear growth and no unbounded projections", () => {
  test("stored bytes grow linearly between the measured sizes", () => {
    const small = storeWith("small", 200);
    const large = storeWith("large", 500);
    const smallBytes = ledgerBytes(small.identity);
    const largeBytes = ledgerBytes(large.identity);
    expect(smallBytes).toBeGreaterThan(0);
    expect(largeBytes).toBeGreaterThan(smallBytes);
    const smallPerRecord = smallBytes / 200;
    const largePerRecord = largeBytes / 500;
    // Per-record bytes stay within a declared slack band: no superlinear growth.
    expect(largePerRecord).toBeLessThanOrEqual(smallPerRecord * 1.25);
    expect(largePerRecord).toBeGreaterThanOrEqual(smallPerRecord * 0.75);
  }, 30_000);

  test("no derived projection artifact is materialized beside the state files", () => {
    const { root } = storeWith("artifacts", 50);
    const names = readdirSync(root).sort();
    const unexpected = names.filter(
      (name) => !name.startsWith("ledger.") && !name.startsWith("header."),
    );
    expect(unexpected).toEqual([]);
  });

  test("retention follows the delivered convention: every captured step stays readable", () => {
    const { store } = storeWith("retention", 120);
    const read = readTelemetrySteps(store, TELEMETRY_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(120);
    expect(read.value.records.every((record) => record.workItemRef === TELEMETRY_REF)).toBe(true);
  });

  test("the under-size control is not truncated (non-vacuity)", () => {
    const { store } = storeWith("control", 1);
    const read = readTelemetrySteps(store, TELEMETRY_REF);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.records).toHaveLength(1);
    expect(read.value.records[0]?.tokens.input).toBe(1);
  });
});
