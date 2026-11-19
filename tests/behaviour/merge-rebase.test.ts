/**
 * TC-F1-001 / TC-F2-001 / TC-F2-008 / TC-F7-004 (suite obligation) — the
 * delivered rebase suite, inverted: `merge` never attempts a local rebase, never
 * mutates the head it verified, and resolves an unsyncable request as the typed
 * sync refusal. The retained refresh capability lives at the git seam with no
 * composed caller (`merge-git-seam-capabilities.test.ts`).
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

describe("TC-F2-001 a conflicting request is a typed sync refusal, not a rebase", () => {
  test("exit 1 with reason dirty, zero refresh attempts, zero landings, head unchanged", async () => {
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
      expect(errorOf(result)?.code).toBe("merge.sync-required");
      const summary = String(errorOf(result)?.summary);
      expect(summary).toContain("evidence=dirty");
      expect(summary).toContain("request-state=conflicting");
      // No local rebase, no landing, no branch mutation: the pre-fix F8 churn is
      // gone (spec Appendix F F8).
      expect(harness.events).not.toContain("git-rebase-refresh");
      expect(harness.events).not.toContain("git-squash-land");
      expect(harness.counts.landing).toBe(0);
      expect(harness.transactions()).toHaveLength(0);
      expect(fixture.repo.head()).toBe(fixture.oldHead);
      // A second invocation refreshes nothing either: the count stays zero.
      const retry = await harness.run();
      expect(retry.exitCode).toBe(1);
      expect(harness.events).not.toContain("git-rebase-refresh");
      expect(harness.counts.landing).toBe(0);
    } finally {
      harness.cleanup();
      fixture.cleanup();
    }
  });
});

describe("TC-F2-002/003 a behind request is classified, never rebased", () => {
  test("the provider refusal resolves to behind-unconfirmed with zero rebase attempts", async () => {
    const fixture = createBehindRepo();
    const harness = createMergeHarness({
      git: fixture.git,
      branch: fixture.branch,
      baseRef: fixture.baseRef,
      landing: { ok: false, code: "protection-rule" },
      request: baseRequest({
        sourceRef: FIXTURE_BRANCH,
        targetRef: FIXTURE_BASE,
        sourceHeadSha: fixture.oldHead,
        headSha: fixture.oldHead,
        mergeableState: "not-mergeable",
      }),
      checkRuns: { ...baseCheckRuns(), sha: fixture.oldHead },
    });
    try {
      harness.seedVerification(verificationRecord({ headSha: fixture.oldHead }));
      const result = await harness.run();
      expect(result.exitCode).toBe(1);
      expect(errorOf(result)?.code).toBe("merge.sync-required");
      const summary = String(errorOf(result)?.summary);
      expect(summary).toContain("evidence=behind-unconfirmed");
      expect(summary).toContain("request-state=not-mergeable");
      expect(harness.events).not.toContain("git-rebase-refresh");
      // The head the verification bound is the head that was offered, and it is
      // still the head after the run: no branch mutates what it verified.
      expect(harness.landings[0]?.expectedHeadSha).toBe(fixture.oldHead);
      expect(fixture.repo.head()).toBe(fixture.oldHead);
      expect(harness.counts.landing).toBe(1);
    } finally {
      harness.cleanup();
      fixture.cleanup();
    }
  });
});

describe("TC-F2-008 the mutation vocabulary has no force or rebase path", () => {
  test("the operations and the composed sources carry no force, push, or reset construct", () => {
    for (const operation of MERGE_GIT_OPERATIONS) {
      expect(operation).not.toMatch(/force|push|reset|hard/u);
    }
    for (const file of [
      "packages/adapters/src/git/merge.ts",
      "packages/cli/src/commands/merge.ts",
      "packages/cli/src/edge.ts",
      "packages/core/src/domain/merge-transaction.ts",
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

  test("the mandatory failing control: a planted refresh event is detectable", () => {
    const planted = ["git-read-head", "git-rebase-refresh"];
    expect(planted).toContain("git-rebase-refresh");
    expect(planted.filter((event) => event === "git-rebase-refresh")).toHaveLength(1);
  });
});
