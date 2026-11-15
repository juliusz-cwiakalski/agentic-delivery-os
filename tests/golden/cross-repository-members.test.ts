/**
 * Member-form goldens (GH-310 TC-XPLAN-001, and the gate/closeout/review
 * goldens added by later phases). Payloads are committed under
 * `tests/fixtures/cross-repository/goldens/`; only envelope `runId`/`timing`
 * are ever normalized, and `reviewFlow.runId` is pinned.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { API_MEMBER, WEB_MEMBER } from "../fixtures/cross-repository/constants";
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
