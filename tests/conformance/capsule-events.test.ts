/**
 * TC-CAP-002 — the capsule event conformance registry is a bijection with the
 * closed vocabulary and fails a missing kind or a producer-less entry.
 */
import { describe, expect, test } from "bun:test";
import { CAPSULE_EVENT_KINDS, CAPSULE_SCHEMA_ID } from "../../packages/core/src/contracts/index";
import {
  CAPSULE_CONFORMANCE_REGISTRY,
  capsuleConformanceViolations,
} from "../../packages/testkit/src/conformance/capsule";

describe("TC-CAP-002 capsule conformance registry", () => {
  test("the shipped registry covers the vocabulary exactly", () => {
    expect(capsuleConformanceViolations(CAPSULE_CONFORMANCE_REGISTRY)).toEqual([]);
    expect(CAPSULE_CONFORMANCE_REGISTRY.length).toBe(CAPSULE_EVENT_KINDS.length);
  });

  test("a kind missing from the registry is named", () => {
    const violations = capsuleConformanceViolations(CAPSULE_CONFORMANCE_REGISTRY.slice(1));
    expect(violations.some((violation) => violation.includes("capsule.opened"))).toBe(true);
  });

  test("a producer-less entry fails", () => {
    const mutated = CAPSULE_CONFORMANCE_REGISTRY.map((entry) =>
      entry.kind === "capsule.closed" ? { ...entry, producer: "  " } : entry,
    );
    expect(
      capsuleConformanceViolations(mutated).some((violation) =>
        violation.includes("no producer case"),
      ),
    ).toBe(true);
  });

  test("an unknown kind or writer fails and a duplicate is named", () => {
    const unknown = [
      ...CAPSULE_CONFORMANCE_REGISTRY,
      { kind: "capsule.extra", writer: "x", producer: "p" },
    ];
    expect(
      capsuleConformanceViolations(unknown).some((violation) => violation.includes("outside")),
    ).toBe(true);
    const duplicate = [...CAPSULE_CONFORMANCE_REGISTRY, CAPSULE_CONFORMANCE_REGISTRY[0]];
    expect(
      capsuleConformanceViolations(duplicate).some((violation) =>
        violation.includes("more than once"),
      ),
    ).toBe(true);
  });

  test("the schema id is the event contract identity", () => {
    expect(CAPSULE_SCHEMA_ID).toBe("delivery.capsule.event.v1");
  });
});
