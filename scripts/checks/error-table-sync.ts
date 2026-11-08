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
import {
  ERROR_TABLE_FAMILIES,
  type ErrorTableFamily,
} from "../../packages/core/src/contracts/error-table.js";
import {
  MERGE_BUILTIN_GATE_IDS,
  MERGE_GATE_ERROR_PREFIX,
  MERGE_GATE_ERROR_SUFFIX,
  MERGE_GATE_ERROR_TEMPLATE,
} from "../../packages/core/src/contracts/merge.js";
import { CLOSEOUT_STEP_IDS } from "../../packages/core/src/contracts/closeout.js";
import {
  BOARD_COLLECTOR_ERROR_PREFIX,
  BOARD_COLLECTOR_ERROR_SUFFIX,
  BOARD_COLLECTOR_IDS,
} from "../../packages/core/src/contracts/owner-gate-sla.js";

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

const MERGE_DECLARED_GATE_IDS: readonly string[] = [...MERGE_BUILTIN_GATE_IDS, "tracker-freshness"];

/**
 * The declared `merge.gate.<gate-id>.failed` family (GAP-13, NFR-8).
 *
 * The recognizer is deliberately narrow: only the declared prefix/suffix pair
 * and a lowercase id slot are admitted, and the slot must name an id in the
 * supplied effective gate registry (the shipped default set here). There is no
 * generic `merge.*` widening and no template/empty id.
 */
export const mergeGateIdOfFamilyCode = (code: string): string | undefined => {
  if (!code.startsWith(MERGE_GATE_ERROR_PREFIX)) return undefined;
  if (!code.endsWith(MERGE_GATE_ERROR_SUFFIX)) return undefined;
  const id = code.slice(
    MERGE_GATE_ERROR_PREFIX.length,
    code.length - MERGE_GATE_ERROR_SUFFIX.length,
  );
  return /^[a-z][a-z0-9-]*$/.test(id) ? id : undefined;
};

export const isDeclaredMergeGateFamilyCode = (
  code: string,
  declaredIds: readonly string[] = MERGE_DECLARED_GATE_IDS,
): boolean => {
  const id = mergeGateIdOfFamilyCode(code);
  return id !== undefined && declaredIds.includes(id);
};

export const CLOSEOUT_STEP_ERROR_PREFIX = "closeout.step." as const;
export const CLOSEOUT_STEP_ERROR_SUFFIX = ".failed" as const;

/** The declared `closeout.step.<id>.failed` family slot (GH-240 DEC-15). */
export const closeoutStepIdOfFamilyCode = (code: string): string | undefined => {
  if (!code.startsWith(CLOSEOUT_STEP_ERROR_PREFIX)) return undefined;
  if (!code.endsWith(CLOSEOUT_STEP_ERROR_SUFFIX)) return undefined;
  const id = code.slice(
    CLOSEOUT_STEP_ERROR_PREFIX.length,
    code.length - CLOSEOUT_STEP_ERROR_SUFFIX.length,
  );
  return /^[a-z][a-z0-9-]*$/.test(id) ? id : undefined;
};

export const isDeclaredCloseoutStepFamilyCode = (
  code: string,
  declaredIds: readonly string[] = CLOSEOUT_STEP_IDS,
): boolean => {
  const id = closeoutStepIdOfFamilyCode(code);
  return id !== undefined && declaredIds.includes(id);
};

const FAMILY_SHAPES: Readonly<
  Record<string, { readonly prefix: string; readonly suffix: string }>
> = {
  [MERGE_GATE_ERROR_TEMPLATE]: { prefix: MERGE_GATE_ERROR_PREFIX, suffix: MERGE_GATE_ERROR_SUFFIX },
  "closeout.step.<id>.failed": {
    prefix: CLOSEOUT_STEP_ERROR_PREFIX,
    suffix: CLOSEOUT_STEP_ERROR_SUFFIX,
  },
};

