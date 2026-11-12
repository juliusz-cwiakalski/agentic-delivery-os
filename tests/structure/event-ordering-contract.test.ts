/**
 * TC-EVT-031 (structure half) — the ordering declaration, the absence of any
 * order derived from `occurredAt` or `cursor`, and the page's gap/repoll text.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ORDERING_VALUES, TAXONOMY } from "../../packages/core/src/contracts/taxonomy";

const ROOT = process.cwd();
const PROJECTION = "packages/core/src/domain/event-projection.ts";
const PAGE = "doc/planning/oss-tooling/milestones/m2/commands/events.md";

describe("TC-EVT-031 ordering scope", () => {
  test("event topics declare sequence-per-lane and snapshot topics snapshot-revision", () => {
    expect([...ORDERING_VALUES]).toEqual(["sequence-per-lane", "snapshot-revision"]);
    for (const topic of TAXONOMY.topics) {
      expect(topic.ordering).toBe(
        topic.shape === "event" ? "sequence-per-lane" : "snapshot-revision",
      );
    }
  });

  test("the projection contains no sort or comparison on occurredAt and no cursor-derived order", () => {
    const text = readFileSync(join(ROOT, PROJECTION), "utf8");
    expect(text).not.toMatch(/sort\([^)]*occurredAt/u);
    expect(text).not.toMatch(/localeCompare\([^)]*occurredAt/u);
    expect(text).not.toMatch(/occurredAt\s*<|occurredAt\s*>/u);
    expect(text).not.toMatch(/\.cursor\b|\bcursor\s*:/u);
  });

  test("the page's ordering prose states the gap rule and the repoll remedy", () => {
    const text = readFileSync(join(ROOT, PAGE), "utf8");
    const start = text.indexOf("Ordering:");
    expect(start).toBeGreaterThanOrEqual(0);
    const ordering = text.slice(start, text.indexOf("Overflow:", start));
    expect(ordering).toContain("gap");
    expect(ordering).toContain("repoll");
    expect(ordering).toContain("sequence");
  });
});
