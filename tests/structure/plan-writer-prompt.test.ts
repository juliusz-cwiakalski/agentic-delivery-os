/**
 * TC-PLANSUM-004 — the plan writer emits the schema with optional phase
 * summaries and never teaches a `tasks` key or a plan progress log.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const prompt = readFileSync(join(ROOT, ".opencode/agent/plan-writer.md"), "utf8");

describe("TC-PLANSUM-004 plan-writer prompt", () => {
  test("it names the schema, summary, and the commit-path consumer", () => {
    expect(prompt).toContain("delivery.plan.v1");
    expect(prompt).toContain("summary");
    expect(prompt.toLowerCase()).toContain("commit path");
  });

  test("it records that progress stays in pm-notes, not the plan", () => {
    expect(prompt.toLowerCase()).toContain("pm-notes");
    expect(prompt.toLowerCase()).toContain("progress");
    expect(prompt).toContain("never add a `tasks` key");
  });

  test("it no longer teaches skipping phases by task count", () => {
    expect(prompt.toLowerCase()).not.toContain("task count");
    expect(prompt.toLowerCase()).not.toContain("phases with no tasks");
  });
});
