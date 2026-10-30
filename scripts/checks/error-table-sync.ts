/**
 * Binding error-table sync check (F-8, AC-F8-1, §4.4).
 *
 * Three recognizer levels:
 * - Level A: scan S1 (CLI + contracts) and S3 (result fixtures, excluding the
 *   code corpora) for recognized code-like literals; foreign namespaces and
 *   reserved schema names are ignored and counted, never flagged.
 * - Level B: validate the machine-readable table's entries directly.
 * - Level C: feed the true/false-positive corpora explicitly and require each
 *   row's declared verdict.
 *
 * The documented table at `doc/spec/features/feature-result-contract.md` is the
 * S2 surface; missing, empty, or unparseable documentation fails closed.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type TableEntry = {
  readonly code: string;
  readonly domainKind: string;
  readonly category: string;
  readonly retryable: boolean;
  readonly consequence: string;
  readonly remediationHint: string;
  readonly projectionClass: string;
  readonly summary?: string;
};

export type SyncCounts = {
  readonly sourceEntries: number;
  readonly documentedRows: number;
  readonly recognizedS1: number;
  readonly recognizedS3: number;
  readonly corpusRows: number;
  readonly ignoredLiterals: number;
};

export type SyncResult = {
  readonly failures: readonly string[];
  readonly counts: SyncCounts;
};

export type SyncOptions = {
  readonly root: string;
  readonly includeCorpus?: boolean;
};

const TABLE_MODULE = "packages/core/src/contracts/error-table.ts";
const DOC_PATH = "doc/spec/features/feature-result-contract.md";
const CORPUS_DIR = "tests/fixtures/result/code-corpora";
const REQUIRED_COLUMNS = [
  "Code",
  "Domain kind",
  "Category",
  "Retryable",
  "Consequence",
  "Remediation hint",
  "Projection class",
  "Summary",
] as const;
const FALLBACK_CODES = new Set(["fallback.invocation", "fallback.internal"]);
const CODE_PATTERN = /\b[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,}\b/g;
const FALLBACK_PATTERN = /\bfallback\.[a-z][a-z0-9]*\b/g;
const CODE_FORMAT = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/;

type Reference = { readonly code: string; readonly line: number; readonly recognized: boolean };

const listFiles = (root: string, relativeDir: string, extensions: readonly string[]): string[] => {
  const directory = join(root, relativeDir);
  if (!existsSync(directory)) return [];
  const results: string[] = [];
  const walk = (relativePath: string): void => {
    for (const entry of readdirSync(join(root, relativePath), { withFileTypes: true })) {
      const next = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (extensions.some((extension) => entry.name.endsWith(extension))) results.push(next);
    }
  };
  walk(relativeDir);
  return results.sort();
};

const lineAt = (text: string, index: number): number => text.slice(0, index).split("\n").length;

export const scanReferences = (text: string, domainKinds: readonly string[]): Reference[] => {
  const references: Reference[] = [];
  for (const match of text.matchAll(CODE_PATTERN)) {
    const code = match[0];
    const namespace = code.split(".")[0] ?? "";
    const recognized = namespace === "fallback" || domainKinds.includes(namespace);
    references.push({ code, line: lineAt(text, match.index ?? 0), recognized });
  }
  for (const match of text.matchAll(FALLBACK_PATTERN)) {
    references.push({
      code: match[0],
      line: lineAt(text, match.index ?? 0),
      recognized: true,
    });
  }
  return references;
};

let importCounter = 0;

const readTable = async (
  root: string,
): Promise<{ domainKinds: readonly string[]; entries: readonly TableEntry[] }> => {
  const path = join(root, TABLE_MODULE);
  if (!existsSync(path)) throw new Error(`${TABLE_MODULE} is missing`);
  const module = (await import(`${pathToFileURL(path).href}?v=${importCounter++}`)) as {
    DOMAIN_KINDS?: readonly string[];
    ERROR_TABLE?: readonly TableEntry[];
  };
  if (!Array.isArray(module.DOMAIN_KINDS)) throw new Error("DOMAIN_KINDS is not declared");
  if (!Array.isArray(module.ERROR_TABLE)) throw new Error("ERROR_TABLE is not declared");
  return { domainKinds: module.DOMAIN_KINDS, entries: module.ERROR_TABLE };
};

const validateEntries = (
  entries: readonly TableEntry[],
  domainKinds: readonly string[],
): { failures: string[]; codes: Set<string> } => {
  const failures: string[] = [];
  const codes = new Set<string>();
  entries.forEach((entry, index) => {
    const label = `entry[${index}] ${entry.code ?? "<missing code>"}`;
    const missing = [
      "code",
      "domainKind",
      "category",
      "retryable",
      "consequence",
      "remediationHint",
      "projectionClass",
    ].filter((key) => !Object.hasOwn(entry, key));
    if (missing.length > 0) failures.push(`${label}: missing ${missing.join(", ")}`);
    if (typeof entry.code !== "string" || entry.code.length === 0) {
      failures.push(`${label}: code is empty`);
      return;
    }
    if (FALLBACK_CODES.has(entry.code)) {
      if (entry.domainKind !== "fallback") {
        failures.push(`${label}: containment entries must use the reserved domain kind`);
      }
    } else if (!CODE_FORMAT.test(entry.code)) {
      failures.push(`${label}: invalid code format`);
    } else {
      const namespace = entry.code.split(".")[0] ?? "";
      if (!domainKinds.includes(namespace)) {
        failures.push(`${label}: undeclared namespace ${namespace}`);
      }
      if (entry.domainKind !== namespace) {
        failures.push(`${label}: domainKind does not match the code namespace`);
      }
    }
    if (codes.has(entry.code)) failures.push(`${label}: duplicate code`);
    codes.add(entry.code);
    if (typeof entry.remediationHint !== "string" || entry.remediationHint.length === 0) {
      failures.push(`${label}: remediationHint is empty`);
    }
    if (
      entry.summary !== undefined &&
      (typeof entry.summary !== "string" || entry.summary.length === 0)
    ) {
      failures.push(`${label}: summary is empty`);
    }
  });
  return { failures, codes };
};

const parseRow = (line: string): string[] => {
  const trimmed = line.trim();
  const cells = trimmed.split("|");
  if (cells.length > 0 && cells[0]?.trim() === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1]?.trim() === "") cells.pop();
  return cells.map((cell) => cell.trim());
};

const validateDocumentedTable = (
  root: string,
  entries: readonly TableEntry[],
  codes: Set<string>,
): { failures: string[]; documentedRows: number } => {
  const failures: string[] = [];
  const path = join(root, DOC_PATH);
  if (!existsSync(path)) {
    return { failures: [`${DOC_PATH}: documented table file is missing`], documentedRows: 0 };
  }
  const text = readFileSync(path, "utf8");
  const heading = "## Documented error table";
  const headingIndex = text.indexOf(heading);
  if (headingIndex < 0) {
    return { failures: [`${DOC_PATH}: missing ${heading}`], documentedRows: 0 };
  }
  const lines = text.slice(headingIndex + heading.length).split("\n");
  let cursor = 0;
  while (cursor < lines.length && !(lines[cursor] as string).trim().startsWith("|")) cursor += 1;
  if (cursor >= lines.length) {
    failures.push(`${DOC_PATH}: documented table is empty`);
    return { failures, documentedRows: 0 };
  }
  const tableLines: string[] = [];
  while (cursor < lines.length && (lines[cursor] as string).trim().startsWith("|")) {
    tableLines.push((lines[cursor] as string).trim());
    cursor += 1;
  }
  if (tableLines.length < 3) {
    failures.push(`${DOC_PATH}: documented table has no data rows`);
    return { failures, documentedRows: 0 };
  }
  const header = parseRow(tableLines[0] as string);
  if (header.join("|") !== REQUIRED_COLUMNS.join("|")) {
    failures.push(`${DOC_PATH}: documented table header is not the documented contract`);
  }
  const separator = parseRow(tableLines[1] as string);
  if (
    separator.length !== REQUIRED_COLUMNS.length ||
    !separator.every((cell) => /^:?-{2,}:?$/.test(cell))
  ) {
    failures.push(`${DOC_PATH}: documented table separator is malformed`);
  }
  const seen = new Set<string>();
  let documentedRows = 0;
  for (const line of tableLines.slice(2)) {
    const cells = parseRow(line);
    documentedRows += 1;
    if (cells.length !== REQUIRED_COLUMNS.length) {
      failures.push(
        `${DOC_PATH}: row has ${cells.length} columns (expected ${REQUIRED_COLUMNS.length})`,
      );
      continue;
    }
    const [code, domainKind, category, retryable, consequence, hint, projectionClass, summary] =
      cells as [string, string, string, string, string, string, string, string];
    const entry = entries.find((candidate) => candidate.code === code);
    if (entry === undefined) {
      failures.push(`${DOC_PATH}: documented code ${code} has no source entry`);
      continue;
    }
    if (seen.has(code)) failures.push(`${DOC_PATH}: duplicate documented row for ${code}`);
    seen.add(code);
    if (domainKind !== entry.domainKind) failures.push(`${DOC_PATH}: ${code} domain kind mismatch`);
    if (category !== entry.category) failures.push(`${DOC_PATH}: ${code} category mismatch`);
    if (retryable !== String(entry.retryable))
      failures.push(`${DOC_PATH}: ${code} retryable mismatch`);
    if (consequence !== entry.consequence)
      failures.push(`${DOC_PATH}: ${code} consequence mismatch`);
    if (hint !== entry.remediationHint) failures.push(`${DOC_PATH}: ${code} hint mismatch`);
    if (projectionClass !== entry.projectionClass) {
      failures.push(`${DOC_PATH}: ${code} projection class mismatch`);
    }
    if (summary !== (entry.summary ?? "")) failures.push(`${DOC_PATH}: ${code} summary mismatch`);
  }
  for (const code of codes) {
    if (!seen.has(code)) failures.push(`${DOC_PATH}: source entry ${code} is undocumented`);
  }
  return { failures, documentedRows };
};

type CorpusRow = {
  readonly id: string;
  readonly text: string;
  readonly recognized: boolean;
  readonly resolves: boolean;
};

const validateCorpus = (
  root: string,
  domainKinds: readonly string[],
  codes: Set<string>,
): { failures: string[]; corpusRows: number } => {
  const failures: string[] = [];
  let corpusRows = 0;
  for (const file of ["true-positives.json", "false-positives.json"]) {
    const path = join(root, CORPUS_DIR, file);
    if (!existsSync(path)) {
      failures.push(`${CORPUS_DIR}/${file}: corpus file is missing`);
      continue;
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { rows?: CorpusRow[] };
    if (!Array.isArray(parsed.rows)) {
      failures.push(`${CORPUS_DIR}/${file}: rows are missing`);
      continue;
    }
    parsed.rows.forEach((row, index) => {
      corpusRows += 1;
      const label = `${CORPUS_DIR}/${file} row ${index} (${row.id ?? "unnamed"})`;
      const recognized = scanReferences(row.text, domainKinds).filter(
        (reference) => reference.recognized,
      );
      const actualRecognized = recognized.length > 0;
      const actualResolves =
        actualRecognized && recognized.every((reference) => codes.has(reference.code));
      for (const reference of recognized) {
        if (!codes.has(reference.code)) {
          failures.push(`${label}: recognized code ${reference.code} has no table entry`);
        }
      }
      if (actualRecognized !== row.recognized) {
        failures.push(`${label}: recognized expected ${row.recognized}, got ${actualRecognized}`);
      }
      if (actualResolves !== row.resolves) {
        failures.push(`${label}: resolves expected ${row.resolves}, got ${actualResolves}`);
      }
    });
  }
  return { failures, corpusRows };
};

const validateScan = (
  root: string,
  relativeDir: string,
  domainKinds: readonly string[],
  codes: Set<string>,
  surface: "S1" | "S3",
  excludedPrefix?: string,
  excludedFile?: string,
): { failures: string[]; recognized: number; ignored: number } => {
  const failures: string[] = [];
  let recognizedCount = 0;
  let ignored = 0;
  for (const file of listFiles(root, relativeDir, [".ts", ".json", ".txt"])) {
    if (excludedPrefix !== undefined && file.startsWith(excludedPrefix)) continue;
    if (excludedFile !== undefined && file === excludedFile) continue;
    const text = readFileSync(join(root, file), "utf8");
    for (const reference of scanReferences(text, domainKinds)) {
      if (!reference.recognized) {
        ignored += 1;
        continue;
      }
      recognizedCount += 1;
      if (!codes.has(reference.code)) {
        failures.push(
          `${file}:${reference.line} ${surface}: recognized code ${reference.code} has no table entry`,
        );
      }
    }
  }
  return { failures, recognized: recognizedCount, ignored };
};

/** Run the sync check over a root (the live tree or a mutated temp copy). */
export const runSyncCheck = async (options: SyncOptions): Promise<SyncResult> => {
  const failures: string[] = [];
  let domainKinds: readonly string[] = [];
  let entries: readonly TableEntry[] = [];
  let codes = new Set<string>();
  try {
    const table = await readTable(options.root);
    domainKinds = table.domainKinds;
    entries = table.entries;
    const validation = validateEntries(entries, domainKinds);
    failures.push(...validation.failures);
    codes = validation.codes;
  } catch (error) {
    failures.push(`${TABLE_MODULE}: cannot load the machine-readable table (${String(error)})`);
  }

  const s1 = validateScan(options.root, "packages/cli/src", domainKinds, codes, "S1");
  failures.push(...s1.failures);
  const coreContracts = validateScan(
    options.root,
    "packages/core/src/contracts",
    domainKinds,
    codes,
    "S1",
    undefined,
    TABLE_MODULE,
  );
  failures.push(...coreContracts.failures);

  const s3 = validateScan(
    options.root,
    "tests/fixtures/result",
    domainKinds,
    codes,
    "S3",
    `${CORPUS_DIR}/`,
  );
  failures.push(...s3.failures);

  const documented = validateDocumentedTable(options.root, entries, codes);
  failures.push(...documented.failures);

  let corpusRows = 0;
  if (options.includeCorpus !== false) {
    const corpus = validateCorpus(options.root, domainKinds, codes);
    failures.push(...corpus.failures);
    corpusRows = corpus.corpusRows;
  }

  const counts: SyncCounts = {
    sourceEntries: entries.length,
    documentedRows: documented.documentedRows,
    recognizedS1: s1.recognized + coreContracts.recognized,
    recognizedS3: s3.recognized,
    corpusRows,
    ignoredLiterals: s1.ignored + coreContracts.ignored + s3.ignored,
  };

  return { failures, counts };
};

if (import.meta.main) {
  const result = await runSyncCheck({ root: process.cwd() });
  console.log(
    `error-table-sync: entries=${result.counts.sourceEntries} documented=${result.counts.documentedRows} ` +
      `S1=${result.counts.recognizedS1} S3=${result.counts.recognizedS3} corpus=${result.counts.corpusRows} ` +
      `ignored=${result.counts.ignoredLiterals}`,
  );
  if (result.failures.length > 0) {
    for (const failure of result.failures) console.error(`FAIL error-table-sync: ${failure}`);
    process.exit(1);
  }
  console.log("OK error-table-sync: source, documented table, and fixtures agree");
}
