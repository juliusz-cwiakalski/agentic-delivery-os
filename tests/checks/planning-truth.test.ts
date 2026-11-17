/**
 * TC-PLAN-001..005 — planning-corpus truth.
 *
 * Backlogs and rankings are per-milestone files under
 * `doc/planning/oss-tooling/milestones/m<N>/`; the root backlog holds only
 * unplanned ideas. The assertions compare independent surfaces and derive
 * counts from the files.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const milestoneDir = (milestone: string): string =>
  `doc/planning/oss-tooling/milestones/${milestone.toLowerCase()}`;
const backlogPath = (milestone: string): string => `${milestoneDir(milestone)}/backlog.md`;
const rankingPath = (milestone: string): string => `${milestoneDir(milestone)}/ranking.md`;
const M2_README = "doc/planning/oss-tooling/milestones/m2/README.md";
const M2_SCENARIOS = "doc/planning/oss-tooling/milestones/m2/test-scenarios.md";
const STATUS = "doc/planning/oss-tooling/status.md";
const BASELINE = "tests/fixtures/milestone-attachment/planning/section-headings.json";

type StoryBlock = {
  readonly code: string;
  readonly title: string;
  readonly lines: readonly string[];
};

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const epicSection = (text: string, epic: string): string => {
  const start = text.indexOf(`## Epic ${epic}`);
  if (start < 0) throw new Error(`missing epic ${epic}`);
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ", 1);
  return end < 0 ? rest : rest.slice(0, end);
};

const storySection = (milestone: string): string => {
  const text = read(backlogPath(milestone));
  if (text.includes(`## Epic ${milestone}`)) return epicSection(text, milestone);
  return text;
};

const storyBlocks = (section: string): readonly StoryBlock[] => {
  const lines = section.split("\n");
  const blocks: StoryBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^### (M\d+-S\d+) (.+)$/.exec(lines[index] ?? "");
    if (heading === null) continue;
    const body: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor] ?? "";
      if (/^### /.test(line) || /^## /.test(line) || /^---\s*$/.test(line)) break;
      body.push(line);
    }
    blocks.push({ code: heading[1] ?? "", title: heading[2] ?? "", lines: body });
  }
  return blocks;
};

const ticketLines = (block: StoryBlock): readonly string[] =>
  block.lines.map((line) => line.trim()).filter((line) => line.startsWith("- Ticket: "));

const storyCodes = (milestone: string): readonly string[] =>
  storyBlocks(storySection(milestone)).map((block) => block.code);

const rankingRows = (
  milestone: string,
): readonly {
  readonly number: number;
  readonly code: string;
  readonly line: string;
}[] => {
  const rows: { number: number; code: string; line: string }[] = [];
  for (const line of read(rankingPath(milestone)).split("\n")) {
    const match = /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (match === null) continue;
    const code = /^(M\d+-S\d+)/.exec(match[2] ?? "");
    if (code === null) continue;
    rows.push({ number: Number(match[1]), code: code[1] ?? "", line });
  }
  return rows;
};

const packRows = (): readonly { readonly code: string; readonly seeds: readonly string[] }[] => {
  const rows: { code: string; seeds: readonly string[] }[] = [];
  for (const line of read(M2_README).split("\n")) {
    if (!line.startsWith("| M2-S")) continue;
    const cells = line.split("|").map((cell) => cell.trim());
    const code = /^(M2-S\d+)/.exec(cells[1] ?? "");
    if (code === null) continue;
    rows.push({
      code: code[1] ?? "",
      seeds: [...(cells[4] ?? "").matchAll(/SC-[A-Z0-9-]+/g)].map((match) => match[0]),
    });
  }
  return rows;
};

const seedHeadings = (): readonly string[] =>
  [...read(M2_SCENARIOS).matchAll(/^### (SC-[A-Z0-9-]+)/gm)].map((match) => match[1] ?? "");

type Baseline = {
  readonly sections: Record<string, readonly string[]>;
};

const baseline = (): Baseline => JSON.parse(read(BASELINE)) as Baseline;

describe("TC-PLAN-001 M2-S20 block in story shape and the milestone snapshot", () => {
  test("M2-S20 exists once and is the last M2 block", () => {
    const blocks = storyBlocks(storySection("M2"));
    const s20 = blocks.filter((block) => block.code === "M2-S20");
    expect(s20).toHaveLength(1);
    expect(blocks.at(-1)?.code).toBe("M2-S20");
  });

  test("the block carries Goal, Tasks, AC, Depends on, and exactly one ticket line", () => {
    const block = storyBlocks(storySection("M2")).find((entry) => entry.code === "M2-S20");
    expect(block).toBeDefined();
    const text = (block?.lines ?? []).join("\n");
    expect(text).toMatch(/^- Goal: /m);
    expect(text).toMatch(/^- Tasks: /m);
    expect(text).toMatch(/^- AC:/m);
    expect(text).toMatch(/^- Depends on: /m);
    expect(ticketLines(block as StoryBlock)).toEqual(["- Ticket: GH-313 (milestone M2)"]);
    expect(block?.title).toBe("Milestone-first planning and delivery");
  });

  test("every milestone matches the recorded story snapshot", () => {
    const fixture = baseline();
    for (const milestone of ["M0", "M1", "M2", "M3", "M4", "M5"]) {
      expect(storyCodes(milestone), milestone).toEqual(fixture.sections[milestone] ?? []);
    }
  });
});

describe("TC-PLAN-002 every M2 block carries exactly one valid ticket line", () => {
  test("block count equals ticket-line count and every line is in its own block", () => {
    const blocks = storyBlocks(storySection("M2"));
    const lines = blocks.flatMap((block) => ticketLines(block));
    expect(lines).toHaveLength(blocks.length);
    const numbers: number[] = [];
    for (const block of blocks) {
      const own = ticketLines(block);
      expect(own, block.code).toHaveLength(1);
      const match = /^- Ticket: GH-(\d+) \(milestone M2\)$/.exec(own[0] ?? "");
      expect(match, `${block.code}: ${own[0] ?? ""}`).not.toBeNull();
      numbers.push(Number(match?.[1]));
    }
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every((number) => Number.isInteger(number) && number > 0)).toBe(true);
  });

  test("the twelve backfilled stories and M2-S20 each carry their line", () => {
    const blocks = new Map(storyBlocks(storySection("M2")).map((block) => [block.code, block]));
    const expected: Record<string, string> = {
      "M2-S2": "GH-295",
      "M2-S3": "GH-296",
      "M2-S4": "GH-297",
      "M2-S5": "GH-298",
      "M2-S6": "GH-299",
      "M2-S7": "GH-300",
      "M2-S8": "GH-301",
      "M2-S10": "GH-287",
      "M2-S14": "GH-291",
      "M2-S16": "GH-293",
      "M2-S17": "GH-294",
      "M2-S19": "GH-310",
      "M2-S20": "GH-313",
    };
    for (const [code, ticket] of Object.entries(expected)) {
      expect(ticketLines(blocks.get(code) as StoryBlock), code).toContain(
        `- Ticket: ${ticket} (milestone M2)`,
      );
    }
  });

  test("the closed milestones keep their delivered coverage", () => {
    for (const milestone of ["M0", "M1"]) {
      const blocks = storyBlocks(storySection(milestone));
      const lines = blocks.flatMap((block) => ticketLines(block));
      expect(lines, milestone).toHaveLength(blocks.length);
    }
  });
});

describe("TC-PLAN-003 per-milestone rankings mirror their backlogs", () => {
  test("story-code sets are equal in both directions and unique per milestone", () => {
    for (const milestone of ["M0", "M1", "M2", "M3", "M4", "M5"]) {
      const backlogCodes = storyCodes(milestone);
      const rankingCodes = rankingRows(milestone).map((row) => row.code);
      expect(new Set(rankingCodes).size, milestone).toBe(rankingCodes.length);
      expect(new Set(rankingCodes), milestone).toEqual(new Set(backlogCodes));
      expect(rankingCodes, milestone).toHaveLength(backlogCodes.length);
    }
  });

  test("the # column is exactly 1..N with no gap or repetition per file", () => {
    for (const milestone of ["M0", "M1", "M2", "M3", "M4", "M5"]) {
      const numbers = rankingRows(milestone).map((row) => row.number);
      expect(numbers, milestone).toEqual(
        Array.from({ length: numbers.length }, (_, index) => index + 1),
      );
    }
  });

  test("the M2 subsequence follows the backlog's M2 order", () => {
    const backlogM2 = storyCodes("M2");
    const rankingM2 = rankingRows("M2")
      .map((row) => row.code)
      .filter((code) => code.startsWith("M2-"));
    expect(rankingM2).toEqual(backlogM2);
    for (const code of ["M2-S20", "M2-S11", "M2-S19"]) {
      expect(rankingM2).toContain(code);
    }
  });

  test("the stated backlog-order invariant remains present", () => {
    for (const milestone of ["M0", "M1", "M2", "M3", "M4", "M5"]) {
      expect(read(rankingPath(milestone)), milestone).toMatch(
        /Stories from \[backlog\.md\]\(backlog\.md\) top to bottom/,
      );
    }
  });
});

describe("TC-PLAN-004 M2 pack row, resolvable seeds, and the S20 range", () => {
  test("the M2-S20 row cites exactly the five seeds and each resolves", () => {
    const rows = packRows();
    const s20 = rows.filter((row) => row.code === "M2-S20");
    expect(s20).toHaveLength(1);
    const expected = [
      "SC-M2-S20-01",
      "SC-M2-S20-02",
      "SC-M2-S20-03",
      "SC-M2-S20-04",
      "SC-M2-S20-05",
    ];
    expect(s20[0]?.seeds).toEqual(expected);
    const defined = new Set(seedHeadings());
    for (const seed of expected) expect(defined).toContain(seed);
  });

  test("every seed cited by any pack row resolves to a heading", () => {
    const defined = new Set(seedHeadings());
    for (const row of packRows()) {
      for (const seed of row.seeds) {
        expect(defined, `${row.code}: ${seed}`).toContain(seed);
      }
    }
  });

  test("the seed heading range and the pack-contents line cover S20", () => {
    expect(read(M2_SCENARIOS)).toMatch(/M2-S2 through M2-S20/);
    expect(read(M2_SCENARIOS)).toMatch(/^## M2-S20 /m);
    expect(read(M2_README)).toMatch(/scenario seeds for stories S2 through S20/);
  });

  test("the five seeds name observable assertions", () => {
    const text = read(M2_SCENARIOS);
    const s20 = text.slice(text.indexOf("## M2-S20"), text.indexOf("\n## Cross-story scenarios"));
    expect(s20.match(/^Assert: /gm) ?? []).toHaveLength(5);
  });
});

type StatusAddendum = { readonly line: string; readonly index: number };

const statusAddenda = (): readonly StatusAddendum[] =>
  read(STATUS)
    .split("\n")
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith("## M2 delivery snapshot addendum "));

const addendumBody = (code: string): string => {
  const text = read(STATUS);
  const matches = [...text.matchAll(/^## M2 delivery snapshot addendum .*$/gmu)];
  const position = matches.findIndex((match) => (match[0] ?? "").includes(code));
  if (position < 0) throw new Error(`no status addendum for ${code}`);
  const start = matches[position]?.index ?? 0;
  const end = matches[position + 1]?.index ?? text.length;
  return text.slice(start, end);
};

describe("TC-PLAN-005 status addendum in the established form", () => {
  test("every addendum is dated, uniquely named, and appended in chronological order", () => {
    const addenda = statusAddenda();
    expect(addenda.length).toBeGreaterThanOrEqual(4);
    const codes: string[] = [];
    const dates: string[] = [];
    for (const { line } of addenda) {
      const match = /^## M2 delivery snapshot addendum \((\d{4}-\d{2}-\d{2})\): .+ GH-\d+$/u.exec(
        line,
      );
      expect(match, line).not.toBeNull();
      dates.push(match?.[1] ?? "");
      codes.push(/(GH-\d+)$/u.exec(line)?.[1] ?? "");
    }
    expect(new Set(codes).size).toBe(codes.length);
    expect(dates).toEqual([...dates].sort());
    for (const delivery of ["GH-294", "GH-309", "GH-313", "GH-310"]) {
      expect(codes, delivery).toContain(delivery);
    }
    expect(read(STATUS)).toContain("GH-291");
  });

  test("the body states M2 has not exited and does not claim acceptance", () => {
    const body = addendumBody("GH-313");
    expect(body).toContain("M2 has not exited");
    expect(body).toMatch(/remaining M2[\s]+stories/i);
    expect(body).toMatch(/M2-S20/);
    expect(body).toMatch(/GH-313/);
    expect(body).not.toMatch(/M2 has exited(?!\s*\.)/i);
  });

  test("the cross-repository addendum states delivery truth without a milestone exit", () => {
    const body = addendumBody("GH-310");
    expect(body).toContain("M2 has not exited");
    expect(body).toMatch(/remaining M2[\s]+stories/i);
    expect(body).toMatch(/M2-S19/);
    expect(body).toMatch(/GH-310/);
    expect(body).not.toMatch(/M2 has exited(?!\s*\.)/i);
  });

  test("prior addenda remain ordered before the later ones", () => {
    const codes = statusAddenda().map(({ line }) => /(GH-\d+)$/u.exec(line)?.[1] ?? "");
    const position = (code: string): number => codes.indexOf(code);
    expect(position("GH-294")).toBeLessThan(position("GH-309"));
    expect(position("GH-309")).toBeLessThan(position("GH-313"));
    expect(position("GH-313")).toBeLessThan(position("GH-310"));
  });
});
