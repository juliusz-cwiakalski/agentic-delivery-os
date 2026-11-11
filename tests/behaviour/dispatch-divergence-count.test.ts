/**
 * GH-289 TC-ATTEMPT-022 — one exact repository-scoped divergence count shared by
 * the resolve result and `dispatch dual-run summary`.
 *
 * A migrated root holds 26 open and 3 resolved divergences for the reported
 * repository plus 5 open for another. Both surfaces keep the four delivered
 * fields in delivered order, report the exact open count (25 after the resolve),
 * return exactly 20 identifiers with `idsTruncated: true`, and never derive the
 * count from the identifier list's length.
 */
import { describe, expect, test } from "bun:test";
import { appendDispatchDivergence } from "../../packages/core/src/app/dispatch-ledger";
import type {
  DispatchDivergenceRecord,
  DispatchResolveData,
  DispatchSummaryData,
} from "../../packages/core/src/contracts/index";
import {
  openDivergences,
  resolvedDivergences,
  withHistory,
} from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import { REPOSITORY, REPOSITORY_BETA } from "../fixtures/dispatch/ledger";

const seed = (
  harness: ReturnType<typeof createAttemptsHarness>,
  records: readonly DispatchDivergenceRecord[],
) => {
  for (const record of records) {
    const appended = appendDispatchDivergence(harness.store, "seed-fence", record);
    if (!appended.ok) throw new Error(`divergence seeding failed: ${appended.code}`);
  }
};

/** Open divergences for the other repository, with identifiers of their own. */
const foreignOpen = (count: number): readonly DispatchDivergenceRecord[] =>
  openDivergences(count, REPOSITORY_BETA).map((record, index) => ({
    ...record,
    divergenceId: `DIV-BETA-${String(index + 1).padStart(3, "0")}`,
  }));

describe("TC-ATTEMPT-022 one exact repository-scoped count", () => {
  test("both surfaces report 25 open with 20 identifiers and idsTruncated", async () => {
    const harness = createAttemptsHarness({ label: "divergence-count", records: [] });
    try {
      seed(harness, [...openDivergences(26), ...resolvedDivergences(3), ...foreignOpen(5)]);
      const summary = await harness.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      expect(summary.exit).toBe(0);
      const summaryData = summary.data as DispatchSummaryData;
      expect(summaryData.divergences.unresolved).toBe(26);

      const resolved = await harness.invoke([
        "dispatch",
        "dual-run",
        "resolve",
        "DIV-OPEN-001",
        "--note",
        "resolved from local evidence",
        "--json",
      ]);
      expect(resolved.exit).toBe(0);
      const resolveData = resolved.data as DispatchResolveData;

      const after = await harness.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const summaryAfter = after.data as DispatchSummaryData;

      for (const block of [resolveData.divergences, summaryAfter.divergences]) {
        expect(Object.keys(block)).toEqual([
          "reported",
          "resolved",
          "unresolved",
          "unresolvedIds",
          "idsTruncated",
        ]);
        expect(block.unresolved).toBe(25);
        expect(block.reported).toBe(29);
        expect(block.resolved).toBe(4);
        expect(block.unresolvedIds).toHaveLength(20);
        expect(block.idsTruncated).toBe(true);
        // The count is never the list's length.
        expect(block.unresolved).toBeGreaterThan(block.unresolvedIds.length);
        expect(block.unresolvedIds).not.toContain("DIV-OPEN-001");
        expect(block.unresolvedIds.some((id) => id.startsWith("DIV-DONE"))).toBe(false);
      }
    } finally {
      harness.dispose();
    }
  });

  test("the fold keeps latest-per-identifier and reports it open", async () => {
    const harness = createAttemptsHarness({ label: "divergence-fold", records: [] });
    try {
      seed(harness, [...withHistory("DIV-HIST"), ...resolvedDivergences(1)]);
      const summary = await harness.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const data = summary.data as DispatchSummaryData;
      expect(data.divergences.reported).toBe(2);
      expect(data.divergences.resolved).toBe(1);
      expect(data.divergences.unresolved).toBe(1);
      expect(data.divergences.unresolvedIds).toEqual(["DIV-HIST"]);
      expect(data.divergences.idsTruncated).toBe(false);
    } finally {
      harness.dispose();
    }
  });

  test("a foreign repository's open divergences are not counted", async () => {
    const harness = createAttemptsHarness({ label: "divergence-foreign", records: [] });
    try {
      seed(harness, [...openDivergences(2), ...foreignOpen(7)]);
      const summary = await harness.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const data = summary.data as DispatchSummaryData;
      expect(data.divergences.unresolved).toBe(2);
      expect(data.divergences.idsTruncated).toBe(false);
    } finally {
      harness.dispose();
    }
  });
});
