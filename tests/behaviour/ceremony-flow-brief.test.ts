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
import { projectBrief } from "../../packages/core/src/domain/index";
import { baseFacts, makeWorkItem, workItemRead } from "../fixtures/brief/harness";
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

type BriefSurfaceShape = {
  readonly id: string;
  readonly state: string;
  readonly counts: { readonly total: number };
};

const surfacesOf = (brief: Record<string, unknown>): readonly BriefSurfaceShape[] =>
  (brief.surfaces ?? []) as readonly BriefSurfaceShape[];

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

  test("present status facts are projected, not replaced by fabricated zeros", () => {
    const prepared = prepareBuiltin("morning-brief");
    try {
      const facts = baseFacts({
        tracker: workItemRead([makeWorkItem({ entityId: "GH-101", title: "A tracked item" })]),
      });
      prepared.harness.scriptInput("status-facts", { state: "present", facts });
      expect(runPrepared(prepared).ok).toBe(true);
      const brief = briefOf(prepared.harness);
      const expected = projectBrief(facts);
      expect(brief.surfaces).toEqual(expected.surfaces as never);
      const surfaces = surfacesOf(brief);
      expect(surfaces.find((surface) => surface.id === "tracker")?.counts.total).toBeGreaterThan(0);
      expect(surfaces.some((surface) => surface.counts.total > 0)).toBe(true);
      expect(surfaces.every((surface) => surface.state !== "present")).toBe(true);
    } finally {
      prepared.harness.dispose();
    }
  });

  test("a delivered brief projection is reused as the artifact payload", () => {
    const prepared = prepareBuiltin("morning-brief");
    try {
      const projection = projectBrief(baseFacts());
      prepared.harness.scriptInput("brief-projection", {
        state: "present",
        facts: projection as unknown as Record<string, unknown>,
      });
      expect(runPrepared(prepared).ok).toBe(true);
      const brief = briefOf(prepared.harness);
      expect(brief.surfaces).toEqual(projection.surfaces as never);
      expect(brief.placeholders).toEqual([...BRIEF_PLACEHOLDER_CATALOG]);
    } finally {
      prepared.harness.dispose();
    }
  });

  test("a present source whose facts carry no projection renders unknown, never a zero claim", () => {
    const prepared = prepareBuiltin("morning-brief");
    try {
      expect(runPrepared(prepared).ok).toBe(true);
      const surfaces = surfacesOf(briefOf(prepared.harness));
      const tracker = surfaces.find((surface) => surface.id === "tracker");
      expect(tracker?.state).toBe("unknown");
      const observedZero = surfaces.filter(
        (surface) => surface.state === "observed" && surface.counts.total === 0,
      );
      expect(observedZero).toEqual([]);
      expect(surfaces.every((surface) => surface.state !== "present")).toBe(true);
    } finally {
      prepared.harness.dispose();
    }
  });
});
