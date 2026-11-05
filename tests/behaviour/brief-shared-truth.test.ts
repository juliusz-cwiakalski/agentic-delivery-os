/**
 * TC-BRIEF-004 — same-facts shared truth: every digest-equal claim on the brief
 * equals the digest's claim, the placeholder catalog is exactly the closed set,
 * and no brief-only surface or capability exists.
 */
import { describe, expect, test } from "bun:test";
import {
  BRIEF_SURFACE_ORDER,
  type StatusSection,
  type StatusSectionId,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, projectBrief } from "../../packages/core/src/domain/index";
import { briefCases } from "../fixtures/brief/cases";

const sectionOf = (sections: readonly StatusSection[], id: StatusSectionId): StatusSection => {
  const section = sections.find((entry) => entry.id === id);
  if (section === undefined) throw new Error(`missing section ${id}`);
  return section;
};

describe("TC-BRIEF-004 shared truth over identical facts", () => {
  for (const testCase of briefCases) {
    test(`${testCase.name}: surfaces, counts, and truncation equal the digest`, () => {
      const brief = projectBrief(testCase.facts);
      const digest = aggregateStatus(testCase.facts);

      expect(brief.schemaVersion).toBe("delivery.brief.v1");
      expect(brief.generatedAt).toBe(digest.generatedAt);
      expect(brief.repository).toEqual(digest.repository);
      expect(brief.surfaces.map((surface) => surface.id)).toEqual([...BRIEF_SURFACE_ORDER]);

      for (const id of BRIEF_SURFACE_ORDER) {
        const surface = brief.surfaces.find((entry) => entry.id === id);
        if (surface === undefined) throw new Error(`missing brief surface ${id}`);
        const section = digest.sections.find((entry) => entry.id === id);
        if (section !== undefined) {
          expect(surface.state, `${testCase.name}:${id}`).toBe(section.state);
          expect(surface.counts, `${testCase.name}:${id}`).toEqual(section.counts);
          expect(surface.truncated, `${testCase.name}:${id}`).toBe(section.truncated);
        } else {
          expect(surface.state).toBe("not-delivered");
          expect(surface.counts).toEqual({ observed: 0, unknown: 0, total: 0, omitted: 0 });
          expect(surface.truncated).toBe(false);
        }
        const marker = brief.truncation.find((entry) => entry.target === id);
        expect(marker !== undefined, `${testCase.name}:${id} marker`).toBe(surface.truncated);
      }
    });

    test(`${testCase.name}: ready-to-merge cites only rendered digest items`, () => {
      const brief = projectBrief(testCase.facts);
      const digest = aggregateStatus(testCase.facts);
      const changes = sectionOf(digest.sections, "changes-and-prs");
      const rendered = changes.pullRequests ?? [];
      const anchor = brief.anchors.find((entry) => entry.group === "ready-to-merge");
      if (anchor === undefined) throw new Error("ready-to-merge group missing");
      for (const action of anchor.items) {
        const item = rendered.find((entry) => entry.entityId === action.identity);
        expect(item !== undefined, `${testCase.name}: ${action.identity} not rendered`).toBe(true);
        if (item === undefined) continue;
        expect(action.state).toBe(changes.state);
        expect(action.evidence).toEqual({
          kind: "pull-request",
          deliveryState: item.deliveryState,
          draft: item.draft,
          reviewState: item.reviewState,
        });
      }
    });

    test(`${testCase.name}: owner-gate ages cite rendered hand-back items only`, () => {
      const brief = projectBrief(testCase.facts);
      const digest = aggregateStatus(testCase.facts);
      const tracker = sectionOf(digest.sections, "tracker");
      const family = tracker.families?.find((entry) => entry.family === "ownerHandBacks");
      const anchor = brief.anchors.find((entry) => entry.group === "owner-gate-ages");
      if (anchor === undefined) throw new Error("owner-gate-ages group missing");
      const rendered = family?.items.map((item) => item.workItemRef) ?? [];
      for (const action of anchor.items) {
        expect(rendered).toContain(action.identity);
        expect(action.evidence.kind).toBe("owner-hand-back");
      }
      const marker = brief.truncation.find((entry) => entry.target === "owner-gate-ages");
      expect(marker !== undefined).toBe((family?.counts.omitted ?? 0) > 0);
    });

    test(`${testCase.name}: the placeholder set is the closed catalog`, () => {
      const brief = projectBrief(testCase.facts);
      expect(brief.placeholders.map((entry) => entry.capability)).toEqual([
        "typed-questions",
        "gate-sla-states",
        "lane-queue-engine",
      ]);
      for (const entry of brief.placeholders) expect(entry.state).toBe("not-delivered");
    });
  }
});
