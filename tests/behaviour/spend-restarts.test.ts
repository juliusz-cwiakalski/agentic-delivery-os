/**
 * TC-SPEND-013 — restart counts are set-based over the union of run identities
 * across both telemetry families, floored at zero, and never derived from record
 * or session counts.
 */
import { describe, expect, test } from "bun:test";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import {
  foldSeed,
  makeOutcomeRecord,
  makeSessionRecord,
  removeRoot,
  type SpendSeed,
  SYNTHETIC_BRAND,
  tokens,
} from "../fixtures/spend/harness";

const run = (runId: string, sessionSuffix = "") =>
  makeSessionRecord({
    runId,
    sessionId: `ses-${runId}${sessionSuffix}`,
    tokens: tokens({ input: 10 }),
    capturedAt: `2026-11-01T1${runId.length % 3}:00:00.000Z`,
  });

const restartsOf = (label: string, seed: SpendSeed): number => {
  const { fold, root } = foldSeed(seed, label);
  try {
    if (fold === undefined || !fold.ok) throw new Error("fold failed");
    return fold.data.restarts;
  } finally {
    removeRoot(root);
  }
};

describe("TC-SPEND-013 restart counting", () => {
  test("one run floors at zero and three runs read two", () => {
    expect(restartsOf("restarts-one", { records: [run("R1")] })).toBe(0);
    expect(restartsOf("restarts-three", { records: [run("R1"), run("R2"), run("R3")] })).toBe(2);
  });

  test("a capture-outcome-only run joins the union while session-only unioning would miss it", () => {
    const seed: SpendSeed = {
      records: [run("R1"), run("R2")],
      outcomes: [makeOutcomeRecord({ runId: "R3" })],
    };
    expect(restartsOf("restarts-union", seed)).toBe(2);
  });

  test("the same run id in both families counts once", () => {
    const seed: SpendSeed = {
      records: [run("R1")],
      outcomes: [makeOutcomeRecord({ runId: "R1" })],
    };
    expect(restartsOf("restarts-dedup", seed)).toBe(0);
  });

  test("the count is independent of record count and sessions per run", () => {
    const seeds = ["R1", "R2", "R3", "R4", "R5"];
    const records = seeds.flatMap((runId, index) =>
      Array.from({ length: index === 0 ? 8 : 1 }, (_, suffix) => run(runId, `-${String(suffix)}`)),
    );
    expect(records).toHaveLength(12);
    expect(restartsOf("restarts-records", { records })).toBe(4);
  });

  test("a capture-outcome-only store counts its union and is not misclassified absent", () => {
    const { fold, read, root } = foldSeed(
      {
        records: [],
        outcomes: [
          makeOutcomeRecord({ runId: "run-only-a" }),
          makeOutcomeRecord({ runId: "run-only-b" }),
        ],
      },
      "restarts-outcome-only",
    );
    try {
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.verifiedEmpty).toBe(false);
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.restarts).toBe(1);
      expect(fold.data.tokensByClass.input).toBe(0);
    } finally {
      removeRoot(root);
    }
  });

  test("a store with no run identity is the classified absence, not a zero report", () => {
    const { fold, root } = foldSeed({ records: [], outcomes: [] }, "restarts-absent");
    try {
      expect(fold?.ok).toBe(false);
      if (fold === undefined || fold.ok) return;
      expect(fold.absence.code).toBe("spend.telemetry-absent");
    } finally {
      removeRoot(root);
    }
  });

  test("the human digest agrees and discloses the capture-reached basis", () => {
    const { fold, root } = foldSeed(
      { records: [run("R1"), run("R2"), run("R3")] },
      "restarts-human",
    );
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const human = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: false,
      });
      expect(human).toContain("restarts   2 (runs that reached closeout capture)");
      expect(human).toContain("restart counts share that capture-reached evidence basis");
    } finally {
      removeRoot(root);
    }
  });
});
