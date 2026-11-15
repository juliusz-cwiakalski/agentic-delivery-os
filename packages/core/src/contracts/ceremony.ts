/**
 * The `delivery.ceremony.*` vocabulary (GH-296 F-2, F-4, F-5, F-7, F-8, F-9;
 * DM-1..DM-9).
 *
 * Runtime-neutral by construction: types plus `as const` data only. This module
 * is the single home of the declaration contract, the closed vocabularies and
 * bounds, the note contract, the run/step record payload shapes, the tier
 * verdict types, the comparison record types, and the port shapes the pure
 * engine consumes. No clock, randomness, environment, network, or filesystem
 * access lives here.
 */
import type { PmNotesVariant } from "./pm-notes.js";
import type { PlanKnownTier } from "./plan.js";
import type { StateArtifactBoundaryDeclaration } from "./state.js";

/* ------------------------------- schemas --------------------------------- */

/** The declaration document schema identity (DM-1). */
export const CEREMONY_DECLARATIONS_SCHEMA = "delivery.ceremony.declarations.v1" as const;

/** The ceremony note schema identity (DM-2). */
export const CEREMONY_NOTE_SCHEMA = "delivery.ceremony.note.v1" as const;

/** The run record payload schema identity (DM-3). */
export const CEREMONY_RUN_PAYLOAD_SCHEMA = "delivery.ceremony.run.v1" as const;

/** The step record payload schema identity (DM-4). */
export const CEREMONY_STEP_PAYLOAD_SCHEMA = "delivery.ceremony.step.v1" as const;

/** The comparison record schema identity (DM-8). */
export const CEREMONY_COMPARISON_SCHEMA = "delivery.ceremony.comparison.v1" as const;

/** The committed ceremony-share metric identity (F-8; reused, never reallocated). */
export const CEREMONY_SHARE_METRIC_ID = "MET-CEREMONY-SHARE" as const;

/* ----------------------------- state kinds ------------------------------- */

/** The additive run record kind (DM-3). */
export const CEREMONY_RUN_RECORD_KIND = "ceremony.run" as const;

/** The additive step record kind (DM-4). */
export const CEREMONY_STEP_RECORD_KIND = "ceremony.step" as const;

/** The run record-key prefix: one history per run identity (DM-3). */
export const CEREMONY_RUN_RECORD_KEY_PREFIX = "ceremony.runs:" as const;

/** The step record-key prefix: one history per run id (DM-4). */
export const CEREMONY_STEP_RECORD_KEY_PREFIX = "ceremony.steps:" as const;

/* ---------------------------- vocabularies ------------------------------- */

/** The closed step-kind vocabulary (DM-1). */
export const CEREMONY_STEP_KINDS = [
  "collect",
  "fold",
  "render",
  "assess",
  "sync",
  "record",
] as const;

/** The closed output-slot vocabulary (DM-1). */
export const CEREMONY_OUTPUT_SLOTS = [
  "memory",
  "ceremony-artifact",
  "state-record",
  "mirror-target",
] as const;

/** The closed verification-mode vocabulary (DM-1). */
export const CEREMONY_VERIFICATION_MODES = [
  "artifact-conforms",
  "artifact-covers-items",
  "artifact-equals-source",
] as const;

/** The closed trigger-event vocabulary (DM-1). */
export const CEREMONY_TRIGGER_EVENTS = [
  "session-end",
  "incident-severity",
  "milestone-end",
  "change-merged",
  "owner-note",
  "pre-dispatch",
] as const;

/** The closed cadence vocabulary (DM-1). */
export const CEREMONY_CADENCES = ["daily", "weekly", "milestone", "iteration"] as const;

/** The closed catch-up mode vocabulary (DM-1). */
export const CEREMONY_CATCH_UP_MODES = ["once", "none"] as const;

/** The closed scope-key derivation vocabulary (DM-1, DEC-16). */
export const CEREMONY_SCOPE_KEY_KINDS = ["literal", "repository", "note"] as const;

/** The closed recorded-trigger kind vocabulary (DM-1). */
export const CEREMONY_RECORDED_TRIGGER_KINDS = [
  "schedule",
  "event",
  "catch-up",
  "explicit",
] as const;

