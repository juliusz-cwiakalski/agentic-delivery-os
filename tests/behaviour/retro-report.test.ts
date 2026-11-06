/**
 * TC-RETRO-035 / TC-RETRO-036 / TC-RETRO-037 / TC-RETRO-039 / TC-RETRO-040 —
 * the four-key report data, provenance resolution, follow-through read-fold,
 * null retro success, tamper handling, and scope selection.
 */
import { describe, expect, test } from "bun:test";
import { collectRetro, reportRetro } from "../../packages/core/src/domain/retro";
import {
  auditOutcome,
  auditRecord,
  collectDeps,
  makeRetroDir,
  mutateContent,
  type RetroFixture,
  reportDeps,
  transitionRecord,
} from "../fixtures/retro/harness";

const change = (ref: string, completedAt: string) => ({
  changeRef: ref,
  completedAt,
  transitions: [transitionRecord({ changeRef: ref, timestamp: completedAt })],
});

const baseSources = (fixture: RetroFixture, ref: string, note = "a retro note"): void => {
  fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
  fixture.scriptStateFamilies(ref, {
    transitions: [transitionRecord({ changeRef: ref })],
    closeouts: [{ outcome: "complete" }],
    telemetry: [],
  });
  fixture.scriptNotes(ref, { retroNotes: [note] });
};

const collectOne = (label: string, ref = "GH-232"): RetroFixture => {
  const fixture = makeRetroDir(label);
  fixture.scriptDeliveryChanges([change(ref, "2026-11-06T12:00:00Z")]);
  baseSources(fixture, ref);
  const collected = collectRetro(collectDeps(fixture));
  if (!collected.ok) throw new Error(collected.error.code);
  return fixture;
};

describe("TC-RETRO-035 report data shape and provenance", () => {
  test("data has exactly the four keys, declared finding kinds, and resolvable refs", () => {
    const fixture = collectOne("report-shape");
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (!report.ok || !("findings" in report.data)) return;
    expect(Object.keys(report.data).sort()).toEqual([
      "evidenceRefs",
      "findings",
      "followThrough",
      "level",
    ]);
    expect(report.data.level).toBe("change");
    const sidecar = fixture.sidecar.read();
    expect(sidecar.ok).toBe(true);
    const known = sidecar.ok
      ? new Set(sidecar.value.records.map((record) => record.traceId))
      : new Set();
    for (const ref of report.data.evidenceRefs) expect(known.has(ref)).toBe(true);
    for (const finding of report.data.findings) {
      expect([
        "retro-note",
        "collector-finding",
        "truth-check",
        "tamper-flag",
        "malformed-entry",
        "verified-empty",
      ]).toContain(finding.kind);
      expect(finding.evidenceRefs.length).toBeGreaterThan(0);
      for (const ref of finding.evidenceRefs) {
        if (ref.startsWith("ev-")) expect(known.has(ref)).toBe(true);
      }
    }
    expect(report.data.findings.some((finding) => finding.kind === "retro-note")).toBe(true);
  });
});

describe("TC-RETRO-036 follow-through read-fold", () => {
  test("only recorded entries fold; verified artifacts are marked, unverifiable ones are not", () => {
    const fixture = makeRetroDir("report-follow-through");
    fixture.scriptDeliveryChanges([change("GH-232", "2026-11-06T12:00:00Z")]);
    baseSources(fixture, "GH-232");
    const collected = collectRetro(
      collectDeps(fixture, {
        readFollowThrough: () => [
          { action: "add-gate", artifactRef: "artifact-1" },
          { action: "write-guide", artifactRef: "artifact-2" },
        ],
      }),
    );
    expect(collected.ok).toBe(true);
    const report = reportRetro(
      reportDeps(fixture, { verifyArtifact: (ref) => ref === "artifact-1" }),
    );
    expect(report.ok).toBe(true);
    if (!report.ok || !("followThrough" in report.data)) return;
    expect(report.data.followThrough).toEqual([
      { action: "add-gate", verdict: "verified", artifactRef: "artifact-1" },
      { action: "write-guide", verdict: "unverified", artifactRef: "artifact-2" },
    ]);
    expect(report.data.followThrough.some((entry) => entry.action === "invented")).toBe(false);
  });
});

describe("TC-RETRO-037 null retro is an explicit success", () => {
  test("a verified-empty fold renders empty findings with exit-0 success", () => {
    const fixture = makeRetroDir("report-null");
    fixture.scriptDeliveryChanges([change("GH-232", "2026-11-06T12:00:00Z")]);
    fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
    fixture.scriptStateFamilies("GH-232", {
      transitions: [transitionRecord({ changeRef: "GH-232" })],
      closeouts: [{ outcome: "complete" }],
      telemetry: [],
    });
    fixture.scriptNotes("GH-232", { retroNotes: [] });
    expect(collectRetro(collectDeps(fixture)).ok).toBe(true);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (!report.ok || !("findings" in report.data)) return;
    expect(report.data.findings).toEqual([]);
    expect(report.data.followThrough).toEqual([]);
    expect(report.data.evidenceRefs.length).toBeGreaterThan(0);
  });
});

describe("TC-RETRO-039 report performs a verified read", () => {
  test("a tampered sidecar fails tamper-flagged and never serves the altered record", () => {
    const fixture = collectOne("report-tamper");
    mutateContent(fixture, 2, (record) => {
      record.payloadRefs = ["note:tampered"];
    });
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(false);
    if (report.ok) return;
    expect(report.error.code).toBe("retro.evidence.tamper-flagged");
    expect(report.partial ?? "").not.toContain("note:tampered");
    const cleanControl = makeRetroDir("report-tamper-control");
    cleanControl.scriptDeliveryChanges([change("GH-232", "2026-11-06T12:00:00Z")]);
    baseSources(cleanControl, "GH-232");
    expect(collectRetro(collectDeps(cleanControl)).ok).toBe(true);
    expect(reportRetro(reportDeps(cleanControl)).ok).toBe(true);
  });
});

describe("TC-RETRO-040 report folds the most recent collected scope", () => {
  test("the latest run's records and counts are folded, not an older scope", () => {
    const fixture = makeRetroDir("report-scope");
    fixture.scriptDeliveryChanges([
      change("GH-1", "2026-11-06T10:00:00Z"),
      change("GH-2", "2026-11-06T12:00:00Z"),
    ]);
    baseSources(fixture, "GH-1", "older scope note");
    expect(collectRetro(collectDeps(fixture, { target: "GH-1" })).ok).toBe(true);
    baseSources(fixture, "GH-2", "newer scope note");
    expect(collectRetro(collectDeps(fixture, { target: "GH-2" })).ok).toBe(true);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (!report.ok || !("findings" in report.data)) return;
    const texts = report.data.findings.map((finding) => finding.text).join("\n");
    expect(texts).toContain("newer scope note");
    expect(texts).not.toContain("older scope note");
  });
});
