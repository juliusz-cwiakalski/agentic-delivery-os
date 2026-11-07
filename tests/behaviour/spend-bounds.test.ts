/**
 * TC-SPEND-021 — bounded output with declared deterministic truncation: the
 * machine payload drops trailing roll-up entries first, the human digest drops
 * trailing lines, both record the marker, and no total is ever truncated.
 */
import { describe, expect, test } from "bun:test";
import {
  type HarnessTelemetryRecord,
  SPEND_MAX_HUMAN_BYTES,
  SPEND_MAX_HUMAN_LINES,
  SPEND_MAX_MACHINE_BYTES,
  type SpendLedgerRead,
} from "../../packages/core/src/contracts/index";
import { computeSpendReport, renderSpendHuman } from "../../packages/core/src/domain/index";
import { makeSessionRecord, SYNTHETIC_BRAND, tokens } from "../fixtures/spend/harness";

const utf8 = (text: string): number => Buffer.byteLength(text, "utf8");

const readWith = (records: readonly HarnessTelemetryRecord[]): SpendLedgerRead => ({
  workItemRef: "GH-236",
  records,
  outcomes: [],
  transitions: [],
  transitionsPresent: false,
  verifiedEmpty: false,
  evidence: { storePath: "fixture://ledger", recordCount: records.length },
});

const manyAgents = (count: number): readonly HarnessTelemetryRecord[] =>
  Array.from({ length: count }, (_, index) =>
    makeSessionRecord({
      runId: "run-single",
      sessionId: `ses-${String(index)}`,
      agent: `agent-${"a".repeat(40)}-${String(index).padStart(5, "0")}`,
      model: `model-${"m".repeat(30)}`,
      tokens: tokens({ input: 10 }),
      calls: 1,
      capturedAt: "2026-11-01T10:00:00.000Z",
    }),
  );

const manyRuns = (count: number): readonly HarnessTelemetryRecord[] =>
  Array.from({ length: count }, (_, index) =>
    makeSessionRecord({
      runId: `run-${String(index).padStart(4, "0")}`,
      sessionId: `ses-run-${String(index)}`,
      agent: "planner",
      model: "sonnet",
      tokens: tokens({ input: 10 }),
      calls: 1,
      capturedAt: `2026-11-01T10:${String(index % 60).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
    }),
  );

describe("TC-SPEND-021 bounded output and declared truncation", () => {
  test("an under-cap report is untruncated and inside both bounds", () => {
    const fold = computeSpendReport(readWith(manyAgents(5)));
    if (!fold.ok) throw new Error("fold failed");
    const machine = JSON.stringify(fold.data);
    expect(machine.length).toBeGreaterThan(0);
    expect(utf8(machine)).toBeLessThanOrEqual(SPEND_MAX_MACHINE_BYTES);
    expect(fold.warnings).toEqual([]);
    const human = renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true });
    expect(human.length).toBeGreaterThan(0);
    expect(human.split("\n").filter((line) => line !== "").length).toBeLessThanOrEqual(
      SPEND_MAX_HUMAN_LINES,
    );
    expect(utf8(human)).toBeLessThanOrEqual(SPEND_MAX_HUMAN_BYTES);
    expect(human).not.toContain("truncated");
    // Every agent line survives under the cap.
    expect(human.split("- agent-").length - 1).toBe(5);
  });

  test("an over-cap report stays bounded, declares the drop and keeps the totals", () => {
    const records = manyAgents(600);
    const fold = computeSpendReport(readWith(records));
    if (!fold.ok) throw new Error("fold failed");
    const machine = JSON.stringify(fold.data);
    expect(utf8(machine)).toBeLessThanOrEqual(SPEND_MAX_MACHINE_BYTES);
    expect(fold.warnings).toHaveLength(1);
    expect(fold.warnings[0]).toContain("truncated");
    expect(fold.data.perAgent.length).toBeLessThan(records.length);
    expect(fold.data.tokensByClass.input).toBe(6000);
    expect(fold.data.restarts).toBe(0);
    expect(fold.data.amplification.ratio).toBe(1);
  });

  test("the retained agent prefix equals the untruncated head (tail-only drop)", () => {
    const records = manyAgents(600);
    const complete = computeSpendReport(readWith(records));
    const bounded = computeSpendReport(readWith(records));
    if (!complete.ok || !bounded.ok) throw new Error("fold failed");
    expect(complete.data.perAgent.length).toBe(bounded.data.perAgent.length);
    // A smaller untruncated population is a strict prefix of the larger order.
    const small = computeSpendReport(readWith(records.slice(0, 10)));
    if (!small.ok) throw new Error("small fold failed");
    for (const [index, entry] of small.data.perAgent.entries()) {
      expect(bounded.data.perAgent[index]).toEqual(entry);
    }
    expect(JSON.stringify(computeSpendReport(readWith(records)))).toBe(
      JSON.stringify(computeSpendReport(readWith(records))),
    );
  });

  test("an event-heavy loop stays bounded and declares the event tail drop", () => {
    const records = manyRuns(600);
    const fold = computeSpendReport(readWith(records));
    if (!fold.ok) throw new Error("fold failed");
    expect(utf8(JSON.stringify(fold.data))).toBeLessThanOrEqual(SPEND_MAX_MACHINE_BYTES);
    expect(fold.warnings).toHaveLength(1);
    expect(fold.warnings[0]).toContain("events");
    expect(fold.data.tokensByClass.input).toBe(6000);
    expect(fold.data.restarts).toBe(599);
    expect(fold.data.amplification.ratio).toBe(600);
    expect(fold.data.amplification.events.length).toBeLessThan(599);
  });

  test("an over-long single agent name cannot exceed the machine bound", () => {
    const long = makeSessionRecord({
      runId: "run-long",
      agent: `agent-${"x".repeat(70_000)}`,
      model: "sonnet",
      tokens: tokens({ input: 7 }),
    });
    const fold = computeSpendReport(readWith([long]));
    if (!fold.ok) throw new Error("fold failed");
    expect(utf8(JSON.stringify(fold.data))).toBeLessThanOrEqual(SPEND_MAX_MACHINE_BYTES);
    expect(fold.data.perAgent).toEqual([]);
    expect(fold.data.tokensByClass.input).toBe(7);
  });

  test("the human digest stays inside its bounds and declares the tail drop", () => {
    const records = manyAgents(600);
    const fold = computeSpendReport(readWith(records));
    if (!fold.ok) throw new Error("fold failed");
    const human = renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true });
    expect(utf8(human)).toBeLessThanOrEqual(SPEND_MAX_HUMAN_BYTES);
    expect(human.split("\n").filter((line) => line !== "").length).toBeLessThanOrEqual(
      SPEND_MAX_HUMAN_LINES,
    );
    expect(human).toContain("truncated");
    expect(human).toContain("tokens     input 6000");
    // The digest is deterministic across renders.
    expect(renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true })).toBe(
      human,
    );
  });

  test("a bounded machine report still round-trips through the human renderer", () => {
    const fold = computeSpendReport(readWith(manyAgents(600)));
    if (!fold.ok) throw new Error("fold failed");
    const human = renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: false });
    expect(human).toContain("degradation 0 record(s) with warnings");
  });
});
