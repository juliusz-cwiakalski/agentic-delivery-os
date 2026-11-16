/**
 * TC-STEER-030/031/032 — asks[] composes the delivered open-question view with
 * the PDR-0003 join, measured age, the delivered cap, and no ledger write.
 */
import { describe, expect, test } from "bun:test";
import { asksWith, cappedPopulation, joinMatrix, ownerAsk } from "../fixtures/steer/ask-matrix";
import { CREATED, makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const asksOf = (data: Record<string, unknown> | undefined): readonly Record<string, unknown>[] =>
  Array.isArray(data?.asks) ? (data.asks as readonly Record<string, unknown>[]) : [];

describe("TC-STEER-030 the delivered view and measured age appear in the read payload", () => {
  test("two owner asks keep their delivered fields, ages, and ranks beside the notes", async () => {
    const older = ownerAsk({
      id: "q-older",
      askedAt: "2026-11-16T06:00:00.000Z",
      age: 6 * 3_600_000,
      rank: 1,
    });
    const newer = ownerAsk({
      id: "q-newer",
      askedAt: "2026-11-16T09:00:00.000Z",
      age: 3 * 3_600_000,
      rank: 2,
    });
    const harness = createSteerHarness({
      phase: NO_PHASE_RECORD,
      asks: asksWith({ facts: [older, newer] }),
    });
    try {
      harness.seedMessage(makeMessage({ id: "msg-note", created: CREATED }));
      const run = await harness.run(["read"]);
      const asks = asksOf(run.data);
      expect(asks).toHaveLength(2);
      for (const [index, fact] of [older, newer].entries()) {
        const row = asks[index];
        expect(row?.id).toBe(fact.id);
        expect(row?.type).toBe(fact.type);
        expect(row?.lane).toBe(fact.lane);
        expect(row?.ref).toBe(fact.ref);
        expect(row?.question).toBe(fact.question);
        expect(row?.askedAt).toBe(fact.askedAt);
        expect(row?.age).toBe(fact.age);
        expect(row?.rank).toBe(fact.rank);
        expect(row).toHaveProperty("drawnDefault");
        expect(row).toHaveProperty("defaultState");
      }
      expect(asks[0]?.id).toBe("q-older");
      const notes = run.data?.notes;
      if (!Array.isArray(notes)) throw new Error("the read answer carries no notes");
      expect(notes).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-031 the join is declared for none, pending, and applied", () => {
  test("each join state resolves from the injected PDR-0003 facts, with a declared null", async () => {
    const matrix = joinMatrix();
    for (const [state, source, expected] of [
      ["pending", matrix.pending, { drawnDefault: "allow-after-window", defaultState: "pending" }],
      ["applied", matrix.applied, { drawnDefault: "allow-after-window", defaultState: "applied" }],
      ["none", matrix.none, { drawnDefault: null, defaultState: "none" }],
    ] as const) {
      const harness = createSteerHarness({ phase: NO_PHASE_RECORD, asks: source });
      try {
        const run = await harness.run(["read"]);
        const [ask] = asksOf(run.data);
        expect(ask, state).toMatchObject(expected);
        expect(ask).toHaveProperty("drawnDefault");
      } finally {
        harness.cleanup();
      }
    }
  });

  test("a ref-less question keeps the delivered bare null ref", async () => {
    const harness = createSteerHarness({
      phase: NO_PHASE_RECORD,
      asks: asksWith({ facts: [ownerAsk({ id: "q-ref-less", ref: null })] }),
    });
    try {
      const run = await harness.run(["read"]);
      const [ask] = asksOf(run.data);
      expect(ask?.ref).toBeNull();
      expect(ask?.drawnDefault).toBeNull();
      expect(ask?.defaultState).toBe("none");
      expect(Object.hasOwn(ask ?? {}, "refUnknownReason")).toBe(false);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-032 coordinator questions are excluded and the cap holds", () => {
  test("exactly eight owner asks survive, no coordinator row appears, and the overflow is counted", async () => {
    const harness = createSteerHarness({
      phase: NO_PHASE_RECORD,
      asks: cappedPopulation(),
    });
    try {
      harness.seedMessage(makeMessage({ id: "msg-note", created: CREATED }));
      const recordsBefore = harness.read().recordCount;
      const run = await harness.run(["read"]);
      const asks = asksOf(run.data);
      expect(asks).toHaveLength(8);
      expect(asks.some((ask) => String(ask.id).startsWith("q-coord-"))).toBe(false);
      expect(run.data?.omitted).toBe(4);
      expect(run.data?.truncated).toBe(true);
      expect(Object.keys(asks[0] ?? {}).sort()).toEqual([
        "age",
        "askedAt",
        "defaultState",
        "drawnDefault",
        "id",
        "lane",
        "question",
        "rank",
        "ref",
        "type",
      ]);
      // The read appends only its note outcome; the asks join writes nothing.
      expect(harness.read().outcomes).toHaveLength(1);
      expect(harness.read().messages).toHaveLength(1);
      expect(harness.read().recordCount).toBe(recordsBefore + 1);
    } finally {
      harness.cleanup();
    }
  });

  test("a coordinator-only population renders an empty asks array", async () => {
    const harness = createSteerHarness({
      phase: NO_PHASE_RECORD,
      asks: asksWith({
        facts: [ownerAsk({ id: "q-c", audience: "coordinator", rank: 1 })],
      }),
    });
    try {
      const run = await harness.run(["read"]);
      expect(asksOf(run.data)).toHaveLength(0);
      expect(run.data?.omitted).toBe(0);
    } finally {
      harness.cleanup();
    }
  });
});