/** The closed recorded-trigger resolution vocabulary (DM-1). */
export const CEREMONY_TRIGGER_RESOLUTIONS = ["note", "declaration", "unspecified"] as const;

/** The closed assess verdict vocabulary (DM-1). */
export const CEREMONY_ASSESS_VERDICTS = [
  "covered",
  "partial",
  "uncovered",
  "not-applicable",
] as const;

/** The closed run verdict vocabulary (DM-1). */
export const CEREMONY_RUN_VERDICTS = ["verified", "dry-run", "unverified"] as const;

/** The closed run origin vocabulary (DM-3). */
export const CEREMONY_RUN_ORIGINS = ["built-in", "project"] as const;

/** The closed retro level vocabulary (F-9). */
export const CEREMONY_LEVELS = ["session", "incident", "window", "project"] as const;

/** The closed declared-input source vocabulary (F-2, F-3). */
export const CEREMONY_INPUT_SOURCES = [
  "status-facts",
  "brief-projection",
  "spend-citation",
  "open-questions",
  "provider-parks",
  "retro-evidence",
  "retro-runs",
  "memory-audit",
  "pm-notes-retro",
  "queue-state",
  "tracker-milestone",
  "measurement-metrics",
  "audit-ledger",
  "harness-telemetry",
  "lane-queue-facts",
  "gate-verification",
  "owner-note",
  "test-artifacts",
  "gate-report",
  "decision-register",
  "affected-repositories",
] as const;

/** The closed carry-over reason vocabulary (GAP-2, pinned by the contract suite). */
export const CEREMONY_CARRY_OVER_REASONS = [
  "blocked-dependency",
  "unfinished-scope",
  "awaiting-review",
  "owner-gate",
  "carried-by-owner",
] as const;

/** The closed follow-through verdict vocabulary (F-9). */
export const CEREMONY_FOLLOW_THROUGH_VERDICTS = [
  "applied",
  "partial",
  "violated-with-consequence",
] as const;

/** The closed escalation-trigger vocabulary (F-7, DEC-13). */
export const CEREMONY_ESCALATION_TRIGGERS = [
  "phase-reopen",
  "dor-rework",
  "review-rework",
  "gate-failure",
  "owner-escalation",
] as const;

/** The closed tier finding-kind vocabulary (DM-7). */
export const CEREMONY_TIER_FINDING_KINDS = [
  "tier-mismatch",
  "unresolved-phase",
  "unevaluated-trigger",
] as const;

/** The closed escalation-trigger evaluation state vocabulary (DM-7). */
export const CEREMONY_ESCALATION_STATES = ["matched", "unmatched", "unevaluated"] as const;

/** The closed comparison verdict vocabulary (DM-8). */
export const CEREMONY_COMPARISON_VERDICTS = [
  "improved",
  "regressed",
  "flat",
  "not-established",
  "insufficient-sample",
] as const;

/** The closed night-watch check state vocabulary (F-3). */
export const CEREMONY_CHECK_STATES = ["clean", "anomaly", "unavailable"] as const;

/** The declared sample minimum for the comparison record (DEC-14). */
export const CEREMONY_SAMPLE_MINIMUM = 5 as const;

/** The declared declaration bounds (DM-1, F-2). */
export const CEREMONY_DECLARATION_LIMITS = {
  ceremoniesPerDocument: 16,
  phases: 12,
  steps: 32,
  inputs: 16,
  targets: 8,
  triggers: 8,
  documentBytes: 1_048_576,
  idLength: 64,
  compactionBytes: 4_096,
  compactionLines: 40,
} as const;

/** The declared identifier grammar (DM-1). */
export const CEREMONY_ID_PATTERN = "^[a-z][a-z0-9-]*$" as const;

/** The declared UTC minute-of-day grammar (F-2). */
export const CEREMONY_AT_PATTERN = "^(?:[01][0-9]|2[0-3]):[0-5][0-9]$" as const;

/**
 * The declared cadence window length in days for the cadences whose period is
 * not defined by an external calendar (declaration data, never an ambient read).
 */
export const CEREMONY_CADENCE_WINDOW_DAYS = { iteration: 14, milestone: 30 } as const;

/** The compacted-summary bound (DEC-11, NFR-7). */
export const CEREMONY_COMPACTION_MAX_BYTES = 4_096 as const;

