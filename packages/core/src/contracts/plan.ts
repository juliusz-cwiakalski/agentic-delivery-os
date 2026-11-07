/**
 * The `delivery.plan.v1` vocabulary (GH-226 F-1..F-13, DM-1..DM-8).
 *
 * Runtime-neutral by construction: types plus `as const` data and two pure
 * file-name helpers only — no I/O, clock, randomness, or environment access.
 *
 * Wildcard semantics (the comparison contract for validation, overlap, and
 * diff):
 *
 * - `files` entries are concrete repository-relative paths and match exactly.
 * - `folders` entries are directory prefixes. A folder matches the folder
 *   itself and any descendant path; matching is boundary-aware, so `src/plan`
 *   matches `src/plan/a.ts` but never `src/planner/a.ts` (no prefix bleed).
 * - `packages` entries are package-granularity globs such as
 *   `packages/core/src/contracts/**`. `*` stays inside one path segment and
 *   `**` crosses segments. A package entry with no wildcard is treated as a
 *   folder prefix with the same boundary rule.
 *
 * Tier phase sets and escalation triggers are inert declaration data; this
 * module declares a known-identifier set only, never a default phase set.
 */

/** The only plan document schema identifier this build accepts. */
export const PLAN_SCHEMA_VERSION = "delivery.plan.v1" as const;

/** Schema versions that validate; forward versions classify as invalid. */
export const PLAN_SUPPORTED_SCHEMA_VERSIONS = ["delivery.plan.v1"] as const;

/** Change artifact name prefix shared by every plan format. */
export const PLAN_FILE_PREFIX = "chg-" as const;

/** Machine-readable plan file suffix (DEC-7, authoritative format). */
export const PLAN_YAML_FILE_SUFFIX = "-plan.yaml" as const;

/** Legacy markdown plan file suffix (readable transition format). */
export const PLAN_LEGACY_FILE_SUFFIX = "-plan.md" as const;

/** Known ceremony tiers: identifiers only, never a default phase set. */
export const PLAN_KNOWN_TIERS = ["full", "lite"] as const;

/** Declared phase kinds. Planning is lease-free; delivery takes leases. */
export const PLAN_PHASE_KINDS = ["planning", "delivery"] as const;

/** Declared scope keys, in report order. */
export const PLAN_SCOPE_KEYS = ["files", "packages", "folders"] as const;

/** The lease class a phase kind implies (DEC-4). */
export const PLAN_LEASE_CLASSES = ["lease-free", "lease-taking"] as const;

/** Typed done-artifact slots, in report order. */
export const PLAN_DONE_ARTIFACT_SLOTS = [
  "mergeRequestUrl",
  "pipelineId",
  "deployedEnvironment",
  "trackerTransition",
] as const;

/** Declared interaction kinds. */
export const PLAN_INTERACTION_KINDS = ["contract-file", "generated-code"] as const;

/** Declared interaction roles. */
export const PLAN_INTERACTION_ROLES = ["producer", "consumer"] as const;

/** Overlap verdicts. */
export const PLAN_OVERLAP_VERDICTS = ["parallel", "run-in-sequence"] as const;

/** Stable overlap reason vocabulary (OQ-6). */
export const PLAN_OVERLAP_REASONS = ["shared-contract-files", "shared-paths"] as const;

/** Diff path classifications. */
export const PLAN_DIFF_CLASSIFICATIONS = [
  "within",
  "outside-declared",
  "undeclared-missing",
] as const;

/** Validation verdicts. */
export const PLAN_VALIDATION_VERDICTS = ["valid", "invalid"] as const;

/** Plan artifact formats. */
export const PLAN_ARTIFACT_KINDS = ["yaml", "markdown"] as const;

/** The documented base used when `--against` is omitted. */
export const PLAN_DEFAULT_DIFF_BASE = "main-tools" as const;

/** Bounds keep every verdict payload finite and deterministic (NFR-4). */
export const PLAN_MAX_PHASES = 64 as const;
export const PLAN_MAX_SCOPE_PATHS = 512 as const;
export const PLAN_MAX_LEASE_NAMES = 16 as const;
export const PLAN_MAX_INTERACTIONS = 32 as const;
export const PLAN_MAX_ERRORS = 32 as const;
export const PLAN_MAX_OVERLAPPING_PATHS = 64 as const;
export const PLAN_MAX_DIFF_PATHS = 64 as const;
export const PLAN_MAX_PATH_CHARS = 512 as const;
export const PLAN_MAX_DOCUMENT_BYTES = 1_048_576 as const;

