/**
 * Retro evidence-pipeline vocabulary (GH-232 F-1..F-10, DM-1..DM-9).
 *
 * Runtime-neutral and I/O-free: types and `as const` data only. The module is
 * the single home of the retro level declarations, evidence record shape,
 * keyed-chain constants, registry record kinds, report/export schema
 * identities, and the data-only ports the state and domain tiers consume. No
 * clock, randomness, environment, or filesystem access lives here.
 */
import type { AuditReadOutcome, AuditReadQuery, AuditReadResult } from "./audit.js";
import type { PhaseTransitionRecord } from "./registry.js";
import type { Result } from "./index.js";
import type {
  StateArtifactBoundaryDeclaration,
  StateFailureCode,
  StateJsonValue,
  StateSafeLocation,
} from "./state.js";

/* ------------------------------- levels ---------------------------------- */

/** The six declared retro levels in concepts-document order (DM-1). */
export const RETRO_LEVEL_IDS = ["R1", "R2", "R3", "R4", "R5", "R6"] as const;

export type RetroLevelId = (typeof RETRO_LEVEL_IDS)[number];

/** The closed level-name vocabulary: the only accepted `--level` names. */
export const RETRO_LEVEL_NAMES = [
  "change",
  "session",
  "incident",
  "window",
  "project",
  "fleet",
] as const;

export type RetroLevelName = (typeof RETRO_LEVEL_NAMES)[number];

/** The closed implementation-status vocabulary (DM-1, F-8). */
export const RETRO_LEVEL_STATUSES = ["implemented", "declared"] as const;

export type RetroLevelStatus = (typeof RETRO_LEVEL_STATUSES)[number];

/** The scope kinds the level declarations name (concepts hybrid model). */
export const RETRO_SCOPE_KINDS = [
  "change",
  "session",
  "incident",
  "window",
  "project",
  "fleet",
] as const;

export type RetroScopeKind = (typeof RETRO_SCOPE_KINDS)[number];

/** The hybrid trigger vocabulary: schedule, event, or lifecycle (DM-1). */
export const RETRO_TRIGGER_KINDS = ["schedule", "event", "lifecycle"] as const;

export type RetroTriggerKind = (typeof RETRO_TRIGGER_KINDS)[number];

/** One declared trigger rule; cadence is data, never a scheduler input here. */
export type RetroTriggerDeclaration = {
  readonly kind: RetroTriggerKind;
  readonly cadence?: string;
  readonly event?: string;
  readonly lifecycle?: string;
};

/** One declared level entry (DM-1). */
export type RetroLevelDeclaration = {
  readonly id: RetroLevelId;
  readonly name: RetroLevelName;
  readonly scopeKind: RetroScopeKind;
  readonly trigger: RetroTriggerDeclaration;
  readonly status: RetroLevelStatus;
};

/**
 * R1-R6 as declared registry data. Only `change` (R1) is implemented in
 * M1-S8; the remaining levels are declared-only and refuse with an
 * owning-story hint.
 */
export const RETRO_LEVELS: readonly RetroLevelDeclaration[] = [
  {
    id: "R1",
    name: "change",
    scopeKind: "change",
    trigger: { kind: "lifecycle", lifecycle: "change-closeout" },
    status: "implemented",
  },
  {
    id: "R2",
    name: "session",
    scopeKind: "session",
    trigger: { kind: "event", event: "session-end" },
    status: "declared",
  },
  {
    id: "R3",
    name: "incident",
    scopeKind: "incident",
    trigger: { kind: "event", event: "incident-severity" },
    status: "declared",
  },
  {
    id: "R4",
    name: "window",
    scopeKind: "window",
    trigger: { kind: "schedule", cadence: "daily" },
    status: "declared",
  },
  {
    id: "R5",
    name: "project",
    scopeKind: "project",
    trigger: { kind: "lifecycle", lifecycle: "milestone-end" },
    status: "declared",
  },
  {
    id: "R6",
    name: "fleet",
    scopeKind: "fleet",
    trigger: { kind: "schedule", cadence: "fleet-cadence" },
    status: "declared",
  },
];

