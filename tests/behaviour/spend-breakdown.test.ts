/**
 * TC-SPEND-003 — the per-ticket five-class breakdown and the per-(agent, model)
 * roll-ups, checked against independently hand-summed fixture constants.
 */
import { describe, expect, test } from "bun:test";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import {
  foldSeed,
  makeIdentity,
  makeSessionRecord,
  makeTempRoot,
  openStore,
  removeRoot,
  runSpendCli,
  SPEND_REF,
  type SpendSeed,
  SYNTHETIC_BRAND,
  seedSpend,
  spendRuntimeOver,
  threeGroupRun,
  tokens,
} from "../fixtures/spend/harness";

const EXPECTED_TOKENS = tokens({
  input: 123,
  output: 52,
  reasoning: 7,
  cacheRead: 2,
  cacheWrite: 1,
});

const seed: SpendSeed = {
  records: threeGroupRun({
    runId: "run-R1",
    capturedAt: "2026-11-01T11:00:00.000Z",
    tokensByGroup: [
      tokens({ input: 100, output: 40, reasoning: 5, cacheRead: 2, cacheWrite: 1 }),
      tokens({ input: 20, output: 10, reasoning: 2 }),
      tokens({ input: 3, output: 2 }),
    ],
    calls: [2, 1, 1],
  }),
};

describe("TC-SPEND-003 per-ticket breakdown", () => {
  test("tokensByClass, perAgent and restarts equal the hand-summed oracle", () => {
    const { fold, root } = foldSeed(seed, "breakdown");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(Object.keys(fold.data).sort()).toEqual([
        "amplification",
        "degradation",
        "perAgent",
        "perPhase",
        "restarts",
        "tokensByClass",
      ]);
      expect(fold.data.tokensByClass).toEqual(EXPECTED_TOKENS);
      expect(fold.data.perAgent).toEqual([
        { agent: "planner", model: "sonnet", calls: 3, tokens: 153 },
        { agent: "coder", model: "opus", calls: 1, tokens: 32 },
      ]);
      expect(fold.data.restarts).toBe(0);
      expect(fold.data.amplification.ratio).toBe(1);
    } finally {
      removeRoot(root);
    }
  });

  test("the roll-up spans every run and every session group", () => {
    const twoRuns: SpendSeed = {
      records: [
        ...threeGroupRun({
          runId: "run-R1",
          capturedAt: "2026-11-01T11:00:00.000Z",
          tokensByGroup: [tokens({ input: 10 })],
          calls: [1],
        }),
        makeSessionRecord({
          runId: "run-R2",
          sessionId: "ses-second-run",
          tokens: tokens({ input: 5 }),
          calls: 2,
          capturedAt: "2026-11-01T12:00:00.000Z",
        }),
      ],
    };
    const { fold, root } = foldSeed(twoRuns, "breakdown-two-runs");
    try {
      expect(fold?.ok).toBe(true);
      if (fold === undefined || !fold.ok) return;
      expect(fold.data.tokensByClass.input).toBe(15);
      expect(fold.data.perAgent).toEqual([
        { agent: "planner", model: "sonnet", calls: 3, tokens: 15 },
      ]);
      expect(fold.data.restarts).toBe(1);
    } finally {
      removeRoot(root);
    }
  });

  test("the human digest renders the same totals and the same agent entries", () => {
    const { fold, root } = foldSeed(seed, "breakdown-human");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const human = renderSpendHuman(fold.data, {
        brand: SYNTHETIC_BRAND,
        amplification: false,
      });
      expect(human).toContain("input 123 | output 52 | reasoning 7 | cacheRead 2 | cacheWrite 1");
      expect(human).toContain("- planner/sonnet: 3 calls, 153 tokens");
      expect(human).toContain("- coder/opus: 1 calls, 32 tokens");
      expect(human).toContain(`restarts   0`);
      expect(human.startsWith("spend")).toBe(true);
    } finally {
      removeRoot(root);
    }
  });

  test("both modes derive from the same data object", () => {
    const { fold, root } = foldSeed(seed, "breakdown-modes");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const second = foldSeed(seed, "breakdown-modes-2");
      try {
        if (second.fold === undefined || !second.fold.ok) throw new Error("fold failed");
        expect(second.fold.data).toEqual(fold.data);
        expect(JSON.stringify(second.fold.data)).toBe(JSON.stringify(fold.data));
      } finally {
        removeRoot(second.root);
      }
      expect(SPEND_REF).toBe("GH-236");
    } finally {
      removeRoot(root);
    }
  });
});

describe("TC-SPEND-003 runCli integration half", () => {
  test("the envelope data equals the engine fold", async () => {
    const root = makeTempRoot("gh236-breakdown-cli");
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      seedSpend(store, seed);
      const run = await runSpendCli(
        ["--json", "spend", "--ref", SPEND_REF],
        spendRuntimeOver(store),
      );
      expect(run.exitCode).toBe(0);
      const envelope = JSON.parse(run.stdout) as { readonly data?: unknown };
      const folded = foldSeed(seed, "breakdown-cli-oracle");
      try {
        if (folded.fold === undefined || !folded.fold.ok) throw new Error("fold failed");
        expect(envelope.data).toEqual(JSON.parse(JSON.stringify(folded.fold.data)));
      } finally {
        removeRoot(folded.root);
      }
    } finally {
      removeRoot(root);
    }
  });
});
