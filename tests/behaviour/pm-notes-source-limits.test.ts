/**
 * GH-251 TC-UTF8LIMIT-002/003/004/005/006 — the pm-notes document parser
 * enforces the 1048576 source limit as UTF-8 bytes at both check sites, with
 * unchanged fail-closed identities.
 */
import { describe, expect, test } from "bun:test";
import { parsePmNotesText, stagePmNotesPhaseEntry } from "@delivery-os/adapters/file";
import {
  BOUNDARY_CLASSES,
  buildPmNotesSource,
  EXPECTED_BOUNDARY_CASE_COUNT,
  LIMIT_BYTES,
  PM_NOTES_PREFIX,
  SITE_KEYS,
  utf8Bytes,
} from "../fixtures/source-limits/harness";

const FILE = "fixtures/pm-notes-source-limit.yaml";
const EDIT = {
  phaseId: "delivery",
  operation: "complete" as const,
  timestamp: "2026-11-06T19:00:00Z",
};

const unpaddedParse = (() => {
  const parsed = parsePmNotesText(PM_NOTES_PREFIX, FILE);
  if (!parsed.ok) throw new Error("unpadded pm-notes fixture must parse");
  return parsed.value;
})();

const unpaddedStage = (() => {
  const staged = stagePmNotesPhaseEntry(PM_NOTES_PREFIX, EDIT);
  if (!staged.ok) throw new Error("unpadded pm-notes fixture must stage");
  return staged;
})();

describe("TC-UTF8LIMIT-002 pm-notes parse site boundary matrix", () => {
  for (const boundary of BOUNDARY_CLASSES) {
    test(`${boundary.label} ${boundary.expectOk ? "accepted" : "rejected"}`, () => {
      const text = buildPmNotesSource(boundary.targetBytes, boundary.unit);
      expect(utf8Bytes(text)).toBe(boundary.targetBytes);
      if (boundary.discriminatesCodeUnits) {
        expect(text.length).toBeLessThanOrEqual(LIMIT_BYTES);
        expect(utf8Bytes(text)).toBeGreaterThan(LIMIT_BYTES);
      }
      const parsed = parsePmNotesText(text, FILE);
      if (boundary.expectOk) {
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.value).toEqual(unpaddedParse);
      } else {
        expect(parsed).toEqual({
          ok: false,
          reason: "malformed",
          file: FILE,
          parseFailure: { class: "syntax", location: FILE },
        });
        if (!parsed.ok) expect(parsed.parseFailure.class).not.toMatch(/size|limit/i);
      }
    });
  }
});

describe("TC-UTF8LIMIT-003 pm-notes stage site boundary matrix", () => {
  for (const boundary of BOUNDARY_CLASSES) {
    test(`${boundary.label} ${boundary.expectOk ? "accepted" : "rejected"}`, () => {
      const text = buildPmNotesSource(boundary.targetBytes, boundary.unit);
      expect(utf8Bytes(text)).toBe(boundary.targetBytes);
      if (boundary.discriminatesCodeUnits) {
        expect(text.length).toBeLessThanOrEqual(LIMIT_BYTES);
        expect(utf8Bytes(text)).toBeGreaterThan(LIMIT_BYTES);
      }
      const staged = stagePmNotesPhaseEntry(text, EDIT);
      if (boundary.expectOk) {
        expect(staged.ok).toBe(true);
        if (!staged.ok) return;
        expect(staged.value).toEqual(unpaddedStage.value);
        expect(staged.text).toContain(EDIT.timestamp);
        const padding = text.slice(PM_NOTES_PREFIX.length);
        if (padding.length > 0) expect(staged.text).toContain(padding);
      } else {
        expect(staged).toEqual({
          ok: false,
          parseFailure: { class: "syntax", location: "document" },
        });
        if (!staged.ok) expect(staged.parseFailure.class).not.toMatch(/size|limit/i);
      }
    });
  }
});

describe("TC-UTF8LIMIT-004 boundary fixture self-verification", () => {
  test("the three sites x five classes matrix cannot silently shrink", () => {
    expect(BOUNDARY_CLASSES).toHaveLength(5);
    expect(SITE_KEYS).toHaveLength(3);
    expect(EXPECTED_BOUNDARY_CASE_COUNT).toBe(15);
  });

  test("the builder throws instead of producing a near-miss", () => {
    expect(() => buildPmNotesSource(0, "three")).toThrow();
    expect(() => buildPmNotesSource(utf8Bytes(PM_NOTES_PREFIX) - 1, "three")).toThrow();
  });
});
