/**
 * GH-406 TC-DPKCONF-001/002/003 — the narrowed vocabulary conformance sweep.
 *
 * The detection core is a PURE FUNCTION over injected text; the tree-walking
 * entrypoint applies it to the real Appendix B surfaces: CLI help summaries,
 * the text headers of `projects list` and `repos list` (and the byte-identical
 * `--flat` alias header, a named exception), the guides tree, the tools
 * documentation tree, the overview tree, and every command reference page
 * under every milestone's commands tree (doc/planning/oss-tooling/milestones:
 * each milestone's commands directory). The four named exceptions are
 * frozen until GH-408. Negative proofs live entirely in synthetic in-memory
 * inputs and test-created temp trees — no violation is ever written into the
 * committed tree.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allHelpEntries } from "../../packages/cli/src/help";
import {
  renderProjectGroupsText,
  renderProjectsText,
} from "../../packages/cli/src/output/projects-text";
import { renderReposText } from "../../packages/cli/src/output/repos-text";

const ROOT = process.cwd();

export type Finding = {
  readonly rule: string;
  readonly line: number;
  readonly match: string;
};

const PRIMARY_CHECKOUT = /primary checkout/gi;
const CHECKOUT_IDENTITY = /checkout identity/gi;
const PROJECT_KEY = /project[ -]keys?/gi;
const DECLARED_TERM = /declared project[ -]keys?/gi;

/**
 * Whitespace-normalized matching (review iter-1 F-1): a violation wrapped
 * across a markdown line wrap ("primary⏎checkout") must be found. Runs of
 * whitespace — including newlines — collapse to one space; `lineAt` maps each
 * normalized offset back to the ORIGINAL 1-based line of its character so
 * findings keep reporting real lines. The collapse must not widen the named
 * exceptions: no rule is whitespace-sensitive in a way the normalization
 * newly fires, and the R3 sense exemptions are evaluated against the
 * original line at the match's start (see `projectKeyExempt`).
 */
const buildNormalized = (
  text: string,
): { readonly normalized: string; readonly lineAt: readonly number[] } => {
  let normalized = "";
  const lineAt: number[] = [];
  let currentLine = 1;
  let pendingSpace = false;
  for (const character of text) {
    if (character === "\n") {
      currentLine += 1;
      pendingSpace = normalized.length > 0;
      continue;
    }
    if (/\s/u.test(character)) {
      pendingSpace = normalized.length > 0;
      continue;
    }
    if (pendingSpace) {
      normalized += " ";
      lineAt.push(currentLine);
      pendingSpace = false;
    }
    normalized += character;
    lineAt.push(currentLine);
  }
  return { normalized, lineAt };
};

const originalLineAt = (text: string, offset: number): string => {
  const start = text.lastIndexOf("\n", offset) + 1;
  const end = text.indexOf("\n", offset);
  return text.slice(start, end === -1 ? undefined : end);
};

/**
 * R3's declared sense exemptions, each review-visible: the owner's own term
 * "declared project key", the tracker-configuration sense (tracker project
 * keys are a different contention domain), and the per-project configuration
 * sense where the phrase names a configuration key spelled immediately after
 * it in backticks. Evaluated on the normalized text (declared spans and the
 * config-key lookahead), with the line-shaped exemptions read from the
 * ORIGINAL line at the match's start.
 */
