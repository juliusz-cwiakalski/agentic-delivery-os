/**
 * TC-DOCREC-004 — the §16.1.1 stale/required phrase table is the single source
 * for the doc-conformance scan. This scope asserts the two behavior-spec rows
 * that the lifecycle-completion change owns.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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
    page: "doc/spec/features/feature-retro-pipeline.md",
    required: ["retro action", "producer", "delivery.retro.report.v1"],
    stale: ["enforcement is later work"],
  },
  {
    page: "doc/spec/features/feature-retro-action-registry.md",
    required: [
      "five-field contract",
      "retro.action-incomplete",
      "retro.closure-incomplete",
      "retro.wip-limit-exceeded",
      "artifactClosure",
      "outcomeClosure",
    ],
  },
  {
    page: "doc/spec/features/feature-board.md",
    required: ["ACTIONS", "delivery.board.v1"],
  },
  {
    page: "doc/spec/features/feature-doctor.md",
    required: ["action-registry"],
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
      "exactly the declared five-site inventory",
    ],
    required: [
      "two executables",
      "exactly the declared five-site product-surface inventory, plus the one declared build-side site under `scripts/` registered with its own scan root",
      "twenty-eight families",
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
      "no identity literal lives anywhere else",
      "outside the declared five-site inventory",
    ],
    required: [
      "exactly five sites",
      "exactly five sites in the product-surface inventory",
      "zero committed working-name literals outside the product-surface inventory, plus the one declared build-side site under `scripts/`",
      "product-surface inventory plus one declared build-side site",
      "a scan of the build-side site's own root, `scripts/`",
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
    stale: ["**TBD / out of scope** here (not yet delivered)", "no uninstall path exists"],
    required: [
      "launcher",
      "brand install path",
      "state-free `--print-install-path`",
      "Install-time runtime requirement",
      "classified failure",
      "`DRY_RUN`",
      "`--tool`",
      "`delivery-os` bin mapping",
      "install uninstall",
      "reports a managed install",
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

  test("the entrypoint delta records the twenty-two-family mount", () => {
    const text = read(entrypointDelta);
    expect(text).toContain("Twenty-two families");
    expect(text).toContain("`ceremony`");
    expect(text).toContain("`board`");
  });
});

/**
 * GH-346 TC-INST-111/112 — this change's own page-claim table.
 *
 * A self-contained requirement table over an exact declared page set (the GH-320
 * precedent): every row carries at least one required and one stale phrase, so no
 * row passes with an empty list, and both directions are driven non-vacuously.
 * The count-bearing pages carry the moved numbers; the supervision row keeps the
 * `supervise` ordinal as a REQUIRED phrase, so an over-correction to "26th" fails.
 */
type PageClaimRow = {
  readonly page: string;
  readonly stale: readonly string[];
  readonly required: readonly string[];
};

const GH346_PAGES = [
  "doc/guides/local-install.md",
  "doc/spec/features/feature-cli-entrypoint.md",
  "doc/spec/features/feature-doc-distribution-marker.md",
  "doc/spec/features/feature-state-layer.md",
  "doc/spec/features/feature-result-contract.md",
  "doc/spec/features/feature-ceremony-runner.md",
  "doc/spec/features/feature-metrics.md",
  "doc/spec/features/feature-supervise.md",
  "doc/spec/features/feature-branding-seam.md",
  "doc/planning/oss-tooling/milestones/m4/install-model.md",
  "doc/planning/oss-tooling/milestones/m4/commands/install.md",
] as const;

const GH346_ROWS: readonly PageClaimRow[] = [
  {
    page: "doc/guides/local-install.md",
    stale: [
      "launcher-only installation",
      "Removing a registered launcher is an operator action: reinstall to update it",
    ],
    required: [
      "install a release",
      "linked git worktree",
      "deleted after merge",
      "install.dev-build",
      "different compiled artifact",
      "single step back",
      "purge would additionally delete",
      "--add-to-path",
      "shell mapping",
      "install.state.incompatible",
      "One owner per artifact class",
    ],
  },
  {
    page: "doc/spec/features/feature-cli-entrypoint.md",
    stale: [
      "twenty-five families",
      "twenty-six families",
      "twenty-seven families",
      "exactly the declared five-site inventory",
    ],
    required: [
      "twenty-eight families",
      "exactly the declared five-site product-surface inventory, plus the one declared build-side site under `scripts/` registered with its own scan root",
      "install.identity.not-owning",
      "compile-time constant",
    ],
  },
  {
    page: "doc/spec/features/feature-doc-distribution-marker.md",
    stale: ["no uninstall path exists"],
    required: [
      "refuses, classified",
      "install uninstall",
      "reports a managed install",
      "never by the install record",
    ],
  },
  {
    page: "doc/spec/features/feature-state-layer.md",
    stale: ["The check aggregates a state version"],
    required: [
      "compatibility surface for the installed binary",
      "read-only",
      "install.state.incompatible",
      "state.schema.mismatch",
    ],
  },
  {
    page: "doc/spec/features/feature-result-contract.md",
    stale: [
      "The table declares 149 machine identities",
      "The table declares 153 machine identities",
      "The table declares 164 machine identities",
      "allowlist of 65 declared identities",
      "allowlist of 66 declared identities",
    ],
    required: [
      "install | user | false | not_landed | Build and install from the primary checkout",
      "The table declares 170 machine identities",
      "allowlist of 68 declared identities",
      "the eleven `install` rows",
      "the thirteen `harness` rows",
      "the nine concrete `merge` rows",
    ],
  },
  {
    page: "doc/spec/features/feature-ceremony-runner.md",
    stale: [
      "149 identities",
      "153 identities",
      "164 identities",
      "167 identities",
      "65-entry allowlist",
      "66-entry allowlist",
    ],
    required: ["170 identities", "68-entry allowlist"],
  },
  {
    page: "doc/spec/features/feature-metrics.md",
    stale: [
      "149 entries",
      "153 entries",
      "164 entries",
      "167 entries",
      "163 delivered rows",
      "166 delivered rows",
      "BASELINE_ROWS.length + 115",
      "BASELINE_ROWS.length + 119",
      "BASELINE_ROWS.length + 130",
      "BASELINE_ROWS.length + 133",
      "66 allowlisted two-segment codes",
      "family count (25)",
      "family count (26)",
      "family count (27)",
    ],
    required: [
      "170 entries",
      "169 delivered rows",
      "68 allowlisted two-segment codes",
      "BASELINE_ROWS.length + 136",
      "family count (28)",
    ],
  },
  {
    page: "doc/spec/features/feature-supervise.md",
    stale: ["65-member allowlist", "66-member allowlist", "26th family"],
    required: ["68-member allowlist", "25th family"],
  },
  {
    page: "doc/spec/features/feature-branding-seam.md",
    stale: ["outside the declared five-site inventory", "No identity literal lives anywhere else:"],
    required: [
      "exactly five sites in the product-surface inventory",
      "zero committed working-name literals outside the product-surface inventory, plus the one declared build-side site under `scripts/`",
      "product-surface inventory plus one declared build-side site",
      "a scan of the build-side site's own root, `scripts/`",
    ],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/install-model.md",
    stale: ["scripts/install-jaiship.sh", "--purge --yes"],
    required: [
      "**mechanics** below",
      "superseded",
      "jaiship install rollback",
      "install.record.v1",
    ],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/commands/install.md",
    stale: ["no lifecycle", "The four causes are missing-name conditions"],
    required: [
      "install uninstall",
      "install.slot.absent",
      "install.purge.unconfirmed",
      "install.status.v1",
      "a destination that is not a compiled artifact",
    ],
  },
];

