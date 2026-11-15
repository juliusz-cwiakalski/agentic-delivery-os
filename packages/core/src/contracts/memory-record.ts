/**
 * The canonical agent-memory record schema (GH-301 F-2, DM-1, DM-5, DM-6;
 * ADR-0011 D1-D7).
 *
 * The machine contract is the single schema authority: the memory index
 * publishes its human rendering, the memory lint enforces it, and the
 * promotion writer and curator render it. Runtime-neutral by construction:
 * `as const` data and types only, no function body, no I/O, no clock.
 *
 * Every vocabulary that the capsule candidate contract already owns is
 * imported here instead of restated, so the record schema and its projection
 * cannot drift apart.
 */
import {
  CAPSULE_CANDIDATE_STATUSES,
  CAPSULE_CANDIDATE_TRUST,
  CAPSULE_CAPTURE_BAR_BASES,
  CAPSULE_EVIDENCE_PREFIXES,
} from "./capsule.js";

/** The four record areas and their declared kinds (DM-2, ADR-0011 D4). */
export const MEMORY_RECORD_AREAS = ["lessons", "tacit", "preferences", "guilds"] as const;

/** The memory tree root, repository-relative (DM-2). */
export const MEMORY_ROOT = ".ai/memory" as const;

/** The memory index, repository-relative (DM-3). */
export const MEMORY_INDEX_PATH = ".ai/memory/README.md" as const;

/** The retro archive index, repository-relative (DM-2, DM-3). */
export const MEMORY_ARCHIVE_INDEX_PATH = ".ai/memory/retro/INDEX.md" as const;

/** The per-agent and per-guild entry-point file name (DM-2). */
export const MEMORY_ENTRY_FILE_NAME = "README.md" as const;

/** The closed `kind` vocabulary (DM-1, ADR-0011 D2). */
export const MEMORY_RECORD_KINDS = ["lesson", "tacit_fragment", "preference"] as const;

/** The closed record `scope` vocabulary; `fleet` is candidate-only (DM-1, D7). */
export const MEMORY_RECORD_SCOPES = ["repo", "component", "change"] as const;

/** The five lifecycle `status` values (DM-1, ADR-0011 D3). */
export const MEMORY_RECORD_STATUSES = [
  "candidate",
  "validated",
  "authoritative",
  "superseded",
  "archived",
] as const;

/** The status subset the capsule candidate contract projects (DM-6). */
export const MEMORY_RECORD_CAPSULE_STATUSES = CAPSULE_CANDIDATE_STATUSES;

/** The four closed `source` channels (DM-1, DM-6). */
export const MEMORY_RECORD_SOURCES = [
  "review_verdict",
  "ci_verdict",
  "human_correction",
  "merged_pr",
] as const;

/** The trust vocabulary, owned by the capsule contract (DM-6). */
export const MEMORY_RECORD_TRUST = CAPSULE_CANDIDATE_TRUST;

/** The five capture-bar `basis` values, owned by the capsule contract (D5). */
export const MEMORY_RECORD_BASIS_VALUES = CAPSULE_CAPTURE_BAR_BASES;

/** The five evidence-link prefixes, owned by the capsule contract (DM-6). */
export const MEMORY_RECORD_EVIDENCE_PREFIXES = CAPSULE_EVIDENCE_PREFIXES;

/** The required spine, in published order (DM-1, ADR-0011 D2). */
export const MEMORY_RECORD_REQUIRED_KEYS = [
  "id",
  "kind",
  "scope",
  "statement",
  "evidence",
  "source",
  "trust",
  "created_by",
  "created",
  "status",
] as const;

/** The closed optional key set (DM-1, ADR-0011 D3). */
export const MEMORY_RECORD_OPTIONAL_KEYS = [
  "supersedes",
  "superseded_by",
  "contradicts",
  "applies_when",
  "basis",
  "revalidate_after",
  "invalid_from",
  "confidence",
  "evaluation",
  "guild",
] as const;

/** The id grammar: `<prefix>-<YYYY>-<NNN>` (DM-1, ADR-0011 D4). */
export const MEMORY_RECORD_ID_PATTERN = "^(?:lesson|tacit|preference)-\\d{4}-\\d{3}$" as const;

/** The file-name grammar: `<id>.md` or `<id>-<slug>.md` (DM-1, D4). */
export const MEMORY_RECORD_FILE_NAME_PATTERN =
  "^(?:lesson|tacit|preference)-\\d{4}-\\d{3}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?\\.md$" as const;

