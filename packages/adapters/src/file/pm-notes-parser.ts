/**
 * pm-notes target reader and YAML 1.2 core parser (GH-179 D1, Phase 3).
 *
 * The reader locates a change ref's committed pm-notes file through injected
 * filesystem facts, reads it, and parses it with the same limits pattern as the
 * configuration parser. It returns parsed values or a safe parse failure; file
 * bytes, parser messages, and stacks never cross the boundary.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { PmNotesParseFailure } from "@delivery-os/core/contracts";
import {
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  LineCounter,
  type Node,
  parseAllDocuments,
  parseDocument,
} from "yaml";

const MAX_SOURCE_BYTES = 1_048_576;
const MAX_NODES = 2_048;
const MAX_DEPTH = 64;
const MAX_ALIASES = 100;
const REF_PATTERN = /^[A-Z]+-[0-9]+$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const CORE_TAG_PREFIX = "tag:yaml.org,2002:";
const ALLOWED_TAGS = new Set([
  `${CORE_TAG_PREFIX}str`,
  `${CORE_TAG_PREFIX}int`,
  `${CORE_TAG_PREFIX}float`,
  `${CORE_TAG_PREFIX}bool`,
  `${CORE_TAG_PREFIX}null`,
  `${CORE_TAG_PREFIX}seq`,
  `${CORE_TAG_PREFIX}map`,
]);

/** Injected filesystem facts; production wraps node:fs, tests supply maps. */
export type PmNotesFileSystemFacts = {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly listDirectory: (path: string) => readonly string[];
};

/** Locate one change ref's pm-notes under the change-artifact convention. */
export type PmNotesTargetRequest = {
  readonly changeRef: string;
  readonly changesDirectory: string;
  readonly fs: PmNotesFileSystemFacts;
};

/** A safe parse failure or the located file plus its parsed value. */
export type PmNotesTargetRead =
  | { readonly ok: true; readonly file: string; readonly value: unknown }
  | { readonly ok: false; readonly reason: "missing" }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

/** A raw target read: the located file text plus its parsed value. */
export type PmNotesTextRead =
  | { readonly ok: true; readonly file: string; readonly text: string; readonly value: unknown }
  | { readonly ok: false; readonly reason: "missing" }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

/** One staged document edit: the new value and its serialized document text. */
export type PmNotesStageResult =
  | { readonly ok: true; readonly value: unknown; readonly text: string }
  | { readonly ok: false; readonly parseFailure: PmNotesParseFailure };

/** The command-side edit: only the target entry's started/completed changes. */
export type PmNotesEntryEdit = {
  readonly phaseId: string;
  readonly operation: "complete" | "reopen";
  readonly timestamp: string;
};

/** A parse result; target lookup adds the separate `missing` outcome. */
export type PmNotesParseResult =
  | { readonly ok: true; readonly file: string; readonly value: unknown }
  | {
      readonly ok: false;
      readonly reason: "malformed";
      readonly file: string;
      readonly parseFailure: PmNotesParseFailure;
    };

const safeList = (fs: PmNotesFileSystemFacts, path: string): readonly string[] => {
  try {
    return fs.listDirectory(path);
  } catch {
    return [];
  }
};

const malformed = (file: string, location: string): PmNotesParseResult => ({
  ok: false,
  reason: "malformed",
  file,
  parseFailure: { class: "syntax", location },
});

const malformedText = (file: string, location: string): PmNotesTextRead => ({
  ok: false,
  reason: "malformed",
  file,
  parseFailure: { class: "syntax", location },
});

const locatePmNotes = (request: PmNotesTargetRequest): string | undefined => {
  if (!REF_PATTERN.test(request.changeRef)) return undefined;
  const { fs, changesDirectory, changeRef } = request;
  if (!fs.exists(changesDirectory)) return undefined;
  for (const month of [...safeList(fs, changesDirectory)]
    .filter((name) => MONTH_PATTERN.test(name))
    .sort()) {
    const monthDirectory = `${changesDirectory}/${month}`;
    for (const folder of [...safeList(fs, monthDirectory)].sort()) {
      if (!folder.includes(`--${changeRef}--`)) continue;
      const file = `${monthDirectory}/${folder}/chg-${changeRef}-pm-notes.yaml`;
      if (fs.exists(file)) return file;
    }
  }
  return undefined;
};

