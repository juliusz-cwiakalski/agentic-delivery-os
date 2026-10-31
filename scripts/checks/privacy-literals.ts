/**
 * TC-PRIVACY-010..021 / TC-WIRE-001..003 — the binding privacy-literal guard.
 *
 * One schema-versioned registry is the authority for scope mode, enabled
 * generic rule ids, hashed-entry classes, the reason-bearing allowlist, and
 * exclusions. Validation fails closed in a pinned order; the working-tree scan
 * never reads history, writes nothing, and reports identifiers only.
 *
 * Runtime built-ins (`node:fs`, `node:child_process`, `node:crypto`) live only
 * at this check edge. The rule vocabulary is the shared pure module so the file
 * scan and the emitter policy cannot drift.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  findWindowMatches,
  matchGenericRules,
  normalizeLiteral,
  PRIVACY_CAPS,
  PRIVACY_MAX_LITERAL_LENGTH,
  PRIVACY_RULE_IDS,
  privacyDigestInput,
  privacyFingerprint,
} from "../../packages/adapters/src/io/privacy-rules.js";

export const REGISTRY_PATH = "scripts/checks/privacy-literals.registry.json";
export const SCHEMA_VERSION = "privacy.registry.v1";
export const SCOPE_MODE = "working-tree";
export const FIXTURE_ROOT = "tests/fixtures/privacy-literals";
export const CLASS_IDS = ["private-literal", "cloud-term"] as const;
export type PrivacyClassId = (typeof CLASS_IDS)[number];
export const AUTHORING_DEFAULT_CLASS: PrivacyClassId = "private-literal";

export type HashedEntry = {
  readonly id: string;
  readonly class: PrivacyClassId;
  readonly algorithm: "sha256";
  readonly hash: string;
  readonly length: number;
  readonly reason: string;
};

export type AllowlistEntry = {
  readonly id: string;
  readonly kind: "file" | "directory";
  readonly path: string;
  readonly rules: readonly string[];
  readonly reason: string;
};

export type PrivacyClass = {
  readonly emptyReason: string | null;
  readonly entries: readonly HashedEntry[];
};

export type PrivacyRegistry = {
  readonly schemaVersion: string;
  readonly scopeMode: string;
  readonly enabledRuleIds: readonly string[];
  readonly classes: Record<PrivacyClassId, PrivacyClass>;
  readonly allowlist: readonly AllowlistEntry[];
  readonly exclusions: readonly AllowlistEntry[];
};

export type PrivacyViolation = {
  readonly ruleOrEntryId: string;
  readonly file: string;
  readonly line: number;
  readonly fingerprint: string;
};

export type VacuousClass = { readonly class: string; readonly reason: string };

export type ScanSummary = {
  readonly scannedFiles: number;
  readonly binarySkipped: number;
  readonly excludedFiles: number;
  readonly allowlistedFiles: number;
  readonly enabledRules: number;
  readonly entriesByClass: Record<string, number>;
  readonly distinctLengths: number;
  readonly vacuousClasses: readonly VacuousClass[];
};

export type ScanOutcome = {
  readonly failures: readonly string[];
  readonly violations: readonly PrivacyViolation[];
  readonly summary: ScanSummary | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

const isLowerHex64 = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

const isIntegerInRange = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= PRIVACY_CAPS.minLength &&
  value <= PRIVACY_CAPS.maxLength;

/** A stable SHA-256 digest over the versioned domain-separated preimage. */
export const sha256Digest = (normalizedWindow: string): string =>
  createHash("sha256").update(privacyDigestInput(normalizedWindow), "utf8").digest("hex");

/**
 * Enumerate the working tree exactly once: tracked plus untracked-but-not-
 * ignored files, never history, never `.git`, never ignored content.
 */