/** The levels implemented in this change (only `change`/R1). */
export const RETRO_IMPLEMENTED_LEVELS = ["change"] as const satisfies readonly RetroLevelName[];

/** The owning story behind each declared-only level (PIN-6). */
export const RETRO_LEVEL_OWNING_STORIES = {
  change: "M1-S8 (retro pipeline)",
  session: "M2-S3 (ceremony runner)",
  incident: "M2-S3 (ceremony runner)",
  window: "M2-S3 (ceremony runner)",
  project: "M2-S3 (ceremony runner)",
  fleet: "post-M4 fleet retro (unscheduled)",
} as const satisfies Readonly<Record<RetroLevelName, string>>;

/** The default level when `--level` is omitted (DEC-5). */
export const RETRO_DEFAULT_LEVEL = "change" as const satisfies RetroLevelName;

/* ------------------------------ vocabulary -------------------------------- */

/** The two retro modes (DM-5, EVT-2). */
export const RETRO_MODES = ["collect", "report"] as const;

export type RetroMode = (typeof RETRO_MODES)[number];

/** The closed finding-kind vocabulary (PIN-10). */
export const RETRO_FINDING_KINDS = [
  "retro-note",
  "collector-finding",
  "truth-check",
  "tamper-flag",
  "malformed-entry",
  "verified-empty",
] as const;

export type RetroFindingKind = (typeof RETRO_FINDING_KINDS)[number];

/** The closed follow-through verdict vocabulary (PIN-10). */
export const RETRO_FOLLOW_THROUGH_VERDICTS = ["verified", "unverified", "unknown"] as const;

export type RetroFollowThroughVerdict = (typeof RETRO_FOLLOW_THROUGH_VERDICTS)[number];

/** The delivered collector sources (GET-only in M1-S8). */
export const RETRO_EVIDENCE_SOURCES = [
  "audit-ledger",
  "phase-transitions",
  "closeout-outcomes",
  "commit-telemetry",
  "pm-notes",
  "memory-audit",
] as const;

export type RetroEvidenceSource = (typeof RETRO_EVIDENCE_SOURCES)[number];

/** The truth-check identifiers; C-04 carries the a/b predicates (DEC-6). */
export const RETRO_TRUTH_CHECKS = ["C-01", "C-02", "C-03", "C-04", "C-05"] as const;

export type RetroTruthCheckId = (typeof RETRO_TRUTH_CHECKS)[number];

/** The explicit collect outcomes; `no-target` is a success (DEC-14). */
export const RETRO_COLLECT_OUTCOMES = ["collected", "no-target"] as const;

export type RetroCollectOutcome = (typeof RETRO_COLLECT_OUTCOMES)[number];

export const RETRO_NO_TARGET_REASON =
  "every completed change is already collected at this level" as const;

/** The four retro error identities (DEC-11, DM-8). */
export const RETRO_ERROR_CODES = [
  "retro.evidence.malformed-entry",
  "retro.evidence.tamper-flagged",
  "retro.truth.vacuous-run",
  "retro.evidence.denied",
] as const;

export type RetroErrorCode = (typeof RETRO_ERROR_CODES)[number];

/** The four registry boundary verdicts (DM-4, AC-F8-1). */
export const RETRO_REGISTRY_VERDICTS = ["valid", "verified-empty", "torn", "unknown"] as const;

export type RetroRegistryVerdict = (typeof RETRO_REGISTRY_VERDICTS)[number];

/* ------------------------------- sidecar --------------------------------- */

/** The evidence record kind in the sidecar artifact family (EVT-1). */
export const RETRO_EVIDENCE_RECORD_KIND = "retro.evidence" as const;

