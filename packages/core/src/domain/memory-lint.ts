/**
 * The pure memory evaluation (GH-301 F-5..F-8, DM-4; NFR-1, NFR-4).
 *
 * One deterministic pass over an injected file list, a repository-relative text
 * map (carried by the scanned files), the injected privacy vocabulary, and ONE
 * fixed "today". No I/O, no fs, no clock, no randomness, no network. The
 * scanner owns reads and frontmatter parsing; the check edge owns the single
 * ambient date read and the actual printing. This module composes the
 * deterministic lines the edge writes.
 */
import {
  MEMORY_FINDING_AREA_ORDER,
  MEMORY_FINDING_REGISTER,
  MEMORY_MAX_PRINTED_ADVISORIES,
  MEMORY_MAX_PRINTED_ERRORS,
  MEMORY_RECORD_BASIS_VALUES,
  MEMORY_RECORD_EVIDENCE_PREFIXES,
  MEMORY_RECORD_FILE_NAME_PATTERN,
  MEMORY_RECORD_ID_PATTERN,
  MEMORY_RECORD_KINDS,
  MEMORY_RECORD_OPTIONAL_KEYS,
  MEMORY_RECORD_REQUIRED_KEYS,
  MEMORY_RECORD_SCOPES,
  MEMORY_RECORD_SOURCES,
  MEMORY_RECORD_STATUSES,
  MEMORY_RECORD_TRUST,
  MEMORY_REVALIDATION_MARKER_KEY,
  MEMORY_ROOT,
  MEMORY_WARN_RULE_IDS,
  STATEMENT_MAX_CHARS,
  type MemoryEvaluationInput,
  type MemoryEvaluationResult,
  type MemoryFinding,
  type MemoryFindingArea,
  type MemoryFindingSeverity,
  type MemoryScannedFile,
  type MemorySummary,
} from "#contracts";

const ID_PATTERN = new RegExp(MEMORY_RECORD_ID_PATTERN);
const FILE_NAME_PATTERN = new RegExp(MEMORY_RECORD_FILE_NAME_PATTERN);
const RECORD_AREAS = ["lessons", "tacit", "preferences"] as const;

type ParsedRecord = {
  readonly file: MemoryScannedFile;
  readonly relative: string;
  readonly fields: Readonly<Record<string, unknown>>;
};

const relativeOf = (path: string): string =>
  path.startsWith(`${MEMORY_ROOT}/`) ? path.slice(MEMORY_ROOT.length + 1) : path;

const partsOf = (relative: string): readonly string[] => relative.split("/");

const isRecordRelative = (relative: string): boolean => {
  const parts = partsOf(relative);
  const [area, name, third] = parts;
  if (area === undefined || name === undefined) return false;
  if ((RECORD_AREAS as readonly string[]).includes(area)) {
    return parts.length === 2 && name.endsWith(".md");
  }
  if (area === "guilds") {
    return (
      parts.length === 3 && name !== "README.md" && third !== undefined && third.endsWith(".md")
    );
  }
  return false;
};

const isEntryPoint = (relative: string): boolean => /^agents\/[^/]+\/README\.md$/.test(relative);

const hasOwn = (value: Readonly<Record<string, unknown>>, key: string): boolean =>
  Object.hasOwn(value, key);

const stringOf = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const nonEmpty = (value: string | undefined): value is string =>
  value !== undefined && value.trim().length > 0;

const idListOf = (value: unknown): readonly string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value as readonly string[];
  }
  return [];
};

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
};

const fileNameMatches = (relative: string, id: string): boolean => {
  const name = partsOf(relative).at(-1) ?? "";
  return name === `${id}.md` || (name.startsWith(`${id}-`) && FILE_NAME_PATTERN.test(name));
};

const areaOf = (ruleId: string): MemoryFindingArea => {
  const area = ruleId.split(".")[1];
  if (area === undefined || !(MEMORY_FINDING_AREA_ORDER as readonly string[]).includes(area)) {
    throw new Error(`unregistered memory finding identity ${ruleId}`);
  }
  return area as MemoryFindingArea;
};

const severityOf = (ruleId: string, area: MemoryFindingArea): MemoryFindingSeverity => {
  if (area === "derivable") return "warn";
  if ((MEMORY_WARN_RULE_IDS as readonly string[]).includes(ruleId)) return "warn";
  if (area === "secret") return MEMORY_FINDING_REGISTER.secret.severity;
  return MEMORY_FINDING_REGISTER[area].severity;
};

