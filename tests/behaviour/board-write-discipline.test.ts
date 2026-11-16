/**
 * TC-BOARD-061 — the only write is the idempotent decision record, plus the two
 * delivered store-opening side effects; no index maintenance, no prune, no edit
 * or delete (AC-F9-2, NFR-6, DEC-6).
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createBoardHarness } from "../fixtures/board/harness";
import { HOUR_MS, ownerReviewGate, waiverGate } from "../fixtures/board/matrix";
import { BOARD_REPOSITORY } from "../fixtures/board/sections";

type Snapshot = Readonly<Record<string, string>>;

const snapshot = (root: string): Snapshot => {
  const files: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else {
        const path = join(root, next);
        const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
        files.push(`${next}:${String(statSync(path).size)}:${digest}`);
      }
    }
  };
  walk("");
  return Object.fromEntries(files.map((entry) => [entry.split(":")[0] ?? entry, entry]));
};

const changed = (before: Snapshot, after: Snapshot): string[] => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => before[key] !== after[key]).sort();
};

describe("TC-BOARD-061 write discipline", () => {
  test("a read-only run leaves the store byte-identical", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [ownerReviewGate("GH-8001", 2 * HOUR_MS)],
          lanes: [],
          asks: [],
          parks: [],
        },
      ],
    });
    try {
      const before = snapshot(board.state.root);
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(0);
      expect(changed(before, snapshot(board.state.root))).toEqual([]);
    } finally {
      board.cleanup();
    }
  });

  test("a default application writes exactly one record; the replay writes nothing", async () => {
    const board = createBoardHarness({
      repositories: [
        {
          key: BOARD_REPOSITORY,
          gates: [waiverGate("GH-8002", 73 * HOUR_MS)],
          lanes: [],
          asks: [],
          parks: [],
        },
      ],
    });
    try {
      const before = snapshot(board.state.root);
      const first = await board.run([], { json: true });
      expect(first.exitCode).toBe(0);
      const afterFirst = snapshot(board.state.root);
      const written = changed(before, afterFirst);
      // Exactly the repository's decision ledger and the store's create-once
      // header artifact are created; no index, prune, edit, or delete occurs.
      expect(written).toHaveLength(2);
      expect(written.some((entry) => entry.endsWith(".jsonl"))).toBe(true);
      expect(written.some((entry) => entry.endsWith(".json"))).toBe(true);
      expect(board.recorder.calls.filter((call) => call.startsWith("appendDecision"))).toHaveLength(
        1,
      );

      const second = await board.run([], { json: true });
      expect(second.exitCode).toBe(0);
      expect(changed(afterFirst, snapshot(board.state.root))).toEqual([]);
      expect(board.recorder.calls.filter((call) => call.startsWith("appendDecision"))).toHaveLength(
        1,
      );
    } finally {
      board.cleanup();
    }
  });
});

/**
 * TC-BOARD-061 (completed, review iteration 1 F-3): a two-repository `--all`
 * host with a real seeded index — host-root snapshot, index-write counters, and
 * revision assertions across a no-default and a default-applying run, plus the
 * index-maintenance mutant proving the snapshot check is live (DoD-11).
 */
import { writeFileSync } from "node:fs";
import { createSelectionHarness } from "../fixtures/board/selection";

const NOW_INSTANT = "2026-11-06T12:00:00Z";
const OLD_INSTANT = "2026-11-03T09:00:00Z";

describe("TC-BOARD-061 host-root write discipline (fleet)", () => {
  test("a no-default --all run leaves the host root and the index untouched", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "repository-a" }, { projectKey: "repository-b" }],
      invokingKey: "repository-a",
      issues: {
        "repository-a": [{ number: 244, labels: ["hand-back"], updatedAt: NOW_INSTANT }],
        "repository-b": [{ number: 245, labels: ["hand-back"], updatedAt: NOW_INSTANT }],
      },
    });
    try {
      const revision = harness.indexRevision();
      const before = snapshot(harness.hostRoot);
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      expect(harness.indexReads()).toBe(1);
      expect(harness.indexWrites()).toBe(0);
      expect(harness.indexRevision()).toBe(revision);
      expect(changed(before, snapshot(harness.hostRoot))).toEqual([]);
      expect(harness.readDecisions("repository-a")).toHaveLength(0);
      expect(harness.readDecisions("repository-b")).toHaveLength(0);
    } finally {
      harness.dispose();
    }
  });

  test("a default-applying --all run writes only that repository's ledger", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "repository-a" }, { projectKey: "repository-b" }],
      invokingKey: "repository-a",
      issues: {
        "repository-a": [{ number: 246, labels: ["hand-back"], updatedAt: NOW_INSTANT }],
        "repository-b": [{ number: 246, labels: ["hand-back"], updatedAt: OLD_INSTANT }],
      },
    });
    try {
      harness.seedWaiver("repository-b", { changeRef: "GH-246", authorizer: "principal-b" });
      const revision = harness.indexRevision();
      const before = snapshot(harness.hostRoot);
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      const written = changed(before, snapshot(harness.hostRoot));
      // Exactly the owning repository's decision ledger (its store header was
      // created when the waiver was seeded, before the snapshot).
      expect(written).toHaveLength(1);
      expect(written[0]?.startsWith("projects/repository-b/")).toBe(true);
      expect(written[0]?.endsWith(".jsonl")).toBe(true);
      expect(harness.indexWrites()).toBe(0);
      expect(harness.indexRevision()).toBe(revision);
      expect(before["host-index.json"]).toBe(snapshot(harness.hostRoot)["host-index.json"]);
      expect(harness.readDecisions("repository-b")).toHaveLength(1);
      expect(harness.readDecisions("repository-a")).toHaveLength(0);
    } finally {
      harness.dispose();
    }
  });

  test("the index-maintenance mutant fails the snapshot check naming the index file", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "repository-a" }],
      invokingKey: "repository-a",
    });
    try {
      const before = snapshot(harness.hostRoot);
      // Simulate the regression the suite guards: a maintenance write advances
      // the index revision and rewrites the file.
      const document = JSON.parse(readFileSync(harness.indexPath, "utf8")) as {
        revision: number;
      };
      writeFileSync(
        harness.indexPath,
        `${JSON.stringify({ ...document, revision: document.revision + 1 }, null, 2)}\n`,
        "utf8",
      );
      const after = snapshot(harness.hostRoot);
      expect(changed(before, after)).toEqual(["host-index.json"]);
    } finally {
      harness.dispose();
    }
  });
});
