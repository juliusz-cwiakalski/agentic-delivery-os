/** A temporary local git repository for the branch/checkout seam (offline). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type TempRepo = {
  readonly directory: string;
  readonly deliveryBranch: string;
  readonly baseRef: string;
  readonly deliveryHead: string;
  readonly run: (args: readonly string[]) => string;
  readonly remove: () => void;
};

export const BASE_REF = "main-tools";
export const DELIVERY_BRANCH = "feat/GH-183/closeout-v1-branch-cleanup";

/** Create a repository with `main`, a base branch, and one delivery commit. */
export const createTempRepo = (): TempRepo => {
  const directory = mkdtempSync(join(tmpdir(), "gh183-git-"));
  const run = (args: readonly string[]): string =>
    execFileSync("git", [...args], { cwd: directory, encoding: "utf8" }).trim();
  run(["init", "-b", "main"]);
  run(["config", "user.email", "closeout@example.invalid"]);
  run(["config", "user.name", "Closeout Fixture"]);
  writeFileSync(join(directory, "README.md"), "baseline\n");
  run(["add", "README.md"]);
  run(["commit", "-m", "baseline"]);
  run(["branch", BASE_REF]);
  run(["checkout", "-b", DELIVERY_BRANCH]);
  writeFileSync(join(directory, "feature.txt"), "delivery\n");
  run(["add", "feature.txt"]);
  run(["commit", "-m", "delivery work"]);
  const deliveryHead = run(["rev-parse", "HEAD"]);
  return {
    directory,
    deliveryBranch: DELIVERY_BRANCH,
    baseRef: BASE_REF,
    deliveryHead,
    run,
    remove: () => rmSync(directory, { recursive: true, force: true }),
  };
};
