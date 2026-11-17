/**
 * Real temporary repositories for the supervision behaviour suites (GH-295
 * test plan §6, NFR-7). Every fixture lives under the configured temp root, is
 * initialized with an explicit `main` base and a fixed author identity, and is
 * removed explicitly. The guard rejects the live workspace and any non-temp
 * root with distinct messages, so no case can ever target the checkout it runs
 * in.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export type SupervisionTempRepository = {
  readonly directory: string;
  readonly baseRef: string;
  readonly run: (args: readonly string[]) => string;
  readonly remove: () => void;
};

export const SUPERVISION_BASE_REF = "main";
export const SUPERVISION_MANAGED_KEY = "github.com/example/supervision-repo";

/** Reject the live workspace, then any root outside the temp directory. */
export const guardSupervisionFixtureRoot = (directory: string): void => {
  if (resolve(directory) === resolve(process.cwd())) {
    throw new Error("supervision fixture root must not be the live workspace");
  }
  if (!resolve(directory).startsWith(resolve(tmpdir()))) {
    throw new Error("supervision fixture root must live under the configured temp directory");
  }
};

/** Create a real repository with one `main` commit; no network, no remote. */
export const createSupervisionRepository = (label = "supervise"): SupervisionTempRepository => {
  const directory = mkdtempSync(join(tmpdir(), `gh295-${label}-`));
  guardSupervisionFixtureRoot(directory);
  const run = (args: readonly string[]): string =>
    execFileSync("git", [...args], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  run(["init", "-b", SUPERVISION_BASE_REF]);
  run(["config", "user.email", "supervise@example.invalid"]);
  run(["config", "user.name", "Supervision Fixture"]);
  run(["commit", "--allow-empty", "-m", "baseline"]);
  return {
    directory,
    baseRef: SUPERVISION_BASE_REF,
    run,
    remove: () => rmSync(directory, { recursive: true, force: true }),
  };
};
