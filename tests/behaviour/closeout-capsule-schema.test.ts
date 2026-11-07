/** TC-CAP-017 — candidate schema and closed vocabularies. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

describe("TC-CAP-017 candidate schema", () => {
  test("a valid fact candidate is a sanctioned handoff", async () => {
    const run = await runPromotionCloseout({
      candidates: { "fact-one.yaml": candidateYaml({ id: "fact-one", class: "fact" }) },
    });
    try {
      expect(run.exitCode).toBe(0);
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates).toEqual([{ id: "fact-one", decision: "promoted", home: "doc/spec/**" }]);
    } finally {
      run.cleanup();
    }
  });

  for (const [label, overrides] of [
    ["out-of-set scope", { scope: "galaxy" }],
    ["unknown status", { status: "approved" }],
    ["malformed evidence", { evidence: "looks-like-evidence" }],
    ["missing required key", { source: undefined }],
    ["id outside the slug shape", { id: "Bad_ID" }],
    ["class outside the closed set", { class: "galaxy" }],
  ] as const) {
    test(`${label} is closeout.capsule-invalid`, async () => {
      const run = await runPromotionCloseout({
        candidates: { "bad.yaml": candidateYaml(overrides as Record<string, unknown>) },
      });
      try {
        expect(run.exitCode).toBe(1);
        expect(run.error?.code).toBe("closeout.capsule-invalid");
      } finally {
        run.cleanup();
      }
    });
  }
});
