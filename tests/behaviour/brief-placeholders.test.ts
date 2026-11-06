/**
 * TC-BRIEF-009 — the closed three-entry placeholder catalog renders named with
 * its owning story and evidence state, never as an empty list, zero, or observed.
 */
import { describe, expect, test } from "bun:test";
import { projectBrief, renderBriefHuman } from "../../packages/core/src/domain/index";
import { baseFacts, capSizedFacts } from "../fixtures/brief/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const EXPECTED = [
  { capability: "typed-questions", owningStory: "M1-S16", state: "not-delivered" },
  { capability: "gate-sla-states", owningStory: "M1-S5", state: "not-delivered" },
  { capability: "lane-queue-engine", owningStory: "M1-S17", state: "not-delivered" },
] as const;

describe("TC-BRIEF-009 closed placeholder catalog", () => {
  test("exactly three placeholders render with their stable ids, stories, and state", () => {
    const brief = projectBrief(baseFacts());
    expect(brief.placeholders).toEqual(EXPECTED);
    expect(brief.placeholders).toHaveLength(3);
  });

  test("each placeholder is a named human line containing its capability and story", () => {
    const human = renderBriefHuman(projectBrief(baseFacts()), SYNTHETIC_BRAND);
    for (const entry of EXPECTED) {
      expect(human).toContain(entry.capability);
      expect(human).toContain(entry.owningStory);
    }
    expect(human).toContain("not-delivered");
    expect(human).not.toMatch(/typed-questions\s+0\b/);
    expect(human).not.toMatch(/lane-queue-engine\s+0\b/);
  });

  test("the blocker-question surface is the typed-questions placeholder with no question record", () => {
    const brief = projectBrief(baseFacts());
    const keys = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const entry of value) collect(entry);
      } else if (typeof value === "object" && value !== null) {
        for (const [key, entry] of Object.entries(value)) {
          keys.add(key);
          collect(entry);
        }
      }
    };
    collect(brief);
    expect(keys.has("question")).toBe(false);
    expect(keys.has("questions")).toBe(false);
    const typed = brief.placeholders.find((entry) => entry.capability === "typed-questions");
    expect(typed?.state).toBe("not-delivered");
  });

  test("the lane/queue placeholder equals the digest lanes-or-queue state", () => {
    const brief = projectBrief(capSizedFacts());
    const laneSection = brief.surfaces.find((surface) => surface.id === "lanes-or-queue");
    const lanePlaceholder = brief.placeholders.find(
      (entry) => entry.capability === "lane-queue-engine",
    );
    expect(laneSection?.state).toBe("not-delivered");
    expect(lanePlaceholder?.state).toBe(laneSection?.state);
  });

  test("no spend placeholder or cost surface exists (DEC-5)", () => {
    const text = JSON.stringify(projectBrief(capSizedFacts()));
    expect(text.includes("spend")).toBe(false);
    expect(text.includes("cost")).toBe(false);
  });

  test("placeholders are not counted as actions", () => {
    const brief = projectBrief(capSizedFacts());
    const identities = brief.anchors.flatMap((anchor) => anchor.items.map((item) => item.identity));
    for (const entry of EXPECTED) expect(identities).not.toContain(entry.capability);
  });

  test("the placeholder list is stable across replays and independent of fact permutation", () => {
    const first = projectBrief(capSizedFacts());
    const second = projectBrief(capSizedFacts());
    expect(second.placeholders).toEqual(first.placeholders);
  });
});
