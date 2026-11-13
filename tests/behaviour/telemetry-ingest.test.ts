/**
 * TC-TELEMETRY-001..005 — per-step stream counting, omission and drift
 * degradation, ingest non-interference, and failure accounting.
 *
 * The counting oracle is hand-summed from the committed capture and the
 * scenario builders; no assertion calls the production fold to derive its
 * expectation. Ingest runs through the real adapter drain with the composed
 * sink, so the seam is exercised end to end and offline.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  completeTokenFrame,
  driftedExtraFieldFrame,
  driftedRenamedClassFrame,
  driftedUnknownTypeFrame,
  HAPPY_PATH_LINES,
  omittedCallsFrame,
  omittedClassFrame,
  omittedCostFrame,
  STREAM_ERROR_LINES,
  TOKEN_BEARING_LINES,
  TOKEN_SESSION_ID,
  TOOL_ERROR_LINES,
} from "../fixtures/harness/scenarios/stream";
import {
  makeTelemetryStore,
  reasonCount,
  removeRoot,
  runIngest,
  TELEMETRY_REF,
  type TelemetryStoreFixture,
  tallyLines,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

const store = (label: string): TelemetryStoreFixture => {
  const fixture = makeTelemetryStore(`ingest-${label}`);
  roots.push(fixture.root);
  return fixture;
};

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const scripted = (lines: readonly string[]) => ({
  lines: [...lines],
  autoEnd: true,
  result: { status: 0, timedOut: false },
});

describe("TC-TELEMETRY-001 per-step counting happy path", () => {
  test("the committed token-bearing capture stores one record per step with hand-summed figures", async () => {
    const fixture = store("tokens");
    const run = await runIngest(scripted(TOKEN_BEARING_LINES), fixture.store);
    const stepRecords = run.records;
    expect(stepRecords).toHaveLength(2);
    // Hand sums from the committed capture: (120,45,0,310,25) and (80,60,12,190,0).
    expect(stepRecords[0]?.tokens).toEqual({
      input: 120,
      output: 45,
      reasoning: 0,
      cacheRead: 310,
      cacheWrite: 25,
    });
    expect(stepRecords[1]?.tokens).toEqual({
      input: 80,
      output: 60,
      reasoning: 12,
      cacheRead: 190,
      cacheWrite: 0,
    });
    expect(stepRecords.map((record) => record.cost)).toEqual([0.0031, 0.0024]);
    // The capture carries no explicit calls field: calls stay absent, never 1.
    expect(stepRecords.map((record) => record.calls)).toEqual([null, null]);
    expect(stepRecords.every((record) => record.sessionId === TOKEN_SESSION_ID)).toBe(true);
    expect(run.evidence).toEqual({ completionMarker: true, exitStatus: 0 });
  });

  test("the complete control frame counts all five classes, cost, and calls without warnings", async () => {
    const fixture = store("complete");
    const run = await runIngest(scripted([completeTokenFrame("ses_complete")]), fixture.store);
    expect(run.records).toHaveLength(1);
    const record = run.records[0];
    expect(record?.tokens).toEqual({
      input: 10,
      output: 20,
      reasoning: 3,
      cacheRead: 40,
      cacheWrite: 5,
    });
    expect(record?.calls).toBe(1);
    expect(record?.cost).toBe(0.0125);
    expect(record?.warnings).toEqual([]);
  });

  test("per-model cost is carried in harness-reported units, never converted", async () => {
    const fixture = store("cost-units");
    const run = await runIngest(scripted([completeTokenFrame("ses_units")]), fixture.store);
    expect(run.records[0]?.cost).toBe(0.0125);
    expect(run.records[0]?.model).toBe("model-alpha");
  });
});

describe("TC-TELEMETRY-002 omitted class or field degrades, excluded, never zero", () => {
  test("an omitted class is null with a closed-vocabulary warning and stays out of the sums", async () => {
    const fixture = store("omitted-class");
    const run = await runIngest(scripted([omittedClassFrame("ses_omit_class")]), fixture.store);
    const record = run.records[0];
    expect(record).toBeDefined();
    if (record === undefined) return;
    // reasoning is the omitted class: absent, never 0.
    expect(record.tokens.reasoning).toBeNull();
    expect(record.tokens.input).toBe(10);
    expect(record.warnings.some((warning) => warning.reason === "optional-field-absent")).toBe(
      true,
    );
    expect(record.warnings.some((warning) => warning.field === "tokens.reasoning")).toBe(true);
    const presentSum =
      (record.tokens.input ?? 0) +
      (record.tokens.output ?? 0) +
      (record.tokens.cacheRead ?? 0) +
      (record.tokens.cacheWrite ?? 0);
    expect(presentSum).toBe(75);
  });

  test("an omitted cost is null with cost-missing and token sums stay intact", async () => {
    const fixture = store("omitted-cost");
    const run = await runIngest(scripted([omittedCostFrame("ses_omit_cost")]), fixture.store);
    const record = run.records[0];
    expect(record?.cost).toBeNull();
    expect(record?.warnings.some((warning) => warning.reason === "cost-missing")).toBe(true);
    expect(record?.tokens.input).toBe(10);
    expect(record?.tokens.cacheWrite).toBe(5);
  });

  test("omitted calls stay absent, never defaulted to 1 or 0", async () => {
    const fixture = store("omitted-calls");
    const run = await runIngest(scripted([omittedCallsFrame("ses_omit_calls")]), fixture.store);
    expect(run.records[0]?.calls).toBeNull();
    expect(
      run.records[0]?.warnings.some(
        (warning) => warning.reason === "optional-field-absent" && warning.field === "calls",
      ),
    ).toBe(true);
  });

  test("the tally discloses per-reason degradation counts, and zero stays distinguishable from absent", () => {
    const tally = tallyLines([completeTokenFrame("ses_tally"), omittedClassFrame("ses_tally")]);
    expect(tally.counts.captured).toBe(2);
    expect(tally.counts.degraded).toBe(1);
    expect(reasonCount(tally, "optional-field-absent")).toBeGreaterThanOrEqual(1);
    // A reported zero (the complete control) is a value, not a degradation.
    const complete = tallyLines([completeTokenFrame("ses_zero")]);
    expect(complete.counts.degraded).toBe(0);
  });
});

describe("TC-TELEMETRY-003 frame drift degrades with a warning and never aborts", () => {
  test("an unknown frame type is disclosed as drift and not stored", async () => {
    const fixture = store("drift-type");
    const run = await runIngest(
      scripted([driftedUnknownTypeFrame("ses_drift"), completeTokenFrame("ses_drift")]),
      fixture.store,
    );
    expect(run.records).toHaveLength(1);
    const tally = tallyLines([
      driftedUnknownTypeFrame("ses_drift"),
      completeTokenFrame("ses_drift"),
    ]);
    expect(reasonCount(tally, "version-drift")).toBe(1);
    expect(tally.counts.captured).toBe(1);
    expect(tally.counts.degraded).toBe(1);
  });

  test("extra part fields are disclosed as drift while known fields still count", async () => {
    const fixture = store("drift-extra");
    const run = await runIngest(
      scripted([driftedExtraFieldFrame("ses_drift_extra")]),
      fixture.store,
    );
    const record = run.records[0];
    expect(record?.tokens.input).toBe(10);
    expect(record?.tokens.cacheRead).toBe(40);
    expect(
      record?.warnings.some(
        (warning) => warning.reason === "version-drift" && warning.field === "part.providerTokens",
      ),
    ).toBe(true);
  });

  test("a renamed token class excludes that class and discloses the drift", async () => {
    const fixture = store("drift-renamed");
    const run = await runIngest(
      scripted([driftedRenamedClassFrame("ses_drift_renamed")]),
      fixture.store,
    );
    const record = run.records[0];
    expect(record?.tokens.cacheRead).toBeNull();
    expect(record?.tokens.input).toBe(10);
    expect(
      record?.warnings.some(
        (warning) => warning.reason === "version-drift" && warning.field === "tokens.cache_read",
      ),
    ).toBe(true);
  });

  test("ingest continues over remaining frames and the stream keeps its completion evidence", async () => {
    const fixture = store("drift-continue");
    const run = await runIngest(
      scripted([
        driftedUnknownTypeFrame("ses_continue"),
        completeTokenFrame("ses_continue"),
        completeTokenFrame("ses_continue"),
      ]),
      fixture.store,
    );
    expect(run.records).toHaveLength(2);
    expect(run.evidence.completionMarker).toBe(true);
  });
});

describe("TC-TELEMETRY-004 ingest non-interference with the delivered seam", () => {
  test("all three committed captures keep handle acquisition and completion evidence", async () => {
    for (const [label, lines, expected] of [
      ["happy", HAPPY_PATH_LINES, { completionMarker: true, exitStatus: 0 }],
      ["tool-error", TOOL_ERROR_LINES, { completionMarker: true, exitStatus: 0 }],
      ["stream-error", STREAM_ERROR_LINES, { completionMarker: false, exitStatus: 0 }],
    ] as const) {
      const fixture = store(`non-interference-${label}`);
      const run = await runIngest(scripted(lines), fixture.store);
      expect(run.evidence).toEqual(expected);
    }
  });

  test("a long frame stream stores one record per step with no accumulation", async () => {
    const fixture = store("long-stream");
    const lines = Array.from({ length: 400 }, () => completeTokenFrame("ses_long"));
    const run = await runIngest(scripted(lines), fixture.store);
    expect(run.records).toHaveLength(400);
    // Constant-memory shape: each stored record holds only its own figures.
    const last = run.records.at(-1);
    expect(last?.tokens.input).toBe(10);
  }, 30_000);
});

describe("TC-TELEMETRY-005 ingest failure accounting never changes the delivery outcome", () => {
  test("an undecodable frame is a counted failure with no record and no fabricated value", async () => {
    const fixture = store("failure");
    const run = await runIngest(
      scripted(["123", completeTokenFrame("ses_failure")]),
      fixture.store,
    );
    expect(run.records).toHaveLength(1);
    const tally = tallyLines(["123", completeTokenFrame("ses_failure")]);
    expect(tally.counts.failed).toBe(1);
    expect(tally.counts.captured).toBe(1);
    // The delivery's completion evidence is identical to the all-decodable control.
    const control = store("failure-control");
    const controlRun = await runIngest(
      scripted([completeTokenFrame("ses_failure")]),
      control.store,
    );
    expect(run.evidence).toEqual(controlRun.evidence);
  });

  test("the disclosed counts equal the hand counts on a mixed stream", async () => {
    const tally = tallyLines([
      completeTokenFrame("ses_mixed"),
      omittedCostFrame("ses_mixed"),
      driftedUnknownTypeFrame("ses_mixed"),
      "123",
    ]);
    expect(tally.counts).toEqual({ captured: 2, degraded: 2, failed: 1 });
    expect(tally.byReason["cost-missing"]).toBe(1);
    expect(tally.byReason["version-drift"]).toBe(1);
  });

  test("ingest writes nothing under another ref and leaves the selection isolated", async () => {
    const fixture = store("isolation");
    const run = await runIngest(scripted([completeTokenFrame("ses_isolation")]), fixture.store, {
      workItemRef: TELEMETRY_REF,
    });
    expect(run.records.every((record) => record.workItemRef === TELEMETRY_REF)).toBe(true);
    expect(run.records[0]?.tokens).toEqual(
      tokens({ input: 10, output: 20, reasoning: 3, cacheRead: 40, cacheWrite: 5 }),
    );
  });
});
