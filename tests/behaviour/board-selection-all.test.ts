/**
 * TC-BOARD-011, TC-BOARD-012, TC-BOARD-016 — `--all` is the index union the
 * invoking checkout, ascending and unique, and the managed-set edge cells are
 * classified (AC-F3-1, AC-F8-2, AC-NFR5-1, SC-M2-S4-02).
 */
import { describe, expect, test } from "bun:test";
import { createSelectionHarness } from "../fixtures/board/selection";

describe("TC-BOARD-011/012/016 --all selection", () => {
  test("both keys listed once, ascending, one index read, no cap omission", async () => {
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "delivery-b" }, { projectKey: "delivery-a" }],
      invokingKey: "delivery-a",
    });
    try {
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.selection).toBe("all");
      expect(run.data?.repositories).toEqual(["delivery-a", "delivery-b"]);
      expect(run.data?.omittedBySection).toMatchObject({ repositories: 0 });
      expect(run.data?.truncated).toBe(false);
      expect(harness.indexReads()).toBe(1);
      expect(harness.storesOpened).toHaveLength(2);
    } finally {
      harness.dispose();
    }
  });

  test("a vanished root is not a board repository", async () => {
    const harness = createSelectionHarness({
      repositories: [
        { projectKey: "delivery-a" },
        { projectKey: "delivery-gone", rootExists: false },
      ],
      invokingKey: "delivery-a",
    });
    try {
      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.repositories).toEqual(["delivery-a"]);
      expect(harness.storesOpened).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });

  test("an absent index is not an error; an unreadable or unparseable one withholds", async () => {
    const absent = createSelectionHarness({
      repositories: [{ projectKey: "delivery-a" }],
      invokingKey: "delivery-a",
      index: "absent",
    });
    try {
      const run = await absent.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.repositories).toEqual(["delivery-a"]);
    } finally {
      absent.dispose();
    }
    for (const index of ["unreadable", "unparseable"] as const) {
      const harness = createSelectionHarness({
        repositories: [{ projectKey: "delivery-a" }],
        invokingKey: "delivery-a",
        index,
      });
      try {
        const run = await harness.run(["board", "--all"]);
        expect(run.exitCode, index).toBe(2);
        expect(run.errorCode, index).toBe("board.state-unavailable");
        expect(run.data, index).toBeUndefined();
        expect(run.stderr).toContain("host index");
      } finally {
        harness.dispose();
      }
    }
  });
});

/**
 * TC-BOARD-011/012 remediation (F-1, review iteration 1): the fleet tracker read
 * joins merge waivers from each TARGET repository's own store, so a non-invoking
 * repository's waiver surfaces and a shared ref never imports another
 * repository's waiver (AC-F4-1, AC-F4-2, AC-F3-2, NFR-3, DM-10).
 */
describe("TC-BOARD-011/012 per-repository waiver join", () => {
  test("shared refs keep divergent waivers distinct and a non-invoking waiver surfaces", async () => {
    const old = "2026-11-03T09:00:00Z";
    const fresh = "2026-11-06T10:00:00Z";
    const harness = createSelectionHarness({
      repositories: [{ projectKey: "repository-a" }, { projectKey: "repository-b" }],
      invokingKey: "repository-a",
      issues: {
        "repository-a": [
          { number: 244, labels: ["hand-back"], updatedAt: fresh },
          { number: 245, labels: ["hand-back"], updatedAt: fresh },
          { number: 246, labels: ["hand-back"], updatedAt: fresh },
        ],
        "repository-b": [
          { number: 244, labels: ["hand-back"], updatedAt: fresh },
          { number: 245, labels: ["hand-back"], updatedAt: fresh },
          { number: 246, labels: ["hand-back"], updatedAt: old },
        ],
      },
    });
    try {
      // 244 is waived only in the INVOKING repository; 245 only in the other;
      // 246 is waived and past 72 h only in the other.
      harness.seedWaiver("repository-a", { changeRef: "GH-244", authorizer: "principal-a" });
      harness.seedWaiver("repository-b", { changeRef: "GH-245", authorizer: "principal-b" });
      harness.seedWaiver("repository-b", { changeRef: "GH-246", authorizer: "principal-b" });

      const run = await harness.run(["board", "--all"]);
      expect(run.exitCode).toBe(0);
      const gates = (run.data?.gates ?? []) as readonly Record<string, unknown>[];
      const row = (repository: string, ref: string) =>
        gates.find((gate) => gate.repository === repository && gate.ref === ref);

      expect(row("repository-a", "244")).toMatchObject({
        kind: "waiver",
        waivedBy: "principal-a",
        ownerSource: "gate-waiver-authorizer",
      });
      // The shared ref must NOT import repository-a's waiver.
      expect(row("repository-b", "244")).toMatchObject({
        kind: "owner-review",
        waivedBy: null,
        ownerSource: "gate-audience",
      });
      expect(row("repository-a", "245")).toMatchObject({ kind: "owner-review", waivedBy: null });
      expect(row("repository-b", "245")).toMatchObject({
        kind: "waiver",
        waivedBy: "principal-b",
        ownerSource: "gate-waiver-authorizer",
      });
      expect(row("repository-a", "246")).toMatchObject({ kind: "owner-review", waivedBy: null });
      expect(row("repository-b", "246")).toMatchObject({
        kind: "waiver",
        waivedBy: "principal-b",
        slaState: "default-applied",
        default: "owner-review-first",
      });

      // The 72 h default appends to the owning repository only.
      expect(harness.readDecisions("repository-b")).toHaveLength(1);
      expect(harness.readDecisions("repository-a")).toHaveLength(0);
      // Each store keeps its own waiver ledger.
      expect(harness.readWaivers("repository-a").map((waiver) => waiver.changeRef)).toEqual([
        "GH-244",
      ]);
      expect(
        harness
          .readWaivers("repository-b")
          .map((waiver) => waiver.changeRef)
          .sort(),
      ).toEqual(["GH-245", "GH-246"]);
    } finally {
      harness.dispose();
    }
  });
});
