/**
 * TC-PSCAN-006 — prompts and the reconciled guides contain no secret-shaped
 * values. A canary proves the scan is non-vacuous.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const ROOTS = [".opencode/agent", ".opencode/command", "doc/guides", "doc/planning"];

const PATTERNS: readonly { readonly id: string; readonly pattern: RegExp }[] = [
  { id: "github-token", pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { id: "openai-key", pattern: /sk-[A-Za-z0-9]{20,}/ },
  { id: "aws-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { id: "slack-token", pattern: /xox[bap]-[A-Za-z0-9-]{10,}/ },
  { id: "private-key", pattern: /-----BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/ },
  { id: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/ },
];

const markdownFiles = (directory: string): readonly string[] => {
  const found: string[] = [];
  const walk = (relative: string): void => {
    let entries;
    try {
      entries = readdirSync(join(ROOT, directory, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".md")) found.push(`${directory}/${next}`);
    }
  };
  walk("");
  return found;
};

const scan = (text: string): readonly string[] =>
  PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.id);

describe("TC-PSCAN-006 prompt and guide secret scan", () => {
  test("zero secret-shaped findings across prompts and guides", () => {
    const failures: string[] = [];
    for (const directory of ROOTS) {
      for (const file of markdownFiles(directory)) {
        for (const id of scan(readFileSync(join(ROOT, file), "utf8"))) {
          failures.push(`${file}: ${id}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("the canary mutant is detected", () => {
    const canary = `ghp_${"a".repeat(36)}`;
    expect(scan(`token: ${canary}`)).toContain("github-token");
  });
});
