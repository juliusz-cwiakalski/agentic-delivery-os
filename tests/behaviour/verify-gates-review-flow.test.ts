/**
 * TC-XREV-001..006 (GH-310 AC-F6-1..AC-F6-4; DM-7, DEC-8, DEC-17): exactly one
 * review run over the declared member set, one verdict per member in declared
 * order, a stable run identity over the sorted declared set, and pure behaviour
 * over injected `ReviewObservation` values.
 */
import { describe, expect, test } from "bun:test";
import type {
  CrossRepositoryVerifyGatesReport,
  ReviewObservation,
} from "../../packages/core/src/contracts/index";
import { API_MEMBER, DOCS_MEMBER, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  type MemberGatesWorld,
  pullRequestless,
  runMemberGates,
} from "../fixtures/cross-repository/facts";
import {
  duplicatedObservation,
  oneObservationPerMember,
  reviewFor,
} from "../fixtures/cross-repository/review";
import { createNoSpawnGuard } from "../fixtures/result/no-spawn-guard";
import type { Run } from "../fixtures/verify-gates/cases/harness";
import { createNoNetworkGuard } from "../fixtures/verify-gates/cases/network-guard";

const report = (run: Run): CrossRepositoryVerifyGatesReport =>
  run.envelope?.data as CrossRepositoryVerifyGatesReport;

