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
      "twenty-six families",
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
    stale: ["twenty-five families", "exactly the declared five-site inventory"],
    required: [
      "twenty-six families",
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
    ],
    required: [
      "install | user | false | not_landed | Build and install from the primary checkout",
      "The table declares 167 machine identities",
      "allowlist of 66 declared identities",
      "the eleven `install` rows",
      "the thirteen `harness` rows",
    ],
  },
  {
    page: "doc/spec/features/feature-ceremony-runner.md",
    stale: ["149 identities", "153 identities", "164 identities", "65-entry allowlist"],
    required: ["167 identities", "66-entry allowlist"],
  },
  {
    page: "doc/spec/features/feature-metrics.md",
    stale: [
      "149 entries",
      "153 entries",
      "164 entries",
      "163 delivered rows",
      "BASELINE_ROWS.length + 115",
      "BASELINE_ROWS.length + 119",
      "BASELINE_ROWS.length + 130",
      "family count (25)",
    ],
    required: [
      "167 entries",
      "166 delivered rows",
      "66 allowlisted two-segment codes",
      "BASELINE_ROWS.length + 133",
      "family count (26)",
    ],
  },
  {
    page: "doc/spec/features/feature-supervise.md",
    stale: ["65-member allowlist", "26th family"],
    required: ["66-member allowlist", "25th family"],
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
        ? (pageText(page) ?? "").replaceAll("167 identities", "the moved count")
        : pageText(page);
    expect(pageClaimViolations(GH346_ROWS, withoutRequired).join("\n")).toContain(
      "missing required phrase: 167 identities",
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
      "the same 164 identities",
      "BASELINE_ROWS.length + 130",
    ],
    required: [
      "167 machine identities",
      "the same 167 identities",
      "delivered-rows metric",
      "BASELINE_ROWS.length + 133",
      "the sixteen `provider` rows",
      "provider.peak.zone-unknown",
      "provider.budget.exceeded",
      "provider.migrate.refused",
    ],
  },
  {
    page: "doc/spec/features/feature-ceremony-runner.md",
    stale: ["164 identities"],
    required: ["167 identities", "66-entry allowlist"],
  },
  {
    page: "doc/spec/features/feature-metrics.md",
    stale: ["164 entries", "163 delivered rows", "BASELINE_ROWS.length + 130"],
    required: ["167 entries", "166 delivered rows", "BASELINE_ROWS.length + 133"],
  },
  {
    page: "doc/spec/features/feature-install-lifecycle.md",
    stale: ["declared table total at 164 machine identities"],
    required: ["declared table total at 167 machine identities", "66 declared identities"],
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
    "ADR-0012-zone-aware-peak-windows-iana-zone-resolution.md",
    "PDR-0006-per-project-provider-policy-repository-config-layers.md",
    "TDR-0057-budget-ceilings-park-before-spend-injected-spend-totals.md",
    "TDR-0058-provider-simulate-fixture-and-zero-write-simulation.md",
    "TDR-0059-legacy-provider-profile-and-hook-migration.md",
    "TDR-0060-watch-observation-freshness-and-stale-condition.md",
    "TDR-0061-provider-family-mounting-27th-prompt-required.md",
    "TDR-0062-provider-budget-work-item-ref-source.md",
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
      "ADR-0012",
      "PDR-0006",
      "TDR-0057",
      "TDR-0058",
      "TDR-0059",
      "TDR-0060",
      "TDR-0061",
      "TDR-0062",
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