const countNodes = (node: Node, depth: number, seen: Set<Node>, state: { nodes: number }): void => {
  if (state.nodes > MAX_NODES || depth > MAX_DEPTH) throw new Error("node limit");
  if (seen.has(node)) throw new Error("cyclic node");
  seen.add(node);
  state.nodes += 1;
  try {
    if (isAlias(node)) return;
    if (isSeq(node)) {
      for (const item of node.items) if (isNode(item)) countNodes(item, depth + 1, seen, state);
      return;
    }
    if (isMap(node)) {
      for (const pair of node.items) {
        if (isNode(pair.key)) countNodes(pair.key, depth + 1, seen, state);
        if (isNode(pair.value)) countNodes(pair.value, depth + 1, seen, state);
      }
      return;
    }
    if (!isScalar(node)) throw new Error("unsupported node");
    if (node.tag !== undefined && !ALLOWED_TAGS.has(node.tag)) throw new Error("unsupported tag");
  } finally {
    seen.delete(node);
  }
};

/**
 * Parse one pm-notes body. The result carries a safe location only; the
 * original text and parser diagnostics stay inside this function.
 */
export const parsePmNotesText = (text: string, file: string): PmNotesParseResult => {
  if (text.length > MAX_SOURCE_BYTES) return malformed(file, file);
  try {
    const lines = new LineCounter();
    const documents = parseAllDocuments(text, {
      version: "1.2",
      schema: "core",
      uniqueKeys: true,
      merge: false,
      logLevel: "silent",
      prettyErrors: false,
      lineCounter: lines,
    });
    if (documents.length !== 1) return malformed(file, file);
    const document = documents[0];
    if (!document) return malformed(file, file);
    if (document.errors.length > 0 || document.warnings.length > 0) {
      const first = document.errors[0] ?? document.warnings[0];
      const line = first ? lines.linePos(first.pos[0]).line : undefined;
      return malformed(file, line === undefined ? file : `${file}:${line}`);
    }
    if (!isNode(document.contents)) return malformed(file, file);
    countNodes(document.contents, 0, new Set<Node>(), { nodes: 0 });
    const value = document.toJS({ maxAliasCount: MAX_ALIASES }) as unknown;
    return { ok: true, file, value };
  } catch {
    return malformed(file, file);
  }
};

/** Locate and read one change ref's raw pm-notes text plus its parsed value. */
export const readPmNotesText = (request: PmNotesTargetRequest): PmNotesTextRead => {
  const file = locatePmNotes(request);
  if (file === undefined) return { ok: false, reason: "missing" };
  let text: string;
  try {
    text = request.fs.readText(file);
  } catch {
    return malformedText(file, file);
  }
  const parsed = parsePmNotesText(text, file);
  if (!parsed.ok) return parsed;
  return { ok: true, file, text, value: parsed.value };
};

/** Locate, read, and parse one change ref's pm-notes target. */
export const readPmNotesTarget = (request: PmNotesTargetRequest): PmNotesTargetRead => {
  const read = readPmNotesText(request);
  if (!read.ok) return read;
  return { ok: true, file: read.file, value: read.value };
};

/**
 * Stage one transition entry in memory (PIN-8). The YAML Document is edited in
 * place so opaque phase keys, extra entry keys, comments, and free-form values
 * survive value-faithfully; only the target entry's `started`/`completed`
 * change. Nothing is written here.
 */
export const stagePmNotesPhaseEntry = (
  text: string,
  edit: PmNotesEntryEdit,
): PmNotesStageResult => {
  if (text.length > MAX_SOURCE_BYTES)
    return { ok: false, parseFailure: { class: "syntax", location: "document" } };
  try {
    const document = parseDocument(text, {
      version: "1.2",
      schema: "core",
      uniqueKeys: true,
      merge: false,
      logLevel: "silent",
      prettyErrors: false,
    });
    if (document.errors.length > 0 || document.warnings.length > 0) {
      return { ok: false, parseFailure: { class: "syntax", location: "document" } };
    }
    const phases = document.get("phases");
    if (isMap(phases)) {
      const existing = phases.get(edit.phaseId, true);
      if (isMap(existing)) {
        existing.set("completed", edit.operation === "complete" ? edit.timestamp : null);
      } else {
        phases.set(
          edit.phaseId,
          document.createNode({
            started: edit.timestamp,
            completed: edit.operation === "complete" ? edit.timestamp : null,
          }),
        );
      }
    }
    return {
      ok: true,
      value: document.toJS({ maxAliasCount: MAX_ALIASES }),
      text: String(document),
    };
  } catch {
    return { ok: false, parseFailure: { class: "syntax", location: "document" } };
  }
};

/** Production filesystem facts for the reader; node:fs stays in this adapter. */
export const nodePmNotesFileSystemFacts = (): PmNotesFileSystemFacts => ({
  exists: (path) => existsSync(path),
  readText: (path) => readFileSync(path, "utf8"),
  listDirectory: (path) => {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  },
});
