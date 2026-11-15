/**
 * TC-XDOD-004/007/009 (GH-310 AC-F3-4, AC-F3-6, AC-F3-8; DM-4, DM-10, DEC-4,
 * DEC-16, DEC-19): absent evidence is a first-class non-green state, landing
 * order comes from injected observations only, and `evidence[]` enumerates pull
 * requests while a PR-less member stays a member.
 */
import { describe, expect, test } from "bun:test";
import type { CrossRepositoryVerifyGatesReport } from "../../packages/core/src/contracts/index";
import {
  API_MEMBER,
  DOCS_MEMBER,
  type MemberFixture,
  WEB_MEMBER,
} from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  type MemberGatesWorld,
  noRunReads,
  pullRequestless,
  redReads,
  reviewObservation,
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import type { Run } from "../fixtures/verify-gates/cases/harness";

const report = (run: Run): CrossRepositoryVerifyGatesReport =>
  run.envelope?.data as CrossRepositoryVerifyGatesReport;

const baseWorld = (): MemberGatesWorld => ({
  members: [
    declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity"] }),
    declaredMember(WEB_MEMBER, { gates: ["owner-gate"] }),
  ],
  reads: {
    [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
    [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
  },
});

const withoutPushedHead = (member: MemberFixture) => ({
  ...greenMemberReads(member),
  deliveryRequestDetail: {
    ok: true as const,
    value: {
      request: {
        identity: { systemName: "github", entityId: member.pullRequest },
        sourceRef: member.branch,
        targetRef: "main-tools",
        reviewState: "open" as const,
        threads: [],
        mergeableState: "mergeable" as const,
        commitCount: 1,
        changedFileCount: 1,
      },
    },
  },
});

describe("TC-XDOD-004 absent evidence is incomplete, never unknown overall", () => {
  const expectIncomplete = (run: Run) => {
    expect(run.exitCode).toBe(1);
    expect(run.exitCode).not.toBe(2);
    const data = report(run);
    expect(run.envelope?.error).toBeUndefined();
    expect(data.definitionOfDone.members[1]?.gates.ci).toBe("absent");
    expect(data.definitionOfDone.members[1]?.verdict).toBe("unknown");
    expect(data.definitionOfDone.status).toBe("incomplete");
    expect(data.overall).toBe("fail");
    expect(data.blockingMembers).toContain(WEB_MEMBER.repoKey);
    expect(data.gates).toHaveLength(3);
    expect(data.summary.failed).toBe(0);
    expect(data.summary.unknown).toBe(0);
    expect(data.definitionOfDone.members[0]).toEqual({
      repoKey: API_MEMBER.repoKey,
      gates: { ci: "pass" },
      verdict: "pass",
    });
    for (const record of data.gates.filter((entry) => entry.member === WEB_MEMBER.repoKey)) {
      expect(record.verdict).toBe("pass");
    }
  };

  test("variant A: no pushed head", async () => {
    const world = baseWorld();
    expectIncomplete(
      await runMemberGates({
        ...world,
        reads: { ...world.reads, [WEB_MEMBER.repoKey]: withoutPushedHead(WEB_MEMBER) },
      }),
    );
  });

  test("variant B: no declared pull request", async () => {
    const world = baseWorld();
    expectIncomplete(
      await runMemberGates({
        ...world,
        members: [world.members[0] as never, pullRequestless(WEB_MEMBER, ["owner-gate"])],
      }),
    );
  });

  test("variant C: a pushed head with no run for it", async () => {
    const world = baseWorld();
    expectIncomplete(
      await runMemberGates({
        ...world,
        reads: { ...world.reads, [WEB_MEMBER.repoKey]: noRunReads(WEB_MEMBER) },
      }),
    );
  });
});

describe("TC-XDOD-007 evidence ordering from injected landing observations", () => {
  const threeMemberWorld = (): MemberGatesWorld => ({
    members: [
      declaredMember(API_MEMBER, { gates: ["ci-green"] }),
      declaredMember(WEB_MEMBER, { gates: ["ci-green"] }),
      declaredMember(DOCS_MEMBER, { gates: ["ci-green"] }),
    ],
    reads: {
      [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
      [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
      [DOCS_MEMBER.repoKey]: greenMemberReads(DOCS_MEMBER),
    },
    landings: [
      landingObservation(DOCS_MEMBER, true, 1),
      landingObservation(API_MEMBER, true, 2),
      landingObservation(WEB_MEMBER, false),
    ],
    reviews: [
      reviewObservation(API_MEMBER),
      reviewObservation(WEB_MEMBER),
      reviewObservation(DOCS_MEMBER),
    ],
  });

  test("landed first by ascending position, then unlanded in declared order", async () => {
    const readLog: string[] = [];
    const run = await runMemberGates({ ...threeMemberWorld(), readLog });
    const data = report(run);
    expect(data.definitionOfDone.evidence).toEqual([
      {
        repoKey: DOCS_MEMBER.repoKey,
        pullRequest: DOCS_MEMBER.pullRequest,
        landed: true,
        landingPosition: 1,
      },
      {
        repoKey: API_MEMBER.repoKey,
        pullRequest: API_MEMBER.pullRequest,
        landed: true,
        landingPosition: 2,
      },
      { repoKey: WEB_MEMBER.repoKey, pullRequest: WEB_MEMBER.pullRequest, landed: false },
    ]);
    expect(readLog).toEqual([API_MEMBER.repoKey, WEB_MEMBER.repoKey, DOCS_MEMBER.repoKey]);

    const replay = await runMemberGates(threeMemberWorld());
    expect(replay.stdout).toBe(run.stdout);

    const reversed = await runMemberGates({
      ...threeMemberWorld(),
      landings: [...(threeMemberWorld().landings ?? [])].reverse(),
    });
    expect(report(reversed).definitionOfDone.evidence).toEqual(data.definitionOfDone.evidence);
  });

  test("ties break by declared order", async () => {
    const world = threeMemberWorld();
    const run = await runMemberGates({
      ...world,
      landings: [
        landingObservation(WEB_MEMBER, true, 1),
        landingObservation(API_MEMBER, true, 1),
        landingObservation(DOCS_MEMBER, false),
      ],
    });
    expect(report(run).definitionOfDone.evidence.map((entry) => entry.repoKey)).toEqual([
      API_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
      DOCS_MEMBER.repoKey,
    ]);
  });

  test("an unmerged observation carrying a position is ignored, not used to order", async () => {
    const world = threeMemberWorld();
    const run = await runMemberGates({
      ...world,
      landings: [
        landingObservation(DOCS_MEMBER, true, 1),
        landingObservation(API_MEMBER, true, 2),
        landingObservation(WEB_MEMBER, false, 9),
      ],
    });
    const evidence = report(run).definitionOfDone.evidence;
    const web = evidence.find((entry) => entry.repoKey === WEB_MEMBER.repoKey);
    expect(web).toEqual({
      repoKey: WEB_MEMBER.repoKey,
      pullRequest: WEB_MEMBER.pullRequest,
      landed: false,
    });
    expect(evidence.map((entry) => entry.repoKey).at(-1)).toBe(WEB_MEMBER.repoKey);
  });
});

describe("TC-XDOD-009 evidence element shape and the PR-less omission", () => {
  const world = (): MemberGatesWorld => ({
    members: [
      declaredMember(API_MEMBER, { gates: ["ci-green"] }),
      declaredMember(WEB_MEMBER, { gates: ["ci-green"] }),
      pullRequestless(DOCS_MEMBER),
    ],
    reads: {
      [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
      [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
      [DOCS_MEMBER.repoKey]: greenMemberReads(DOCS_MEMBER),
    },
    landings: [landingObservation(API_MEMBER, true, 2)],
    reviews: [reviewObservation(API_MEMBER), reviewObservation(WEB_MEMBER)],
  });

  test("a PR-less member stays a member and never appears as fabricated evidence", async () => {
    const run = await runMemberGates(world());
    const data = report(run);
    expect(data.definitionOfDone.members.map((entry) => entry.repoKey)).toEqual([
      API_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
      DOCS_MEMBER.repoKey,
    ]);
    expect(data.definitionOfDone.members[2]?.gates.ci).toBe("absent");
    expect(data.definitionOfDone.evidence).toEqual([
      {
        repoKey: API_MEMBER.repoKey,
        pullRequest: API_MEMBER.pullRequest,
        landed: true,
        landingPosition: 2,
      },
      { repoKey: WEB_MEMBER.repoKey, pullRequest: WEB_MEMBER.pullRequest, landed: false },
    ]);
    expect(data.definitionOfDone.evidence).toHaveLength(2);
    expect(data.definitionOfDone.evidence.some((entry) => entry.pullRequest === "")).toBe(false);
    expect(data.blockingMembers).toContain(DOCS_MEMBER.repoKey);
    expect(
      data.definitionOfDone.evidence.some((entry) => entry.repoKey === DOCS_MEMBER.repoKey),
    ).toBe(false);
    expect(data.reviewFlow.verdicts[2]).toEqual({
      repoKey: DOCS_MEMBER.repoKey,
      verdict: "unreviewed",
    });
    expect(data.reviewFlow.complete).toBe(false);
  });
});

describe("TC-XDOD-002 attribution stays with the failing member", () => {
  test("a red reading on web leaves api passing", async () => {
    const world = baseWorld();
    const run = await runMemberGates({
      ...world,
      reads: { ...world.reads, [WEB_MEMBER.repoKey]: redReads(WEB_MEMBER) },
    });
    const data = report(run);
    expect(data.definitionOfDone.members[0]?.verdict).toBe("pass");
    expect(data.definitionOfDone.members[1]?.verdict).toBe("fail");
    expect(data.blockingMembers).toEqual([WEB_MEMBER.repoKey]);
  });
});
