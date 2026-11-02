/** TC-VGATES-053 — pure evaluation stays within the 50 ms bound. */
import { describe, expect, test } from "bun:test";
import { evaluateVerifyGates } from "../../packages/core/src/domain/index";
import { baseFacts, clone, EXPECTED_JOBS, run } from "../fixtures/verify-gates/cases/facts";

describe("TC-VGATES-053 performance", () => {
  test("100 capped evaluations stay under the declared bound", () => {
    const facts = clone(baseFacts());
    facts.workflow = {
      outcome: "read",
      names: Array.from({ length: 200 }, (_, index) => `job-${index}`),
    };
    facts.checkRuns = {
      ok: true,
      value: {
        items: Array.from({ length: 100 }, (_, index) =>
          run(index < 23 ? (EXPECTED_JOBS[index] as string) : `extra-${index}`, "succeeded"),
        ),
        pageItemCount: 99,
      },
    };
    evaluateVerifyGates(facts);
    const start = performance.now();
    for (let index = 0; index < 100; index += 1) evaluateVerifyGates(facts);
    const elapsed = performance.now() - start;
    expect(elapsed / 100).toBeLessThan(50);
  });
});
