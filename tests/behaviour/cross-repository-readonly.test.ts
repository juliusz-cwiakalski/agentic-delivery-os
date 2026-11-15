/**
 * TC-XCTR-002 (GH-310 NFR-4, AC-NFR4-1, DoD-12) — read/write posture across the
 * three touched surfaces. Plan validation writes nothing, a full member battery
 * appends exactly ONE gate-verification record whatever the member count, and
 * closeout plan mode writes nothing. Every assertion counts an injected seam, so
 * no file, store, or network is touched to prove it.
 */
import { describe, expect, test } from "bun:test";
import {
  type PlanMemberDeclaration,
  VERIFY_GATES_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import {
  memberCloseoutFacts,
  memberCloseoutObservation,
} from "../fixtures/cross-repository/closeout";
import {
  API_MEMBER,
  CHANGE_REF,
  DOCS_MEMBER,
  type MemberFixture,
  WEB_MEMBER,
} from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  type MemberGatesWorld,
  memberGatesRuntime,
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import { memberSpec, planYaml } from "../fixtures/cross-repository/plan";
import {
  createRecorder,
  type PlanWorld,
  planRuntime,
  runPlanCli,
} from "../fixtures/plan/harness/index";
import { runVerify } from "../fixtures/verify-gates/cases/harness";

const ZERO_WRITE_FIELDS = [
  "writes",
  "fences",
  "mutations",
  "spawns",
  "credentialReads",
  "networkCalls",
  "configReads",
] as const;

const memberPlanWorld = (planText: string): PlanWorld => ({
  artifacts: {
    [CHANGE_REF]: [{ kind: "yaml", path: `chg-${CHANGE_REF}-plan.yaml`, text: planText }],
  },
});

/** A syntactically valid member plan whose two entries duplicate a repoKey. */
const invalidMemberPlan = (): string =>
  planYaml({
    members: [memberSpec(API_MEMBER), memberSpec(API_MEMBER, { branch: "feat/GH-310/dup" })],
  });

const validMemberPlan = (): string =>
  planYaml({ members: [memberSpec(API_MEMBER), memberSpec(WEB_MEMBER)] });

describe("TC-XCTR-002 plan validation writes nothing on valid and invalid member plans", () => {
  test("a valid member plan performs exactly one plan read and zero writes", async () => {
    const recorder = createRecorder();
    const run = await runPlanCli(
      ["plan", "validate", CHANGE_REF, "--json"],
      planRuntime(memberPlanWorld(validMemberPlan()), recorder),
    );
    expect(run.exitCode).toBe(0);
    expect(recorder.reads).toEqual([`plan:${CHANGE_REF}`]);
    for (const field of ZERO_WRITE_FIELDS) expect(recorder[field], field).toBe(0);
  });

  test("an invalid member plan performs exactly one plan read and zero writes", async () => {
    const recorder = createRecorder();
    const run = await runPlanCli(
      ["plan", "validate", CHANGE_REF, "--json"],
      planRuntime(memberPlanWorld(invalidMemberPlan()), recorder),
    );
    expect(run.exitCode).toBe(1);
    expect(recorder.reads).toEqual([`plan:${CHANGE_REF}`]);
    for (const field of ZERO_WRITE_FIELDS) expect(recorder[field], field).toBe(0);
  });
});

const twoMemberWorld = (): MemberGatesWorld => ({
  members: [declaredMember(API_MEMBER), declaredMember(WEB_MEMBER)],
  reads: {
    [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
    [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
  },
});

/** An at-cap member set: the two fixtures plus six generated identities. */
const eightMembers = (): readonly PlanMemberDeclaration[] => {
  const generated = Array.from({ length: 6 }, (_, index): PlanMemberDeclaration => {
    const suffix = `${String(index + 3).padStart(2, "0")}000000`;
    return {
      repoKey: `svc-${String(index)}-${suffix}`,
      slice: `packages/svc-${String(index)} — slice`,
      branch: `feat/GH-310/svc-${String(index)}`,
      pullRequest: String(320 + index),
      dependsOn: [],
      gates: ["ci-green"],
    };
  });
  return [declaredMember(API_MEMBER), declaredMember(WEB_MEMBER), ...generated];
};

const memberFixtureOf = (member: PlanMemberDeclaration): MemberFixture => ({
  repoKey: member.repoKey,
  slice: member.slice,
  branch: member.branch,
  pullRequest: member.pullRequest ?? "",
  headSha: "0123456789abcdef0123456789abcdef01234567",
  label: member.repoKey,
});

const eightMemberWorld = (): MemberGatesWorld => {
  const members = eightMembers();
  return {
    members,
    reads: Object.fromEntries(
      members.map((member) => [member.repoKey, greenMemberReads(memberFixtureOf(member))]),
    ),
  };
};

const countAppends = async (world: MemberGatesWorld): Promise<number> => {
  const runtime = memberGatesRuntime(world);
  const gates = runtime.gates;
  if (gates === undefined) throw new Error("missing gates runtime");
  let appends = 0;
  const run = await runVerify(
    {
      ...runtime,
      gates: {
        ...gates,
        appendVerification: () => {
          appends += 1;
          return { ok: true as const };
        },
      },
    },
    ["gates", CHANGE_REF],
  );
  expect(run.exitCode).toBe(0);
  return appends;
};

describe("TC-XCTR-002 a full battery appends exactly one gate-verification record", () => {
  test("two members append one record, and a repeat run appends one more (never per member)", async () => {
    expect(await countAppends(twoMemberWorld())).toBe(1);
    expect(await countAppends(twoMemberWorld())).toBe(1);
  });

  test("the eight-member cap still appends exactly one record", async () => {
    expect(await countAppends(eightMemberWorld())).toBe(1);
  });

  test("the member report itself is data-bearing, so the append is the only write", async () => {
    const run = await runMemberGates(twoMemberWorld());
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('"definitionOfDone"');
  });
});

describe("TC-XCTR-002 closeout plan mode over a member plan writes nothing", () => {
  test("no ledger append, no fence, no branch deletion, no tracker write", async () => {
    const observations = [
      memberCloseoutObservation(API_MEMBER),
      memberCloseoutObservation(WEB_MEMBER),
      memberCloseoutObservation(DOCS_MEMBER, { merged: false }),
    ];
    const run = await runCloseoutCli(["closeout", CHANGE_REF, "--json"], {
      facts: memberCloseoutFacts(observations, { injectMembers: false }),
      members: observations,
    });
    expect(run.exitCode).toBe(0);
    const data = closeoutData(run.envelope);
    expect(data.mode).toBe("plan");
    expect(data.members?.map((entry) => entry.repoKey)).toEqual([
      API_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
      DOCS_MEMBER.repoKey,
    ]);
    expect(run.state.records).toEqual([]);
    expect(run.state.fence.acquired).toBe(0);
    expect(run.state.fence.released).toBe(0);
    expect(run.state.fence.appends).toBe(0);
    expect(run.git.calls.some((call) => call.kind === "deleteBranch")).toBe(false);
    expect(run.git.calls.some((call) => call.kind === "restoreCheckout")).toBe(false);
    expect(run.provider.calls.some((call) => call.kind === "transitionWorkItem")).toBe(false);
    expect(run.provider.calls.some((call) => call.kind === "writeWorkItem")).toBe(false);
    expect(run.provider.calls.some((call) => call.kind === "resolveDeliveryThread")).toBe(false);
  });
});

describe("TC-XBOUND-004 the eight-member report fits the machine bound and names every blocker", () => {
  test("an at-cap partly-evidenced report stays under 65 536 bytes with all seven blockers", async () => {
    const members = eightMembers();
    const world: MemberGatesWorld = {
      members,
      reads: Object.fromEntries(
        members.map((member, index) => [
          member.repoKey,
          index === 0
            ? greenMemberReads(memberFixtureOf(member))
            : greenMemberReads(memberFixtureOf(member), {
                checkRuns: { ok: true, value: { items: [], pageItemCount: 0 } },
              }),
        ]),
      ),
    };
    const run = await runMemberGates(world);
    expect(run.exitCode).toBe(1);
    const data = (
      JSON.parse(run.stdout) as {
        readonly data: {
          readonly overall: string;
          readonly blockingMembers: readonly string[];
          readonly definitionOfDone: {
            readonly status: string;
            readonly members: readonly unknown[];
          };
        };
      }
    ).data;
    expect(data.overall).toBe("fail");
    expect(data.definitionOfDone.status).toBe("blocked");
    expect(data.definitionOfDone.members).toHaveLength(members.length);
    expect(data.blockingMembers).toEqual(members.slice(1).map((member) => member.repoKey));
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
      VERIFY_GATES_MAX_MACHINE_BYTES,
    );
  });
});
