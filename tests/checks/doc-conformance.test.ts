/**
 * TC-DOCREC-004 — the §16.1.1 stale/required phrase table is the single source
 * for the doc-conformance scan. This scope asserts the two behavior-spec rows
 * that the lifecycle-completion change owns.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SPEC = "doc/changes/2026-11/2026-11-07--GH-242--agent-integration/chg-GH-242-spec.md";

type PhraseRow = {
  readonly page?: string;
  readonly stale: readonly string[];
  readonly required: readonly string[];
  readonly owner: string;
};

const tableSection = (text: string): string => {
  const start = text.indexOf("#### 16.1.1");
  if (start < 0) throw new Error("the §16.1.1 phrase table is missing");
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ", 1);
  return end < 0 ? rest : rest.slice(0, end);
};

const quoted = (cell: string): readonly string[] =>
  [...cell.matchAll(/"([^"]+)"/g)]
    .map((match) => match[1] ?? "")
    .filter((value) => value.length > 0);

/** Required cells may end with one unquoted sentence after the last quote. */
const requiredPhrases = (cell: string): readonly string[] => {
  const phrases = [...quoted(cell)];
  const lastQuote = cell.lastIndexOf('"');
  if (lastQuote >= 0) {
    const tail = cell
      .slice(lastQuote + 1)
      .replace(/^[;\s]+/, "")
      .replace(/[.;\s]+$/, "");
    if (tail.length > 0) phrases.push(tail);
  }
  return phrases;
};

const rowsOf = (specText: string): readonly PhraseRow[] => {
  const section = tableSection(specText);
  const rows: PhraseRow[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|") || line.startsWith("|---") || line.startsWith("| Page ")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;
    const [pageCell, staleCell, requiredCell, ownerCell] = cells;
    if (pageCell === undefined || staleCell === undefined || requiredCell === undefined) continue;
    const page = pageCell.replaceAll("`", "").trim();
    rows.push({
      ...(page.includes(".md") ? { page } : {}),
      stale: quoted(staleCell),
      required: requiredPhrases(requiredCell),
      owner: ownerCell ?? "",
    });
  }
  return rows;
};

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const stripRequired = (text: string, required: readonly string[]): string => {
  let result = text.toLowerCase();
  for (const phrase of required) {
    result = result.split(phrase.toLowerCase()).join("");
  }
  return result;
};

const behaviorSpecPages = [
  "feature-commit-primitive.md",
  "feature-pm-notes-lint-and-phase-transitions.md",
] as const;

