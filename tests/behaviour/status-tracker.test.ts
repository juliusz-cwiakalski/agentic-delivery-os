/**
 * TC-STATUS-009..012 — tracker families over normalized WorkItem data:
 * labels-only owner hand-backs, blocked-dependency availability/targets,
 * injected-clock stalls, and title/label hygiene.
 */
import { describe, expect, test } from "bun:test";
import type {
  StatusFacts,
  StatusTrackerFamily,
  StatusWorkItemRead,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import {
  ALL_AVAILABLE,
  baseFacts,
  blockedBy,
  GITHUB_SLICE_AVAILABILITY,
  makeWorkItem,
  sectionById,
  workItemRead,
} from "../fixtures/status/harness";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-31T00:00:00Z");

const family = (
  facts: StatusFacts,
  id: "ownerHandBacks" | "blockedDependencies" | "stalls" | "hygiene",
): StatusTrackerFamily => {
  const tracker = sectionById(aggregateStatus(facts).sections, "tracker");
  const found = tracker.families?.find((entry) => entry.family === id);
  if (found === undefined) throw new Error(`family ${id} is missing`);
  return found;
};

const trackerFacts = (read: StatusWorkItemRead, nowMs = NOW): StatusFacts =>
  baseFacts({ tracker: read, nowMs });

const ids = (items: readonly { readonly workItemRef: string }[]): string[] =>
  items.map((item) => item.workItemRef);

describe("TC-STATUS-009 owner hand-backs are labels-only", () => {
  test("attention labels are listed; absent assignee is not unassigned", () => {
    const facts = trackerFacts(
      workItemRead([
        makeWorkItem({ entityId: "1", labels: ["hand-back"] }),
        makeWorkItem({ entityId: "2", labels: ["HUMAN-INPUT-NEEDED"] }),
        makeWorkItem({ entityId: "3", labels: ["tracker"] }),
        makeWorkItem({ entityId: "4", labels: ["hand-back"], deliveryState: "done" }),
        makeWorkItem({ entityId: "5", title: "", labels: ["hand-back"] }),
      ]),
    );
    const handBacks = family(facts, "ownerHandBacks");
    expect(ids(handBacks.items)).toEqual(["1", "5", "2"]);
    for (const item of handBacks.items) {
      expect(JSON.stringify(item)).not.toContain("unassigned");
    }
    expect(ids(handBacks.items)).not.toContain("3");
    expect(ids(handBacks.items)).not.toContain("4");
  });

  test("removing the label drops the item (the label is the predicate)", () => {
    const withLabel = workItemRead([makeWorkItem({ entityId: "10", labels: ["hand-back"] })]);
    const withoutLabel = workItemRead([makeWorkItem({ entityId: "10", labels: [] })]);
    expect(ids(family(trackerFacts(withLabel), "ownerHandBacks").items)).toEqual(["10"]);
    expect(family(trackerFacts(withoutLabel), "ownerHandBacks").items).toEqual([]);
  });

  test("the family is capped at four with omitted recorded", () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      makeWorkItem({ entityId: String(20 + index), labels: ["hand-back"] }),
    );
    const handBacks = family(trackerFacts(workItemRead(items)), "ownerHandBacks");
    expect(handBacks.items).toHaveLength(4);
    expect(handBacks.counts.omitted).toBe(1);
  });
});

describe("TC-STATUS-010 blocked dependencies", () => {
  test("GitHub unavailable is not an observed-empty family", () => {
    const facts = trackerFacts(
      workItemRead(
        [makeWorkItem({ entityId: "1", relations: [blockedBy("2")] })],
        GITHUB_SLICE_AVAILABILITY,
      ),
    );
    const blocked = family(facts, "blockedDependencies");
    expect(blocked.state).toBe("unavailable");
    expect(blocked.reason).toBe("signal-unavailable");
    expect(blocked.items).toEqual([]);
    expect(blocked.counts.total).toBe(0);
    expect(sectionById(aggregateStatus(facts).sections, "tracker").state).toBe("degraded");
  });

  test("Jira-shaped targets distinguish done/canceled, open, and unknown", () => {
    const facts = trackerFacts(
      workItemRead(
        [
          makeWorkItem({ entityId: "10", relations: [blockedBy("11")] }),
          makeWorkItem({ entityId: "11", deliveryState: "done" }),
          makeWorkItem({ entityId: "20", relations: [blockedBy("12")] }),
          makeWorkItem({ entityId: "12", deliveryState: "canceled" }),
          makeWorkItem({ entityId: "30", relations: [blockedBy("13")] }),
          makeWorkItem({ entityId: "13", deliveryState: "ready" }),
          makeWorkItem({ entityId: "40", relations: [blockedBy("14")] }),
        ],
        ALL_AVAILABLE,
      ),
    );
    const blocked = family(facts, "blockedDependencies");
    expect(ids(blocked.items)).toEqual(["40", "30"]);
    expect(blocked.items[0]?.dependencyState).toBe("unknown");
    expect(blocked.items[1]?.dependencyState).toBe("open");
    expect(ids(blocked.items)).not.toContain("10");
    expect(ids(blocked.items)).not.toContain("20");
  });
});

