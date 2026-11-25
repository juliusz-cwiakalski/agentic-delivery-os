/**
 * TC-WT-002 check half — the addWorktree seam house style (GH-404 F-1, NFR-1,
 * AC-F1-1): no shell invocation, no force token, no network in the create
 * path, and the refusal matrix surfaced as typed refusals with ZERO retries
 * (a counting child runner proves one call per refusal). Source-scan canary
 * in the no-shell-dispatch pattern: planted canaries fail the scan and are
 * contained.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createGitBranchSeam, type GitChildRunnerResult } from "@delivery-os/adapters/git";

const SEAM_SOURCE = readFileSync(join(process.cwd(), "packages/adapters/src/git/index.ts"), "utf8");

/**
 * The scan the assertions run (review F-14): the same predicate over the live
 * source and over planted canary text, so the control actually executes the
 * scan instead of asserting on a concatenated string.
 */
const scanSeamSource = (source: string): readonly string[] => {
  const problems: string[] = [];
  if (source.includes("execSync") || source.includes("spawnSync")) {
    problems.push("shell invocation in the seam module");
  }
  if (source.includes('"--force"') || source.includes("'--force'")) {
    problems.push("force flag token in the seam module");
  }
  if (source.includes("fetch(")) {
    problems.push("network call in the seam module");
  }
  if (!/"worktree",\s*"add",\s*"--detach"/su.test(source)) {
    problems.push("the addWorktree argv is not the declared detached form");
  }
  return problems;
};

describe("TC-WT-002 the addWorktree seam house style", () => {
  test("the create path carries no shell, no force flag, and no network", () => {
    // The seam module is spawn-only over execFile with fixed argv arrays; the
    // create path adds no shell string, no force token, and no network call.
    expect(scanSeamSource(SEAM_SOURCE)).toEqual([]);
  });

  test("planted canaries make the scan fail and stay contained", () => {
    const planted = `${SEAM_SOURCE}\nconst CANARY_FORCE = "--force";\nconst CANARY_SHELL = execSync("echo planted");\n`;
    const problems = scanSeamSource(planted);
    // The scan REJECTS the planted text: every planted canary is named.
    expect(problems.some((problem) => problem.includes("force flag"))).toBe(true);
    expect(problems.some((problem) => problem.includes("shell invocation"))).toBe(true);
    // The canaries live only in this test's string; the scanned file is
    // untouched (containment).
    expect(SEAM_SOURCE.includes("CANARY_FORCE")).toBe(false);
  });

  test("every git refusal is final: one call per refusal, zero retries", async () => {
    const calls: string[] = [];
    const countingRunner = async (
      _file: string,
      args: readonly string[],
    ): Promise<GitChildRunnerResult> => {
      calls.push(args.join(" "));
      // Refuse every mutation the refusal matrix attempts.
      return { stdout: "", stderr: "refused", status: 128, timedOut: false };
    };
    const seam = createGitBranchSeam({
      cwd: "/gh404-refusal-matrix",
      timeoutMs: 5_000,
      childRunner: countingRunner,
    });
    const refused = await seam.addWorktree({
      path: "/gh404-refusal-matrix/wt",
      baseRef: "main-tools",
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe("worktree-add-refused");
      expect(refused.detail).toContain("git refused the worktree creation");
    }
    // Exactly ONE git invocation for the refusal — zero retries, zero
    // fallbacks, zero overrides.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("worktree add --detach /gh404-refusal-matrix/wt main-tools");
  });

  test("the seam-side validations refuse before any git call", async () => {
    const calls: string[] = [];
    const countingRunner = async (
      _file: string,
      args: readonly string[],
    ): Promise<GitChildRunnerResult> => {
      calls.push(args.join(" "));
      return { stdout: "", stderr: "", status: 0, timedOut: false };
    };
    const seam = createGitBranchSeam({
      cwd: "/gh404-validation",
      timeoutMs: 5_000,
      childRunner: countingRunner,
    });
    const relativePath = await seam.addWorktree({
      path: "relative/wt",
      newBranch: "lane/GH-5",
      baseRef: "base",
    });
    expect(relativePath).toEqual({
      ok: false,
      code: "plan-restriction",
      detail: "unsafe worktree path",
    });
    // The validations refused before any git invocation.
    expect(calls).toEqual([]);
  });
});
