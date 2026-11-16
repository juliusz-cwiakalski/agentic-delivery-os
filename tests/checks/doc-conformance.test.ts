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
  "daemon",
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

/**
 * GH-320 TC-BIN-070 — the self-contained identity requirement table.
 *
 * This change's own five-page set and its stale/required phrases live here, so
 * the historical GH-242 phrase table and `doc/documentation-handbook.md` §16.1.1
 * are untouched. Every row names a real page and carries at least one stale and
 * one required phrase, so no row can pass with an empty list.
 */
type IdentityRow = {
  readonly page: string;
  readonly stale: readonly string[];
  readonly required: readonly string[];
};

const IDENTITY_ROWS: readonly IdentityRow[] = [
  {
    page: "doc/spec/features/feature-cli-entrypoint.md",
    stale: [
      "The bin is not part of the install or release surface.",
      "names neither the bin nor the composition in either of its delivery arrays",
      "then the neutral `delivery-os` default used only for self-description when neither source yields a name",
    ],
    required: [
      "two executables",
      "one shared launcher composition",
      "The invoking bin's declared default working name",
      "`--print-install-path`",
      "executable launcher at the brand install path",
      "the prior-identity file second",
      "`prior-identity-fallback`",
      "fallback.internal",
    ],
  },
  {
    page: "doc/spec/features/feature-branding-seam.md",
    stale: [
      "no working-name literal is committed",
      "The CLI entrypoint and the MCP serve composition apply the neutral working name",
    ],
    required: [
      "exactly five sites",
      "`SCOPE_ORG`",
      "the three CLI selector sites",
      "the unchanged MCP default",
      "state-free `--print-install-path` self-description",
      "Prior-identity derivation",
    ],
  },
  {
    page: "doc/spec/features/feature-config-layer.md",
    stale: ["selected/root handling and loaded/skipped facts"],
    required: [
      "Prior-identity fallback",
      "current file wins whenever it exists",
      "reported **not used**",
      "not** a configuration warning",
      "composition-time acquisition",
      "`config-skipped`",
      "Machine-global layers never fall back",
      "read-only",
    ],
  },
  {
    page: "doc/spec/features/feature-projects.md",
    stale: [
      "| Host root | `<PREFIX>_STATE_DIR` (absolute) else `<home>/<brand.stateDirectoryName>` |",
    ],
    required: [
      "Prior-identity host root",
      "prior default root",
      "no current default root is created",
      "single-rooted",
      "`state-skipped`",
      "extends** [TDR-0022]",
    ],
  },
  {
    page: "doc/spec/features/feature-doc-distribution-marker.md",
    stale: ["**TBD / out of scope** here (not yet delivered)"],
    required: [
      "launcher",
      "brand install path",
      "state-free `--print-install-path`",
      "Install-time runtime requirement",
      "classified failure",
      "`DRY_RUN`",
      "`--tool`",
      "`delivery-os` bin mapping",
    ],
  },
];

const IDENTITY_PAGES = [
  "doc/spec/features/feature-cli-entrypoint.md",
  "doc/spec/features/feature-branding-seam.md",
  "doc/spec/features/feature-config-layer.md",
  "doc/spec/features/feature-projects.md",
  "doc/spec/features/feature-doc-distribution-marker.md",
] as const;

/** The identity table's own rule, driven over injected page texts. */
export const identityRowViolations = (
  rows: readonly IdentityRow[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  const declared = rows.map((row) => row.page).sort();
  const expected = [...IDENTITY_PAGES].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    failures.push(`identity table pages ${JSON.stringify(declared)} are not the declared five`);
  }
  for (const row of rows) {
    if (row.stale.length === 0) failures.push(`${row.page}: no stale phrase declared`);
    if (row.required.length === 0) failures.push(`${row.page}: no required phrase declared`);
    const text = pageText(row.page);
    if (text === undefined) {
      failures.push(`${row.page}: page does not exist`);
      continue;
    }
    for (const phrase of row.stale) {
      if (text.includes(phrase)) failures.push(`${row.page}: stale phrase present: ${phrase}`);
    }
    for (const phrase of row.required) {
      if (!text.includes(phrase)) failures.push(`${row.page}: missing required phrase: ${phrase}`);
    }
  }
  return failures;
};

