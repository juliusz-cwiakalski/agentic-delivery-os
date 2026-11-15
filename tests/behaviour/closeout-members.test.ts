/**
 * TC-XCLOSE-001..004 (GH-310 F-5, DM-5, DM-8, DEC-12, DEC-20) — the per-member
 * closeout report with injected `CrossRepositoryCloseoutObservation` values:
 * one ordered entry per declared member, the exact mode-scoped columns derived
 * from the member observation plus its own operations (never step `detail`),
 * merge-truth `landed`, and per-member landing removal that retires only the
 * member ref it observes.
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold, readQueueRemovals } from "../../packages/core/src/app/index";
import {
  CLOSEOUT_MAX_MEMBERS,
  CLOSEOUT_MEMBER_CLEANUP_APPLY_OUTCOMES,
  CLOSEOUT_MEMBER_CLEANUP_PLAN_OUTCOMES,
  CLOSEOUT_MEMBER_ISSUE_APPLY_OUTCOMES,
  CLOSEOUT_MEMBER_ISSUE_PLAN_OUTCOMES,
  CLOSEOUT_STEP_IDS,
  type CloseoutData,
  type CloseoutMemberReport,
} from "../../packages/core/src/contracts/index";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import {
  CLOSEOUT_WORK_ITEM_REF,
  createQueueRemovalHarness,
  seedQueueEntry,
  seedQueueLease,
} from "../fixtures/closeout/queue-removal";
import {
  memberCloseoutFacts,
  memberCloseoutObservation,
  runMemberCloseout,
} from "../fixtures/cross-repository/closeout";
import {
  API_MEMBER,
  CHANGE_REF,
  memberRef,
  WEB_MEMBER,
} from "../fixtures/cross-repository/constants";

const MEMBER_FIELDS = ["repoKey", "branch", "cleanup", "pullRequest", "issueClosure", "landed"];

const applied = (result: Awaited<ReturnType<typeof runMemberCloseout>>["result"]): CloseoutData => {
  if (!result.ok) throw new Error(`closeout failed: ${JSON.stringify(result.error)}`);
  return result.data;
};

const memberOf = (data: CloseoutData, repoKey: string): CloseoutMemberReport => {
  const member = data.members?.find((entry) => entry.repoKey === repoKey);
  if (member === undefined) throw new Error(`missing member ${repoKey}`);
  return member;
};

const stepOutcome = (data: CloseoutData, stepId: string): string =>
  data.steps.find((step) => step.stepId === stepId)?.outcome ?? "missing";

const bothMerged = () => [
  memberCloseoutObservation(API_MEMBER),
  memberCloseoutObservation(WEB_MEMBER),
];

describe("TC-XCLOSE-001 both merged: ordered six-field entries and apply-column values", () => {
  test("apply reports two ordered member entries with merge truth and apply values", async () => {
    const harness = await runMemberCloseout({ observations: bothMerged(), apply: true });
    const data = applied(harness.result);
    expect(data.mode).toBe("applied");
    expect(data.members).toHaveLength(2);
    expect(data.members?.map((entry) => entry.repoKey)).toEqual([
      API_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
    ]);
    for (const entry of data.members ?? []) {
      expect(Object.keys(entry).sort()).toEqual([...MEMBER_FIELDS].sort());
      expect(CLOSEOUT_MEMBER_CLEANUP_APPLY_OUTCOMES).toContain(entry.cleanup as never);
      expect(CLOSEOUT_MEMBER_ISSUE_APPLY_OUTCOMES).toContain(entry.issueClosure as never);
      expect(entry.landed).toBe(true);
    }
    expect(memberOf(data, API_MEMBER.repoKey)).toEqual({
      repoKey: API_MEMBER.repoKey,
      branch: API_MEMBER.branch,
      cleanup: "applied",
      pullRequest: API_MEMBER.pullRequest,
      issueClosure: "applied",
      landed: true,
    });
    expect(memberOf(data, WEB_MEMBER.repoKey).cleanup).toBe("applied");
  });

  test("the twelve delivered step ids and the aggregate outcomes are unchanged", async () => {
    const harness = await runMemberCloseout({ observations: bothMerged(), apply: true });
    const data = applied(harness.result);
    expect(data.steps.map((step) => step.stepId)).toEqual([...CLOSEOUT_STEP_IDS]);
    expect(stepOutcome(data, "branch-cleanup")).toBe("applied");
    expect(stepOutcome(data, "ticket-to-done")).toBe("applied");
  });

  test("member values are never derived from free-form step detail", async () => {
    const plain = applied(
      (await runMemberCloseout({ observations: bothMerged(), apply: true })).result,
    );
    const misleading = applied(
      (
        await runMemberCloseout({
          observations: bothMerged(),
          apply: true,
          misleadingDetail: true,
        })
      ).result,
    );
    expect(misleading.members).toEqual(plain.members);
  });

  test("each apply-column condition maps from the member observation and its operations", async () => {
    const observations = [
      memberCloseoutObservation(API_MEMBER, { issueClosure: "closed" }),
      memberCloseoutObservation(WEB_MEMBER, { issueClosure: "none" }),
    ];
    const data = applied(
      (
        await runMemberCloseout({
          observations,
          apply: true,
          factsOverrides: { branches: [{ name: API_MEMBER.branch, head: API_MEMBER.headSha }] },
        })
      ).result,
    );
    expect(memberOf(data, API_MEMBER.repoKey)).toMatchObject({
      cleanup: "applied",
      issueClosure: "satisfied",
    });
    // `web`'s branch is already absent: satisfied, and no tracked issue: noop.
    expect(memberOf(data, WEB_MEMBER.repoKey)).toMatchObject({
      cleanup: "satisfied",
      issueClosure: "skipped-noop",
    });

    const gap = applied(
      (
        await runMemberCloseout({
          observations: [
            memberCloseoutObservation(API_MEMBER, { issueClosure: "unavailable" }),
            memberCloseoutObservation(WEB_MEMBER),
          ],
          apply: true,
          git: {
            deleteBranchFor: (branch) =>
              branch === API_MEMBER.branch
                ? { ok: false, code: "closeout.branch.unsafe", detail: "provider gap" }
                : { ok: true },
          },
        })
      ).result,
    );
    expect(memberOf(gap, API_MEMBER.repoKey)).toMatchObject({
      cleanup: "skipped-gap",
      issueClosure: "skipped-gap",
    });
    expect(memberOf(gap, WEB_MEMBER.repoKey)).toMatchObject({
      cleanup: "applied",
      issueClosure: "applied",
    });
  });

  test("each landing removes only its own member ref with reason landed", async () => {
    const observations = bothMerged();
    const harness = createQueueRemovalHarness({
      label: "members-both",
      apply: true,
      members: observations,
    });
    try {
      const apiRef = memberRef(API_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      const webRef = memberRef(WEB_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      seedQueueEntry(harness, apiRef, "host/owner/api");
      seedQueueEntry(harness, webRef, "host/owner/web");
      const result = await harness.run();
      if (!result.ok) throw new Error(result.code);
      expect(result.data.queueRemovals?.map((entry) => entry.ref)).toEqual([apiRef, webRef]);
      expect(result.data.queueRemovals?.every((entry) => entry.reason === "landed")).toBe(true);
      const fold = readQueueFold(harness.store);
      expect(fold.ok).toBe(true);
      if (!fold.ok) return;
      expect(fold.value.entries.map((entry) => entry.ref)).toEqual([]);
      const removals = readQueueRemovals(harness.store);
      expect(removals.ok).toBe(true);
      if (!removals.ok) return;
      expect(removals.records.map((record) => record.reason)).toEqual(["landed", "landed"]);
    } finally {
      harness.dispose();
    }
  });

  test("the declared member set is bounded by CLOSEOUT_MAX_MEMBERS", () => {
    expect(CLOSEOUT_MAX_MEMBERS).toBe(8);
    const plan = buildCloseoutPlan(memberCloseoutFacts(bothMerged()));
    expect(plan.members).toHaveLength(2);
    expect(plan.members?.map((entry) => entry.observation.repoKey)).toEqual([
      API_MEMBER.repoKey,
      WEB_MEMBER.repoKey,
    ]);
  });
});

describe("TC-XCLOSE-002 partial landing: nothing claims an unlanded member", () => {
  test("A merged/B not: A removed, B retained and disclosed", async () => {
    const observations = [
      memberCloseoutObservation(API_MEMBER),
      memberCloseoutObservation(WEB_MEMBER, { merged: false }),
    ];
    const report = applied((await runMemberCloseout({ observations, apply: true })).result);
    expect(memberOf(report, API_MEMBER.repoKey).landed).toBe(true);
    expect(memberOf(report, WEB_MEMBER.repoKey).landed).toBe(false);

    const harness = createQueueRemovalHarness({
      label: "members-partial",
      apply: true,
      members: observations,
    });
    try {
      const apiRef = memberRef(API_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      const webRef = memberRef(WEB_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      seedQueueEntry(harness, apiRef, "host/owner/api");
      seedQueueEntry(harness, webRef, "host/owner/web");
      const result = await harness.run();
      if (!result.ok) throw new Error(result.code);
      expect(result.data.queueRemovals).toEqual([
        { outcome: "removed", ref: apiRef, reason: "landed" },
        { outcome: "skipped", skipReason: "no-merge-truth", ref: webRef },
      ]);
      const fold = readQueueFold(harness.store);
      expect(fold.ok).toBe(true);
      if (!fold.ok) return;
      expect(fold.value.entries.map((entry) => entry.ref)).toEqual([webRef]);
      expect(result.data.steps.every((step) => step.outcome !== "failed")).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("a held lease on one member skips only that member", async () => {
    const observations = bothMerged();
    const harness = createQueueRemovalHarness({
      label: "members-lease",
      apply: true,
      members: observations,
    });
    try {
      const apiRef = memberRef(API_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      const webRef = memberRef(WEB_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      seedQueueEntry(harness, apiRef, "host/owner/api");
      seedQueueEntry(harness, webRef, "host/owner/web");
      seedQueueLease(harness, { holder: "dispatch", ref: apiRef });
      const result = await harness.run();
      if (!result.ok) throw new Error(result.code);
      expect(result.data.queueRemovals).toEqual([
        { outcome: "skipped", skipReason: "lease-held", ref: apiRef },
        { outcome: "removed", ref: webRef, reason: "landed" },
      ]);
      const fold = readQueueFold(harness.store);
      expect(fold.ok).toBe(true);
      if (!fold.ok) return;
      expect(fold.value.entries.map((entry) => entry.ref)).toEqual([apiRef]);
    } finally {
      harness.dispose();
    }
  });

  test("a repeated apply is idempotent: no duplicate removals", async () => {
    const observations = bothMerged();
    const harness = createQueueRemovalHarness({
      label: "members-repeat",
      apply: true,
      members: observations,
    });
    try {
      const apiRef = memberRef(API_MEMBER.repoKey, CLOSEOUT_WORK_ITEM_REF);
      seedQueueEntry(harness, apiRef, "host/owner/api");
      const first = await harness.run();
      expect(first.ok).toBe(true);
      const once = readQueueRemovals(harness.store);
      expect(once.ok).toBe(true);
      if (!once.ok) return;
      const second = await harness.run();
      expect(second.ok).toBe(true);
      const twice = readQueueRemovals(harness.store);
      expect(twice.ok).toBe(true);
      if (!twice.ok) return;
      expect(twice.records.length).toBe(once.records.length);
      if (second.ok) {
        expect(second.data.queueRemovals?.[0]).toMatchObject({ outcome: "satisfied", ref: apiRef });
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-XCLOSE-003 unsafe squash predicate: refused without deleting or distorting landing", () => {
  const unsafeHeads = () => ({ [WEB_MEMBER.branch]: "f".repeat(40) });
  const observations = () => bothMerged();

  test("plan mode reports would-refuse for the unsafe member and would-apply for the safe one", async () => {
    const harness = await runMemberCloseout({
      observations: observations(),
      apply: false,
      branchHeads: unsafeHeads(),
    });
    const data = applied(harness.result);
    expect(data.mode).toBe("plan");
    expect(memberOf(data, WEB_MEMBER.repoKey).cleanup).toBe("would-refuse");
    expect(memberOf(data, API_MEMBER.repoKey).cleanup).toBe("would-apply");
    for (const entry of data.members ?? []) {
      expect(CLOSEOUT_MEMBER_CLEANUP_PLAN_OUTCOMES).toContain(entry.cleanup as never);
      expect(CLOSEOUT_MEMBER_ISSUE_PLAN_OUTCOMES).toContain(entry.issueClosure as never);
    }
  });

  test("apply mode refuses the unsafe member, applies the safe one, and keeps the branch", async () => {
    const harness = await runMemberCloseout({
      observations: observations(),
      apply: true,
      branchHeads: unsafeHeads(),
      misleadingDetail: true,
    });
    const data = applied(harness.result);
    expect(memberOf(data, WEB_MEMBER.repoKey).cleanup).toBe("refused");
    expect(memberOf(data, API_MEMBER.repoKey).cleanup).toBe("applied");
    expect(data.steps.find((step) => step.stepId === "branch-cleanup")?.outcome).toBe("applied");
    expect(harness.git.calls.filter((call) => call.kind === "deleteBranch")).toEqual([
      expect.objectContaining({ target: API_MEMBER.branch }),
    ]);
    expect(memberOf(data, WEB_MEMBER.repoKey).landed).toBe(true);
    expect(data.members?.every((entry) => entry.landed)).toBe(true);
  });
});

describe("TC-XCLOSE-004 plan mode writes nothing and reports the member shape", () => {
  test("CLI plan mode reports the member report with zero writes", async () => {
    const observations = bothMerged();
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
    ]);
    for (const entry of data.members ?? []) {
      expect(Object.keys(entry).sort()).toEqual([...MEMBER_FIELDS].sort());
      expect(entry.landed).toBe(true);
    }
    expect(run.state.records).toEqual([]);
    expect(run.state.fence.acquired).toBe(0);
    expect(run.git.calls.some((call) => call.kind === "deleteBranch")).toBe(false);
    expect(run.provider.calls.some((call) => call.kind === "transitionWorkItem")).toBe(false);
    expect(run.provider.calls.some((call) => call.kind === "writeWorkItem")).toBe(false);
  });
});
