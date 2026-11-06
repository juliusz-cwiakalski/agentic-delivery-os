/**
 * TC-MERGE-024 / TC-MERGE-025 / TC-MERGE-029 — the squash landing is verified,
 * an unverifiable landing is an honest exit-2 unknown, and a post-landing
 * cleanup failure never flips the landing verdict.
 */
import { describe, expect, test } from "bun:test";
import { createLandingRepo, FIXTURE_BASE, FIXTURE_BRANCH } from "../fixtures/merge/git-harness";
import {
  baseCheckRuns,
  baseRequest,
  createFakeGit,
  createMergeHarness,
  MERGE_CLOCK_MS,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;

const dataOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.data as Record<string, unknown> | undefined;

describe("TC-MERGE-024 the squash landing is verified with post-landing steps declared", () => {
  test("the base advances by exactly one single-parent squash whose tree is the request tree", async () => {
    const fixture = createLandingRepo();
    const harness = createMergeHarness({
      git: fixture.git,
      branch: fixture.branch,
      baseRef: fixture.baseRef,
      request: baseRequest({
        sourceRef: FIXTURE_BRANCH,
        targetRef: FIXTURE_BASE,
        sourceHeadSha: fixture.oldHead,
        headSha: fixture.oldHead,
      }),
      checkRuns: { ...baseCheckRuns(), sha: fixture.oldHead },
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(verificationRecord({ headSha: fixture.oldHead }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      const data = dataOf(result);
      expect(data?.result).toBe("merged");
      expect(typeof data?.squashSha).toBe("string");
      const squashSha = String(data?.squashSha);
      expect(fixture.repo.head()).toBe(squashSha);
      expect(fixture.repo.commitCount()).toBe(2);
      const parent = fixture.repo.run(["rev-parse", `${squashSha}^`]).stdout.trim();
      expect(parent).toBe(fixture.baseHead);
      const squashTree = fixture.repo.run(["rev-parse", `${squashSha}^{tree}`]).stdout.trim();
      const requestTree = fixture.repo
        .run(["rev-parse", `${fixture.oldHead}^{tree}`])
        .stdout.trim();
      expect(squashTree).toBe(requestTree);
      const branch = fixture.repo.run(["rev-parse", "--verify", `refs/heads/${fixture.branch}`]);
      expect(branch.status).not.toBe(0);
      const postLanding = data?.postLanding as readonly { id: string; status: string }[];
      expect(postLanding).toEqual([
        { id: "branch-deletion", status: "ok" },
        { id: "closeout-ready", status: "ok" },
      ]);
      expect(harness.transactions()).toHaveLength(1);
      expect(harness.transactions()[0]?.result).toBe("merged");
      expect(harness.transactions()[0]?.refresh).toEqual({
        attempts: 0,
        outcome: "not-attempted",
      });
      expect(harness.transactions()[0]?.waiverRefs).toEqual([]);
      expect(harness.auditRecords).toHaveLength(1);
      expect(harness.counts.verification).toBe(1);
    } finally {
      harness.cleanup();
      fixture.cleanup();
    }
  });
});

describe("TC-MERGE-025 an unverifiable landing is exit-2 unknown", () => {
  const variants = [
    {
      id: "not-contained",
      land: {
        ok: true as const,
        squashSha: "b1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
        requestState: "merged",
        containedOnBase: false as const,
      },
    },
    {
      id: "containment-read-failed",
      land: {
        ok: true as const,
        squashSha: "b1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
        requestState: "merged",
        containedOnBase: "failed" as const,
      },
    },
    {
      id: "request-still-open",
      land: {
        ok: true as const,
        squashSha: "b1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
        requestState: "open",
        containedOnBase: true as const,
      },
    },
  ];

  for (const variant of variants) {
    test(`${variant.id}: exit 2, consequence unknown, never merged, no second landing`, async () => {
      let contained: boolean | "failed" = false;
      const git = createFakeGit({
        land: variant.land,
        contained: () => contained,
      });
      const harness = createMergeHarness({ git });
      try {
        harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
        const result = await harness.run();
        expect(result.exitCode).toBe(2);
        expect(errorOf(result)?.code).toBe("merge.landing-unverified");
        expect(errorOf(result)?.consequence).toBe("unknown");
        expect(dataOf(result)?.result).not.toBe("merged");
        expect(harness.events).not.toContain("git-delete-branch");
        expect(harness.transactions()[0]?.result).toBe("landing-unverified");
        // A re-run re-verifies rather than re-lands; when containment is now
        // observable it replays merged.
        contained = true;
        const replay = await harness.run();
        expect(replay.exitCode).toBe(0);
        expect(dataOf(replay)?.result).toBe("merged");
        expect(harness.events.filter((event) => event === "git-squash-land")).toHaveLength(1);
      } finally {
        harness.cleanup();
      }
    });
  }

  test("the clean-landing control reports merged", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      expect((await harness.run()).exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-MERGE-029 a post-landing cleanup failure never flips the landing", () => {
  test("a failed branch deletion is declared without un-landing", async () => {
    const git = createFakeGit({ delete: "failed" });
    const harness = createMergeHarness({ git });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      const data = dataOf(result);
      expect(data?.result).toBe("merged");
      expect(data?.postLanding).toEqual([
        { id: "branch-deletion", status: "failed" },
        { id: "closeout-ready", status: "ok" },
      ]);
      expect(harness.transactions()[0]?.postLanding).toEqual([
        { id: "branch-deletion", status: "failed" },
        { id: "closeout-ready", status: "ok" },
      ]);
      expect(errorOf(result)).toBeUndefined();
    } finally {
      harness.cleanup();
    }
  });

  test("a failed transaction-record append is declared and the landing stays merged", async () => {
    const git = createFakeGit();
    const harness = createMergeHarness({
      git,
      appendTransactionFault: "state.write.failed",
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
      expect(dataOf(result)?.postLanding).toEqual([
        { id: "branch-deletion", status: "ok" },
        { id: "closeout-ready", status: "failed" },
      ]);
      expect(harness.transactions()).toHaveLength(0);
      // The already-merged request converges without a second landing.
      harness.setRequest(
        baseRequest({ reviewState: "merged", headSha: "b1b2c3d4e5f60718293a4b5c6d7e8f9012345678" }),
      );
      const replay = await harness.run();
      expect(replay.exitCode).toBe(0);
      expect(harness.events.filter((event) => event === "git-squash-land")).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });

  test("both cleanup failures are still declared and never silent", async () => {
    const git = createFakeGit({ delete: "failed" });
    const harness = createMergeHarness({
      git,
      appendTransactionFault: "state.write.failed",
    });
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      expect(result.exitCode).toBe(0);
      expect(dataOf(result)?.result).toBe("merged");
      const postLanding = dataOf(result)?.postLanding as readonly { status: string }[];
      expect(postLanding.every((step) => step.status === "failed")).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("the clean control reports every post-landing step ok", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      const postLanding = dataOf(result)?.postLanding as readonly { status: string }[];
      expect(postLanding.every((step) => step.status === "ok")).toBe(true);
    } finally {
      harness.cleanup();
    }
  });
});
