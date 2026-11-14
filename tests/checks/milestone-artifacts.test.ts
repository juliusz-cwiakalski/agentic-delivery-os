/**
 * TC-TPL-001 / TC-TPL-003 / TC-TPL-004 — the required `change.milestone`
 * artifact field.
 *
 * The change-specification template carries the field with its resolution rule;
 * this change's own spec equals its pm-notes milestone; exactly one template
 * carries the field and the five declared exclusions stay unchanged.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const TEMPLATE = "doc/templates/change-spec-template.md";
const SPEC = "doc/changes/2026-11/2026-11-14--GH-313--milestone-first-planning/chg-GH-313-spec.md";
const PM_NOTES =
  "doc/changes/2026-11/2026-11-14--GH-313--milestone-first-planning/chg-GH-313-pm-notes.yaml";
const EXCLUDED = [
  "implementation-plan-template.md",
  "test-plan-template.md",
  "feature-spec-template.md",
  "roadmap-engineering-template.md",
  "decision-record-template.md",
];

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const frontMatter = (text: string): Record<string, unknown> | undefined => {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (match?.[1] === undefined) return undefined;
  const parsed: unknown = parseYaml(match[1]);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : undefined;
};

const yamlDocument = (text: string): Record<string, unknown> | undefined => {
  const parsed: unknown = parseYaml(text);
  return typeof parsed === "object" && parsed !== null
    ? (parsed as Record<string, unknown>)
    : undefined;
};

const listTemplates = (directory: string): readonly string[] => {
  const results: string[] = [];
  for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) results.push(...listTemplates(relative));
    else if (entry.name.endsWith(".md")) results.push(relative);
  }
  return results;
};

describe("TC-TPL-001 the change-spec template requires the field", () => {
  test("the template front matter carries one milestone placeholder inside change", () => {
    const text = read(TEMPLATE);
    const change = frontMatter(text)?.change as { milestone?: unknown } | undefined;
    expect(typeof change?.milestone).toBe("string");
    expect(String(change?.milestone)).toContain("<tracker-milestone-title>");
    expect([...text.matchAll(/^\s*milestone:/gm)]).toHaveLength(1);
  });

  test("the template instruction text states the resolution and none rules", () => {
    const text = read(TEMPLATE);
    expect(text).toMatch(/change\.milestone.*required/i);
    expect(text).toContain("M<n>: <outcome phrase>");
    expect(text).toMatch(/equal to the pm-notes/i);
    expect(text).toMatch(/literal `none`/i);
    expect(text).toMatch(/no milestone construct/i);
    expect(text).toMatch(/never a per-change/i);
  });
});

describe("TC-TPL-003 this change's spec equals its pm-notes milestone", () => {
  test("the spec value is the tracker title form and equals the pm-notes value", () => {
    const spec = frontMatter(read(SPEC))?.change as { milestone?: unknown } | undefined;
    const pmNotes = yamlDocument(read(PM_NOTES)) as { milestone?: unknown } | undefined;
    expect(typeof spec?.milestone).toBe("string");
    const value = String(spec?.milestone);
    expect(value).toMatch(/^M\d+: .+/);
    expect(value).not.toMatch(/^\d+$/);
    expect(value).not.toMatch(/^M\d+-S\d+/);
    expect(pmNotes?.milestone).toBe(value);
  });
});

describe("TC-TPL-004 exactly one template carries a milestone membership field", () => {
  test("only the change-spec template declares change.milestone", () => {
    const carrying: string[] = [];
    for (const relative of listTemplates("doc/templates")) {
      const parsed = frontMatter(read(relative));
      if (parsed === undefined) continue;
      const change = parsed.change;
      if (typeof change === "object" && change !== null && Object.hasOwn(change, "milestone")) {
        carrying.push(relative);
      } else if (Object.hasOwn(parsed, "milestone")) {
        carrying.push(relative);
      }
    }
    expect(carrying).toEqual([TEMPLATE]);
  });

  test("the five declared exclusions stay free of a milestone membership field", () => {
    for (const name of EXCLUDED) {
      const parsed = frontMatter(read(`doc/templates/${name}`));
      expect(parsed, name).toBeDefined();
      const change = parsed?.change;
      const hasMilestone =
        (typeof change === "object" && change !== null && Object.hasOwn(change, "milestone")) ||
        Object.hasOwn(parsed ?? {}, "milestone");
      expect(hasMilestone, name).toBe(false);
    }
  });

  test("the exclusion rationale is recorded in the change decision log", () => {
    const spec = read(SPEC);
    expect(spec).toContain("DEC-6");
    expect(spec).toMatch(/Exactly one template gains the milestone field/i);
  });
});
