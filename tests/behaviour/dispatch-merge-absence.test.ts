/**
 * TC-MERGE-001 / TC-MERGE-002 / TC-TRUTH-004 (phase-4 confirmation) — a
 * merge-ready open PR stays `pr-open` or `pr-open-unverified` and never fires a
 * merge; an independently merged PR is detection-only `merged`, with the
 * observed evidence recorded and the merge recorder still at zero.
 */
import { describe, expect, test } from "bun:test";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { artifacts, readOk } from "../fixtures/dispatch/truth";

const attemptOf = (scenario: ReturnType<typeof createCommandScenario>) => {
  const read = readDispatchAttempts(scenario.state.store);
  if (!read.ok) throw new Error("ledger read failed");
  return read.records[0];
};

describe("TC-MERGE-001 a merge-ready PR stays open and fires no merge", () => {
  test("pr-open with a resolved URL, zero merge calls", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.envelope?.data?.result).toBe("pr-open");
      expect(run.envelope?.data?.prUrl).toContain("/pull/1");
      expect(scenario.calls.merge).toBe(0);
      expect(attemptOf(scenario)?.token).toBe("pr-open");
    } finally {
      scenario.dispose();
    }
  });

  test("an unresolved URL stays pr-open-unverified, never merged", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({
        artifacts: readOk(
          artifacts({ branchCommits: 2, pr: { state: "open", url: null, mergeReady: true } }),
        ),
      }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.envelope?.data?.result).toBe("pr-open-unverified");
      expect(run.envelope?.data?.result).not.toBe("merged");
      expect(scenario.calls.merge).toBe(0);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-MERGE-002 an already-merged PR is detection-only", () => {
  test("merged is emitted only after independent observation, with zero merge calls", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({
        artifacts: readOk(
          artifacts({
            branchCommits: 4,
            pr: {
              state: "already-merged",
              url: "https://example.test/owner/repo/pull/1",
              mergeReady: false,
            },
          }),
        ),
      }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.result).toBe("merged");
      const record = attemptOf(scenario);
      expect(record?.token).toBe("merged");
      expect(record?.comparison.class).toBe("tracker-truth");
      expect(scenario.calls.merge).toBe(0);
    } finally {
      scenario.dispose();
    }
  });
});