const world = (overrides: Partial<MemberGatesWorld> = {}): MemberGatesWorld => ({
  members: [
    declaredMember(API_MEMBER, { gates: ["ci-green"] }),
    declaredMember(WEB_MEMBER, { gates: ["ci-green"] }),
  ],
  reads: {
    [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
    [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
  },
  reviews: oneObservationPerMember(),
  ...overrides,
});

describe("TC-XREV-001 one review run", () => {
  test("one verdict per member in declared order, complete, stable runId", async () => {
    const first = await runMemberGates(world());
    const data = report(first);
    expect(data.reviewFlow.verdicts).toEqual([
      { repoKey: API_MEMBER.repoKey, pullRequest: API_MEMBER.pullRequest, verdict: "pass" },
      { repoKey: WEB_MEMBER.repoKey, pullRequest: WEB_MEMBER.pullRequest, verdict: "fail" },
    ]);
    expect(data.reviewFlow.complete).toBe(true);
    const runId = data.reviewFlow.runId;
    expect(runId).toMatch(/^[0-9a-f]{64}$/);

    const second = await runMemberGates(world());
    expect(report(second).reviewFlow.runId).toBe(runId);
    expect(report(second).reviewFlow.verdicts).toHaveLength(2);
    expect(second.stdout).toBe(first.stdout);
  });

  test("reordering the same declaration keeps the run identity", async () => {
    const declared = world();
    const reversed = await runMemberGates({
      ...declared,
      members: [...declared.members].reverse(),
    });
    expect(report(reversed).reviewFlow.runId).toBe(
      report(await runMemberGates(world())).reviewFlow.runId,
    );
  });
});

describe("TC-XREV-002 a duplicated observation degrades to fail", () => {
  test("one entry remains, complete is false", async () => {
    const data = report(await runMemberGates(world({ reviews: duplicatedObservation() })));
    const web = data.reviewFlow.verdicts.filter((entry) => entry.repoKey === WEB_MEMBER.repoKey);
    expect(web).toHaveLength(1);
    expect(web[0]?.verdict).toBe("fail");
    expect(data.reviewFlow.complete).toBe(false);
    expect(data.reviewFlow.verdicts[0]).toEqual({
      repoKey: API_MEMBER.repoKey,
      pullRequest: API_MEMBER.pullRequest,
      verdict: "pass",
    });
  });
});

describe("TC-XREV-003 the declared member set is the run identity", () => {
  test("a changed set changes runId; a PR-less member is unreviewed and leaves no stale entry", async () => {
    const runA = await runMemberGates(world());
    const idA = report(runA).reviewFlow.runId;

    const runB = await runMemberGates({ ...world({}), members: [declaredMember(API_MEMBER)] });
    const idB = report(runB).reviewFlow.runId;
    expect(idB).not.toBe(idA);

    const runC = await runMemberGates({
      ...world({}),
      members: [declaredMember(API_MEMBER), pullRequestless(DOCS_MEMBER)],
      reads: { [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER) },
    });
    const dataC = report(runC);
    expect(dataC.reviewFlow.runId).not.toBe(idB);
    expect(dataC.reviewFlow.verdicts).toEqual([
      { repoKey: API_MEMBER.repoKey, pullRequest: API_MEMBER.pullRequest, verdict: "pass" },
      { repoKey: DOCS_MEMBER.repoKey, verdict: "unreviewed" },
    ]);
    expect(dataC.reviewFlow.complete).toBe(false);
    expect(dataC.reviewFlow.verdicts.some((entry) => entry.repoKey === WEB_MEMBER.repoKey)).toBe(
      false,
    );

    const runD = await runMemberGates({
      ...world({}),
      members: [declaredMember(API_MEMBER, { pullRequest: "999" })],
    });
    expect(report(runD).reviewFlow.runId).not.toBe(idB);

    const runBAgain = await runMemberGates({ ...world({}), members: [declaredMember(API_MEMBER)] });
    expect(report(runBAgain).reviewFlow.runId).toBe(idB);
  });
});

describe("TC-XREV-004 an unobserved member is unreviewed, never pass", () => {
  test("one entry per declared member in order and complete false", async () => {
    const data = report(
      await runMemberGates(world({ reviews: [reviewFor(API_MEMBER, ["pass"])] })),
    );
    expect(data.reviewFlow.verdicts).toEqual([
      { repoKey: API_MEMBER.repoKey, pullRequest: API_MEMBER.pullRequest, verdict: "pass" },
      { repoKey: WEB_MEMBER.repoKey, pullRequest: WEB_MEMBER.pullRequest, verdict: "unreviewed" },
    ]);
    expect(data.reviewFlow.complete).toBe(false);
    expect(data.reviewFlow.verdicts[1]?.verdict).not.toBe("pass");
  });
});

describe("TC-XREV-005 review verdicts come from injected observations only", () => {
  test("the block is a pure function of the observations, with zero network and spawns", async () => {
    const spawnGuard = createNoSpawnGuard();
    const networkGuard = createNoNetworkGuard();
    try {
      spawnGuard.install();
      const withReview = await runMemberGates(world());
      expect(withReview.envelope === undefined ? [] : Object.keys(withReview.envelope)).toEqual([
        "schemaVersion",
        "runId",
        "exitCode",
        "timing",
        "data",
      ]);
      const withoutReview = await runMemberGates(world({ reviews: [] }));
      expect(report(withReview).reviewFlow.verdicts[0]?.verdict).toBe("pass");
      expect(report(withoutReview).reviewFlow.verdicts[0]?.verdict).toBe("unreviewed");
      expect(report(withoutReview).reviewFlow.complete).toBe(false);
      expect(spawnGuard.violations).toEqual([]);
      expect(networkGuard.calls).toEqual([]);
    } finally {
      networkGuard.restore();
      spawnGuard.restore();
    }
  });
});

describe("TC-XREV-006 per-member derivation and no pass without a match", () => {
  test("verdicts follow each observation's own identity, not position", async () => {
    const swapped: readonly ReviewObservation[] = [
      { repoKey: WEB_MEMBER.repoKey, pullRequest: WEB_MEMBER.pullRequest, verdicts: ["pass"] },
      { repoKey: API_MEMBER.repoKey, pullRequest: API_MEMBER.pullRequest, verdicts: ["fail"] },
    ];
    const data = report(await runMemberGates(world({ reviews: swapped })));
    expect(data.reviewFlow.verdicts).toEqual([
      { repoKey: API_MEMBER.repoKey, pullRequest: API_MEMBER.pullRequest, verdict: "fail" },
      { repoKey: WEB_MEMBER.repoKey, pullRequest: WEB_MEMBER.pullRequest, verdict: "pass" },
    ]);
  });

  test("an observation for an undeclared member contributes nothing", async () => {
    const data = report(
      await runMemberGates(
        world({
          reviews: [
            ...oneObservationPerMember(),
            {
              repoKey: DOCS_MEMBER.repoKey,
              pullRequest: DOCS_MEMBER.pullRequest,
              verdicts: ["pass"],
            },
          ],
        }),
      ),
    );
    expect(data.reviewFlow.verdicts).toHaveLength(2);
    expect(data.reviewFlow.verdicts.some((entry) => entry.repoKey === DOCS_MEMBER.repoKey)).toBe(
      false,
    );
  });

  test("a second observation never reads as a pass", async () => {
    const data = report(await runMemberGates(world({ reviews: duplicatedObservation() })));
    expect(data.reviewFlow.verdicts[1]?.verdict).toBe("fail");
    expect(data.reviewFlow.complete).toBe(false);
  });
});
