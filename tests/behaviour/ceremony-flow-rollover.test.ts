/**
 * TC-CEREMONY-018 — a sprint rollover with carry-over work renders every entry
 * with its ref, a reason from the closed set, and its next milestone.
 */
import { describe, expect, test } from "bun:test";
import { CEREMONY_CARRY_OVER_REASONS } from "../../packages/core/src/contracts/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

const rolloverOf = (harness: ReturnType<typeof prepareBuiltin>["harness"]) => {
  for (const content of harness.artifactContents.values()) {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.schemaId === "delivery.ceremony.rollover.v1") return parsed;
  }
  return undefined;
};

describe("TC-CEREMONY-018 rollover carry-over entries are complete", () => {
  test("each entry names its ref, a closed-set reason, and its next milestone", () => {
    const prepared = prepareBuiltin("sprint-rollover");
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (run.ok) expect(run.data.verdict).toBe("verified");
      const report = rolloverOf(prepared.harness);
      const entries = report?.entries as {
        ref: string;
        reason: string;
        nextMilestone: string;
      }[];
      expect(entries).toHaveLength(2);
      for (const entry of entries) {
        expect(entry.ref.length).toBeGreaterThan(0);
        expect(CEREMONY_CARRY_OVER_REASONS).toContain(entry.reason as never);
        expect(entry.nextMilestone.length).toBeGreaterThan(0);
      }
      expect(entries.map((entry) => entry.ref)).toEqual(["GH-101", "GH-102"]);
    } finally {
      prepared.harness.dispose();
    }
  });
});