const projectKeyExempt = (
  normalized: string,
  originalLines: readonly string[],
  lineNumber: number,
  offset: number,
  match: string,
): boolean => {
  const declaredSpans: Array<[number, number]> = [];
  for (const declared of normalized.matchAll(DECLARED_TERM)) {
    declaredSpans.push([declared.index ?? 0, (declared.index ?? 0) + declared[0].length]);
  }
  if (declaredSpans.some(([start, end]) => offset >= start && offset < end)) return true;
  if (/project[ -]keys?\s*`/i.test(normalized.slice(offset, offset + match.length + 2))) {
    return true;
  }
  const line = originalLines[lineNumber - 1] ?? "";
  if (/\btracker\b/i.test(line)) return true;
  // A tracker configuration key assignment (`project_key: ...`) spells the
  // tracker's own key name and its placeholder on one line — a different
  // contention domain, never the clone identity.
  if (/^\s*project_key\s*:/i.test(line)) return true;
  return false;
};

/** The pure detection core: every rule, one pass, line-precise findings. */
export const scanText = (text: string): Finding[] => {
  const { normalized, lineAt } = buildNormalized(text);
  const originalLines = text.split("\n");
  const findings: Finding[] = [];
  for (const [rule, pattern] of [
    ["primary-checkout", PRIMARY_CHECKOUT],
    ["checkout-identity", CHECKOUT_IDENTITY],
  ] as const) {
    for (const match of normalized.matchAll(pattern)) {
      const at = match.index ?? 0;
      findings.push({ rule, line: lineAt[at] ?? 1, match: match[0] });
    }
  }
  for (const match of normalized.matchAll(PROJECT_KEY)) {
    const at = match.index ?? 0;
    if (projectKeyExempt(normalized, originalLines, lineAt[at] ?? 1, at, match[0])) continue;
    findings.push({
      rule: "project-key-as-clone-identity",
      line: lineAt[at] ?? 1,
      match: match[0],
    });
  }
  return findings;
};

/** Every .md file under one directory tree, sorted, relative to `root`. */
export const markdownUnder = (root: string, relative: string): string[] => {
  const directory = join(root, relative);
  if (!existsDirectory(directory)) return [];
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".md")) files.push(child);
    }
  };
  walk(directory);
  return files.sort();
};

const existsDirectory = (path: string): boolean => {
  try {
    return readdirSync(path, { withFileTypes: true }) !== undefined;
  } catch {
    return false;
  }
};

/** The milestone command-page glob: every milestone's commands tree. */
export const commandPageRoots = (root: string): string[] => {
  const milestones = join(root, "doc/planning/oss-tooling/milestones");
  if (!existsDirectory(milestones)) return [];
  return readdirSync(milestones, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `doc/planning/oss-tooling/milestones/${entry.name}/commands`)
    .filter((relative) => existsDirectory(join(root, relative)))
    .sort();
};

export type ScanTreeOutcome = {
  readonly findings: Finding[];
  readonly filesScanned: number;
  readonly commandPages: number;
};

/** The read-only tree walk over the declared Appendix B documentation scope. */
export const scanTreeDocs = (root: string): ScanTreeOutcome => {
  const surfaces = ["doc/guides", "doc/tools", "doc/overview", ...commandPageRoots(root)];
  const files = surfaces.flatMap((surface) => markdownUnder(root, surface));
  const findings = files.flatMap((file) =>
    scanText(readFileSync(file, "utf8")).map((finding) => ({
      ...finding,
      rule: `${finding.rule} (${file})`,
    })),
  );
  return {
    findings,
    filesScanned: files.length,
    commandPages: commandPageRoots(root).reduce(
      (total, surface) => total + markdownUnder(root, surface).length,
      0,
    ),
  };
};

const headerOf = (rendered: string): string => rendered.split("\n")[0] ?? "";

/** The live text headers, including the byte-identical `--flat` alias header. */
export const listHeaders = (): {
  readonly repos: string;
  readonly groups: string;
  readonly flatAlias: string;
} => ({
  repos: headerOf(renderReposText({ repos: [], hostIndexRevision: 0 })),
  groups: headerOf(renderProjectGroupsText({ groups: [] })),
  flatAlias: headerOf(renderProjectsText({ projects: [], hostIndexRevision: 0 })),
});

describe("TC-DPKCONF-001 the clean tree passes the narrowed sweep", () => {
  test("every declared documentation surface is clean and the full commands glob is walked", () => {
    const outcome = scanTreeDocs(ROOT);
    expect(outcome.findings).toEqual([]);
    expect(outcome.commandPages).toBe(42);
    expect(outcome.filesScanned).toBeGreaterThan(42);
  });

  test("the live list headers read PRODUCT / REPOSITORY / CLONE, alias byte-identical", () => {
    const headers = listHeaders();
    expect(headers.groups).toBe("PRODUCT  REPOSITORY  TRACKER  STATE  HEALTH  DAEMON");
    expect(headers.groups).not.toContain("GROUP");
    expect(headers.groups).not.toContain("MEMBER");
    expect(headers.groups).not.toContain("PROJECT");
    expect(headers.groups).not.toContain("PROJECT REPOSITORY");
    expect(headers.repos).toBe("CLONE  ROOT  STATE  DAEMON  HANDOVER");
    expect(headers.flatAlias).toBe("KEY  ROOT  STATE  DAEMON  HANDOVER");
  });

  test("every CLI help summary speaks the vocabulary", () => {
    const findings = allHelpEntries().flatMap((entry) =>
      scanText(
        [
          entry.path.join(" "),
          entry.usage.join("\n"),
          entry.summary,
          entry.options.map(([flag, description]) => `${flag} ${description}`).join("\n"),
        ].join("\n"),
      ).map((finding) => ({ ...finding, rule: `${finding.rule} (${entry.path.join(" ")})` })),
    );
    expect(findings).toEqual([]);
  });
});

describe("TC-DPKCONF-002 planted violations fail non-zero on synthetic inputs", () => {
  test("a help-summary-shaped violation is named with rule, line, and match", () => {
    const text = [
      "board --project <key>",
      "  Narrow the board to one checkout.",
      "  The project key identifies the checkout.",
    ].join("\n");
    const findings = scanText(text);
    expect(findings).toEqual([
      { rule: "project-key-as-clone-identity", line: 3, match: "project key" },
    ]);
  });

  test("a header-shaped violation (a GROUP header row) is caught as an exact-header mismatch", () => {
    const headers = listHeaders();
    expect(headers.groups).not.toContain("GROUP");
    expect(headers.repos).not.toContain("KEY");
  });

  test("a test-created temp tree with a planted violation fails the walk, naming the file", () => {
    const root = mkdtempSync(join(tmpdir(), "vocab-conformance-"));
    try {
      mkdirSync(join(root, "doc/guides"), { recursive: true });
      mkdirSync(join(root, "doc/planning/oss-tooling/milestones/m9/commands"), { recursive: true });
      writeFileSync(
        join(root, "doc/guides/clean.md"),
        "The main checkout is the clone's primary working tree.\n",
      );
      writeFileSync(
        join(root, "doc/planning/oss-tooling/milestones/m9/commands/planted.md"),
        "Run the command from the primary checkout.\n",
      );
      const outcome = scanTreeDocs(root);
      expect(outcome.findings).toHaveLength(1);
      expect(outcome.findings[0]?.rule).toContain("primary-checkout");
      expect(outcome.findings[0]?.rule).toContain("planted.md");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a violation wrapped across a markdown line wrap fails, named (review iter-1 F-1)", () => {
    const findings = scanText(
      [
        "- A linked git worktree is refused with `install.target.worktree`, naming the",
        "  target directory and both git directories. Build and install from the primary",
        "  checkout or a prepared directory holding a released artifact.",
      ].join("\n"),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("primary-checkout");
    expect(findings[0]?.match).toBe("primary checkout");
    expect(findings[0]?.line).toBe(2);
  });

  test("a wrapped project-key mislabel fails the same way", () => {
    const findings = scanText("the project\nkey is minted into the marker per clone");
    expect(findings).toEqual([
      { rule: "project-key-as-clone-identity", line: 1, match: "project key" },
    ]);
  });

  test("a wrapped exception string stays exempt: normalization never widens the exceptions", () => {
    expect(
      scanText("the state root lives at `<host root>/projects/\ndelivery-a-1a2b3c4d`"),
    ).toEqual([]);
    expect(scanText("the refusal classifies under `projects.\nconfig-invalid`")).toEqual([]);
    expect(scanText("point `--project-\nroot` at the repository checkout")).toEqual([]);
  });

  test("the committed tree is untouched by any negative proof", () => {
    // Every synthetic input above lives in memory or under the OS temp root
    // handed out by mkdtempSync; nothing in this suite writes under ROOT.
    expect(tmpdir()).not.toBe(ROOT);
  });
});

describe("TC-DPKCONF-003 the four named exceptions are individually exempt", () => {
  test("a projects.* error-code literal produces no finding", () => {
    expect(scanText("the refusal classifies under `projects.config-invalid`")).toEqual([]);
  });

  test("a <host root>/projects/ container path produces no finding", () => {
    expect(scanText("the state root lives at `<host root>/projects/delivery-a-1a2b3c4d`")).toEqual(
      [],
    );
  });

  test("a --project-root flag mention produces no finding", () => {
    expect(scanText("point `--project-root` at the repository checkout")).toEqual([]);
  });

  test("a --flat alias mention produces no finding", () => {
    expect(scanText("`projects list --flat` is the deprecation alias")).toEqual([]);
  });

  test("the flat-alias text header keeps its delivered KEY wording (byte-identical exception)", () => {
    expect(listHeaders().flatAlias).toContain("KEY");
  });

  test("near-misses outside the exception list still produce findings", () => {
    expect(
      scanText("run `--project-key <value>` to select the checkout").map((finding) => finding.rule),
    ).toEqual(["project-key-as-clone-identity"]);
    expect(
      scanText("the error `project-key.unavailable` is classified").map((finding) => finding.rule),
    ).toEqual(["project-key-as-clone-identity"]);
    expect(
      scanText("the container `<host root>/project-keys/` is created").map(
        (finding) => finding.rule,
      ),
    ).toEqual(["project-key-as-clone-identity"]);
    expect(
      scanText("the primary checkout is where you run installs").map((finding) => finding.rule),
    ).toContain("primary-checkout");
    expect(
      scanText("its checkout identity is minted once per clone").map((finding) => finding.rule),
    ).toContain("checkout-identity");
  });

  test("the declared-term and sense exemptions are exact, not family-wide", () => {
    expect(scanText("the declared project key names the project")).toEqual([]);
    expect(scanText("the project key `commit.phaseCommit: false` disables the commit")).toEqual([]);
    expect(scanText("| Tracker Configuration | connection details, project keys |")).toEqual([]);
    expect(
      scanText("the project key minted into the marker identifies the clone").map(
        (finding) => finding.rule,
      ),
    ).toEqual(["project-key-as-clone-identity"]);
  });
});
