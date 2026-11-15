/**
 * In-memory memory-tree builders shared by the GH-301 suites.
 *
 * The scanner parses YAML frontmatter at the delivery edge; these builders
 * produce the same structural shape for pure-evaluation tests. No builder
 * writes the live tree.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  HINT_MAX_CHARS,
  MEMORY_ARCHIVE_INDEX_PATH,
  MEMORY_INDEX_PATH,
  MEMORY_RECORD_FILE_NAME_PATTERN,
  MEMORY_ROOT,
  type MemoryFrontmatter,
  type MemoryScannedFile,
  STATEMENT_MAX_CHARS,
} from "../../../packages/core/src/contracts/index";

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const RECORD_FILE = new RegExp(MEMORY_RECORD_FILE_NAME_PATTERN);

const bytesOf = (text: string): number => Buffer.byteLength(text, "utf8");

/** Parse one text's frontmatter the way the scanner does (shape only). */
export const frontmatterOf = (text: string): MemoryFrontmatter => {
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return { state: "absent" };
  const block = FRONTMATTER.exec(text)?.[1];
  if (block === undefined) return { state: "malformed" };
  try {
    const value: unknown = parse(block);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { state: "malformed" };
    }
    return { state: "parsed", value: value as Readonly<Record<string, unknown>> };
  } catch {
    return { state: "malformed" };
  }
};

/** Wrap text as one scanned file. */
export const scannedFile = (path: string, text: string): MemoryScannedFile => ({
  path,
  text,
  bytes: bytesOf(text),
  frontmatter: frontmatterOf(text),
});

/** Wrap text as one scanned file under the memory root. */
export const memoryFile = (relative: string, text: string): MemoryScannedFile =>
  scannedFile(`${MEMORY_ROOT}/${relative}`, text);

/** Strip the memory-root prefix from a repository-relative path. */
export const relativeToMemory = (path: string): string =>
  path.startsWith(`${MEMORY_ROOT}/`) ? path.slice(MEMORY_ROOT.length + 1) : path;

/** Render one record's frontmatter and body. */
export const recordText = (fields: Readonly<Record<string, unknown>>, body = ""): string =>
  `---\n${Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join("\n")}\n---\n${body}`;

/** The valid baseline lesson fields. */
export const validLessonFields = (
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: "lesson-2026-001",
  kind: "lesson",
  scope: "repo",
  statement: "Run the scoped gate first when a full gate is slow.",
  evidence: "merged-pr: PR #244",
  source: "merged_pr",
  trust: "T4",
  created_by: "coder",
  created: "2026-11-06",
  status: "candidate",
  supersedes: [],
  ...overrides,
});

/** One row line for a two-column index table. */
export const indexRow = (relativePath: string, hint: string): string =>
  `| \`${relativePath}\` | ${hint} |`;

/** Render a memory index with exactly the supplied rows. */
export const indexReadme = (rows: readonly string[]): string =>
  `# Memory\n\n## Index\n\n| Path | Read when |\n|---|---|\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`;

/** Render a header-only archive index with exactly the supplied rows. */
export const archiveIndexReadme = (rows: readonly string[]): string =>
  `# Retro archive index\n\n| Path | Read when |\n|---|---|\n${rows.join("\n")}${rows.length > 0 ? "\n" : ""}`;

const isRecordPath = (parts: readonly string[]): boolean => {
  const [area, name, deeper] = parts;
  if (area === undefined || name === undefined) return false;
  if (deeper !== undefined) {
    // guild-scoped records live one level under the guild entry point
    return (
      area === "guilds" &&
      parts.length === 3 &&
      name !== "README.md" &&
      deeper !== undefined &&
      deeper !== "README.md" &&
      /\.md$/.test(deeper)
    );
  }
  return ["lessons", "tacit", "preferences"].includes(area) && /\.md$/.test(name);
};

/** The U-1 covered paths of one file set (fixture-side mirror). */
export const memoryIndexCoveredPaths = (files: readonly MemoryScannedFile[]): string[] => {
  const covered: string[] = [];
  for (const file of files) {
    const relative = relativeToMemory(file.path);
    if (relative === "README.md" || relative.endsWith("/.gitkeep")) continue;
    const parts = relative.split("/");
    const [area, second, third] = parts;
    if (area === "agents" && second !== undefined && third === "README.md") {
      covered.push(relative);
      continue;
    }
    if (area === "guilds" && second !== undefined && third === "README.md") {
      covered.push(relative);
      continue;
    }
    if (relative === "retro/INDEX.md") {
      covered.push(relative);
      continue;
    }
    if (isRecordPath(parts)) covered.push(relative);
  }
  return covered.sort();
};

/** The U-2 covered paths (dated retro notes). */
export const archiveCoveredPaths = (files: readonly MemoryScannedFile[]): string[] =>
  files
    .map((file) => relativeToMemory(file.path))
    .filter((relative) => /^retro\/\d{4}\/.+\.md$/.test(relative))
    .sort();

/** True when the name is a valid record file name (placeholder check). */
export const isRecordFileName = (name: string): boolean => RECORD_FILE.test(name);

/** Build one tree: entries plus the index rows its covered paths require. */
export const treeWith = (
  entries: readonly { readonly relative: string; readonly text: string }[],
  extras: readonly MemoryScannedFile[] = [],
): MemoryScannedFile[] => {
  const files = entries.map((entry) => memoryFile(entry.relative, entry.text));
  const rows = memoryIndexCoveredPaths([...files, ...extras]).map((relative) =>
    indexRow(relative, "read when the task touches it"),
  );
  return [memoryFile("README.md", indexReadme(rows)), ...files, ...extras];
};

