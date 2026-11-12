/**
 * TC-EVT-004 (structure half) — the pure integrity validator fails each of the
 * seven declared violation classes by name, and the shipped declaration passes.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TAXONOMY,
  type TaxonomyViolation,
  validateTaxonomy,
} from "../../packages/core/src/contracts/taxonomy";
import { integrityMutants } from "../fixtures/events/drift-mutants";

const ROOT = process.cwd();
const MODULE = "packages/core/src/contracts/taxonomy.ts";

const detailOf = (violations: readonly TaxonomyViolation[]): string =>
  violations
    .map((violation) => `${violation.topic}:${violation.field}:${violation.detail}`)
    .join("\n");

describe("TC-EVT-004 taxonomy integrity", () => {
  test("the shipped declaration validates with zero violations", () => {
    expect(validateTaxonomy(TAXONOMY)).toEqual([]);
  });

  test("a duplicate topic name is refused by name", () => {
    const violations = validateTaxonomy(integrityMutants().duplicateName);
    expect(detailOf(violations)).toContain("queue");
    expect(violations.some((violation) => violation.field === "name")).toBe(true);
    expect(detailOf(violations)).toContain("twice");
  });

  test("an event topic with no kind is refused", () => {
    const violations = validateTaxonomy(integrityMutants().emptyEventKinds);
    expect(
      violations.some(
        (violation) => violation.topic === "queue.graph" && violation.field === "kinds",
      ),
    ).toBe(true);
    expect(detailOf(violations)).toContain("declares no kind");
  });

  test("a kind declared on a snapshot topic is refused", () => {
    const violations = validateTaxonomy(integrityMutants().snapshotKind);
    expect(
      violations.some((violation) => violation.topic === "queue" && violation.field === "kinds"),
    ).toBe(true);
    expect(detailOf(violations)).toContain("snapshot topic declares a kind");
  });

  test("a duplicated kind within a topic is refused", () => {
    const violations = validateTaxonomy(integrityMutants().duplicateKind);
    expect(detailOf(violations)).toContain("declared twice");
  });

  test("a kind without a payload field list is refused", () => {
    const violations = validateTaxonomy(integrityMutants().emptyPayloadFields);
    expect(violations.some((violation) => violation.topic === "phase.state")).toBe(true);
    expect(detailOf(violations)).toContain("no payload field list");
  });

  test("an unknown shape, ordering, or overflow value is refused", () => {
    const violations = validateTaxonomy(integrityMutants().unknownValues);
    const fields = new Set(
      violations
        .filter((violation) => violation.topic === "blockers.state")
        .map((violation) => violation.field),
    );
    expect(fields.has("ordering")).toBe(true);
    expect(fields.has("overflow")).toBe(true);
    expect(fields.has("shape")).toBe(true);
  });

  test("a frame missing a declared field is refused", () => {
    const violations = validateTaxonomy(integrityMutants().missingFrameField);
    expect(
      violations.some((violation) => violation.topic === "lanes" && violation.field === "frame"),
    ).toBe(true);
    expect(detailOf(violations)).toContain("cursor");
  });

  test("a hand-authored topic union that disagrees with its kinds is refused", () => {
    const mutation = JSON.parse(JSON.stringify(TAXONOMY)) as {
      topics: { name: string; payloadFields: string[] }[];
    };
    const topic = mutation.topics.find((candidate) => candidate.name === "queue.graph");
    topic?.payloadFields.push("handAuthored");
    const violations = validateTaxonomy(mutation);
    expect(
      violations.some(
        (violation) => violation.topic === "queue.graph" && violation.field === "payloadFields",
      ),
    ).toBe(true);
  });

  test("validation is pure: the live declaration bytes are unchanged", () => {
    const before = readFileSync(join(ROOT, MODULE), "utf8");
    validateTaxonomy(integrityMutants().duplicateName);
    expect(readFileSync(join(ROOT, MODULE), "utf8")).toBe(before);
  });
});