/** The compacted-summary line bound (DEC-11, NFR-7). */
export const CEREMONY_COMPACTION_MAX_LINES = 40 as const;

/** The raw-run record serialized bound (NFR-7). */
export const CEREMONY_RUN_RECORD_MAX_BYTES = 16_384 as const;

/** The raw-step record serialized bound (NFR-7). */
export const CEREMONY_STEP_RECORD_MAX_BYTES = 2_048 as const;

/* -------------------------------- types ---------------------------------- */

export type CeremonyStepKind = (typeof CEREMONY_STEP_KINDS)[number];
export type CeremonyOutputSlot = (typeof CEREMONY_OUTPUT_SLOTS)[number];
export type CeremonyVerificationMode = (typeof CEREMONY_VERIFICATION_MODES)[number];
export type CeremonyTriggerEvent = (typeof CEREMONY_TRIGGER_EVENTS)[number];
export type CeremonyCadence = (typeof CEREMONY_CADENCES)[number];
export type CeremonyCatchUpMode = (typeof CEREMONY_CATCH_UP_MODES)[number];
export type CeremonyScopeKeyKind = (typeof CEREMONY_SCOPE_KEY_KINDS)[number];
export type CeremonyRecordedTriggerKind = (typeof CEREMONY_RECORDED_TRIGGER_KINDS)[number];
export type CeremonyTriggerResolution = (typeof CEREMONY_TRIGGER_RESOLUTIONS)[number];
export type CeremonyAssessVerdict = (typeof CEREMONY_ASSESS_VERDICTS)[number];
export type CeremonyRunVerdict = (typeof CEREMONY_RUN_VERDICTS)[number];
export type CeremonyRunOrigin = (typeof CEREMONY_RUN_ORIGINS)[number];
export type CeremonyLevel = (typeof CEREMONY_LEVELS)[number];
export type CeremonyInputSource = (typeof CEREMONY_INPUT_SOURCES)[number];
export type CeremonyCarryOverReason = (typeof CEREMONY_CARRY_OVER_REASONS)[number];
export type CeremonyFollowThroughVerdict = (typeof CEREMONY_FOLLOW_THROUGH_VERDICTS)[number];
export type CeremonyEscalationTrigger = (typeof CEREMONY_ESCALATION_TRIGGERS)[number];
export type CeremonyTierFindingKind = (typeof CEREMONY_TIER_FINDING_KINDS)[number];
export type CeremonyEscalationState = (typeof CEREMONY_ESCALATION_STATES)[number];
export type CeremonyComparisonVerdict = (typeof CEREMONY_COMPARISON_VERDICTS)[number];
export type CeremonyCheckState = (typeof CEREMONY_CHECK_STATES)[number];
export type CeremonyTier = PlanKnownTier;

/** One half-open window with ISO-8601 bounds (DM-2). */
export type CeremonyWindow = {
  readonly start: string;
  readonly end: string;
};

/** One declared schedule or event trigger (F-2). */
export type CeremonyTriggerDeclaration =
  | {
      readonly kind: "schedule";
      readonly cadence: CeremonyCadence;
      readonly at?: string;
    }
  | { readonly kind: "event"; readonly event: CeremonyTriggerEvent };

/** One declared GET-only input (F-2). */
export type CeremonyInputDeclaration = {
  readonly source: CeremonyInputSource;
  readonly window?: boolean;
};

/** One declared output (F-2). */
export type CeremonyOutputDeclaration = {
  readonly slot: CeremonyOutputSlot;
  readonly schema: string;
};

/** One declared agenda step (F-2). */
export type CeremonyStepDeclaration = {
  readonly kind: CeremonyStepKind;
  readonly inputs?: readonly CeremonyInputSource[];
  readonly outputs: readonly CeremonyOutputDeclaration[];
  readonly verify: CeremonyVerificationMode;
};

/** One declared agenda phase (F-2). */
export type CeremonyPhaseDeclaration = {
  readonly id: string;
  readonly steps: readonly CeremonyStepDeclaration[];
};

/** The declaration-held scope-key derivation (F-2, DEC-16). */
export type CeremonyScopeKeyDeclaration =
  | { readonly kind: "literal"; readonly value: string }
  | { readonly kind: "repository" }
  | { readonly kind: "note" };

