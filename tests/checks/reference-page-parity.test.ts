/**
 * TC-HELP-003 — the reference pages match the delivered help surface: every
 * see-also target exists, and the coverage inventory names exactly the
 * prompt-required set.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/entrypoint";
import { allHelpEntries } from "../../packages/cli/src/help";

const ROOT = process.cwd();
const PAGE_ROOT = "doc/planning/oss-tooling/milestones/m1/commands";
const M2_PAGE_ROOT = "doc/planning/oss-tooling/milestones/m2/commands";

/** The per-command reference-page root (GH-288 DEC-13). */
const pageFor = (command: string): string =>
  command === "verify"
    ? `${PAGE_ROOT}/verify-change.md`
    : command === "projects"
      ? `${M2_PAGE_ROOT}/projects.md`
      : command === "events"
        ? `${M2_PAGE_ROOT}/events.md`
        : `${PAGE_ROOT}/${command}.md`;
const coverage = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/help-guide/coverage.json"), "utf8"),
) as { readonly commands: readonly string[]; readonly referencePages: readonly string[] };

describe("TC-HELP-003 reference-page parity", () => {
  test("every see-also target exists and is covered by the inventory", () => {
    const failures: string[] = [];
    for (const help of allHelpEntries()) {
      for (const target of help.seeAlso) {
        if (!existsSync(join(ROOT, target))) failures.push(`missing page ${target}`);
        if (!coverage.referencePages.includes(target)) failures.push(`unregistered ${target}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("each command page names its command and documents help", () => {
    const failures: string[] = [];
    for (const command of coverage.commands) {
      const page = pageFor(command);
      const text = readFileSync(join(ROOT, page), "utf8");
      if (!text.toLowerCase().includes(command)) failures.push(`${page}: missing command name`);
      if (!text.includes("--help")) failures.push(`${page}: missing --help`);
    }
    expect(failures).toEqual([]);
  });

  test("the inventory names exactly the prompt-required commands", () => {
    expect([...coverage.commands].sort()).toEqual([...PROMPT_REQUIRED_COMMANDS].sort());
  });

  test("doctor remains unshipped and dispatch keeps exactly five help entries", () => {
    expect(PROMPT_REQUIRED_COMMANDS).not.toContain("doctor");
    expect(coverage.commands).not.toContain("doctor");
    expect(allHelpEntries().filter((entry) => entry.path[0] === "dispatch")).toHaveLength(5);
  });
});
