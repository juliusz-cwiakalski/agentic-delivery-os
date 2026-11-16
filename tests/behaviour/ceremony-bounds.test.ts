/**
 * TC-CEREMONY-054 — byte bounds are measured at and above every limit: the
 * compacted summary, the run/step records, the brief artifact, and the human
 * render.
 */
import { describe, expect, test } from "bun:test";
import {
  CEREMONY_COMPACTION_MAX_BYTES,
  CEREMONY_COMPACTION_MAX_LINES,
  CEREMONY_RUN_RECORD_MAX_BYTES,
  CEREMONY_STEP_RECORD_MAX_BYTES,
} from "../../packages/core/src/contracts/index";
import { compactCeremonyCarried } from "../../packages/core/src/domain/index";
import { renderCeremonyText } from "../../packages/cli/src/output/ceremony-text";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";
import { runRecord, stepRecord } from "../fixtures/ceremony/state";

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

const entries = (count: number, width: number) =>
  Array.from({ length: count }, (_, index) => ({
    index: index + 1,
    kind: "fold",
    content: "x".repeat(width),
  }));

describe("TC-CEREMONY-054 measured bounds", () => {
  test("a summary at the line bound is untruncated; one line over is truncated with a count", () => {
    const atLimit = compactCeremonyCarried(entries(CEREMONY_COMPACTION_MAX_LINES, 1));
    expect(atLimit.lines).toBeLessThanOrEqual(CEREMONY_COMPACTION_MAX_LINES);
    expect(atLimit.bytes).toBeLessThanOrEqual(CEREMONY_COMPACTION_MAX_BYTES);
    expect(atLimit.omitted).toBe(0);
    const over = compactCeremonyCarried(entries(CEREMONY_COMPACTION_MAX_LINES + 5, 1));
    expect(over.omitted).toBeGreaterThan(0);
    expect(over.summary).toContain(`omitted: ${String(over.omitted)}`);
    expect(over.lines).toBeLessThanOrEqual(CEREMONY_COMPACTION_MAX_LINES);
  });

  test("a byte-over-bound summary is truncated with an explicit count", () => {
    const over = compactCeremonyCarried(entries(30, 400));
    expect(over.bytes).toBeLessThanOrEqual(CEREMONY_COMPACTION_MAX_BYTES);
    expect(over.omitted).toBeGreaterThan(0);
  });

  test("run and step records stay within their serialized bounds", () => {
    expect(bytes(runRecord())).toBeLessThanOrEqual(CEREMONY_RUN_RECORD_MAX_BYTES);
    expect(bytes(stepRecord())).toBeLessThanOrEqual(CEREMONY_STEP_RECORD_MAX_BYTES);
  });

  test("the brief artifact stays within its family bound", () => {
    const prepared = prepareBuiltin("morning-brief");
    try {
      expect(runPrepared(prepared).ok).toBe(true);
      for (const content of prepared.harness.artifactContents.values()) {
        if ((JSON.parse(content) as { schemaId?: string }).schemaId === "delivery.brief.v1") {
          expect(Buffer.byteLength(content, "utf8")).toBeLessThanOrEqual(65_536);
        }
      }
    } finally {
      prepared.harness.dispose();
    }
  });

  test("the human render is bounded at 32 lines and 6 144 bytes, above it with a marker", () => {
    const line = (index: number) => ({
      id: `ceremony-${String(index)}`,
      origin: "built-in",
      tiers: ["full"],
      triggers: ["schedule:daily"],
      catchUp: "once",
    });
    const atLimit = renderCeremonyText({
      ceremonies: Array.from({ length: 32 }, (_, index) => line(index)),
    });
    expect(atLimit.split("\n").filter((entry) => entry.length > 0).length).toBeLessThanOrEqual(32);
    const over = renderCeremonyText({
      ceremonies: Array.from({ length: 40 }, (_, index) => line(index)),
    });
    expect(over).toContain("omitted:");
    expect(Buffer.byteLength(over, "utf8")).toBeLessThanOrEqual(6_144);
  });
});
