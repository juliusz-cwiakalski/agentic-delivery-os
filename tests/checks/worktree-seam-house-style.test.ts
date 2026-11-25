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

describe("TC-WT-002 the addWorktree seam house style", () => {
  test("the create path carries no shell, no force flag, and no network", () => {
    // The seam module is spawn-only over execFile with fixed argv arrays; the
    // create path adds no shell string, no force token, and no network call.
    expect(SEAM_SOURCE.includes("execSync") || SEAM_SOURCE.includes("spawnSync")).toBe(false);
    expect(SEAM_SOURCE.includes('"--force"')).toBe(false);
    expect(SEAM_SOURCE.includes("'--force'")).toBe(false);
    expect(SEAM_SOURCE.includes("fetch(")).toBe(false);
    // The addWorktree argv is exactly the declared fixed form (whitespace-
    // tolerant match: the formatter may wrap the argv array).
    expect(/"worktree",\s*"add",\s*"-b"/su.test(SEAM_SOURCE)).toBe(true);
  });

  test("planted canaries make the scan fail and stay contained", () => {
    const planted = `${SEAM_SOURCE}\nconst CANARY_FORCE = "--force";\nconst CANARY_SHELL = execSync("echo planted");\n`;
    expect(planted.includes('"--force"')).toBe(true);
    expect(planted.includes("execSync")).toBe(true);
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
      newBranch: "lane/GH-4",
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
    expect(calls[0]).toBe("worktree add -b lane/GH-4 /gh404-refusal-matrix/wt main-tools");
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
    const unsafeBranch = await seam.addWorktree({
      path: "/gh404-validation/wt",
      newBranch: "-leading-dash",
      baseRef: "base",
    });
    expect(unsafeBranch).toEqual({
      ok: false,
      code: "plan-restriction",
      detail: "unsafe new branch name",
    });
    // The validations refused before any git invocation.
    expect(calls).toEqual([]);
  });
});
