/**
 * TC-COORD-001 — the coordinator vocabularies and record schemas have one
 * data-only home.
 *
 * The module is inspected as source: it declares closed sets, record kinds,
 * payload schemas, store-scoped keys, bounds, the regime descriptor, the
 * capability declaration, and the two named state-fence rules. It contains no
 * call expression, no function, no `new`, no `await`, and no runtime import, so
 * no clock, randomness, environment, filesystem, process, CPU, or model read can
 * be reached from the vocabulary.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  COORDINATOR_CAPABILITY_OWNERSHIP,
  COORDINATOR_CONFIG_KEYS,
  COORDINATOR_ERROR_CODES,
  COORDINATOR_EVIDENCE_CLASSES,
  COORDINATOR_EVIDENCE_STATES,
  COORDINATOR_EXHAUSTION_OPTIONS,
  COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA,
  COORDINATOR_EXHAUSTION_RECORD_KIND,
  COORDINATOR_FENCE_ACTIONS,
  COORDINATOR_FENCE_PAYLOAD_SCHEMA,
  COORDINATOR_FENCE_RECORD_KIND,
  COORDINATOR_ITERATION_PAYLOAD_SCHEMA,
  COORDINATOR_ITERATION_RECORD_KIND,
  COORDINATOR_KILL_FAILURE_REASONS,
  COORDINATOR_KILL_OUTCOMES,
  COORDINATOR_LEASE_LIVENESS_STATES,
  COORDINATOR_LIFECYCLE_DECISIONS,
  COORDINATOR_MAX_DATA_BYTES,
  COORDINATOR_MAX_EVIDENCE_BYTES,
  COORDINATOR_MAX_HUMAN_LINES,
  COORDINATOR_OBSERVATION_SCHEMA,
  COORDINATOR_OTHER_QUESTION_BOUND,
  COORDINATOR_PROCESS_CAPABILITIES,
  COORDINATOR_RECORD_KINDS,
  COORDINATOR_REGIME,
  COORDINATOR_RENDERED_QUESTION_BOUND,
  COORDINATOR_RESERVED_ESCALATION_PREDICATE,
  COORDINATOR_RESTART_PAYLOAD_SCHEMA,
  COORDINATOR_RESTART_RECORD_KIND,
  COORDINATOR_RESTART_REASONS,
  COORDINATOR_STATE_FENCE_REFUSALS,
  COORDINATOR_STATE_FENCE_RULES,
  COORDINATOR_STUCK_PAYLOAD_SCHEMA,
  COORDINATOR_STUCK_PHASES,
  COORDINATOR_STUCK_REASONS,
  COORDINATOR_STUCK_RECORD_KIND,
  COORDINATOR_SUPERVISOR_MODES,
  COORDINATOR_THREE_SEGMENT_CODES,
  COORDINATOR_TWO_SEGMENT_CODES,
  COORDINATOR_V1_SUPERVISOR_MODE,
  COORDINATOR_VERDICTS,
  COORDINATOR_WAKE_OUTCOMES,
  COORDINATOR_WAKE_PAYLOAD_SCHEMA,
  COORDINATOR_WAKE_RECORD_KIND,
  COORDINATOR_WAKE_TICK_RESULTS,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const MODULE_PATH = "packages/core/src/contracts/coordinator.ts";

const source = ts.createSourceFile(
  MODULE_PATH,
  readFileSync(join(ROOT, MODULE_PATH), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

const walk = (node: ts.Node, visit: (candidate: ts.Node) => void): void => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

const RECORDS = [
  COORDINATOR_ITERATION_RECORD_KIND,
  COORDINATOR_RESTART_RECORD_KIND,
  COORDINATOR_STUCK_RECORD_KIND,
  COORDINATOR_EXHAUSTION_RECORD_KIND,
  COORDINATOR_WAKE_RECORD_KIND,
  COORDINATOR_FENCE_RECORD_KIND,
] as const;

const SCHEMAS = [
  COORDINATOR_ITERATION_PAYLOAD_SCHEMA,
  COORDINATOR_RESTART_PAYLOAD_SCHEMA,
  COORDINATOR_STUCK_PAYLOAD_SCHEMA,
  COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA,
  COORDINATOR_WAKE_PAYLOAD_SCHEMA,
  COORDINATOR_FENCE_PAYLOAD_SCHEMA,
] as const;

describe("TC-COORD-001 coordinator vocabulary is one data-only home", () => {
  test("exactly six record kinds with distinct payload schemas", () => {
    expect(COORDINATOR_RECORD_KINDS).toHaveLength(6);
    expect(new Set(COORDINATOR_RECORD_KINDS).size).toBe(6);
    expect([...RECORDS]).toEqual([...COORDINATOR_RECORD_KINDS]);
    expect(new Set(SCHEMAS).size).toBe(6);
    for (const schema of SCHEMAS) expect(schema.startsWith("delivery.coordinator.")).toBe(true);
    expect(new Set(SCHEMAS).size).toBe(new Set(RECORDS).size);
  });

  test("the closed vocabularies are the declared Appendix B sets", () => {
    expect([...COORDINATOR_LIFECYCLE_DECISIONS]).toEqual([
      "join-live",
      "resume-context",
      "spawn-fresh",
    ]);
    expect([...COORDINATOR_RESTART_REASONS]).toEqual([
      "stuck-artifact-evidence",
      "session-interrupted",
      "context-pressure",
      "context-unknown",
    ]);
    expect([...COORDINATOR_VERDICTS]).toEqual(["progressing", "stuck", "unevaluable"]);
    expect([...COORDINATOR_STUCK_PHASES]).toEqual(["verdict", "outcome"]);
    expect([...COORDINATOR_STUCK_REASONS]).toEqual([
      "stuck-artifact-evidence",
      "evidence-unevaluable",
    ]);
    expect([...COORDINATOR_EVIDENCE_CLASSES]).toEqual(["digest-consumed", "merge", "answer"]);
    expect([...COORDINATOR_EVIDENCE_STATES]).toEqual(["advanced", "stale", "unknown"]);
    expect([...COORDINATOR_KILL_OUTCOMES]).toEqual([
      "terminated",
      "forced",
      "failed",
      "not-attempted",
    ]);
    expect([...COORDINATOR_KILL_FAILURE_REASONS]).toEqual(["identity-mismatch"]);
    expect([...COORDINATOR_WAKE_OUTCOMES]).toEqual([
      "woken",
      "already-woken",
      "answered-before-wake",
      "delivery-failed",
      "no-pickup",
    ]);
    expect([...COORDINATOR_WAKE_TICK_RESULTS]).not.toContain("woken");
    expect([...COORDINATOR_FENCE_ACTIONS]).toEqual([
      "acquired",
      "released",
      "stale-takeover",
      "stop-requested",
    ]);
    expect([...COORDINATOR_LEASE_LIVENESS_STATES]).toEqual([
      "held",
      "takeover-eligible",
      "age-fallback-takeover",
      "unheld",
    ]);
    expect([...COORDINATOR_EXHAUSTION_OPTIONS]).toEqual([
      "restart-fresh-budget",
      "park-owner-review",
    ]);
  });

  test("the supervisor mode is foreground-only in v1 and detached stays reserved", () => {
    expect([...COORDINATOR_SUPERVISOR_MODES]).toEqual(["foreground", "detached"]);
    expect(COORDINATOR_V1_SUPERVISOR_MODE).toBe("foreground");
    expect(COORDINATOR_REGIME.supervisorMode).toBe("foreground");
    expect(COORDINATOR_REGIME.externalUnit).toBe("absent");
    expect(COORDINATOR_REGIME.daemonInstallSeam).toBe("M1-S18");
    expect(COORDINATOR_REGIME.collectionBoundMultiplier).toBe(2);
  });

  test("the six config key paths and six error identities are declared once", () => {
    expect([...COORDINATOR_CONFIG_KEYS]).toEqual([
      "coordinator.stuck-window",
      "coordinator.kill-grace",
      "coordinator.restart-budget",
      "coordinator.resume-context-limit",
      "coordinator.collection-interval",
      "coordinator.progress-bound",
    ]);
    expect([...COORDINATOR_ERROR_CODES]).toHaveLength(6);
    expect(new Set(COORDINATOR_ERROR_CODES).size).toBe(6);
    expect([...COORDINATOR_TWO_SEGMENT_CODES]).toEqual([
      "coordinator.already-running",
      "coordinator.restart-budget-exhausted",
    ]);
    expect([...COORDINATOR_THREE_SEGMENT_CODES]).toHaveLength(4);
    for (const code of COORDINATOR_THREE_SEGMENT_CODES) {
      expect(code.split(".").length, code).toBeGreaterThan(2);
    }
  });

  test("the two state-fence rules are distinct data with distinct refusal identities", () => {
    expect([...COORDINATOR_STATE_FENCE_RULES]).toEqual(["claim-acquire", "non-claim-append"]);
    expect(COORDINATOR_STATE_FENCE_REFUSALS["claim-acquire"]).toBe("coordinator.already-running");
    expect(COORDINATOR_STATE_FENCE_REFUSALS["non-claim-append"]).toBe("state.lock.busy");
  });

  test("the reserved escalation slot is a payload-only predicate datum", () => {
    expect(COORDINATOR_RESERVED_ESCALATION_PREDICATE).toEqual({
      type: "decision-needed",
      audience: "owner",
      lane: "coordinator",
      refSeparator: "#",
      refParts: 2,
    });
    expect(COORDINATOR_RENDERED_QUESTION_BOUND).toBe(8);
    expect(COORDINATOR_OTHER_QUESTION_BOUND).toBe(7);
  });

  test("the regime and capability declarations carry the declared fields", () => {
    expect(COORDINATOR_OBSERVATION_SCHEMA).toBe("delivery.coordinator.v1");
    expect(COORDINATOR_MAX_DATA_BYTES).toBe(65_536);
    expect(COORDINATOR_MAX_HUMAN_LINES).toBe(32);
    expect(COORDINATOR_MAX_EVIDENCE_BYTES).toBe(512);
    expect([...COORDINATOR_PROCESS_CAPABILITIES]).toEqual([
      "alive",
      "kill-with-grace",
      "start-time-identity",
    ]);
    expect(COORDINATOR_CAPABILITY_OWNERSHIP["process-port"].identity).toBe(
      "coordinator.process.capability-gap",
    );
    expect(COORDINATOR_CAPABILITY_OWNERSHIP["harness-resume"].identity).toBeNull();
    expect(COORDINATOR_CAPABILITY_OWNERSHIP["harness-resume"].decisionReason).toBe(
      "session-interrupted",
    );
    expect(COORDINATOR_CAPABILITY_OWNERSHIP.progress.absence).toBe("unknown-evidence");
  });

  test("the module declares no executable statement and imports nothing", () => {
    const violations: string[] = [];
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)) {
        violations.push("unexpected import");
        continue;
      }
      if (ts.isExportDeclaration(statement)) continue;
      if (ts.isTypeAliasDeclaration(statement)) continue;
      if (ts.isInterfaceDeclaration(statement)) continue;
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (declaration.initializer === undefined) {
            violations.push("uninitialised declaration");
            continue;
          }
          walk(declaration.initializer, (node) => {
            if (
              ts.isCallExpression(node) ||
              ts.isNewExpression(node) ||
              ts.isAwaitExpression(node) ||
              ts.isFunctionExpression(node) ||
              ts.isArrowFunction(node) ||
              ts.isTemplateExpression(node)
            ) {
              violations.push(`executable node ${ts.SyntaxKind[node.kind]}`);
            }
          });
        }
        continue;
      }
      violations.push(`unexpected statement ${ts.SyntaxKind[statement.kind]}`);
    }
    expect(violations).toEqual([]);
    for (const node of [source]) {
      walk(node, (candidate) => {
        if (ts.isFunctionDeclaration(candidate)) violations.push("function declaration");
      });
    }
    expect(violations).toEqual([]);
  });
});