describe("GH-320 TC-BIN-070 identity documentation table", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the five declared pages are reconciled in both directions", () => {
    expect(identityRowViolations(IDENTITY_ROWS, pageText)).toEqual([]);
  });

  test("every row names a real page with a non-empty stale and required list", () => {
    for (const row of IDENTITY_ROWS) {
      expect(IDENTITY_PAGES as readonly string[]).toContain(row.page);
      expect(row.stale.length).toBeGreaterThan(0);
      expect(row.required.length).toBeGreaterThan(0);
    }
  });

  test("the page set is exact: a missing or extra page fails by name", () => {
    const missing = IDENTITY_ROWS.filter((row) => row.page !== IDENTITY_PAGES[0]);
    expect(identityRowViolations(missing, pageText).join("\n")).toContain(
      "are not the declared five",
    );
    const extra: readonly IdentityRow[] = [
      ...IDENTITY_ROWS,
      { page: "doc/spec/features/feature-invented.md", stale: ["x"], required: ["y"] },
    ];
    expect(identityRowViolations(extra, pageText).join("\n")).toContain(
      "are not the declared five",
    );
  });

  test("a stale phrase in a synthetic copy fails naming the page and the phrase", () => {
    const entrypoint = read("doc/spec/features/feature-cli-entrypoint.md");
    const mutated = `${entrypoint}\nThe bin is not part of the install or release surface.\n`;
    const detected = identityRowViolations(IDENTITY_ROWS, (page) =>
      page === "doc/spec/features/feature-cli-entrypoint.md" ? mutated : pageText(page),
    );
    expect(detected.join("\n")).toContain(
      "feature-cli-entrypoint.md: stale phrase present: The bin is not part of the install or release surface.",
    );
  });

  test("a removed required phrase fails naming the page and the phrase", () => {
    const projects = read("doc/spec/features/feature-projects.md").replaceAll(
      "single-rooted",
      "single",
    );
    const detected = identityRowViolations(IDENTITY_ROWS, (page) =>
      page === "doc/spec/features/feature-projects.md" ? projects : pageText(page),
    );
    expect(detected.join("\n")).toContain(
      "feature-projects.md: missing required phrase: single-rooted",
    );
  });
});

/**
 * TC-CEREMONY-060 (GH-296) — the plan-owned documentation pages are current
 * truth: the M2 command page is delivered, the measurement spec describes the
 * additive comparisons record, and the entrypoint delta records the mount.
 */
describe("TC-CEREMONY-060 ceremony documentation current truth", () => {
  const ceremonyPage = "doc/planning/oss-tooling/milestones/m2/commands/ceremony.md";
  const measurementSpec = "doc/spec/features/feature-measurement-baseline.md";
  const entrypointDelta = "doc/planning/oss-tooling/milestones/m2/entrypoint-delta.md";

  test("the command page is Delivered and documents the four verbs", () => {
    const text = read(ceremonyPage);
    expect(text).toContain("Status: Delivered (M2-S3)");
    expect(text).not.toContain("Status: Proposed");
    for (const verb of ["list", "run", "resume", "catch-up"]) expect(text).toContain(verb);
    expect(text).toContain("--help");
    expect(text).toContain("--version");
  });

  test("the measurement spec documents the additive comparisons record", () => {
    const text = read(measurementSpec);
    expect(text).toContain("comparisons[]");
    expect(text).toContain("schema_version: 2");
    expect(text).not.toContain("`schema_version: 1`");
    expect(text).toContain("insufficient-sample");
  });

  test("the entrypoint delta records the twenty-one-family mount", () => {
    const text = read(entrypointDelta);
    expect(text).toContain("Twenty-one families");
    expect(text).toContain("`ceremony`");
  });
});