/** The pure evaluation. */
export const evaluateMemory = (input: MemoryEvaluationInput): MemoryEvaluationResult => {
  const findings: MemoryFinding[] = [];
  const add = (
    ruleId: string,
    path: string,
    detail: string,
    options: { readonly line?: number; readonly severity?: MemoryFindingSeverity } = {},
  ): void => {
    const area = areaOf(ruleId);
    findings.push({
      ruleId,
      area,
      severity: options.severity ?? severityOf(ruleId, area),
      path,
      ...(options.line === undefined ? {} : { line: options.line }),
      detail,
    });
  };

  const records: ParsedRecord[] = [];
  for (const file of input.files) {
    const relative = relativeOf(file.path);
    if (!isRecordRelative(relative)) continue;
    if (file.frontmatter.state === "absent") {
      add("memory.schema.frontmatter-missing", file.path, "frontmatter block is absent");
      continue;
    }
    if (file.frontmatter.state === "malformed") {
      add("memory.schema.frontmatter-malformed", file.path, "frontmatter is not parseable YAML");
      continue;
    }
    records.push({ file, relative, fields: file.frontmatter.value });
  }

  const required = new Set<string>(MEMORY_RECORD_REQUIRED_KEYS);
  const optional = new Set<string>(MEMORY_RECORD_OPTIONAL_KEYS);
  const seenIds = new Map<string, string>();

  for (const record of records) {
    const { file, relative, fields } = record;
    const path = file.path;
    for (const key of MEMORY_RECORD_REQUIRED_KEYS) {
      if (key === "evidence" || key === "created_by") continue;
      if (!hasOwn(fields, key)) {
        add("memory.schema.keys-missing", path, `required key ${key} is absent`);
      }
    }
    for (const key of Object.keys(fields)) {
      if (!required.has(key) && !optional.has(key)) {
        add("memory.schema.key-unknown", path, `undeclared key ${key}`);
      }
    }
    const id = stringOf(fields.id);
    if (id !== undefined && !ID_PATTERN.test(id)) {
      add("memory.schema.id-malformed", path, `id ${id} is outside the declared grammar`);
    }
    if (id !== undefined && ID_PATTERN.test(id)) {
      if (!fileNameMatches(relative, id)) {
        add("memory.schema.file-name-mismatch", path, `file name does not begin with id ${id}`);
      }
      const first = seenIds.get(id);
      if (first === undefined) seenIds.set(id, path);
      else add("memory.schema.id-duplicate", path, `id ${id} is already used by ${first}`);
    }

    const vocabulary = (key: string, values: readonly string[]): string | undefined => {
      if (!hasOwn(fields, key)) return undefined;
      const value = fields[key];
      if (typeof value !== "string" || !values.includes(value)) {
        add("memory.schema.value-unknown", path, `${key} is outside the closed vocabulary`);
        return undefined;
      }
      return value;
    };

    vocabulary("kind", MEMORY_RECORD_KINDS);
    vocabulary("scope", MEMORY_RECORD_SCOPES);
    vocabulary("trust", MEMORY_RECORD_TRUST);
    const status = vocabulary("status", MEMORY_RECORD_STATUSES);
    const source = vocabulary("source", MEMORY_RECORD_SOURCES);
    if (hasOwn(fields, "basis")) {
      const basis = fields.basis;
      if (
        typeof basis !== "string" ||
        !(MEMORY_RECORD_BASIS_VALUES as readonly string[]).includes(basis)
      ) {
        add("memory.schema.value-unknown", path, "basis is outside the capture-bar set");
      }
    }
    if (hasOwn(fields, "applies_when")) {
      const applies = fields.applies_when;
      const scalar =
        typeof applies === "string" || (Array.isArray(applies) && applies.length === 1);
      if (!scalar) {
        add("memory.schema.value-unknown", path, "applies_when is not a scalar predicate");
      }
    }
    if (hasOwn(fields, "confidence") && typeof fields.confidence !== "number") {
      add("memory.schema.value-unknown", path, "confidence is not a number");
    }
    if (
      hasOwn(fields, "evaluation") &&
      (typeof fields.evaluation !== "object" ||
        fields.evaluation === null ||
        Array.isArray(fields.evaluation))
    ) {
      add("memory.schema.value-unknown", path, "evaluation is not a mapping");
    }
    const statement = stringOf(fields.statement);
    if (statement !== undefined && statement.length > STATEMENT_MAX_CHARS) {
      add(
        "memory.schema.statement-too-long",
        path,
        `statement length ${statement.length} exceeds the published bound ${STATEMENT_MAX_CHARS}`,
      );
    }
    const kind = stringOf(fields.kind);
    if (kind === "preference" && source !== undefined && source !== "human_correction") {
      add(
        "memory.schema.preference-source",
        path,
        "a preference record source is not human_correction",
      );
    }
    const guildFolder = relative.startsWith("guilds/") ? partsOf(relative)[1] : undefined;
    const guild = stringOf(fields.guild);
    if (guildFolder !== undefined) {
      if (guild !== guildFolder) {
        add("memory.schema.guild-mismatch", path, "guild does not equal its folder name");
      }
    } else if (hasOwn(fields, "guild")) {
      add("memory.schema.guild-mismatch", path, "guild is present outside a guild folder");
    }
    if (status === "superseded" && !hasOwn(fields, "superseded_by")) {
      add("memory.schema.superseded-by-missing", path, "a superseded record lacks superseded_by");
    }

    const created = stringOf(fields.created);
    if (created !== undefined) {
      if (!isIsoDate(created)) {
        add("memory.dating.created-malformed", path, "created is not YYYY-MM-DD");
      } else if (created > input.today) {
        add("memory.dating.created-future", path, `created ${created} is after the injected date`);
      }
    }
    if (hasOwn(fields, "revalidate_after")) {
      const revalidate = stringOf(fields.revalidate_after);
      if (revalidate === undefined || !isIsoDate(revalidate)) {
        add("memory.dating.revalidate-malformed", path, "revalidate_after is not YYYY-MM-DD");
      } else if (revalidate < input.today) {
        add("memory.dating.revalidate-expired", path, "the revalidation window has passed");
      }
    }
    if (
      status === "authoritative" &&
      kind === "lesson" &&
      hasOwn(fields, MEMORY_REVALIDATION_MARKER_KEY) &&
      !hasOwn(fields, "revalidate_after")
    ) {
      add(
        "memory.dating.revalidate-missing",
        path,
        "an authoritative behaviour-changing lesson lacks revalidate_after",
      );
    }

    if (!hasOwn(fields, "evidence")) {
      add("memory.provenance.evidence-missing", path, "the evidence link is absent");
    } else {
      const evidence = stringOf(fields.evidence);
      const prefix = MEMORY_RECORD_EVIDENCE_PREFIXES.find(
        (entry) => evidence?.startsWith(entry) === true,
      );
      if (evidence === undefined || !nonEmpty(evidence.slice(prefix?.length ?? 0))) {
        add("memory.provenance.evidence-missing", path, "the evidence link is empty");
      } else if (prefix === undefined) {
        add(
          "memory.provenance.evidence-shape-unknown",
          path,
          "evidence is outside the five shapes",
        );
      }
    }
    if (!hasOwn(fields, "created_by") || !nonEmpty(stringOf(fields.created_by))) {
      add("memory.provenance.created-by-missing", path, "created_by is absent");
    }
  }

  for (const file of input.files) {
    const relative = relativeOf(file.path);
    if (!isEntryPoint(relative)) continue;
    const lines = file.text.split("\n");
    for (const [index, line] of lines.entries()) {
      const capture = /^\s*-\s+(\S+)\s*:/.exec(line);
      const token = capture?.[1];
      if (token === undefined || !/\d/.test(token)) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(token)) {
        add(
          "memory.dating.entry-line-date",
          file.path,
          `capture line date ${token} is not YYYY-MM-DD`,
          {
            line: index + 1,
          },
        );
      }
    }
  }

  const ids = new Map<string, ParsedRecord>();
  for (const record of records) {
    const id = stringOf(record.fields.id);
    if (id !== undefined && ID_PATTERN.test(id) && !ids.has(id)) ids.set(id, record);
  }
  const allPaths = new Set(input.files.map((file) => file.path));
  const resolveLink = (directory: string, target: string): string => {
    const stack = directory.length === 0 ? [] : directory.split("/");
    for (const segment of target.split("/")) {
      if (segment === "" || segment === ".") continue;
      if (segment === "..") stack.pop();
      else stack.push(segment);
    }
    return stack.join("/");
  };
  for (const record of records) {
    const { file, relative, fields } = record;
    const recordId = stringOf(fields.id) ?? "";
    for (const target of idListOf(fields.supersedes)) {
      if (!ids.has(target)) {
        add(
          "memory.reference.supersedes-dangling",
          file.path,
          `supersedes names unknown id ${target}`,
        );
        continue;
      }
      const targetRecord = ids.get(target);
      if (stringOf(targetRecord?.fields.superseded_by) !== recordId) {
        add(
          "memory.reference.supersede-asymmetry",
          file.path,
          `${target} does not name ${recordId} in superseded_by`,
        );
      }
    }
    const replacement = stringOf(fields.superseded_by);
    if (replacement !== undefined && !ids.has(replacement)) {
      add(
        "memory.reference.superseded-by-dangling",
        file.path,
        `superseded_by names unknown id ${replacement}`,
      );
    }
    if (replacement !== undefined && ids.has(replacement)) {
      const replacementRecord = ids.get(replacement);
      const reciprocal = replacementRecord?.fields.supersedes;
      if (!idListOf(reciprocal).includes(recordId)) {
        add(
          "memory.reference.supersede-asymmetry",
          file.path,
          `${replacement} does not name ${recordId} in supersedes`,
        );
      }
    }
    for (const target of idListOf(fields.contradicts)) {
      if (!ids.has(target)) {
        add(
          "memory.reference.contradicts-dangling",
          file.path,
          `contradicts names unknown id ${target}`,
        );
      }
    }
    const bodyStart = file.text.indexOf("\n---", 3);
    const body = bodyStart === -1 ? "" : file.text.slice(bodyStart + 4);
    const directory = partsOf(relative).slice(0, -1).join("/");
    for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const rawTarget = match[1];
      if (rawTarget === undefined) continue;
      const target = rawTarget.split("#")[0] ?? "";
      if (target.length === 0 || /^[a-z]+:/i.test(target) || target.startsWith("#")) continue;
      const repoPath = `${MEMORY_ROOT}/${resolveLink(directory, target)}`;
      if (!allPaths.has(repoPath)) {
        add(
          "memory.reference.link-dangling",
          file.path,
          `link target ${target} resolves to no file`,
        );
      }
    }
  }

  const order = new Map(MEMORY_FINDING_AREA_ORDER.map((area, index) => [area, index]));
  const sorted = [...findings].sort((left, right) => {
    const area = (order.get(left.area) ?? 0) - (order.get(right.area) ?? 0);
    if (area !== 0) return area;
    if (left.path !== right.path) return left.path < right.path ? -1 : 1;
    const line = (left.line ?? 0) - (right.line ?? 0);
    if (line !== 0) return line;
    return left.ruleId < right.ruleId ? -1 : left.ruleId > right.ruleId ? 1 : 0;
  });
  const errors = sorted.filter((finding) => finding.severity === "error");
  const advisories = sorted.filter((finding) => finding.severity === "warn");
  const format = (finding: MemoryFinding): string =>
    `${finding.severity === "error" ? "FAIL" : "WARN"} memory-lint: ${finding.ruleId} ${finding.path}${
      finding.line === undefined ? "" : `:${finding.line}`
    } ${finding.detail}`;
  const lines: string[] = [
    ...errors.slice(0, MEMORY_MAX_PRINTED_ERRORS).map(format),
    ...advisories.slice(0, MEMORY_MAX_PRINTED_ADVISORIES).map(format),
    `memory-lint: records=${records.length} areas=${MEMORY_FINDING_AREA_ORDER.length} errors=${errors.length} advisories=${advisories.length}`,
  ];
  if (
    errors.length > MEMORY_MAX_PRINTED_ERRORS ||
    advisories.length > MEMORY_MAX_PRINTED_ADVISORIES
  ) {
    lines.push(
      `memory-lint: truncated errors=${errors.length} advisories=${advisories.length} printed-errors=${Math.min(errors.length, MEMORY_MAX_PRINTED_ERRORS)} printed-advisories=${Math.min(advisories.length, MEMORY_MAX_PRINTED_ADVISORIES)}`,
    );
  }
  const summary: MemorySummary = {
    records: records.length,
    areas: MEMORY_FINDING_AREA_ORDER.length,
    errors: errors.length,
    advisories: advisories.length,
  };
  return {
    findings: sorted,
    summary,
    exitCode: errors.length > 0 ? 1 : 0,
    lines,
  };
};
