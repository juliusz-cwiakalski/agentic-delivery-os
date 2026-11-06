/**
 * TC-RETRO-001 / TC-RETRO-007 / TC-RETRO-057 (contract halves) — the retro
 * vocabulary is declaration-only, closed, and carries the spec field sets.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  RETRO_CHAIN_ANCHOR,
  RETRO_CHAIN_KEY_BYTES,
  RETRO_CHAIN_KEY_PAYLOAD_SCHEMA,
  RETRO_CHAIN_VALUE_HEX_LENGTH,
  RETRO_DEFAULT_LEVEL,
  RETRO_ERROR_CODES,
  RETRO_EVIDENCE_FIELDS,
  RETRO_EVIDENCE_PAYLOAD_SCHEMA,
  RETRO_EVIDENCE_RECORD_KIND,
  RETRO_EXPORT_MAX_LIMIT,
  RETRO_EXPORT_SCHEMA,
  RETRO_FINDING_KINDS,
  RETRO_FOLLOW_THROUGH_VERDICTS,
  RETRO_IMPLEMENTED_LEVELS,
  RETRO_LEVEL_NAMES,
  RETRO_LEVEL_OWNING_STORIES,
  RETRO_LEVEL_RECORD_KIND,
  RETRO_LEVEL_STATUSES,
  RETRO_LEVELS,
  RETRO_MODES,
  RETRO_PAYLOAD_SCHEMAS,
  RETRO_REGISTRY_BOUNDARY_DECLARATION,
  RETRO_REPORT_SCHEMA,
  RETRO_RUN_RECORD_KIND,
  RETRO_SCOPE_KINDS,
  RETRO_TARGET_ORDER,
  RETRO_TRIGGER_KINDS,
  RETRO_TRIGGER_RECORD_KIND,
  RETRO_TRUTH_CHECKS,
  retroChainKeyArtifactName,
  retroChainKeyPath,
  retroEvidenceArtifactName,
  retroEvidencePath,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const MODULE = "packages/core/src/contracts/retro.ts";

const sourceOf = (): ts.SourceFile =>
  ts.createSourceFile(
    MODULE,
    readFileSync(join(ROOT, MODULE), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

const fieldNames = (source: ts.SourceFile, typeName: string): string[] => {
  for (const statement of source.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== typeName) continue;
    if (!ts.isTypeLiteralNode(statement.type)) return [];
    return statement.type.members
      .filter(ts.isPropertySignature)
      .map((member) => (ts.isIdentifier(member.name) ? member.name.text : member.name.getText()));
  }
  return [];
};

const distinct = (values: readonly string[]): boolean => new Set(values).size === values.length;

describe("TC-RETRO-001 contract vocabulary and data-only shapes", () => {
  test("the module is declaration-only (types, imports, and as-const data)", () => {
    const source = sourceOf();
    const allowed = new Set([
      ts.SyntaxKind.TypeAliasDeclaration,
      ts.SyntaxKind.InterfaceDeclaration,
      ts.SyntaxKind.ImportDeclaration,
      ts.SyntaxKind.ExportDeclaration,
      ts.SyntaxKind.VariableStatement,
      ts.SyntaxKind.EndOfFileToken,
    ]);
    const unexpected = source.statements
      .filter((statement) => !allowed.has(statement.kind))
      .map((statement) => ts.SyntaxKind[statement.kind]);
    expect(unexpected).toEqual([]);
  });

  test("closed vocabularies are non-empty, exact, and duplicate-free", () => {
    expect(RETRO_LEVEL_NAMES).toEqual([
      "change",
      "session",
      "incident",
      "window",
      "project",
      "fleet",
    ]);
    expect(RETRO_LEVEL_STATUSES).toEqual(["implemented", "declared"]);
    expect(RETRO_MODES).toEqual(["collect", "report"]);
    expect(RETRO_FINDING_KINDS).toEqual([
      "retro-note",
      "collector-finding",
      "truth-check",
      "tamper-flag",
      "malformed-entry",
      "verified-empty",
    ]);
    expect(RETRO_FOLLOW_THROUGH_VERDICTS).toEqual(["verified", "unverified", "unknown"]);
    expect(RETRO_TRIGGER_KINDS).toEqual(["schedule", "event", "lifecycle"]);
    expect(RETRO_TRUTH_CHECKS).toEqual(["C-01", "C-02", "C-03", "C-04", "C-05"]);
    for (const vocabulary of [
      RETRO_LEVEL_NAMES,
      RETRO_LEVEL_STATUSES,
      RETRO_MODES,
      RETRO_FINDING_KINDS,
      RETRO_FOLLOW_THROUGH_VERDICTS,
      RETRO_TRIGGER_KINDS,
      RETRO_TRUTH_CHECKS,
    ]) {
      expect(vocabulary.length).toBeGreaterThan(0);
      expect(distinct(vocabulary)).toBe(true);
    }
  });

  test("six levels are declared with exactly one implemented", () => {
    expect(RETRO_LEVELS).toHaveLength(6);
    expect(RETRO_LEVELS.map((level) => level.name)).toEqual([...RETRO_LEVEL_NAMES]);
    expect(RETRO_LEVELS.map((level) => level.id)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6"]);
    expect(RETRO_LEVELS.filter((level) => level.status === "implemented").map((l) => l.name)).toEqual(
      ["change"],
    );
    expect([...RETRO_IMPLEMENTED_LEVELS]).toEqual(["change"]);
    expect(RETRO_DEFAULT_LEVEL).toBe("change");
    for (const level of RETRO_LEVELS) {
      expect(RETRO_SCOPE_KINDS).toContain(level.scopeKind);
      expect(RETRO_TRIGGER_KINDS).toContain(level.trigger.kind);
      expect(level.trigger.kind === "schedule" ? level.trigger.cadence : "x").toBeTruthy();
      expect(RETRO_LEVEL_OWNING_STORIES[level.name].length).toBeGreaterThan(0);
    }
    for (const level of ["session", "incident", "window", "project"] as const) {
      expect(RETRO_LEVEL_OWNING_STORIES[level]).toBe("M2-S3 (ceremony runner)");
    }
    expect(RETRO_LEVEL_OWNING_STORIES.fleet).toBe("post-M4 fleet retro (unscheduled)");
  });

  test("record shapes carry the spec field sets", () => {
    const source = sourceOf();
    expect(fieldNames(source, "RetroEvidenceRecord")).toEqual([...RETRO_EVIDENCE_FIELDS]);
    expect(fieldNames(source, "RetroChainVerdict")).toEqual(
      expect.arrayContaining(["verified", "records", "breaks", "anchor", "affectedDomain"]),
    );
    expect(fieldNames(source, "RetroRunRecord")).toEqual(
      expect.arrayContaining([
        "schemaId",
        "runId",
        "level",
        "mode",
        "scope",
        "counts",
        "consumed",
        "truth",
      ]),
    );
    expect(fieldNames(source, "RetroReportData")).toEqual([
      "level",
      "findings",
      "followThrough",
      "evidenceRefs",
    ]);
    expect(fieldNames(source, "RetroExportBundle")).toEqual(
      expect.arrayContaining(["schemaId", "limit", "truncated", "chain", "records"]),
    );
    expect(fieldNames(source, "RetroLevelRecord")).toEqual(
      expect.arrayContaining(["name", "levelId", "scopeKind", "trigger", "status"]),
    );
    expect(fieldNames(source, "RetroTriggerRecord")).toEqual(
      expect.arrayContaining(["name", "kind", "cadence", "owningBinding"]),
    );
    expect(fieldNames(source, "RetroRunCounts")).toEqual([
      "collected",
      "malformed",
      "skippedSource",
    ]);
  });

  test("report and export schema identities are distinct contract constants", () => {
    expect(RETRO_REPORT_SCHEMA).toBe("delivery.retro.report.v1");
    expect(RETRO_EXPORT_SCHEMA).toBe("delivery.retro.export.v1");
    expect(RETRO_REPORT_SCHEMA).not.toBe(RETRO_EXPORT_SCHEMA);
    const source = readFileSync(join(ROOT, MODULE), "utf8");
    expect(source).not.toContain("reportSchemaId:");
    expect(source).not.toContain("schemaVersion: RETRO_REPORT_SCHEMA");
  });

  test("the three registry record kinds are exact and distinct", () => {
    expect(RETRO_REGISTRY_BOUNDARY_DECLARATION.kinds.map((kind) => kind.kind)).toEqual([
      RETRO_LEVEL_RECORD_KIND,
      RETRO_RUN_RECORD_KIND,
      RETRO_TRIGGER_RECORD_KIND,
    ]);
    expect(RETRO_LEVEL_RECORD_KIND).toBe("retro.level");
    expect(RETRO_RUN_RECORD_KIND).toBe("retro.run");
    expect(RETRO_TRIGGER_RECORD_KIND).toBe("retro.trigger");
    expect(RETRO_REGISTRY_BOUNDARY_DECLARATION.kinds).toHaveLength(3);
  });

  test("the four retro codes are declared exactly once and the audit read outcome is consumed", () => {
    expect(RETRO_ERROR_CODES).toEqual([
      "retro.evidence.malformed-entry",
      "retro.evidence.tamper-flagged",
      "retro.truth.vacuous-run",
      "retro.evidence.denied",
    ]);
    expect(distinct(RETRO_ERROR_CODES)).toBe(true);
    const source = readFileSync(join(ROOT, MODULE), "utf8");
    expect(source).toContain('from "./audit.js"');
    expect(source).toContain("AuditReadOutcome");
    expect(source).not.toContain("export type AuditReadOutcome");
    expect(source).not.toContain("export interface AuditReadOutcome");
  });

  test("chain constants are pinned and the artifact families are distinct", () => {
    expect(RETRO_CHAIN_ANCHOR).toBe("retro.chain.anchor.v1");
    expect(RETRO_CHAIN_VALUE_HEX_LENGTH).toBe(64);
    expect(RETRO_CHAIN_KEY_BYTES).toBe(32);
    expect(RETRO_CHAIN_KEY_PAYLOAD_SCHEMA).toBe("delivery.retro.chain-key.v1");
    expect(RETRO_EVIDENCE_RECORD_KIND).toBe("retro.evidence");
    expect(RETRO_EVIDENCE_PAYLOAD_SCHEMA).toBe("delivery.retro.evidence.v1");
    expect(RETRO_PAYLOAD_SCHEMAS.finding).toBe("delivery.retro.finding.v1");
    expect(RETRO_PAYLOAD_SCHEMAS.verifiedEmpty).toBe("delivery.retro.verified-empty.v1");
    expect(retroEvidenceArtifactName("workspace-a")).toBe("retro-evidence.workspace-a.jsonl");
    expect(retroChainKeyArtifactName("workspace-a")).toBe("chain-key.retro.workspace-a.json");
    expect(retroEvidencePath("/state", "workspace-a")).toBe(
      "/state/retro-evidence.workspace-a.jsonl",
    );
    expect(retroChainKeyPath("/state", "workspace-a")).toBe(
      "/state/chain-key.retro.workspace-a.json",
    );
    expect(retroChainKeyArtifactName("workspace-a")).not.toBe("chain-key.workspace-a.json");
  });

  test("declared bounds and the target ordering are pinned data", () => {
    expect(RETRO_EXPORT_MAX_LIMIT).toBe(1000);
    expect(RETRO_TARGET_ORDER).toBe("completion-desc-ref-asc");
  });
});
