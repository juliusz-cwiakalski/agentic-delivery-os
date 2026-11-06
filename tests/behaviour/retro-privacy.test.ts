/**
 * TC-RETRO-064 — registered secrets never reach evidence, findings, reports, or
 * export bundles; the single serialization path is the only route out.
 */
import { describe, expect, test } from "bun:test";
import {
  collectRetro,
  exportRetroEvidence,
  reportRetro,
} from "../../packages/core/src/domain/retro";
import {
  auditOutcome,
  auditRecord,
  collectDeps,
  exportDeps,
  makeRetroDir,
  readSidecarBytes,
  reportDeps,
  transitionRecord,
} from "../fixtures/retro/harness";

const CANARY = "planted-fake-secret-gh232";
const redact = (text: string): string => text.replaceAll(CANARY, "[redacted]");

describe("TC-RETRO-064 redaction across evidence, findings, report, and bundle", () => {
  test("zero canary survivors in any channel", () => {
    const fixture = makeRetroDir("privacy");
    fixture.scriptDeliveryChanges([
      {
        changeRef: "GH-232",
        completedAt: "2026-11-06T12:00:00Z",
        transitions: [transitionRecord({ changeRef: "GH-232" })],
      },
    ]);
    fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
    fixture.scriptStateFamilies("GH-232", {
      transitions: [transitionRecord({ changeRef: "GH-232" })],
      closeouts: [{ outcome: "complete", note: CANARY }],
      telemetry: [],
    });
    fixture.scriptNotes("GH-232", { retroNotes: [`a note with ${CANARY}`] });
    expect(collectRetro(collectDeps(fixture, { redact })).ok).toBe(true);

    expect(readSidecarBytes(fixture).toString("utf8")).not.toContain(CANARY);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    expect(JSON.stringify(report)).not.toContain(CANARY);

    const holder = exportDeps(fixture, "/temp/export.json", 10, { redact });
    expect(exportRetroEvidence(holder.deps).ok).toBe(true);
    expect(holder.written.content ?? "").not.toContain(CANARY);
  });

  test("the control proves the canary was present in the source", () => {
    const fixture = makeRetroDir("privacy-control");
    fixture.scriptDeliveryChanges([
      {
        changeRef: "GH-232",
        completedAt: "2026-11-06T12:00:00Z",
        transitions: [transitionRecord({ changeRef: "GH-232" })],
      },
    ]);
    fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
    fixture.scriptStateFamilies("GH-232", {
      transitions: [transitionRecord({ changeRef: "GH-232" })],
      closeouts: [{ outcome: "complete", note: CANARY }],
      telemetry: [],
    });
    fixture.scriptNotes("GH-232", { retroNotes: [`a note with ${CANARY}`] });
    expect(collectRetro(collectDeps(fixture)).ok).toBe(true);
    expect(readSidecarBytes(fixture).toString("utf8")).toContain(CANARY);
  });
});
