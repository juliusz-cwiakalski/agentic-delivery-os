/**
 * TC-LAYER-002 — the runtime-written project-file coverage class.
 *
 * The fifth coverage class makes the runtime-written projects glob part of the
 * repository's own ignore rules: brand-free, root-anchored, and never matching
 * the tracked project layer. Each mutation below is the corresponding
 * `M3`/`M4`/anchor control, and the delivered `config.local.yaml` class keeps
 * its behaviour unchanged.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTempRepo, ROOT, writeFiles } from "./fixture-repo";

const SCRIPT = join(ROOT, "scripts/checks/ignore-rules.ts");
const PROJECTS = ".*/projects.yaml";
const CONFIG_LOCAL = ".*/config.local.yaml";

type RunResult = { status: number | null; output: string };

const runIgnoreRules = (cwd: string): RunResult => {
  const result = spawnSync("bun", ["run", SCRIPT], { cwd, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
};

const liveGitignore = (): string => readFileSync(join(ROOT, ".gitignore"), "utf8");

const seedRepo = (gitignore = liveGitignore()) => {
  const repo = createTempRepo({
    ".gitignore": gitignore,
    ".jaiship/config.yaml": "verify:\n  suite-map: {}\n",
  });
  return repo;
};

const mutate = (from: string, to: string): RunResult => {
  const repo = seedRepo();
  try {
    const rewritten = liveGitignore().replace(from, to);
    writeFiles(repo.root, { ".gitignore": rewritten });
    return runIgnoreRules(repo.root);
  } finally {
    repo.run(["checkout", "--", ".gitignore"]);
  }
};

describe("runtime-written project-file ignore class", () => {
  test("the live tree passes with five coverage classes", () => {
    const result = runIgnoreRules(ROOT);
    expect(result.status).toBe(0);
    expect(result.output).toContain("five coverage classes");
  });

  test("the fifth class is load-bearing", () => {
    const repo = seedRepo();
    try {
      const withoutPattern = liveGitignore()
        .split("\n")
        .filter((line) => line.trim() !== PROJECTS)
        .join("\n");
      writeFiles(repo.root, { ".gitignore": withoutPattern });
      const result = runIgnoreRules(repo.root);
      expect(result.status).toBe(1);
      expect(result.output).toContain("runtime-written project files");
      expect(result.output).toContain(PROJECTS);
    } finally {
      repo.run(["checkout", "--", ".gitignore"]);
    }
  });

  test("a literal path instead of a brand-free glob fails by name", () => {
    const result = mutate(PROJECTS, "/.jaiship/projects.yaml");
    expect(result.status).toBe(1);
    expect(result.output).toContain("must be a brand-free glob");
    expect(result.output).toContain("/.jaiship/projects.yaml");
  });

  test("a glob that matches the tracked layer fails by name", () => {
    const result = mutate(CONFIG_LOCAL, ".*/*.yaml");
    expect(result.status).toBe(1);
    expect(result.output).toContain("tracked layer reported ignored: .jaiship/config.yaml");
  });

  test("a pattern without the root anchor matches a nested path and fails", () => {
    const result = mutate(PROJECTS, "projects.yaml");
    expect(result.status).toBe(1);
    expect(result.output).toContain("packages/x/projects.yaml ignored=true");
  });

  test("the delivered project-local config class stays load-bearing", () => {
    const repo = seedRepo();
    try {
      const withoutConfig = liveGitignore()
        .split("\n")
        .filter((line) => line.trim() !== CONFIG_LOCAL)
        .join("\n");
      writeFiles(repo.root, { ".gitignore": withoutConfig });
      const result = runIgnoreRules(repo.root);
      expect(result.status).toBe(1);
      expect(result.output).toContain("project-local config");
    } finally {
      repo.run(["checkout", "--", ".gitignore"]);
    }
  });
});
