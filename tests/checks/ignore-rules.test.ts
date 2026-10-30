/**
 * TC-BRANDING-013 — the `.gitignore` token scan is subsumed by the full-scope
 * scan without weakening the hygiene check.
 *
 * D2 coverage delta (accepted residual risk RSK-2): the old substring token loop
 * also caught a lowercase embedded identifier (e.g. `myados`) in a `.gitignore`
 * line; the full-scope scan's delimiter rule deliberately does not. In exchange
 * the full scan covers every `.gitignore` line (comments included) and avoids
 * false positives on ordinary words.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scan } from "../../scripts/checks/forbidden-literals";
import { createTempRepo, liveRegistry, ROOT, writeFiles, writeRegistry } from "./fixture-repo";

const SCRIPT = join(ROOT, "scripts/checks/ignore-rules.ts");

type RunResult = { status: number | null; output: string };

const runIgnoreRules = (cwd: string): RunResult => {
  const result = spawnSync("bun", ["run", SCRIPT], { cwd, encoding: "utf8" });
  return { status: result.status, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
};

const gitignore = (root: string): string => readFileSync(join(root, ".gitignore"), "utf8");

const withoutLine = (text: string, pattern: string): string =>
  text
    .split("\n")
    .filter((line) => line.trim() !== pattern)
    .join("\n");

describe("hygiene check after subsumption", () => {
  test("live tree passes with the four coverage classes and rename probes", () => {
    const result = runIgnoreRules(ROOT);
    expect(result.status).toBe(0);
    expect(result.output).toContain("OK ignore-rules");
  });

  test("temp tree passes and each coverage class stays load-bearing", () => {
    const repo = createTempRepo();
    try {
      const baseline = runIgnoreRules(repo.root);
      expect(baseline.status).toBe(0);

      for (const pattern of ["node_modules/", "dist/", ".ai/local/", ".*/config.local.yaml"]) {
        const original = gitignore(repo.root);
        writeFiles(repo.root, { ".gitignore": withoutLine(original, pattern) });
        const mutated = runIgnoreRules(repo.root);
        expect(mutated.status).toBe(1);
        expect(mutated.output.toLowerCase()).toContain("missing");
        writeFiles(repo.root, { ".gitignore": original });
      }
    } finally {
      repo.run(["checkout", "--", ".gitignore"]);
    }
  });

  test("rename survival fails when the config glob becomes a literal name", () => {
    const repo = createTempRepo();
    try {
      const original = gitignore(repo.root);
      writeFiles(repo.root, {
        ".gitignore": original.replace(
          ".*/config.local.yaml",
          ".renamed-product/config.local.yaml",
        ),
      });
      const mutated = runIgnoreRules(repo.root);
      expect(mutated.status).toBe(1);
      expect(mutated.output).toContain("config.local.yaml");
    } finally {
      repo.run(["checkout", "--", ".gitignore"]);
    }
  });

  test("a .gitignore seed literal still fails the full-scope scan", () => {
    const repo = createTempRepo();
    try {
      writeRegistry(repo.root, {
        ...liveRegistry(),
        corpusBaseline: repo.baseline,
        registered: [],
      });
      writeFiles(repo.root, { ".gitignore": `${gitignore(repo.root)}ados\n` });
      const hygiene = runIgnoreRules(repo.root);
      expect(hygiene.status).toBe(0);
      const outcome = scan(repo.root);
      expect(
        outcome.violations.some(
          (violation) => violation.file === ".gitignore" && violation.token === "ados",
        ),
      ).toBe(true);
    } finally {
      repo.run(["checkout", "--", ".gitignore"]);
    }
  });
});