/** The self-describing payload schema of an evidence record (DM-2). */
export const RETRO_EVIDENCE_PAYLOAD_SCHEMA = "delivery.retro.evidence.v1" as const;

/** The sidecar ledger artifact family (`retro-evidence.<workspace>.jsonl`). */
export const RETRO_EVIDENCE_ARTIFACT_PREFIX = "retro-evidence." as const;
export const RETRO_EVIDENCE_ARTIFACT_SUFFIX = ".jsonl" as const;

/** The collector fence file beside the sidecar (DEC-13). */
export const RETRO_EVIDENCE_LOCK_NAME = "retro-evidence.lock" as const;

/** The chain anchor a sidecar's first record links from (PIN-2). */
export const RETRO_CHAIN_ANCHOR = ["retro", "chain", "anchor", "v1"].join(".");

/** The payload schema of the durable sidecar chaining-key artifact (PIN-3). */
export const RETRO_CHAIN_KEY_PAYLOAD_SCHEMA = "delivery.retro.chain-key.v1" as const;

/** The distinct store-layout key artifact family (`chain-key.retro.<ws>.json`). */
export const RETRO_CHAIN_KEY_ARTIFACT_PREFIX = "chain-key.retro." as const;
export const RETRO_CHAIN_KEY_ARTIFACT_SUFFIX = ".json" as const;

/** Key material width in bytes (32 random bytes, 64 hex characters). */
export const RETRO_CHAIN_KEY_BYTES = 32 as const;

/** The fixed hex width of an HMAC-SHA-256 chain value (PIN-1). */
export const RETRO_CHAIN_VALUE_HEX_LENGTH = 64 as const;

/** The canonical field order feeding the chain link (PIN-2). */
export const RETRO_CANONICAL_FIELD_ORDER = [
  "schemaId",
  "traceId",
  "level",
  "source",
  "windowStart",
  "windowEnd",
  "collectedAt",
  "collectorIdentity",
  "payloadRefs",
  "payloadSchemaId",
] as const;

/** The complete stored evidence field set (the chain value is appended last). */
export const RETRO_EVIDENCE_FIELDS = [
  ...RETRO_CANONICAL_FIELD_ORDER,
  "chainValue",
] as const;

/** The source payload schema identities carried by evidence records (DM-2). */
export const RETRO_PAYLOAD_SCHEMAS = {
  phaseTransition: "delivery.retro.phase-transition.v1",
  closeoutOutcome: "delivery.retro.closeout-outcome.v1",
  commitTelemetry: "delivery.retro.commit-telemetry.v1",
  retroNote: "delivery.retro.retro-note.v1",
  finding: "delivery.retro.finding.v1",
  verifiedEmpty: "delivery.retro.verified-empty.v1",
  auditOrphan: "delivery.retro.audit-orphan.v1",
  auditChain: "delivery.retro.audit-chain.v1",
  followThrough: "delivery.retro.follow-through.v1",
  memoryAudit: "delivery.retro.memory-audit.v1",
} as const;

/** The declared payload schema ids an evidence record may carry (E-02). */
export const RETRO_EVIDENCE_PAYLOAD_SCHEMA_IDS = [
  RETRO_EVIDENCE_PAYLOAD_SCHEMA,
  "delivery.audit.invocation.v1",
  ...Object.values(RETRO_PAYLOAD_SCHEMAS),
] as const;

/** The store-layout evidence artifact name for a workspace. */
export const retroEvidenceArtifactName = (workspaceId: string): string =>
  `${RETRO_EVIDENCE_ARTIFACT_PREFIX}${encodeURIComponent(workspaceId)}${RETRO_EVIDENCE_ARTIFACT_SUFFIX}`;

/** The distinct store-layout chaining-key artifact name for a workspace. */
export const retroChainKeyArtifactName = (workspaceId: string): string =>
  `${RETRO_CHAIN_KEY_ARTIFACT_PREFIX}${encodeURIComponent(workspaceId)}${RETRO_CHAIN_KEY_ARTIFACT_SUFFIX}`;

