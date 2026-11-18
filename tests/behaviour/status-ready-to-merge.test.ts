/**
 * TC-ATT-022 / 023 — the ready-to-merge action list: queue-ready-reused
 * classification, deterministic ranking, and unknown-review degradation.
 */
import { describe, expect, test } from "bun:test";
import type {
  DeliveryRequest,
  DeliveryRequestReviewState,
  StatusFacts,
  StatusReadyItem,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  makeDeliveryRequest,
  repository,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  runStatusCli,
  sectionById,
  statusRuntime,
  unavailableBinding,
} from "../fixtures/status/harness";

const request = (
  entityId: string,
  reviewState: DeliveryRequestReviewState,
  sourceRef = `feat/GH-${entityId}/x`,
): DeliveryRequest =>
  makeDeliveryRequest({ entityId, sourceRef, targetRef: "main-tools", reviewState });

const openPopulation = (): DeliveryRequest[] => [
  request("501", "approved"),
  request("502", "draft"),
  request("503", "open"),
  request("504", "changes-requested"),
  request("505", "closed"),
  request("506", "merged"),
];

const readyFacts = (
  items: readonly DeliveryRequest[],
  availability = REVIEWS_AVAILABLE,
): StatusFacts => baseFacts({ changes: deliveryRequestRead(items, availability) });

const readyOf = (facts: StatusFacts) =>
  sectionById(aggregateStatus(facts).sections, "ready-to-merge");

const itemsOf = (facts: StatusFacts): readonly StatusReadyItem[] =>
  (readyOf(facts).items ?? []) as readonly StatusReadyItem[];

const humanOf = (facts: StatusFacts): string =>
  renderStatusHuman(aggregateStatus(facts), { binaryName: "example-product" } as never);

describe("TC-ATT-022 ready-to-merge classification and ranking", () => {
  test("the section is index 7 and carries the pinned item shape", () => {
    const digest = aggregateStatus(readyFacts(openPopulation()));
    const section = digest.sections[6];
    expect(section?.id).toBe("ready-to-merge");
    expect(section?.state).toBe("observed");
    const item = itemsOf(readyFacts(openPopulation()))[0];
    expect(Object.keys(item ?? {}).sort()).toEqual([
      "ciResult",
      "class",
      "ref",
      "reviewState",
      "sourceRef",
      "targetRef",
    ]);
  });

  test("an observed approval on a non-draft open PR is merge-ready", () => {
    const items = itemsOf(readyFacts(openPopulation()));
    expect(items.map((item) => [item.ref, item.class])).toEqual([
      ["501", "merge-ready"],
      ["502", "review-pending"],
      ["503", "review-pending"],
      ["504", "review-pending"],
    ]);
    expect(items.map((item) => item.ref)).not.toContain("505");
    expect(items.map((item) => item.ref)).not.toContain("506");
    expect(items[0]?.reviewState).toBe("observed");
  });

  test("merge-ready always ranks above review-pending with numeric-aware refs", () => {
    const items = itemsOf(
      readyFacts([
        request("1002", "open"),
        request("1001", "open"),
        request("99", "approved"),
        request("1000", "open"),
      ]),
    );
    expect(items[0]?.ref).toBe("99");
    expect(items.slice(1).map((item) => item.ref)).toEqual(["1000", "1001", "1002"]);
    const reversed = itemsOf(
      readyFacts([
        request("1000", "open"),
        request("1001", "open"),
        request("1002", "open"),
        request("99", "approved"),
      ]),
    );
    expect(reversed).toEqual(items);
  });

  test("the list never issues a merge verdict or authority claim", () => {
    const serialized = JSON.stringify(aggregateStatus(readyFacts(openPopulation())));
    expect(serialized).not.toContain("approved by status");
    expect(serialized).not.toContain("merge instruction");
    expect(serialized).not.toContain("authority");
  });

  test("a verified-empty list is a real observed zero", async () => {
    const facts = readyFacts([]);
    expect(readyOf(facts).state).toBe("observed");
    expect(itemsOf(facts)).toEqual([]);
    const human = humanOf(facts);
    expect(human).toContain("ready      observed  0 ready-to-merge (merge-ready 0)");
    const run = await runStatusCli(["status"], statusRuntime(facts));
    expect(run.stdout).toContain("ready      observed  0 ready-to-merge (merge-ready 0)");
  });

  test("the human line numbers agree with the machine items", () => {
    const human = humanOf(readyFacts(openPopulation()));
    expect(human).toContain("ready      observed  4 ready-to-merge (merge-ready 1)");
  });
});

describe("TC-ATT-023 unknown or unavailable review signals degrade the list", () => {
  test("unavailable review signals make every item review-pending with an unknown marker", () => {
    const facts = readyFacts(openPopulation(), REVIEWS_UNAVAILABLE);
    const section = readyOf(facts);
    expect(section.state).toBe("degraded");
    expect(section.evidence.reasons).toContain("signal-unavailable");
    const items = itemsOf(facts);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.class).toBe("review-pending");
      expect(item.reviewState).toBe("unknown");
    }
    expect(items.some((item) => item.class === "merge-ready")).toBe(false);
  });

  test("the human line renders merge-ready ? and never a fabricated zero", () => {
    const human = humanOf(readyFacts(openPopulation(), REVIEWS_UNAVAILABLE));
    expect(human).toContain("ready      degraded  4 ready-to-merge (merge-ready ?)");
    expect(human).not.toContain("merge-ready 0");
  });

  test("a failed pull-request read is unknown with ? and zero items", () => {
    const facts = baseFacts({ changes: failedDeliveryRequestRead("read-failed") });
    const section = readyOf(facts);
    expect(section.state).toBe("unknown");
    expect(itemsOf(facts)).toEqual([]);
    const human = humanOf(facts);
    expect(human).toContain("ready      unknown  ? ready-to-merge (merge-ready ?)");
    expect(section.state).not.toBe("not-delivered");
  });

  test("no repository binding is unavailable with ?", () => {
    const facts = baseFacts({
      repository: repository({ binding: unavailableBinding() }),
      changes: failedDeliveryRequestRead("read-failed"),
    });
    expect(readyOf(facts).state).toBe("unavailable");
    expect(humanOf(facts)).toContain("ready      unavailable  ? ready-to-merge (merge-ready ?)");
  });

  test("a restored observed approval reaches a numeric merge-ready count", () => {
    const restored = readyFacts([request("501", "approved")]);
    expect(readyOf(restored).state).toBe("observed");
    expect(humanOf(restored)).toContain("merge-ready 1");
    expect(humanOf(restored)).not.toContain("merge-ready ?");
  });

  test("green CI and draft status never fabricate an approval", () => {
    const facts = baseFacts({
      changes: deliveryRequestRead([request("501", "draft")], REVIEWS_UNAVAILABLE),
    });
    const items = itemsOf(facts);
    expect(items[0]?.class).toBe("review-pending");
    expect(items[0]?.reviewState).toBe("unknown");
  });
});