/** The optional note requirement (F-2, DM-2). */
export type CeremonyNoteRequirement = {
  readonly required: boolean;
  readonly schema: string;
  readonly scopeKey: "required";
};

/** The declared catch-up semantics (F-5). */
export type CeremonyCatchUpDeclaration = {
  readonly mode: CeremonyCatchUpMode;
  readonly maxMissedWindows: 1;
};

/** The declared compaction policy (F-4, DEC-11). */
export type CeremonyCompactionDeclaration = {
  readonly atPhases: readonly number[];
  readonly maxBytes: number;
  readonly maxLines: number;
};

/** One ceremony declaration: the single unit of ceremony data (DM-1). */
export type CeremonyDeclaration = {
  readonly id: string;
  readonly title: string;
  readonly tiers: readonly CeremonyTier[];
  readonly triggers: readonly CeremonyTriggerDeclaration[];
  readonly inputs: readonly CeremonyInputDeclaration[];
  readonly agenda: readonly CeremonyPhaseDeclaration[];
  readonly scopeKey: CeremonyScopeKeyDeclaration;
  readonly note?: CeremonyNoteRequirement;
  readonly catchUp: CeremonyCatchUpDeclaration;
  readonly compaction: CeremonyCompactionDeclaration;
};

/** The committed declaration document (DM-1, F-6). */
export type CeremonyDocument = {
  readonly schemaVersion: string;
  readonly ceremonies: readonly CeremonyDeclaration[];
};

/** One fixed-schema retro win: the win and its mechanism (F-9). */
export type CeremonyWin = {
  readonly text: string;
  readonly mechanism: string;
};

/** The ceremony note contract (DM-2, F-9). */
export type CeremonyNote = {
  readonly schemaId: typeof CEREMONY_NOTE_SCHEMA;
  readonly ceremony: string;
  readonly scopeKey: string;
  readonly window: CeremonyWindow;
  readonly trigger?: string;
  readonly level?: CeremonyLevel;
  readonly participants?: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly facts?: readonly string[];
  readonly interpretations?: readonly string[];
  readonly wins?: readonly CeremonyWin[];
  readonly gaps?: readonly string[];
  readonly candidateLessons?: readonly string[];
  readonly actions?: readonly string[];
  readonly confidence?: string;
  readonly body?: string;
};

/** The recorded trigger provenance carried by one run (DM-3). */
export type CeremonyRecordedTrigger = {
  readonly kind: CeremonyRecordedTriggerKind;
  readonly resolution: CeremonyTriggerResolution;
  readonly declared?: string;
  readonly declaredSet?: readonly string[];
  readonly declaredWindow: CeremonyWindow;
  readonly actualWindow: CeremonyWindow;
  readonly catchUp?: boolean;
};

/** One tier escalation carried by a run (DM-3, DM-7). */
export type CeremonyTierEscalation = {
  readonly trigger: string;
  readonly evidence: string;
  readonly effectiveFromPhase?: string;
};

/** The tier facts a run consumed (DM-3). */
export type CeremonyRunTierFacts = {
  readonly effectiveTier: CeremonyTier;
  readonly phaseSetSize: number;
  readonly escalations: readonly CeremonyTierEscalation[];
};

/** The additive `ceremony.run` payload (DM-3). */
export type CeremonyRunRecord = {
  readonly schemaId: typeof CEREMONY_RUN_PAYLOAD_SCHEMA;
  readonly ceremonyId: string;
  readonly runId: string;
  readonly origin: CeremonyRunOrigin;
  readonly declarationDigest: string;
  readonly trigger: CeremonyRecordedTrigger;
  readonly scopeKey: {
    readonly value: string;
    readonly derivation: CeremonyScopeKeyKind;
  };
  readonly tier: CeremonyRunTierFacts;
  readonly startedAtMs: number;
  readonly phaseCount: number;
};

/** The step outcome vocabulary recorded per attempt (DM-4). */
export type CeremonyStepOutcome = "verified" | "unverified" | "dry-run";

