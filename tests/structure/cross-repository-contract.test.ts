/**
 * Cross-repository contract suite (GH-310). Phase 1 lands the closed member
 * field set (TC-XPLAN-004); later phases extend this file with envelope,
 * vocabulary, bounds, identity-reuse, consumer-tolerance, and report-type
 * continuity cases.
 */
import { describe, expect, test } from "bun:test";
import {
  PLAN_MEMBER_FIELDS,
  PLAN_MEMBER_REQUIRED_FIELDS,
} from "../../packages/core/src/contracts/index";
import {
  planDocumentFromValidateData,
  validatePlan,
} from "../../packages/core/src/domain/plan-validate";
import { planYaml, twoMemberPlanYaml } from "../fixtures/cross-repository/plan";
import { planYamlParser } from "../fixtures/plan/harness/index";

describe("TC-XPLAN-004 closed member field set", () => {
  test("the six declared member fields are the only fields", () => {
    expect([...PLAN_MEMBER_FIELDS].sort()).toEqual(
      ["branch", "dependsOn", "gates", "pullRequest", "repoKey", "slice"].sort(),
    );
  });

  test("the required set is repoKey, slice, branch and gates", () => {
    expect([...PLAN_MEMBER_REQUIRED_FIELDS].sort()).toEqual(
      ["branch", "gates", "repoKey", "slice"].sort(),
    );
  });
});

describe("TC-XPLAN-001 members are declaration data only", () => {
  test("planDocumentFromValidateData carries members and never widens phase scope", () => {
    const verdict = validatePlan({
      workItemRef: "GH-310",
      read: {
        ok: true,
        artifact: { kind: "yaml", path: "chg-GH-310-plan.yaml" },
        text: twoMemberPlanYaml(),
      },
      parseYaml: planYamlParser,
    });
    const document = planDocumentFromValidateData(verdict);
    expect(document.members?.map((member) => member.repoKey)).toEqual(
      verdict.members?.map((member) => member.repoKey),
    );
    expect(document.phases[0]?.scope.files).toEqual(["doc/changes/chg-GH-310-plan.yaml"]);
    expect(document.phases[1]?.scope.files).toEqual(["packages/core/src/index.ts"]);
  });

  test("a member-less verdict produces a document with no members key", () => {
    const verdict = validatePlan({
      workItemRef: "GH-310",
      read: {
        ok: true,
        artifact: { kind: "yaml", path: "chg-GH-310-plan.yaml" },
        text: planYaml(),
      },
      parseYaml: planYamlParser,
    });
    expect(verdict.verdict).toBe("valid");
    expect(Object.hasOwn(planDocumentFromValidateData(verdict), "members")).toBe(false);
  });
});
