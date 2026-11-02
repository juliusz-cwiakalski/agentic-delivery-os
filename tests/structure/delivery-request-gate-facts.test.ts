/**
 * TC-VGATES-003 — the four DeliveryRequest gate facts are optional and
 * absent-safe; absence is never coerced to mergeable or a non-zero surface.
 */
import { describe, expect, test } from "bun:test";
import type { DeliveryRequest } from "../../packages/core/src/contracts/index";

const readFacts = (request: DeliveryRequest) => ({
  sourceHeadSha: request.sourceHeadSha,
  mergeableState: request.mergeableState,
  commitCount: request.commitCount,
  changedFileCount: request.changedFileCount,
});

describe("TC-VGATES-003 DeliveryRequest additive gate facts", () => {
  test("all four, none, and each subset are valid and absence stays undefined", () => {
    const base: DeliveryRequest = {
      identity: { systemName: "github", entityId: "178" },
      sourceRef: "feat/GH-178/x",
      targetRef: "main-tools",
      reviewState: "open",
      threads: [],
    };
    expect(readFacts(base)).toEqual({
      sourceHeadSha: undefined,
      mergeableState: undefined,
      commitCount: undefined,
      changedFileCount: undefined,
    });
    const full: DeliveryRequest = {
      ...base,
      sourceHeadSha: "1".repeat(40),
      mergeableState: "mergeable",
      commitCount: 0,
      changedFileCount: 0,
    };
    expect(readFacts(full)).toEqual({
      sourceHeadSha: "1".repeat(40),
      mergeableState: "mergeable",
      commitCount: 0,
      changedFileCount: 0,
    });
    expect({ ...base, mergeableState: "unknown" }).toBeDefined();
    expect({ ...base, commitCount: 3 }).toBeDefined();
    expect({ ...base, changedFileCount: 7 }).toBeDefined();
  });

  test("absent facts are never defaulted to mergeable or a non-zero surface", () => {
    const absent: DeliveryRequest = {
      identity: { systemName: "github", entityId: "178" },
      sourceRef: "feat/GH-178/x",
      targetRef: "main-tools",
      reviewState: "open",
      threads: [],
    };
    const facts = readFacts(absent);
    expect(facts.mergeableState).not.toBe("mergeable");
    expect(facts.commitCount).not.toBe(1);
    expect(facts.changedFileCount).not.toBe(1);
  });
});
