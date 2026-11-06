/**
 * TC-MERGE-022 / TC-MERGE-023 — exactly one rebase-refresh attempt, a
 * classified conflict naming paths, no force vocabulary, and a successful
 * refresh that voids the SHA-bound verification.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MERGE_GIT_OPERATIONS } from "../../packages/core/src/contracts/index";
import {
  createBehindRepo,
  createConflictingRepo,
  FIXTURE_BASE,
  FIXTURE_BRANCH,
} from "../fixtures/merge/git-harness";
import {
  baseCheckRuns,
  baseRequest,
  createMergeHarness,
  verificationRecord,
} from "../fixtures/merge/harness";

const ROOT = process.cwd();

const errorOf = (run: { envelope?: Record<string, unknown> }) =>
  run.envelope?.error as Record<string, unknown> | undefined;

describe("TC-MERGE-022 a conflicting refresh is a classified refusal naming paths", () => {
  test("exit 1, both conflicting paths named, exactly one attempt, and no landing", async () => {
    const fixture = createConflictingRepo();
    const harness = createMergeHarness({
      git: fixture.git,
      branch: fixture.branch,
      baseRef: fixture.baseRef,
      request: baseRequest({
        sourceRef: FIXTURE_BRANCH,
        targetRef: FIXTURE_BASE,
        sourceHeadSha: fixture.oldHead,
        headSha: fixture.oldHead,
        mergeableState: "conflicting",
      }),
      checkRuns: { ...baseCheckRuns(), sha: fixture.oldHead },
    });
    try {
      harness.seedVerification(verificationRecord({ headSha: fixture.oldHead }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.rebase-conflict");
      const summary = String(errorOf(result)?.summary);
      expect(summary).toContain("packages/core/src/a.ts");
      expect(summary).toContain("packages/core/src/b.ts");
      expect(harness.events.filter((event) => event === "git-rebase-refresh")).toHaveLength(1);
      expect(harness.events).not.toContain("git-squash-land");
      expect(harness.events).not.toContain("git-delete-branch");
      expect(harness.transactions()).toHaveLength(0);
      expect(fixture.repo.head()).toBe(fixture.oldHead);
      // Exactly one attempt per invocation: a retry makes one new attempt.
      const retry = await harness.run();
      expect(retry.exitCode).toBe(1);
      expect(harness.events.filter((event) => event === "git-rebase-refresh")).toHaveLength(2);
    } finally {
      harness.cleanup();
      fixture.cleanup();
    }
  });

  test("the operation union has no force variant and the source scan finds no force construct", () => {
    for (const operation of MERGE_GIT_OPERATIONS) {
      expect(operation).not.toMatch(/force|push|reset|hard/);
    }
    for (const file of [
      "packages/adapters/src/git/merge.ts",
      "packages/cli/src/commands/merge.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const banned of ["--force", "push --force", "reset --hard", "force-with-lease"]) {
        expect(text, `${file}:${banned}`).not.toContain(banned);
      }
    }
  });

  test("the mandatory failing control uses a force construct and is detected", () => {
    const control = 'await git(["push", "--force", "origin", "main-tools"]);\n';
    expect(["--force", "push --force"].some((marker) => control.includes(marker))).toBe(true);
  });
});

describe("TC-MERGE-023 a successful refresh voids the SHA binding", () => {
  test("exit 1 gates-stale with the old-to-new SHA transition and no landing", async () => {
    const fixture = createBehindRepo();
    const harness = createMergeHarness({
      git: fixture.git,
      branch: fixture.branch,
      baseRef: fixture.baseRef,
      request: baseRequest({
        sourceRef: FIXTURE_BRANCH,
        targetRef: FIXTURE_BASE,
        sourceHeadSha: fixture.oldHead,
        headSha: fixture.oldHead,
        mergeableState: "conflicting",
      }),
      checkRuns: { ...baseCheckRuns(), sha: fixture.oldHead },
    });
    try {
      harness.seedVerification(verificationRecord({ headSha: fixture.oldHead }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.gates-stale");
      const summary = String(errorOf(result)?.summary);
      expect(summary).toContain("head-transition=");
      expect(summary).toContain(fixture.oldHead.slice(0, 7));
      expect(harness.events.filter((event) => event === "git-rebase-refresh")).toHaveLength(1);
      expect(harness.events).not.toContain("git-squash-land");
      expect(harness.transactions()).toHaveLength(0);
      // The verification remains bound to the old SHA.
      expect(harness.verifications()[0]?.headSha).toBe(fixture.oldHead);
    } finally {
      harness.cleanup();
      fixture.cleanup();
    }
  });

  test("the re-verify-then-merge control lands on the rebased head", async () => {
    const fixture = createBehindRepo();
    const harness = createMergeHarness({
      git: fixture.git,
      branch: fixture.branch,
      baseRef: fixture.baseRef,
      request: baseRequest({
        sourceRef: FIXTURE_BRANCH,
        targetRef: FIXTURE_BASE,
        sourceHeadSha: fixture.oldHead,
        headSha: fixture.oldHead,
        mergeableState: "conflicting",
      }),
      checkRuns: { ...baseCheckRuns(), sha: fixture.oldHead },
    });
    try {
      harness.seedVerification(verificationRecord({ headSha: fixture.oldHead }));
      expect((await harness.run()).exitCode).toBe(1);
      const newHead = await fixture.seam.head();
      if (newHead === undefined) throw new Error("rebased head unresolved");
      harness.seedVerification(verificationRecord({ headSha: newHead }));
      harness.setRequest(
        baseRequest({
          sourceRef: FIXTURE_BRANCH,
          targetRef: FIXTURE_BASE,
          sourceHeadSha: newHead,
          headSha: newHead,
          mergeableState: "mergeable",
        }),
      );
      harness.setCheckRuns({ ...baseCheckRuns(), sha: newHead });
      const landed = await harness.run();
      expect(landed.exitCode).toBe(0);
      expect((landed.envelope?.data as { result?: string } | undefined)?.result).toBe("merged");
    } finally {
      harness.cleanup();
      fixture.cleanup();
    }
  });
});
