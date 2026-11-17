/**
 * TC-SUP-094 — the supervision contract is data-only and the report, state,
 * and taxonomy vocabularies have exactly one home (GH-295 DM-1, DM-4, EVT-1).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  DAEMON_LANE_LIVENESS_CLASSIFICATIONS,
  QUEUE_PARK_CAUSES,
  SUPERVISION_ACTION_KINDS,
  SUPERVISION_CLAIM_KINDS,
  SUPERVISION_CLASSIFICATION_INPUT_FIELDS,
  SUPERVISION_DEGRADATION_MARKERS,
  SUPERVISION_EVIDENCE_CODES,
  SUPERVISION_LANE_ENTRY_FIELDS,
  SUPERVISION_OPTIONAL_REPORT_MEMBERS,
  SUPERVISION_REPORT_MEMBERS,
  SUPERVISION_SCHEMA_VERSION,
  SUPERVISION_STATE_FROM_DAEMON_LIVENESS,
  SUPERVISION_STATE_FROM_WATCHDOG_VERDICT,
  SUPERVISION_STATES,
  SUPERVISION_SUPERVISOR_ENTRY_FIELDS,
  SUPERVISION_TRUNCATION_REASONS,
  WATCHDOG_VERDICTS,
} from "../../packages/core/src/contracts/index";
import { dataOnlyViolations } from "./watchdog-contract.test";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/supervise.ts";
const CONTRACTS_DIR = "packages/core/src/contracts";

const contractText = (): string => readFileSync(join(ROOT, CONTRACT), "utf8");

const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();

describe("TC-SUP-094 the supervision contract is pure data", () => {
  test("the contract module is data-only with no runtime import", () => {
    expect(dataOnlyViolations(contractText(), CONTRACT)).toEqual([]);
  });

  test("the data-only guard detects an added helper function", () => {
    const mutated = `${contractText()}\nexport function rogue(): number {\n  return 1;\n}\n`;
    expect(dataOnlyViolations(mutated, CONTRACT).join("\n")).toContain("FunctionDeclaration");
  });
});

describe("TC-SUP-094 the closed vocabularies have one home", () => {
  test("the tri-state set is exactly progressing, stalled, unknown in order", () => {
    expect([...SUPERVISION_STATES]).toEqual(["progressing", "stalled", "unknown"]);
    expect(new Set(SUPERVISION_STATES).size).toBe(SUPERVISION_STATES.length);
  });

  test("the schema version is the declared report identity", () => {
    expect(SUPERVISION_SCHEMA_VERSION).toBe("delivery.supervision.v1");
  });

  test("the claim-kind and action-kind sets are exact", () => {
    expect([...SUPERVISION_CLAIM_KINDS]).toEqual([
      "daemon-instance",
      "coordinator-lease",
      "per-ref-lease",
    ]);
    expect([...SUPERVISION_ACTION_KINDS]).toEqual([
      "supervised-stall-park",
      "safe-boundary-park-intent",
      "restart-admission",
      "exhaustion-record",
      "unavailable-outcome",
    ]);
    expect([...SUPERVISION_DEGRADATION_MARKERS]).toEqual([
      "daemon-absent",
      "artifact-source-absent",
      "partial-read",
    ]);
    expect([...SUPERVISION_TRUNCATION_REASONS]).toEqual(["lane-cap"]);
  });

  test("the report member set is the DM-1 list with one conditional member", () => {
    expect([...SUPERVISION_REPORT_MEMBERS]).toEqual([
      "schemaVersion",
      "repo",
      "lanes",
      "supervisors",
      "actions",
      "counts",
      "degraded",
      "truncated",
      "observedAt",
    ]);
    expect([...SUPERVISION_OPTIONAL_REPORT_MEMBERS]).toEqual(["truncationReason"]);
    expect([...SUPERVISION_LANE_ENTRY_FIELDS]).toEqual([
      "ref",
      "classification",
      "heartbeat",
      "holder",
      "evidence",
    ]);
    expect([...SUPERVISION_SUPERVISOR_ENTRY_FIELDS]).toEqual([
      "claimKind",
      "identity",
      "classification",
      "heartbeat",
      "holder",
      "evidence",
    ]);
  });

  test("the evidence-code vocabulary is unique and code-shaped", () => {
    expect(sortedUnique(SUPERVISION_EVIDENCE_CODES)).toEqual(
      [...SUPERVISION_EVIDENCE_CODES].sort(),
    );
    for (const code of SUPERVISION_EVIDENCE_CODES) {
      expect(code).toMatch(/^[a-z][a-z0-9-]*$/u);
    }
  });

  test("the classification input fields are the artifact-only member list", () => {
    expect([...SUPERVISION_CLASSIFICATION_INPUT_FIELDS]).toEqual([
      "repository",
      "ref",
      "claimKind",
      "identity",
      "sourcePresent",
      "lastHeartbeatAt",
      "firstHeartbeatAt",
      "heartbeatRecordKind",
      "artifactClasses",
      "artifactInstants",
      "artifactAdvancing",
    ]);
  });

  test("no declared classification member is dead (F-12)", () => {
    expect(SUPERVISION_CLASSIFICATION_INPUT_FIELDS).not.toContain("heartbeatOrdinal");
    const domain = readFileSync(join(ROOT, "packages/core/src/domain/supervise.ts"), "utf8");
    const app = readFileSync(join(ROOT, "packages/core/src/app/supervise.ts"), "utf8");
    expect(domain).not.toContain("heartbeatOrdinal");
    expect(app).not.toContain("heartbeatOrdinal");
    // The source-record-kind member is consumed, not merely declared.
    expect(domain).toContain("input.heartbeatRecordKind");
  });

  test("the tri-state is a declared mapping of the delivered vocabularies, not a rename", () => {
    expect([...WATCHDOG_VERDICTS]).toEqual(["ok", "refused", "stalled", "progressing"]);
    expect([...DAEMON_LANE_LIVENESS_CLASSIFICATIONS]).toEqual([
      "progressing",
      "stalled",
      "unknown",
    ]);
    expect(SUPERVISION_STATE_FROM_DAEMON_LIVENESS).toEqual({
      progressing: "progressing",
      stalled: "stalled",
      unknown: "unknown",
    });
    expect(SUPERVISION_STATE_FROM_WATCHDOG_VERDICT).toEqual({
      ok: "progressing",
      progressing: "progressing",
      stalled: "stalled",
      refused: "unknown",
    });
    // A declared mapping is not a second vocabulary: the map values are all
    // tri-state members.
    for (const value of Object.values(SUPERVISION_STATE_FROM_WATCHDOG_VERDICT)) {
      expect(SUPERVISION_STATES).toContain(value);
    }
    for (const value of Object.values(SUPERVISION_STATE_FROM_DAEMON_LIVENESS)) {
      expect(SUPERVISION_STATES).toContain(value);
    }
  });
});

describe("TC-SUP-094 no record kind or event taxonomy member moves", () => {
  const contractConstants = (): Record<string, string> => {
    const constants: Record<string, string> = {};
    for (const file of readdirSync(join(ROOT, CONTRACTS_DIR)).sort()) {
      if (!file.endsWith(".ts")) continue;
      const text = readFileSync(join(ROOT, CONTRACTS_DIR, file), "utf8");
      for (const match of text.matchAll(/export const (\w+) = "([^"]*)" as const;/gu)) {
        constants[`${file}:${match[1] as string}`] = match[2] as string;
      }
    }
    return constants;
  };

  test("the supervision contract declares no record kind, schema, or key prefix", () => {
    const constants = contractConstants();
    const supervision = Object.keys(constants).filter((key) => key.startsWith("supervise.ts:"));
    expect(supervision.length).toBeGreaterThan(0);
    for (const key of supervision) {
      expect(key.endsWith("_RECORD_KIND")).toBe(false);
      expect(key.endsWith("_SCHEMA")).toBe(false);
      expect(key.endsWith("_PAYLOAD_SCHEMA")).toBe(false);
      expect(key.endsWith("_KEY_PREFIX")).toBe(false);
      expect(key.endsWith("_SCHEMA_ID")).toBe(false);
    }
    // The only new schema identity is the report payload.
    expect(SUPERVISION_SCHEMA_VERSION).toBe("delivery.supervision.v1");
    expect(Object.values(constants)).toContain("delivery.supervision.v1");
  });

  test("the delivered park-cause set is the five plus exactly liveness-stall", () => {
    expect([...QUEUE_PARK_CAUSES]).toEqual([
      "provider-window",
      "provider-quota",
      "preempted-for-close-item",
      "peak-window",
      "owner-hold",
      "liveness-stall",
    ]);
  });

  test("the module AST declares only types, imports, exports, and variables", () => {
    const source = ts.createSourceFile(
      CONTRACT,
      contractText(),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const allowed = new Set<number>([
      ts.SyntaxKind.TypeAliasDeclaration,
      ts.SyntaxKind.InterfaceDeclaration,
      ts.SyntaxKind.ImportDeclaration,
      ts.SyntaxKind.ExportDeclaration,
      ts.SyntaxKind.VariableStatement,
      ts.SyntaxKind.EndOfFileToken,
    ]);
    for (const statement of source.statements) {
      expect(allowed.has(statement.kind), ts.SyntaxKind[statement.kind]).toBe(true);
    }
  });
});