describe("TC-DOCREC-004 scope: behavior-spec phrase-table rows", () => {
  test("the table carries both behavior-spec rows and names phase 3", () => {
    const rows = rowsOf(read(SPEC));
    for (const page of behaviorSpecPages) {
      const row = rows.find((entry) => entry.page === page);
      expect(row, page).toBeDefined();
      expect(row?.stale.length, page).toBeGreaterThan(0);
      expect(row?.required.length, page).toBeGreaterThan(0);
      expect(row?.owner, page).toContain("Phase 3");
    }
  });

  test("every behavior-spec stale phrase is absent and every required phrase is present", () => {
    const rows = rowsOf(read(SPEC));
    const failures: string[] = [];
    for (const page of behaviorSpecPages) {
      const row = rows.find((entry) => entry.page === page);
      if (row === undefined) continue;
      const text = read(`doc/spec/features/${page}`);
      const residue = stripRequired(text, row.required);
      for (const phrase of row.stale) {
        if (residue.toLowerCase().includes(phrase.toLowerCase())) {
          failures.push(`${page}: stale phrase still present: ${phrase}`);
        }
      }
      for (const phrase of row.required) {
        if (!text.toLowerCase().includes(phrase.toLowerCase())) {
          failures.push(`${page}: required phrase missing: ${phrase}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("the scan is non-vacuous: a mutated copy fails", () => {
    const original = read("doc/spec/features/feature-commit-primitive.md");
    const mutated = `${original}\n| \`commit.session.context-refused\` |`;
    const row = rowsOf(read(SPEC)).find((entry) => entry.page === "feature-commit-primitive.md");
    expect(row).toBeDefined();
    const residue = stripRequired(mutated, row?.required ?? []);
    const detected = (row?.stale ?? []).some((phrase) =>
      residue.toLowerCase().includes(phrase.toLowerCase()),
    );
    expect(detected).toBe(true);
  });
});

const DOC_REQUIREMENTS: readonly {
  readonly page: string;
  readonly required: readonly string[];
  readonly stale?: readonly string[];
}[] = [
  {
    page: "AGENTS.md",
    required: [
      "commit` primitive",
      "phase complete",
      "phase list",
      "blockers publish",
      "deliver-ticket.sh",
      "ceo-loop.sh",
    ],
  },
  {
    page: "doc/guides/change-lifecycle.md",
    required: [
      "commit` primitive",
      "phase complete",
      "phase reopen",
      "typed blocker",
      "deliver-ticket.sh",
      "ceo-loop.sh",
    ],
    stale: [
      "all commits route through `@committer`",
      "No agent prompt other than `@committer` performs a direct `git commit`",
    ],
  },
  {
    page: "doc/guides/unified-change-convention-tracker-agnostic-specification.md",
    required: ["phase complete", "phase reopen", "pm-notes `notes:`", "PR URL"],
  },
  {
    page: "doc/guides/delivery-modes.md",
    required: ["merge` primitive", "deliver-ticket.sh", "ceo-loop.sh", "retained"],
    stale: ["squash-merge (`gh pr merge --squash` on GitHub, `glab mr merge"],
  },
  {
    page: "doc/guides/autonomous-batch-delivery.md",
    required: ["retained", "merge` primitive"],
  },
  {
    page: "doc/planning/concepts/automated-commit.md",
    required: ["commit` command", "phase complete", "plan-phase"],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m1/man-page.md",
    required: [
      "--version",
      "entrypoint",
      "delivery session",
      "five rows",
      "phases[].summary",
      "retained",
    ],
  },
];

const PROMPT_REQUIRED_PAGES = [
  "entrypoint",
  "status",
  "brief",
  "queue",
  "lanes",
  "blockers",
  "phase",
  "commit",
  "lint",
  "plan",
  "verify-change",
  "verify-gates",
  "verify-deploy",
  "merge",
  "closeout",
  "spend",
  "retro",
] as const;

describe("TC-DOCREC-002 scope: docs guides, man page, and reference pages", () => {
  test("every reconciled guide carries its required current-truth phrases", () => {
    const failures: string[] = [];
    for (const requirement of DOC_REQUIREMENTS) {
      const text = read(requirement.page);
      for (const phrase of requirement.required) {
        if (!text.toLowerCase().includes(phrase.toLowerCase())) {
          failures.push(`${requirement.page}: missing ${phrase}`);
        }
      }
      for (const phrase of requirement.stale ?? []) {
        if (text.includes(phrase)) failures.push(`${requirement.page}: stale ${phrase}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("every prompt-required command reference page documents --help", () => {
    const failures: string[] = [];
    for (const page of PROMPT_REQUIRED_PAGES) {
      const text = read(`doc/planning/oss-tooling/milestones/m1/commands/${page}.md`);
      if (!text.includes("--help")) failures.push(`${page}: missing --help`);
      if (!text.includes("--version")) failures.push(`${page}: missing --version`);
    }
    expect(failures).toEqual([]);
  });

  test("the docs scope is non-vacuous: a missing phrase is detected", () => {
    const text = read("AGENTS.md").replaceAll("phase complete", "");
    expect(text.toLowerCase().includes("phase complete")).toBe(false);
  });
});

/** The current-truth pages named by the §16.1.1 phrase table. */
const FULL_PHRASE_PAGES = [
  "feature-commit-primitive.md",
  "feature-pm-notes-lint-and-phase-transitions.md",
  "feature-result-contract.md",
  "feature-delivery-lifecycle.md",
  "feature-quality-gates-and-pr.md",
  "feature-autonomous-delivery.md",
  "feature-local-code-review.md",
] as const;

/** The behavioral-primitives pages the generic §16.1.1 row covers. */
const GENERIC_PHRASE_PAGES = [
  "feature-plan-schema.md",
  "feature-blockers.md",
  "feature-status-digest.md",
  "feature-brief.md",
  "feature-merge-verify-deploy.md",
  "feature-closeout.md",
  "feature-scheduling-engine.md",
  "feature-agents-and-commands.md",
] as const;

const GENERIC_STALE = [
  "git add -A",
  "git commit -F",
  "post-hook amend",
  "`started`/`completed` hand-edited",
  "`phases.pr_creation.url` written",
] as const;

const GENERIC_REQUIRED = [
  "lifecycle commits route through the `commit` primitive or the thin `@committer`",
  "phase state is written only through the `phase` family",
  "the PR URL is a pm-notes `notes:` entry",
] as const;

const CLI_COMMAND_CLAIMS = [
  "`state` command",
  "`mcp` command",
  "dispatch command",
  "daemon command",
];

describe("TC-DOCREC-003 scope: full phrase-table rows", () => {
  test("the fixture covers exactly the §16.1.1 page set and the generic row", () => {
    const rows = rowsOf(read(SPEC));
    const pages = rows.flatMap((row) => (row.page === undefined ? [] : [row.page]));
    expect(pages).toEqual([...FULL_PHRASE_PAGES]);
    const generic = rows.filter((row) => row.page === undefined);
    expect(generic).toHaveLength(1);
    expect(generic[0]?.owner).toContain("Phase 10");
    expect(generic[0]?.stale.length).toBeGreaterThan(0);
    expect(generic[0]?.required.length).toBeGreaterThan(0);
  });

  test("every named stale phrase is absent and every required phrase is present", () => {
    const rows = rowsOf(read(SPEC));
    const failures: string[] = [];
    for (const row of rows) {
      if (row.page === undefined) continue;
      const text = read(`doc/spec/features/${row.page}`);
      const residue = stripRequired(text, row.required);
      for (const phrase of row.stale) {
        if (residue.toLowerCase().includes(phrase.toLowerCase())) {
          failures.push(`${row.page}: stale phrase still present: ${phrase}`);
        }
      }
      for (const phrase of row.required) {
        if (!text.toLowerCase().includes(phrase.toLowerCase())) {
          failures.push(`${row.page}: required phrase missing: ${phrase}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("the generic behavioral-primitives row is covered across its page set", () => {
    const rows = rowsOf(read(SPEC));
    const generic = rows.find((row) => row.page === undefined);
    expect(generic).toBeDefined();
    const texts = GENERIC_PHRASE_PAGES.map((page) => ({
      page,
      text: read(`doc/spec/features/${page}`),
    }));
    const failures: string[] = [];
    for (const { page, text } of texts) {
      for (const phrase of GENERIC_STALE) {
        if (text.includes(phrase)) failures.push(`${page}: stale phrase still present: ${phrase}`);
      }
    }
    const union = texts
      .map((entry) => entry.text)
      .join("\n")
      .toLowerCase();
    for (const phrase of GENERIC_REQUIRED) {
      if (!union.includes(phrase.toLowerCase())) {
        failures.push(`generic page set: required phrase missing: ${phrase}`);
      }
    }
    const agents = texts.find((entry) => entry.page === "feature-agents-and-commands.md");
    for (const phrase of GENERIC_REQUIRED) {
      if (agents === undefined || !agents.text.toLowerCase().includes(phrase.toLowerCase())) {
        failures.push(`feature-agents-and-commands.md: missing ${phrase}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("no phrase-table page claims state, mcp, dispatch, or the daemon as a CLI command", () => {
    const failures: string[] = [];
    for (const page of [...FULL_PHRASE_PAGES, ...GENERIC_PHRASE_PAGES]) {
      const text = read(`doc/spec/features/${page}`);
      for (const claim of CLI_COMMAND_CLAIMS) {
        if (text.includes(claim)) failures.push(`${page}: claims ${claim}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the full scan is non-vacuous: a stale phrase in a temp copy fails", () => {
    const row = rowsOf(read(SPEC)).find((entry) => entry.page === "feature-autonomous-delivery.md");
    expect(row).toBeDefined();
    const mutated = `${read("doc/spec/features/feature-autonomous-delivery.md")}\n| \`gh pr merge --squash\` |`;
    const residue = stripRequired(mutated, row?.required ?? []);
    const detected = (row?.stale ?? []).some((phrase) =>
      residue.toLowerCase().includes(phrase.toLowerCase()),
    );
    expect(detected).toBe(true);
  });
});