export const listScanFiles = (root: string): string[] => {
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${(result.stderr ?? "").trim()}`);
  }
  return (result.stdout ?? "")
    .split("\0")
    .filter((file) => file.length > 0 && existsSync(join(root, file)))
    .sort();
};

const pathFormFailure = (
  label: string,
  path: string,
  kind: "file" | "directory",
): string | null => {
  if (path.length === 0) return `${label}: path is empty`;
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    return `${label}: path must be repository-relative (no absolute form)`;
  }
  if (path.includes("\\")) return `${label}: path must use POSIX separators`;
  if (/[*?[]/.test(path)) return `${label}: path must be exact (no wildcard or prefix form)`;
  if (path.includes("..")) return `${label}: path must not contain a parent segment`;
  if (path.endsWith("/")) return `${label}: path must not end with a separator`;
  if (kind === "directory" && path !== FIXTURE_ROOT) {
    return `${label}: only ${FIXTURE_ROOT} may be a directory entry`;
  }
  return null;
};

const validateRuleScope = (
  label: string,
  rules: unknown,
): { failure: string | null; rules: readonly string[] } => {
  if (!Array.isArray(rules) || rules.length === 0) {
    return { failure: `${label}: rules scope must be a non-empty array`, rules: [] };
  }
  const values: string[] = [];
  for (const rule of rules) {
    if (typeof rule !== "string" || rule.length === 0) {
      return { failure: `${label}: rules scope must contain rule ids`, rules: [] };
    }
    values.push(rule);
  }
  if (values.includes("*")) {
    if (values.length !== 1) {
      return { failure: `${label}: ["*"] must be the entire rules scope`, rules: values };
    }
    return { failure: null, rules: ["*"] };
  }
  const unknown = values.filter((rule) => !PRIVACY_RULE_IDS.includes(rule));
  if (unknown.length > 0) {
    return {
      failure: `${label}: unknown rule id in rules scope: ${unknown.join(", ")}`,
      rules: values,
    };
  }
  if (new Set(values).size !== values.length) {
    return { failure: `${label}: rules scope contains duplicates`, rules: values };
  }
  return { failure: null, rules: values };
};

const validateEntries = (registry: Record<string, unknown>): string | null => {
  const classes = registry.classes;
  if (!isRecord(classes)) return "classes must be an object (RV-07)";
  const declared = Object.keys(classes).sort();
  const expected = [...CLASS_IDS].sort();
  for (const key of declared) {
    if (!(CLASS_IDS as readonly string[]).includes(key)) {
      return `unknown class: ${key} (RV-07)`;
    }
  }
  for (const classId of CLASS_IDS) {
    if (!Object.hasOwn(classes, classId)) {
      return `declared class ${classId} has no class declaration block (RV-08)`;
    }
  }
  if (declared.length !== expected.length) {
    return "classes must be exactly the two declared class ids (RV-07/RV-08)";
  }

  const ids = new Set<string>();
  const digests = new Map<string, HashedEntry>();
  let total = 0;
  const lengthsByClass = new Map<string, Set<number>>();

  for (const classId of CLASS_IDS) {
    const rawClass = classes[classId];
    if (!isRecord(rawClass)) return `class ${classId}: declaration must be an object (RV-08)`;
    const emptyReason = rawClass.emptyReason;
    const rawEntries = rawClass.entries;
    if (!Array.isArray(rawEntries)) {
      return `class ${classId}: entries must be an array (RV-08)`;
    }
    if (rawEntries.length === 0) {
      if (!isNonEmptyString(emptyReason)) {
        return `class ${classId}: empty class requires a non-empty emptyReason (RV-09)`;
      }
    } else if (emptyReason !== null) {
      return `class ${classId}: non-empty class must set emptyReason to null (RV-09)`;
    }
    for (const [index, rawEntry] of rawEntries.entries()) {
      if (!isRecord(rawEntry)) {
        return `class ${classId} entry ${index}: entry must be an object (RV-11)`;
      }
      const entryId = rawEntry.id;
      if (!isNonEmptyString(entryId)) {
        return `class ${classId} entry ${index}: entry id must be a non-empty string (RV-20)`;
      }
      if (!hasExactKeys(rawEntry, ["id", "class", "algorithm", "hash", "length", "reason"])) {
        return `entry ${entryId}: must have exactly the keys id, class, algorithm, hash, length, reason (RV-11)`;
      }
      if (rawEntry.class !== classId) {
        return `entry ${entryId}: class does not match its declaration ${classId} (RV-07)`;
      }
      if (rawEntry.algorithm !== "sha256") {
        return `entry ${entryId}: unknown algorithm ${String(rawEntry.algorithm)} (RV-15)`;
      }
      if (!isLowerHex64(rawEntry.hash)) {
        return `entry ${entryId}: digest must be exactly 64 lowercase hex characters (RV-16)`;
      }
      if (!isIntegerInRange(rawEntry.length)) {
        return `entry ${entryId}: length must be an integer between ${PRIVACY_CAPS.minLength} and ${PRIVACY_CAPS.maxLength} (RV-17/RV-18)`;
      }
      if (!isNonEmptyString(rawEntry.reason)) {
        return `entry ${entryId}: reason is required (RV-19)`;
      }
      if (ids.has(entryId)) return `duplicate entry id: ${entryId} (RV-12)`;
      ids.add(entryId);
      const existing = digests.get(rawEntry.hash);
      if (existing !== undefined) {
        if (existing.length === rawEntry.length) {
          return `duplicate digest for entries ${existing.id} and ${entryId} (RV-13)`;
        }
        return `duplicate digest with inconsistent length for entries ${existing.id} and ${entryId} (RV-14)`;
      }
      const entry: HashedEntry = {
        id: entryId,
        class: classId,
        algorithm: "sha256",
        hash: rawEntry.hash,
        length: rawEntry.length,
        reason: rawEntry.reason,
      };
      digests.set(entry.hash, entry);
      total += 1;
      const lengths = lengthsByClass.get(classId) ?? new Set<number>();
      lengths.add(entry.length);
      lengthsByClass.set(classId, lengths);
    }
  }

  if (total > PRIVACY_CAPS.maxEntries) {
    return `entry cap exceeded: ${total} entries exceeds ${PRIVACY_CAPS.maxEntries} (RV-27)`;
  }
  for (const classId of CLASS_IDS) {
    const count = (classes[classId] as { entries?: unknown[] }).entries?.length ?? 0;
    if (count > PRIVACY_CAPS.maxEntriesPerClass) {
      return `class cap exceeded: ${classId} has ${count} entries, cap is ${PRIVACY_CAPS.maxEntriesPerClass} (RV-28)`;
    }
  }
  const distinct = new Set([...digests.values()].map((entry) => entry.length));
  if (distinct.size > PRIVACY_CAPS.maxDistinctLengths) {
    return `length cap exceeded: ${distinct.size} distinct lengths, cap is ${PRIVACY_CAPS.maxDistinctLengths} (RV-29)`;
  }
  return null;
};

const validateAllowlistLike = (
  label: "allowlist" | "exclusions",
  raw: unknown,
  scannedFiles: readonly string[],
  root: string,
): { failure: string | null; entries: readonly AllowlistEntry[] } => {
  if (!Array.isArray(raw))
    return { failure: `${label} must be an array (RV-21/RV-24)`, entries: [] };
  const entries: AllowlistEntry[] = [];
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [index, rawEntry] of raw.entries()) {
    if (!isRecord(rawEntry)) {
      return { failure: `${label} entry ${index}: must be an object`, entries: [] };
    }
    const id = rawEntry.id;
    if (!isNonEmptyString(id)) {
      return { failure: `${label} entry ${index}: id is required`, entries: [] };
    }
    const scopeLabel = `${label} entry ${id}`;
    if (!hasExactKeys(rawEntry, ["id", "kind", "path", "rules", "reason"])) {
      return {
        failure: `${scopeLabel}: must have exactly the keys id, kind, path, rules, reason`,
        entries: [],
      };
    }
    if (rawEntry.kind !== "file" && rawEntry.kind !== "directory") {
      return { failure: `${scopeLabel}: unknown kind ${String(rawEntry.kind)}`, entries: [] };
    }
    if (label === "exclusions" && rawEntry.kind !== "file") {
      return { failure: `${scopeLabel}: exclusions must be file entries`, entries: [] };
    }
    if (typeof rawEntry.path !== "string") {
      return { failure: `${scopeLabel}: path is required`, entries: [] };
    }
    if (!isNonEmptyString(rawEntry.reason)) {
      return { failure: `${scopeLabel}: reason is required (RV-23/RV-25)`, entries: [] };
    }
    const pathFailure = pathFormFailure(scopeLabel, rawEntry.path, rawEntry.kind);
    if (pathFailure !== null) {
      return { failure: `${pathFailure} (RV-26)`, entries: [] };
    }
    const scope = validateRuleScope(scopeLabel, rawEntry.rules);
    if (scope.failure !== null) return { failure: scope.failure, entries: [] };
    if (ids.has(id)) {
      return { failure: `duplicate ${label} entry id: ${id} (RV-22/RV-24)`, entries: [] };
    }
    ids.add(id);
    if (paths.has(rawEntry.path)) {
      return {
        failure: `duplicate ${label} entry path: ${rawEntry.path} (RV-22/RV-24)`,
        entries: [],
      };
    }
    paths.add(rawEntry.path);
    if (label === "allowlist") {
      const matches =
        rawEntry.kind === "file"
          ? scannedFiles.includes(rawEntry.path)
          : scannedFiles.some((file) => file.startsWith(`${rawEntry.path}/`));
      if (!matches) {
        return {
          failure: `allowlist entry ${id} matches no scanned path: ${rawEntry.path} (RV-21)`,
          entries: [],
        };
      }
    } else if (!existsSync(join(root, rawEntry.path))) {
      return {
        failure: `exclusion entry ${id} names a path that does not exist: ${rawEntry.path}`,
        entries: [],
      };
    }
    entries.push({
      id,
      kind: rawEntry.kind,
      path: rawEntry.path,
      rules: scope.rules,
      reason: rawEntry.reason,
    });
  }
  return { failure: null, entries };
};

/** Read the registry file, enforcing the size cap before parsing (fail-closed). */
export const readRegistry = (
  root: string,
): { failure: string | null; registry: PrivacyRegistry | null } => {
  const path = join(root, REGISTRY_PATH);
  if (!existsSync(path))
    return { failure: `registry file is missing: ${REGISTRY_PATH}`, registry: null };
  if (statSync(path).size > PRIVACY_CAPS.maxRegistryBytes) {
    return {
      failure: `registry file exceeds the ${PRIVACY_CAPS.maxRegistryBytes}-byte cap (RV-30)`,
      registry: null,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { failure: `registry file is not valid JSON: ${reason}`, registry: null };
  }
  if (!isRecord(parsed)) return { failure: "registry must be a JSON object", registry: null };

  if (!Object.hasOwn(parsed, "schemaVersion") || !isNonEmptyString(parsed.schemaVersion)) {
    return { failure: `schema version is missing (RV-01)`, registry: null };
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    return { failure: `schema version must be ${SCHEMA_VERSION} (RV-02)`, registry: null };
  }
  if (parsed.scopeMode !== SCOPE_MODE) {
    return { failure: `scope mode must be ${SCOPE_MODE} (RV-03/RV-04)`, registry: null };
  }
  const enabled = parsed.enabledRuleIds;
  if (!Array.isArray(enabled) || enabled.some((id) => typeof id !== "string")) {
    return {
      failure: "enabled rule ids must be an array of rule id strings (RV-05)",
      registry: null,
    };
  }
  if (new Set(enabled).size !== enabled.length) {
    return { failure: "duplicate enabled rule id (RV-10)", registry: null };
  }
  const missing = PRIVACY_RULE_IDS.filter((id) => !enabled.includes(id));
  const unknown = enabled.filter((id) => !PRIVACY_RULE_IDS.includes(id));
  if (missing.length > 0 || unknown.length > 0) {
    return {
      failure: `enabled rule id set must equal the committed rule ids (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"}) (RV-05/RV-06)`,
      registry: null,
    };
  }

  const entryFailure = validateEntries(parsed);
  if (entryFailure !== null) return { failure: entryFailure, registry: null };

  let scannedFiles: string[];
  try {
    scannedFiles = listScanFiles(root);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { failure: `cannot enumerate the working tree: ${reason}`, registry: null };
  }
  const allowlist = validateAllowlistLike("allowlist", parsed.allowlist, scannedFiles, root);
  if (allowlist.failure !== null) return { failure: allowlist.failure, registry: null };
  const exclusions = validateAllowlistLike("exclusions", parsed.exclusions, scannedFiles, root);
  if (exclusions.failure !== null) return { failure: exclusions.failure, registry: null };

  const classes = parsed.classes as Record<PrivacyClassId, PrivacyClass>;
  return {
    failure: null,
    registry: {
      schemaVersion: SCHEMA_VERSION,
      scopeMode: SCOPE_MODE,
      enabledRuleIds: [...enabled],
      classes,
      allowlist: allowlist.entries,
      exclusions: exclusions.entries,
    },
  };
};

