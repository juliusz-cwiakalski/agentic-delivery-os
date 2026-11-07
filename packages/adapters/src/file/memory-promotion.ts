/**
 * Promotion home writes (GH-240 F-4, DEC-6, §21).
 *
 * Confined to `lessons/` and `tacit/` under the injected memory root. Paths are
 * realpath-checked against the root before any write; a resolved escape is a
 * classified `escape` outcome with zero writes. Writes are atomic, idempotent
 * by byte equality, and never push, rewrite history, or touch `doc/spec` or
 * `doc/decisions`.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import type {
  CapsuleMemoryFacts,
  CapsuleMemoryRecord,
  CapsulePromotionWrite,
} from "@delivery-os/core/contracts";

/** The minimal read seam the memory reader consumes. */
export type MemoryReadFileSystem = {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly listDirectory: (path: string) => readonly string[];
};

const FRONTMATTER = /^---\n([\s\S]*?)\n---/;
const field = (block: string, key: string): string | undefined => {
  const match = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(block);
  if (match?.[1] === undefined) return undefined;
  const raw = match[1].trim();
  const quoted = /^"(.*)"$/.exec(raw);
  return quoted?.[1] === undefined ? raw : quoted[1].replace(/\\"/g, '"');
};

const recordOf = (
  path: string,
  text: string,
  fallbackClass: "lesson" | "tacit",
): CapsuleMemoryRecord | undefined => {
  const frontmatter = FRONTMATTER.exec(text);
  if (frontmatter?.[1] === undefined) return undefined;
  const id = field(frontmatter[1], "id");
  const statement = field(frontmatter[1], "statement");
  if (id === undefined || statement === undefined) return undefined;
  return {
    id,
    class: field(frontmatter[1], "kind") === "tacit_fragment" ? "tacit" : fallbackClass,
    statement,
    status: field(frontmatter[1], "status") ?? "candidate",
    path,
  };
};

/** Read the existing lesson/tacit records and the index line count. */
export const readMemoryFacts = (
  memoryRoot: string,
  fs: MemoryReadFileSystem = {
    exists: (path) => existsSync(path),
    readText: (path) => readFileSync(path, "utf8"),
    listDirectory: (path) => {
      try {
        return readdirSync(path);
      } catch {
        return [];
      }
    },
  },
): CapsuleMemoryFacts => {
  const records: CapsuleMemoryRecord[] = [];
  for (const candidateClass of ["lesson", "tacit"] as const) {
    const directory = join(memoryRoot, `${candidateClass}s`);
    if (!fs.exists(directory)) continue;
    for (const name of [...fs.listDirectory(directory)].sort()) {
      if (!/\.md$/.test(name)) continue;
      try {
        const record = recordOf(
          `${candidateClass}s/${name}`,
          fs.readText(join(directory, name)),
          candidateClass,
        );
        if (record !== undefined) records.push(record);
      } catch {
        // An unreadable record is skipped; the capsule never guesses.
      }
    }
  }
  const readme = join(memoryRoot, "README.md");
  const indexLines = fs.exists(readme) ? fs.readText(readme).split("\n").length : 0;
  return { records, indexLines };
};

/** The outcome of one home write. */
export type PromotionWriteResult =
  | { readonly ok: true; readonly wrote: boolean }
  | {
      readonly ok: false;
      readonly code: "escape" | "conflict" | "write-failed";
      readonly detail: string;
    };

const deepestExisting = (path: string): string => {
  let current = resolve(path);
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
};

const underRoot = (root: string, target: string): boolean => {
  const base = realpathSync(root);
  const parent = realpathSync(deepestExisting(dirname(target)));
  return parent === base || parent.startsWith(`${base}${sep}`);
};

const supersedeRecord = (memoryRoot: string, recordId: string): PromotionWriteResult => {
  for (const candidateClass of ["lesson", "tacit"] as const) {
    const directory = join(memoryRoot, `${candidateClass}s`);
    if (!existsSync(directory)) continue;
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (!name.startsWith(`${recordId}-`) && name !== `${recordId}.md`) continue;
      const text = readFileSync(path, "utf8");
      const next = text.replace(/^(status:\s*)["']?candidate["']?\s*$/m, '$1"superseded"');
      if (next !== text) writeFileSync(path, next);
      return { ok: true, wrote: next !== text };
    }
  }
  return { ok: true, wrote: false };
};

/** Resolve-only confinement check used by plan mode (GH-240 F-4, §21). */
export const checkPromotionConfinement = (
  memoryRoot: string,
  write: CapsulePromotionWrite,
): PromotionWriteResult => {
  if (/\.\./.test(write.path) || write.path.startsWith("/") || /[\\]/.test(write.path)) {
    return { ok: false, code: "escape", detail: `resolved home ${write.path} is outside the root` };
  }
  const target = join(memoryRoot, write.path);
  if (!underRoot(memoryRoot, target)) {
    return { ok: false, code: "escape", detail: `resolved home ${write.path} is outside the root` };
  }
  return { ok: true, wrote: false };
};

/**
 * Apply one promotion write under the injected memory root.
 *
 * An id/record-name outside the slug shape never reaches this function (the
 * domain rejects it as capsule-invalid); a resolved path outside the root is an
 * `escape` with zero writes; a differing pre-existing file is `conflict`.
 */
export const applyPromotionWrite = (
  memoryRoot: string,
  write: CapsulePromotionWrite,
  fs: MemoryReadFileSystem = {
    exists: (path) => existsSync(path),
    readText: (path) => readFileSync(path, "utf8"),
    listDirectory: () => [],
  },
): PromotionWriteResult => {
  const confinement = checkPromotionConfinement(memoryRoot, write);
  if (!confinement.ok) return confinement;
  const target = join(memoryRoot, write.path);
  if (fs.exists(target)) {
    const existing = fs.readText(target);
    if (existing === write.content) return { ok: true, wrote: false };
    return {
      ok: false,
      code: "conflict",
      detail: `a different record already exists at ${write.path}`,
    };
  }
  try {
    mkdirSync(dirname(target), { recursive: true });
    const temporary = `${target}.tmp-${process.pid.toString(36)}`;
    writeFileSync(temporary, write.content);
    renameSync(temporary, target);
  } catch {
    return { ok: false, code: "write-failed", detail: `could not write ${write.path}` };
  }
  const readme = join(memoryRoot, "README.md");
  if (fs.exists(readme) && !fs.readText(readme).includes(write.indexRow)) {
    const text = fs.readText(readme);
    const separator = text.endsWith("\n") ? "" : "\n";
    writeFileSync(readme, `${text}${separator}${write.indexRow}\n`);
  }
  for (const record of write.supersedes ?? []) {
    const superseded = supersedeRecord(memoryRoot, record);
    if (!superseded.ok) return superseded;
  }
  return { ok: true, wrote: true };
};