/** The page-claim rule, driven over injected page texts. */
export const pageClaimViolations = (
  rows: readonly PageClaimRow[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  const declared = rows.map((row) => row.page).sort();
  const expected = [...GH346_PAGES].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    failures.push(`GH-346 page set ${JSON.stringify(declared)} is not the declared eleven`);
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

describe("GH-346 TC-INST-111/112 the page set states the delivered truth", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the eleven declared pages are reconciled in both directions", () => {
    expect(pageClaimViolations(GH346_ROWS, pageText)).toEqual([]);
  });

  test("every row carries a non-empty stale and required list", () => {
    for (const row of GH346_ROWS) {
      expect({ page: row.page, stale: row.stale.length > 0 }).toEqual({
        page: row.page,
        stale: true,
      });
      expect({ page: row.page, required: row.required.length > 0 }).toEqual({
        page: row.page,
        required: true,
      });
    }
  });

  test("the page set is exact: a missing or extra page fails by name", () => {
    expect(pageClaimViolations(GH346_ROWS.slice(0, 10), pageText).join("\n")).toContain(
      "is not the declared eleven",
    );
    const extra = [
      ...GH346_ROWS,
      { page: "doc/spec/features/feature-invented.md", stale: ["x"], required: ["y"] },
    ];
    expect(pageClaimViolations(extra, pageText).join("\n")).toContain("is not the declared eleven");
  });

  test("both directions fail by name on an injected text", () => {
    const reintroduced: readonly PageClaimRow[] = GH346_ROWS.map((row) =>
      row.page === "doc/spec/features/feature-metrics.md"
        ? { ...row, stale: [...row.stale], required: [...row.required] }
        : row,
    );
    const withStale = (page: string): string | undefined =>
      page === "doc/spec/features/feature-metrics.md"
        ? `${pageText(page) ?? ""}\nBASELINE_ROWS.length + 115\n`
        : pageText(page);
    expect(pageClaimViolations(reintroduced, withStale).join("\n")).toContain(
      "stale phrase present: BASELINE_ROWS.length + 115",
    );
    const withoutRequired = (page: string): string | undefined =>
      page === "doc/spec/features/feature-ceremony-runner.md"
        ? (pageText(page) ?? "").replaceAll("170 identities", "the moved count")
        : pageText(page);
    expect(pageClaimViolations(GH346_ROWS, withoutRequired).join("\n")).toContain(
      "missing required phrase: 170 identities",
    );
  });

  test("the supervision row keeps the ordinal and never demands its absence", () => {
    const supervision = GH346_ROWS.find(
      (row) => row.page === "doc/spec/features/feature-supervise.md",
    );
    expect(supervision?.required).toContain("25th family");
    expect(supervision?.stale).not.toContain("25th family");
    expect(supervision?.stale).not.toContain("25th");
    const overCorrected = (page: string): string | undefined =>
      page === "doc/spec/features/feature-supervise.md"
        ? (pageText(page) ?? "").replaceAll("25th family", "26th family")
        : pageText(page);
    expect(pageClaimViolations(GH346_ROWS, overCorrected).join("\n")).toContain(
      "missing required phrase: 25th family",
    );
  });

  test("a branding page claiming a sixth product-surface site or dropping the build-side site fails", () => {
    const sixth = (page: string): string | undefined =>
      page === "doc/spec/features/feature-branding-seam.md"
        ? (pageText(page) ?? "").replaceAll(
            "exactly five sites in the product-surface inventory",
            "exactly six sites in the product-surface inventory",
          )
        : pageText(page);
    expect(pageClaimViolations(GH346_ROWS, sixth).join("\n")).toContain(
      "missing required phrase: exactly five sites in the product-surface inventory",
    );
    const noBuildSide = (page: string): string | undefined =>
      page === "doc/spec/features/feature-branding-seam.md"
        ? (pageText(page) ?? "").replaceAll(
            "a scan of the build-side site's own root, `scripts/`",
            "a single scan",
          )
        : pageText(page);
    expect(pageClaimViolations(GH346_ROWS, noBuildSide).join("\n")).toContain(
      "missing required phrase: a scan of the build-side site's own root",
    );
  });
});

/**
 * GH-350 — the phase-1 documentation half: the count-bearing pages move with the
 * register, the engine page's whole vocabulary edit-set lands with the closed
 * sets, and the eight decision records are present, `Proposed` and indexed.
 *
 * The page set is the phase-1 subset of the plan's closed page set; later phases
 * extend it in their own commits.
 */
type GH350Row = {
  readonly page: string;
  readonly stale: readonly string[];
  readonly required: readonly string[];
};

const GH350_PHASE1_PAGES = [
  "doc/spec/features/feature-result-contract.md",
  "doc/spec/features/feature-ceremony-runner.md",
  "doc/spec/features/feature-metrics.md",
  "doc/spec/features/feature-install-lifecycle.md",
  "doc/spec/features/feature-provider-engine.md",
] as const;

const GH350_PHASE1_ROWS: readonly GH350Row[] = [
  {
    page: "doc/spec/features/feature-result-contract.md",
    stale: [
      "The table declares 164 machine identities",
      "The table declares 167 machine identities",
      "the same 164 identities",
      "the same 167 identities",
      "BASELINE_ROWS.length + 130",
      "BASELINE_ROWS.length + 133",
    ],
    required: [
      "170 machine identities",
      "the same 170 identities",
      "delivered-rows metric",
      "BASELINE_ROWS.length + 136",
      "the sixteen `provider` rows",
      "provider.peak.zone-unknown",
      "provider.budget.exceeded",
      "provider.migrate.refused",
    ],
  },
  {
    page: "doc/spec/features/feature-ceremony-runner.md",
    stale: ["164 identities", "167 identities", "66-entry allowlist"],
    required: ["170 identities", "68-entry allowlist"],
  },
  {
    page: "doc/spec/features/feature-metrics.md",
    stale: [
      "164 entries",
      "167 entries",
      "163 delivered rows",
      "166 delivered rows",
      "BASELINE_ROWS.length + 130",
      "BASELINE_ROWS.length + 133",
    ],
    required: ["170 entries", "169 delivered rows", "BASELINE_ROWS.length + 136"],
  },
  {
    page: "doc/spec/features/feature-install-lifecycle.md",
    stale: [
      "declared table total at 164 machine identities",
      "declared table total at 167 machine identities",
      "66 declared identities",
    ],
    required: ["declared table total at 170 machine identities", "68 declared identities"],
  },
  {
    page: "doc/spec/features/feature-provider-engine.md",
    stale: [
      "eight skip reasons",
      "closed eight-value set",
      "eight-field park allowlist",
      "closed eleven-field allowlist",
      "The provider kind carries five provider-engine error identities",
      "8 park fields; 8 base plus 3 announcement fields",
      "the 11-field allowlist",
    ],
    required: [
      "nine skip reasons",
      "the closed nine-value set",
      "fourteen-field park allowlist",
      "closed seventeen-field allowlist",
      "carries sixteen rows while the engine family's own count stays five",
      "14 park fields; 14 base plus 3 announcement fields",
      "the 17-field allowlist",
      "provider.budget.parked",
      "provider.budget.crossed",
      "`peak-window`, `quota-exhausted`, `budget-exhausted`, `provider-outage`, `credential-missing`, `credential-rejected`",
    ],
  },
];

export const gh350Phase1Violations = (
  rows: readonly GH350Row[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  const declared = rows.map((row) => row.page).sort();
  const expected = [...GH350_PHASE1_PAGES].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    failures.push("GH-350 phase-1 page set is not the declared five");
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

describe("GH-350 the phase-1 count and vocabulary pages state the delivered truth", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the five declared pages are reconciled in both directions", () => {
    expect(gh350Phase1Violations(GH350_PHASE1_ROWS, pageText)).toEqual([]);
  });

  test("a reintroduced outgoing count and a missing new count each fail by name", () => {
    const withStale = (page: string): string | undefined =>
      page === "doc/spec/features/feature-metrics.md"
        ? `${pageText(page) ?? ""}\nthe table holds 164 entries\n`
        : pageText(page);
    expect(gh350Phase1Violations(GH350_PHASE1_ROWS, withStale).join("\n")).toContain(
      "stale phrase present: 164 entries",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/spec/features/feature-provider-engine.md"
        ? (pageText(page) ?? "").replace("nine skip reasons", "eight skip reasons")
        : pageText(page);
    expect(gh350Phase1Violations(GH350_PHASE1_ROWS, missing).join("\n")).toContain(
      "missing required phrase: nine skip reasons",
    );
  });
});

describe("GH-350 the eight decision records are Proposed and indexed", () => {
  const RECORDS = [
    "ADR-0013-zone-aware-peak-windows-iana-zone-resolution.md",
    "PDR-0006-per-project-provider-policy-repository-config-layers.md",
    "TDR-0059-budget-ceilings-park-before-spend-injected-spend-totals.md",
    "TDR-0060-provider-simulate-fixture-and-zero-write-simulation.md",
    "TDR-0061-legacy-provider-profile-and-hook-migration.md",
    "TDR-0062-watch-observation-freshness-and-stale-condition.md",
    "TDR-0063-provider-family-mounting-27th-prompt-required.md",
    "TDR-0064-provider-budget-work-item-ref-source.md",
  ] as const;

  test("each record exists, is Proposed, and has exactly one index row", () => {
    const index = read("doc/decisions/00-index.md");
    for (const file of RECORDS) {
      const text = read(`doc/decisions/${file}`);
      expect(text, file).toContain("status: Proposed");
      expect(index.split(`(${file})`).length - 1, file).toBe(1);
    }
  });

  test("the spec references every record and the index", () => {
    const spec = read("doc/changes/2026-11/2026-11-19--GH-350--provider-policy/chg-GH-350-spec.md");
    for (const id of [
      "ADR-0013",
      "PDR-0006",
      "TDR-0059",
      "TDR-0060",
      "TDR-0061",
      "TDR-0062",
      "TDR-0063",
      "TDR-0064",
    ]) {
      expect(spec, id).toContain(id);
    }
  });
});