describe("TC-STATUS-011 stalls use the injected clock", () => {
  const at = (daysAgo: number): string =>
    new Date(NOW - daysAgo * DAY).toISOString().replace(".000Z", "Z");

  test("15-day items stall, 14-day and 13-day items do not", () => {
    const facts = trackerFacts(
      workItemRead([
        makeWorkItem({ entityId: "1", updatedAt: at(15) }),
        makeWorkItem({ entityId: "2", updatedAt: at(14) }),
        makeWorkItem({ entityId: "3", updatedAt: at(13) }),
      ]),
    );
    const stalls = family(facts, "stalls");
    expect(ids(stalls.items)).toEqual(["1"]);
    expect(stalls.items[0]?.activity).toBe("stalled");
    expect(stalls.items[0]?.ageDays).toBe(15);
  });

  test("absent and invalid updatedAt are unknown activity with no age", () => {
    const facts = trackerFacts(
      workItemRead([
        makeWorkItem({ entityId: "4" }),
        makeWorkItem({ entityId: "5", updatedAt: "not-a-date" }),
        makeWorkItem({ entityId: "6" }),
      ]),
    );
    const stalls = family(facts, "stalls");
    expect(ids(stalls.items)).toEqual(["4", "5", "6"]);
    for (const item of stalls.items) {
      expect(item.activity).toBe("unknown");
      expect(item.itemState).toBe("unknown");
      expect(item.ageDays).toBeUndefined();
    }
    expect(stalls.counts.unknown).toBe(3);
  });

  test("advancing the injected clock moves the threshold deterministically", () => {
    const read = workItemRead([makeWorkItem({ entityId: "7", updatedAt: at(14) })]);
    expect(family(trackerFacts(read), "stalls").items).toEqual([]);
    const tomorrow = NOW + DAY;
    expect(ids(family(trackerFacts(read, tomorrow), "stalls").items)).toEqual(["7"]);
  });

  test("oldest stalled first, unknown last, capped at four", () => {
    const facts = trackerFacts(
      workItemRead([
        makeWorkItem({ entityId: "10", updatedAt: at(20) }),
        makeWorkItem({ entityId: "11", updatedAt: at(30) }),
        makeWorkItem({ entityId: "12" }),
        makeWorkItem({ entityId: "13", updatedAt: at(40) }),
        makeWorkItem({ entityId: "14", updatedAt: at(25) }),
      ]),
    );
    const stalls = family(facts, "stalls");
    expect(ids(stalls.items)).toEqual(["13", "11", "14", "10"]);
    expect(stalls.counts.omitted).toBe(1);
  });
});

describe("TC-STATUS-012 hygiene checks title and labels only", () => {
  test("findings are exactly missing-title and missing-labels", () => {
    const facts = trackerFacts(
      workItemRead([
        makeWorkItem({ entityId: "1", title: "", labels: ["tracker"] }),
        makeWorkItem({ entityId: "2", title: "Item 2", labels: [] }),
        makeWorkItem({ entityId: "3", title: "", labels: [] }),
        makeWorkItem({ entityId: "4", title: "Conforming", labels: ["tracker"] }),
        makeWorkItem({ entityId: "5", title: "Comments present", labels: ["tracker"] }),
      ]),
    );
    const hygiene = family(facts, "hygiene");
    expect(hygiene.items.map((item) => [item.workItemRef, item.findings])).toEqual([
      ["3", ["missing-title", "missing-labels"]],
      ["1", ["missing-title"]],
      ["2", ["missing-labels"]],
    ]);
    expect(ids(hygiene.items)).not.toContain("4");
    expect(ids(hygiene.items)).not.toContain("5");
  });

  test("a conforming set yields zero findings", () => {
    const facts = trackerFacts(
      workItemRead([makeWorkItem({ entityId: "1", title: "Conforming", labels: ["tracker"] })]),
    );
    expect(family(facts, "hygiene").items).toEqual([]);
  });
});