const familyForTemplate = (code: string): ErrorTableFamily | undefined =>
  (ERROR_TABLE_FAMILIES as readonly ErrorTableFamily[]).find((family) => family.template === code);

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
// GH-182/GH-221: the specs pin the two-segment `provider.outage` identity and
// the three lane-safety `watchdog.*` identities exactly; they remain exact
// declared codes (not a pattern widening), and every other failure identity
// keeps the three-segment minimum. GH-230 pins the four closed `blockers.*`
// user-validation identities the same way: exact codes, no family wildcard.
const RESERVED_TWO_SEGMENT_CODES = new Set([
  "provider.outage",
  "watchdog.checkout-dirty",
  "watchdog.checkout-non-base",
  "watchdog.signals-absent",
  "blockers.invalid-type",
  "blockers.unknown-id",
  "blockers.credential-value-rejected",
  "blockers.audience-mismatch",
  // GH-235 pins the sourced-stall and dispatch economics identities exactly;
  // they remain exact declared codes, not a pattern widening.
  "watchdog.liveness-stalled",
  "dispatch.restart-budget-exceeded",
  "dispatch.resume-uneconomical",
  // GH-227 pins these three commit identities exactly; they remain exact
  // declared codes, not a pattern widening.
  "commit.staging-blocked-untracked",
  "commit.commitlint-failed",
  "commit.atomic-abort",
  // GH-240 pins the capsule-invalid identity exactly; it is a two-segment code.
  "closeout.capsule-invalid",
  // GH-225 pins the merge identities exactly; they are two-segment codes.
  "merge.gates-stale",
  "merge.waiver-unauthorized",
  "merge.owner-gate-override-without-waiver",
  "merge.rebase-conflict",
  "merge.state-unverified",
  "merge.landing-unverified",
  "merge.transaction-aborted",
  // GH-236 pins the spend read-side identity exactly; it is a two-segment code.
  "spend.telemetry-absent",
  // GH-237 pins the four two-segment queue identities exactly.
  "queue.dependency-cycle",
  "queue.lease-conflict",
  "queue.park-condition-stuck",
  "queue.entry.unobserved",
]);
const CODE_PATTERN = /\b[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,}\b/g;
const TWO_SEGMENT_PATTERN = /\b[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\b/g;
const FALLBACK_PATTERN = /\bfallback\.[a-z][a-z0-9]*\b/g;
// GH-183: `provider.payload.invalid` is a distinct adapter-local identity for a
// malformed provider payload. It is intentionally not an error-table row (an
// explicit not-found has its own `closeout` identity), so the scan recognizes it
// without demanding a documented row.
const ADAPTER_LOCAL_CODES = new Set(["provider.payload.invalid"]);
const CODE_FORMAT = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){2,}$/;
const TABLE_ANNOUNCEMENT_VOCABULARY = "packages/core/src/contracts/provider.ts";

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

/**
 * A doctor check-level cause (`doctor.check.<area>.unreachable`) is diagnostic
 * check data named by the doctor contract, never an error-table identity
 * (GH-224 F-11: check-level causes remain evidence, not identities). It is
 * therefore not a recognized code reference in either corpus direction.
 */
const DOCTOR_CHECK_CONDITION_PATTERN = /^doctor\.check\.[a-z][a-z0-9-]*\.unreachable$/;

/**
 * The declared `status.collector.<id>.unavailable` family (GAP-3, DEC-7).
 *
 * The recognizer is deliberately narrow: it admits only the declared prefix and
 * suffix over the closed collector-id set. There is no generic `status.*`
 * widening and no template/empty id. A synthetic `status.other.<id>.unavailable`
 * is therefore not a member and fails the ordinary table lookup.
 */
export const collectorIdOfFamilyCode = (code: string): string | undefined => {
  if (!code.startsWith(BOARD_COLLECTOR_ERROR_PREFIX)) return undefined;
  if (!code.endsWith(BOARD_COLLECTOR_ERROR_SUFFIX)) return undefined;
  const id = code.slice(
    BOARD_COLLECTOR_ERROR_PREFIX.length,
    code.length - BOARD_COLLECTOR_ERROR_SUFFIX.length,
  );
  return /^[a-z][a-z0-9-]*$/.test(id) ? id : undefined;
};

export const isDeclaredCollectorFamilyCode = (code: string): boolean => {
  const id = collectorIdOfFamilyCode(code);
  return id !== undefined && (BOARD_COLLECTOR_IDS as readonly string[]).includes(id);
};

