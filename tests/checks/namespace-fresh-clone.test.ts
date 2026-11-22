/**
 * TC-LAYER-003 (AC-F1-3) — a scratch clone of the phase head with no workspace
 * exclude file, seeded with the normal runtime write set, reports an empty
 * `git status --porcelain`.
 *
 * Driver D5: a real `git clone --no-local` of the committed head. The clone's
 * own `.git/info/exclude` is asserted to name neither project root, so the drill
 * cannot pass on a workstation exclude entry; the tracked layer is asserted
 * present and not ignored, and the prior root is asserted absent.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CLONE_BASE = join(ROOT, "tmp/tmpdir/namespace-fresh-clone");

const git = (cwd: string, args: readonly string[]) =>
  spawnSync("git", [...args], { cwd, encoding: "utf8" });

describe("TC-LAYER-003 fresh-clone drill", () => {
  // A real `--no-local` clone of the repository can exceed bun's default 5 s
  // budget on a loaded machine; the assertion, not the clock, is the subject.
  test("a scratch clone with the runtime write set reports zero status lines", () => {
    mkdirSync(CLONE_BASE, { recursive: true });
    const target = join(CLONE_BASE, `clone-${String(process.pid)}-${String(Date.now())}`);
    const cloned = git(ROOT, ["clone", "--no-local", "--quiet", ROOT, target]);
    expect(cloned.status).toBe(0);
    expect(existsSync(target)).toBe(true);
    try {
      const exclude = join(target, ".git/info/exclude");
      if (existsSync(exclude)) {
        const text = readFileSync(exclude, "utf8");
        expect(text).not.toContain(".delivery-os/");
        expect(text).not.toContain(".jaiship/");
      }

      writeFileSync(join(target, ".jaiship/config.local.yaml"), "namespace: local-marker\n");
      writeFileSync(join(target, ".jaiship/projects.yaml"), "projects: []\n");

      const status = git(target, ["status", "--porcelain"]);
      expect(status.status).toBe(0);
      expect(status.stdout).toBe("");

      expect(existsSync(join(target, ".jaiship/config.yaml"))).toBe(true);
      const ignored = git(target, ["check-ignore", "--no-index", "-q", ".jaiship/config.yaml"]);
      expect(ignored.status).not.toBe(0);

      const priorTracked = git(target, ["ls-files", ".delivery-os"]);
      expect(priorTracked.stdout.trim()).toBe("");
      expect(existsSync(join(target, ".delivery-os"))).toBe(false);
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }, 30_000);
});
