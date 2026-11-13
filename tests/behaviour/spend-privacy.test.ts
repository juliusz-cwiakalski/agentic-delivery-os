/**
 * TC-SPEND-023 — privacy: statistics and identity references only. No prompt
 * text, message body, transcript, diff, tool output, or credential material
 * reaches any output channel; the report shape carries no free-text member.
 */
import { describe, expect, test } from "bun:test";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import {
  foldSeed,
  makeSessionRecord,
  removeRoot,
  SPEND_REF,
  SYNTHETIC_BRAND,
  tokens,
  warning,
} from "../fixtures/spend/harness";

const CANARY = "CANARY-prompt-transcript-diff-8f3a";

const seed = {
  records: [
    makeSessionRecord({
      runId: "run-R1",
      tokens: tokens({ input: 10, output: 5 }),
      // Raw harness material lives outside the reported record fields: a
      // warning's field name and the tree identity are never rendered.
      treeRoot: CANARY,
      warnings: [warning("malformed-line", CANARY)],
    }),
  ],
  outcomes: [],
};

describe("TC-SPEND-023 privacy of output", () => {
  test("the canary is present in the fixture record before the absence assertion", () => {
    const record = seed.records[0];
    expect(record?.treeRoot).toBe(CANARY);
    expect(record?.warnings[0]?.field).toBe(CANARY);
  });

  test("no canary survives into the machine or human output", () => {
    const { fold, root } = foldSeed(seed, "privacy");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const machine = JSON.stringify(fold.data);
      const human = renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true });
      for (const channel of [machine, human]) {
        expect(channel).not.toContain(CANARY);
        expect(channel).not.toContain("CANARY");
      }
    } finally {
      removeRoot(root);
    }
  });

  test("the report carries only the declared statistic and identity categories", () => {
    const { fold, root } = foldSeed(seed, "privacy-categories");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      expect(Object.keys(fold.data).sort()).toEqual([
        "amplification",
        "breakdowns",
        "costTotals",
        "degradation",
        "perAgent",
        "perPhase",
        "phaseTiming",
        "reconciliation",
        "restarts",
        "telemetryState",
        "tokensByClass",
      ]);
      const rendered = JSON.stringify(fold.data);
      for (const forbidden of [
        "prompt",
        "message",
        "transcript",
        "diff",
        "toolOutput",
        "credential",
        "secret",
      ]) {
        expect(rendered).not.toContain(forbidden);
      }
      expect(fold.data.perAgent[0]?.agent).toBe("planner");
      expect(fold.data.perAgent[0]?.model).toBe("sonnet");
    } finally {
      removeRoot(root);
    }
  });

  test("a failure diagnostic carries the selection only, never a payload excerpt", () => {
    const { fold, root } = foldSeed({ records: [], outcomes: [] }, "privacy-absence");
    try {
      expect(fold?.ok).toBe(false);
      if (fold === undefined || fold.ok) return;
      expect(fold.absence.code).toBe("spend.telemetry-absent");
      expect(fold.absence.workItemRef).toBe(SPEND_REF);
      expect(JSON.stringify(fold.absence)).not.toContain(CANARY);
    } finally {
      removeRoot(root);
    }
  });

  test("the human digest carries no free-form prose beyond the declared lines", () => {
    const { fold, root } = foldSeed(seed, "privacy-prose");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const human = renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true });
      for (const line of human.split("\n").filter((entry) => entry !== "")) {
        expect(
          /^(spend|tokens|calls|agents|phases|restarts|limits|ratio|events|degradation|truncated|- )/.test(
            line,
          ),
          line,
        ).toBe(true);
      }
    } finally {
      removeRoot(root);
    }
  });
});
