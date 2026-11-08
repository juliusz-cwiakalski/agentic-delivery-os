/**
 * TC-HELP-001 (phase 7) — `dispatch` is registered in the prompt-required set,
 * has root and command help entries for every declared form, points at the
 * reference page, and is covered by the help/guide inventory.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_REQUIRED_COMMANDS } from "../../packages/cli/src/help/prompt-required-commands";
import { allHelpEntries, helpEntryFor, renderRootHelp, ROOT_HELP } from "../../packages/cli/src/help";
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
    expect(allHelpEntries().filter((entry) => entry.path[0] === "dispatch").length).toBe(4);
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
