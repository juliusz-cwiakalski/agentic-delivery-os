/**
 * TC-BRIEF-010 — exhaustive failed/absent-read negative controls: every §4.7
 * control renders the digest's section state on exactly one brief surface, and
 * nothing renders as clear, green, available, or zero.
 */
import { describe, expect, test } from "bun:test";
import type { StatusSectionState } from "../../packages/core/src/contracts/index";
import { aggregateStatus, projectBrief } from "../../packages/core/src/domain/index";
import { briefCases } from "../fixtures/brief/cases";
import { surfaceMismatches } from "../fixtures/brief/check";
import {
  baseFacts,
  deliveryRequestRead,
  makeDeliveryRequest,
  REVIEWS_AVAILABLE,
} from "../fixtures/brief/harness";
import { matrixCases } from "../fixtures/status/matrix/cases";

const surfaceState = (
  facts: Parameters<typeof projectBrief>[0],
  id: string,
): StatusSectionState => {
  const surface = projectBrief(facts).surfaces.find((entry) => entry.id === id);
  if (surface === undefined) throw new Error(`missing surface ${id}`);
  return surface.state;
};

describe("TC-BRIEF-010 negative controls", () => {
  for (const entry of matrixCases) {
    test(`${entry.name}: every mapped surface equals the digest section state`, () => {
      const digest = aggregateStatus(entry.facts);
      const brief = projectBrief(entry.facts);
      for (const [id, expectation] of Object.entries(entry.expected)) {
        const surface = brief.surfaces.find((candidate) => candidate.id === id);
        if (surface === undefined) throw new Error(`missing surface ${id}`);
        expect(surface.state, `${entry.name}:${id}`).toBe(expectation.state);
        const section = digest.sections.find((candidate) => candidate.id === id);
        expect(section?.state).toBe(expectation.state);
      }
    });
  }

  test("the anonymous-instance guard reproduces the digest's fixed outcome", () => {
    const facts = briefCases.find((entry) => entry.name === "anonymous-guard")?.facts;
    if (facts === undefined) throw new Error("anonymous case missing");
    const digest = aggregateStatus(facts);
    const stateOf = (id: string): string => {
      const section = digest.sections.find((entry) => entry.id === id);
      if (section === undefined) throw new Error(`missing digest section ${id}`);
      return section.state;
    };
    expect(surfaceState(facts, "tracker")).toBe(stateOf("tracker"));
    expect(surfaceState(facts, "tracker")).toBe("unknown");
    expect(surfaceState(facts, "ci")).toBe("unknown");
    expect(surfaceState(facts, "changes-and-prs")).toBe("degraded");
    expect(surfaceState(facts, "parked-work")).toBe("observed");

    const restored = baseFacts();
    expect(surfaceState(restored, "tracker")).toBe("observed");
    expect(surfaceState(restored, "ci")).toBe("observed");
  });

  test("the at-limit source carries a marker and the near-limit control does not", () => {
    const items = [
      makeDeliveryRequest({ entityId: "501", reviewState: "approved" }),
      makeDeliveryRequest({ entityId: "502", reviewState: "open" }),
    ];
    const atLimit = baseFacts({ changes: deliveryRequestRead(items, REVIEWS_AVAILABLE, 100) });
    const nearLimit = baseFacts({ changes: deliveryRequestRead(items, REVIEWS_AVAILABLE, 99) });
    const atChanges = projectBrief(atLimit).surfaces.find(
      (entry) => entry.id === "changes-and-prs",
    );
    const nearChanges = projectBrief(nearLimit).surfaces.find(
      (entry) => entry.id === "changes-and-prs",
    );
    expect(atChanges?.truncated).toBe(true);
    expect(nearChanges?.truncated).toBe(false);
    expect(
      projectBrief(atLimit).truncation.some((entry) => entry.target === "changes-and-prs"),
    ).toBe(true);
    expect(
      projectBrief(nearLimit).truncation.some((entry) => entry.target === "changes-and-prs"),
    ).toBe(false);
  });

  test("the completeness meta-check fails when a case expectation is corrupted", () => {
    const original = briefCases[0];
    if (original === undefined) throw new Error("case corpus is empty");
    expect(surfaceMismatches(original)).toEqual([]);
    const corrupted = {
      ...original,
      expected: {
        surfaces: { ...original.expected.surfaces, tracker: "unavailable" as const },
      },
    };
    const failures = surfaceMismatches(corrupted);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.join("\n")).toContain(original.name);
    expect(failures.join("\n")).toContain("tracker");
  });

  test("the fully observed control renders every digest surface observed", () => {
    const states = projectBrief(baseFacts()).surfaces;
    for (const id of ["tracker", "changes-and-prs", "ci", "providers", "parked-work"] as const) {
      const surface = states.find((entry) => entry.id === id);
      expect(surface?.state, id).toBe("observed");
    }
  });
});