/**
 * GH-350 phase 2 — the zone pages state the delivered basis: the declared zone
 * grammar and the `ProviderZonePort`, the one named `peakWindowEndInstantMs`
 * derivation, and the edge refusal. The engine's zone half is this phase's; its
 * budget half is phase 9.
 */
const GH350_PHASE2_ROWS: readonly GH350Row[] = [
  {
    page: "doc/spec/features/feature-provider-engine.md",
    stale: [
      "UTC peak and subscription-quota evaluation",
      "Timezone basis. | `UTC`; only `UTC` is admitted",
      "Non-UTC, empty, out-of-range, and cross-midnight windows fail validation",
      "non-UTC timezones",
    ],
    required: [
      "zone-aware peak and subscription-quota evaluation",
      "Declared zone",
      "IANA zone name",
      "ProviderZonePort",
      "nextTransitionAtOrAfter",
      "peakWindowEndInstantMs(nowMs, zoneFacts, rule)",
      "provider.peak.zone-unknown",
      "transition instant exactly",
      "first occurrence",
    ],
  },
  {
    page: "doc/spec/features/feature-provider-profiles.md",
    stale: ["its UTC peak window", "UTC basis; non-UTC and local-timezone windows are not modeled"],
    required: ["declared-zone peak window", "declared-zone basis", "non-UTC windows are modeled"],
  },
  {
    page: "doc/spec/features/feature-peak-pausing.md",
    stale: ["UTC-only", "only the `UTC` designation validates", "evaluated on the UTC basis only"],
    required: [
      "declared-zone grammar",
      "IANA zone name matching the declared grammar",
      "peakWindowEndInstantMs",
      "provider.peak.zone-unknown",
    ],
  },
  {
    page: "doc/planning/oss-tooling/cli-command-registry.md",
    stale: ["UTC peak windows"],
    required: ["zone-aware peak windows"],
  },
];

describe("GH-350 phase 2 the zone pages state the delivered basis", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };
  const violations = (rows: readonly GH350Row[], text: (page: string) => string | undefined) => {
    const failures: string[] = [];
    for (const row of rows) {
      const content = text(row.page);
      if (content === undefined) {
        failures.push(`${row.page}: page does not exist`);
        continue;
      }
      for (const phrase of row.stale) {
        if (content.includes(phrase)) failures.push(`${row.page}: stale phrase present: ${phrase}`);
      }
      for (const phrase of row.required) {
        if (!content.includes(phrase))
          failures.push(`${row.page}: missing required phrase: ${phrase}`);
      }
    }
    return failures;
  };

  test("the four zone pages carry the delivered basis", () => {
    expect(violations(GH350_PHASE2_ROWS, pageText)).toEqual([]);
  });

  test("a reintroduced UTC-only basis and a missing port phrase each fail by name", () => {
    const stale = (page: string): string | undefined =>
      page === "doc/spec/features/feature-peak-pausing.md"
        ? `${pageText(page) ?? ""}\nevaluated on the UTC basis only\n`
        : pageText(page);
    expect(violations(GH350_PHASE2_ROWS, stale).join("\n")).toContain(
      "stale phrase present: evaluated on the UTC basis only",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/spec/features/feature-provider-engine.md"
        ? (pageText(page) ?? "").replace("nextTransitionAtOrAfter", "offset lookup")
        : pageText(page);
    expect(violations(GH350_PHASE2_ROWS, missing).join("\n")).toContain(
      "missing required phrase: nextTransitionAtOrAfter",
    );
  });
});

/**
 * GH-350 phase 4 — the configuration page completes: the budgets branch table,
 * the widened zone value domain, and the per-repository clause with the
 * precedence matrix, the origin evidence, the `CI=true` posture and the
 * multi-checkout boundary (TC-CFG-011's documentation half).
 *
 * The page's `maxAgeSeconds` row is the seventh phase's, with the key it
 * describes; this row asserts only what phase 4 delivers.
 */
const GH350_PHASE4_ROWS: readonly GH350Row[] = [
  {
    page: "doc/spec/features/feature-config-layer.md",
    stale: [
      "an optional UTC `peak` window",
      "(`provider.credentials`, `provider.entries`, `provider.chains`) use the additive",
    ],
    required: [
      "provider.budgets",
      "`windowSeconds`",
      "required iff `scope` is `window`; refused on `ticket`",
      "an optional `peak` window in a declared IANA zone",
      "Per-repository provider policy",
      "Five layers can declare a provider value",
      "project-local beats project-committed",
      "record maps merge by child name",
      "lists replace whole",
      "`reset` removes inherited descendants",
      "layer=<layer> file=<path> line=<n>",
      "validated before it is merged",
      "`ci-disabled` with no read of it",
      "`--enable-project-local-config`",
      "`selected-config` with no local read",
      "not expressible through these layers",
      "no `provider.projects.*` branch, key, state kind, command, or error identity exists",
      "`config.environment.unmapped`",
      "`config.key.unknown`",
    ],
  },
];

export const gh350Phase4Violations = (
  rows: readonly GH350Row[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
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

describe("GH-350 phase 4 the configuration page states the budgets branch and the per-repository policy", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the declared page carries every delivered statement", () => {
    expect(gh350Phase4Violations(GH350_PHASE4_ROWS, pageText)).toEqual([]);
  });

  test("a reintroduced UTC-only peak window and a dropped boundary sentence each fail by name", () => {
    const stale = (page: string): string | undefined =>
      page === "doc/spec/features/feature-config-layer.md"
        ? `${pageText(page) ?? ""}\n- an optional UTC \`peak\` window\n`
        : pageText(page);
    expect(gh350Phase4Violations(GH350_PHASE4_ROWS, stale).join("\n")).toContain(
      "stale phrase present: an optional UTC `peak` window",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/spec/features/feature-config-layer.md"
        ? (pageText(page) ?? "").replace(
            "not expressible through these layers",
            "expressed through these layers",
          )
        : pageText(page);
    expect(gh350Phase4Violations(GH350_PHASE4_ROWS, missing).join("\n")).toContain(
      "missing required phrase: not expressible through these layers",
    );
  });
});

/**
 * GH-350 phase 6 — the hook guide states the delivered posture: the hook is off
 * the delivery path, the window/quota/budget are declared in configuration, and
 * `provider migrate legacy` is the guided bridge with its refusal posture. The
 * guide names the command as a provider-policy import and keeps it distinct from
 * the M4-S2 namespace migration and the install lifecycle's `--migrate` flag.
 */
const GH350_PHASE6_ROWS: readonly GH350Row[] = [
  {
    page: "doc/guides/zai-peak-hours-hook.md",
    stale: ["It is an opt-in, user-owned executable"],
    required: [
      "off the delivery path",
      "may remain on disk; it is inert",
      "provider migrate legacy",
      "provider.migrate.refused",
      "shell-construct",
      "parameters file only",
      "target-exists",
      "unmapped",
      "PROVIDER_MIGRATE_SOURCE_MAX_BYTES = 65536",
      "PROVIDER_MIGRATE_MAX_SOURCES = 64",
      "provider-policy",
      "M4-S2 namespace migration",
      "install lifecycle's `--migrate` flag",
      "no hook import is implied",
    ],
  },
];

export const gh350Phase6Violations = (
  rows: readonly GH350Row[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
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

describe("GH-350 phase 6 the hook guide states the delivered posture", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the guide carries the migration posture and the three-migration distinction", () => {
    expect(gh350Phase6Violations(GH350_PHASE6_ROWS, pageText)).toEqual([]);
  });

  test("a reintroduced hook-required claim and a dropped distinction each fail by name", () => {
    const stale = (page: string): string | undefined =>
      page === "doc/guides/zai-peak-hours-hook.md"
        ? `${pageText(page) ?? ""}\nIt is an opt-in, user-owned executable that delivers the pause.\n`
        : pageText(page);
    expect(gh350Phase6Violations(GH350_PHASE6_ROWS, stale).join("\n")).toContain(
      "stale phrase present: It is an opt-in, user-owned executable",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/guides/zai-peak-hours-hook.md"
        ? (pageText(page) ?? "").replace("M4-S2 namespace migration", "older migration")
        : pageText(page);
    expect(gh350Phase6Violations(GH350_PHASE6_ROWS, missing).join("\n")).toContain(
      "missing required phrase: M4-S2 namespace migration",
    );
  });
});

/**
 * GH-350 phase 7 — the config-layer page gains its `maxAgeSeconds` row with the
 * key it describes: the bound, the first-stale predicate, the additive view
 * fields, the evidence-bounded park clamp, the watch-only posture, and the
 * policy-side default with no defaults-layer origin.
 */
