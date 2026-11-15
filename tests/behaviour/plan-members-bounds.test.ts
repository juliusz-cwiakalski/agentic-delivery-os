/**
 * TC-XPLAN-003 (GH-310 AC-F1-4, DEC-10, NFR-2): the declared member bounds are
 * rejected one over the limit and accepted exactly at the limit, so a
 * declaration can never validate where the gate and closeout bounds cannot
 * report it.
 */
import { describe, expect, test } from "bun:test";
import { validatePlan } from "../../packages/core/src/domain/plan-validate";
import {
  type PlanWorld,
  planRuntime,
  planYamlParser,
  runPlanCli,
} from "../fixtures/plan/harness/index";
import {
  AT_BOUND_PLAN,
  BOUNDARY_MEMBER_REF_PLAN,
  OVER_DEPENDS_ON_PLAN,
  OVER_GATES_PLAN,
  OVER_LENGTH_MEMBER_REF_PLAN,
  OVER_MEMBER_COUNT_PLAN,
} from "../fixtures/plan/members-bounds/cases";

const REF = "GH-310";

const worldFromText = (ref: string, text: string): PlanWorld => ({
  artifacts: { [ref]: [{ kind: "yaml", path: `chg-${ref}-plan.yaml`, text }] },
});

const declared = (text: string, workItemRef = REF) =>
  validatePlan({
    workItemRef,
    read: { ok: true, artifact: { kind: "yaml", path: `chg-${workItemRef}-plan.yaml` }, text },
    parseYaml: planYamlParser,
  });

const cli = async (text: string) =>
  runPlanCli(["plan", "validate", REF, "--json"], planRuntime(worldFromText(REF, text)));

const expectInvalidAt = async (text: string, field: string) => {
  const verdict = declared(text);
  expect(verdict.verdict).toBe("invalid");
  expect(verdict.readyForDevelopment).toBe(false);
  const error = verdict.errors.find((candidate) => candidate.field === field);
  expect(error?.code).toBe("plan.schema.invalid");
  const run = await cli(text);
  expect(run.exitCode).toBe(1);
};

describe("TC-XPLAN-003 member bounds", () => {
  test("nine members are rejected naming the member set", async () => {
    await expectInvalidAt(OVER_MEMBER_COUNT_PLAN, "members");
  });

  test("nine dependency entries are rejected naming dependsOn", async () => {
    await expectInvalidAt(OVER_DEPENDS_ON_PLAN, "members[7].dependsOn");
  });

  test("seventeen gate identifiers are rejected naming gates", async () => {
    await expectInvalidAt(OVER_GATES_PLAN, "members[0].gates");
  });

  test("a 65-character derived member ref is rejected naming repoKey", async () => {
    await expectInvalidAt(OVER_LENGTH_MEMBER_REF_PLAN, "members[0].repoKey");
  });

  test("a 64-character derived member ref validates at exit 0", () => {
    const verdict = declared(BOUNDARY_MEMBER_REF_PLAN);
    expect(verdict.verdict).toBe("valid");
    expect(verdict.members).toHaveLength(1);
    expect(`${REF}@a-00000000`.length).toBeLessThan(64);
  });

  test("exactly eight members, eight edges, and sixteen gates validate", () => {
    const verdict = declared(AT_BOUND_PLAN);
    expect(verdict.errors).toEqual([]);
    expect(verdict.verdict).toBe("valid");
    expect(verdict.members).toHaveLength(8);
    expect(verdict.members?.every((member) => member.gates.length === 16)).toBe(true);
    expect(verdict.members?.[7]?.dependsOn).toHaveLength(8);
  });

  test("every rejection uses only the delivered plan.schema.invalid identity", () => {
    for (const plan of [
      OVER_MEMBER_COUNT_PLAN,
      OVER_DEPENDS_ON_PLAN,
      OVER_GATES_PLAN,
      OVER_LENGTH_MEMBER_REF_PLAN,
    ]) {
      const verdict = declared(plan);
      expect(verdict.errors.every((error) => error.code === "plan.schema.invalid")).toBe(true);
    }
  });
});
