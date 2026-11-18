/**
 * TC-REG-001 / TC-REG-004 / TC-REG-005 — exactly five participation items, the
 * seven-module identity-construct bound set with its exact allowlist, and the
 * three independent refusals.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADAPTER_OPERATIONS } from "@delivery-os/core/contracts";
import {
  isClosedOperation,
  operationRefusal,
  PARTICIPATION_CONTRACT,
  PARTICIPATION_ITEMS,
  PARTICIPATION_REFUSALS,
  participationRefusal,
  participationViolations,
} from "@delivery-os/testkit";
import ts from "typescript";

const ROOT = process.cwd();
const ALLOWLIST = "tests/fixtures/providers/conformance/parity/identity-scan-allowlist.json";
const PROVIDERS = ["github", "gitlab", "jira"] as const;
const CONTRACT_NAMES = [
  "GITHUB_ADAPTER_CONTRACT",
  "GITLAB_ADAPTER_CONTRACT",
  "JIRA_ADAPTER_CONTRACT",
] as const;

type Allowlist = {
  readonly provenance: string;
  readonly boundModules: readonly string[];
  readonly permits: ReadonlyArray<{
    readonly file: string;
    readonly construct: string;
    readonly count?: number;
  }>;
  readonly parityColumnDerivation: string;
};

export type IdentityHit = { readonly file: string; readonly construct: string };

const allowlist = JSON.parse(readFileSync(join(ROOT, ALLOWLIST), "utf8")) as Allowlist;

const isProviderToken = (value: string): boolean =>
  (PROVIDERS as readonly string[]).includes(value) ||
  (CONTRACT_NAMES as readonly string[]).includes(value);

const isProviderDiscriminant = (node: ts.Node): boolean => {
  if (ts.isIdentifier(node)) return node.text === "provider";
  if (ts.isPropertyAccessExpression(node)) return node.name.text === "provider";
  return false;
};

/** Scan one module for the binding identity-construct definition. */
export const identityConstructs = (file: string, text: string): IdentityHit[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const hits: IdentityHit[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      isProviderToken(node.text)
    ) {
      hits.push({ file, construct: "provider-name-literal" });
    }
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind;
      if (
        (operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          operator === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
        ((isProviderDiscriminant(node.left) &&
          ts.isStringLiteral(node.right) &&
          isProviderToken(node.right.text)) ||
          (isProviderDiscriminant(node.right) &&
            ts.isStringLiteral(node.left) &&
            isProviderToken(node.left.text)))
      ) {
        hits.push({ file, construct: "provider-comparison" });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
};

const scanFile = (file: string): IdentityHit[] =>
  identityConstructs(file, readFileSync(join(ROOT, file), "utf8"));

const allowlistViolations = (value: Allowlist): string[] => {
  const violations: string[] = [];
  if (value.boundModules.length !== 7) {
    violations.push(`bound set must contain seven modules, found ${value.boundModules.length}`);
  }
  for (const module of value.boundModules) {
    if (!module.startsWith("packages/testkit/src/conformance/")) {
      violations.push(`${module}: bound module is outside the conformance tier`);
    }
  }
  const permitKeys = value.permits.map((permit) => `${permit.file}|${permit.construct}`);
  if (new Set(permitKeys).size !== permitKeys.length) {
    violations.push("permit list contains a duplicate (file, construct) entry");
  }
  if (permitKeys.some((key) => key.includes("*"))) {
    violations.push("permit list contains a wildcard");
  }
  for (const permit of value.permits) {
    if (!Number.isInteger(permit.count) || (permit.count ?? 0) < 1) {
      violations.push(`${permit.file}|${permit.construct}: permit must pin an occurrence count`);
    }
  }
  const runner = value.permits.filter((permit) => permit.file.endsWith("/runner.ts"));
  if (runner.length !== 1 || runner[0]?.construct !== "provider-comparison") {
    violations.push("runner.ts must have exactly one provider-comparison permit");
  }
  if (runner[0]?.count !== 5) {
    violations.push("runner.ts permit must record exactly five comparisons");
  }
  const addressingDecode = value.permits.filter((permit) =>
    permit.file.endsWith("/mock-tenant.ts"),
  );
  if (
    addressingDecode.length !== 2 ||
    !addressingDecode.some((permit) => permit.construct === "provider-comparison") ||
    !addressingDecode.some((permit) => permit.construct === "provider-name-literal")
  ) {
    violations.push("mock-tenant.ts must pin its literal and comparison constructs separately");
  }
  if (value.permits.some((permit) => permit.file.endsWith("/parity.ts"))) {
    violations.push("parity.ts must have no permit: its columns are derived");
  }
  const permittedHomes = new Set([
    "packages/testkit/src/conformance/adapters.ts",
    "packages/testkit/src/conformance/types.ts",
    "packages/testkit/src/conformance/mock-tenant.ts",
    "packages/testkit/src/conformance/runner.ts",
  ]);
  for (const permit of value.permits) {
    if (!permittedHomes.has(permit.file)) {
      violations.push(`${permit.file}: not an enumerated identity home`);
    }
  }
  if (value.parityColumnDerivation !== "CONFORMANCE_ADAPTERS") {
    violations.push("parity columns must derive from CONFORMANCE_ADAPTERS");
  }
  return violations;
};

describe("TC-REG-001 exactly five participation items are declared", () => {
  test("the five-item set is exact and the registration shape accepts only the declared seam", () => {
    expect(PARTICIPATION_CONTRACT.map((entry) => entry.item)).toEqual([...PARTICIPATION_ITEMS]);
    expect(PARTICIPATION_ITEMS).toEqual([
      "contract",
      "registration",
      "matrix-column",
      "tenant-fixtures",
      "trap-catalog",
    ]);
    const record = Object.fromEntries(PARTICIPATION_ITEMS.map((item) => [item, true]));
    expect(participationViolations(record)).toEqual([]);
    expect(
      participationViolations({ ...record, lifecycleHook: "after-write" }).some((message) =>
        message.includes("lifecycleHook"),
      ),
    ).toBe(true);
    expect(
      participationViolations({ ...record, extraItem: true }).some((message) =>
        message.includes("outside the five-item"),
      ),
    ).toBe(true);
  });
});

describe("TC-REG-004 the bound set is identity-construct free with an exact allowlist", () => {
  test("the allowlist is exact and every bound module scans clean", () => {
    expect(allowlistViolations(allowlist)).toEqual([]);
    expect(allowlist.boundModules).toEqual([
      "packages/testkit/src/conformance/flows.ts",
      "packages/testkit/src/conformance/coverage.ts",
      "packages/testkit/src/conformance/artifact.ts",
      "packages/testkit/src/conformance/harness.ts",
      "packages/testkit/src/conformance/parity.ts",
      "packages/testkit/src/conformance/tracker-error-taxonomy.ts",
      "packages/testkit/src/conformance/stateful-double.ts",
    ]);
    for (const module of allowlist.boundModules) expect(scanFile(module)).toEqual([]);
  });

  test("the runner's five provider comparisons are the pinned exception", () => {
    const hits = scanFile("packages/testkit/src/conformance/runner.ts").filter(
      (hit) => hit.construct === "provider-comparison",
    );
    expect(hits).toHaveLength(5);
  });

  test("every permit pins its occurrence count, so a new branch is never absorbed quietly", () => {
    const counts = allowlist.permits.map((permit) => ({
      key: `${permit.file}|${permit.construct}`,
      expected: permit.count,
      observed: scanFile(permit.file).filter((hit) => hit.construct === permit.construct).length,
    }));
    for (const count of counts) {
      expect(count.observed, count.key).toBe(count.expected);
    }
    const addressing = counts.find(
      (count) =>
        count.key === "packages/testkit/src/conformance/mock-tenant.ts|provider-comparison",
    );
    expect(addressing?.observed).toBe(3);

    // Mutation: one more provider-discriminant branch in the addressing decode
    // raises the observed count above the pinned one, so the equality above
    // fails naming the file and construct.
    const text = readFileSync(
      join(ROOT, "packages/testkit/src/conformance/mock-tenant.ts"),
      "utf8",
    );
    const planted = identityConstructs(
      "packages/testkit/src/conformance/mock-tenant.ts",
      `${text}\nconst extra = provider === "github";\n`,
    ).filter((hit) => hit.construct === "provider-comparison");
    expect(planted).toHaveLength(4);
    expect(planted.length).not.toBe(addressing?.observed);

    // A count-free permit is itself a violation: it would re-open the silence.
    expect(
      allowlistViolations({
        ...allowlist,
        permits: allowlist.permits.map((permit) =>
          permit.file.endsWith("/mock-tenant.ts") && permit.construct === "provider-comparison"
            ? { file: permit.file, construct: permit.construct }
            : permit,
        ),
      }).some((message) => message.includes("must pin an occurrence count")),
    ).toBe(true);
  });

  test("planting a full-value provider literal in each bound module fails by file and construct", () => {
    for (const module of allowlist.boundModules) {
      const text = readFileSync(join(ROOT, module), "utf8");
      const hits = identityConstructs(module, `${text}\nconst planted = "github";\n`);
      expect(
        hits.some((hit) => hit.file === module && hit.construct === "provider-name-literal"),
      ).toBe(true);
    }
  });

  test("a sixth runner comparison and a hand-authored parity column key both fail", () => {
    const runner = readFileSync(join(ROOT, "packages/testkit/src/conformance/runner.ts"), "utf8");
    const sixth = identityConstructs(
      "packages/testkit/src/conformance/runner.ts",
      `${runner}\nconst extra = tenant.addressing.provider === "jira";\n`,
    ).filter((hit) => hit.construct === "provider-comparison");
    expect(sixth).toHaveLength(6);

    const parity = readFileSync(join(ROOT, "packages/testkit/src/conformance/parity.ts"), "utf8");
    const authored = identityConstructs(
      "packages/testkit/src/conformance/parity.ts",
      `${parity}\nconst columnKey = "gitlab";\n`,
    );
    expect(authored.some((hit) => hit.construct === "provider-name-literal")).toBe(true);
  });

  test("a second allowlisted file or a wildcard fails the exact-collection assertion", () => {
    expect(
      allowlistViolations({
        ...allowlist,
        permits: [...allowlist.permits, { file: "packages/testkit/src/other.ts", construct: "x" }],
      }).length,
    ).toBeGreaterThan(0);
    expect(
      allowlistViolations({
        ...allowlist,
        permits: [...allowlist.permits, { file: "*", construct: "*" }],
      }).some((message) => message.includes("wildcard")),
    ).toBe(true);
  });

  test("an artifact redaction label and a provider-host regex are not constructs", () => {
    const artifact = readFileSync(
      join(ROOT, "packages/testkit/src/conformance/artifact.ts"),
      "utf8",
    );
    expect(artifact).toContain("github token");
    expect(artifact).toMatch(/githubusercontent/);
    expect(identityConstructs("packages/testkit/src/conformance/artifact.ts", artifact)).toEqual(
      [],
    );
  });
});

describe("TC-REG-005 an out-of-set operation, a lifecycle hook and a runner branch are refused", () => {
  test("each refusal is named and the closed operation set is unchanged", () => {
    expect(PARTICIPATION_REFUSALS).toEqual([
      "operation-outside-closed-set",
      "lifecycle-hook",
      "per-adapter-runner-branch",
    ]);
    expect(operationRefusal("read-attachment")).toContain("operation-outside-closed-set");
    expect(participationRefusal("lifecyclePhase")).toBe("lifecycle-hook");
    expect(participationRefusal("phaseHook")).toBe("lifecycle-hook");
    expect(participationRefusal("runnerBranch")).toBe("per-adapter-runner-branch");
    expect(participationRefusal("contract")).toBeUndefined();
    expect([...ADAPTER_OPERATIONS]).toEqual([
      "read-work-item",
      "write-work-item",
      "transition-work-item",
      "read-delivery-request",
      "write-delivery-request",
      "read-pipeline-run",
      "write-comment",
      "resolve-delivery-thread",
      "merge-delivery-request",
    ]);
    expect(isClosedOperation("read-attachment")).toBe(false);
    expect(isClosedOperation("read-work-item")).toBe(true);
  });
});
