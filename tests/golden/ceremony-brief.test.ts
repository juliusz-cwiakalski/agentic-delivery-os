/**
 * TC-CEREMONY-013 (golden half) — the morning brief render is deterministic:
 * identical injected inputs produce byte-identical payloads, with the closed
 * surface, anchor, and placeholder sets in declared order.
 */
import { describe, expect, test } from "bun:test";
import {
  BRIEF_ANCHOR_GROUPS,
  BRIEF_PLACEHOLDER_CATALOG,
  BRIEF_SURFACE_ORDER,
} from "../../packages/core/src/contracts/index";
import { projectBrief } from "../../packages/core/src/domain/index";
import { baseFacts } from "../fixtures/brief/harness";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

const briefText = (harness: ReturnType<typeof prepareBuiltin>["harness"]): string => {
  for (const content of harness.artifactContents.values()) {
    if ((JSON.parse(content) as { schemaId?: string }).schemaId === "delivery.brief.v1") {
      return content;
    }
  }
  throw new Error("brief artifact missing");
};

describe("golden: the morning brief payload", () => {
  test("is byte-identical across two independent runs", () => {
    const first = prepareBuiltin("morning-brief");
    const second = prepareBuiltin("morning-brief");
    try {
      expect(runPrepared(first).ok).toBe(true);
      expect(runPrepared(second).ok).toBe(true);
      expect(briefText(first.harness)).toBe(briefText(second.harness));
    } finally {
      first.harness.dispose();
      second.harness.dispose();
    }
  });

  test("carries the declared closed sets in order", () => {
    const prepared = prepareBuiltin("morning-brief");
    try {
      const facts = baseFacts();
      prepared.harness.scriptInput("status-facts", { state: "present", facts });
      expect(runPrepared(prepared).ok).toBe(true);
      const brief = JSON.parse(briefText(prepared.harness)) as {
        surfaces: { id: string; state: string }[];
        anchorGroups: { id: string }[];
        placeholders: unknown[];
      };
      expect(brief.surfaces.map((surface) => surface.id)).toEqual([...BRIEF_SURFACE_ORDER]);
      expect(brief.anchorGroups.map((group) => group.id)).toEqual([...BRIEF_ANCHOR_GROUPS]);
      expect(brief.placeholders).toEqual([...BRIEF_PLACEHOLDER_CATALOG]);
      expect(brief.surfaces).toEqual(projectBrief(facts).surfaces as never);
    } finally {
      prepared.harness.dispose();
    }
  });
});
