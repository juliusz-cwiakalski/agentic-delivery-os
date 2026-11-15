/**
 * Member-form goldens (GH-310 TC-XPLAN-001, and the gate/closeout/review
 * goldens added by later phases). Payloads are committed under
 * `tests/fixtures/cross-repository/goldens/`; only envelope `runId`/`timing`
 * are ever normalized, and `reviewFlow.runId` is pinned.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import {
  memberCloseoutFacts,
  memberCloseoutObservation,
} from "../fixtures/cross-repository/closeout";
import { API_MEMBER, CHANGE_REF, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  reviewObservation,
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import { twoMemberPlanYaml } from "../fixtures/cross-repository/plan";
import { type PlanWorld, planRuntime, runPlanCli } from "../fixtures/plan/harness/index";

const GOLDENS = join(import.meta.dir, "..", "fixtures", "cross-repository", "goldens");

export const golden = (name: string): unknown =>
  JSON.parse(readFileSync(join(GOLDENS, name), "utf8")) as unknown;

const worldFromText = (ref: string, text: string): PlanWorld => ({
  artifacts: { [ref]: [{ kind: "yaml", path: `chg-${ref}-plan.yaml`, text }] },
});

describe("TC-XPLAN-001 plan member echo golden", () => {
  test("the plan validate data equals the committed member echo", async () => {
    const run = await runPlanCli(
      ["plan", "validate", "GH-310", "--json"],
      planRuntime(worldFromText("GH-310", twoMemberPlanYaml())),
    );
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as { readonly data: unknown };
    expect(envelope.data).toEqual(golden("plan-members-echo.json"));
  });
});

const greenWorld = () => ({
  members: [
    declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
    declaredMember(WEB_MEMBER, { gates: ["ci-green", "push-parity"] }),
  ],
  reads: {
    [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
    [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
  },
  landings: [landingObservation(API_MEMBER, false), landingObservation(WEB_MEMBER, false)],
  reviews: [reviewObservation(API_MEMBER, ["pass"]), reviewObservation(WEB_MEMBER, ["pass"])],
});

describe("TC-XDOD-001 member-form gate report golden", () => {
  test("the green shared verdict equals the committed member-form report", async () => {
    const run = await runMemberGates(greenWorld());
    expect(run.exitCode).toBe(0);
    const envelope = run.envelope as { readonly data: unknown };
    expect(envelope.data).toEqual(golden("gates-members-green.json"));
  });
});

describe("TC-XREV-001 review-flow golden", () => {
  test("reviewFlow is pinned, including its runId", async () => {
    const run = await runMemberGates({
      ...greenWorld(),
      members: [
        declaredMember(API_MEMBER, { gates: ["ci-green"] }),
        declaredMember(WEB_MEMBER, { gates: ["ci-green"] }),
      ],
      landings: undefined,
      reviews: [reviewObservation(API_MEMBER, ["pass"]), reviewObservation(WEB_MEMBER, ["fail"])],
    });
    const envelope = run.envelope as { readonly data: { readonly reviewFlow: unknown } };
    expect(envelope.data).toEqual(golden("gates-review-flow.json"));
    expect(envelope.data.reviewFlow).toMatchObject({
      runId: "76f83b608bc31cad65d8207f15bb3a50779e01405f5d31408919aa545589bd36",
      complete: true,
    });
  });
});

describe("TC-XCLOSE-001 member-form closeout report golden", () => {
  test("the applied member report equals the committed golden", async () => {
    const observations = [
      memberCloseoutObservation(API_MEMBER),
      memberCloseoutObservation(WEB_MEMBER),
    ];
    const run = await runCloseoutCli(["closeout", CHANGE_REF, "--apply", "--json"], {
      facts: memberCloseoutFacts(observations, { injectMembers: false }),
      members: observations,
    });
    expect(run.exitCode).toBe(0);
    expect(closeoutData(run.envelope)).toEqual(golden("closeout-members-applied.json"));
  });
});

import { renderCrossRepositoryVerifyGatesHuman } from "../../packages/core/src/domain/index";
import { memberGatesRuntime } from "../fixtures/cross-repository/facts";
import { suiteMapMemberWorld } from "../fixtures/cross-repository/suite-map";
import { runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  declaredRead,
  REFERENCE_SUITES,
  validEqualityMap,
} from "../fixtures/verify-gates/suite-map/cases";

describe("TC-SCITE-002 the cross-repository report carries the member-independent fields", () => {
  const runWorld = (world: ReturnType<typeof suiteMapMemberWorld>, withMap: boolean) => {
    const base = memberGatesRuntime(world);
    const gates = base.gates;
    if (gates === undefined) throw new Error("missing gates runtime");
    return runVerify(
      {
        ...base,
        gates: { ...gates, ...(withMap ? { readSuiteMap: declaredRead(validEqualityMap()) } : {}) },
      },
      ["gates", CHANGE_REF],
    );
  };

  test("the equality map adds only the two fields and keeps every delivered field", async () => {
    const world = suiteMapMemberWorld();
    const without = await runWorld(world, false);
    const withMap = await runWorld(world, true);
    expect(without.exitCode).toBe(0);
    expect(withMap.exitCode).toBe(0);
    const control = without.envelope?.data as Record<string, unknown>;
    const data = withMap.envelope?.data as Record<string, unknown>;
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(data.mirrorsJob).toBe("job-01");
    const added = Object.keys(data).filter((key) => !Object.hasOwn(control, key));
    expect(added.sort()).toEqual(["mirrorsJob", "suiteBreadth"]);
    for (const field of [
      "definitionOfDone",
      "blockingMembers",
      "reviewFlow",
      "gates",
      "summary",
      "overall",
    ]) {
      expect(JSON.stringify(data[field])).toBe(JSON.stringify(control[field]));
    }
  });

  test("the fields equal a member-less report for the same declaration and never nest", async () => {
    const world = suiteMapMemberWorld();
    const result = await runWorld(world, true);
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    for (const record of data.gates as readonly Record<string, unknown>[]) {
      expect(Object.hasOwn(record, "suiteBreadth")).toBe(false);
      expect(Object.hasOwn(record, "mirrorsJob")).toBe(false);
      expect(Object.hasOwn(record.citation as object, "suiteBreadth")).toBe(false);
    }
    const human = renderCrossRepositoryVerifyGatesHuman(data as never, {
      binaryName: "example-product",
    });
    expect(human).not.toContain("breadth");
    expect(human).not.toContain("mirrors");
  });

  test("the report data matches the committed suite-map golden", async () => {
    const world = suiteMapMemberWorld();
    const result = await runWorld(world, true);
    expect(result.envelope?.data).toEqual(golden("suite-map-report.json"));
  });
});
