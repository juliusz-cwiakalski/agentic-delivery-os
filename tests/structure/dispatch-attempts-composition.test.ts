/**
 * GH-289 TC-ATTEMPT-029 (suite half) — the pointer is the only route from
 * evidence to the gate.
 *
 * The digest's pointer line, the family help entry, and the `dispatch attempts`
 * help entry all name `dispatch dual-run summary --repo ...`, and neither the
 * attempts envelope nor the digest carries a coverage, floor, verdict,
 * eligibility or unmetConditions key, so no second surface computes the gate.
 * The reference-page half stays review-verified.
 */
import { describe, expect, test } from "bun:test";
import { allHelpEntries, helpEntryFor } from "../../packages/cli/src/help";
import { ATTEMPTS_REF, ledgerOf } from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";

const POINTER = (repository: string): string =>
  `next: dispatch dual-run summary --repo ${repository} (coverage and floor)`;

describe("TC-ATTEMPT-029 the pointer is the only route to the gate", () => {
  test("the digest's pointer line is the declared one", async () => {
    const harness = createAttemptsHarness({ label: "composition-pointer", records: ledgerOf(2) });
    try {
      const result = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      expect(result.exit).toBe(0);
      const lines = result.stdout.trimEnd().split("\n");
      expect(lines.at(-1)).toBe(POINTER("github.com/owner/repo"));
    } finally {
      harness.dispose();
    }
  });

  test("the family entry and the attempts entry both name the summary form", () => {
    const family = helpEntryFor(["dispatch"]);
    const attempts = helpEntryFor(["dispatch", "attempts"]);
    expect(family).toBeDefined();
    expect(attempts).toBeDefined();
    expect(family?.usage.join("\n")).toContain("dispatch dual-run summary --repo");
    expect(attempts?.summary.toLowerCase()).toContain("attempt");
    // The attempts entry itself names the summary form as the coverage/floor surface.
    expect(attempts?.summary).toContain("dispatch dual-run summary --repo");
    expect(attempts?.summary).toContain("coverage and floor");
    // The attempts entry points at the M2 page, which carries the same pointer.
    expect(attempts?.seeAlso).toEqual([
      "doc/planning/oss-tooling/milestones/m2/commands/attempts.md",
    ]);
    // Exactly five dispatch help entries: no sixth surface was introduced.
    expect(allHelpEntries().filter((entry) => entry.path[0] === "dispatch")).toHaveLength(5);
  });

  test("no second surface computes coverage or floor", async () => {
    const harness = createAttemptsHarness({ label: "composition-gate", records: ledgerOf(3) });
    try {
      const machine = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      const text = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      for (const key of ["coverage", "floor", "verdict", "eligibility", "unmetConditions"]) {
        expect(JSON.stringify(machine.data)).not.toContain(`"${key}"`);
        expect(text.stdout).not.toContain(`${key}=`);
      }
      expect(text.stdout).toContain("(coverage and floor)");
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-ATTEMPT-030 the attempts help page is reachable and pure", () => {
  test("renders usage, both options, the global block, an example and the exit codes", async () => {
    const { helpEntryFor: entryFor, renderHelp } = await import("../../packages/cli/src/help");
    const { resolveBrandIdentity } = await import("../../packages/core/src/branding/index");
    const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
    if (!resolved.ok) throw new Error("brand resolution failed");
    const entry = entryFor(["dispatch", "attempts"]);
    if (entry === undefined) throw new Error("the attempts entry is missing");
    const text = renderHelp(entry, resolved.value);
    expect(text).toContain("dispatch attempts [--ref <ref>] [--limit <n>]");
    expect(text).toContain("--ref <ref>");
    expect(text).toContain("--limit <n>");
    expect(text).toContain("--json");
    expect(text).toContain("Examples:");
    expect(text).toContain("Exit codes:");
  });

  test("the root listing still names nineteen families and no attempts row", async () => {
    const { ROOT_HELP, renderRootHelp } = await import("../../packages/cli/src/help");
    const { resolveBrandIdentity } = await import("../../packages/core/src/branding/index");
    const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
    if (!resolved.ok) throw new Error("brand resolution failed");
    expect(ROOT_HELP.usage).toHaveLength(1);
    const text = renderRootHelp(resolved.value);
    const commands = text.split("Commands:\n")[1]?.trimEnd().split("\n") ?? [];
    expect(commands).toHaveLength(19);
    expect(commands.some((line) => line.trimStart().startsWith("attempts"))).toBe(false);
  });
});
