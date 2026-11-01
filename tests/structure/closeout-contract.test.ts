/**
 * TC-CLOSE-001 / TC-CLOSE-002 — the closeout contract vocabulary and the
 * additive adapter extensions are exact, ordered, and declaration-only.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { GITHUB_ADAPTER_CONTRACT } from "../../packages/adapters/src/github/capabilities";
import { GITLAB_ADAPTER_CONTRACT } from "../../packages/adapters/src/gitlab/capabilities";
import { JIRA_ADAPTER_CONTRACT } from "../../packages/adapters/src/jira/capabilities";
import {
  ADAPTER_OPERATIONS,
  type AdapterCapabilityDeclaration,
  BLOCKED_LABEL,
  CHANGE_LABEL,
  CLOSEOUT_APPLY_OUTCOMES,
  CLOSEOUT_GAP_REASONS,
  CLOSEOUT_INTEGRATION_BASE,
  CLOSEOUT_MAX_DEPENDENTS,
  CLOSEOUT_MAX_HUMAN_BYTES,
  CLOSEOUT_MAX_HUMAN_LINES,
  CLOSEOUT_MAX_MACHINE_BYTES,
  CLOSEOUT_MAX_THREADS,
  CLOSEOUT_OPERATION_NAMES,
  CLOSEOUT_OPERATION_PAYLOAD_SCHEMA,
  CLOSEOUT_OPERATION_RECORD_KIND,
  CLOSEOUT_OPERATION_TIMEOUT_MS,
  CLOSEOUT_PLAN_OUTCOMES,
  CLOSEOUT_READ_OBSERVATIONS,
  CLOSEOUT_SCHEMA_ID,
  CLOSEOUT_STEP_IDS,
  DELIVERED_LABEL,
  LIFECYCLE_LABEL_DISPOSITIONS,
  OWNER_ATTENTION_LABEL,
  PROTECTED_REF_NAMES,
} from "../../packages/core/src/contracts/index";
import { CONFORMANCE_FLOWS } from "../../packages/testkit/src/conformance/flows";
import { scan } from "../../scripts/checks/ambient-globals";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/closeout.ts";

const EXPECTED_STEPS = [
  "ticket-to-done",
  "lifecycle-label-sweep",
  "unassign",
  "owed-flip-sweep",
  "comment-resolution",
  "checkout-restore",
  "branch-cleanup",
];

const EXPECTED_DISPOSITIONS = [
  ["change", "keep"],
  ["planning", "remove"],
  ["spec-ready", "remove"],
  ["readiness-passed", "remove"],
  ["in-progress", "remove"],
  ["review", "remove"],
  ["blocked", "remove"],
  ["delivered", "add"],
];

const declarationViolations = (relative: string): string[] => {
  const source = ts.createSourceFile(
    relative,
    readFileSync(join(ROOT, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: string[] = [];
  const isAsConst = (node: ts.Expression | undefined): boolean => {
    if (node === undefined) return false;
    if (ts.isAsExpression(node)) return node.type.getText() === "const";
    if (ts.isSatisfiesExpression(node)) return isAsConst(node.expression);
    return false;
  };
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      violations.push(`executable declaration ${statement.name?.text ?? "<anonymous>"}`);
      continue;
    }
    if (ts.isExpressionStatement(statement) || ts.isIfStatement(statement)) {
      violations.push("top-level executable statement");
      continue;
    }
    if (ts.isImportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;
      if (ts.isStringLiteral(specifier) && /^(node:|bun:)/.test(specifier.text)) {
        violations.push(`runtime import ${specifier.text}`);
      }
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!isAsConst(declaration.initializer)) {
          violations.push(`non-as-const data declaration ${declaration.name.getText(source)}`);
        }
      }
    }
  }
  return violations;
};

const operationsInFlows = new Set<string>(
  CONFORMANCE_FLOWS.flatMap((flow) => flow.steps.map((step) => step.operation)),
);

const partitionViolations = (
  name: string,
  capabilities: AdapterCapabilityDeclaration,
): string[] => {
  const failures: string[] = [];
  const supported = capabilities.supportedOperations;
  const gaps = capabilities.declaredGaps.map((gap) => gap.operation);
  for (const operation of ADAPTER_OPERATIONS) {
    const inSupported = supported.filter((entry) => entry === operation).length;
    const inGaps = gaps.filter((entry) => entry === operation).length;
    if (inSupported + inGaps !== 1) {
      failures.push(`${name}:${operation} must appear exactly once across supported and gaps`);
    }
    if (inSupported > 0 && capabilities.supportedOperations.indexOf(operation) < 0) {
      failures.push(`${name}:${operation} supported but absent`);
    }
  }
  for (const operation of [...supported, ...gaps]) {
    if (!(ADAPTER_OPERATIONS as readonly string[]).includes(operation)) {
      failures.push(`${name}: unknown operation ${operation}`);
    }
  }
  return failures;
};

describe("TC-CLOSE-001 closeout contract vocabulary", () => {
  test("the seven step ids are exact and ordered", () => {
    expect([...CLOSEOUT_STEP_IDS]).toEqual(EXPECTED_STEPS);
    expect(CLOSEOUT_STEP_IDS).toHaveLength(7);
  });

  test("the label disposition table is exact and ordered", () => {
    expect(LIFECYCLE_LABEL_DISPOSITIONS.map((entry) => [entry.label, entry.disposition])).toEqual(
      EXPECTED_DISPOSITIONS,
    );
    expect(CHANGE_LABEL).toBe("change");
    expect(DELIVERED_LABEL).toBe("delivered");
    expect(BLOCKED_LABEL).toBe("blocked");
    expect(OWNER_ATTENTION_LABEL).toBe("hand-back");
  });

  test("the protected refs and integration base are exact", () => {
    expect([...PROTECTED_REF_NAMES]).toEqual(["main", "main-tools", "HEAD"]);
    expect(CLOSEOUT_INTEGRATION_BASE).toBe("main-tools");
  });

  test("the outcome, gap, operation, observation, and cap vocabularies are exact", () => {
    expect([...CLOSEOUT_PLAN_OUTCOMES]).toEqual([
      "would-apply",
      "satisfied",
      "skipped-gap",
      "skipped-noop",
      "would-refuse",
    ]);
    expect([...CLOSEOUT_APPLY_OUTCOMES]).toEqual([
      "applied",
      "satisfied",
      "skipped-gap",
      "skipped-noop",
      "failed",
      "refused",
    ]);
    expect([...CLOSEOUT_GAP_REASONS]).toEqual([
      "provider-unsupported",
      "adapter-not-implemented",
      "plan-restriction",
    ]);
    expect([...CLOSEOUT_OPERATION_NAMES]).toEqual([
      "transition-work-item",
      "write-work-item",
      "resolve-delivery-thread",
      "restore-checkout",
      "delete-branch",
    ]);
    expect([...CLOSEOUT_READ_OBSERVATIONS]).toEqual([
      "observed",
      "not-found",
      "unavailable",
      "invalid",
    ]);
    expect(CLOSEOUT_MAX_DEPENDENTS).toBe(200);
    expect(CLOSEOUT_MAX_THREADS).toBe(100);
    expect(CLOSEOUT_OPERATION_TIMEOUT_MS).toBe(30_000);
    expect(CLOSEOUT_MAX_MACHINE_BYTES).toBe(65_536);
    expect(CLOSEOUT_MAX_HUMAN_LINES).toBe(200);
    expect(CLOSEOUT_MAX_HUMAN_BYTES).toBe(16_384);
    expect(CLOSEOUT_SCHEMA_ID).toBe("delivery.closeout.v1");
    expect(CLOSEOUT_OPERATION_PAYLOAD_SCHEMA).toBe("delivery.closeout.operation.v1");
    expect(CLOSEOUT_OPERATION_RECORD_KIND).toBe("closeout.operation");
  });

  test("the contract module is declaration-only and ambient-clean", () => {
    expect(declarationViolations(CONTRACT)).toEqual([]);
    expect(scan(ROOT)).toEqual([]);
  });
});

describe("TC-CLOSE-002 additive adapter extensions and conformance registry", () => {
  test("resolve-delivery-thread is the appended eighth closed operation", () => {
    expect([...ADAPTER_OPERATIONS]).toHaveLength(8);
    expect(ADAPTER_OPERATIONS[7]).toBe("resolve-delivery-thread");
  });

  test("the flow registry covers the closed operation set exactly", () => {
    expect([...operationsInFlows].sort()).toEqual([...ADAPTER_OPERATIONS].sort());
  });

  test("the change-lifecycle flow appends the thread step last", () => {
    const changeLifecycle = CONFORMANCE_FLOWS.find((flow) => flow.flowId === "change-lifecycle");
    expect(changeLifecycle?.steps.map((step) => step.stepId)).toEqual([
      "change-lifecycle.read-work-item",
      "change-lifecycle.read-delivery-request",
      "change-lifecycle.read-pipeline-run",
      "change-lifecycle.open-change",
      "change-lifecycle.transition",
      "change-lifecycle.create-delivery-request",
      "change-lifecycle.comment",
      "change-lifecycle.resolve-delivery-thread",
    ]);
    expect(CONFORMANCE_FLOWS.flatMap((flow) => flow.steps)).toHaveLength(13);
    expect(CONFORMANCE_FLOWS.flatMap((flow) => flow.steps)[7]?.stepId).toBe(
      "change-lifecycle.resolve-delivery-thread",
    );
  });

  test("each adapter partitions the closed set exactly once with no duplicates", () => {
    const failures = [
      ...partitionViolations("github", GITHUB_ADAPTER_CONTRACT.capabilities),
      ...partitionViolations("gitlab", GITLAB_ADAPTER_CONTRACT.capabilities),
      ...partitionViolations("jira", JIRA_ADAPTER_CONTRACT.capabilities),
    ];
    expect(failures).toEqual([]);
  });

  test("headSha is declared optional on DeliveryRequest", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/contracts/ports.ts"), "utf8");
    expect(source).toContain("readonly headSha?: string;");
  });
});
