/**
 * TC-ADOPT-001/002 (foundation slice) — PM, coder, committer, commit, and
 * run-plan use the phase family and the commit primitive, and the committer is a
 * thin executor with no direct staging or message composition.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const pm = read(".opencode/agent/pm.md");
const coder = read(".opencode/agent/coder.md");
const committer = read(".opencode/agent/committer.md");
const commitCommand = read(".opencode/command/commit.md");
const runPlan = read(".opencode/command/run-plan.md");

describe("TC-ADOPT-001 PM and coder use the phase family and commit primitive", () => {
  test("PM completes phases through phase complete and reads through phase list", () => {
    expect(pm).toContain("phase complete <workItemRef>");
    expect(pm).toContain("phase list <workItemRef>");
    expect(pm).toContain("phase reopen <workItemRef>");
    expect(pm).toContain("plan validate <workItemRef>");
    expect(pm).toContain("blockers publish");
  });

  test("coder commits per plan phase and completes delivery at the boundary", () => {
    expect(coder).toContain("commit <workItemRef>");
    expect(coder).toContain("phase complete <workItemRef> delivery");
    expect(coder).toContain("blockers publish");
    expect(coder.toLowerCase()).toContain("pm-notes");
  });

  test("run-plan commits through the primitive and records pm-notes evidence", () => {
    expect(runPlan).toContain("commit <workItemRef>");
    expect(runPlan).toContain("phase complete <workItemRef> delivery");
    expect(runPlan).toContain("pm-notes");
  });

  test("the PM records the PR URL as a pm-notes note, not phase state", () => {
    expect(pm).toContain("pm-notes `notes:` entry");
    expect(pm).not.toContain("phases.pr_creation.url");
  });
});

describe("TC-ADOPT-002 the committer is a thin executor", () => {
  test("it invokes the commit primitive", () => {
    expect(committer).toContain("commit <workItemRef>");
    expect(committer).toContain("commit <workItemRef> --phase <phase>");
    expect(committer).toContain("Never run `git add`, `git commit`");
  });

  test("it performs no direct staging, commit, amend, or message composition", () => {
    expect(committer).toContain(
      "Never stage, re-stage, amend, or compose a commit message by hand",
    );
    expect(committer).toContain("The primitive owns the message");
    expect(committer).toContain("The primitive owns staging precision");
  });

  test("the commit command points at the primitive rather than raw git", () => {
    expect(commitCommand).toContain("commit");
    expect(commitCommand.toLowerCase()).toContain("primitive");
    expect(commitCommand).not.toContain("git add");
    expect(commitCommand).not.toContain("git commit");
  });
});

describe("coordination role conformance", () => {
  const ceo = read(".opencode/agent/ceo.md");
  const reviewer = read(".opencode/agent/reviewer.md");
  const readiness = read(".opencode/agent/readiness-reviewer.md");
  const docSyncer = read(".opencode/agent/doc-syncer.md");
  const specWriter = read(".opencode/agent/spec-writer.md");
  const testPlanWriter = read(".opencode/agent/test-plan-writer.md");
  const prManager = read(".opencode/agent/pr-manager.md");
  const reviewFeedback = read(".opencode/agent/review-feedback-applier.md");

  test("the coordinator uses merge, closeout, status, and queue plan", () => {
    for (const token of [
      "status",
      "blockers answer",
      "verify change",
      "phase list",
      "merge <ref>",
      "closeout --apply",
      "queue plan --next",
    ]) {
      expect(ceo).toContain(token);
    }
  });

  test("read-only roles do not commit", () => {
    expect(reviewer).toContain("pure writer");
    expect(reviewer).toContain("zero commit operations");
    expect(reviewer).toContain("Read-only git inspection");
    expect(reviewer).toContain("blockers publish");
    expect(readiness).toContain("zero git operations");
    expect(reviewFeedback).toContain("No commit or push made by this agent");
  });

  test("writer roles delegate commits to the primitive", () => {
    for (const text of [docSyncer, specWriter, testPlanWriter]) {
      expect(text).toContain("`commit` primitive");
    }
  });

  test("the PR manager never merges and commits dirty work through the primitive", () => {
    expect(prManager).toContain("Never merge");
    expect(prManager).toContain("`commit` primitive");
    expect(prManager).toContain("push");
  });
});
