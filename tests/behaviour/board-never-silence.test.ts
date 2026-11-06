/**
 * TC-SLA-015 — the never-silence matrix: every gate past a threshold is
 * escalated or default-applied on every evaluation, under every source
 * condition, and the matrix is completeness-checked.
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync } from "node:fs";
import { readOwnerGateSlaDecisions } from "../../packages/core/src/state/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  availableCollector,
  boardData,
  boardGates,
  createBoardHarness,
  createBoardState,
  failingCollector,
} from "../fixtures/board/harness";
import {
  BOARD_NOW_MS,
  DAY_MS,
  gateFact,
  HOUR_MS,
  ownerReviewGate,
  waiverGate,
} from "../fixtures/board/matrix";
import { ledgerPath } from "../fixtures/state/harness";

type Case = {
  readonly label: string;
  readonly gate: ReturnType<typeof ownerReviewGate>;
  readonly expected: "fresh" | "escalated" | "default-applied";
};

const CASES: readonly Case[] = [
  { label: "fresh-1h", gate: ownerReviewGate("GH-801", HOUR_MS), expected: "fresh" },
  {
    label: "fresh-2359",
    gate: ownerReviewGate("GH-802", 24 * HOUR_MS - 1),
    expected: "fresh",
  },
  { label: "escalation-24h", gate: ownerReviewGate("GH-803", 24 * HOUR_MS), expected: "escalated" },
  {
    label: "escalation-24h1ms",
    gate: ownerReviewGate("GH-804", 24 * HOUR_MS + 1),
    expected: "escalated",
  },
  { label: "mid-48h", gate: ownerReviewGate("GH-805", 48 * HOUR_MS), expected: "escalated" },
  { label: "mid-71h", gate: ownerReviewGate("GH-806", 71 * HOUR_MS), expected: "escalated" },
  { label: "expiry-72h", gate: waiverGate("GH-807", 72 * HOUR_MS), expected: "default-applied" },
  {
    label: "expiry-72h1ms",
    gate: waiverGate("GH-808", 72 * HOUR_MS + 1),
    expected: "default-applied",
  },
  { label: "long-7d", gate: ownerReviewGate("GH-809", 7 * DAY_MS), expected: "escalated" },
  { label: "long-30d", gate: waiverGate("GH-810", 30 * DAY_MS), expected: "default-applied" },
  { label: "long-365d", gate: ownerReviewGate("GH-811", 365 * DAY_MS), expected: "escalated" },
  {
    label: "unknown-absent",
    gate: gateFact({ id: "GH-812", absent: "missing" }),
    expected: "escalated",
  },
  {
    label: "unknown-unparseable",
    gate: gateFact({ id: "GH-813", activityAt: "not-a-date" }),
    expected: "escalated",
  },
  {
    label: "unknown-kind",
    gate: gateFact({ id: "GH-814", kind: "owner-review-v2", ageMs: 100 * HOUR_MS }),
    expected: "escalated",
  },
  {
    label: "recorded-waiver",
    gate: ownerReviewGate("GH-815", 100 * HOUR_MS, { waivedBy: "owner" }),
    expected: "escalated",
  },
];

const REQUIRED_CLASSES = [
  "fresh",
  "escalation",
  "mid",
  "expiry",
  "long",
  "unknown-age",
  "unknown-kind",
  "recorded-waiver",
] as const;

const classOf = (label: string): string => {
  if (label.startsWith("fresh")) return "fresh";
  if (label.startsWith("escalation")) return "escalation";
  if (label.startsWith("mid")) return "mid";
  if (label.startsWith("expiry")) return "expiry";
  if (label.startsWith("long")) return "long";
  if (
    label.startsWith("unknown-age") ||
    label.startsWith("unknown-absent") ||
    label.startsWith("unknown-unparseable")
  ) {
    return "unknown-age";
  }
  if (label.startsWith("unknown-kind")) return "unknown-kind";
  return "recorded-waiver";
};

describe("TC-SLA-015 never-silence matrix", () => {
  test("every matrix case renders the expected state through the board", async () => {
    for (const matrixCase of CASES) {
      const board = createBoardHarness({ gates: [matrixCase.gate] });
      try {
        const run = await board.run([], { json: true });
        expect(run.exitCode, matrixCase.label).toBe(0);
        expect(assertEnvelopeContract(run.envelope)).toEqual([]);
        const gates = boardGates(run);
        expect(gates, matrixCase.label).toHaveLength(1);
        expect(gates[0]?.slaState, matrixCase.label).toBe(matrixCase.expected);
      } finally {
        board.cleanup();
      }
    }
  });

  test("every defaultable gate at or past 72 h carries exactly one record", async () => {
    for (const label of ["expiry-72h", "expiry-72h1ms", "long-30d"]) {
      const matrixCase = CASES.find((candidate) => candidate.label === label);
      if (matrixCase === undefined) throw new Error(`missing case ${label}`);
      const board = createBoardHarness({ gates: [matrixCase.gate] });
      try {
        const first = await board.run([], { json: true });
        expect(boardGates(first)[0]?.slaState).toBe("default-applied");
        const second = await board.run([], { json: true });
        expect(boardGates(second)[0]?.slaState).toBe("default-applied");
        const read = readOwnerGateSlaDecisions(board.state.store);
        expect(read.ok).toBe(true);
        if (read.ok) expect(read.value.recordCount, label).toBe(1);
      } finally {
        board.cleanup();
      }
    }
  });

  test("non-defaultable and never-merge gates stay escalated with zero records", async () => {
    const board = createBoardHarness({
      gates: [
        ownerReviewGate("GH-820", 72 * HOUR_MS),
        ownerReviewGate("GH-821", 7 * DAY_MS),
        gateFact({ id: "GH-822", absent: "missing" }),
      ],
    });
    try {
      const run = await board.run([], { json: true });
      for (const gate of boardGates(run)) {
        expect(gate.slaState).toBe("escalated");
        expect(gate.default).toBeNull();
        expect(gate.default).not.toBe("owner-review-first");
      }
      const read = readOwnerGateSlaDecisions(board.state.store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.recordCount).toBe(0);
    } finally {
      board.cleanup();
    }
  });

  test("repeated evaluations with the same clock are identical; advancing is monotonic", async () => {
    const state = createBoardState("owner-gate-sla-never-silence");
    const gates = [waiverGate("GH-830", 23 * HOUR_MS)];
    try {
      const first = createBoardHarness({
        state,
        gates,
        nowMs: BOARD_NOW_MS,
      });
      const second = createBoardHarness({
        state,
        gates,
        nowMs: BOARD_NOW_MS,
      });
      const one = await first.run([], { json: true });
      const two = await second.run([], { json: true });
      expect(boardGates(one)).toEqual(boardGates(two));

      const later = createBoardHarness({
        state,
        gates,
        nowMs: BOARD_NOW_MS + 50 * HOUR_MS,
      });
      const progressed = await later.run([], { json: true });
      expect(boardGates(progressed)[0]?.slaState).toBe("default-applied");
    } finally {
      state.cleanup();
    }
  });

  test("rendered identities plus omitted count account for the population", async () => {
    const gates = Array.from({ length: 12 }, (_, index) =>
      ownerReviewGate(`GH-84${index.toString().padStart(2, "0")}`, (index + 1) * HOUR_MS),
    );
    const board = createBoardHarness({ gates });
    try {
      const run = await board.run([], { json: true });
      const data = boardData(run);
      expect(boardGates(run)).toHaveLength(8);
      expect(data?.omitted).toBe(4);
      expect(data?.truncated).toBe(true);
    } finally {
      board.cleanup();
    }
  });

  test("every failure source is declared, exits 2, and never renders zero gates", async () => {
    const sources = [
      [failingCollector("tracker")],
      [
        availableCollector("tracker", [ownerReviewGate("GH-850", 26 * HOUR_MS)]),
        failingCollector("coordination"),
      ],
      [failingCollector("tracker"), failingCollector("coordination")],
    ];
    for (const collectors of sources) {
      const board = createBoardHarness({ collectors });
      try {
        const run = await board.run([], { json: true });
        expect(run.exitCode).toBe(2);
        expect(run.envelope).not.toHaveProperty("data");
        expect(boardGates(run)).toEqual([]);
      } finally {
        board.cleanup();
      }
    }
  });

  test("a torn decision store is declared and renders no gates", async () => {
    const state = createBoardState("owner-gate-sla-never-silence-torn");
    const board = createBoardHarness({
      state,
      gates: [waiverGate("GH-860", 73 * HOUR_MS)],
    });
    try {
      const first = await board.run([], { json: true });
      expect(first.exitCode).toBe(0);
      appendFileSync(ledgerPath(state.identity), "{not-json}\n");
      const torn = await board.run([], { json: true });
      expect(torn.exitCode).toBe(2);
      expect(torn.envelope).not.toHaveProperty("data");
      expect(boardGates(torn)).toEqual([]);
    } finally {
      state.cleanup();
    }
  });

  test("the matrix covers every named class (completeness meta-check)", () => {
    const present = new Set(CASES.map((matrixCase) => classOf(matrixCase.label)));
    for (const required of REQUIRED_CLASSES) {
      expect(present.has(required), required).toBe(true);
    }
    const withoutOne = CASES.filter((matrixCase) => matrixCase.label !== "unknown-kind");
    expect(
      new Set(withoutOne.map((matrixCase) => classOf(matrixCase.label))).has("unknown-kind"),
    ).toBe(false);
  });
});