/** The additive `ceremony.step` payload (DM-4). */
export type CeremonyStepRecord = {
  readonly schemaId: typeof CEREMONY_STEP_PAYLOAD_SCHEMA;
  readonly runId: string;
  readonly index: number;
  readonly phaseIndex: number;
  readonly kind: CeremonyStepKind;
  readonly outcome: CeremonyStepOutcome;
  readonly startedAtMs: number;
  readonly endedAtMs: number;
  readonly durationMs: number;
  readonly slot: CeremonyOutputSlot;
  readonly artifactRef: string;
  readonly verification: "verified" | "unverified";
  readonly reason?: string;
};

/** One declared escalation-trigger evaluation (DM-7). */
export type CeremonyTierTriggerEvaluation = {
  readonly trigger: string;
  readonly state: CeremonyEscalationState;
  readonly evidence?: string;
};

/** One structured tier finding (DM-7). */
export type CeremonyTierFinding = {
  readonly kind: CeremonyTierFindingKind;
  readonly subject: string;
  readonly detail?: string;
};

/** The tier engine's data verdict (DM-7). */
export type CeremonyTierVerdict = {
  readonly effectiveTier: CeremonyTier;
  readonly phaseSet: readonly string[];
  readonly phaseSetSource: string;
  readonly declaredTier: string;
  readonly declaredVariant: PmNotesVariant;
  readonly escalationTriggers: readonly CeremonyTierTriggerEvaluation[];
  readonly escalations: readonly CeremonyTierEscalation[];
  readonly findings: readonly CeremonyTierFinding[];
};

/** One per-ceremony native-basis aggregate (DM-8, OQ-2 adopted). */
export type CeremonyNativeAggregate = {
  readonly ceremony: string;
  readonly runs: number;
  readonly meanMs: number;
  readonly p90Ms: number;
};

/** One after-window per-change value (DM-8). */
export type CeremonyComparisonSample = {
  readonly changeRef: string;
  readonly value: number;
};

/** The committed ceremony-share comparison record (DM-8). */
export type CeremonyComparisonRecord = {
  readonly schemaId: typeof CEREMONY_COMPARISON_SCHEMA;
  readonly metricId: typeof CEREMONY_SHARE_METRIC_ID;
  readonly definitionRef: {
    readonly logPath: string;
    readonly sourceCommit: string;
  };
  readonly before: {
    readonly value: number;
    readonly window: CeremonyWindow;
    readonly sampleSize: number;
    readonly status: string;
    readonly basis: string;
  };
  readonly after: {
    readonly value: number | null;
    readonly window: CeremonyWindow;
    readonly samples: readonly CeremonyComparisonSample[];
    readonly sampleSize: number;
    readonly basis: string;
  };
  readonly sampleMinimum: typeof CEREMONY_SAMPLE_MINIMUM;
  readonly verdict: CeremonyComparisonVerdict;
  readonly nativeBasis: {
    readonly runs: number;
    readonly steps: number;
    readonly phases: number;
    readonly perCeremony: readonly CeremonyNativeAggregate[];
    readonly statement: string;
  };
  readonly disclosure: string;
};

/* ------------------------------- ports ----------------------------------- */

/** One injected GET-only input read: present, absent, or unavailable (F-3). */
export type CeremonyInputRead =
  | { readonly state: "present"; readonly facts: unknown }
  | { readonly state: "absent"; readonly reason: string }
  | { readonly state: "unavailable"; readonly reason: string };

/** The injected input reader seam; every read is a declared source (F-2). */
export type CeremonyInputReader = (
  source: CeremonyInputSource,
  window: CeremonyWindow,
) => CeremonyInputRead;

/** One artifact-slot write result. */
export type CeremonyArtifactWrite =
  | { readonly ok: true; readonly ref: string }
  | { readonly ok: false; readonly detail: string };

/** One artifact-slot read result. */
export type CeremonyArtifactRead =
  | { readonly ok: true; readonly content: string }
  | { readonly ok: false; readonly detail: string };

/** The injected artifact-slot seam: byte-level write and read-back (DM-6). */
export type CeremonyArtifactPort = {
  write(input: {
    readonly runId: string;
    readonly slot: CeremonyOutputSlot;
    readonly schema: string;
    readonly content: string;
  }): CeremonyArtifactWrite;
  read(input: {
    readonly runId: string;
    readonly slot: CeremonyOutputSlot;
    readonly ref: string;
  }): CeremonyArtifactRead;
};