const isExcluded = (file: string, exclusions: readonly AllowlistEntry[]): boolean =>
  exclusions.some((entry) => file === entry.path);

const isAllowlisted = (file: string, allowlist: readonly AllowlistEntry[]): boolean =>
  allowlist.some((entry) =>
    entry.kind === "file" ? file === entry.path : file.startsWith(`${entry.path}/`),
  );

const looksBinary = (buffer: Buffer): boolean => {
  const window = buffer.subarray(0, 8192);
  if (window.includes(0)) return true;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(window);
    return false;
  } catch {
    return true;
  }
};

const distinctEntryLengths = (registry: PrivacyRegistry): number[] => {
  const lengths = new Set<number>();
  for (const classId of CLASS_IDS) {
    for (const entry of registry.classes[classId].entries) lengths.add(entry.length);
  }
  return [...lengths].sort((left, right) => left - right);
};

const entriesByDigest = (registry: PrivacyRegistry): Map<string, HashedEntry> => {
  const map = new Map<string, HashedEntry>();
  for (const classId of CLASS_IDS) {
    for (const entry of registry.classes[classId].entries) map.set(entry.hash, entry);
  }
  return map;
};

const summarize = (
  registry: PrivacyRegistry,
  scannedFiles: number,
  binarySkipped: number,
  excludedFiles: number,
  allowlistedFiles: number,
): ScanSummary => {
  const entriesByClass: Record<string, number> = {};
  const vacuousClasses: VacuousClass[] = [];
  for (const classId of CLASS_IDS) {
    const rawClass = registry.classes[classId];
    entriesByClass[classId] = rawClass.entries.length;
    if (rawClass.entries.length === 0 && rawClass.emptyReason !== null) {
      vacuousClasses.push({ class: classId, reason: rawClass.emptyReason });
    }
  }
  return {
    scannedFiles,
    binarySkipped,
    excludedFiles,
    allowlistedFiles,
    enabledRules: registry.enabledRuleIds.length,
    entriesByClass,
    distinctLengths: distinctEntryLengths(registry).length,
    vacuousClasses,
  };
};

