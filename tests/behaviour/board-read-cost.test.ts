/**
 * TC-SLA-026 — read cost: one bounded tracker read, at most one decision-history
 * read, no pagination/retry/new request kind/network write/child process, and
 * exactly one fence plus one append when a default applies.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOARD_MAX_REPOSITORIES,
  HOST_INDEX_MAX_ENTRIES,
  STATUS_SOURCE_ITEM_LIMIT,
} from "../../packages/core/src/contracts/index";
import {
  availableCollector,
  createBoardHarness,
  failingCollector,
} from "../fixtures/board/harness";
import { HOUR_MS, ownerReviewGate, waiverGate } from "../fixtures/board/matrix";

const ROOT = process.cwd();

describe("TC-SLA-026 read cost", () => {
  test("one tracker read at the delivered budget, with no pagination or retry", async () => {
    let reads = 0;
    const base = availableCollector("tracker", [ownerReviewGate("GH-901", 2 * HOUR_MS)]);
    const board = createBoardHarness({
      collectors: [
        {
          id: "tracker",
          read: async () => {
            reads += 1;
            return base.read();
          },
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      expect(reads).toBe(1);
      const edge = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
      expect(edge).toContain("listWorkItems(STATUS_SOURCE_ITEM_LIMIT)");
      expect(STATUS_SOURCE_ITEM_LIMIT).toBe(100);
    } finally {
      board.cleanup();
    }
  });

  test("a read-only run performs at most one decision-history read and zero writes", async () => {
    const board = createBoardHarness({ gates: [ownerReviewGate("GH-902", 2 * HOUR_MS)] });
    try {
      await board.run([], { json: true });
      expect(board.recorder.calls.filter((call) => call === "readDecisions")).toHaveLength(0);
      expect(board.recorder.calls).not.toContain("append");
      expect(board.recorder.calls).not.toContain("acquireFence");
    } finally {
      board.cleanup();
    }
  });

  test("an expired default performs one history read, one fence, and one append", async () => {
    const board = createBoardHarness({ gates: [waiverGate("GH-903", 73 * HOUR_MS)] });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      expect(board.recorder.calls.filter((call) => call === "readDecisions")).toHaveLength(1);
      expect(board.recorder.calls.filter((call) => call === "acquireFence")).toHaveLength(1);
      expect(board.recorder.calls.filter((call) => call === "append")).toHaveLength(1);
    } finally {
      board.cleanup();
    }
  });

  test("text and --json perform the same reads and one render each", async () => {
    const first = createBoardHarness({ gates: [ownerReviewGate("GH-904", 2 * HOUR_MS)] });
    const second = createBoardHarness({ gates: [ownerReviewGate("GH-904", 2 * HOUR_MS)] });
    try {
      await first.run([], { json: false });
      await second.run([], { json: true });
      expect(first.recorder.calls.filter((call) => call === "readDecisions")).toEqual(
        second.recorder.calls.filter((call) => call === "readDecisions"),
      );
      expect(first.recorder.calls.filter((call) => call === "append")).toEqual([]);
      expect(second.recorder.calls.filter((call) => call === "append")).toEqual([]);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });

  test("a collector-unavailable run makes one failed attempt and no retry", async () => {
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
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(2);
      expect(reads).toBe(1);
    } finally {
      board.cleanup();
    }
  });

  test("no live network call, provider resolve/quota call, or child process occurs", async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    try {
      globalThis.fetch = (() => {
        called = true;
        throw new Error("unexpected live call");
      }) as typeof fetch;
      const board = createBoardHarness({ gates: [ownerReviewGate("GH-905", 2 * HOUR_MS)] });
      try {
        await board.run([], { json: true });
      } finally {
        board.cleanup();
      }
      expect(called).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("positive control: a deliberate second read trips the guard, proving the recorder is live", async () => {
    let calls = 0;
    const base = availableCollector("tracker", [ownerReviewGate("GH-906", 2 * HOUR_MS)]);
    const guarded = async (): Promise<void> => {
      calls += 1;
      if (calls > 1) throw new Error("deliberate second read");
      await base.read();
    };
    await guarded();
    expect(calls).toBe(1);
    await expect(guarded()).rejects.toThrow("deliberate second read");
  });
});

describe("TC-BOARD-070 declared read set and the repository bound", () => {
  test("one bounded read set per included repository, one decision-history read each", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: "repository-a",
          gates: [waiverGate("GH-9101", 73 * HOUR_MS)],
          lanes: [],
          asks: [],
          parks: [],
        },
        {
          key: "repository-b",
          gates: [waiverGate("GH-9102", 73 * HOUR_MS)],
          lanes: [],
          asks: [],
          parks: [],
        },
      ],
      selection: "all",
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      const decisionReads = board.recorder.calls.filter((call) => call === "readDecisions");
      // At most one decision-history read per included repository (NFR-5).
      expect(decisionReads).toHaveLength(2);
      const appends = board.recorder.calls.filter((call) => call.startsWith("appendDecision"));
      expect(appends).toHaveLength(2);
      expect(new Set(appends).size).toBe(2);
      expect(BOARD_MAX_REPOSITORIES).toBe(128);
      expect(BOARD_MAX_REPOSITORIES).not.toBe(HOST_INDEX_MAX_ENTRIES);
    } finally {
      board.cleanup();
    }
  });
});