/** The sidecar evidence path inside a state directory. */
export const retroEvidencePath = (stateDirectory: string, workspaceId: string): string =>
  `${stateDirectory}/${retroEvidenceArtifactName(workspaceId)}`;

/** The sidecar chaining-key path inside a state directory. */
export const retroChainKeyPath = (stateDirectory: string, workspaceId: string): string =>
  `${stateDirectory}/${retroChainKeyArtifactName(workspaceId)}`;

/** The collector fence path inside a state directory. */
export const retroEvidenceLockPath = (stateDirectory: string, workspaceId: string): string =>
  `${stateDirectory}/${RETRO_EVIDENCE_LOCK_NAME.replace(".lock", `.${encodeURIComponent(workspaceId)}.lock`)}`;

/* --------------------------- sidecar data types --------------------------- */

/** A claimed collector identity: verbatim value plus the claimed marker. */
export type RetroClaimedIdentity = {
  readonly kind: "claimed";
  readonly value: string;
};

/** One evidence append request: the consumer computes the chain value. */
export type RetroEvidenceDraft = {
  readonly traceId: string;
  readonly level: RetroLevelName;
  readonly source: RetroEvidenceSource;
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly collectedAt: number;
  readonly collectorIdentity?: RetroClaimedIdentity;
  readonly payloadRefs: readonly string[];
  readonly payloadSchemaId: string;
};

/** One append-only evidence record (DM-2, EVT-1). */
export type RetroEvidenceRecord = {
  readonly schemaId: typeof RETRO_EVIDENCE_PAYLOAD_SCHEMA;
  readonly traceId: string;
  readonly level: RetroLevelName;
  readonly source: RetroEvidenceSource;
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly collectedAt: number;
  readonly collectorIdentity?: RetroClaimedIdentity;
  readonly payloadRefs: readonly string[];
  readonly payloadSchemaId: string;
  readonly chainValue: string;
};

/** One chain break: a position and trace id only (DM-4). */
export type RetroChainBreak = {
  readonly position: number;
  readonly traceId: string;
};

/** The full chain verdict carried on every read (DM-4). */
export type RetroChainVerdict = {
  readonly verified: boolean;
  readonly records: number;
  readonly breaks: readonly RetroChainBreak[];
  readonly anchor: string;
  readonly affectedDomain: "retro" | "audit";
  readonly storePath: string;
};

/** One entry-level malformation: position and, when present, trace id (F-4). */
export type RetroEntryMalformation = {
  readonly position: number;
  readonly traceId?: string;
};

/** A verified sidecar read with entry-level malformations reported in band. */
export type RetroSidecarRead = {
  readonly records: readonly RetroEvidenceRecord[];
  readonly malformed: readonly RetroEntryMalformation[];
  readonly chain: RetroChainVerdict;
};

/* --------------------------- registry data types -------------------------- */

export const RETRO_LEVEL_RECORD_KIND = "retro.level" as const;
export const RETRO_LEVEL_PAYLOAD_SCHEMA = "delivery.retro.level.v1" as const;
export const RETRO_LEVEL_RECORD_KEY_PREFIX = "retro.levels" as const;

export const RETRO_RUN_RECORD_KIND = "retro.run" as const;
export const RETRO_RUN_PAYLOAD_SCHEMA = "delivery.retro.run.v1" as const;
export const RETRO_RUN_RECORD_KEY_PREFIX = "retro.runs" as const;

export const RETRO_TRIGGER_RECORD_KIND = "retro.trigger" as const;
export const RETRO_TRIGGER_PAYLOAD_SCHEMA = "delivery.retro.trigger.v1" as const;
export const RETRO_TRIGGER_RECORD_KEY_PREFIX = "retro.triggers" as const;

/** The fence namespace the registry consumer uses (PIN-4). */
export const RETRO_REGISTRY_FENCE_NAMESPACE = "retro-registry" as const;