/** The five additive `plan.*` identities (DM-8, NFR-5). */
export const PLAN_ERROR_CODES = [
  "plan.schema.invalid",
  "plan.scope.undeclared-paths",
  "plan.tier.unknown",
  "plan.format.legacy-markdown",
  "plan.artifact.missing",
] as const;

/** The lint-surface unreadable class (lint(1) exit 2). */
export const LINT_DOCUMENT_UNREADABLE_CODE = "lint.document.unreadable" as const;

/** A declared plan error identity. */
export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];

/** A known ceremony tier identifier; plans may declare others and be rejected. */
export type PlanKnownTier = (typeof PLAN_KNOWN_TIERS)[number];

/** Planning phases are lease-free; delivery phases take repository leases. */
export type PlanPhaseKind = (typeof PLAN_PHASE_KINDS)[number];

/** The lease class implied by a phase kind. */
export type PlanLeaseClass = (typeof PLAN_LEASE_CLASSES)[number];

/** A typed done-artifact slot name. */
export type PlanDoneArtifactSlot = (typeof PLAN_DONE_ARTIFACT_SLOTS)[number];

/** Declared interaction kind and role. */
export type PlanInteractionKind = (typeof PLAN_INTERACTION_KINDS)[number];
export type PlanInteractionRole = (typeof PLAN_INTERACTION_ROLES)[number];

/** The pairwise answer; a sequence verdict is a verdict, not a failure. */
export type PlanOverlapVerdict = (typeof PLAN_OVERLAP_VERDICTS)[number];

/** Stable reason strings for a sequence verdict (OQ-6). */
export type PlanOverlapReason = (typeof PLAN_OVERLAP_REASONS)[number];

/** Declared-versus-actual path classification. */
export type PlanDiffClassification = (typeof PLAN_DIFF_CLASSIFICATIONS)[number];

/** The validate verdict. */
export type PlanValidationVerdict = (typeof PLAN_VALIDATION_VERDICTS)[number];

/** The plan artifact format read for a ref. */
export type PlanArtifactKind = (typeof PLAN_ARTIFACT_KINDS)[number];

/**
 * Per-phase declared scope. A phase must declare at least one non-empty key;
 * the three keys follow the wildcard semantics documented at the module top.
 */
export type PlanScope = {
  readonly files?: readonly string[];
  readonly packages?: readonly string[];
  readonly folders?: readonly string[];
};

/** Normalized scope echo: every key present, possibly empty. */
export type PlanScopeEcho = {
  readonly files: readonly string[];
  readonly packages: readonly string[];
  readonly folders: readonly string[];
};

/** Typed per-phase done-artifact declaration slots (DM-3). */
export type PlanDoneArtifacts = {
  readonly mergeRequestUrl?: string;
  readonly pipelineId?: string;
  readonly deployedEnvironment?: string;
  readonly trackerTransition?: string;
};

/** A declared interaction: the phase writes/holds a contract or generated file. */
export type PlanInteraction = {
  readonly kind: PlanInteractionKind;
  readonly target: string;
  readonly role: PlanInteractionRole;
};

/** One declared phase (DM-2..DM-5). */
export type PlanPhase = {
  readonly id: number;
  readonly title: string;
  readonly kind: PlanPhaseKind;
  /** Optional one-line plan-phase summary consumed by the commit message. */
  readonly summary?: string;
  readonly scope: PlanScope;
  readonly doneArtifacts?: PlanDoneArtifacts;
  readonly leases?: readonly string[];
  readonly weightClass?: string;
  readonly interactions?: readonly PlanInteraction[];
  /** Optional declaration; when present it must match the phase kind. */
  readonly leaseClass?: PlanLeaseClass;
};

/** Ceremony tier as plan data: phase set and escalation triggers (DM-6). */
export type PlanTierDeclaration = {
  readonly name: string;
  readonly phases?: readonly number[];
  readonly escalationTriggers?: readonly string[];
};

/** The validated machine-readable plan document (DM-1). */
export type PlanDocument = {
  readonly schemaVersion: string;
  readonly workItemRef?: string;
  readonly tier: PlanTierDeclaration;
  readonly defaultLeases?: readonly string[];
  readonly defaultWeightClass?: string;
  readonly phases: readonly PlanPhase[];
};

