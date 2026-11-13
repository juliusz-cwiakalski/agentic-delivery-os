/**
 * TC-TELEMETRY-027 — the retro evidence pass records the spend figures as
 * collector-truth evidence and the report cites them; the delivered evidence
 * source set grows additively only (AC-F8-1, RSK-6, NG-7).
 */
import { describe, expect, test } from "bun:test";
import {
  RETRO_EVIDENCE_SOURCES,
  RETRO_PAYLOAD_SCHEMAS,
  type RetroChangeFacts,
  type RetroSpendEvidence,
} from "../../packages/core/src/contracts/index";
import { collectRetro, reportRetro } from "../../packages/core/src/domain/retro";
import {
  auditOutcome,
  auditRecord,
  collectDeps,
  makeRetroDir,
  reportDeps,
  transitionRecord,
} from "../fixtures/retro/harness";

const DELIVERED_SOURCES = [
  "audit-ledger",
  "phase-transitions",
  "closeout-outcomes",
  "commit-telemetry",
  "pm-notes",
  "memory-audit",
] as const;

const change = (changeRef: string): RetroChangeFacts => ({
  changeRef,
  completedAt: "2026-11-06T10:00:00Z",
  transitions: [transitionRecord({ changeRef, timestamp: "2026-11-06T10:00:00Z" })],
});

const presentEvidence: RetroSpendEvidence = {
  state: "present",
  tokensByClass: { input: 100, output: 50, reasoning: 5, cacheRead: 10, cacheWrite: 1 },
  roles: [{ role: "coder", tokens: 120 }],
  models: [{ model: "model-alpha", tokens: 166 }],
  timing: [{ phase: "specification", durationMs: 900_000 }],
  reconciliation: { verdict: "within", tolerance: 0.02, basis: "stream-ingest" },
};

const collected = (evidence: RetroSpendEvidence) => {
  const fixture = makeRetroDir("spend-telemetry");
  fixture.scriptDeliveryChanges([change("GH-291")]);
  fixture.scriptAudit(auditOutcome({ records: [auditRecord({ runId: "audit-GH-291" })] }));
  fixture.scriptStateFamilies("GH-291", {
    transitions: [transitionRecord({ changeRef: "GH-291" })],
    closeouts: [{ outcome: "complete" }],
    telemetry: [],
  });
  fixture.scriptNotes("GH-291", { retroNotes: [] });
  const base = collectDeps(fixture);
  const result = collectRetro(
    collectDeps(fixture, {
      collectors: { ...base.collectors, readSpend: () => evidence },
    }),
  );
  expect(result.ok).toBe(true);
  return fixture;
};

describe("TC-TELEMETRY-027 retro evidence citation", () => {
  test("the delivered evidence source set is preserved and spend joins additively", () => {
    expect([...RETRO_EVIDENCE_SOURCES].slice(0, DELIVERED_SOURCES.length)).toEqual([
      ...DELIVERED_SOURCES,
    ]);
    expect(RETRO_EVIDENCE_SOURCES).toContain("spend-telemetry");
    expect(RETRO_EVIDENCE_SOURCES).toHaveLength(DELIVERED_SOURCES.length + 1);
    expect(RETRO_PAYLOAD_SCHEMAS.spendTelemetry).toBe("delivery.retro.spend-telemetry.v1");
  });

  test("the figures land as collector-truth evidence in the sidecar", () => {
    const fixture = collected(presentEvidence);
    const read = fixture.sidecar.read();
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const spendRecords = read.value.records.filter((record) => record.source === "spend-telemetry");
    expect(spendRecords.length).toBeGreaterThan(0);
    expect(
      spendRecords.every(
        (record) => record.payloadSchemaId === RETRO_PAYLOAD_SCHEMAS.spendTelemetry,
      ),
    ).toBe(true);
    const refs = spendRecords.flatMap((record) => record.payloadRefs);
    expect(refs).toContain("spend:state:present");
    expect(refs).toContain("spend:input:100");
    expect(refs).toContain("spend:role:coder:120");
    expect(refs).toContain("spend:model:model-alpha:166");
    expect(refs).toContain("spend:timing:specification:900000");
    expect(refs).toContain("spend:verdict:within");
    expect(refs).toContain("spend:tolerance:0.02");
    expect(refs).toContain("spend:basis:stream-ingest");
  });

  test("the retro report cites the numbers, the timing, and the verdict", () => {
    const fixture = collected(presentEvidence);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    if (!("findings" in report.data)) throw new Error("not a report");
    const spend = report.data.spend;
    expect(spend).toBeDefined();
    if (spend === undefined || spend.state !== "present") return;
    expect(spend.tokensByClass.input).toBe(100);
    expect(spend.roles).toEqual([{ role: "coder", tokens: 120 }]);
    expect(spend.models).toEqual([{ model: "model-alpha", tokens: 166 }]);
    expect(spend.timing).toEqual([{ phase: "specification", durationMs: 900_000 }]);
    expect(spend.reconciliation).toEqual({
      verdict: "within",
      tolerance: 0.02,
      basis: "stream-ingest",
    });
  });

  test("telemetry absence is cited as the classified absence, never as zeros", () => {
    const fixture = collected({ state: "absent" });
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    if (!("findings" in report.data)) throw new Error("not a report");
    expect(report.data.spend).toEqual({ state: "absent" });
    expect(JSON.stringify(report.data.spend)).not.toContain("tokensByClass");
  });
});
