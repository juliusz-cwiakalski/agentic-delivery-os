/**
 * TC-BRIEF-020 — pure-projection performance and bounded work: cap-sized input
 * projects inside 50 ms, the timing instrument is live, and the projection is
 * non-vacuous over the same fact set as the read-cost baseline.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { projectBrief } from "../../packages/core/src/domain/index";
import { capSizedFacts } from "../fixtures/brief/harness";

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted[middle] ?? 0;
};

describe("TC-BRIEF-020 projection performance", () => {
  test("the median projection over cap-sized facts is within 50 ms", () => {
    const facts = capSizedFacts();
    projectBrief(facts);
    const samples: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const started = performance.now();
      projectBrief(facts);
      samples.push(performance.now() - started);
    }
    const value = median(samples);
    expect(
      value,
      `median=${value.toFixed(2)}ms bun=${Bun.version} platform=${process.platform}`,
    ).toBeLessThanOrEqual(50);
  });

  test("the timing instrument is live: a 10 ms busy loop measures at least 10 ms", () => {
    const started = performance.now();
    while (performance.now() - started < 10) {
      // busy wait
    }
    expect(performance.now() - started).toBeGreaterThanOrEqual(10);
  });

  test("the measurement is non-vacuous: every surface and both anchor groups exist", () => {
    const brief = projectBrief(capSizedFacts());
    expect(brief.surfaces).toHaveLength(9);
    expect(brief.placeholders).toHaveLength(2);
    expect(brief.anchors).toHaveLength(3);
    expect(brief.anchors.flatMap((anchor) => anchor.items).length).toBeGreaterThan(0);
  });

  test("the work is bounded rather than paginated or clock-driven", () => {
    const source = readFileSync("packages/core/src/domain/brief.ts", "utf8");
    expect(source).toContain("aggregateStatus(facts)");
    expect(source).not.toContain("per_page");
    expect(source).not.toContain("while (true)");
    expect(source).not.toContain("Date.now");
    expect(source).not.toContain("setTimeout");
  });
});