/** The declared home area for each record kind (DM-2, ADR-0011 D4). */
export const MEMORY_RECORD_HOME_BY_KIND = {
  lesson: "lessons",
  tacit_fragment: "tacit",
  preference: "preferences",
} as const;

/** The record kind a capsule class token renders as (DM-6, ADR-0011 D7). */
export const MEMORY_RECORD_KIND_BY_CLASS = {
  lesson: "lesson",
  tacit: "tacit_fragment",
} as const;

/**
 * The declared behaviour-changing marker for revalidation (DM-1, ADR-0011
 * D5). A lesson whose `evaluation` block is present is behaviour-changing;
 * an authoritative behaviour-changing lesson must carry `revalidate_after`.
 */
export const MEMORY_REVALIDATION_MARKER_KEY = "evaluation" as const;

/** The published statement bound, a single-sourced constant (D6). */
export const STATEMENT_MAX_CHARS = 280 as const;

/** The published read-when hint bound, a single-sourced constant (D6). */
export const HINT_MAX_CHARS = 120 as const;

/** The memory-index line cap (DM-5). */
export const MEMORY_INDEX_MAX_LINES = 200 as const;

/** The memory-index byte cap (DM-5). */
export const MEMORY_INDEX_MAX_BYTES = 25 * 1024;

/** The per-agent and per-guild entry-point line cap (DM-5). */
export const MEMORY_ENTRY_MAX_LINES = 150 as const;

/** The archive-index line cap (DM-5). */
export const MEMORY_ARCHIVE_INDEX_MAX_LINES = 200 as const;

/** The kernel memory-section advisory threshold (DM-5). */
export const MEMORY_KERNEL_WARN_LINES = 200 as const;

/** The kernel memory-section error threshold (DM-5). */
export const MEMORY_KERNEL_ERROR_LINES = 220 as const;

/** The printed error-finding ceiling (NFR-5, DM-4). */
export const MEMORY_MAX_PRINTED_ERRORS = 100 as const;

/** The printed advisory-finding ceiling (NFR-5, DM-4). */
export const MEMORY_MAX_PRINTED_ADVISORIES = 100 as const;

/** The eight areas in reporting order (DM-4, Appendix A). */
export const MEMORY_FINDING_AREA_ORDER = [
  "schema",
  "dating",
  "provenance",
  "reference",
  "index",
  "budget",
  "derivable",
  "secret",
] as const;

/**
 * The closed finding register (Appendix A). Every emitted id is a member of
 * this declaration; the secret area is a prefix derived at run time from the
 * injected privacy vocabulary, so no secret class exists without one.
 */
export const MEMORY_FINDING_REGISTER = {
  schema: {
    severity: "error",
    ids: [
      "memory.schema.frontmatter-missing",
      "memory.schema.frontmatter-malformed",
      "memory.schema.keys-missing",
      "memory.schema.key-unknown",
      "memory.schema.id-malformed",
      "memory.schema.id-duplicate",
      "memory.schema.file-name-mismatch",
      "memory.schema.value-unknown",
      "memory.schema.statement-too-long",
      "memory.schema.preference-source",
      "memory.schema.guild-mismatch",
      "memory.schema.superseded-by-missing",
    ],
  },
  dating: {
    severity: "error",
    ids: [
      "memory.dating.created-malformed",
      "memory.dating.created-future",
      "memory.dating.revalidate-missing",
      "memory.dating.revalidate-malformed",
      "memory.dating.revalidate-expired",
      "memory.dating.entry-line-date",
    ],
  },
  provenance: {
    severity: "error",
    ids: [
      "memory.provenance.evidence-missing",
      "memory.provenance.evidence-shape-unknown",
      "memory.provenance.created-by-missing",
    ],
  },
  reference: {
    severity: "error",
    ids: [
      "memory.reference.supersedes-dangling",
      "memory.reference.superseded-by-dangling",
      "memory.reference.supersede-asymmetry",
      "memory.reference.contradicts-dangling",
      "memory.reference.link-dangling",
    ],
  },
  index: {
    severity: "error",
    ids: [
      "memory.index.record-uncovered",
      "memory.index.row-unbacked",
      "memory.index.row-duplicate",
      "memory.index.row-malformed",
      "memory.index.hint-missing",
    ],
  },
  budget: {
    severity: "error",
    ids: [
      "memory.budget.index-lines",
      "memory.budget.index-bytes",
      "memory.budget.agent-entry-lines",
      "memory.budget.guild-entry-lines",
      "memory.budget.archive-index-lines",
      "memory.budget.kernel-lines",
    ],
  },
  derivable: {
    severity: "warn",
    ids: ["memory.derivable.file-listing", "memory.derivable.command-echo"],
  },
  secret: { severity: "error", prefix: "memory.secret." },
} as const;

