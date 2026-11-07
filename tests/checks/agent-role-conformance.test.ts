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