const scanFileViolations = (
  root: string,
  file: string,
  registry: PrivacyRegistry,
  digests: Map<string, HashedEntry>,
  lengths: readonly number[],
): PrivacyViolation[] => {
  const buffer = readFileSync(join(root, file));
  if (looksBinary(buffer)) return [];
  const text = buffer.toString("utf8");
  const violations: PrivacyViolation[] = [];
  const seen = new Set<string>();

  for (const match of matchGenericRules(text)) {
    if (match.suppressionClass !== null) continue;
    const key = `rule:${match.id}:${match.line}:${match.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({
      ruleOrEntryId: match.id,
      file,
      line: match.line,
      fingerprint: privacyFingerprint(match.id),
    });
  }

  for (const match of findWindowMatches(text, lengths, sha256Digest, (digest) =>
    digests.has(digest),
  )) {
    const entry = digests.get(match.digest);
    if (entry === undefined) continue;
    const key = `entry:${entry.id}:${match.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    violations.push({
      ruleOrEntryId: entry.id,
      file,
      line: match.line,
      fingerprint: privacyFingerprint(entry.id),
    });
  }
  return violations;
};

/** Validate the registry and scan the working tree. Never throws on findings. */
export const runPrivacyScan = (root: string): ScanOutcome => {
  const read = readRegistry(root);
  if (read.failure !== null || read.registry === null) {
    return { failures: [read.failure ?? "registry is invalid"], violations: [], summary: null };
  }
  const registry = read.registry;
  const digests = entriesByDigest(registry);
  const lengths = distinctEntryLengths(registry);

  let files: string[];
  try {
    files = listScanFiles(root);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      failures: [`cannot enumerate the working tree: ${reason}`],
      violations: [],
      summary: null,
    };
  }

  let binarySkipped = 0;
  let excludedFiles = 0;
  let allowlistedFiles = 0;
  let scannedFiles = 0;
  const violations: PrivacyViolation[] = [];

  for (const file of files) {
    if (isExcluded(file, registry.exclusions)) {
      excludedFiles += 1;
      continue;
    }
    if (isAllowlisted(file, registry.allowlist)) {
      allowlistedFiles += 1;
      continue;
    }
    const buffer = readFileSync(join(root, file));
    if (looksBinary(buffer)) {
      binarySkipped += 1;
      continue;
    }
    scannedFiles += 1;
    violations.push(...scanFileViolations(root, file, registry, digests, lengths));
  }

  violations.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.ruleOrEntryId.localeCompare(right.ruleOrEntryId),
  );

  return {
    failures: [],
    violations,
    summary: summarize(registry, scannedFiles, binarySkipped, excludedFiles, allowlistedFiles),
  };
};