/** The periodic memory-audit trigger identity and declared cadence (PIN-9). */
export const RETRO_MEMORY_AUDIT_TRIGGER_NAME = "memory-audit" as const;
export const RETRO_MEMORY_AUDIT_TRIGGER_CADENCE = "weekly" as const;

/** The registry records' exact identity fields. */
export const RETRO_LEVEL_IDENTITY_FIELD = "name" as const;
export const RETRO_RUN_IDENTITY_FIELD = "runId" as const;
export const RETRO_TRIGGER_IDENTITY_FIELD = "name" as const;

/** One validated level registry record (DM-1). */
export type RetroLevelRecord = {
  readonly schemaId: typeof RETRO_LEVEL_PAYLOAD_SCHEMA;
  readonly name: RetroLevelName;
  readonly levelId: RetroLevelId;
  readonly scopeKind: RetroScopeKind;
  readonly trigger: RetroTriggerDeclaration;
  readonly status: RetroLevelStatus;
};

/** One trigger registry record (DM-9). */
export type RetroTriggerRecord = {
  readonly schemaId: typeof RETRO_TRIGGER_PAYLOAD_SCHEMA;
  readonly name: string;
  readonly kind: RetroTriggerKind;
  readonly cadence: string;
  readonly owningBinding: string;
};

/** Counts carried by one collection run (EVT-2, DM-5). */
export type RetroRunCounts = {
  readonly collected: number;
  readonly malformed: number;
  readonly skippedSource: number;
};

/** One consumed source's verdict (EVT-2). */
export type RetroConsumedVerdict = {
  readonly source: RetroEvidenceSource;
  readonly verified: boolean;
  readonly records: number;
  readonly truncated: boolean;
};

/** One truth check's outcome (DEC-6). */
export type RetroTruthCheckOutcome = {
  readonly id: RetroTruthCheckId;
  readonly outcome: "passed" | "finding" | "verified-empty" | "blocked";
  readonly findings: readonly string[];
  readonly evidenceRefs: readonly string[];
};

/** The pipeline-truth verdict of one run (EVT-2). */
export type RetroTruthVerdict = {
  readonly clean: boolean;
  readonly blocking: RetroErrorCode | null;
  readonly checks: readonly RetroTruthCheckOutcome[];
};

/** One validated run registry record (DM-5, EVT-2). */
export type RetroRunRecord = {
  readonly schemaId: typeof RETRO_RUN_PAYLOAD_SCHEMA;
  readonly runId: string;
  readonly level: RetroLevelName;
  readonly mode: RetroMode;
  readonly scope: string;
  readonly counts: RetroRunCounts;
  readonly consumed: readonly RetroConsumedVerdict[];
  readonly truth: RetroTruthVerdict;
};

/**
 * The retro registry's declared artifact boundary: exactly three additive
 * validated record kinds (DM-1, DM-5, DM-9; PIN-4).
 */
