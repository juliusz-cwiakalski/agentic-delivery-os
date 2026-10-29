/**
 * TC-SCAFFOLD-027 — the commit-msg hook is offline, non-mutating, and never
 * blocks an agent commit. CI commitlint is the sole authority.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const OFFLINE_ENV = {
  ...process.env,
  HTTP_PROXY: "http://127.0.0.1:9",
  HTTPS_PROXY: "http://127.0.0.1:9",
  ALL_PROXY: "http://127.0.0.1:9",
  NO_PROXY: "",
  npm_config_offline: "true",
};

const git = (cwd: string, args: string[]) =>
  spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: OFFLINE_ENV,
    timeout: 30_000,
  });

const makeScratchRepo = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "commit-msg-hook-"));
  expect(git(directory, ["init", "-q"]).status).toBe(0);
  expect(git(directory, ["config", "user.email", "hook@example.invalid"]).status).toBe(0);
  expect(git(directory, ["config", "user.name", "Hook Test"]).status).toBe(0);
  writeFileSync(join(directory, "README.md"), "scratch\n");
  writeFileSync(join(directory, ".gitignore"), "node_modules/\n");
  expect(git(directory, ["add", "README.md", ".gitignore"]).status).toBe(0);
  expect(git(directory, ["commit", "-q", "-m", "chore: initial"]).status).toBe(0);

  cpSync(join(ROOT, ".husky/commit-msg"), join(directory, ".git/hooks/commit-msg"));
  chmodSync(join(directory, ".git/hooks/commit-msg"), 0o755);
  mkdirSync(join(directory, "node_modules/.bin"), { recursive: true });
  symlinkSync(
    join(ROOT, "node_modules/.bin/commitlint"),
    join(directory, "node_modules/.bin/commitlint"),
  );
  return directory;
};

describe("commit-msg hook", () => {
  test("the hook is warn-only, offline, and non-mutating", () => {
    const directory = makeScratchRepo();
    try {
      const hook = readFileSync(join(directory, ".git/hooks/commit-msg"), "utf8");
      expect(hook.trimEnd().endsWith("exit 0")).toBe(true);
      expect(hook).not.toContain("npx");
      expect(existsSync(join(directory, "node_modules/.bin/commitlint"))).toBe(true);

      writeFileSync(join(directory, "valid.txt"), "1\n");
      expect(git(directory, ["add", "valid.txt"]).status).toBe(0);
      const valid = git(directory, ["commit", "-m", "feat: add a valid change"]);
      expect(valid.status).toBe(0);
      expect(git(directory, ["status", "--porcelain"]).stdout.trim()).toBe("");

      writeFileSync(join(directory, "invalid.txt"), "1\n");
      expect(git(directory, ["add", "invalid.txt"]).status).toBe(0);
      const invalid = git(directory, ["commit", "-m", "not a conventional message"]);
      expect(invalid.status).toBe(0);
      expect(git(directory, ["status", "--porcelain"]).stdout.trim()).toBe("");
      expect(git(directory, ["log", "-1", "--format=%s"]).stdout.trim()).toBe(
        "not a conventional message",
      );
      expect(`${invalid.stdout}${invalid.stderr}`).toContain("warn-only");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 60_000);
});