export type AuthoringRecord = {
  readonly id: string;
  readonly class: PrivacyClassId;
  readonly algorithm: "sha256";
  readonly hash: string;
  readonly length: number;
  readonly reason: string;
};

export type AuthoringOutcome =
  | { readonly ok: true; readonly record: AuthoringRecord; readonly digestInput: string }
  | { readonly ok: false; readonly failure: string };

/**
 * Build a paste-ready registry entry from a supplied literal. The caller reads
 * stdin; this function never echoes the literal in a failure message.
 */
export const buildAuthoringRecord = (
  literal: string,
  className: PrivacyClassId = AUTHORING_DEFAULT_CLASS,
): AuthoringOutcome => {
  const normalized = normalizeLiteral(literal);
  if (normalized.length === 0) {
    return { ok: false, failure: "authoring input is empty or whitespace-only" };
  }
  if (normalized.length < PRIVACY_CAPS.minLength) {
    return {
      ok: false,
      failure: `authoring input is shorter than the ${PRIVACY_CAPS.minLength}-character minimum`,
    };
  }
  if (normalized.length > PRIVACY_MAX_LITERAL_LENGTH) {
    return {
      ok: false,
      failure: `authoring input exceeds the ${PRIVACY_MAX_LITERAL_LENGTH}-character normalized cap`,
    };
  }
  const digestInput = privacyDigestInput(normalized);
  return {
    ok: true,
    digestInput,
    record: {
      id: "<assign-entry-id>",
      class: className,
      algorithm: "sha256",
      hash: createHash("sha256").update(digestInput, "utf8").digest("hex"),
      length: normalized.length,
      reason: "<write-reason>",
    },
  };
};