const GH350_PHASE7_ROWS: readonly GH350Row[] = [
  {
    page: "doc/spec/features/feature-config-layer.md",
    stale: ["a `watch` map keyed by provider name, and optional `envRecord` grammar overrides"],
    required: [
      "provider.profiles.watch.<name>.maxAgeSeconds",
      "positive integer",
      "`900`, applied by the policy that honours the bound",
      "first stale age",
      "`ageSeconds >= maxAgeSeconds`",
      "observedAt + maxAgeSeconds × 1000",
      "when that instant is not strictly in the future, no park is created",
      "`observedAt`, `ageSeconds` and `maxAgeSeconds`",
      "watch-only",
      "no defaults-layer origin",
      "a live reading's age is `0` and it is never stale",
      "no cache, timer, refresher, scheduler, command, or state write",
    ],
  },
];

export const gh350Phase7Violations = (
  rows: readonly GH350Row[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
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

describe("GH-350 phase 7 the config page carries the watch freshness row", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the page states the bound, the predicate, the clamp and the watch-only posture", () => {
    expect(gh350Phase7Violations(GH350_PHASE7_ROWS, pageText)).toEqual([]);
  });

  test("a reintroduced bound-less watch bullet and a dropped clamp sentence each fail by name", () => {
    const stale = (page: string): string | undefined =>
      page === "doc/spec/features/feature-config-layer.md"
        ? `${pageText(page) ?? ""}\na \`watch\` map keyed by provider name, and optional \`envRecord\` grammar overrides\n`
        : pageText(page);
    expect(gh350Phase7Violations(GH350_PHASE7_ROWS, stale).join("\n")).toContain(
      "stale phrase present: a `watch` map keyed by provider name",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/spec/features/feature-config-layer.md"
        ? (pageText(page) ?? "").replace("observedAt + maxAgeSeconds × 1000", "a bound")
        : pageText(page);
    expect(gh350Phase7Violations(GH350_PHASE7_ROWS, missing).join("\n")).toContain(
      "missing required phrase: observedAt + maxAgeSeconds × 1000",
    );
  });
});

/**
 * GH-350 phase 8 — the family mount: the count-bearing pages state
 * twenty-eight families: `loop` twenty-seventh, `provider` last, `install` the twenty-sixth,
 * the reference page carries its required self-description flags and all seven
 * members, and the delivered ordinals are unchanged (TC-MOUNT-009's ordinal
 * half of AC-F8-3).
 *
 * `feature-supervise.md` is never a phase-8 row: its GH-346 row above keeps
 * `stale: "26th family"` / `required: "25th family"` exactly as delivered, and
 * the ordinal guard below reads it as a control.
 */
const GH350_PHASE8_PAGES = [
  "doc/spec/features/feature-cli-entrypoint.md",
  "doc/spec/features/feature-install-lifecycle.md",
  "doc/spec/features/feature-metrics.md",
  "doc/00-index.md",
  "doc/overview/glossary.md",
  "doc/planning/oss-tooling/cli-command-registry.md",
  "doc/planning/oss-tooling/milestones/m1/commands/provider.md",
] as const;

const GH350_PHASE8_ROWS: readonly GH350Row[] = [
  {
    page: "doc/spec/features/feature-cli-entrypoint.md",
    stale: [
      "twenty-six families",
      "twenty-seven families",
      "the twenty-sixth and last prompt-required family",
      "(`config`, `provider`, `db`, `watchdog`)",
    ],
    required: [
      "twenty-eight families",
      "The `loop` family is the twenty-seventh prompt-required family, appended after `install`",
      "The `provider` family is the twenty-eighth and last prompt-required family, appended after `loop`",
      "ProviderComposition",
      "`provider resolve`, `quota`, `parks list`, `profile resolve`, `watch status`, `simulate`, and `migrate legacy`",
      "the twenty-sixth prompt-required family",
    ],
  },
  {
    page: "doc/spec/features/feature-install-lifecycle.md",
    stale: ["exactly 26", "at exactly 26 families", "exactly 27", "at exactly 27 families"],
    required: ["exactly 28", "at exactly 28 families", "the twenty-sixth prompt-required family"],
  },
  {
    page: "doc/spec/features/feature-metrics.md",
    stale: [
      "family count (26)",
      "family count (27)",
      "24-family mount",
      "family-count pins read 24",
    ],
    required: [
      "family count (28)",
      "28-family mount",
      "family-count pins read 28",
      "twenty-fourth prompt-required command family",
    ],
  },
  {
    page: "doc/00-index.md",
    stale: ["twenty-six-family prompt-required set", "twenty-seven-family prompt-required set"],
    required: [
      "twenty-eight-family prompt-required set",
      "the twenty-sixth prompt-required `install` family",
    ],
  },
  {
    page: "doc/overview/glossary.md",
    stale: ["twenty-six families", "twenty-seven families"],
    required: ["twenty-eight families", "`supervise`, `install`, `loop`, and `provider`"],
  },
  {
    page: "doc/planning/oss-tooling/cli-command-registry.md",
    stale: ["Delivered subcommands: `resolve` (one chain decision", "with eight skip reasons"],
    required: [
      "Mounted as the 28th and last prompt-required family",
      "the prompt-required inventory is exactly 28 with `loop` 27th and `provider` last",
      "`simulate --fixture <path>`",
      "`migrate legacy",
      "nine skip reasons",
      "`watch-stale`",
    ],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m1/commands/provider.md",
    stale: ["eight skip reasons", "UTC-only", "no simulation surface"],
    required: [
      "--help",
      "--version",
      "--chain <name>",
      "provider simulate --fixture <path>",
      "provider migrate legacy",
      "watch-stale",
      "provider.peak.zone-unknown",
      "provider.budget.exceeded",
      "provider.migrate.refused",
      "input.value.rejected",
      "the twenty-eighth and last prompt-required command family",
    ],
  },
];

export const gh350Phase8Violations = (
  rows: readonly GH350Row[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  const declared = rows.map((row) => row.page).sort();
  const expected = [...GH350_PHASE8_PAGES].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    failures.push("GH-350 phase-8 page set is not the declared seven");
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

/** The ordinal sites TC-MOUNT-009 reads as controls: no delivered ordinal moves. */
const GH350_ORDINAL_SITES = [
  {
    page: "doc/spec/features/feature-cli-entrypoint.md",
    required: ["the twenty-sixth prompt-required family"],
  },
  {
    page: "doc/spec/features/feature-install-lifecycle.md",
    required: ["`install` is the twenty-sixth prompt-required family"],
  },
  {
    page: "doc/00-index.md",
    required: ["the twenty-sixth prompt-required `install` family"],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/commands/install.md",
    required: ["`install` is the twenty-sixth prompt-required family"],
  },
  {
    page: "doc/spec/features/feature-supervise.md",
    required: ["25th family"],
  },
  {
    page: "doc/spec/features/feature-metrics.md",
    required: ["twenty-fourth prompt-required command family"],
  },
] as const;

/** No page may assign `install` a twenty-seventh ordinal or renumber a family. */
const GH350_RENUMBERED_INSTALL = [
  "`install` is the twenty-seventh",
  "`install` is the twenty-eighth",
  "the twenty-seventh prompt-required `install` family",
  "the twenty-eighth prompt-required `install` family",
  "twenty-seventh prompt-required family `install`",
  "twenty-eighth prompt-required family `install`",
] as const;

export const gh350Phase8OrdinalViolations = (
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  for (const site of GH350_ORDINAL_SITES) {
    const text = pageText(site.page);
    if (text === undefined) {
      failures.push(`${site.page}: page does not exist`);
      continue;
    }
    for (const phrase of site.required) {
      if (!text.includes(phrase))
        failures.push(`${site.page}: missing delivered ordinal: ${phrase}`);
    }
    for (const phrase of GH350_RENUMBERED_INSTALL) {
      if (text.includes(phrase)) failures.push(`${site.page}: renumbered install: ${phrase}`);
    }
  }
  return failures;
};

describe("GH-350 phase 8 the mount pages state the delivered truth", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the seven declared pages carry the mount statements", () => {
    expect(gh350Phase8Violations(GH350_PHASE8_ROWS, pageText)).toEqual([]);
  });

  test("a reintroduced twenty-six-family count and a dropped provider paragraph each fail by name", () => {
    const stale = (page: string): string | undefined =>
      page === "doc/spec/features/feature-cli-entrypoint.md"
        ? `${pageText(page) ?? ""}\nthe entrypoint composes twenty-six families\n`
        : pageText(page);
    expect(gh350Phase8Violations(GH350_PHASE8_ROWS, stale).join("\n")).toContain(
      "stale phrase present: twenty-six families",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/spec/features/feature-cli-entrypoint.md"
        ? (pageText(page) ?? "").replace(
            "The `provider` family is the twenty-eighth and last prompt-required family",
            "The provider family is registered",
          )
        : pageText(page);
    expect(gh350Phase8Violations(GH350_PHASE8_ROWS, missing).join("\n")).toContain(
      "missing required phrase: The `provider` family is the twenty-eighth and last",
    );
  });

  test("the delivered ordinals stay and no page renumbers install", () => {
    expect(gh350Phase8OrdinalViolations(pageText)).toEqual([]);
  });

  test("an over-corrected install ordinal and a moved supervise ordinal each fail by name", () => {
    const renumbered = (page: string): string | undefined =>
      page === "doc/spec/features/feature-install-lifecycle.md"
        ? (pageText(page) ?? "").replace(
            "`install` is the twenty-sixth prompt-required family",
            "`install` is the twenty-seventh prompt-required family",
          )
        : pageText(page);
    expect(gh350Phase8OrdinalViolations(renumbered).join("\n")).toContain(
      "missing delivered ordinal: `install` is the twenty-sixth prompt-required family",
    );
    expect(gh350Phase8OrdinalViolations(renumbered).join("\n")).toContain(
      "renumbered install: `install` is the twenty-seventh",
    );
    const superviseMoved = (page: string): string | undefined =>
      page === "doc/spec/features/feature-supervise.md"
        ? (pageText(page) ?? "").replaceAll("25th family", "26th family")
        : pageText(page);
    expect(gh350Phase8OrdinalViolations(superviseMoved).join("\n")).toContain(
      "missing delivered ordinal: 25th family",
    );
  });
});

