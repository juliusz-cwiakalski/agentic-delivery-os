/**
 * TC-XDEP-001/002 (GH-310 F-4, AC-F4-1, AC-F4-2, DEC-7): the declared edge
 * holds a dependent member start until its prerequisite lands, a member-ref
 * edge cycle is the delivered `queue.dependency-cycle`, and a plan cycle is
 * caught at validation before any queue write.
 */
import { describe, expect, test } from "bun:test";
import { validatePlan } from "../../packages/core/src/domain/plan-validate";
import { API_MEMBER, CHANGE_REF, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import { memberSpec, planYaml } from "../fixtures/cross-repository/plan";
import { createMemberQueueHarness, MEMBER_REFS } from "../fixtures/cross-repository/queue";
import { planYamlParser } from "../fixtures/plan/harness/index";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const error = (text: string): Record<string, unknown> | undefined =>
  json(text).error as Record<string, unknown> | undefined;

describe("TC-XDEP-001 a start on the dependent member is refused until the prerequisite lands", () => {
  test("refused precondition names both members, appends nothing, then is admitted after landing", async () => {
    const world = createMemberQueueHarness("dep-refusal", { countWrites: true });
    expect((await world.harness.run(["queue", "add", CHANGE_REF, "--json"])).exitCode).toBe(0);
    const before = world.harness.writeLog?.appends ?? 0;

    const refused = await world.harness.run([
      "queue",
      "claim",
      MEMBER_REFS.web,
      "--holder",
      "holder-web",
      "--json",
    ]);
    expect(refused.exitCode).toBe(1);
    expect(error(refused.stdout)?.code).toBe("queue.precondition.unmet");
    const summary = String(error(refused.stdout)?.summary ?? "");
    expect(summary).toContain(MEMBER_REFS.web);
    expect(summary).toContain(MEMBER_REFS.api);
    expect(world.harness.writeLog?.appends).toBe(before);

    // The prerequisite member is never blocked by the edge it produces.
    const apiClaim = await world.harness.run([
      "queue",
      "claim",
      MEMBER_REFS.api,
      "--holder",
      "holder-api",
      "--json",
    ]);
    expect(apiClaim.exitCode).toBe(0);
    expect((json(apiClaim.stdout).data as Record<string, unknown>).result).toBe("claimed");
    expect(
      (await world.harness.run(["queue", "release", MEMBER_REFS.api, "--json"])).exitCode,
    ).toBe(0);

    world.land();
    const admitted = await world.harness.run([
      "queue",
      "claim",
      MEMBER_REFS.web,
      "--holder",
      "holder-web",
      "--json",
    ]);
    expect(admitted.exitCode).toBe(0);
    expect((json(admitted.stdout).data as Record<string, unknown>).result).toBe("claimed");
  });
});

describe("TC-XDEP-002 cycles are refused at the earliest surface", () => {
  test("a member-ref edge cycle is queue.dependency-cycle with zero appends", async () => {
    const world = createMemberQueueHarness("dep-cycle", { countWrites: true });
    expect((await world.harness.run(["queue", "add", CHANGE_REF, "--json"])).exitCode).toBe(0);
    const before = world.harness.writeLog?.appends ?? 0;
    const cyclic = await world.harness.run([
      "queue",
      "dep",
      MEMBER_REFS.api,
      MEMBER_REFS.web,
      "--json",
    ]);
    expect(cyclic.exitCode).toBe(1);
    expect(error(cyclic.stdout)?.code).toBe("queue.dependency-cycle");
    expect(String(error(cyclic.stdout)?.summary ?? "")).toContain(MEMBER_REFS.api);
    expect(world.harness.writeLog?.appends).toBe(before);
  });

  test("a delivered bare-ref cycle keeps the same identity", async () => {
    const world = createMemberQueueHarness("bare-cycle", { withMembers: false });
    expect((await world.harness.run(["queue", "add", "GH-320", "--json"])).exitCode).toBe(0);
    expect((await world.harness.run(["queue", "add", "GH-321", "--json"])).exitCode).toBe(0);
    expect((await world.harness.run(["queue", "dep", "GH-320", "GH-321", "--json"])).exitCode).toBe(
      0,
    );
    const cyclic = await world.harness.run(["queue", "dep", "GH-321", "GH-320", "--json"]);
    expect(cyclic.exitCode).toBe(1);
    expect(error(cyclic.stdout)?.code).toBe("queue.dependency-cycle");
  });

  test("a plan-declared cycle is plan.schema.invalid before any queue write", () => {
    const text = planYaml({
      members: [
        memberSpec(API_MEMBER, { dependsOn: [WEB_MEMBER.repoKey] }),
        memberSpec(WEB_MEMBER, { dependsOn: [API_MEMBER.repoKey] }),
      ],
    });
    const verdict = validatePlan({
      workItemRef: CHANGE_REF,
      read: {
        ok: true,
        artifact: { kind: "yaml", path: `chg-${CHANGE_REF}-plan.yaml` },
        text,
      },
      parseYaml: planYamlParser,
    });
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    expect(verdict.members).toBeUndefined();
    expect(verdict.errors.some((entry) => entry.code === "plan.schema.invalid")).toBe(true);
    expect(verdict.errors.some((entry) => entry.field.includes("dependsOn"))).toBe(true);
  });
});
