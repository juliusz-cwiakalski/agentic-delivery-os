/**
 * TC-EVT-003 — each of the five drift classes fails a named per-topic
 * comparison that names the drifted item, and the two declared gaps keep the pin
 * honest.
 *
 * The baseline the mutants edit is the LIVE surface record set, and the frame
 * half is compared over the LIVE projector's output, so the comparison pins the
 * shipped consumers instead of comparing the declaration with itself.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";
import {
  compareFrames,
  compareSurface,
  driftMutants,
  type SurfaceRecord,
} from "../fixtures/events/drift-mutants";
import { projectCaseEvents } from "../fixtures/events/projection-cases";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";

const ROOT = process.cwd();
const MODULE = "packages/core/src/contracts/taxonomy.ts";

/** The live `events list --json` record set, exactly as the surface renders it. */
const liveSurface = async (): Promise<readonly SurfaceRecord[]> => {
  const run = await createSurfaceHarness().run(["events", "list", "--json"]);
  expect(run.exitCode).toBe(0);
  return (run.data?.topics ?? []) as unknown as readonly SurfaceRecord[];
};

/** The live projector's frames in the comparator's frame shape. */
const liveFrames = () =>
  projectCaseEvents().map((event) => ({
    kind: "event" as const,
    data: { ...event } as Record<string, unknown>,
  }));

describe("TC-EVT-003 drift localization", () => {
  test("the live surface and the live projection report no violation", async () => {
    expect(compareSurface(TAXONOMY, await liveSurface())).toEqual([]);
    expect(compareFrames(TAXONOMY, liveFrames())).toEqual([]);
  });

  test("version drift names the topic, the field, and both values", async () => {
    const violations = compareSurface(TAXONOMY, driftMutants(await liveSurface()).version);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.topic).toBe("queue.graph");
    expect(violations[0]?.field).toBe("version");
    expect(violations[0]?.detail).toContain("v1");
    expect(violations[0]?.detail).toContain("v2");
  });

  test("kind drift names the topic, the kind field, and both values, localized to one topic", async () => {
    const violations = compareSurface(TAXONOMY, driftMutants(await liveSurface()).kind);
    expect(new Set(violations.map((violation) => violation.topic))).toEqual(
      new Set(["phase.state"]),
    );
    expect(violations.map((violation) => violation.field)).toContain("kinds");
    expect(violations.map((violation) => violation.detail).join(" ")).toContain("reopened-v2");
  });

  test("payload-field drift names the topic, the kind, and the removed field", async () => {
    const violations = compareSurface(TAXONOMY, driftMutants(await liveSurface()).payloadField);
    expect(new Set(violations.map((violation) => violation.topic))).toEqual(
      new Set(["dispatch.attempt"]),
    );
    expect(violations.map((violation) => violation.field)).toContain("payloadFields");
    expect(violations.map((violation) => violation.detail).join(" ")).toContain("token");
  });

  test("ordering drift names the topic and the ordering value", async () => {
    const violations = compareSurface(TAXONOMY, driftMutants(await liveSurface()).ordering);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.topic).toBe("blockers.state");
    expect(violations[0]?.field).toBe("ordering");
    expect(violations[0]?.detail).toContain("snapshot-revision");
  });

  test("overflow drift names the topic and rejects drop as an unknown closed value", async () => {
    const violations = compareSurface(TAXONOMY, driftMutants(await liveSurface()).overflow);
    expect(violations.every((violation) => violation.topic === "queue")).toBe(true);
    const details = violations.map((violation) => violation.detail).join(" ");
    expect(details).toContain("drop");
    expect(violations.some((violation) => violation.field === "overflow")).toBe(true);
    expect(new Set(violations.map((violation) => violation.topic))).toEqual(new Set(["queue"]));
  });

  test("every non-version drift is reported as version-forcing (DEC-E)", async () => {
    const mutants = driftMutants(await liveSurface());
    for (const key of ["kind", "payloadField", "ordering", "overflow"] as const) {
      const violations = compareSurface(TAXONOMY, mutants[key]);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.every((violation) => violation.versionImplication)).toBe(true);
    }
  });

  test("a frame that drops a declared payload field is drift, not silence", () => {
    const frames = liveFrames().map((frame) => {
      if (frame.data.kind !== "completed" || frame.data.topic !== "dispatch.attempt") return frame;
      const payload = { ...(frame.data.payload as Record<string, unknown>) };
      delete payload.token;
      return { ...frame, data: { ...frame.data, payload } };
    });
    const violations = compareFrames(TAXONOMY, frames);
    expect(
      violations.some(
        (violation) => violation.topic === "dispatch.attempt" && violation.detail.includes("token"),
      ),
    ).toBe(true);
  });

  test("the live declaration bytes are unchanged after every mutant runs", async () => {
    const before = readFileSync(join(ROOT, MODULE), "utf8");
    const mutants = driftMutants(await liveSurface());
    for (const records of Object.values(mutants)) compareSurface(TAXONOMY, records);
    expect(readFileSync(join(ROOT, MODULE), "utf8")).toBe(before);
  });
});
