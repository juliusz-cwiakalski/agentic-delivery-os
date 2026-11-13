/**
 * TC-TELEMETRY-011 — the v2 stream-ingested records and the delivered
 * closeout-captured v1 records coexist in one store, the report names its
 * reading basis, and the delivered closeout capture path is untouched.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { TELEMETRY_READING_BASES } from "../../packages/core/src/contracts/index";
import {
  foldTelemetryStore,
  makeBaselineRecord,
  makeStepRecord,
  makeV1Record,
  removeRoot,
  SESSION_A,
  T1,
  TELEMETRY_REF,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const folded = (seed: Parameters<typeof foldTelemetryStore>[0], label: string) => {
  const seeded = foldTelemetryStore(seed, label);
  roots.push(seeded.root);
  if (seeded.fold === undefined || !seeded.fold.ok) throw new Error("fold failed");
  return seeded.fold;
};

describe("TC-TELEMETRY-011 coexistence and reading basis", () => {
  test("stream-ingested records alone name the stream-ingest basis", () => {
    const fold = folded(
      { steps: [makeStepRecord({ tokens: tokens({ input: 10 }) })] },
      "coexist-stream",
    );
    expect(fold.data.reconciliation.basis).toBe("stream-ingest");
    expect(fold.data.telemetryState).toBe("present");
    expect(TELEMETRY_READING_BASES).toContain(fold.data.reconciliation.basis);
  });

  test("closeout-captured v1 records alone name the closeout-capture basis", () => {
    const fold = folded(
      { v1: [makeV1Record({ tokens: tokens({ input: 10 }) })] },
      "coexist-closeout",
    );
    expect(fold.data.reconciliation.basis).toBe("closeout-capture");
    expect(fold.data.tokensByClass.input).toBe(10);
  });

  test("both planes present name the declared combination basis", () => {
    const fold = folded(
      {
        steps: [makeStepRecord({ sessionId: SESSION_A, tokens: tokens({ input: 10 }) })],
        v1: [makeV1Record({ sessionId: SESSION_A, tokens: tokens({ input: 10 }) })],
        baselines: [makeBaselineRecord({ sessionId: SESSION_A, tokens: tokens({ input: 10 }) })],
      },
      "coexist-both",
    );
    expect(fold.data.reconciliation.basis).toBe("combined");
    // The declared combination arithmetic keeps one session's figures once.
    expect(fold.data.tokensByClass.input).toBe(10);
    expect(fold.data.reconciliation.verdict).toBe("within");
  });

  test("the delivered closeout capture records stay readable unchanged", () => {
    const seeded = foldTelemetryStore(
      { v1: [makeV1Record({ tokens: tokens({ input: 5, output: 7 }), calls: 2 })] },
      "coexist-v1-readable",
    );
    roots.push(seeded.root);
    expect(seeded.read.ok).toBe(true);
    if (!seeded.read.ok) return;
    expect(seeded.read.value.records).toHaveLength(1);
    expect(seeded.read.value.records[0]?.tokens).toEqual(tokens({ input: 5, output: 7 }));
    expect(seeded.read.value.records[0]?.calls).toBe(2);
    expect(seeded.read.value.steps).toEqual([]);
  });

  test("the v1 session and capture families keep their ref scoping", () => {
    const seeded = foldTelemetryStore(
      {
        v1: [makeV1Record({ sessionId: "ses_a", tokens: tokens({ input: 1 }) })],
        steps: [makeStepRecord({ sessionId: "ses_b", tokens: tokens({ input: 2 }) })],
      },
      "coexist-scoping",
    );
    roots.push(seeded.root);
    if (!seeded.read.ok) return;
    expect(seeded.read.value.workItemRef).toBe(TELEMETRY_REF);
    expect(seeded.read.value.records).toHaveLength(1);
    expect(seeded.read.value.steps).toHaveLength(1);
    expect(seeded.read.value.transitionsPresent).toBe(false);
    expect(seeded.read.value.steps?.[0]?.finishedAt).toBe(T1);
  });
});
