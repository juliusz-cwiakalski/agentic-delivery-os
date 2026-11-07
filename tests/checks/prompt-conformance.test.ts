/**
 * TC-PLANSUM-005 / TC-PSCAN-001/002 (foundation slice) — the prompt scan is
 * deterministic, non-vacuous, and rejects plan progress, hand-edited phase
 * state, and raw git writes in the foundation lifecycle prompts.
 */
import { describe, expect, test } from "bun:test";
import {
  type PromptInventory,
  runPromptConformance,
  scanInventory,
  scanPromptText,
} from "../../scripts/checks/prompt-conformance";

describe("TC-PLANSUM-005 plan progress stays out of the plan", () => {
  test("a prompt that writes a tasks key or updates the plan is rejected", () => {
    for (const text of [
      "Add a tasks: list to each phase.",
      "Update the plan file with task completion.",
      "Mark phase 2 complete in the plan.",
    ]) {
      const findings = scanPromptText("fixture.md", text);
      expect(findings.map((finding) => finding.rule)).toContain("plan.no-progress");
    }
  });

  test("a prompt that keeps progress in pm-notes is accepted", () => {
    const findings = scanPromptText(
      "fixture.md",
      "Append a pm-notes notes entry; never add a tasks key.",
    );
    expect(findings).toEqual([]);
  });
});

describe("TC-PSCAN-001/002 foundation prompt invariants", () => {
  test("hand-written phase state and raw git writes are rejected", () => {
    const phase = scanPromptText("fixture.md", "Mark delivery completed in pm-notes.");
    expect(phase.map((finding) => finding.rule)).toContain("phase.no-hand-edit");
    const git = scanPromptText("fixture.md", "Run git add -A and then git commit.");
    expect(git.map((finding) => finding.rule)).toContain("git.no-raw-write");
    const url = scanPromptText("fixture.md", "Set phases.pr_creation.url: https://example.test");
    expect(url.map((finding) => finding.rule)).toContain("phase.no-pr-url-write");
  });

  test("negated prohibitions are allowed", () => {
    expect(scanPromptText("fixture.md", "Never run git add or git commit.")).toEqual([]);
    expect(scanPromptText("fixture.md", "Do not mark delivery completed in pm-notes.")).toEqual([]);
  });
});

describe("TC-PSCAN-005 determinism and non-vacuity", () => {
  test("the live inventory scans clean twice with identical counts", () => {
    const first = runPromptConformance();
    const second = runPromptConformance();
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(first.length).toBe(second.length);
  });

  test("missing required phrases and non-negated forbidden literals fail", () => {
    const inventory: PromptInventory = {
      schemaVersion: "prompt.inventory.v1",
      prompts: [
        {
          path: "a.md",
          required: ["phase complete"],
          forbidden: ["git add"],
        },
      ],
    };
    const findings = scanInventory(inventory, (relative) =>
      relative === "a.md" ? "git add -A\n" : "",
    );
    const rules = findings.map((finding) => finding.rule);
    expect(rules).toContain("forbidden.literal");
    expect(rules).toContain("required.phrase");
  });
});
