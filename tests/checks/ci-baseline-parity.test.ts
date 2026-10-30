/**
 * TC-SCAFFOLD-039 — hermetic partial-clone simulation of the local-vs-CI
 * git-history drift class.
 *
 * The forbidden-literal scan resolves the recorded `corpusBaseline` commit with
 * `git cat-file` and fails closed when the commit is unreachable. A depth-1
 * checkout is exactly that starved environment, so this test manufactures one
 * from a local full clone (no network), proves the scan fails closed, then
 * proves the refspec-free baseline fetch (`git fetch origin <sha>`) is the
 * remedy. The same partial checkout also cannot resolve a remote-tracking ref,
 * which is why the CI jobs run with full history.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const REGISTRY_PATH = "scripts/checks/forbidden-literals.registry.json";
const SCAN = "scripts/checks/forbidden-literals.ts";
const FAIL_CLOSED = "missing or unreachable corpusBaseline";

const readBaseline = (): string =>
  (JSON.parse(readFileSync(join(ROOT, REGISTRY_PATH), "utf8")) as { corpusBaseline: string })
    .corpusBaseline;

const git = (root: string, args: string[]): string =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const gitStatus = (root: string, args: string[]): number | null =>
  spawnSync("git", args, { cwd: root, encoding: "utf8" }).status;

const scanIn = (root: string): { status: number | null; stdout: string; stderr: string } => {
  const result = spawnSync("bun", ["run", SCAN], { cwd: root, encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

describe("CI baseline parity (hermetic partial clone)", () => {
  test("a depth-1 checkout fails closed and the baseline fetch is the remedy", () => {
    const baseline = readBaseline();
    const workspace = mkdtempSync(join(tmpdir(), "ci-baseline-parity-"));
    const source = join(workspace, "source");
    const partial = join(workspace, "partial");

    try {
      // 1. Local full clone of this repo (no network). Pin an attached branch so
      //    the depth-1 clone below has a resolvable HEAD even when the live
      //    checkout is detached (as GitHub Actions checks out PR merge refs).
      git(workspace, ["clone", "--quiet", "--local", ROOT, source]);
      const head = git(ROOT, ["rev-parse", "HEAD"]);
      git(source, ["checkout", "--quiet", "-B", "parity-sim", head]);

      // 2. Manufacture the drift: a real depth-1 clone through the git transport
      //    (a plain local path would silently ignore --depth and stay full).
      git(workspace, ["clone", "--quiet", "--depth", "1", "--no-local", source, partial]);
      expect(existsSync(join(partial, ".git/shallow"))).toBe(true);
      expect(gitStatus(partial, ["cat-file", "-e", `${baseline}^{commit}`])).not.toBe(0);
      expect(gitStatus(partial, ["rev-parse", "--verify", "origin/main-tools"])).not.toBe(0);

      // 3. The scan must fail closed, naming the recorded baseline — never pass
      //    with a silently empty docs scope.
      const starved = scanIn(partial);
      expect(starved.status).not.toBe(0);
      expect(starved.stderr).toContain(FAIL_CLOSED);
      expect(starved.stderr).toContain(baseline);

      // 4. The remedy: fetch the recorded commit (same step the scan job runs).
      git(partial, ["fetch", "--no-tags", "origin", baseline]);
      expect(gitStatus(partial, ["cat-file", "-e", `${baseline}^{commit}`])).toBe(0);

      const repaired = scanIn(partial);
      expect(repaired.status).toBe(0);
      expect(repaired.stdout).toContain("5/5 scope classes scanned, 0 violations");
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }, 120_000);
});