/**
 * GH-350 phase 9 — documentation truth and release. The remaining pages state the
 * delivered truth: the engine's budget branch, ref rule, announcement meaning and
 * two added CLI members; the profiles page's freshness bound and watch condition;
 * the spend page's one-basis statement; the metrics page's gate-versus-alarm
 * distinction; the nonfunctional provider row; the operator guides; and the index
 * and M4 planning-pack rows. A page whose change is additive declares a
 * forward-guard stale arm so both directions stay driven.
 */
const GH350_PHASE9_PAGES = [
  "doc/spec/features/feature-provider-engine.md",
  "doc/spec/features/feature-provider-profiles.md",
  "doc/spec/features/feature-spend.md",
  "doc/spec/features/feature-metrics.md",
  "doc/spec/nonfunctional.md",
  "doc/guides/provider-conditions-and-parks.md",
  "doc/guides/opencode-model-configuration.md",
  "doc/00-index.md",
  "doc/planning/oss-tooling/milestones/m4/backlog.md",
  "doc/planning/oss-tooling/milestones/m4/flip-plan.md",
] as const;

const GH350_PHASE9_ROWS: readonly GH350Row[] = [
  {
    page: "doc/spec/features/feature-provider-engine.md",
    stale: [
      "The minimal engine CLI surface is",
      "All three accept the global `--json`",
      "`provider.peak.parked`, `provider.quota.parked`, and `provider.resumed` are informational; every other code is a warning",
      "| Peak window | A UTC interval",
    ],
    required: [
      "### Budget ceilings",
      "provider.budgets.<name>.windowSeconds",
      "required iff `scope` is `window`; refused on `ticket`",
      "exactly one verified, ref-scoped spend-totals read",
      "the read count is one at any budget count",
      "newestAtMs + windowSeconds × 1000",
      "the delivered seam and the same pattern an omitted `spend --ref` uses",
      "the five budget evidence fields",
      "no-paid-escalation rule",
      "blocks paid substitution exactly as a peak park does",
      "one-spawn-increment pre-spawn bound",
      "`provider simulate`",
      "`provider migrate legacy`",
      "prompt-required",
      "and `provider.budget.parked` are informational",
      "`provider.budget.exceeded` asks the operator to raise or clear the ceiling",
    ],
  },
  {
    page: "doc/spec/features/feature-provider-profiles.md",
    stale: [
      "UTC designation, start/end seconds-of-day",
      "only the `UTC` zone designation validates",
      "reports `name`, `condition`, `source` (mapping summary), and `checkedAt` from the injected clock. The read path",
    ],
    required: [
      "a declared `timezone`, `UTC` by default",
      "positive integer with the policy default `900`",
      "closed six-value set",
      "the additive `watch-stale` condition and nothing else",
      "ageSeconds >= maxAgeSeconds",
      "observedAtMs + maxAgeSeconds × 1000",
      "never reports `watch-stale`",
      "additive view fields `observedAt`, `ageSeconds`, and `maxAgeSeconds`",
    ],
  },
  {
    page: "doc/spec/features/feature-spend.md",
    // Additive page: no delivered sentence is retired, so the stale arm guards the
    // claim this change forbids — a second measurement path.
    stale: ["runs its own separate spend read"],
    required: [
      "### The provider budget gate",
      "not a second measurement path",
      "resolves its work-item ref through the same local-context seam",
      "the same pattern an omitted `--ref` uses",
      "One basis, one read, and one set of figures",
    ],
  },
  {
    page: "doc/spec/features/feature-metrics.md",
    // Additive page: the counts moved in phases 1 and 8; phase 9 adds the
    // gate-versus-alarm distinction, whose stale arm forbids conflating them.
    stale: ["a burn-rate alarm parks the lane"],
    required: [
      "The gate-versus-alarm distinction is deliberate",
      "A declared `provider.budgets` ceiling is a gate",
      "A burn-rate alarm is evidence",
      "it never blocks a spawn, parks a lane, or refuses a command",
    ],
  },
  {
    page: "doc/spec/nonfunctional.md",
    stale: [
      "Provider behavior and evidence-bounds suites; these are not end-to-end command deadlines.",
    ],
    required: [
      "at the declared zone's local seconds",
      "a DST gap resolves to the transition instant",
      "exactly one verified ref-scoped spend-totals read at any budget count",
      "Simulation is pure: one bounded fixture read, zero state writes",
      "Legacy migration executes nothing",
      "bounded at 64 sources of 65536 bytes and 2000 lines each",
    ],
  },
  {
    page: "doc/guides/provider-conditions-and-parks.md",
    stale: ["the declared UTC peak interval, extended by its buffer"],
    required: [
      "on its declared zone's clock",
      "`timezone` evidence field",
      "`budget-exhausted` — a declared spend ceiling",
      "The fixed tie order is",
      "## Budget conditions",
      "`provider.budget.parked` is raised at `info`",
      "`provider.budget.crossed` is raised at `warning`",
      "raise or clear the ceiling, or to start a new ticket",
      "blocks paid substitution exactly as a peak park does",
      "ticket-scope crossing fails that one entry",
      "input.value.rejected",
      "at most one spawn increment may land above a ceiling before the next evaluation observes the new records",
      "never a real-time spend stop",
      "## Watch conditions",
      "`watch-stale` is the watch-only freshness condition",
      "ageSeconds >= maxAgeSeconds",
      "observedAtMs + maxAgeSeconds × 1000",
      "no park is created",
      "its age is `0`",
      "provider.profiles.watch.<name>.maxAgeSeconds",
    ],
  },
  {
    page: "doc/guides/opencode-model-configuration.md",
    // Additive pointer: the stale arm guards against a second policy surface.
    stale: ["provider policy lives in the shell profile"],
    required: [
      "### Provider and model policy",
      "typed `provider` and `provider.profiles` branches",
      "The typed profile branch is the canonical path",
    ],
  },
  {
    page: "doc/00-index.md",
    stale: [
      "Provider pauses: condition kinds, park causes and expiry, fail-loud announcements, configuration pointer",
    ],
    required: [
      "the declared-zone basis, condition kinds and park causes, expiry semantics, budget ceilings with their parked-versus-failed split and pre-spawn bound, watch freshness",
    ],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/backlog.md",
    stale: ["### M4-S4 Declarative provider policy\n- Goal"],
    required: [
      "### M4-S4 Declarative provider policy — **delivered (GH-350)**",
      "the twenty-eighth prompt-required family",
      "provider simulate",
      "provider migrate legacy",
    ],
  },
  {
    page: "doc/planning/oss-tooling/milestones/m4/flip-plan.md",
    stale: ["(weekday 06:00-10:00Z today) instead of burning"],
    required: [
      "**F2 evidence pointer (GH-350).**",
      "provider simulate --fixture <path>",
      "twenty-eighth and last prompt-required one",
      "each evaluated on",
      "the mount/reachability/coverage suites, GH-350",
    ],
  },
];

