/**
 * GH-406 F-7 / TC-DPKNAM-001/002 — the new-code naming rule.
 *
 * A SOURCE FILE that did not exist at the committed base constant
 * (`scripts/checks/new-code-naming.baseline.json` `baseCommit`) may not contain
 * the bare token `projectKey` unless a committed baseline entry covers it. The
 * governed surface is the declared SOURCE-FILE set only — TypeScript under
 * `packages/**`, `tests/**`, and `scripts/checks/**` (`.ts` plus `.tsx` where
 * present). Markdown, JSON, YAML, config, generated trees, and `tmp/**` are
 * never swept: change artifacts legitimately quote the token in prose.
 *
 * Pre-base files are exempt and no per-file counts are consulted for them: the
 * rule is file-existence-at-the-pinned-base based, so it stays a legal
 * permanent invariant after merge. Every baseline entry carries a non-empty
 * reason and is review-visible. The core accepts injected file/baseline inputs
 * (test seam) so mutation cases need no repository writes, and the real-tree
 * scan is read-only over the working tree and local git history.
 *
 * The pinned base is re-pointed only deliberately, through review, by changing
 * the baseline's `baseCommit` and the exported constant together; an
 * unreachable base fails closed.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const BASELINE_PATH = "scripts/checks/new-code-naming.baseline.json";
export const SCHEMA_VERSION = "new-code-naming.baseline.v1";

/**
 * The committed base constant (GH-406 base 22b15d31). The check asserts
 * tree-vs-pinned-base — a legal permanent invariant — never a moving-base
 * diff. Keep in deliberate review-visible lockstep with the baseline's
 * `baseCommit` field.
 */
export const BASE_COMMIT = "22b15d31bae27ce3d6b9295437936580fb9dc7e2";

/**
 * The forbidden bare token. This check module is itself post-base, so its own
 * literal is covered by the first baseline entry (the check must be able to
 * spell the token it refuses).
 */
export const TOKEN = "projectKey";

/** The declared SOURCE-FILE scan roots (docs, JSON, YAML are never swept). */
export const SURFACE_ROOTS = ["packages", "tests", "scripts/checks"] as const;

/** The swept extensions: TypeScript source files only. */
export const SURFACE_EXTENSIONS = [".ts", ".tsx"] as const;

/** Path segments never swept even when git lists them. */
const SKIP_SEGMENTS = new Set(["node_modules", "dist", "tmp"]);

export type NamingBaselineEntry = {
  readonly path: string;
  readonly reason: string;
};

export type NamingBaseline = {
  readonly schemaVersion: string;
  readonly baseCommit: string;
  readonly token: string;
  readonly entries: readonly NamingBaselineEntry[];
};

export type NamingSourceFile = {
  readonly path: string;
  readonly text: string;
};

export type NamingInput = {
  /** Paths present at the pinned base commit; exempt, no counts consulted. */
  readonly baseFiles: ReadonlySet<string>;
  readonly baseline: NamingBaseline;
  readonly files: readonly NamingSourceFile[];
};

export type NamingViolation = {
  readonly file: string;
  readonly line: number;
};

export type NamingOutcome = {
  readonly failures: readonly string[];
  readonly violations: readonly NamingViolation[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isFullSha = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{40}$/.test(value);

/** Whether a relative path sits on the declared SOURCE-FILE surface. */
export const isGovernedPath = (path: string): boolean => {
  if (!SURFACE_EXTENSIONS.some((extension) => path.endsWith(extension))) return false;
  if (path.split("/").some((segment) => SKIP_SEGMENTS.has(segment))) return false;
  return SURFACE_ROOTS.some((root) => path.startsWith(`${root}/`));
};

/** Identifier characters that make a token occurrence non-bare on either side. */
const isTokenCharacter = (character: string | undefined): boolean =>
  character !== undefined && /[A-Za-z0-9_$]/.test(character);

/**
 * The 1-based line numbers carrying at least one BARE token occurrence:
 * delimited from identifier characters on both sides, so `xprojectKey` and
 * `projectKeySuffix` are one identifier, not the bare token.
 */
export const findTokenLines = (text: string, token: string): number[] => {
  const lines: number[] = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    let from = 0;
    for (;;) {
      const at = line.indexOf(token, from);
      if (at === -1) break;
      const afterIndex = at + token.length;
      const before = at === 0 ? undefined : line[at - 1];
      const after = afterIndex >= line.length ? undefined : line[afterIndex];
      if (!isTokenCharacter(before) && !isTokenCharacter(after)) {
        lines.push(index + 1);
        break;
      }
      from = at + 1;
    }
  }
  return lines;
};

/** Baseline validation, failing closed in a pinned order (NFR-6). */
export const validateBaseline = (value: unknown): string[] => {
  const failures: string[] = [];
  if (!isRecord(value)) return ["baseline must be a JSON object"];

  if (value.schemaVersion !== SCHEMA_VERSION) {
    failures.push(`baseline schemaVersion must be ${SCHEMA_VERSION}`);
  }
  if (!isFullSha(value.baseCommit)) {
    failures.push(
      "invalid baseCommit: must be a full 40-character commit SHA (never a branch, tag, or moving ref)",
    );
  }
  if (value.token !== TOKEN) {
    failures.push(`baseline token must be the governed token ${TOKEN}`);
  }

  const entries = value.entries;
  if (!Array.isArray(entries)) {
    failures.push("baseline entries must be a list of { path, reason } objects");
    return failures;
  }
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const label = isRecord(entry) && isNonEmptyString(entry.path) ? entry.path : `#${index}`;
    if (!isRecord(entry)) {
      failures.push(`baseline entry ${label} must be an object with path and reason`);
      continue;
    }
    if (!isNonEmptyString(entry.path) || !isGovernedPath(entry.path)) {
      failures.push(
        `baseline entry ${label} must name a source file on the declared surface (${SURFACE_ROOTS.join(", ")}; ${SURFACE_EXTENSIONS.join("/")})`,
      );
    }
    if (!isNonEmptyString(entry.reason)) {
      failures.push(`baseline entry ${label} must carry a non-empty reason (NFR-6)`);
    }
    if (isNonEmptyString(entry.path)) {
      if (seen.has(entry.path)) {
        failures.push(`baseline entry ${label} is duplicated`);
      }
      seen.add(entry.path);
    }
  }
  return failures;
};

