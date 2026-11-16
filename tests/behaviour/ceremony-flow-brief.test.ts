/**
 * TC-CEREMONY-013 — the morning brief artifact conforms to `delivery.brief.v1`
 * with ten surfaces, three anchor groups, and the closed placeholder catalog.
 */
import { describe, expect, test } from "bun:test";
import {
  BRIEF_ANCHOR_GROUPS,
  BRIEF_PLACEHOLDER_CATALOG,
  BRIEF_SURFACE_ORDER,
} from "../../packages/core/src/contracts/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

const briefOf = (
  harness: ReturnType<typeof prepareBuiltin>["harness"],
): Record<string, unknown> => {
  for (const content of harness.artifactContents.values()) {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (parsed.schemaId === "delivery.brief.v1") return parsed;
  }
  throw new Error("brief artifact missing");
};

describe("TC-CEREMONY-013 the morning brief conforms to delivery.brief.v1", () => {
  test("ten surfaces, three anchor groups, and the closed placeholder catalog", () => {
    const prepared = prepareBuiltin("morning-brief");
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (run.ok) expect(run.data.verdict).toBe("verified");
      const brief = briefOf(prepared.harness);
      const surfaces = brief.surfaces as { id: string }[];
      expect(surfaces.map((surface) => surface.id)).toEqual([...BRIEF_SURFACE_ORDER]);
      const anchors = brief.anchorGroups as { id: string }[];
      expect(anchors.map((anchor) => anchor.id)).toEqual([...BRIEF_ANCHOR_GROUPS]);
      expect(brief.placeholders).toEqual([...BRIEF_PLACEHOLDER_CATALOG]);
    } finally {
      prepared.harness.dispose();
    }
  });

  test("the same inputs render a byte-identical artifact", () => {
    const first = prepareBuiltin("morning-brief");
    const second = prepareBuiltin("morning-brief");
    try {
      expect(runPrepared(first).ok).toBe(true);
      expect(runPrepared(second).ok).toBe(true);
      expect(briefOf(second.harness)).toEqual(briefOf(first.harness));
      expect(JSON.stringify(briefOf(second.harness))).toBe(JSON.stringify(briefOf(first.harness)));
    } finally {
      first.harness.dispose();
      second.harness.dispose();
    }
  });
});
