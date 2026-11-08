/**
 * The pure candidate evaluator (GH-240 F-4, DM-2, DEC-5, DEC-6).
 *
 * One deterministic single pass: schema -> capture bar -> evidence link ->
 * dedup -> supersession/contradiction -> routing. No similarity scoring,
 * embedding, or model judgment participates; no I/O or clock is read.
 */
import {
  CAPSULE_CANDIDATE_CLASSES,
  CAPSULE_CANDIDATE_OPTIONAL_KEYS,
  CAPSULE_CANDIDATE_REQUIRED_KEYS,
  CAPSULE_CANDIDATE_SCOPES,
  CAPSULE_CANDIDATE_STATUSES,
  CAPSULE_CANDIDATE_TRUST,
  CAPSULE_CAPTURE_BAR_BASES,
  CAPSULE_EVIDENCE_PREFIXES,
  CAPSULE_MAX_INDEX_LINES,
  CAPSULE_SLUG_PATTERN,
  type CapsuleCandidate,
  type CapsuleCandidateClass,
  type CapsuleCandidateDecision,
  type CapsuleCandidateDocument,
  type CapsuleCandidateEvaluation,
  type CapsuleMemoryFacts,
  type CapsuleMemoryRecord,
  type CapsulePromotionWrite,
  CAPSULE_REJECTION_REASONS,
} from "#contracts";

const SLUG = new RegExp(CAPSULE_SLUG_PATTERN);
const RECORD_ID = /^(lesson|tacit)-\d{4}-\d{3}$/;
const PATH_SHAPED = /[/\\]|\.\./;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringOf = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const idListOf = (value: unknown): readonly string[] | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value as readonly string[];
  }
  return undefined;
};

/** Exact normalized-statement equality: trim, en-US lower-case, collapse spaces. */
export const normalizeCandidateStatement = (statement: string): string =>
  statement.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");