export const renderHuman = (outcome: ScanOutcome): string[] => {
  const lines: string[] = [];
  for (const failure of outcome.failures) lines.push(`FAIL privacy-literals: ${failure}`);
  if (outcome.failures.length === 0 && outcome.summary !== null) {
    const summary = outcome.summary;
    lines.push(
      `OK privacy-literals: ${summary.scannedFiles} file(s) scanned, ${summary.enabledRules} rule(s), ` +
        `${summary.distinctLengths} distinct length(s), ${outcome.violations.length} violation(s)`,
    );
    for (const [classId, count] of Object.entries(summary.entriesByClass)) {
      const vacuous = summary.vacuousClasses.find((entry) => entry.class === classId);
      lines.push(
        `  class ${classId}: ${count} entr${count === 1 ? "y" : "ies"}` +
          (vacuous ? ` (vacuous: ${vacuous.reason})` : ""),
      );
    }
    lines.push(
      `  binary skipped: ${summary.binarySkipped}; excluded: ${summary.excludedFiles}; allowlisted: ${summary.allowlistedFiles}`,
    );
  }
  for (const violation of outcome.violations) {
    lines.push(
      `FAIL privacy-literals: ${violation.ruleOrEntryId} ${violation.file}:${violation.line} fingerprint=${violation.fingerprint}`,
    );
  }
  return lines;
};

