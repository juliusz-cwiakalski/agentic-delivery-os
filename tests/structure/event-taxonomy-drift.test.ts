/**
 * TC-EVT-003 — each of the five drift classes fails a named per-topic
 * comparison that names the drifted item, and the two declared gaps keep the pin
 * honest.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import {
  compareFrames,
  compareSurface,
  driftMutants,
  scriptedFrames,
  scriptedRecords,
} from "../fixtures/events/drift-mutants";

const ROOT = process.cwd();
const MODULE = "packages/core/src/contracts/taxonomy.ts";

describe("TC-EVT-003 drift localization", () => {
  test("the unmutated surface and scripted frames report no violation", () => {
    expect(compareSurface(TAXONOMY, scriptedRecords(TAXONOMY))).toEqual([]);
    expect(compareFrames(TAXONOMY, scriptedFrames(TAXONOMY))).toEqual([]);
  });

  test("version drift names the topic, the field, and both values", () => {
    const violations = compareSurface(TAXONOMY, driftMutants().version);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.topic).toBe("queue.graph");
    expect(violations[0]?.field).toBe("version");
    expect(violations[0]?.detail).toContain("v1");
    expect(violations[0]?.detail).toContain("v2");
  });

  test("kind drift names the topic, the kind field, and both values, localized to one topic", () => {
    const violations = compareSurface(TAXONOMY, driftMutants().kind);
    expect(new Set(violations.map((violation) => violation.topic))).toEqual(
      new Set(["phase.state"]),
    );
    expect(violations.map((violation) => violation.field)).toContain("kinds");
    expect(violations.map((violation) => violation.detail).join(" ")).toContain("reopened-v2");
  });

  test("payload-field drift names the topic, the kind, and the removed field", () => {
    const violations = compareSurface(TAXONOMY, driftMutants().payloadField);
    expect(new Set(violations.map((violation) => violation.topic))).toEqual(
      new Set(["dispatch.attempt"]),
    );
    expect(violations.map((violation) => violation.field)).toContain("payloadFields");
    expect(violations.map((violation) => violation.detail).join(" ")).toContain("token");
  });

  test("ordering drift names the topic and the ordering value", () => {
    const violations = compareSurface(TAXONOMY, driftMutants().ordering);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.topic).toBe("blockers.state");
    expect(violations[0]?.field).toBe("ordering");
    expect(violations[0]?.detail).toContain("snapshot-revision");
  });

  test("overflow drift names the topic and rejects drop as an unknown closed value", () => {
    const violations = compareSurface(TAXONOMY, driftMutants().overflow);
    expect(violations.every((violation) => violation.topic === "queue")).toBe(true);
    const details = violations.map((violation) => violation.detail).join(" ");
    expect(details).toContain("drop");
    expect(violations.some((violation) => violation.field === "overflow")).toBe(true);
    expect(new Set(violations.map((violation) => violation.topic))).toEqual(new Set(["queue"]));
  });

  test("every non-version drift is reported as version-forcing (DEC-E)", () => {
    const mutants = driftMutants();
    for (const key of ["kind", "payloadField", "ordering", "overflow"] as const) {
      const violations = compareSurface(TAXONOMY, mutants[key]);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.every((violation) => violation.versionImplication)).toBe(true);
    }
  });

  test("the live declaration bytes are unchanged after every mutant runs", () => {
    const before = readFileSync(join(ROOT, MODULE), "utf8");
    const mutants = driftMutants();
    for (const records of Object.values(mutants)) compareSurface(TAXONOMY, records);
    expect(readFileSync(join(ROOT, MODULE), "utf8")).toBe(before);
  });
});