export const RETRO_REGISTRY_BOUNDARY_DECLARATION: StateArtifactBoundaryDeclaration = {
  recordKeyPrefix: "retro.",
  kinds: [
    {
      kind: RETRO_LEVEL_RECORD_KIND,
      payloadSchema: RETRO_LEVEL_PAYLOAD_SCHEMA,
      identityField: RETRO_LEVEL_IDENTITY_FIELD,
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "name", type: "string", required: true },
        { name: "levelId", type: "string", required: true },
        { name: "scopeKind", type: "string", required: true },
        { name: "trigger", type: "object", required: true },
        { name: "status", type: "string", required: true },
      ],
      vocabularies: [
        { field: "name", values: RETRO_LEVEL_NAMES },
        { field: "levelId", values: RETRO_LEVEL_IDS },
        { field: "scopeKind", values: RETRO_SCOPE_KINDS },
        { field: "status", values: RETRO_LEVEL_STATUSES },
      ],
    },
    {
      kind: RETRO_RUN_RECORD_KIND,
      payloadSchema: RETRO_RUN_PAYLOAD_SCHEMA,
      identityField: RETRO_RUN_IDENTITY_FIELD,
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "runId", type: "string", required: true },
        { name: "level", type: "string", required: true },
        { name: "mode", type: "string", required: true },
        { name: "scope", type: "string", required: true },
        { name: "counts", type: "object", required: true },
        { name: "consumed", type: "array", required: true },
        { name: "truth", type: "object", required: true },
      ],
      vocabularies: [
        { field: "level", values: RETRO_LEVEL_NAMES },
        { field: "mode", values: RETRO_MODES },
      ],
    },
    {
      kind: RETRO_TRIGGER_RECORD_KIND,
      payloadSchema: RETRO_TRIGGER_PAYLOAD_SCHEMA,
      identityField: RETRO_TRIGGER_IDENTITY_FIELD,
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "name", type: "string", required: true },
        { name: "kind", type: "string", required: true },
        { name: "cadence", type: "string", required: true },
        { name: "owningBinding", type: "string", required: true },
      ],
      vocabularies: [{ field: "kind", values: RETRO_TRIGGER_KINDS }],
    },
  ],
};

/* ------------------------------ report/export ----------------------------- */

/** The report schema identity: a contract constant, never an in-data field. */
export const RETRO_REPORT_SCHEMA = "delivery.retro.report.v1" as const;

/** The export bundle schema identity (DM-7). */
export const RETRO_EXPORT_SCHEMA = "delivery.retro.export.v1" as const;

/** One mechanically folded finding (DM-6). */
export type RetroFinding = {
  readonly kind: RetroFindingKind;
  readonly text: string;
  readonly evidenceRefs: readonly string[];
};

/** One recorded follow-through entry (DM-6). */
export type RetroFollowThroughEntry = {
  readonly action: string;
  readonly verdict: RetroFollowThroughVerdict;
  readonly artifactRef?: string;
};

/** The four-key report data shape (DM-6, AC-F5-1). */
export type RetroReportData = {
  readonly level: RetroLevelName;
  readonly findings: readonly RetroFinding[];
  readonly followThrough: readonly RetroFollowThroughEntry[];
  readonly evidenceRefs: readonly string[];
};

/** The bounded export bundle (DM-7). */
export type RetroExportBundle = {
  readonly schemaId: typeof RETRO_EXPORT_SCHEMA;
  readonly level: RetroLevelName;
  readonly limit: number;
  readonly truncated: boolean;
  readonly chain: RetroChainVerdict;
  readonly records: readonly RetroEvidenceRecord[];
};

/* ------------------------------- collect ---------------------------------- */

/** One completed change selected as a collection target (DEC-5). */
export type RetroTargetSelection = {
  readonly state: "selected" | "empty";
  readonly changeRef?: string;
  readonly completedAt?: string;
  readonly reason?: string;
};

/** The bounded collection summary returned as `data` (F-1, DEC-14). */
export type RetroCollectSummary = {
  readonly level: RetroLevelName;
  readonly outcome: RetroCollectOutcome;
  readonly selection: RetroTargetSelection;
  readonly runId?: string;
  readonly counts: RetroRunCounts;
  readonly truth?: RetroTruthVerdict;
};

/* ------------------------------ failure types ----------------------------- */

/** A safe failure location: paths, positions, and bounded counts only. */
export type RetroFailureLocation = {
  readonly path?: string;
  readonly position?: number;
  readonly traceId?: string;
  readonly entriesProcessed?: number;
  readonly entriesPreserved?: number;
  readonly firstFlaggedPosition?: number;
};

/** The classified failure union the retro surfaces return. */
export type RetroFailure =
  | {
      readonly kind: "retro";
      readonly code: RetroErrorCode;
      readonly consequence: "not_landed";
      readonly location?: RetroFailureLocation;
      readonly summary?: string;
    }
  | {
      readonly kind: "state";
      readonly code: StateFailureCode;
      readonly consequence: "not_landed";
      readonly location: StateSafeLocation;
    }
  | {
      readonly kind: "input";
      readonly code: "input.value.rejected";
      readonly consequence: "not_landed";
      readonly location?: RetroFailureLocation;
      readonly summary?: string;
    };