export const scanReferences = (text: string, domainKinds: readonly string[]): Reference[] => {
  const references: Reference[] = [];
  for (const match of text.matchAll(CODE_PATTERN)) {
    const code = match[0];
    const namespace = code.split(".")[0] ?? "";
    const recognized =
      !DOCTOR_CHECK_CONDITION_PATTERN.test(code) &&
      (namespace === "fallback" || domainKinds.includes(namespace));
    references.push({ code, line: lineAt(text, match.index ?? 0), recognized });
  }
  for (const match of text.matchAll(TWO_SEGMENT_PATTERN)) {
    const code = match[0];
    if (!RESERVED_TWO_SEGMENT_CODES.has(code)) continue;
    references.push({
      code,
      line: lineAt(text, match.index ?? 0),
      recognized: true,
    });
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
): Promise<{
  domainKinds: readonly string[];
  entries: readonly TableEntry[];
  families: readonly ErrorTableFamily[];
}> => {
  const path = join(root, TABLE_MODULE);
  if (!existsSync(path)) throw new Error(`${TABLE_MODULE} is missing`);
  const module = (await import(`${pathToFileURL(path).href}?v=${importCounter++}`)) as {
    DOMAIN_KINDS?: readonly string[];
    ERROR_TABLE?: readonly TableEntry[];
    ERROR_TABLE_FAMILIES?: readonly ErrorTableFamily[];
  };
  if (!Array.isArray(module.DOMAIN_KINDS)) throw new Error("DOMAIN_KINDS is not declared");
  if (!Array.isArray(module.ERROR_TABLE)) throw new Error("ERROR_TABLE is not declared");
  if (!Array.isArray(module.ERROR_TABLE_FAMILIES)) {
    throw new Error("ERROR_TABLE_FAMILIES is not declared");
  }
  return {
    domainKinds: module.DOMAIN_KINDS,
    entries: module.ERROR_TABLE,
    families: module.ERROR_TABLE_FAMILIES,
  };
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
    } else if (!CODE_FORMAT.test(entry.code) && !RESERVED_TWO_SEGMENT_CODES.has(entry.code)) {
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

const validateFamilies = (
  families: readonly ErrorTableFamily[],
  domainKinds: readonly string[],
): { failures: string[]; templates: Set<string> } => {
  const failures: string[] = [];
  const templates = new Set<string>();
  families.forEach((family, index) => {
    const label = `family[${index}] ${family.template ?? "<missing template>"}`;
    const shape = FAMILY_SHAPES[family.template];
    if (shape === undefined) {
      failures.push(`${label}: template is not a declared family`);
    } else {
      if (family.slotPrefix !== shape.prefix) {
        failures.push(`${label}: slot prefix is not the declared family prefix`);
      }
      if (family.slotSuffix !== shape.suffix) {
        failures.push(`${label}: slot suffix is not the declared family suffix`);
      }
    }
    if (!domainKinds.includes(family.domainKind)) {
      failures.push(`${label}: undeclared namespace ${family.domainKind}`);
    }
    if (typeof family.remediationHint !== "string" || family.remediationHint.length === 0) {
      failures.push(`${label}: remediationHint is empty`);
    }
    if (templates.has(family.template)) failures.push(`${label}: duplicate family template`);
    templates.add(family.template);
  });
  return { failures, templates };
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
  families: readonly ErrorTableFamily[],
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
    const family = familyForTemplate(cells[0] ?? "");
    if (family === undefined) documentedRows += 1;
    if (cells.length !== REQUIRED_COLUMNS.length) {
      failures.push(
        `${DOC_PATH}: row has ${cells.length} columns (expected ${REQUIRED_COLUMNS.length})`,
      );
      continue;
    }
    const [code, domainKind, category, retryable, consequence, hint, projectionClass, summary] =
      cells as [string, string, string, string, string, string, string, string];
    const entry = family ?? entries.find((candidate) => candidate.code === code);
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
  for (const family of families) {
    if (!seen.has(family.template)) {
      failures.push(`${DOC_PATH}: family ${family.template} is undocumented`);
    }
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
        actualRecognized &&
        recognized.every(
          (reference) =>
            codes.has(reference.code) ||
            isDeclaredMergeGateFamilyCode(reference.code) ||
            isDeclaredCollectorFamilyCode(reference.code) ||
            isDeclaredCloseoutStepFamilyCode(reference.code),
        );
      for (const reference of recognized) {
        const familyShape = mergeGateIdOfFamilyCode(reference.code) !== undefined;
        if (
          !codes.has(reference.code) &&
          !familyShape &&
          !isDeclaredMergeGateFamilyCode(reference.code) &&
          !isDeclaredCollectorFamilyCode(reference.code) &&
          !isDeclaredCloseoutStepFamilyCode(reference.code)
        ) {
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
  excludedFiles?: string | readonly string[],
): { failures: string[]; recognized: number; ignored: number } => {
  const failures: string[] = [];
  let recognizedCount = 0;
  let ignored = 0;
  for (const file of listFiles(root, relativeDir, [".ts", ".json", ".txt"])) {
    if (excludedPrefix !== undefined && file.startsWith(excludedPrefix)) continue;
    const excluded =
      excludedFiles === undefined
        ? []
        : typeof excludedFiles === "string"
          ? [excludedFiles]
          : excludedFiles;
    if (excluded.includes(file)) continue;
    const text = readFileSync(join(root, file), "utf8");
    for (const reference of scanReferences(text, domainKinds)) {
      if (!reference.recognized) {
        ignored += 1;
        continue;
      }
      recognizedCount += 1;
      if (!codes.has(reference.code) && !ADAPTER_LOCAL_CODES.has(reference.code)) {
        const collectorFamily =
          isDeclaredCollectorFamilyCode(reference.code) ||
          (reference.code.startsWith(BOARD_COLLECTOR_ERROR_PREFIX) &&
            reference.code.endsWith(BOARD_COLLECTOR_ERROR_SUFFIX));
        if (collectorFamily) {
          if (!isDeclaredCollectorFamilyCode(reference.code)) {
            failures.push(
              `${file}:${reference.line} ${surface}: recognized collector-family code ${reference.code} has no table entry`,
            );
          }
          continue;
        }
        if (isDeclaredCloseoutStepFamilyCode(reference.code)) continue;
        if (closeoutStepIdOfFamilyCode(reference.code) !== undefined) {
          failures.push(
            `${file}:${reference.line} ${surface}: recognized closeout-step-family code ${reference.code} has no table entry`,
          );
          continue;
        }
        if (isDeclaredMergeGateFamilyCode(reference.code)) continue;
        if (mergeGateIdOfFamilyCode(reference.code) !== undefined) {
          failures.push(
            `${file}:${reference.line} ${surface}: recognized merge-gate-family code ${reference.code} has no table entry`,
          );
          continue;
        }
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
  let families: readonly ErrorTableFamily[] = [];
  let codes = new Set<string>();
  try {
    const table = await readTable(options.root);
    domainKinds = table.domainKinds;
    entries = table.entries;
    families = table.families;
    const validation = validateEntries(entries, domainKinds);
    failures.push(...validation.failures);
    codes = validation.codes;
    const familyValidation = validateFamilies(families, domainKinds);
    failures.push(...familyValidation.failures);
    for (const code of codes) {
      if (DOCTOR_CHECK_CONDITION_PATTERN.test(code)) {
        failures.push(
          `${code}: a doctor check-level cause must not become an error-table identity`,
        );
      }
    }
  } catch (error) {
    failures.push(`${TABLE_MODULE}: cannot load the machine-readable table (${String(error)})`);
  }

  const s1 = validateScan(options.root, "packages/cli/src", domainKinds, codes, "S1");
  failures.push(...s1.failures);
  // Announcement codes are a separate closed vocabulary (GH-182 F-9), not
  // failure identities; their declaration file and the table itself are outside
  // the failure-code scan.
  const coreContracts = validateScan(
    options.root,
    "packages/core/src/contracts",
    domainKinds,
    codes,
    "S1",
    undefined,
    [TABLE_MODULE, TABLE_ANNOUNCEMENT_VOCABULARY],
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

  const documented = validateDocumentedTable(options.root, entries, codes, families);
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
