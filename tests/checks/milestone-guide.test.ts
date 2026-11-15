/**
 * TC-GUIDE-001..004 — milestone-management guide contract.
 *
 * The guide is asserted as data: redistributable marker, the single
 * script-generated header (byte-identical to the header script's output), the
 * nine lifecycle topics once each, the pack-conventions pointer, PDR-0005 in
 * the register, and the index/guide/spec reference graph.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

const ROOT = process.cwd();
const GUIDE = "doc/guides/milestone-management.md";
const PACK_INDEX = "doc/planning/oss-tooling/milestones/README.md";
const PDR = "doc/decisions/PDR-0005-milestone-first-planning-and-delivery.md";

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const frontMatter = (text: string): Record<string, unknown> => {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (match?.[1] === undefined) throw new Error("missing front matter");
  const parsed: unknown = parseYaml(match[1]);
  if (typeof parsed !== "object" || parsed === null) throw new Error("invalid front matter");
  return parsed as Record<string, unknown>;
};

const headingsOf = (text: string): readonly string[] =>
  [...text.matchAll(/^#{2,6}\s+(.+)$/gm)]
    .map((match) => match[1] ?? "")
    .map((heading) => heading.trim());

const sectionBody = (text: string, heading: RegExp): string => {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => /^#{2,6}\s+/.test(line) && heading.test(line));
  if (start < 0) throw new Error(`missing section ${String(heading)}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,6}\s+/.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
};

const headerless = (text: string): string =>
  text
    .split("\n")
    .filter(
      (line) =>
        !/^# Copyright \(c\)/.test(line) &&
        !/^# Apache-2\.0 License - see LICENSE file for full terms$/.test(line) &&
        !/^source: https:\/\/github\.com\//.test(line),
    )
    .join("\n");

describe("TC-GUIDE-001 guide marker, header, index link", () => {
  test("the guide is redistributable and the marker sits in the first front matter", () => {
    const text = read(GUIDE);
    expect(frontMatter(text).ados_distribution).toBe("redistributable");
  });

  test("the header is byte-identical to scripts/add-header-location.sh output", () => {
    const delivered = read(GUIDE);
    const base = join(ROOT, "tmp/tmpdir");
    mkdirSync(base, { recursive: true });
    const directory = mkdtempSync(join(base, "milestone-guide-"));
    try {
      execFileSync("git", ["init", "-q"], { cwd: directory });
      mkdirSync(join(directory, "scripts"), { recursive: true });
      mkdirSync(join(directory, "doc/guides"), { recursive: true });
      copyFileSync(
        join(ROOT, "scripts/add-header-location.sh"),
        join(directory, "scripts/add-header-location.sh"),
      );
      writeFileSync(join(directory, GUIDE), headerless(delivered));
      execFileSync("bash", ["scripts/add-header-location.sh", GUIDE], {
        cwd: directory,
        env: { ...process.env, GITHUB_BRANCH: "main-tools" },
        stdio: "pipe",
      });
      expect(readFileSync(join(directory, GUIDE), "utf8")).toBe(delivered);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("the header composition is exactly the three comment lines plus source", () => {
    const lines = read(GUIDE).split("\n");
    expect(lines[0]).toBe("---");
    expect(lines[1] ?? "").toMatch(/^# Copyright \(c\) 2025-2026 /);
    expect(lines[2]).toBe("# Apache-2.0 License - see LICENSE file for full terms");
    expect(lines[3]).toBe(
      "source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/milestone-management.md",
    );
    expect(lines[4]).toBe("ados_distribution: redistributable");
    expect(
      lines.slice(1, 4).every((line) => line.startsWith("#") || line.startsWith("source:")),
    ).toBe(true);
  });

  test("the documentation index has exactly one Guides row with a description", () => {
    const text = read("doc/00-index.md");
    const start = text.indexOf("## Guides");
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = text.slice(start);
    const end = rest.indexOf("\n## ", 1);
    const section = end < 0 ? rest : rest.slice(0, end);
    const rows = section
      .split("\n")
      .filter((line) => line.includes("guides/milestone-management.md"));
    expect(rows).toHaveLength(1);
    const cells = (rows[0] ?? "").split("|").map((cell) => cell.trim());
    expect(cells.length).toBeGreaterThanOrEqual(3);
    expect((cells[2] ?? "").length).toBeGreaterThan(0);
  });

  test("the guide links PDR-0005 and carries no repository-specific ticket or milestone rule", () => {
    const text = read(GUIDE);
    expect(text).toContain(PDR);
    expect(text).not.toMatch(/GH-\d+/);
    expect(text).not.toMatch(/\bM\d+:/);
  });
});

describe("TC-GUIDE-002 nine lifecycle topics once each", () => {
  const topics: readonly { readonly id: string; readonly pattern: RegExp }[] = [
    { id: "naming", pattern: /naming/i },
    { id: "creation", pattern: /creation/i },
    { id: "attachment", pattern: /attachment/i },
    { id: "entry review", pattern: /entry review/i },
    { id: "planned scope", pattern: /planned scope/i },
    { id: "exit review", pattern: /exit review/i },
    { id: "closure", pattern: /closure/i },
    { id: "extension or reopening", pattern: /extension|reopen/i },
    { id: "enforcement", pattern: /enforcement/i },
  ];

  test("every topic heading appears exactly once", () => {
    const headings = headingsOf(read(GUIDE));
    for (const topic of topics) {
      const matches = headings.filter((heading) => topic.pattern.test(heading));
      expect(matches.length, `${topic.id}: ${matches.join(", ")}`).toBe(1);
    }
  });

  test("naming, creation, attachment, and entry review carry the rule substance", () => {
    const text = read(GUIDE);
    const naming = sectionBody(text, /naming/i);
    expect(naming).toContain("M<n>");
    expect(naming).toMatch(/durable/i);
    expect(naming).toMatch(/story-code root/i);
    expect(naming).toMatch(/source of truth/i);

    const creation = sectionBody(text, /creation/i);
    expect(creation).toMatch(/owner/i);
    expect(creation).toMatch(/propose/i);
    expect(creation).toMatch(/never creates[\s\S]{0,20}autonomously/i);

    const attachment = sectionBody(text, /attachment/i);
    expect(attachment).toMatch(/exactly one milestone/i);
    expect(attachment).toContain("- Ticket: GH-<n> (milestone M<n>)");

    const entry = sectionBody(text, /entry review/i);
    expect(entry).toMatch(/unattended-run precondition/i);
    expect(entry).toMatch(/before work starts/i);
  });

  test("the enforcement section names both labels, non-blocking behaviour, and the sweep", () => {
    const enforcement = sectionBody(read(GUIDE), /enforcement/i);
    expect(enforcement).toContain("needs-milestone");
    expect(enforcement).toContain("backlog-capture");
    expect(enforcement).toMatch(/never blocks delivery|non-blocking/i);
    expect(enforcement).toMatch(/sweep/i);
  });
});

describe("TC-GUIDE-003 pack conventions pointer", () => {
  test("the Conventions section points at the guide without restating the procedure", () => {
    const text = read(PACK_INDEX);
    const start = text.indexOf("## Conventions");
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = text.slice(start);
    const end = rest.indexOf("\n## ", 1);
    const section = end < 0 ? rest : rest.slice(0, end);

    expect(section).toContain("../../../guides/milestone-management.md");
    expect(section).toMatch(/milestone-first|planned scope/i);
    expect(section).not.toMatch(/^\d+\.\s/m);
    for (const topic of [/entry review/i, /exit review/i, /closure condition/i]) {
      expect(section).not.toMatch(topic);
    }
    for (const existing of [
      "Binary name placeholder",
      "Status semantics",
      "Diagrams",
      "No private content",
    ]) {
      expect(section).toContain(existing);
    }
  });
});

describe("TC-GUIDE-004 PDR-0005 register and reference graph", () => {
  test("the record exists with the expected identity and status", () => {
    const record = frontMatter(read(PDR));
    expect(record.id).toBe("PDR-0005");
    expect(record.decision_type).toBe("pdr");
    expect(record.status).toBe("Proposed");
    expect(record.decision_date).toBeNull();
  });

  test("the decision register has exactly one PDR-0005 row resolving to the record", () => {
    const text = read("doc/decisions/00-index.md");
    const rows = text.split("\n").filter((line) => line.includes("[PDR-0005]"));
    expect(rows).toHaveLength(1);
    const row = rows[0] ?? "";
    const target = "PDR-0005-milestone-first-planning-and-delivery.md";
    expect(row).toContain(`(${target})`);
    expect(read(`doc/decisions/${target}`)).toContain("id: PDR-0005");
    const cells = row.split("|").map((cell) => cell.trim());
    expect(cells[2]).toBe("PDR");
  });

  test("the record states the rule, enforcement, and exemption", () => {
    const text = read(PDR);
    expect(text).toMatch(/operating rule/i);
    expect(text).toContain("needs-milestone");
    expect(text).toMatch(/one marked comment/i);
    expect(text).toMatch(/non-blocking/i);
    expect(text).toContain("backlog-capture");
    expect(text).toMatch(/capture marker/i);
    expect(text).toMatch(/never a delivery licence/i);
  });

  test("guide, change spec, and record point at each other", () => {
    expect(read(GUIDE)).toContain(PDR);
    const spec = frontMatter(
      read("doc/changes/2026-11/2026-11-14--GH-313--milestone-first-planning/chg-GH-313-spec.md"),
    );
    const change = spec.change;
    expect(typeof change).toBe("object");
    const links = (change as { links?: { decisions?: unknown } }).links;
    const decisions = links?.decisions;
    expect(Array.isArray(decisions) ? decisions : []).toContain("PDR-0005");
    expect(read(PDR)).toContain("GH-313");
  });
});
