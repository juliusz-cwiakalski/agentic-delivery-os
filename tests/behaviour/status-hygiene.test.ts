/**
 * TC-ATT-011 / 012 / 013 / 041 — the three named hygiene assertions with
 * tri-state counts, absence-as-violation, the availability gate, and the
 * satisfied arm.
 */
import { describe, expect, test } from "bun:test";
import {
  STATUS_HYGIENE_ASSERTIONS,
  STATUS_HYGIENE_LABEL_CONVENTIONS,
  type StatusFacts,
  type StatusHygieneAssertion,
  type StatusTrackerFamily,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import {
  ALL_AVAILABLE,
  ASSERTIONS_AVAILABLE,
  baseFacts,
  MIXED_ASSERTIONS,
  makeWorkItem,
  sectionById,
  workItemRead,
} from "../fixtures/status/harness";

const trackerOf = (facts: StatusFacts) => sectionById(aggregateStatus(facts).sections, "tracker");

const hygieneOf = (facts: StatusFacts): StatusTrackerFamily => {
  const family = trackerOf(facts).families?.find((entry) => entry.family === "hygiene");
  if (family === undefined) throw new Error("hygiene family missing");
  return family;
};

const assertionOf = (facts: StatusFacts, id: string): StatusHygieneAssertion => {
  const found = hygieneOf(facts).assertions?.find((entry) => entry.assertion === id);
  if (found === undefined) throw new Error(`assertion ${id} missing`);
  return found;
};

const assertionFinding = (facts: StatusFacts, id: string) =>
  trackerOf(facts).findings?.find((finding) => finding.code === `tracker.hygiene.${id}`);

const factsWith = (
  items: ReturnType<typeof makeWorkItem>[],
  availability = ASSERTIONS_AVAILABLE,
): StatusFacts => baseFacts({ tracker: workItemRead(items, availability) });

const triStatePopulation = () => [
  makeWorkItem({
    entityId: "1",
    title: "Missing title",
    labels: ["epic:x", "points:3"],
    milestone: "Sprint 1",
  }),
  makeWorkItem({
    entityId: "2",
    title: "No epic",
    labels: ["bug", "points:2"],
    milestone: "Sprint 1",
  }),
  makeWorkItem({ entityId: "3", title: "No points", labels: ["epic:x"], milestone: "Sprint 1" }),
  makeWorkItem({ entityId: "4", title: "No sprint", labels: ["epic:x", "points:1"] }),
  makeWorkItem({
    entityId: "5",
    title: "All good",
    labels: ["epic", "points:0"],
    milestone: "Sprint 1",
  }),
  makeWorkItem({
    entityId: "6",
    title: "Also good",
    labels: ["epic:payments", "points:5"],
    milestone: "Sprint 2",
  }),
  makeWorkItem({ entityId: "7", title: "Closed", labels: [], deliveryState: "done" }),
  makeWorkItem({ entityId: "8", title: "Canceled", labels: [], deliveryState: "canceled" }),
];

describe("TC-ATT-011 three named hygiene assertions with tri-state counts", () => {
  test("the assertions are declared in order with tri-state counts", () => {
    const assertions = hygieneOf(factsWith(triStatePopulation())).assertions ?? [];
    expect(assertions.map((entry) => entry.assertion)).toEqual([
      "epic-membership",
      "story-points",
      "in-sprint",
    ]);
    expect(STATUS_HYGIENE_ASSERTIONS).toEqual(["epic-membership", "story-points", "in-sprint"]);
  });

  test("counts sum to the open population and exclude closed/canceled items", () => {
    const facts = factsWith(triStatePopulation());
    for (const entry of hygieneOf(facts).assertions ?? []) {
      expect(entry.violations + entry.unknown + entry.satisfied).toBe(6);
      expect(entry.unknown).toBe(0);
    }
    expect(assertionOf(facts, "epic-membership")).toEqual({
      assertion: "epic-membership",
      violations: 1,
      unknown: 0,
      satisfied: 5,
    });
    expect(assertionOf(facts, "story-points")).toEqual({
      assertion: "story-points",
      violations: 1,
      unknown: 0,
      satisfied: 5,
    });
    expect(assertionOf(facts, "in-sprint")).toEqual({
      assertion: "in-sprint",
      violations: 1,
      unknown: 0,
      satisfied: 5,
    });
  });

  test("violations group into their codes with exact counts and members", () => {
    const facts = factsWith(triStatePopulation());
    expect(assertionFinding(facts, "epic-membership")).toMatchObject({
      count: 1,
      members: ["2"],
      severity: "low",
      evidenceRef: "2",
    });
    expect(assertionFinding(facts, "story-points")?.members).toEqual(["3"]);
    expect(assertionFinding(facts, "in-sprint")?.members).toEqual(["4"]);
  });

  test("counts aggregate before the four-item render cap", () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      makeWorkItem({
        entityId: String(100 + index),
        title: "No epic",
        labels: ["points:1"],
        milestone: "Sprint 1",
      }),
    );
    const facts = factsWith(items);
    expect(assertionOf(facts, "epic-membership").violations).toBe(8);
    expect(hygieneOf(facts).items.length).toBeLessThanOrEqual(4);
  });

  test("all-violating, all-conforming, and observed-empty populations", () => {
    const violating = factsWith(
      Array.from({ length: 3 }, (_, index) =>
        makeWorkItem({ entityId: String(200 + index), title: "None", labels: [] }),
      ),
    );
    expect(assertionOf(violating, "epic-membership")).toMatchObject({
      violations: 3,
      unknown: 0,
      satisfied: 0,
    });

    const conforming = factsWith([
      makeWorkItem({ entityId: "1", labels: ["epic:x", "points:1"], milestone: "Sprint 1" }),
    ]);
    expect(assertionOf(conforming, "epic-membership")).toMatchObject({
      violations: 0,
      unknown: 0,
      satisfied: 1,
    });

    const empty = factsWith([]);
    for (const entry of hygieneOf(empty).assertions ?? []) {
      expect(entry).toMatchObject({ violations: 0, unknown: 0, satisfied: 0 });
    }
  });
});

