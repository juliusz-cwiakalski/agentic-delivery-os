/**
 * TC-SLA-013 and TC-SLA-014 — collector unavailability is a declared
 * per-collector family failure with zero fabricated gates and exit 2, never a
 * partial board and never a silent all-clear.
 */
import { describe, expect, test } from "bun:test";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  availableCollector,
  boardData,
  boardGates,
  createBoardHarness,
  failingCollector,
} from "../fixtures/board/harness";
import { HOUR_MS, ownerReviewGate, waiverGate } from "../fixtures/board/matrix";

const ALL_CLEAR_TOKENS = ["fresh", "0 gates", "no owner gates", "ok"];

const hasAllClearToken = (text: string): boolean =>
  ALL_CLEAR_TOKENS.some((token) => text.toLowerCase().includes(token.toLowerCase()));

const GATES = [
  ownerReviewGate("GH-701", 2 * HOUR_MS),
  ownerReviewGate("GH-702", 26 * HOUR_MS),
  waiverGate("GH-703", 73 * HOUR_MS),
];

describe("TC-SLA-013 unavailable collector is declared, never silent", () => {
  const failures = ["failed", "credential-unavailable", "not-configured"] as const;

  for (const reason of failures) {
    test(`${reason} declares status.collector.tracker.unavailable, exit 2, and zero gates`, async () => {
      let reads = 0;
      const collector = failingCollector("tracker", reason);
      const counted = {
        ...collector,
        read: async () => {
          reads += 1;
          return collector.read();
        },
      };
      const board = createBoardHarness({ collectors: [counted] });
      try {
        const run = await board.run([], { json: true });
        expect(run.exitCode).toBe(2);
        expect(assertEnvelopeContract(run.envelope)).toEqual([]);
        expect(run.envelope?.error).toMatchObject({
          code: "status.collector.tracker.unavailable",
          category: "platform",
          retryable: false,
          consequence: "not_landed",
        });
        expect(run.envelope).not.toHaveProperty("data");
        expect(boardData(run)).toBeUndefined();
        expect(boardGates(run)).toEqual([]);
        expect(reads).toBe(1);
        expect(run.stderr).toContain("tracker");
        expect(hasAllClearToken(run.stdout)).toBe(false);
        expect(hasAllClearToken(run.stderr)).toBe(false);
        expect(board.recorder.calls).not.toContain("appendDecision");
      } finally {
        board.cleanup();
      }
    });
  }

  test("the family id is the declared collector id, not an empty placeholder", async () => {
    const board = createBoardHarness({ collectors: [failingCollector("tracker")] });
    try {
      const run = await board.run([], { json: true });
      const error = run.envelope?.error as { code?: string };
      expect(error.code).toBe("status.collector.tracker.unavailable");
      expect(error.code).not.toBe("status.collector..unavailable");
    } finally {
      board.cleanup();
    }
  });

  test("one read attempt per invocation, no retry, and zero appends", async () => {
    let reads = 0;
    const failing = failingCollector("tracker");
    const board = createBoardHarness({
      collectors: [
        {
          id: "tracker",
          read: async () => {
            reads += 1;
            return failing.read();
          },
        },
      ],
    });
    try {
      await board.run([], { json: true });
      expect(reads).toBe(1);
      expect(board.recorder.calls.filter((call) => call === "appendDecision")).toHaveLength(0);
    } finally {
      board.cleanup();
    }
  });

  test("paired controls: available three gates exits 0; available zero gates is observed-empty", async () => {
    const three = createBoardHarness({ collectors: [availableCollector("tracker", GATES)] });
    const empty = createBoardHarness({ collectors: [availableCollector("tracker", [])] });
    try {
      const success = await three.run([], { json: true });
      expect(success.exitCode).toBe(0);
      expect(boardGates(success)).toHaveLength(3);

      const observedEmpty = await empty.run([], { json: true });
      expect(observedEmpty.exitCode).toBe(0);
      expect(boardGates(observedEmpty)).toEqual([]);
      expect(boardData(observedEmpty)?.collectors).toEqual([
        { collector: "tracker", outcome: "available" },
      ]);
      const human = await empty.run([], { json: false });
      expect(human.exitCode).toBe(0);
      expect(human.stdout).toContain("observed-empty");
      expect(human.stdout).toContain("tracker:available");
    } finally {
      three.cleanup();
      empty.cleanup();
    }
  });

  test("empty-success and unavailable-failure are distinguishable in both modes", async () => {
    const empty = createBoardHarness({ collectors: [availableCollector("tracker", [])] });
    const failed = createBoardHarness({ collectors: [failingCollector("tracker")] });
    try {
      const emptyJson = await empty.run([], { json: true });
      const failedJson = await failed.run([], { json: true });
      expect(emptyJson.envelope).toHaveProperty("data");
      expect(failedJson.envelope).toHaveProperty("error");

      const emptyHuman = await empty.run([], { json: false });
      const failedHuman = await failed.run([], { json: false });
      expect(emptyHuman.exitCode).toBe(0);
      expect(failedHuman.exitCode).toBe(2);
      expect(emptyHuman.stdout).not.toContain("status.collector.");
      expect(failedHuman.stderr).not.toContain("observed-empty");
    } finally {
      empty.cleanup();
      failed.cleanup();
    }
  });
});

