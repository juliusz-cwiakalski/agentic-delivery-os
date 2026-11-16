/**
 * TC-CEREMONY-015 — a testing-session assessment gives every note item exactly
 * one verdict from the closed set, the unassessed count is zero, and an item
 * citing no evidence is `uncovered`.
 */
import { describe, expect, test } from "bun:test";
import { CEREMONY_ASSESS_VERDICTS } from "../../packages/core/src/contracts/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

describe("TC-CEREMONY-015 every note item carries exactly one verdict", () => {
  test("an item without a citation is uncovered and the unassessed count is zero", () => {
    const prepared = prepareBuiltin("testing-session-assessment", {
      ownerNoteItems: [
        { text: "covered item", evidenceRef: "evidence:one" },
        { text: "uncited item" },
        { text: "covered item two", evidenceRef: "evidence:two" },
      ],
    });
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (run.ok) expect(run.data.verdict).toBe("verified");
      const assessment = prepared.harness.artifactWrites
        .map((entry) => JSON.parse(entry.slice(entry.indexOf(":") + 1)) as Record<string, unknown>)
        .find((document) => document.schemaId === "delivery.ceremony.assessment.v1");
      expect(assessment).toBeDefined();
      const items = assessment?.items as { item: string; verdict: string; evidenceRef?: string }[];
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(CEREMONY_ASSESS_VERDICTS).toContain(item.verdict as never);
      }
      const uncited = items.find((item) => item.item === "uncited item");
      expect(uncited?.verdict).toBe("uncovered");
      expect(assessment?.unassessedCount).toBe(0);
    } finally {
      prepared.harness.dispose();
    }
  });
});
