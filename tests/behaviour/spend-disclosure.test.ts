/**
 * TC-SPEND-018 — the honesty limits are declared once, rendered verbatim in the
 * report's own terms, and cannot be silently deleted.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SPEND_DISCLOSURES } from "../../packages/core/src/contracts/index";
import { renderSpendHuman } from "../../packages/core/src/domain/index";
import { A01, A02, type AmplificationCase } from "../fixtures/spend/cases";
import { foldSeed, removeRoot, SYNTHETIC_BRAND } from "../fixtures/spend/harness";

const REQUIRED_OBLIGATIONS = [
  "run duplication",
  "semantic duplication",
  "closeout capture",
  "capture-reached",
  "zero-token progress run",
  "amplification.progressRun",
];

const missingDisclosures = (rendered: string): string[] =>
  SPEND_DISCLOSURES.filter((statement) => !rendered.includes(statement));

const renderFor = (testCase: AmplificationCase): string => {
  const { fold, root } = foldSeed(testCase.seed, `disclosure-${testCase.id}`);
  try {
    if (fold === undefined || !fold.ok) throw new Error("fold failed");
    return renderSpendHuman(fold.data, { brand: SYNTHETIC_BRAND, amplification: true });
  } finally {
    removeRoot(root);
  }
};

describe("TC-SPEND-018 honesty limits", () => {
  test("one declaration carries every obligation and only run-level claims", () => {
    expect(SPEND_DISCLOSURES).toHaveLength(4);
    const joined = SPEND_DISCLOSURES.join(" ");
    for (const obligation of REQUIRED_OBLIGATIONS) expect(joined).toContain(obligation);
    expect(joined).not.toContain("work duplication");
  });

  test("the amplified and healthy reports both render every statement verbatim", () => {
    for (const testCase of [A01, A02]) {
      const rendered = renderFor(testCase);
      expect(missingDisclosures(rendered)).toEqual([]);
    }
  });

  test("the renderer maps the declared constant, so a deleted statement is visible", () => {
    const source = readFileSync(
      join(process.cwd(), "packages/core/src/domain/spend-text.ts"),
      "utf8",
    );
    expect(source).toContain("SPEND_DISCLOSURES.map(");
    const second = SPEND_DISCLOSURES[1];
    if (second === undefined) throw new Error("the disclosure set is incomplete");
    const mutated = renderFor(A01)
      .split("\n")
      .filter((line) => !line.includes(second))
      .join("\n");
    expect(missingDisclosures(mutated)).toEqual([second]);
  });

  test("the machine block makes no stronger claim than the formula supports", () => {
    const { fold, root } = foldSeed(A02.seed, "disclosure-machine");
    try {
      if (fold === undefined || !fold.ok) throw new Error("fold failed");
      const keys = Object.keys(fold.data.amplification).sort();
      expect(keys).toEqual(["events", "progressRun", "ratio"]);
      const rendered = JSON.stringify(fold.data.amplification);
      expect(rendered).not.toContain("semantic");
      expect(rendered).not.toContain("content");
      expect(rendered).not.toContain("work duplication");
      for (const event of fold.data.amplification.events) {
        expect(event.cause).toBe("restart-loop prefill re-pay");
      }
    } finally {
      removeRoot(root);
    }
  });
});
