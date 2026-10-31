/**
 * Corpus enumerator and manifest helpers (GH-179 TC-LINT-007/008, PIN-2).
 *
 * The boundary is derived at run time from the change-folder month and an
 * explicit exclusion manifest, never from a frozen file list. Committed files
 * are read read-only; every mutation control operates on a temp copy.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  nodePmNotesFileSystemFacts,
  parsePmNotesText,
  readPmNotesTarget,
} from "../../packages/adapters/src/file/pm-notes-parser";
import type { LintCommandRuntime } from "../../packages/cli/src/commands/lint";

export const CORPUS_MANIFEST_PATH = "tests/fixtures/pm-notes/corpus-exclusions.json";
export const CORPUS_CHANGES_DIRECTORY = "doc/changes";
export const CORPUS_MONTH_FLOOR = "2026-10";

export type CorpusManifest = { readonly exclude: readonly string[] };

export type CorpusEntry = {
  /** Repo-relative POSIX path. */
  readonly path: string;
  readonly changeRef: string;
  readonly month: string;
};

const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const FILE_PATTERN = /^chg-([A-Z]+-[0-9]+)-pm-notes\.yaml$/;

const isManifest = (value: unknown): value is CorpusManifest => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const exclude = (value as { readonly exclude?: unknown }).exclude;
  return Array.isArray(exclude) && exclude.every((entry) => typeof entry === "string");
};

/** Read and shape-check the committed manifest; a malformed manifest throws. */
export const readCorpusManifest = (root: string): CorpusManifest => {
  const parsed: unknown = JSON.parse(readFileSync(join(root, CORPUS_MANIFEST_PATH), "utf8"));
  if (!isManifest(parsed)) throw new Error("corpus manifest must be { exclude: string[] }");
  return parsed;
};

const refOfFolder = (folder: string): string | undefined => {
  const match = /--([A-Z]+-[0-9]+)--/.exec(folder);
  return match?.[1];
};

/**
 * Enumerate `doc/changes/<month>/<month-day--REF--slug>/chg-<REF>-pm-notes.yaml`
 * for months at or after the floor, minus the manifest. Sorted and stable.
 */
export const enumerateCorpus = (root: string, manifest: CorpusManifest): CorpusEntry[] => {
  const changesDirectory = join(root, CORPUS_CHANGES_DIRECTORY);
  if (!existsSync(changesDirectory)) return [];
  const excluded = new Set(manifest.exclude);
  const entries: CorpusEntry[] = [];
  for (const month of readdirSync(changesDirectory).sort()) {
    if (!MONTH_PATTERN.test(month) || month < CORPUS_MONTH_FLOOR) continue;
    for (const folder of readdirSync(join(changesDirectory, month)).sort()) {
      const changeRef = refOfFolder(folder);
      if (changeRef === undefined) continue;
      const directory = join(changesDirectory, month, folder);
      for (const file of readdirSync(directory).sort()) {
        if (!FILE_PATTERN.test(file)) continue;
        const path = `${CORPUS_CHANGES_DIRECTORY}/${month}/${folder}/${file}`;
        if (excluded.has(path)) continue;
        entries.push({ path, changeRef, month });
      }
    }
  }
  return entries;
};

/** The pre-exclusion member list; used to prove the manifest is the only cut. */
export const enumerateCorpusRaw = (root: string): CorpusEntry[] => {
  const changesDirectory = join(root, CORPUS_CHANGES_DIRECTORY);
  if (!existsSync(changesDirectory)) return [];
  const entries: CorpusEntry[] = [];
  for (const month of readdirSync(changesDirectory).sort()) {
    if (!MONTH_PATTERN.test(month) || month < CORPUS_MONTH_FLOOR) continue;
    for (const folder of readdirSync(join(changesDirectory, month)).sort()) {
      const changeRef = refOfFolder(folder);
      if (changeRef === undefined) continue;
      for (const file of readdirSync(join(changesDirectory, month, folder)).sort()) {
        if (!FILE_PATTERN.test(file)) continue;
        entries.push({
          path: `${CORPUS_CHANGES_DIRECTORY}/${month}/${folder}/${file}`,
          changeRef,
          month,
        });
      }
    }
  }
  return entries;
};

/**
 * Manifest guard (PIN-2, TC-LINT-008): exactly one repo-relative entry, the
 * path exists, and the file is genuinely unparseable. Exclusions cannot grow.
 */
export const manifestViolations = (root: string, manifest: CorpusManifest): string[] => {
  const violations: string[] = [];
  if (manifest.exclude.length !== 1) {
    violations.push(`manifest must name exactly one path, found ${manifest.exclude.length}`);
  }
  for (const path of manifest.exclude) {
    if (path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
      violations.push(`manifest entry is not a repo-relative POSIX path: ${path}`);
      continue;
    }
    const absolute = join(root, path);
    if (!existsSync(absolute)) {
      violations.push(`manifest entry does not exist: ${path}`);
      continue;
    }
    const parsed = parsePmNotesText(readFileSync(absolute, "utf8"), path);
    if (parsed.ok) violations.push(`manifest entry names a parseable file: ${path}`);
  }
  return violations;
};

/** A runtime that lints committed corpus files through the real command path. */
export const corpusRuntime = (root: string): LintCommandRuntime => {
  const fs = nodePmNotesFileSystemFacts();
  return {
    readPmNotes: (changeRef) =>
      readPmNotesTarget({
        changeRef,
        changesDirectory: join(root, CORPUS_CHANGES_DIRECTORY),
        fs,
      }),
    readRegistry: () => ({
      ok: true,
      verifiedEmpty: true,
      recordCount: 0,
      verification: [],
      projection: { present: false },
    }),
  };
};

/** Copy the committed change tree into a temp root (mutation controls only). */
export const copyChangesTree = (targetRoot: string): void => {
  cpSync(
    join(process.cwd(), CORPUS_CHANGES_DIRECTORY),
    join(targetRoot, CORPUS_CHANGES_DIRECTORY),
    {
      recursive: true,
    },
  );
};

/** Write one temp-corpus file, creating its folders. */
export const writeCorpusFile = (root: string, relative: string, text: string): void => {
  const target = join(root, relative);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, text);
};

/** Copy a schema module into a temp tree and append one LITE phase to its set. */
export const mutateLitePhaseSet = (source: string, phase: string): string => {
  const marker = "export const LITE_REQUIRED_PHASES = [";
  const start = source.indexOf(marker);
  if (start < 0) throw new Error("LITE_REQUIRED_PHASES declaration not found");
  const end = source.indexOf("] as const;", start);
  if (end < 0) throw new Error("LITE_REQUIRED_PHASES terminator not found");
  return `${source.slice(0, end)}  "${phase}",\n${source.slice(end)}`;
};