export type RetroResult<T> = Result<T, RetroFailure>;

/* -------------------------------- ports ----------------------------------- */

/**
 * The sidecar's runtime-edge port: file primitives, permission checks,
 * randomness, and the keyed hash. Production implements it in
 * `state/driver/runtime-edge.ts`; tests inject byte-level fakes.
 */
export type RetroSidecarIo = {
  readonly stateDirectory: string;
  readonly workspaceId: string;
  readonly readTimeoutMs: number;
  readonly appendTimeoutMs: number;
  exists(path: string): boolean;
  readText(path: string): string;
  createExclusive(path: string, text: string): boolean;
  writeText(path: string, text: string): void;
  appendText(path: string, text: string): void;
  removeFile(path: string): void;
  ensureDirectory(path: string): void;
  verifyPermissions(path: string, kind: "file" | "directory"): boolean;
  applyPermissions(path: string, kind: "file" | "directory"): void;
  randomHex(bytes: number): string;
  keyedHash(keyHex: string, previousLink: string, content: string): string;
};

/** One delivered state record family read for a change (F-1). */
export type RetroStateFamilies = {
  readonly transitions: readonly PhaseTransitionRecord[];
  readonly closeouts: readonly StateJsonValue[];
  readonly telemetry: readonly StateJsonValue[];
};

/** The pm-notes typed retro notes read for a change (F-1). */
export type RetroNotesRead = {
  readonly retroNotes: readonly string[];
};

/** The collector's GET-only read seam; every function is injected. */
export type RetroCollectorRead = {
  readAuditLedger(query: AuditReadQuery): AuditReadResult<AuditReadOutcome>;
  readStateFamilies(changeRef: string): RetroStateFamilies;
  readNotes(changeRef: string): RetroNotesRead;
};

/** A completed-change fact used for automatic target selection (DEC-5). */
export type RetroChangeFacts = {
  readonly changeRef: string;
  readonly completedAt?: string;
  readonly transitions: readonly PhaseTransitionRecord[];
};

/** The data-only command runtime the CLI edge composes. */
export type RetroCommandData = RetroCollectSummary | RetroReportData;

export type RetroCommandOutcome =
  | { readonly ok: true; readonly data: RetroCommandData }
  | {
      readonly ok: false;
      readonly error: RetroFailure;
      readonly partial?: string;
    };

export type RetroCommandRuntime = {
  collect(input: {
    readonly level: RetroLevelName;
    readonly changeRef?: string;
  }): RetroCommandOutcome | Promise<RetroCommandOutcome>;
  report(input: {
    readonly level: RetroLevelName;
  }): RetroCommandOutcome | Promise<RetroCommandOutcome>;
};

/* -------------------------------- bounds ---------------------------------- */

/** The declared audit-ledger read bound used by the collector (NFR-5). */
export const RETRO_AUDIT_READ_LIMIT = 1000 as const;

/** The declared read budget referenced at the admitted I/O seam (PIN-7). */
export const RETRO_READ_TIMEOUT_MS = 10000 as const;

/** The declared append budget referenced at the admitted I/O seam (PIN-7). */
export const RETRO_APPEND_TIMEOUT_MS = 30000 as const;

/** The export bound: no unbounded export path exists (PIN-8). */
export const RETRO_EXPORT_MAX_LIMIT = 1000 as const;

/** The one declared target ordering: completion DESC, then change ref ASC. */
export const RETRO_TARGET_ORDER = "completion-desc-ref-asc" as const;

/** The one declared not-landed consequence for every retro failure. */
export const RETRO_FAILURE_CONSEQUENCE = "not_landed" as const;
