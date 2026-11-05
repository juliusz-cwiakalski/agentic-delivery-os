/**
 * TC-DPLAN-016 — a declared interaction wins regardless of argument order; a
 * plain shared path is still deterministic and stable across replay.
 */
import { describe, expect, test } from "bun:test";
import { computePlanOverlap } from "../../packages/core/src/domain/plan-overlap";
import { planDocumentFor } from "../fixtures/plan/harness/index";

const consumer = planDocumentFor("GH-306", "overlap/ordering/interaction-a.yaml");
const producer = planDocumentFor("GH-307", "overlap/ordering/interaction-b.yaml");
const plainA = planDocumentFor("GH-308", "overlap/ordering/plain-a.yaml");
const plainB = planDocumentFor("GH-309", "overlap/ordering/plain-b.yaml");

describe("TC-DPLAN-016 declared ordering", () => {
  test("the producer is first in both argument orders", () => {
    const forward = computePlanOverlap({
      refA: "GH-306",
      planA: consumer,
      refB: "GH-307",
      planB: producer,
    });
    const reverse = computePlanOverlap({
      refA: "GH-307",
      planA: producer,
      refB: "GH-306",
      planB: consumer,
    });
    expect(forward.ordering).toBe("GH-307-before-GH-306");
    expect(reverse.ordering).toBe("GH-307-before-GH-306");
    expect(forward.reason).toBe("shared-contract-files");
    expect(reverse.reason).toBe("shared-contract-files");
  });

  test("a plain shared path is symmetric, stable, and uses shared-paths", () => {
    const forward = computePlanOverlap({
      refA: "GH-308",
      planA: plainA,
      refB: "GH-309",
      planB: plainB,
    });
    const reverse = computePlanOverlap({
      refA: "GH-309",
      planA: plainB,
      refB: "GH-308",
      planB: plainA,
    });
    expect(forward.ordering).toBe("GH-308-before-GH-309");
    expect(reverse.ordering).toBe("GH-308-before-GH-309");
    expect(forward.reason).toBe("shared-paths");
    expect(reverse.reason).toBe("shared-paths");
    expect(reverse.verdict).toBe(forward.verdict);
    expect(reverse.overlappingPaths).toEqual(forward.overlappingPaths);
    expect(JSON.stringify(computePlanOverlap({
      refA: "GH-308",
      planA: plainA,
      refB: "GH-309",
      planB: plainB,
    }))).toBe(JSON.stringify(forward));
  });
});