/** The one fixed-severity advisory identity outside the derivable area. */
export const MEMORY_WARN_RULE_IDS = ["memory.dating.revalidate-expired"] as const;

/** The kernel band's advisory severity above the warn threshold (DM-5). */
export const MEMORY_KERNEL_BAND_SEVERITY = "warn" as const;

/** The secret-area id prefix; the class suffix is vocabulary-derived (C-3). */
export const MEMORY_SECRET_RULE_PREFIX = "memory.secret." as const;

/** The declared workspace commands the command-echo heuristic recognises. */
export const MEMORY_DERIVABLE_COMMANDS = [
  "pnpm check",
  "pnpm test",
  "pnpm lint",
  "pnpm format:check",
  "pnpm typecheck",
  "pnpm build",
  "bun test",
] as const;

/** A record kind. */
export type MemoryRecordKind = (typeof MEMORY_RECORD_KINDS)[number];

/** A record scope. */
export type MemoryRecordScope = (typeof MEMORY_RECORD_SCOPES)[number];

/** A record lifecycle status. */
export type MemoryRecordStatus = (typeof MEMORY_RECORD_STATUSES)[number];

/** A record provenance channel. */
export type MemoryRecordSource = (typeof MEMORY_RECORD_SOURCES)[number];

/** A record trust level. */
export type MemoryRecordTrust = (typeof MEMORY_RECORD_TRUST)[number];

/** A finding area. */
export type MemoryFindingArea = (typeof MEMORY_FINDING_AREA_ORDER)[number];

/** The two severities. */
export type MemoryFindingSeverity = "error" | "warn";

/** The check exit projection: non-zero iff at least one error finding. */
export type MemoryExitCode = 0 | 1;

/** One evaluated memory finding. */
export type MemoryFinding = {
  readonly ruleId: string;
  readonly area: MemoryFindingArea;
  readonly severity: MemoryFindingSeverity;
  readonly path: string;
  readonly line?: number;
  readonly detail: string;
};

/** The deterministic summary counts. */
export type MemorySummary = {
  readonly records: number;
  readonly areas: number;
  readonly errors: number;
  readonly advisories: number;
};

/** One scanned file's frontmatter state, parsed once by the scanner. */
export type MemoryFrontmatter =
  | { readonly state: "absent" }
  | { readonly state: "malformed" }
  | {
      readonly state: "parsed";
      readonly value: Readonly<Record<string, unknown>>;
    };

/** One scanned file: repository-relative path, text, byte count, frontmatter. */
export type MemoryScannedFile = {
  readonly path: string;
  readonly text: string;
  readonly bytes: number;
  readonly frontmatter: MemoryFrontmatter;
};

/** One recognizer rule of the injected privacy vocabulary (structural type). */
export type MemoryPrivacyRule = {
  readonly id: string;
  readonly recognizerClass: string;
  readonly patternSource: string;
  readonly flags: string;
  readonly minimumMatchLength: number;
};

/** One suppression class of the injected privacy vocabulary. */
export type MemoryPrivacySuppressionClass = {
  readonly id: string;
  readonly markers: readonly string[];
};

/** The injected privacy vocabulary: recognizers plus suppression markers. */
export type MemoryPrivacyVocabulary = {
  readonly rules: readonly MemoryPrivacyRule[];
  readonly suppressionClasses: readonly MemoryPrivacySuppressionClass[];
  /**
   * The injected value-segment seam: the opaque value a rule protects, which
   * is the only region suppression markers are evaluated against. The check
   * edge injects the delivered privacy guard's own implementation so the lint
   * and the whole-tree guard cannot drift (GH-301 F-4).
   */
  readonly suppressionValueFor?: (ruleId: string, matchedText: string) => string;
};

/** The pure evaluation input: file list, one fixed today, and the vocabulary. */
export type MemoryEvaluationInput = {
  readonly files: readonly MemoryScannedFile[];
  readonly today: string;
  readonly privacy: MemoryPrivacyVocabulary;
};

/** The pure evaluation result, including the deterministic printed lines. */
export type MemoryEvaluationResult = {
  readonly findings: readonly MemoryFinding[];
  readonly summary: MemorySummary;
  readonly exitCode: MemoryExitCode;
  readonly lines: readonly string[];
};