const escapeYaml = (value: string): string => value.replace(/"/g, '\\"').replace(/\n/g, " ");

/** Validate one candidate document against the closed schema (F-4, DM-2). */
export const validateCandidate = (
  value: unknown,
):
  | { readonly ok: true; readonly candidate: CapsuleCandidate }
  | { readonly ok: false; readonly detail: string } => {
  if (!isRecord(value)) return { ok: false, detail: "candidate is not a mapping" };
  const required = CAPSULE_CANDIDATE_REQUIRED_KEYS;
  const optional = new Set<string>(CAPSULE_CANDIDATE_OPTIONAL_KEYS);
  const allowed = new Set<string>([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return { ok: false, detail: `undeclared candidate key ${key}` };
  }
  for (const key of required) {
    if (key === "basis" || key === "evidence") continue;
    if (!Object.hasOwn(value, key)) return { ok: false, detail: `missing required key ${key}` };
  }
  const id = stringOf(value.id);
  if (id === undefined || !SLUG.test(id)) {
    return { ok: false, detail: "id is outside the declared slug shape" };
  }
  const candidateClass = value.class;
  if (
    typeof candidateClass !== "string" ||
    !(CAPSULE_CANDIDATE_CLASSES as readonly string[]).includes(candidateClass)
  ) {
    return { ok: false, detail: "class is outside the closed set" };
  }
  const scope = value.scope;
  if (
    typeof scope !== "string" ||
    !(CAPSULE_CANDIDATE_SCOPES as readonly string[]).includes(scope)
  ) {
    return { ok: false, detail: "scope is outside the closed set" };
  }
  const status = value.status;
  if (
    typeof status !== "string" ||
    !(CAPSULE_CANDIDATE_STATUSES as readonly string[]).includes(status)
  ) {
    return { ok: false, detail: "status is outside the closed set" };
  }
  const trust = value.trust;
  if (
    typeof trust !== "string" ||
    !(CAPSULE_CANDIDATE_TRUST as readonly string[]).includes(trust)
  ) {
    return { ok: false, detail: "trust is outside the closed set" };
  }
  const statement = stringOf(value.statement);
  if (statement === undefined || statement.trim().length === 0) {
    return { ok: false, detail: "statement is empty" };
  }
  const source = stringOf(value.source);
  if (source === undefined || source.trim().length === 0) {
    return { ok: false, detail: "source is empty" };
  }
  const createdBy = stringOf(value.created_by);
  if (createdBy === undefined || createdBy.trim().length === 0) {
    return { ok: false, detail: "created_by is empty" };
  }
  const created = stringOf(value.created);
  if (created === undefined || created.trim().length === 0) {
    return { ok: false, detail: "created is empty" };
  }
  const basisValue = stringOf(value.basis);
  if (basisValue !== undefined && basisValue.length > 0) {
    if (!(CAPSULE_CAPTURE_BAR_BASES as readonly string[]).includes(basisValue)) {
      return { ok: false, detail: "basis is outside the capture-bar set" };
    }
  }
  const evidenceValue = stringOf(value.evidence);
  if (evidenceValue !== undefined && evidenceValue.length > 0) {
    const prefix = CAPSULE_EVIDENCE_PREFIXES.find((candidate) =>
      evidenceValue.startsWith(candidate),
    );
    if (prefix === undefined || evidenceValue.slice(prefix.length).trim().length === 0) {
      return { ok: false, detail: "evidence is outside the five declared shapes" };
    }
  }
  const supersedes = idListOf(value.supersedes);
  const contradicts = idListOf(value.contradicts);
  if (value.supersedes !== undefined && supersedes === undefined) {
    return { ok: false, detail: "supersedes is not a record-id list" };
  }
  if (value.contradicts !== undefined && contradicts === undefined) {
    return { ok: false, detail: "contradicts is not a record-id list" };
  }
  return {
    ok: true,
    candidate: {
      id,
      class: candidateClass as CapsuleCandidateClass,
      scope: scope as CapsuleCandidate["scope"],
      statement,
      evidence: evidenceValue ?? "",
      basis: (basisValue ?? "") as CapsuleCandidate["basis"],
      source,
      trust: trust as CapsuleCandidate["trust"],
      status: status as CapsuleCandidate["status"],
      created_by: createdBy,
      created,
      ...(stringOf(value.rationale) === undefined
        ? {}
        : { rationale: stringOf(value.rationale) as string }),
      ...(stringOf(value.applies_when) === undefined
        ? {}
        : { applies_when: stringOf(value.applies_when) as string }),
      ...(supersedes === undefined ? {} : { supersedes }),
      ...(contradicts === undefined ? {} : { contradicts }),
      ...(stringOf(value.hint) === undefined ? {} : { hint: stringOf(value.hint) as string }),
    },
  };
};

const HANDOFF_HOME: Readonly<Record<string, string>> = {
  fact: "doc/spec/**",
  decision: "doc/decisions/**",
  norm: "AGENTS.md",
  workflow: "command/skill/playbook",
};

const nextRecordId = (
  candidateClass: "lesson" | "tacit",
  created: string,
  records: readonly CapsuleMemoryRecord[],
): string => {
  const year = /^\d{4}/.exec(created)?.[0] ?? "2026";
  let maximum = 0;
  for (const record of records) {
    const match = new RegExp(`^(?:lesson|tacit)-${year}-(\\d{3})$`).exec(record.id);
    if (match?.[1] !== undefined) maximum = Math.max(maximum, Number(match[1]));
  }
  return `${candidateClass}-${year}-${String(maximum + 1).padStart(3, "0")}`;
};

const recordContent = (input: {
  readonly recordId: string;
  readonly candidate: CapsuleCandidate;
  readonly supersedes: readonly string[];
}): string => {
  const { candidate, recordId, supersedes } = input;
  const lines = [
    "---",
    `id: "${recordId}"`,
    `kind: "${candidate.class}"`,
    `scope: "${candidate.scope}"`,
    `statement: "${escapeYaml(candidate.statement)}"`,
    `evidence: "${escapeYaml(candidate.evidence)}"`,
    `source: "${escapeYaml(candidate.source)}"`,
    `created_by: "${escapeYaml(candidate.created_by)}"`,
    `created: "${candidate.created}"`,
    'status: "candidate"',
    `supersedes: [${supersedes.map((id) => `"${id}"`).join(", ")}]`,
    ...(candidate.applies_when === undefined
      ? []
      : [`applies_when: "${escapeYaml(candidate.applies_when)}"`]),
    "---",
    candidate.rationale ?? "",
    "",
  ];
  return lines.join("\n");
};

const indexRowOf = (relative: string, statement: string): string => {
  const bounded = statement.trim().replace(/\s+/g, " ").slice(0, 120);
  return `| \`${relative}\` | ${bounded} |`;
};

/**
 * Evaluate every candidate deterministically (F-4).
 *
 * `decided` carries the candidate ids that already have a durable promotion
 * event; those are skipped so a re-run appends nothing.
 */
export const evaluateCandidates = (input: {
  readonly documents: readonly CapsuleCandidateDocument[];
  readonly memory: CapsuleMemoryFacts;
  readonly decided: ReadonlySet<string>;
}): CapsuleCandidateEvaluation => {
  const decisions: CapsuleCandidateDecision[] = [];
  const schemaFailures: { id: string; detail: string }[] = [];
  const writes: CapsulePromotionWrite[] = [];
  const records = [...input.memory.records];
  const statements = new Set(
    records.map((record) => normalizeCandidateStatement(record.statement)),
  );
  let indexLines = input.memory.indexLines;
  const ordered = [...input.documents].sort((left, right) =>
    left.file < right.file ? -1 : left.file > right.file ? 1 : 0,
  );
  for (const document of ordered) {
    const validated = validateCandidate(document.value);
    if (!validated.ok) {
      schemaFailures.push({ id: document.file, detail: validated.detail });
      continue;
    }
    const candidate = validated.candidate;
    if (input.decided.has(candidate.id)) continue;
    const reject = (reason: string): void => {
      decisions.push({ id: candidate.id, class: candidate.class, decision: "rejected", reason });
    };
    if (candidate.basis.length === 0) {
      reject("capture-bar-unmet");
      continue;
    }
    if (candidate.evidence.length === 0) {
      reject("evidence-missing");
      continue;
    }
    const normalized = normalizeCandidateStatement(candidate.statement);
    if (RECORD_ID.test(candidate.id)) {
      const existing = records.find((record) => record.id === candidate.id);
      if (existing !== undefined) {
        if (normalizeCandidateStatement(existing.statement) === normalized) {
          decisions.push({
            id: candidate.id,
            class: candidate.class,
            decision: "promoted",
            mode: "home-write",
            home: existing.path,
          });
          statements.add(normalized);
          continue;
        }
        reject(`duplicate:${candidate.id}`);
        continue;
      }
    }
    const targets = [...(candidate.supersedes ?? []), ...(candidate.contradicts ?? [])];
    if (targets.some((target) => PATH_SHAPED.test(target))) {
      reject("supersedes-unknown");
      continue;
    }
    const known = new Set([
      ...records.map((record) => record.id),
      ...decisions.map((entry) => entry.id),
    ]);
    if (targets.some((target) => !known.has(target))) {
      reject("supersedes-unknown");
      continue;
    }
    const contradicts = candidate.contradicts ?? [];
    const supersedes = candidate.supersedes ?? [];
    if (contradicts.some((target) => !supersedes.includes(target))) {
      reject("contradiction-requires-supersession");
      continue;
    }
    const duplicate = records.find(
      (record) => normalizeCandidateStatement(record.statement) === normalized,
    );
    if (duplicate !== undefined) {
      reject(`duplicate:${duplicate.id}`);
      continue;
    }
    if (statements.has(normalized)) {
      reject(`duplicate:${candidate.id}`);
      continue;
    }
    if (candidate.class === "preference") {
      reject("home-not-implemented");
      continue;
    }
    if (candidate.class === "fleet") {
      reject("owner-approval-required");
      continue;
    }
    const handoff = HANDOFF_HOME[candidate.class];
    if (handoff !== undefined) {
      decisions.push({
        id: candidate.id,
        class: candidate.class,
        decision: "promoted",
        mode: "handoff",
        home: handoff,
        ...(supersedes.length === 0 ? {} : { supersedes }),
      });
      statements.add(normalized);
      continue;
    }
    if (candidate.class !== "lesson" && candidate.class !== "tacit") {
      reject("home-not-implemented");
      continue;
    }
    if (indexLines + 1 > CAPSULE_MAX_INDEX_LINES) {
      reject("index-budget-exceeded");
      continue;
    }
    const recordId = RECORD_ID.test(candidate.id)
      ? candidate.id
      : nextRecordId(candidate.class, candidate.created, records);
    const existing = records.find((record) => record.id === recordId);
    if (existing !== undefined && normalizeCandidateStatement(existing.statement) !== normalized) {
      reject(`duplicate:${recordId}`);
      continue;
    }
    const slug = candidate.id.replace(/[^a-z0-9-]/g, "-").slice(0, 64);
    const fileName = `${recordId}-${slug}.md`;
    const relative = `${candidate.class}s/${fileName}`;
    const write: CapsulePromotionWrite = {
      candidateId: candidate.id,
      class: candidate.class,
      recordId,
      path: relative,
      content: recordContent({ recordId, candidate, supersedes }),
      indexRow: indexRowOf(relative, candidate.statement),
      ...(supersedes.length === 0 ? {} : { supersedes }),
    };
    writes.push(write);
    decisions.push({
      id: candidate.id,
      class: candidate.class,
      decision: "promoted",
      mode: "home-write",
      home: relative,
      ...(supersedes.length === 0 ? {} : { supersedes }),
    });
    records.push({
      id: recordId,
      class: candidate.class,
      statement: candidate.statement,
      status: "candidate",
      path: relative,
    });
    statements.add(normalized);
    indexLines += 1;
  }
  return { decisions, schemaFailures, writes };
};

/** One candidate document file that violates the `<id>.yaml` naming rule (F-4). */
export type CandidateFileViolation = { readonly file: string; readonly detail: string };

/** Enforce one candidate per `<id>.yaml` with the stem equal to the id. */
export const candidateFileViolations = (
  documents: readonly { readonly file: string; readonly value: unknown }[],
): readonly CandidateFileViolation[] => {
  const violations: CandidateFileViolation[] = [];
  for (const document of documents) {
    const match = /^([a-z0-9][a-z0-9-]{2,63})\.yaml$/.exec(document.file);
    if (match === null) {
      violations.push({
        file: document.file,
        detail: "candidate file must be named <id>.yaml with the declared slug shape",
      });
      continue;
    }
    const value = document.value;
    const id =
      typeof value === "object" && value !== null && "id" in value
        ? (value as { readonly id?: unknown }).id
        : undefined;
    if (typeof id !== "string" || id !== match[1]) {
      violations.push({
        file: document.file,
        detail: "candidate file stem does not match the candidate id",
      });
    }
  }
  return violations;
};

/** The closed rejection-reason check used by structural tests (Appendix C). */
export const isDeclaredRejectionReason = (reason: string): boolean => {
  const base = reason.startsWith("duplicate:") ? "duplicate:<existing-id>" : reason;
  return (CAPSULE_REJECTION_REASONS as readonly string[]).includes(base);
};
