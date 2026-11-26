/**
 * TC-HELP-001 (phase 7) — `dispatch` is registered in the prompt-required set,
 * has root and command help entries for every declared form, points at the
 * reference page, and is covered by the help/guide inventory.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allHelpEntries,
  helpEntryFor,
  ROOT_HELP,
  renderRootHelp,
} from "../../packages/cli/src/help";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";

const ROOT = process.cwd();
const PAGE = "doc/planning/oss-tooling/milestones/m1/commands/dispatch.md";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand");
  return resolved.value;
})();

describe("TC-HELP-001 dispatch is registered and documented", () => {
  test("dispatch is in the prompt-required set and the root help", () => {
    expect(PROMPT_REQUIRED_COMMANDS).toContain("dispatch");
    const root = renderRootHelp(brand);
    expect(root).toContain("dispatch");
    expect(ROOT_HELP.seeAlso.length).toBeGreaterThan(0);
  });

  test("every declared dispatch form has a help entry pointing at the reference page", () => {
    for (const path of [
      ["dispatch"],
      ["dispatch", "dual-run", "summary"],
      ["dispatch", "dual-run", "resolve"],
      ["dispatch", "handover"],
    ] as const) {
      const entry = helpEntryFor(path);
      expect(entry, path.join(" ")).toBeDefined();
      expect(entry?.seeAlso).toContain(PAGE);
    }
    const help = renderRootHelp(brand);
    expect(help.length).toBeGreaterThan(0);
    // GH-354 §25.1 "Help/reference coverage", DEC-1, TC-CONTRACT-002: the four
    // operator forms are declared entries, so the family's count moves 5 -> 10.
    expect(allHelpEntries().filter((entry) => entry.path[0] === "dispatch").length).toBe(10);
    for (const form of [
      ["dispatch", "status"],
      ["dispatch", "log"],
      ["dispatch", "is-delivering"],
      ["dispatch", "last-message"],
    ] as const) {
      const operatorEntry = helpEntryFor(form);
      expect(operatorEntry, form.join(" ")).toBeDefined();
      expect(operatorEntry?.seeAlso).toContain(PAGE);
      expect(operatorEntry?.usage.length).toBeGreaterThan(0);
      expect(operatorEntry?.examples.length).toBeGreaterThan(0);
    }
    expect(helpEntryFor(["dispatch", "log"])?.options.some(([flag]) => flag === "--tail <n>")).toBe(
      true,
    );
  });

  test("the attempts entry carries its own usage, options, example and M2 page", () => {
    const entry = helpEntryFor(["dispatch", "attempts"]);
    const attemptsPage = "doc/planning/oss-tooling/milestones/m2/commands/attempts.md";
    expect(entry).toBeDefined();
    expect(entry?.seeAlso).toEqual([attemptsPage]);
    expect(entry?.usage.join("\n")).toContain("dispatch attempts [--ref <ref>] [--limit <n>]");
    expect(entry?.options.some(([flag]) => flag === "--ref <ref>")).toBe(true);
    expect(entry?.options.some(([flag]) => flag === "--limit <n>")).toBe(true);
    expect(entry?.examples.length).toBeGreaterThan(0);
    // The family entry advertises the subfamily and both options.
    const family = helpEntryFor(["dispatch"]);
    expect(family?.usage.join("\n")).toContain("dispatch attempts");
    expect(family?.options.some(([flag]) => flag === "--ref <ref>")).toBe(true);
    expect(family?.options.some(([flag]) => flag === "--limit <n>")).toBe(true);
  });

  test("the primary dispatch help names the execution forms, resolution, and reversal", () => {
    const entry = helpEntryFor(["dispatch"]);
    const usage = entry?.usage.join("\n") ?? "";
    expect(usage).toContain("dispatch <ref>");
    expect(usage).toContain("dispatch dual-run summary");
    expect(usage).toContain("dispatch dual-run resolve");
    expect(usage).toContain("dispatch handover");
    expect(entry?.options.some(([flag]) => flag === "--revert")).toBe(true);
  });

  test("the help coverage fixture lists the command and the reference page", () => {
    const coverage = JSON.parse(
      readFileSync(join(ROOT, "tests/fixtures/help-guide/coverage.json"), "utf8"),
    ) as { readonly commands: readonly string[]; readonly referencePages: readonly string[] };
    expect(coverage.commands).toContain("dispatch");
    expect(coverage.referencePages).toContain(PAGE);
  });

  test("the reference page describes the evidence-based bar and the two extra surfaces", () => {
    const page = readFileSync(join(ROOT, PAGE), "utf8").replace(/\s+/gu, " ");
    for (const phrase of [
      "zero false-success incidents",
      "zero unresolved divergences",
      "all eleven",
      "20 counted dispatches",
      "7 consecutive UTC dates",
      "corroborat",
      "floor",
      "dispatch dual-run resolve",
      "dispatch handover",
      "--revert",
    ]) {
      expect(page.toLowerCase(), phrase).toContain(phrase.toLowerCase());
    }
    for (const stale of ["two clean weeks", "two-week", "fourteen days", "clean window met"]) {
      expect(page.toLowerCase(), stale).not.toContain(stale);
    }
  });
});

describe("TC-SPAWN-004 the agent and the title are composition facts, not operator flags", () => {
  test("the dispatch help/grammar lists no --agent, --model, or --title option", () => {
    const entries = allHelpEntries().filter((entry) => entry.path[0] === "dispatch");
    // §25.1: the four operator forms raise the family count 5 -> 9.
    expect(entries).toHaveLength(10);
    const rendered = entries.map((entry) => JSON.stringify(entry)).join("\n");
    for (const forbidden of ["--agent", "--title", "--model"]) {
      expect(rendered, forbidden).not.toContain(forbidden);
    }
    // The command definition's declared flags are unchanged too.
    const definition = readFileSync(join(ROOT, "packages/cli/src/commands/dispatch.ts"), "utf8");
    expect(definition).not.toContain('"--agent"');
    expect(definition).not.toContain('"--title"');
  });
});
