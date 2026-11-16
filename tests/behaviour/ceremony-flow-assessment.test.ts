/**
 * TC-CEREMONY-015 — a testing-session assessment gives every note item exactly
 * one verdict from the closed set, the unassessed count is zero, and an item
 * citing no evidence is `uncovered`.
 */
import { describe, expect, test } from "bun:test";
import { CEREMONY_ASSESS_VERDICTS } from "../../packages/core/src/contracts/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

describe("TC-CEREMONY-015 every note item carries exactly one verdict", () => {
  test("a resolved citation is covered, an uncited item and an unresolvable citation are uncovered", () => {
    const prepared = prepareBuiltin("testing-session-assessment", {
      noteOverrides: {
        facts: [
          { text: "covered item", evidenceRef: "evidence:one" },
          { text: "uncited item" },
          { text: "unresolvable item", evidenceRef: "evidence:missing" },
          { text: "covered item two", evidenceRef: "evidence:two" },
        ],
        evidenceRefs: ["evidence:one", "evidence:two"],
      },
    });
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (run.ok) expect(run.data.verdict).toBe("verified");
      const assessment = prepared.harness.artifactWrites
        .map((entry) => JSON.parse(entry.slice(entry.indexOf(":") + 1)) as Record<string, unknown>)
        .find((document) => document.schemaId === "delivery.ceremony.assessment.v1");
      expect(assessment).toBeDefined();
      const items = assessment?.items as {
        item: string;
        verdict: string;
        evidenceRef?: string;
        reason?: string;
      }[];
      expect(items).toHaveLength(4);
      for (const item of items) {
        expect(CEREMONY_ASSESS_VERDICTS).toContain(item.verdict as never);
      }
      const byItem = new Map(items.map((item) => [item.item, item]));
      expect(byItem.get("covered item")?.verdict).toBe("covered");
      expect(byItem.get("covered item two")?.verdict).toBe("covered");
      const uncited = byItem.get("uncited item");
      expect(uncited?.verdict).toBe("uncovered");
      expect(uncited?.evidenceRef).toBeUndefined();
      const unresolvable = byItem.get("unresolvable item");
      expect(unresolvable?.verdict).toBe("uncovered");
      expect(unresolvable?.evidenceRef).toBe("evidence:missing");
      expect(unresolvable?.reason).toContain("is not delivered");
      expect(assessment?.unassessedCount).toBe(0);
    } finally {
      prepared.harness.dispose();
    }
  });
});