export const renderJson = (outcome: ScanOutcome): string =>
  JSON.stringify(
    {
      status:
        outcome.failures.length > 0
          ? "invalid"
          : outcome.violations.length > 0
            ? "violations"
            : "ok",
      failures: outcome.failures,
      violations: outcome.violations,
      summary: outcome.summary,
    },
    null,
    2,
  );

type ParsedArgs = {
  readonly json: boolean;
  readonly author: boolean;
  readonly class: PrivacyClassId;
  readonly failure: string | null;
};

export const parseArgs = (argv: readonly string[]): ParsedArgs => {
  let json = false;
  let author = false;
  let className: PrivacyClassId = AUTHORING_DEFAULT_CLASS;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--author") {
      author = true;
      continue;
    }
    if (argument === "--class" || argument?.startsWith("--class=")) {
      const value = argument === "--class" ? argv[index + 1] : argument.slice("--class=".length);
      if (argument === "--class") index += 1;
      if (value !== "private-literal" && value !== "cloud-term") {
        return { json, author, class: className, failure: `unknown class: ${String(value)}` };
      }
      className = value;
      continue;
    }
    if (argument !== undefined && argument.startsWith("-")) {
      return { json, author, class: className, failure: `unknown flag: ${argument}` };
    }
  }
  return { json, author, class: className, failure: null };
};

const readPipedStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const readHiddenTerminal = async (): Promise<string> =>
  new Promise((resolve) => {
    process.stderr.write("Enter literal (input hidden): ");
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let value = "";
    const finish = (): void => {
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stderr.write("\n");
    };
    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (character === "\u0003") {
          finish();
          process.exit(2);
        }
        if (character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    process.stdin.on("data", onData);
  });

const detectCi = (env: NodeJS.ProcessEnv): string | null => {
  if (env.CI !== undefined && env.CI !== "") return "CI";
  if (env.GITHUB_ACTIONS !== undefined && env.GITHUB_ACTIONS !== "") return "GITHUB_ACTIONS";
  return null;
};

const runAuthoring = async (className: PrivacyClassId, env: NodeJS.ProcessEnv): Promise<number> => {
  const ciMarker = detectCi(env);
  if (ciMarker !== null) {
    process.stderr.write(
      `FAIL privacy-literals: authoring mode refuses to run under CI (${ciMarker})\n`,
    );
    return 2;
  }
  const raw = process.stdin.isTTY ? await readHiddenTerminal() : await readPipedStdin();
  const outcome = buildAuthoringRecord(raw, className);
  if (!outcome.ok) {
    process.stderr.write(`FAIL privacy-literals: ${outcome.failure}\n`);
    return 2;
  }
  process.stdout.write(`${JSON.stringify(outcome.record)}\n`);
  return 0;
};

const main = async (): Promise<number> => {
  const args = parseArgs(process.argv.slice(2));
  if (args.failure !== null) {
    process.stderr.write(`FAIL privacy-literals: ${args.failure}\n`);
    return 2;
  }
  if (args.author) return runAuthoring(args.class, process.env);
  const outcome = runPrivacyScan(process.cwd());
  const text = args.json ? renderJson(outcome) : renderHuman(outcome).join("\n");
  const reportFailures = outcome.failures.length > 0 || outcome.violations.length > 0;
  process.stdout.write(`${text}\n`);
  return reportFailures ? 1 : 0;
};

if (import.meta.main) {
  process.exit(await main());
}
