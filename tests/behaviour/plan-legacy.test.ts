/**
 * TC-DPLAN-011 and TC-DPLAN-012 — legacy markdown plans stay readable with a
 * classified transition verdict, never a crash and never schema-valid; both
 * formats resolve deterministically and disclose the artifact read.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { validatePlan } from "../../packages/core/src/domain/plan-validate";
import {
  createRecorder,
  markdownFixture,
  planReadPort,
  planYamlParser,
  selectArtifact,
  validateMarkdownFixture,
  yamlFixture,
} from "../fixtures/plan/harness/index";

const LEGACY_DIR = join(import.meta.dir, "..", "fixtures", "plan", "legacy");
const legacyFiles = readdirSync(LEGACY_DIR)
  .filter((entry) => entry.endsWith(".md"))
  .sort();

describe("TC-DPLAN-011 legacy transition verdict", () => {
  test("a prose markdown plan is classified plan.format.legacy-markdown", () => {
    const verdict = validateMarkdownFixture("GH-307", "legacy/prose.md");
    expect(verdict.verdict).toBe("invalid");
    expect(verdict.readyForDevelopment).toBe(false);
    expect(verdict.errors).toHaveLength(1);
    const error = verdict.errors[0];
    expect(error?.code).toBe("plan.format.legacy-markdown");
    expect(error?.field).toBe("artifact");
    expect(verdict.artifact).toEqual({
      kind: "markdown",
      path: "chg-GH-307-plan.md",
    });
    expect(error?.detail).toContain("chg-GH-307-plan.md");
  });
});

describe("TC-DPLAN-012 legacy corpus", () => {
  test("the corpus has at least one empty and one non-empty document", () => {
    const sizes = legacyFiles.map((file) => statSync(join(LEGACY_DIR, file)).size);
    expect(sizes.some((size) => size === 0)).toBe(true);
    expect(sizes.some((size) => size > 0)).toBe(true);
  });

  test("every legacy fixture is classified, never valid, and never crashes", () => {
    for (const file of legacyFiles) {
      const verdict = validateMarkdownFixture("GH-307", `legacy/${file}`);
      expect(verdict.verdict, file).toBe("invalid");
      expect(verdict.readyForDevelopment, file).toBe(false);
      expect(
        verdict.errors.some((error) => error.code === "plan.format.legacy-markdown"),
        file,
      ).toBe(true);
      expect(verdict.artifact?.kind, file).toBe("markdown");
    }
  });

  test("the both-formats ref prefers YAML and discloses the artifact read", () => {
    const world = {
      artifacts: {
        "GH-305": [
          markdownFixture("GH-305", "legacy/both-formats.md"),
          yamlFixture("GH-305", "legacy/both-formats.yaml"),
        ],
      },
    };
    const recorder = createRecorder();
    const read = planReadPort(world, recorder)("GH-305");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.artifact.kind).toBe("yaml");
    const first = validatePlan({ workItemRef: "GH-305", read, parseYaml: planYamlParser });
    const second = validatePlan({ workItemRef: "GH-305", read, parseYaml: planYamlParser });
    expect(first.artifact?.kind).toBe("yaml");
    expect(first.verdict).toBe("valid");
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test("selection is deterministic regardless of candidate order", () => {
    const yaml = yamlFixture("GH-305", "valid/baseline.yaml");
    const markdown = markdownFixture("GH-305", "legacy/both-formats.md");
    expect(selectArtifact([markdown, yaml])).toEqual(selectArtifact([yaml, markdown]));
    expect(selectArtifact([markdown, yaml])?.kind).toBe("yaml");
  });
});