/** The artifact identity read for a ref. */
export type PlanArtifactRef = {
  readonly kind: PlanArtifactKind;
  readonly path: string;
};

/** A classified plan validation error naming the phase and field. */
export type PlanValidationError = {
  readonly code: PlanErrorCode;
  readonly field: string;
  readonly problem: "missing" | "invalid" | "unsupported";
  readonly phase?: number;
  readonly detail?: string;
};

/** Echoed per-phase verdict data (DM-7). */
export type PlanPhaseVerdict = {
  readonly id: number;
  readonly title: string;
  readonly kind: PlanPhaseKind;
  readonly leaseClass: PlanLeaseClass;
  readonly summary?: string;
  readonly scope: PlanScopeEcho;
  readonly leases: readonly string[];
  readonly interactions: readonly PlanInteraction[];
  readonly tier: string;
  readonly doneArtifacts?: PlanDoneArtifacts;
  readonly weightClass?: string;
};

/** `plan validate` envelope data (DM-7, F-8, F-12). */
export type PlanValidateData = {
  readonly verdict: PlanValidationVerdict;
  readonly readyForDevelopment: boolean;
  readonly perPhase: readonly PlanPhaseVerdict[];
  readonly errors: readonly PlanValidationError[];
  readonly truncated: boolean;
  readonly totalErrors: number;
  readonly artifact?: PlanArtifactRef;
  readonly schemaVersion?: string;
  readonly tier?: string;
  readonly tierDeclaration?: PlanTierDeclaration;
};

/** `plan overlap` envelope data (DM-7, F-10). */
export type PlanOverlapData = {
  readonly verdict: PlanOverlapVerdict;
  readonly planA: string;
  readonly planB: string;
  readonly overlappingPaths: readonly string[];
  readonly truncated: boolean;
  readonly totalOverlappingPaths: number;
  readonly ordering?: string;
  readonly reason?: PlanOverlapReason;
};

/** One path in the declared-versus-actual table. */
export type PlanDiffEntry = {
  readonly path: string;
  readonly classification: PlanDiffClassification;
  readonly phase?: number;
};

/** A classified diff finding; out-of-scope paths carry the scope code. */
export type PlanDiffFinding = {
  readonly classification: Exclude<PlanDiffClassification, "within">;
  readonly path: string;
  readonly code?: PlanErrorCode;
  readonly phase?: number;
};

/** `plan diff` envelope data (DM-7, F-9). */
export type PlanDiffData = {
  readonly verdict: "within" | "findings";
  readonly against: string;
  readonly entries: readonly PlanDiffEntry[];
  readonly findings: readonly PlanDiffFinding[];
  readonly truncated: boolean;
  readonly totalEntries: number;
};

/** A plan artifact read: text, absence, or an unreadable document. */
export type PlanArtifactRead =
  | {
      readonly ok: true;
      readonly artifact: PlanArtifactRef;
      readonly text: string;
    }
  | {
      readonly ok: false;
      readonly reason: "absent" | "unreadable";
      readonly workItemRef: string;
      readonly path?: string;
    };

/** The injected YAML parse port outcome. */
export type PlanParseResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly reason: "unparseable" | "bounded" };

/** The injected pure YAML parse port. */
export type PlanYamlParser = (text: string) => PlanParseResult;

/** The injected plan-read port (one plan read per validate invocation). */
export type PlanReadPort = (workItemRef: string) => PlanArtifactRead;

/** A repository-diff read outcome; paths are repository-relative. */
export type PlanDiffRead =
  | { readonly ok: true; readonly paths: readonly string[] }
  | { readonly ok: false; readonly reason: "unreadable"; readonly workItemRef: string };

/** The injected repository-diff port (one read per diff invocation). */
export type PlanDiffPort = (workItemRef: string, base: string) => PlanDiffRead;

/** The artifact path for a ref and format (chg-<ref>-plan.<ext>). */
export const planArtifactPath = (workItemRef: string, kind: PlanArtifactKind): string =>
  `${PLAN_FILE_PREFIX}${workItemRef}${kind === "yaml" ? PLAN_YAML_FILE_SUFFIX : PLAN_LEGACY_FILE_SUFFIX}`;

/** The lease class implied by a phase kind (DEC-4). */
export const leaseClassForPhaseKind = (kind: PlanPhaseKind): PlanLeaseClass =>
  kind === "planning" ? "lease-free" : "lease-taking";