/** One verified/bounded records read verdict (DM-5). */
export type CeremonyRecordsVerdict = "valid" | "verified-empty" | "torn" | "unknown";

/** One records read with its verdict and in-band malformed positions (DM-5). */
export type CeremonyRecordsRead<T> = {
  readonly verdict: CeremonyRecordsVerdict;
  readonly records: readonly T[];
  readonly malformed: readonly number[];
  readonly detail?: string;
};

/** One record append result; failures carry a delivered state identity. */
export type CeremonyRecordAppend =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly detail?: string };

/** The injected record seam over the state layer's boundary-validated appends. */
export type CeremonyRecordPort = {
  readRuns(): CeremonyRecordsRead<CeremonyRunRecord>;
  readSteps(runId: string): CeremonyRecordsRead<CeremonyStepRecord>;
  appendRun(record: CeremonyRunRecord): CeremonyRecordAppend;
  appendStep(record: CeremonyStepRecord): CeremonyRecordAppend;
};

/** One mirror-target inspection (F-3, NFR-12). */
export type CeremonyMirrorInspection = {
  readonly state: "clean" | "absent" | "dirty" | "wrong-base";
  readonly base?: string;
  readonly mirrorSet: readonly string[];
  readonly sourceSet: readonly string[];
};

/** The injected mirror-sync seam (F-3, NFR-12). */
export type CeremonyMirrorPort = {
  inspect(target: string): CeremonyMirrorInspection;
  apply(
    target: string,
    records: readonly string[],
  ): { readonly ok: boolean; readonly detail?: string };
};

/** One memory-slot note read. */
export type CeremonyNoteRead =
  | { readonly state: "absent" }
  | { readonly state: "present"; readonly body: string };

/** The injected memory-slot seam for retro notes (F-9, DM-6). */
export type CeremonyMemoryPort = {
  readNote(scopeKey: string): CeremonyNoteRead;
  writeNote(input: {
    readonly scopeKey: string;
    readonly level?: CeremonyLevel;
    readonly body: string;
    readonly append: boolean;
  }): { readonly ok: true } | { readonly ok: false; readonly detail: string };
};

/* --------------------------- state boundary ------------------------------ */

/** The validated ceremony record boundary declaration (DM-5). */
export const CEREMONY_RECORD_BOUNDARY_DECLARATION: StateArtifactBoundaryDeclaration = {
  recordKeyPrefix: "ceremony.",
  kinds: [
    {
      kind: CEREMONY_RUN_RECORD_KIND,
      payloadSchema: CEREMONY_RUN_PAYLOAD_SCHEMA,
      identityField: "runId",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "ceremonyId", type: "string", required: true },
        { name: "runId", type: "string", required: true },
        { name: "origin", type: "string", required: true },
        { name: "declarationDigest", type: "string", required: true },
        { name: "trigger", type: "object", required: true },
        { name: "scopeKey", type: "object", required: true },
        { name: "tier", type: "object", required: true },
        { name: "startedAtMs", type: "number", required: true },
        { name: "phaseCount", type: "number", required: true },
      ],
      vocabularies: [{ field: "origin", values: CEREMONY_RUN_ORIGINS }],
    },
    {
      kind: CEREMONY_STEP_RECORD_KIND,
      payloadSchema: CEREMONY_STEP_PAYLOAD_SCHEMA,
      identityField: "runId",
      fields: [
        { name: "schemaId", type: "string", required: true },
        { name: "runId", type: "string", required: true },
        { name: "index", type: "number", required: true },
        { name: "phaseIndex", type: "number", required: true },
        { name: "kind", type: "string", required: true },
        { name: "outcome", type: "string", required: true },
        { name: "startedAtMs", type: "number", required: true },
        { name: "endedAtMs", type: "number", required: true },
        { name: "durationMs", type: "number", required: true },
        { name: "slot", type: "string", required: true },
        { name: "artifactRef", type: "string", required: true },
        { name: "verification", type: "string", required: true },
      ],
      vocabularies: [
        { field: "kind", values: CEREMONY_STEP_KINDS },
        { field: "outcome", values: ["verified", "unverified", "dry-run"] },
        { field: "slot", values: CEREMONY_OUTPUT_SLOTS },
        { field: "verification", values: ["verified", "unverified"] },
      ],
    },
  ],
};