export const gh350Phase9Violations = (
  rows: readonly GH350Row[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  const declared = rows.map((row) => row.page).sort();
  const expected = [...GH350_PHASE9_PAGES].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    failures.push("GH-350 phase-9 page set is not the declared ten");
  }
  for (const row of rows) {
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

/**
 * The closed §16 page set. Twenty-two members resolve to these paths: twelve
 * specification pages, three operator guides, the command registry, the glossary,
 * the M1 provider reference page, the decisions index, `doc/00-index.md`, and the
 * M4 planning pack's two files. `.changeset/install-lifecycle-minor.md` is the
 * conditional member: it is historical record pinned byte-identical by
 * TC-RELEASE-001, so it is asserted separately and never scanned as current truth.
 */
const GH350_CLOSED_PAGE_SET = [
  "doc/spec/features/feature-provider-engine.md",
  "doc/spec/features/feature-provider-profiles.md",
  "doc/spec/features/feature-peak-pausing.md",
  "doc/spec/features/feature-config-layer.md",
  "doc/spec/features/feature-spend.md",
  "doc/spec/features/feature-metrics.md",
  "doc/spec/features/feature-result-contract.md",
  "doc/spec/features/feature-ceremony-runner.md",
  "doc/spec/features/feature-cli-entrypoint.md",
  "doc/spec/features/feature-install-lifecycle.md",
  "doc/spec/features/feature-supervise.md",
  "doc/spec/nonfunctional.md",
  "doc/guides/provider-conditions-and-parks.md",
  "doc/guides/zai-peak-hours-hook.md",
  "doc/guides/opencode-model-configuration.md",
  "doc/planning/oss-tooling/cli-command-registry.md",
  "doc/overview/glossary.md",
  "doc/planning/oss-tooling/milestones/m1/commands/provider.md",
  "doc/decisions/00-index.md",
  "doc/00-index.md",
  "doc/planning/oss-tooling/milestones/m4/backlog.md",
  "doc/planning/oss-tooling/milestones/m4/flip-plan.md",
] as const;

const GH350_CONDITIONAL_CHANGESET = ".changeset/install-lifecycle-minor.md";

/** Declared moves are history, not a current value: they never trip the scan. */
const GH350_DELTA_MOVES = [
  "164 / 163 / 66 / +130 → 167 / 166 / 66 / +133",
  "164/163 → 167/166",
  "164 → 167",
  "163 → 166",
  "26 → 27",
] as const;

const GH350_RETIRED_CLAIMS = [
  "UTC only",
  "UTC-only",
  "non-UTC windows are not modeled",
  "non-UTC windows are out of scope",
  "provider policy depends on shell profiles",
  "provider policy depends on the hook",
  "no simulation surface",
  "watch cannot be stale",
  "hard real-time cap",
  "hard cap on",
  "twenty-six families",
  "the twenty-sixth and last",
  "164 entries",
  "163 delivered rows",
  "BASELINE_ROWS.length + 130",
  "family count (26)",
  "24-family mount",
] as const;

const carveDeclaredMoves = (text: string): string =>
  GH350_DELTA_MOVES.reduce((carved, move) => carved.split(move).join(""), text);

export const gh350RetiredClaimViolations = (
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  for (const page of GH350_CLOSED_PAGE_SET) {
    const text = pageText(page);
    if (text === undefined) {
      failures.push(`${page}: page does not exist`);
      continue;
    }
    const residue = carveDeclaredMoves(text);
    for (const claim of GH350_RETIRED_CLAIMS) {
      if (residue.includes(claim)) failures.push(`${page}: retired claim present: ${claim}`);
    }
  }
  return failures;
};

describe("GH-350 phase 9 the remaining pages and the closed page set state the delivered truth", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the ten declared pages are reconciled in both directions", () => {
    expect(gh350Phase9Violations(GH350_PHASE9_ROWS, pageText)).toEqual([]);
  });

  test("every declared page's stale arm and required arm each fail by name", () => {
    const failures: string[] = [];
    for (const row of GH350_PHASE9_ROWS) {
      const original = pageText(row.page) ?? "";
      for (const phrase of row.stale) {
        const injected = (page: string): string | undefined =>
          page === row.page ? `${original}\n${phrase}\n` : pageText(page);
        const found = gh350Phase9Violations(GH350_PHASE9_ROWS, injected).join("\n");
        if (!found.includes(`stale phrase present: ${phrase}`)) {
          failures.push(`${row.page}: injected stale phrase was not detected: ${phrase}`);
        }
      }
      for (const phrase of row.required) {
        const injected = (page: string): string | undefined =>
          page === row.page ? original.split(phrase).join("") : pageText(page);
        const found = gh350Phase9Violations(GH350_PHASE9_ROWS, injected).join("\n");
        if (!found.includes(`missing required phrase: ${phrase}`)) {
          failures.push(`${row.page}: removed required phrase was not detected: ${phrase}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test("the closed page set carries zero retired claims as current truth", () => {
    expect(gh350RetiredClaimViolations(pageText)).toEqual([]);
  });

  test("each retired claim injected into a closed-set page fails by name", () => {
    const failures: string[] = [];
    const target = "doc/spec/features/feature-provider-engine.md";
    for (const claim of GH350_RETIRED_CLAIMS) {
      const injected = (page: string): string | undefined =>
        page === target ? `${pageText(page) ?? ""}\n${claim}\n` : pageText(page);
      const found = gh350RetiredClaimViolations(injected).join("\n");
      if (!found.includes(`retired claim present: ${claim}`)) {
        failures.push(`injected retired claim was not detected: ${claim}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("a declared move is history and does not trip the retired-claim scan", () => {
    const target = "doc/spec/features/feature-metrics.md";
    const withMoves = (page: string): string | undefined =>
      page === target
        ? `${pageText(page) ?? ""}\n164 → 167\n163 → 166\n26 → 27\n164/163 → 167/166\n164 / 163 / 66 / +130 → 167 / 166 / 66 / +133\n`
        : pageText(page);
    expect(gh350RetiredClaimViolations(withMoves)).toEqual([]);
    const withOutgoingValue = (page: string): string | undefined =>
      page === target ? `${pageText(page) ?? ""}\nfamily count (26)\n` : pageText(page);
    expect(gh350RetiredClaimViolations(withOutgoingValue).join("\n")).toContain(
      "retired claim present: family count (26)",
    );
  });

  test("the closed page set is exactly the declared list", () => {
    expect([...GH350_CLOSED_PAGE_SET].sort()).toEqual(
      [
        "doc/spec/features/feature-provider-engine.md",
        "doc/spec/features/feature-provider-profiles.md",
        "doc/spec/features/feature-peak-pausing.md",
        "doc/spec/features/feature-config-layer.md",
        "doc/spec/features/feature-spend.md",
        "doc/spec/features/feature-metrics.md",
        "doc/spec/features/feature-result-contract.md",
        "doc/spec/features/feature-ceremony-runner.md",
        "doc/spec/features/feature-cli-entrypoint.md",
        "doc/spec/features/feature-install-lifecycle.md",
        "doc/spec/features/feature-supervise.md",
        "doc/spec/nonfunctional.md",
        "doc/guides/provider-conditions-and-parks.md",
        "doc/guides/zai-peak-hours-hook.md",
        "doc/guides/opencode-model-configuration.md",
        "doc/planning/oss-tooling/cli-command-registry.md",
        "doc/overview/glossary.md",
        "doc/planning/oss-tooling/milestones/m1/commands/provider.md",
        "doc/decisions/00-index.md",
        "doc/00-index.md",
        "doc/planning/oss-tooling/milestones/m4/backlog.md",
        "doc/planning/oss-tooling/milestones/m4/flip-plan.md",
      ].sort(),
    );
  });

  test("the conditional changeset is historical record, never rewritten to the new count", () => {
    const path = join(ROOT, GH350_CONDITIONAL_CHANGESET);
    if (!existsSync(path)) {
      // A release consumed it: absence is the assertion, and nothing may be
      // rewritten in its place (the delivered TC-RELEASE-001 guard pins that).
      expect(existsSync(path)).toBe(false);
      return;
    }
    const text = read(GH350_CONDITIONAL_CHANGESET);
    expect(text).toContain("twenty-six prompt-required families");
    expect(text).not.toContain("twenty-seven prompt-required families");
  });

  test("the delivered ordinals stay and the mount pages are not re-corrected", () => {
    expect(gh350Phase8OrdinalViolations(pageText)).toEqual([]);
    expect(GH350_PHASE9_PAGES).not.toContain("doc/spec/features/feature-supervise.md");
  });
});

/**
 * GH-350 review remediation (B3/B4) — the engine page states the delivered zone
 * composition (the production composition supplies the `Intl` binder to the
 * engine as well as the probe and `simulate`, and an unresolvable zone refuses
 * by name), and the result-contract page never restates the provider kind as
 * thirteen rows. A declared count move is history, not a current value, so the
 * carve-out keeps `thirteen rows → sixteen rows` from tripping the stale arm.
 */
const GH350_REVIEW_PAGES = [
  "doc/spec/features/feature-provider-engine.md",
  "doc/spec/features/feature-result-contract.md",
] as const;

const GH350_REVIEW_ROWS: readonly GH350Row[] = [
  {
    page: "doc/spec/features/feature-provider-engine.md",
    stale: [
      "supplies no zone seam",
      "a non-UTC peak declaration refuses `provider.peak.zone-unknown` at `resolve`",
    ],
    required: [
      "the `Intl` zone binder",
      "evaluates on its own zone in `resolve`",
      "`profile resolve` refuses the same identity before probing",
      "explicit `unknownZone`",
      "no production composition mounts a `peakPause` port",
    ],
  },
  {
    page: "doc/spec/features/feature-result-contract.md",
    stale: ["thirteen rows"],
    required: [
      "The provider kind carries sixteen rows",
      "`supervise`, `metrics`, and `install` kinds require an exact code",
    ],
  },
];

/** Declared count moves are history, not a current value: they never trip the scan. */
const GH350_REVIEW_DELTA_MOVES = ["thirteen rows → sixteen rows", "13 rows → 16 rows"] as const;

const carveReviewMoves = (text: string): string =>
  GH350_REVIEW_DELTA_MOVES.reduce((carved, move) => carved.split(move).join(""), text);

export const gh350ReviewViolations = (
  rows: readonly GH350Row[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  const declared = rows.map((row) => row.page).sort();
  const expected = [...GH350_REVIEW_PAGES].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    failures.push("GH-350 review-remediation page set is not the declared two");
  }
  for (const row of rows) {
    if (row.stale.length === 0) failures.push(`${row.page}: no stale phrase declared`);
    if (row.required.length === 0) failures.push(`${row.page}: no required phrase declared`);
    const text = pageText(row.page);
    if (text === undefined) {
      failures.push(`${row.page}: page does not exist`);
      continue;
    }
    const residue = carveReviewMoves(text);
    for (const phrase of row.stale) {
      if (residue.includes(phrase)) failures.push(`${row.page}: stale phrase present: ${phrase}`);
    }
    for (const phrase of row.required) {
      if (!text.includes(phrase)) {
        failures.push(`${row.page}: missing required phrase: ${phrase}`);
      }
    }
  }
  return failures;
};

describe("GH-350 review remediation the zone composition and the provider row count", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the two declared pages state the delivered truth in both directions", () => {
    expect(gh350ReviewViolations(GH350_REVIEW_ROWS, pageText)).toEqual([]);
  });

  test("a reintroduced no-zone-seam sentence and a thirteen-row count each fail by name", () => {
    const staleEngine = (page: string): string | undefined =>
      page === "doc/spec/features/feature-provider-engine.md"
        ? `${pageText(page) ?? ""}\nthe registered engine composition supplies no zone seam\n`
        : pageText(page);
    expect(gh350ReviewViolations(GH350_REVIEW_ROWS, staleEngine).join("\n")).toContain(
      "stale phrase present: supplies no zone seam",
    );
    const staleCount = (page: string): string | undefined =>
      page === "doc/spec/features/feature-result-contract.md"
        ? `${pageText(page) ?? ""}\nThe provider kind carries thirteen rows\n`
        : pageText(page);
    expect(gh350ReviewViolations(GH350_REVIEW_ROWS, staleCount).join("\n")).toContain(
      "stale phrase present: thirteen rows",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/spec/features/feature-provider-engine.md"
        ? (pageText(page) ?? "").replace("explicit `unknownZone`", "closed window")
        : pageText(page);
    expect(gh350ReviewViolations(GH350_REVIEW_ROWS, missing).join("\n")).toContain(
      "missing required phrase: explicit `unknownZone`",
    );
  });

  test("a declared count move is history and does not trip the stale arm", () => {
    const withMoves = (page: string): string | undefined =>
      page === "doc/spec/features/feature-result-contract.md"
        ? `${pageText(page) ?? ""}\nthirteen rows → sixteen rows\n13 rows → 16 rows\n`
        : pageText(page);
    expect(gh350ReviewViolations(GH350_REVIEW_ROWS, withMoves)).toEqual([]);
  });
});

/**
 * GH-350 documentation-truth pin — the pages that state the mount outside the
 * phase-8 page set: the engine page (the family's own page), the board page and
 * GH-348's loop test spec. The delivered truth is 28 families with `loop` 27th
 * and `provider` 28th and last; the 27 forms are stale, and a declared delta
 * line (`27 -> 28`, `27 → 28`) is carved out before the stale check.
 */
const GH350_TRUTH_PAGES = [
  "doc/spec/features/feature-provider-engine.md",
  "doc/spec/features/feature-board.md",
  "doc/quality/test-specs/test-spec-loop-supervision.md",
] as const;

const GH350_TRUTH_ROWS: readonly GH350Row[] = [
  {
    page: "doc/spec/features/feature-provider-engine.md",
    stale: [
      "the twenty-seventh and last prompt-required one",
      "the twenty-seventh and last prompt-required family",
      "the 27-family mount",
    ],
    required: [
      "the twenty-eighth and last prompt-required one, after `loop`",
      "the twenty-eighth and last prompt-required family, after",
      "the 28-family mount",
    ],
  },
  {
    page: "doc/spec/features/feature-board.md",
    stale: ["27-family counts"],
    required: ["28-family counts"],
  },
  {
    page: "doc/quality/test-specs/test-spec-loop-supervision.md",
    stale: ["the prompt-required set at 27 families with `loop` last"],
    required: ["the prompt-required set at 28 families with `provider` last and `loop` 27th"],
  },
];

/** A declared family delta line is history, never a current value. */
const withoutFamilyDeltas = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !/(?:26|27)\s*(?:->|→)\s*(?:27|28)/u.test(line))
    .join("\n");

export const gh350TruthViolations = (
  rows: readonly GH350Row[],
  pageText: (page: string) => string | undefined,
): string[] => {
  const failures: string[] = [];
  const declared = rows.map((row) => row.page).sort();
  const expected = [...GH350_TRUTH_PAGES].sort();
  if (JSON.stringify(declared) !== JSON.stringify(expected)) {
    failures.push("GH-350 truth page set is not the declared three");
  }
  for (const row of rows) {
    if (row.stale.length === 0) failures.push(`${row.page}: no stale phrase declared`);
    if (row.required.length === 0) failures.push(`${row.page}: no required phrase declared`);
    const raw = pageText(row.page);
    if (raw === undefined) {
      failures.push(`${row.page}: page does not exist`);
      continue;
    }
    const text = withoutFamilyDeltas(raw);
    for (const phrase of row.stale) {
      if (text.includes(phrase)) failures.push(`${row.page}: stale phrase present: ${phrase}`);
    }
    for (const phrase of row.required) {
      if (!text.includes(phrase)) failures.push(`${row.page}: missing required phrase: ${phrase}`);
    }
  }
  return failures;
};

describe("GH-350 documentation truth: the mount pages state 28 families", () => {
  const pageText = (page: string): string | undefined => {
    try {
      return read(page);
    } catch {
      return undefined;
    }
  };

  test("the three declared pages state the 28-family truth", () => {
    expect(gh350TruthViolations(GH350_TRUTH_ROWS, pageText)).toEqual([]);
  });

  test("a reintroduced 27 form and a missing 28 form each fail by name", () => {
    const stale = (page: string): string | undefined =>
      page === "doc/spec/features/feature-board.md"
        ? `${pageText(page) ?? ""}\nthe 27-family counts\n`
        : pageText(page);
    expect(gh350TruthViolations(GH350_TRUTH_ROWS, stale).join("\n")).toContain(
      "stale phrase present: 27-family counts",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/spec/features/feature-provider-engine.md"
        ? (pageText(page) ?? "").replace("the 28-family mount", "the current mount")
        : pageText(page);
    expect(gh350TruthViolations(GH350_TRUTH_ROWS, missing).join("\n")).toContain(
      "missing required phrase: the 28-family mount",
    );
  });

  test("a declared family delta line is carved out of the stale arm", () => {
    const withDelta = (page: string): string | undefined =>
      page === "doc/spec/features/feature-board.md"
        ? `${pageText(page) ?? ""}\nthe 27-family counts move 27 -> 28\n`
        : pageText(page);
    expect(gh350TruthViolations(GH350_TRUTH_ROWS, withDelta)).toEqual([]);
  });
});

/* ------------------------------------------------------------------------- *
 * GH-374 — this repository's adopted provider policy.
 *
 * A CLOSED block beside the delivered GH-242/GH-350 blocks: required/stale
 * phrase pairs at every site that states the fact (the three edited guides plus
 * the named profiles-page sentence), the marker assertions, BOTH-DIRECTIONS
 * arms over injected copies, and a delta carve-out so a line recording the
 * change never trips the stale direction.
 * ------------------------------------------------------------------------- */

type Gh374Row = {
  readonly page: string;
  readonly required: readonly string[];
  readonly stale: readonly string[];
};

const GH374_TRUTH_ROWS: readonly Gh374Row[] = [
  {
    page: "doc/guides/provider-conditions-and-parks.md",
    required: [
      "This repository declares its policy in the committed configuration document",
      "mixed base profile `delivery` serves both providers",
      "`subscription-first` walks the subscription entry first and allows the declared paid fallback",
      "`subscription-only` is the never-pay chain",
      "closes admission **every day** from 01:00 to 10:00 UTC",
      "the subscription's buffered peak `[04:00, 10:00)` plus the paid rail's `01:00–10:00` union window",
      "trailing-day cost ceiling of 20 **parks**",
      "per-ticket cost ceiling of 30 **stops** the delivery with a classified refusal and cannot reopen",
      "The subscription quota windows and the DeepSeek balance floor",
      "The synchronous probe reads **no live quota or balance**; live verification belongs to the daemon path.",
      "only newly closed **time-of-day interval** is exactly 04:00–06:00 UTC",
      "weekends and the Chinese public holidays",
    ],
    stale: [
      "not declared yet",
      "pauses only 04:00–10:00",
      "the hook decides when delivery waits",
      "a ticket ceiling parks",
      "weekday-only peak",
    ],
  },
  {
    page: "doc/guides/opencode-model-configuration.md",
    required: [
      "The typed `provider` and `provider.profiles` branches are the canonical routing path for this repository",
      "this repository's seats and models are committed in `.delivery-os/config.yaml`",
      "The per-agent table above is harness assignment",
      "No provider/model identifier belongs in an agent prompt or command definition",
      "neutral `<provider>/<model>` placeholders",
      "its generated Claude Code counterpart was rebuilt from that source",
    ],
    stale: [
      "model choice is only an OpenCode-config concern",
      "a model literal belongs in an agent prompt",
      "provider policy is undeclared",
    ],
  },
  {
    page: "doc/guides/zai-peak-hours-hook.md",
    required: [
      "the hook is off this repository's delivery path",
      "this repository installs no pre-iteration hook and does not source a legacy shell profile",
      "reached only by the retained shell fallbacks",
      "the window, quota, and ceiling policy is committed configuration",
      "The hook example remains for other adopters who still choose",
      "invoking an opt-in hook is a fallback of the shell entry points",
      "They are not this repository's delivery procedure",
    ],
    stale: [
      "the pre-iteration hook decides",
      "run the install one-liner to enable peak pausing for this repository",
      "the hook decides when delivery waits",
    ],
  },
  {
    page: "doc/spec/features/feature-provider-profiles.md",
    required: [
      "Profile `peakWindows` are daemon lane-watch rule data: they drive the in-flight lane watch and do not participate in profile eligibility or admission; admission is gated by each provider entry's declared peak",
    ],
    stale: [
      "These rules drive both the admission gating below and the daemon's lane-level peak pausing",
      "profile peakWindows drive the admission gating",
    ],
  },
];

/** The CLOSED page set for the retired-claim scan (DOC-005). */
const GH374_CLOSED_PAGE_SET = [
  "doc/guides/provider-conditions-and-parks.md",
  "doc/guides/opencode-model-configuration.md",
  "doc/guides/zai-peak-hours-hook.md",
  "doc/spec/features/feature-provider-profiles.md",
  "doc/00-index.md",
  "doc/spec/features/feature-provider-engine.md",
  "doc/spec/features/feature-peak-pausing.md",
  "doc/spec/features/feature-config-layer.md",
] as const;

/** Every retired claim the closed page set must not state. */
const GH374_RETIRED_CLAIMS = [
  "not declared yet",
  "provider policy is undeclared",
  "the hook decides when delivery waits",
  "the pre-iteration hook decides",
  "a ticket ceiling parks",
  "the ticket ceiling parks",
  "weekday-only peak",
  "weekdays only",
  "profile peakWindows drive the admission gating",
  "a model literal belongs in an agent prompt",
  "model choice is only an OpenCode-config concern",
  "pauses only 04:00–10:00",
] as const;

/** A line recording the change is a delta, never a stale claim. */
const GH374_DELTA_MARKERS = [
  "04:00–10:00 → 01:00–10:00",
  "04:00–10:00 -> 01:00–10:00",
  "hook → configuration",
  "hook -> configuration",
  "admission gating → lane-watch rule data",
] as const;

const withoutGh374Deltas = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !GH374_DELTA_MARKERS.some((marker) => line.includes(marker)))
    .join("\n");

const gh374PageText = (page: string): string | undefined => {
  try {
    return read(page);
  } catch {
    return undefined;
  }
};

/** Prose wraps; a declared phrase is compared over flattened whitespace. */
const flatten = (text: string): string => text.replace(/\s+/gu, " ");

const gh374Violations = (pageText: (page: string) => string | undefined): readonly string[] => {
  const failures: string[] = [];
  for (const row of GH374_TRUTH_ROWS) {
    const text = pageText(row.page);
    if (text === undefined) {
      failures.push(`${row.page}: page does not exist`);
      continue;
    }
    const scannable = flatten(withoutGh374Deltas(text));
    for (const phrase of row.stale) {
      if (scannable.includes(flatten(phrase))) {
        failures.push(`${row.page}: stale phrase present: ${phrase}`);
      }
    }
    for (const phrase of row.required) {
      if (!scannable.includes(flatten(phrase))) {
        failures.push(`${row.page}: missing required phrase: ${phrase}`);
      }
    }
  }
  for (const page of GH374_CLOSED_PAGE_SET) {
    const text = pageText(page);
    if (text === undefined) {
      failures.push(`${page}: page does not exist`);
      continue;
    }
    const scannable = flatten(withoutGh374Deltas(text));
    for (const claim of GH374_RETIRED_CLAIMS) {
      if (scannable.includes(flatten(claim))) {
        failures.push(`${page}: retired claim present: ${claim}`);
      }
    }
  }
  return failures;
};

/** The `ados_distribution` marker inside the file's one front-matter block. */
const distributionOf = (page: string): string | undefined => {
  const text = gh374PageText(page);
  if (text === undefined) return undefined;
  const match = /^---\n([\s\S]*?)\n---/u.exec(text);
  if (match?.[1] === undefined) return undefined;
  const line = match[1]
    .split("\n")
    .find((entry) => entry.trimStart().startsWith("ados_distribution:"));
  return line?.split(":").slice(1).join(":").trim();
};

describe("GH-374 documentation truth: this repository's adopted policy", () => {
  test("the four pages state the required sentences and none of the retired ones", () => {
    expect(gh374Violations(gh374PageText)).toEqual([]);
    expect(GH374_TRUTH_ROWS.map((row) => row.page)).toEqual([
      "doc/guides/provider-conditions-and-parks.md",
      "doc/guides/opencode-model-configuration.md",
      "doc/guides/zai-peak-hours-hook.md",
      "doc/spec/features/feature-provider-profiles.md",
    ]);
    expect(GH374_CLOSED_PAGE_SET).toHaveLength(8);
    expect(GH374_RETIRED_CLAIMS.length).toBeGreaterThanOrEqual(12);
  });

  test("the marker assertions: three guides redistributable, the spec page internal", () => {
    expect(distributionOf("doc/guides/provider-conditions-and-parks.md")).toBe("redistributable");
    expect(distributionOf("doc/guides/opencode-model-configuration.md")).toBe("redistributable");
    expect(distributionOf("doc/guides/zai-peak-hours-hook.md")).toBe("redistributable");
    expect(distributionOf("doc/spec/features/feature-provider-profiles.md")).toBe("internal");
  });

  test("both directions fail by name: a kept stale sentence and a missing required one", () => {
    const stale = (page: string): string | undefined =>
      page === "doc/spec/features/feature-provider-profiles.md"
        ? `${gh374PageText(page) ?? ""}\nThese rules drive both the admission gating below and the daemon's lane-level peak pausing\n`
        : gh374PageText(page);
    expect(gh374Violations(stale).join("\n")).toContain(
      "stale phrase present: These rules drive both the admission gating below",
    );
    const missing = (page: string): string | undefined =>
      page === "doc/guides/opencode-model-configuration.md"
        ? (gh374PageText(page) ?? "").replace(
            "No provider/model identifier belongs in an agent prompt or command definition",
            "Keep model names out of prompts",
          )
        : gh374PageText(page);
    expect(gh374Violations(missing).join("\n")).toContain(
      "missing required phrase: No provider/model identifier belongs in an agent prompt or command definition",
    );
    const retired = (page: string): string | undefined =>
      page === "doc/00-index.md"
        ? `${gh374PageText(page) ?? ""}\nThe operator guide's provider policy is undeclared\n`
        : gh374PageText(page);
    expect(gh374Violations(retired).join("\n")).toContain(
      "retired claim present: provider policy is undeclared",
    );
  });

  test("a delta line recording the change never trips the stale direction", () => {
    const withDelta = (page: string): string | undefined =>
      page === "doc/guides/provider-conditions-and-parks.md"
        ? `${gh374PageText(page) ?? ""}\n- admission window: 04:00–10:00 → 01:00–10:00 (the union window)\n- routing: hook → configuration\n- profiles page: admission gating → lane-watch rule data\n`
        : gh374PageText(page);
    expect(gh374Violations(withDelta)).toEqual([]);
  });
});