describe("TC-ATT-012 absence-as-violation by name", () => {
  const epicCases: Array<[readonly string[], boolean]> = [
    [[], false],
    [["bug", "m1"], false],
    [["epics"], false],
    [["epic"], true],
    [["epic:payments"], true],
  ];
  for (const [labels, satisfied] of epicCases) {
    test(`epic labels ${JSON.stringify(labels)} are ${satisfied ? "satisfied" : "violating"}`, () => {
      const facts = factsWith([
        makeWorkItem({
          entityId: "1",
          labels: [...labels, "points:1"],
          milestone: "Sprint 1",
        }),
      ]);
      expect(assertionOf(facts, "epic-membership").violations).toBe(satisfied ? 0 : 1);
      expect(assertionOf(facts, "epic-membership").satisfied).toBe(satisfied ? 1 : 0);
      expect(assertionFinding(facts, "epic-membership") === undefined).toBe(satisfied);
    });
  }

  const pointsCases: Array<[readonly string[], boolean]> = [
    [[], false],
    [["points:"], false],
    [["points:abc"], false],
    [["points:-1"], false],
    [["points:3.5"], false],
    [["points"], false],
    [["points:0"], true],
    [["points:5"], true],
  ];
  for (const [pointLabels, satisfied] of pointsCases) {
    test(`points labels ${JSON.stringify(pointLabels)} are ${satisfied ? "satisfied" : "violating"}`, () => {
      const facts = factsWith([
        makeWorkItem({
          entityId: "1",
          labels: ["epic:x", ...pointLabels],
          milestone: "Sprint 1",
        }),
      ]);
      expect(assertionOf(facts, "story-points").violations).toBe(satisfied ? 0 : 1);
      expect(assertionOf(facts, "story-points").satisfied).toBe(satisfied ? 1 : 0);
    });
  }

  const sprintCases: Array<[string | undefined, boolean]> = [
    [undefined, false],
    ["", false],
    ["   ", false],
    ["Sprint 1", true],
  ];
  for (const [milestone, satisfied] of sprintCases) {
    test(`milestone ${JSON.stringify(milestone)} is ${satisfied ? "satisfied" : "violating"}`, () => {
      const facts = factsWith([
        makeWorkItem({
          entityId: "1",
          labels: ["epic:x", "points:1"],
          ...(milestone === undefined ? {} : { milestone }),
        }),
      ]);
      expect(assertionOf(facts, "in-sprint").violations).toBe(satisfied ? 0 : 1);
      expect(assertionOf(facts, "in-sprint").satisfied).toBe(satisfied ? 1 : 0);
    });
  }

  test("an item failing two conventions appears in two findings", () => {
    const facts = factsWith([
      makeWorkItem({ entityId: "1", title: "No epic or points", labels: ["tracker"] }),
    ]);
    expect(assertionFinding(facts, "epic-membership")?.members).toEqual(["1"]);
    expect(assertionFinding(facts, "story-points")?.members).toEqual(["1"]);
    expect(assertionFinding(facts, "in-sprint")?.members).toEqual(["1"]);
  });

  test("titles, assignees, and unrelated labels never decide the assertion", () => {
    const base = [
      makeWorkItem({ entityId: "1", title: "No epic", labels: ["points:1"], milestone: "Sprint" }),
    ];
    const mutated = [
      makeWorkItem({
        entityId: "1",
        title: "points:5 epic:payments",
        labels: ["points:1"],
        assignee: "someone",
        milestone: "Sprint",
      }),
    ];
    expect(assertionOf(factsWith(mutated), "epic-membership")).toEqual(
      assertionOf(factsWith(base), "epic-membership"),
    );
    expect(STATUS_HYGIENE_LABEL_CONVENTIONS.epicToken).toBe("epic");
  });
});

