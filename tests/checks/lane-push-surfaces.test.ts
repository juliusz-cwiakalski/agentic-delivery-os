/**
 * GH-416 — the two product surfaces that instruct the lane (TC-LMSG-001,
 * TC-LMSG-002).
 *
 * The `pm` agent definition and the built lifecycle prompt are asserted
 * SEPARATELY, because they reach different lanes (a typed spawn and an
 * operator-run `pm`). The ordered `pr_creation` tail, the final-message rule,
 * the refusal rule, and the `no commit` interaction are pinned per surface.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildLifecyclePrompt,
  DISPATCH_LIFECYCLE_SECTIONS,
  lifecyclePromptSectionsPresent,
} from "../../packages/core/src/domain/dispatch-prompt";

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

const stepTen = (): string => {
  const text = read(".opencode/agent/pm.md");
  const start = text.indexOf('<step id="10">');
  const end = text.indexOf("</step>", start);
  return start < 0 || end < 0 ? "" : text.slice(start, end);
};

describe("GH-416 TC-LMSG-001 the agent surface carries the tail and the message rule", () => {
  test("step 10 orders PR -> URL note -> phase complete -> push -> final message -> STOP", () => {
    const step = stepTen();
    expect(step.length).toBeGreaterThan(0);
    const pr = step.indexOf("@pr-manager");
    const url = step.indexOf("Record the PR/MR URL");
    const phase = step.indexOf("phase complete <workItemRef> pr_creation");
    const push = step.indexOf("push <workItemRef>");
    const stop = step.indexOf("STOP");
    expect(pr).toBeGreaterThanOrEqual(0);
    expect(url).toBeGreaterThan(pr);
    expect(phase).toBeGreaterThan(url);
    // The push instruction sits AFTER the phase completion, so the commit
    // pushed is the lane's actual last commit (DEC-6).
    expect(push).toBeGreaterThan(phase);
    expect(stop).toBeGreaterThan(push);
    expect(step.indexOf("final message", push)).toBeGreaterThan(push);
  });

  test("the final-message rule names acceptance, refusal, and the unrecorded case", () => {
    const step = stepTen();
    expect(step.toLowerCase()).toContain("final message");
    expect(step.toLowerCase()).toContain("cause");
    expect(step.toLowerCase()).toContain("never");
    expect(step).toContain("on the remote");
    expect(step.toLowerCase()).toContain("record");
  });

  test("no retry, force, authored commit, or phase reopen is instructed", () => {
    const step = stepTen().toLowerCase();
    expect(step).toContain("retry");
    expect(step).toContain("force");
    expect(step).toContain("reopen");
    expect(step).toContain("commit");
  });

  test("the `no commit` directive suppresses commits, not the push", () => {
    const step = stepTen().toLowerCase();
    expect(step).toContain('"no commit"');
    expect(step).toContain("push");
    expect(step).toContain("skipped");
  });

  test("a pre-act resolution refusal is named as a refused push", () => {
    const step = stepTen().toLowerCase();
    expect(step).toContain("refus");
    expect(step).toContain("push");
  });

  test("the phase-definition item 11 states the same tail", () => {
    const text = read(".opencode/agent/pm.md");
    const item = text.split("\n").find((line) => line.startsWith("11. **pr_creation**"));
    expect(item).toBeDefined();
    expect(item).toContain("push <workItemRef>");
    expect(item).toContain("pr_creation");
  });
});

describe("GH-416 TC-LMSG-001 the built prompt surface carries the same rule", () => {
  const prompt = buildLifecyclePrompt({ ref: "GH-416", baseBranch: "main-tools" });

  test("the prompt names the pr_creation push and the reporting rule", () => {
    expect(prompt).toContain("push <ref>");
    expect(prompt).toContain("pr_creation");
    expect(prompt.toLowerCase()).toContain("final message");
    expect(prompt.toLowerCase()).toContain("cause");
    expect(prompt.toLowerCase()).toContain("never");
  });

  test("the five section markers are present, in order, with no new marker", () => {
    expect([...DISPATCH_LIFECYCLE_SECTIONS]).toEqual([
      "state-detection",
      "resume-sync",
      "actions-by-state",
      "eleven-phase-lifecycle",
      "merge-authority",
    ]);
    expect(lifecyclePromptSectionsPresent(prompt)).toBe(true);
    expect(prompt.split("\n").filter((line) => line.startsWith("## "))).toHaveLength(5);
  });
});

describe("GH-416 TC-LMSG-002 the feature pages state the same order and refusal rule", () => {
  test("the quality-gates/PR page states the tail and the unchanged pre-PR push", () => {
    const page = read("doc/spec/features/feature-quality-gates-and-pr.md");
    expect(page).toContain("push <ref>");
    expect(page).toContain("pr_creation");
    expect(page.toLowerCase()).toContain("pre-pr push");
    expect(page.toLowerCase()).toContain("cause");
  });

  test("the delivery-lifecycle page states the tail after the phase-completion commit", () => {
    const page = read("doc/spec/features/feature-delivery-lifecycle.md");
    expect(page).toContain("push <ref>");
    expect(page).toContain("phase-completion commit");
    expect(page.toLowerCase()).toContain("cause");
  });

  test("the prompt inventory names the push command among pm.md's required phrases", () => {
    const inventory = JSON.parse(read("tests/fixtures/prompt-inventory/lifecycle.json")) as {
      readonly prompts: readonly { readonly path: string; readonly required: readonly string[] }[];
    };
    const pm = inventory.prompts.find((entry) => entry.path === ".opencode/agent/pm.md");
    expect(pm?.required).toContain("push <workItemRef>");
  });
});