describe("TC-SLA-014 per-collector declaration and partial failure withholding", () => {
  test("a failing coordination collector is named while tracker is available", async () => {
    const board = createBoardHarness({
      collectors: [
        availableCollector("tracker", GATES.slice(0, 2)),
        failingCollector("coordination"),
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(2);
      expect(run.envelope?.error).toMatchObject({
        code: "status.collector.coordination.unavailable",
      });
      expect(run.envelope).not.toHaveProperty("data");
      expect(boardGates(run)).toEqual([]);
      expect(run.stderr).toContain("coordination");
      expect(run.stderr).not.toContain("tracker unavailable");
    } finally {
      board.cleanup();
    }
  });

  test("swapping which collector fails proves the id is data-derived", async () => {
    const board = createBoardHarness({
      collectors: [
        failingCollector("tracker"),
        availableCollector("coordination", GATES.slice(0, 2)),
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.envelope?.error).toMatchObject({
        code: "status.collector.tracker.unavailable",
      });
    } finally {
      board.cleanup();
    }
  });

  test("both available renders the union with per-collector evidence", async () => {
    const board = createBoardHarness({
      collectors: [
        availableCollector("tracker", [ownerReviewGate("GH-711", 2 * HOUR_MS)]),
        availableCollector("coordination", [ownerReviewGate("GH-712", 26 * HOUR_MS)]),
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      expect(boardGates(run)).toHaveLength(2);
      expect(boardData(run)?.collectors).toEqual([
        { collector: "tracker", outcome: "available" },
        { collector: "coordination", outcome: "available" },
      ]);
    } finally {
      board.cleanup();
    }
  });

  test("both unavailable is deterministic and never a partial board", async () => {
    const make = (): ReturnType<typeof createBoardHarness> =>
      createBoardHarness({
        collectors: [failingCollector("tracker"), failingCollector("coordination")],
      });
    const first = make();
    const second = make();
    try {
      const one = await first.run([], { json: true });
      const two = await second.run([], { json: true });
      expect(one.exitCode).toBe(2);
      expect(two.exitCode).toBe(2);
      expect(one.envelope?.error).toEqual(two.envelope?.error);
      expect(boardGates(one)).toEqual([]);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });

  test("no retries and no appends on a partial failure", async () => {
    let trackerReads = 0;
    const board = createBoardHarness({
      collectors: [
        {
          id: "tracker",
          read: async () => {
            trackerReads += 1;
            return availableCollector("tracker", GATES).read();
          },
        },
        failingCollector("coordination"),
      ],
    });
    try {
      await board.run([], { json: true });
      // The tracker read happens once; the failure returns before a re-read.
      expect(trackerReads).toBe(1);
      expect(board.recorder.calls).not.toContain("appendDecision");
    } finally {
      board.cleanup();
    }
  });
});
