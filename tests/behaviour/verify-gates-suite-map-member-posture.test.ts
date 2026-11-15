/**
 * TC-SNARR-006 — a narrowed declaration on a member-declaring change refuses
 * before the per-member read bundle, with the same identity and a one-line
 * summary, and appends nothing.
 */
import { describe, expect, test } from "bun:test";
import type { VerifyGatesCommandRuntime } from "../../packages/cli/src/commands/verify-gates";
import { API_MEMBER, CHANGE_REF, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  type MemberGatesWorld,
  memberGatesRuntime,
  redReads,
} from "../fixtures/cross-repository/facts";
import { EXPECTED_JOBS } from "../fixtures/verify-gates/cases/facts";
import { runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  declaredRead,
  narrowedJob01Map,
  REFERENCE_SUITES,
  validEqualityMap,
} from "../fixtures/verify-gates/suite-map/cases";

const NARROWED_ONE_LINE = `result=unknown; gates=0/0 passed, 0 failed, 0 unknown; scope=narrowed mirror=job-01 breadth=${REFERENCE_SUITES.join(",")}`;

const scenario = (options: {
  readonly narrowed: boolean;
  readonly failing: boolean;
  readonly throwOnMemberRead: boolean;
}) => {
  const planReads: string[] = [];
  const memberReads: string[] = [];
  const appends: string[] = [];
  const capsuleEvents: string[] = [];
  const world: MemberGatesWorld = {
    members: [declaredMember(API_MEMBER), declaredMember(WEB_MEMBER)],
    reads: {
      [API_MEMBER.repoKey]: options.failing ? redReads(API_MEMBER) : greenMemberReads(API_MEMBER),
      [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
    },
    landings: [landingObservation(API_MEMBER, true, 1), landingObservation(WEB_MEMBER, true, 2)],
  };
  const base = memberGatesRuntime(world);
  const gates = base.gates;
  if (gates === undefined) throw new Error("missing gates runtime");
  const members = gates.members;
  if (members === undefined) throw new Error("missing member seam");
  const runtime = {
    ...base,
    gates: {
      ...gates,
      readWorkflow: () => ({ outcome: "read" as const, names: [...EXPECTED_JOBS] }),
      readSuiteMap: declaredRead(options.narrowed ? narrowedJob01Map() : validEqualityMap()),
      appendVerification: (record: Parameters<typeof gates.appendVerification>[0]) => {
        appends.push(JSON.stringify(record));
        return { ok: true as const };
      },
      capsule: {
        append: (event: { readonly kind: string }) => {
          capsuleEvents.push(event.kind);
          return { ok: true as const, appended: true };
        },
      },
      members: {
        ...members,
        readMembers: (ref: string) => {
          planReads.push(ref);
          return members.readMembers(ref);
        },
        readMemberReads: (member) => {
          if (options.throwOnMemberRead) throw new Error("per-member bundle must not be read");
          memberReads.push(member.repoKey);
          return members.readMemberReads(member);
        },
      },
    } satisfies VerifyGatesCommandRuntime,
  };
  return {
    run: () => runVerify(runtime, ["gates", CHANGE_REF]),
    planReads,
    memberReads,
    appends,
    capsuleEvents,
  };
};

describe("TC-SNARR-006 the member path refuses before any per-member read", () => {
  test("same identity, complete local detail, one-line summary, no bundle, no append", async () => {
    const world = scenario({ narrowed: true, failing: true, throwOnMemberRead: true });
    const result = await world.run();
    expect(result.exitCode).toBe(1);
    expect(result.envelope?.data).toBeUndefined();
    const error = result.envelope?.error as Record<string, unknown>;
    expect(Object.keys(error).sort()).toEqual(
      ["category", "code", "consequence", "remediationHint", "retryable", "summary"].sort(),
    );
    expect(error.code).toBe("verify.narrowed-scope");
    expect(error.category).toBe("user");
    expect(error.retryable).toBe(false);
    expect(error.consequence).toBe("not_landed");
    expect(error.remediationHint).toBe(
      "Run the local gate over the declared full suite breadth, or update the declared suite map so the local suite set matches the mirrored CI job, then re-run the gates.",
    );
    expect(error.summary).toBe(NARROWED_ONE_LINE);
    expect(result.envelope?.detail).toEqual({ suiteBreadth: ["tests"] });
    expect(world.planReads).toEqual([CHANGE_REF]);
    expect(world.memberReads).toEqual([]);
    expect(world.appends).toEqual([]);
    expect(world.capsuleEvents).toEqual([]);
    expect(result.stdout).not.toContain("definitionOfDone");
    expect(result.stdout).not.toContain("blockingMembers");
    expect(result.stdout).not.toContain("reviewFlow");
    expect(result.stderr).not.toContain("cause:");
    expect(result.stdout).not.toContain(" pass ");
  });

  test("the equality control emits the delivered cross-repository report with the fields", async () => {
    const world = scenario({ narrowed: false, failing: false, throwOnMemberRead: false });
    const result = await world.run();
    expect(result.exitCode).toBe(0);
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data.definitionOfDone).toBeDefined();
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(data.mirrorsJob).toBe("job-01");
    expect(world.memberReads).toEqual([API_MEMBER.repoKey, WEB_MEMBER.repoKey]);
    expect(world.appends).toHaveLength(1);
    expect(world.capsuleEvents).toEqual(["gate.outcome"]);
  });

  test("the narrowed member invocation is byte-identical across two runs", async () => {
    const first = await scenario({ narrowed: true, failing: false, throwOnMemberRead: true }).run();
    const second = await scenario({
      narrowed: true,
      failing: false,
      throwOnMemberRead: true,
    }).run();
    expect(second.stdout).toBe(first.stdout);
    expect(second.stderr).toBe(first.stderr);
    expect(second.exitCode).toBe(first.exitCode);
  });
});
