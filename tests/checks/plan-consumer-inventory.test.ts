/**
 * TC-PLANSUM-003 — no code or template consumer requires a `tasks` key, and the
 * commit path consumes the optional phase summary.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const CONSUMERS = [
  "packages/core/src/contracts/plan.ts",
  "packages/core/src/domain/plan-validate.ts",
  "packages/core/src/domain/commit-act.ts",
  "packages/core/src/domain/commit-bundle.ts",
  "packages/cli/src/commands/commit.ts",
  "packages/cli/src/commands/phase.ts",
  "packages/cli/src/edge.ts",
] as const;

describe("TC-PLANSUM-003 plan consumer inventory", () => {
  test("no consumer reads or requires phase.tasks", () => {
    const failures: string[] = [];
    for (const file of CONSUMERS) {
      const source = read(file);
      if (/\btasks\b/.test(source)) failures.push(`${file}: references tasks`);
    }
    expect(failures).toEqual([]);
  });

  test("the commit path consumes the plan summary", () => {
    expect(read("packages/core/src/domain/commit-bundle.ts")).toContain("planSummary");
    expect(read("packages/cli/src/commands/commit.ts")).toContain("planSummary");
    expect(read("packages/cli/src/commands/phase.ts")).toContain("planSummary");
  });

  test("the template declares summary and carries no tasks key", () => {
    const template = read("doc/templates/implementation-plan-template.md");
    expect(template).toContain("summary:");
    expect(template).not.toMatch(/^\s*tasks:/m);
    expect(template).toContain("no `tasks` key");
  });
});
