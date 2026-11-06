/**
 * TC-RETRO-049..052 — the bounded deterministic export engine surface:
 * truncation, refusals before any write, redaction, and zero mutation.
 */
import { describe, expect, test } from "bun:test";
import {
  RETRO_EXPORT_MAX_LIMIT,
  RETRO_EXPORT_SCHEMA,
} from "../../packages/core/src/contracts/index";
import { exportRetroEvidence } from "../../packages/core/src/domain/retro";
import {
  appendEvidence,
  exportDeps,
  makeRetroDir,
  readSidecarBytes,
} from "../fixtures/retro/harness";

describe("TC-RETRO-049 bounded engine-boundary export", () => {
  test("a deterministic bundle carries the declared schema, records, and chain verdict", () => {
    const fixture = makeRetroDir("export-bundle");
    for (let index = 0; index < 5; index += 1) appendEvidence(fixture);
    const before = readSidecarBytes(fixture);
    const registryBefore = fixture.store.readRecords();
    const first = exportDeps(fixture);
    const result = exportRetroEvidence(first.deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.schemaId).toBe(RETRO_EXPORT_SCHEMA);
    expect(result.bundle.truncated).toBe(false);
    expect(result.bundle.chain.verified).toBe(true);
    expect(result.bundle.records).toHaveLength(5);
    for (const record of result.bundle.records) {
      expect(record.traceId.startsWith("ev-")).toBe(true);
      expect(record.windowStart).toBeLessThanOrEqual(record.windowEnd);
    }
    const second = exportDeps(fixture);
    const replay = exportRetroEvidence(second.deps);
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.content).toBe(result.content);
    expect(first.written.destination).toBe("/temp/export.json");
    expect(readSidecarBytes(fixture).equals(before)).toBe(true);
    const registryAfter = fixture.store.readRecords();
    if (registryBefore.ok && registryAfter.ok) {
      expect(registryAfter.value.records.length).toBe(registryBefore.value.records.length);
    }
  });
});

describe("TC-RETRO-050 export refusals", () => {
  test("missing destination and invalid limits refuse input.value.rejected before any write", () => {
    const fixture = makeRetroDir("export-refusals");
    appendEvidence(fixture);
    const cases: Array<{ destination?: string; limit: number }> = [
      { destination: "", limit: 1 },
      { destination: "/temp/export.json", limit: 0 },
      { destination: "/temp/export.json", limit: -1 },
      { destination: "/temp/export.json", limit: 1.5 },
      { destination: "/temp/export.json", limit: RETRO_EXPORT_MAX_LIMIT + 1 },
    ];
    for (const candidate of cases) {
      const holder = exportDeps(fixture, candidate.destination ?? "", candidate.limit);
      const result = exportRetroEvidence(holder.deps);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.kind).toBe("input");
        expect(result.error.code).toBe("input.value.rejected");
      }
      expect(holder.written.content).toBeUndefined();
    }
    const valid = exportDeps(fixture);
    expect(exportRetroEvidence(valid.deps).ok).toBe(true);
  });
});

describe("TC-RETRO-051 truncation boundary", () => {
  test("exactly at the population is not truncated; below it is, with the exact count", () => {
    const fixture = makeRetroDir("export-boundary");
    for (let index = 0; index < 5; index += 1) appendEvidence(fixture);
    for (const [limit, expectedCount, expectedTruncated] of [
      [5, 5, false],
      [4, 4, true],
      [1, 1, true],
    ] as const) {
      const holder = exportDeps(fixture, "/temp/export.json", limit);
      const result = exportRetroEvidence(holder.deps);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.bundle.truncated).toBe(expectedTruncated);
      expect(result.bundle.records).toHaveLength(expectedCount);
      expect(result.bundle.limit).toBe(limit);
    }
  });
});

describe("TC-RETRO-052 redaction and no mutation", () => {
  test("the registered canary does not survive the single serialization path", () => {
    const fixture = makeRetroDir("export-redaction");
    appendEvidence(fixture, { payloadRefs: ["text:planted-fake-secret-232"] });
    const holder = exportDeps(fixture, "/temp/export.json", 10, {
      redact: (text) => text.replaceAll("planted-fake-secret-232", "[redacted]"),
    });
    const result = exportRetroEvidence(holder.deps);
    expect(result.ok).toBe(true);
    expect(holder.written.content).not.toContain("planted-fake-secret-232");
    expect(holder.written.content).toContain("[redacted]");
    const raw = readSidecarBytes(fixture).toString("utf8");
    expect(raw).toContain("planted-fake-secret-232");
  });
});