describe("TC-ATT-013 undeclared signal is all-unknown, never a violation", () => {
  const undeclaredPopulation = () => [
    makeWorkItem({ entityId: "1", title: "No epic", labels: ["bug"], milestone: "Sprint" }),
    makeWorkItem({ entityId: "2", title: "No points", labels: ["epic:x"], milestone: "Sprint" }),
    makeWorkItem({ entityId: "3", title: "No sprint", labels: ["epic:x", "points:1"] }),
  ];

  test("all three undeclared yields unknown = population and zero violations", () => {
    const facts = factsWith(undeclaredPopulation(), ALL_AVAILABLE);
    for (const entry of hygieneOf(facts).assertions ?? []) {
      expect(entry.violations).toBe(0);
      expect(entry.unknown).toBe(3);
      expect(entry.satisfied).toBe(0);
    }
    expect(trackerOf(facts).findings ?? []).toEqual([]);
  });

  test("the mixed case evaluates declared assertions independently", () => {
    const facts = factsWith(undeclaredPopulation(), MIXED_ASSERTIONS);
    expect(assertionOf(facts, "epic-membership")).toMatchObject({ violations: 1, unknown: 0 });
    expect(assertionOf(facts, "story-points")).toMatchObject({ violations: 2, unknown: 0 });
    expect(assertionOf(facts, "in-sprint")).toMatchObject({
      violations: 0,
      unknown: 3,
      satisfied: 0,
    });
    expect(assertionFinding(facts, "in-sprint")).toBeUndefined();
  });

  test("the GitHub slice declares all three signals available and evaluates them", () => {
    const facts = factsWith(undeclaredPopulation(), ASSERTIONS_AVAILABLE);
    expect(assertionOf(facts, "in-sprint").unknown).toBe(0);
    expect(assertionFinding(facts, "in-sprint")?.count).toBe(1);
  });

  test("restoring availability converts unknown into violation/satisfied counts", () => {
    const undeclared = factsWith(undeclaredPopulation(), ALL_AVAILABLE);
    const restored = factsWith(undeclaredPopulation(), ASSERTIONS_AVAILABLE);
    expect(assertionOf(undeclared, "epic-membership").unknown).toBe(3);
    expect(assertionOf(restored, "epic-membership").violations).toBe(1);
    expect(assertionOf(restored, "epic-membership").satisfied).toBe(2);
  });

  test("an empty population stays distinguishable from undeclared non-empty", () => {
    const empty = factsWith([], ASSERTIONS_AVAILABLE);
    const undeclared = factsWith(undeclaredPopulation(), ALL_AVAILABLE);
    expect(assertionOf(empty, "epic-membership")).toMatchObject({
      violations: 0,
      unknown: 0,
      satisfied: 0,
    });
    expect(assertionOf(undeclared, "epic-membership").unknown).toBe(3);
  });
});

describe("TC-ATT-041 satisfied arm is silent", () => {
  const conformingCases = [
    { labels: ["epic", "points:1"], milestone: "Sprint 1" },
    { labels: ["epic:payments", "points:1"], milestone: "Sprint 1" },
    { labels: ["epic:x", "points:0"], milestone: "Sprint 1" },
    { labels: ["epic:x", "points:1"], milestone: "Sprint 1" },
    { labels: ["epic:x", "points:42"], milestone: "Sprint 1" },
  ];

  for (const input of conformingCases) {
    test(`conforming ${JSON.stringify(input.labels)} is satisfied and emits nothing`, () => {
      const facts = factsWith([makeWorkItem({ entityId: "1", ...input })]);
      for (const entry of hygieneOf(facts).assertions ?? []) {
        expect(entry.satisfied).toBe(1);
        expect(entry.violations).toBe(0);
      }
      expect(trackerOf(facts).findings ?? []).toEqual([]);
    });
  }

  test("an all-three-conforming item counts three satisfied and zero findings", () => {
    const facts = factsWith([
      makeWorkItem({ entityId: "1", labels: ["epic", "points:5"], milestone: "Sprint" }),
    ]);
    expect(hygieneOf(facts).assertions?.reduce((sum, entry) => sum + entry.satisfied, 0)).toBe(3);
    expect(trackerOf(facts).findings ?? []).toEqual([]);
  });

  test("flipping one conforming value to its violating counterpart is live", () => {
    const conforming = factsWith([
      makeWorkItem({ entityId: "1", labels: ["epic:x", "points:0"], milestone: "Sprint" }),
    ]);
    const violating = factsWith([
      makeWorkItem({ entityId: "1", labels: ["epic:x", "points:abc"], milestone: "Sprint" }),
    ]);
    expect(assertionOf(conforming, "story-points").violations).toBe(0);
    expect(assertionOf(violating, "story-points").violations).toBe(1);
    expect(assertionFinding(violating, "story-points")?.members).toEqual(["1"]);
  });

  test("satisfied items do not increment the human hygiene finding count", async () => {
    const facts = factsWith([
      makeWorkItem({ entityId: "1", labels: ["epic", "points:5"], milestone: "Sprint" }),
    ]);
    const { renderStatusHuman } = await import("../../packages/core/src/domain/index");
    const human = renderStatusHuman(aggregateStatus(facts), {
      binaryName: "example-product",
    } as never);
    expect(human).toContain("hygiene 0 (0 unknown)");
  });
});
