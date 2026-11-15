/**
 * The memory-tree scanner (GH-301 F-4; NFR-4; test plan TC-MEMGATE-003).
 *
 * The scanner is the only module of the memory check that reads files and
 * parses YAML frontmatter. It enumerates `.ai/memory/**` plus the repository
 * `AGENTS.md`, performs exactly one read per file, and writes nothing.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { MemoryFrontmatter, MemoryScannedFile } from "@delivery-os/core/contracts";

/** One directory entry the scanner walk consumes. */
export type MemoryScanDirectoryEntry = {
  readonly name: string;
  readonly directory: boolean;
};

/** The file-system seam the scanner consumes; tests inject a counting port. */
export type MemoryScanFileSystem = {
  readonly readText: (path: string) => string;
  readonly listDirectory: (path: string) => readonly MemoryScanDirectoryEntry[];
};

/** The scanner result: every scanned file, sorted by repository path. */
export type MemoryScanResult = {
  readonly files: readonly MemoryScannedFile[];
};

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

const frontmatterOf = (text: string): MemoryFrontmatter => {
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

/** The delivered node-backed scan port. */
export const nodeMemoryScanFileSystem: MemoryScanFileSystem = {
  readText: (path) => readFileSync(path, "utf8"),
  listDirectory: (path) =>
    readdirSync(path, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      directory: entry.isDirectory(),
    })),
};

const skip = new Set(["node_modules", "dist", ".git"]);

/** Scan the memory tree of one repository root without writing anything. */
export const scanMemoryTree = (
  repoRoot: string,
  memoryRoot: string,
  fs: MemoryScanFileSystem = nodeMemoryScanFileSystem,
): MemoryScanResult => {
  const files: MemoryScannedFile[] = [];
  const walk = (relativeDirectory: string): void => {
    for (const entry of fs.listDirectory(join(repoRoot, relativeDirectory))) {
      if (entry.directory && skip.has(entry.name)) continue;
      const relative = `${relativeDirectory}/${entry.name}`;
      if (entry.directory) {
        walk(relative);
        continue;
      }
      const text = fs.readText(join(repoRoot, relative));
      files.push({
        path: relative,
        text,
        bytes: Buffer.byteLength(text, "utf8"),
        frontmatter: frontmatterOf(text),
      });
    }
  };
  walk(memoryRoot);
  try {
    const text = fs.readText(join(repoRoot, "AGENTS.md"));
    files.push({
      path: "AGENTS.md",
      text,
      bytes: Buffer.byteLength(text, "utf8"),
      frontmatter: { state: "absent" },
    });
  } catch {
    // A repository without AGENTS.md is still scannable; the budget area
    // simply has no kernel section to measure.
  }
  return { files: files.sort((left, right) => (left.path < right.path ? -1 : 1)) };
};
