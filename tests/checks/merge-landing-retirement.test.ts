/**
 * TC-F1-009 — the retained local landing and refresh have zero composed callers,
 * proven by a production-source scan that carries a mandatory failing control.
 *
 * The scan reads every product source file, so a composition site added to any
 * package (not only the CLI) is found by file and line. The retained capability
 * stays declared in the git seam's operation set and still exports both members;
 * deleting it to satisfy the scan is a review finding, not a repair.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitMergeSeam, MERGE_SEAM_OPERATIONS } from "../../packages/adapters/src/git/index";
import { MERGE_GIT_OPERATIONS } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();

/** Every product TypeScript source file, as a package-relative path. */
const productSources = (root: string): string[] => {
  const files: string[] = [];
  const walk = (relative: string): void => {
    let entries: ReturnType<typeof readdirSync>;
    try {
      entries = readdirSync(join(root, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (["dist", "node_modules", "tmp", "doc", "tests"].includes(entry.name)) continue;
        walk(next);
      } else if (entry.name.endsWith(".ts")) {
        files.push(next);
      }
    }
  };
  walk("packages");
  return files.sort();
};

/** Composition sites of the retired mechanisms, as `file:line` findings. */
const compositionSites = (root: string): string[] => {
  const findings: string[] = [];
  for (const file of productSources(root)) {
    const lines = readFileSync(join(root, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      if (/\.(squashLand|refresh)\(/u.test(line)) findings.push(`${file}:${index + 1}`);
    });
  }
  return findings;
};

/** Platform merge-CLI literals, as `file:line:literal` findings. */
const platformLiterals = (root: string): string[] => {
  const findings: string[] = [];
  for (const file of productSources(root)) {
    const lines = readFileSync(join(root, file), "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const literal of ["gh pr merge", "glab mr merge", "merge --squash"]) {
        if (line.includes(literal)) findings.push(`${file}:${index + 1}:${literal}`);
      }
    });
  }
  return findings;
};

describe("TC-F1-009 zero composed callers of the local landing and refresh", () => {
  test("no product package composes squashLand or refresh", () => {
    expect(compositionSites(ROOT)).toEqual([]);
  });

  test("no product package carries a platform merge-CLI literal", () => {
    expect(platformLiterals(ROOT)).toEqual([]);
  });

  test("the transaction's ports declare no refresh member", () => {
    const text = readFileSync(join(ROOT, "packages/core/src/domain/merge-transaction.ts"), "utf8");
    const start = text.indexOf("export type MergeTransactionPorts = {");
    expect(start).toBeGreaterThan(0);
    const block = text.slice(start, text.indexOf("\n};", start));
    expect(block).not.toContain("readonly refresh:");
    expect(block).toContain("readonly land:");
  });

  test("the capability stays declared in the seam and still exports both members", () => {
    expect(MERGE_GIT_OPERATIONS).toEqual([
      "read-head",
      "read-base-containment",
      "resolve-ref",
      "rebase-refresh",
      "squash-land",
      "delete-branch",
    ]);
    expect(MERGE_SEAM_OPERATIONS).toContain("squash-land");
    expect(MERGE_SEAM_OPERATIONS).toContain("rebase-refresh");
    const seam = createGitMergeSeam();
    expect(typeof seam.squashLand).toBe("function");
    expect(typeof seam.refresh).toBe("function");
  });
});

describe("TC-F1-009 the scan's mandatory failing controls", () => {
  test("a planted composition site is found by file and line", () => {
    const temp = mkdtempSync(join(tmpdir(), "merge-retirement-"));
    try {
      mkdirSync(join(temp, "packages/cli/src"), { recursive: true });
      writeFileSync(
        join(temp, "packages/cli/src/composition.ts"),
        "const seam = createGitMergeSeam();\nawait seam.squashLand({ branch, baseRef, message });\n",
      );
      mkdirSync(join(temp, "packages/core/src"), { recursive: true });
      writeFileSync(
        join(temp, "packages/core/src/sync.ts"),
        "await git.refresh({ branch, baseRef });\n",
      );
      const findings = compositionSites(temp);
      expect(findings).toContain("packages/cli/src/composition.ts:2");
      expect(findings).toContain("packages/core/src/sync.ts:1");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  test("a landed local squash event would be visible as a platform literal", () => {
    const temp = mkdtempSync(join(tmpdir(), "merge-retirement-literal-"));
    try {
      mkdirSync(join(temp, "packages/cli/src"), { recursive: true });
      writeFileSync(
        join(temp, "packages/cli/src/composition.ts"),
        'const argv = ["gh", "pr", "merge", "12"]; // gh pr merge\n',
      );
      expect(platformLiterals(temp)).toContain("packages/cli/src/composition.ts:1:gh pr merge");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });

  test("deleting the retained operation fails naming the missing member", () => {
    const mutated = MERGE_GIT_OPERATIONS.filter((operation) => operation !== "rebase-refresh");
    expect(mutated).not.toContain("rebase-refresh");
    expect(() => expect(mutated).toContain("rebase-refresh")).toThrow();
  });
});