/** An empty-but-proved tree: every record area holds only a placeholder. */
export const emptyTree = (): MemoryScannedFile[] => [
  memoryFile("README.md", indexReadme([indexRow("retro/INDEX.md", "read the archive")])),
  memoryFile("lessons/.gitkeep", ""),
  memoryFile("tacit/.gitkeep", ""),
  memoryFile("preferences/.gitkeep", ""),
  memoryFile("guilds/.gitkeep", ""),
  memoryFile("retro/INDEX.md", archiveIndexReadme([])),
];

/** A populated tree: one valid record per area, entries, and an archive note. */
export const populatedTree = (): MemoryScannedFile[] => {
  const lesson = memoryFile("lessons/lesson-2026-001-baseline.md", recordText(validLessonFields()));
  const tacit = memoryFile(
    "tacit/tacit-2026-001-baseline.md",
    recordText(validLessonFields({ id: "tacit-2026-001", kind: "tacit_fragment" })),
  );
  const preference = memoryFile(
    "preferences/preference-2026-001-baseline.md",
    recordText(
      validLessonFields({
        id: "preference-2026-001",
        kind: "preference",
        source: "human_correction",
        evidence: "human-correction: owner review",
      }),
    ),
  );
  const guildRecord = memoryFile(
    "guilds/ops/lesson-2026-002-guild.md",
    recordText(validLessonFields({ id: "lesson-2026-002", guild: "ops" })),
  );
  const guildEntry = memoryFile("guilds/ops/README.md", "# ops guild memory\n");
  const agentEntry = memoryFile("agents/coder/README.md", "# coder memory\n\n- 2026-11-10: note\n");
  const note = memoryFile("retro/2026/2026-11-10-retro.md", "# 2026-11-10 retro\n");
  const archive = memoryFile(
    "retro/INDEX.md",
    archiveIndexReadme([indexRow("retro/2026/2026-11-10-retro.md", "read the 2026-11-10 retro")]),
  );
  const files = [lesson, tacit, preference, guildRecord, guildEntry, agentEntry, note, archive];
  const rows = memoryIndexCoveredPaths(files).map((relative) =>
    indexRow(relative, "read when the task touches it"),
  );
  return [memoryFile("README.md", indexReadme(rows)), ...files];
};

/** A tree whose only findings are schema errors on the supplied records. */
export const treeOfRecords = (
  records: readonly { readonly relative: string; readonly text: string }[],
): MemoryScannedFile[] => treeWith(records);

/** A tree with one index error in each direction. */
export const indexTree = (input: {
  readonly records: readonly { readonly relative: string; readonly text: string }[];
  readonly rows: readonly string[];
  readonly extras?: readonly MemoryScannedFile[];
}): MemoryScannedFile[] => [
  memoryFile("README.md", indexReadme(input.rows)),
  ...input.records.map((record) => memoryFile(record.relative, record.text)),
  ...(input.extras ?? []),
];

/** Filler text of exactly `count` newline-terminated lines (a real file shape). */
export const lineFiller = (count: number): string =>
  `${Array.from({ length: Math.max(count, 1) }, (_, index) => `line ${index + 1}`).join("\n")}\n`;

/** A single-line filler of exactly `bytes` UTF-8 bytes (ASCII). */
export const byteFiller = (bytes: number): string => "a".repeat(Math.max(bytes, 1));

/** A tree whose only findings are the supplied schema errors and advisories. */
export const truncatingTree = (input: {
  readonly errors: number;
  readonly advisories: number;
}): MemoryScannedFile[] => {
  const entries: { relative: string; text: string }[] = [];
  const longStatement = "x".repeat(STATEMENT_MAX_CHARS + 1);
  for (let index = 0; index < input.errors; index += 1) {
    const id = `lesson-2026-${String(index + 100).padStart(3, "0")}`;
    entries.push({
      relative: `lessons/${id}-error.md`,
      text: recordText(validLessonFields({ id, statement: longStatement })),
    });
  }
  for (let index = 0; index < input.advisories; index += 1) {
    const id = `tacit-2026-${String(index + 100).padStart(3, "0")}`;
    entries.push({
      relative: `tacit/${id}-advisory.md`,
      text: recordText(
        validLessonFields({
          id,
          kind: "tacit_fragment",
        }),
        "```text\npackages/core/src/a.ts\npackages/core/src/b.ts\n```\n",
      ),
    });
  }
  return treeWith(entries);
};

/** The live index hint bound, exported so suites import rather than restate. */
export const fixtureHintBound = HINT_MAX_CHARS;

/** The live delivered index path, exported for live-tree assertions. */
export const liveIndexPath = MEMORY_INDEX_PATH;

/** The live delivered archive-index path, exported for live assertions. */
export const liveArchiveIndexPath = MEMORY_ARCHIVE_INDEX_PATH;

/** Scan a bare memory folder (a temp root with README/areas directly inside). */
export const scanMemoryFolder = (root: string): MemoryScannedFile[] => {
  const files: MemoryScannedFile[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(next);
      } else {
        files.push(scannedFile(`${MEMORY_ROOT}/${next}`, readFileSync(join(root, next), "utf8")));
      }
    }
  };
  walk("");
  return files.sort((left, right) => (left.path < right.path ? -1 : 1));
};