/**
 * The pure rule over injected inputs: a post-base file carrying the bare token
 * without a covering baseline entry violates; a pre-base file is exempt and no
 * per-file counts are read for it.
 */
export const scanNaming = (input: NamingInput): NamingOutcome => {
  const failures = validateBaseline(input.baseline);
  const violations: NamingViolation[] = [];
  if (failures.length > 0) return { failures, violations };

  const covered = new Set(
    input.baseline.entries.map((entry) => entry.path as string).filter((path) => path.length > 0),
  );
  for (const file of input.files) {
    if (input.baseFiles.has(file.path)) continue;
    if (!isGovernedPath(file.path)) continue;
    for (const line of findTokenLines(file.text, TOKEN)) {
      if (!covered.has(file.path)) violations.push({ file: file.path, line });
    }
  }
  return { failures, violations };
};

const listBaseFiles = (
  root: string,
): { readonly files: ReadonlySet<string> } | { readonly failure: string } => {
  const result = spawnSync("git", ["ls-tree", "-r", "--name-only", BASE_COMMIT], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return {
      failure: `missing or unreachable base commit ${BASE_COMMIT}; the naming check fails closed (the constant is re-pointed only deliberately through review)`,
    };
  }
  return { files: new Set((result.stdout ?? "").split("\n").filter((line) => line.length > 0)) };
};

/**
 * Tracked plus untracked-but-not-ignored files on the declared surface; the
 * ignored `tmp/`, `dist/`, and `node_modules/` trees never enter the scan.
 */
const listGovernedFiles = (root: string): string[] => {
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...SURFACE_ROOTS],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) return [];
  return (result.stdout ?? "")
    .split("\0")
    .filter((file) => file.length > 0)
    .filter((file) => isGovernedPath(file))
    .sort();
};

export type ScanTreeOptions = {
  /** Test seam: replace the git base-commit resolution. */
  readonly resolveBaseFiles?: (
    root: string,
  ) => { readonly files: ReadonlySet<string> } | { readonly failure: string };
  /** Test seam: replace the governed-file enumeration. */
  readonly listFiles?: (root: string) => readonly string[];
  /** Test seam: replace the committed baseline document. */
  readonly baseline?: NamingBaseline;
  /** Test seam: replace per-file reads (synthetic texts, never tree writes). */
  readonly readText?: (root: string, path: string) => string;
};

export type ScanTreeOutcome = NamingOutcome & {
  readonly scanned: number;
  readonly baselineEntries: number;
};

/** The read-only real-tree scan: baseline authority plus the pinned base. */
export const scanTree = (root: string, options: ScanTreeOptions = {}): ScanTreeOutcome => {
  let baseline: NamingBaseline;
  try {
    baseline =
      options.baseline ??
      (JSON.parse(readFileSync(join(root, BASELINE_PATH), "utf8")) as NamingBaseline);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      failures: [`cannot read ${BASELINE_PATH}: ${reason}`],
      violations: [],
      scanned: 0,
      baselineEntries: 0,
    };
  }
  const failures = validateBaseline(baseline);
  if (baseline.baseCommit !== BASE_COMMIT) {
    failures.push(
      `baseline baseCommit ${String(baseline.baseCommit)} must equal the committed constant ${BASE_COMMIT}; re-pointing is a deliberate reviewed act, never a silent widening`,
    );
  }
  if (failures.length > 0) {
    return { failures, violations: [], scanned: 0, baselineEntries: 0 };
  }

  const resolved = (options.resolveBaseFiles ?? listBaseFiles)(root);
  if ("failure" in resolved) {
    return { failures: [resolved.failure], violations: [], scanned: 0, baselineEntries: 0 };
  }
  const paths = (options.listFiles ?? listGovernedFiles)(root);
  const readText =
    options.readText ??
    ((dir: string, path: string): string => readFileSync(join(dir, path), "utf8"));
  const files: NamingSourceFile[] = [];
  for (const path of paths) {
    try {
      files.push({ path, text: readText(root, path) });
    } catch {
      // A file vanishing between listing and reading is skipped: the next run
      // re-lists the tree.
    }
  }
  const outcome = scanNaming({ baseFiles: resolved.files, baseline, files });
  return { ...outcome, scanned: files.length, baselineEntries: baseline.entries.length };
};

const violationMessage = (violation: NamingViolation): string =>
  `${violation.file}:${violation.line}: bare token ${TOKEN} in a file absent at base ${BASE_COMMIT} without a ${BASELINE_PATH} entry`;

if (import.meta.main) {
  const outcome = scanTree(process.cwd());
  for (const failure of outcome.failures) {
    console.error(`FAIL new-code-naming: ${failure}`);
  }
  for (const violation of outcome.violations) {
    console.error(`FAIL new-code-naming: ${violationMessage(violation)}`);
  }
  if (outcome.failures.length > 0 || outcome.violations.length > 0) process.exit(1);
  console.log(
    `OK new-code-naming: ${outcome.scanned} governed file(s) scanned, 0 violations, ${outcome.baselineEntries} baseline entry(ies)`,
  );
}
