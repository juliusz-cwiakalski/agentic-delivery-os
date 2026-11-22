/**
 * The `delivery.merge.*` vocabulary (GH-225 F-1..F-8, DM-1..DM-4, EVT-1..3).
 *
 * Runtime-neutral by construction: types and `as const` data only. The gate
 * registry vocabulary, the declared default set, the freshness contract data,
 * the three additive record shapes, and the mutation-operation union are
 * declared once here. Gate ids, recipes, surfaces, schema versions, record
 * kinds, comparators, and caps are pinned; module and field spellings stay
 * delivery-bound (GAP-15).
 */
import type { OwnerGateClass, OwnerGateSlaComparator } from "./owner-gate-sla.js";
import type { VerifyGateCitation, VerifyGateVerdict } from "./verify-gates.js";

/** The five reserved built-in gate ids in shipped order (DEC-2, DEC-9). */
export const MERGE_BUILTIN_GATE_IDS = [
  "lifecycle-finalization",
  "ci-green",
  "push-parity",
  "owner-gate",
  "squash-preflight",
] as const;
export type MergeBuiltinGateId = (typeof MERGE_BUILTIN_GATE_IDS)[number];

/** The closed versioned recipe vocabulary (F-1). */
export const MERGE_GATE_RECIPES = [
  "lifecycle-finalization",
  "ci-green",
  "push-parity",
  "owner-gate",
  "squash-preflight",
  "required-ci-job",
  "tracker-freshness",
] as const;
export type MergeGateRecipe = (typeof MERGE_GATE_RECIPES)[number];

/** The three-value surface applicability dimension (DM-4). */
export const MERGE_GATE_SURFACES = ["battery", "merge", "both"] as const;
export type MergeGateSurface = (typeof MERGE_GATE_SURFACES)[number];

/** The closed gate-set schema-version set (DEC-9). */
export const MERGE_GATE_SET_SCHEMA_VERSIONS = ["delivery.merge.gates.v1"] as const;
export type MergeGateSetSchemaVersion = (typeof MERGE_GATE_SET_SCHEMA_VERSIONS)[number];

/** The shipped (and only supported) gate-set schema version. */
export const MERGE_GATE_SET_SCHEMA_VERSION = "delivery.merge.gates.v1" as const;

/** The fields a declared gate entry may carry (extra fields are refused). */
export const MERGE_GATE_ENTRY_FIELDS = ["id", "recipe", "surface", "class", "job"] as const;

/** The fields every declared gate entry must carry. */
export const MERGE_GATE_ENTRY_REQUIRED_FIELDS = ["id", "recipe", "surface"] as const;

/** One declared gate entry (DM-4). */
export type MergeGateEntry = {
  readonly id: string;
  readonly recipe: MergeGateRecipe;
  readonly surface: MergeGateSurface;
  readonly class?: OwnerGateClass;
  readonly job?: string;
};

/** The declared (or shipped default) gate set (DM-4). */
export type MergeDeclaredGateSet = {
  readonly schemaVersion: MergeGateSetSchemaVersion;
  readonly entries: readonly MergeGateEntry[];
};

/**
 * The shipped default set: the five built-ins on the battery surface, in
 * shipped order, plus the merge-only `tracker-freshness` entry (DEC-2).
 */
export const MERGE_DEFAULT_GATE_ENTRIES = [
  {
    id: "lifecycle-finalization",
    recipe: "lifecycle-finalization",
    surface: "battery",
  },
  { id: "ci-green", recipe: "ci-green", surface: "battery" },
  { id: "push-parity", recipe: "push-parity", surface: "battery" },
  {
    id: "owner-gate",
    recipe: "owner-gate",
    surface: "battery",
    class: "owner-review",
  },
  { id: "squash-preflight", recipe: "squash-preflight", surface: "battery" },
  {
    id: "tracker-freshness",
    recipe: "tracker-freshness",
    surface: "merge",
  },
] as const satisfies readonly MergeGateEntry[];

/** The shipped default declared set. */
export const MERGE_DEFAULT_GATE_SET = {
  schemaVersion: MERGE_GATE_SET_SCHEMA_VERSION,
  entries: MERGE_DEFAULT_GATE_ENTRIES,
} as const satisfies MergeDeclaredGateSet;

/** The freshness-bound configuration key (F-2, NFR-5). */
export const MERGE_GATE_FRESHNESS_KEY = "merge.gate-freshness" as const;

/** The shipped freshness bound: 1800 seconds (30 minutes). */
export const MERGE_GATE_FRESHNESS_DEFAULT_SECONDS = 1800 as const;

/** The declared boundary comparator: at-bound is stale (NFR-5). */
export const MERGE_FRESHNESS_COMPARATOR = ">=" as const satisfies OwnerGateSlaComparator;

/** The deploy-expectation configuration key (F-6, GAP-3). */
export const MERGE_DEPLOY_EXPECTATIONS_KEY = "merge.deploy-expectations" as const;

/** The declared gate-set identity separator between version and id list. */
export const MERGE_GATE_SET_IDENTITY_SEPARATOR = ":" as const;

/** The gate-verification record kind (EVT-1, DM-1). */
export const MERGE_GATE_VERIFICATION_RECORD_KIND = "merge.gate-verification" as const;
/** The gate-verification payload schema identifier (EVT-1, DM-1). */
export const MERGE_GATE_VERIFICATION_SCHEMA = "delivery.merge.gate-verification.v1" as const;

/** The waiver record kind (EVT-2, DM-2). */
export const MERGE_WAIVER_RECORD_KIND = "merge.waiver" as const;
/** The waiver payload schema identifier (EVT-2, DM-2). */
export const MERGE_WAIVER_SCHEMA = "delivery.merge.waiver.v1" as const;

/** The transaction record kind (EVT-3, DM-3). */
export const MERGE_TRANSACTION_RECORD_KIND = "merge.transaction" as const;
/** The transaction payload schema identifier (EVT-3, DM-3). */
export const MERGE_TRANSACTION_SCHEMA = "delivery.merge.transaction.v1" as const;

/** The two transaction results (F-8). */
export const MERGE_TRANSACTION_RESULTS = ["merged", "landing-unverified"] as const;
export type MergeTransactionResult = (typeof MERGE_TRANSACTION_RESULTS)[number];

/** The declared post-landing step ids (F-8, DM-3). */
export const MERGE_POST_LANDING_STEP_IDS = ["branch-deletion", "closeout-ready"] as const;
export type MergePostLandingStepId = (typeof MERGE_POST_LANDING_STEP_IDS)[number];

/** The declared post-landing step statuses. */
export const MERGE_POST_LANDING_STATUSES = ["ok", "failed", "skipped", "not-attempted"] as const;
export type MergePostLandingStatus = (typeof MERGE_POST_LANDING_STATUSES)[number];

/** The refresh attempt outcomes (F-7). */
export const MERGE_REFRESH_OUTCOMES = ["not-attempted", "succeeded", "conflicted"] as const;
export type MergeRefreshOutcome = (typeof MERGE_REFRESH_OUTCOMES)[number];

/**
 * The closed reason vocabulary of the one `merge.sync-required` refusal (F-2,
 * DM-2, API-2).
 *
 * `dirty` means the request reads `conflicting`, so the sync cause is certain
 * and no landing call is made. `behind-unconfirmed` means the request was
 * offered to the provider, the provider refused, and the post-refusal re-read
 * cannot separate an out-of-date head from another protection rule. There is no
 * confirmed out-of-date member: the delivered four-value normalization exposes
 * no signal that could confirm one, so declaring it would be a value no branch
 * can emit.
 */
export const MERGE_SYNC_REQUIRED_REASONS = ["dirty", "behind-unconfirmed"] as const;
export type MergeSyncRequiredReason = (typeof MERGE_SYNC_REQUIRED_REASONS)[number];

/**
 * The closed attribution pair of the one additive refusal-evidence field (F-3,
 * DM-2, API-2).
 *
 * `recorded` means the persisted gate-verification verdict already reported the
 * job not green; `probe` means the recorded verdict was green and the
 * post-verification probe observed it. The pair is the whole vocabulary and the
 * field is bounded: no second evidence member and no timestamp exists.
 */
export const MERGE_REFUSAL_ATTRIBUTIONS = ["recorded", "probe"] as const;
export type MergeRefusalAttribution = (typeof MERGE_REFUSAL_ATTRIBUTIONS)[number];

/**
 * The closed merge git operation vocabulary (F-7, GAP-14).
 *
 * There is deliberately no force-capable variant: the transaction's mutation
 * vocabulary structurally cannot express a force push, force rebase, or hard
 * reset. A structure assertion proves the absence non-vacuously.
 */
export const MERGE_GIT_OPERATIONS = [
  "read-head",
  "read-base-containment",
  "resolve-ref",
  "rebase-refresh",
  "squash-land",
  "delete-branch",
] as const;
export type MergeGitOperation = (typeof MERGE_GIT_OPERATIONS)[number];

/** The tracker posture observed at verification time (EVT-1, DM-1). */
export type MergeTrackerPosture = {
  readonly labels: readonly string[];
  readonly ownerLabels: readonly string[];
};

/** One recorded per-gate verdict with its bounded citation (EVT-1, DM-1). */
export type MergeGateVerdictRecord = {
  readonly id: string;
  readonly verdict: VerifyGateVerdict;
  readonly reason: string;
  readonly citation: VerifyGateCitation;
};

/** The declared gate-set identity carried by a verification record (F-2). */
export type MergeGateSetIdentity = {
  readonly schemaVersion: string;
  readonly ids: readonly string[];
};

/** The EVT-1 gate-verification payload (DM-1). */
export type MergeGateVerificationRecord = {
  readonly schema: typeof MERGE_GATE_VERIFICATION_SCHEMA;
  readonly changeRef: string;
  readonly headSha: string;
  readonly verifiedAt: string;
  readonly gateSet: MergeGateSetIdentity;
  readonly gates: readonly MergeGateVerdictRecord[];
  readonly trackerPosture: MergeTrackerPosture;
};

/** The EVT-2 waiver payload (DM-2). */
export type MergeWaiverRecord = {
  readonly schema: typeof MERGE_WAIVER_SCHEMA;
  readonly changeRef: string;
  readonly gateId: string;
  readonly gateClass: string;
  readonly authorizer: string;
  readonly authorizedAt: string;
  readonly reason?: string;
};

/** One post-landing step outcome (EVT-3, DM-3). */
export type MergePostLandingStep = {
  readonly id: MergePostLandingStepId;
  readonly status: MergePostLandingStatus;
};

/**
 * The landing-verification evidence (EVT-3, DM-3).
 *
 * `shaOnBase` answers the containment of the provider-asserted merge commit on
 * the base, and only when a local containment read answers for that identity:
 * after a provider landing with no fetch the object is not in the checkout, so
 * the field is `"unknown"` rather than a locally derived `true`. The value
 * domain is exactly `boolean | "unknown"`, the delivered state-layer validator
 * accepts the same domain so a written `unknown` round-trips, and a legacy
 * boolean record reads exactly as before. The field is never landing evidence.
 */
export type MergeLandingEvidence = {
  readonly shaOnBase: boolean | "unknown";
  readonly requestState: string;
};

/** The refresh evidence carried by the transaction record (EVT-3, DM-3). */
export type MergeRefreshEvidence = {
  readonly attempts: number;
  readonly outcome: MergeRefreshOutcome;
};

/** The EVT-3 merge transaction payload (DM-3). */
export type MergeTransactionRecord = {
  readonly schema: typeof MERGE_TRANSACTION_SCHEMA;
  readonly changeRef: string;
  readonly result: MergeTransactionResult;
  readonly squashSha?: string;
  readonly replayed: boolean;
  readonly landing: MergeLandingEvidence;
  readonly refresh: MergeRefreshEvidence;
  readonly waiverRefs: readonly string[];
  readonly postLanding: readonly MergePostLandingStep[];
  readonly recordedAt: string;
};

/** Why a merge-domain state read is not consumable (mapped to state-unverified). */
export type MergeStateReadReason = "absent" | "torn" | "unreadable" | "incompatible";

/** The precise outcome of one merge-domain read (state tier supplies evidence). */
export type MergeStateRead<T> =
  | {
      readonly ok: true;
      readonly verifiedEmpty: boolean;
      readonly records: readonly T[];
      readonly evidence: {
        readonly storePath: string;
        readonly verification: readonly string[];
        readonly verifiedEmpty: boolean;
        readonly recordCount: number;
      };
    }
  | {
      readonly ok: false;
      readonly reason: MergeStateReadReason;
      readonly code: string;
    };

/** One declared waiver override on the merge surface (F-5, GAP-7). */
export type MergeWaiverDeclaration = {
  readonly gateId: string;
  readonly authorizer: string;
  readonly reason?: string;
};

/** The machine `data` payload of a merged transaction (F-8, SC-M1-01). */
export type MergeReport = {
  readonly result: "merged";
  readonly changeRef: string;
  readonly squashSha: string;
  readonly replayed: boolean;
  readonly landing: MergeLandingEvidence;
  readonly refresh: MergeRefreshEvidence;
  readonly waiverRefs: readonly string[];
  readonly postLanding: readonly MergePostLandingStep[];
  readonly gates: readonly MergeGateVerdictRecord[];
  readonly gatesOmitted: number;
};

/** One declared override's dry-run authorization report (GAP-12). */
export type MergeDryRunAuthorization = {
  readonly gateId: string;
  readonly authorizer: string;
  readonly authorized: boolean;
  readonly gateClass?: string;
  readonly reason?: string;
};

/** The machine `data` payload of a dry run (F-2, GAP-5). */
export type MergeDryRunReport = {
  readonly result: "verified";
  readonly changeRef: string;
  readonly headSha: string;
  readonly gates: readonly MergeGateVerdictRecord[];
  readonly gatesOmitted: number;
  readonly authorizations: readonly MergeDryRunAuthorization[];
};

/** Machine `data` UTF-8 byte cap (NFR-4). */
export const MERGE_MAX_MACHINE_BYTES = 65_536 as const;
/** Human transaction-summary line cap (NFR-4). */
export const MERGE_MAX_HUMAN_LINES = 24 as const;
/** Human transaction-summary UTF-8 byte cap (NFR-4). */
export const MERGE_MAX_HUMAN_BYTES = 4_096 as const;
/** Evidence name/path list cap; every drop is marked with `+N` (NFR-4). */
export const MERGE_MAX_EVIDENCE_NAMES = 8 as const;
/** Per-name display cap. */
export const MERGE_MAX_EVIDENCE_NAME_CHARS = 160 as const;
/** Waiver reason cap (bounded operator-declared text). */
export const MERGE_MAX_REASON_CHARS = 280 as const;
/** Conflicting-path list cap; the remainder is marked. */
export const MERGE_MAX_CONFLICT_PATHS = 8 as const;
/** Waiver-reference list cap. */
export const MERGE_MAX_WAIVER_REFS = 8 as const;
/** Declared gate-entry cap (a declaration cannot be unbounded). */
export const MERGE_MAX_GATES = 64 as const;
/** Machine report gate-record cap; the remainder is marked (NFR-4). */
export const MERGE_MAX_REPORT_GATES = 20 as const;
/** Gate-id character cap. */
export const MERGE_MAX_GATE_ID_CHARS = 120 as const;
/** Ref character cap. */
export const MERGE_MAX_REF_CHARS = 120 as const;
/** Gate-set identity id list cap. */
export const MERGE_MAX_GATE_SET_IDS = 64 as const;

/** The declared `merge.gate.<gate-id>.failed` family prefix (DEC-7, NFR-8). */
export const MERGE_GATE_ERROR_PREFIX = "merge.gate." as const;
/** The declared `merge.gate.<gate-id>.failed` family suffix. */
export const MERGE_GATE_ERROR_SUFFIX = ".failed" as const;
/** The documented family template. */
export const MERGE_GATE_ERROR_TEMPLATE = "merge.gate.<gate-id>.failed" as const;

/**
 * The closed refusal `operation` vocabulary (DEC-11, AC-F3-1): nine tokens plus
 * `-`, rendered as the dedicated `operation=<token>` field beside a refusal's
 * code, and validated at the rendering site where an out-of-vocabulary value is
 * a rendering failure and never passed through.
 *
 * The set is a declared FILTER over the delivered source-name vocabulary: every
 * provider read a refusal can cite has its token — `delivery-registry`,
 * `repository-ci-workflow`, `github-check-runs`, `github-work-item`,
 * `github-delivery-request-list` (either state filter on a delivery-request
 * list read: the open list on the resolution path, the closed-state merged read
 * on the convergence attempt), and `github-delivery-request-detail` (the
 * delivered single-request read the landing decision makes for mergeability,
 * and its unknown-recovery re-read). Two delivered members are excluded for
 * stated reasons: `repository-head` (no checkout-head read exists on this path,
 * and NFR-6 forbids one) and `pm-notes` (the change record is obtained as a git
 * object, so the operation that can fail is a local read and the local tokens
 * name it). The set adds the two local-read tokens the delivered vocabulary
 * does not name (`local-change-record-read`, `local-git-object-read`), the one
 * landing-operation token (`github-merge-delivery-request`), and `-` where the
 * refusal names no operation (a gate refusal, a stale or unverified evidence
 * set, or a condition about a declaration's value rather than a read). The
 * battery's own source-name inventory is not widened by this export.
 */
export const MERGE_REFUSAL_OPERATIONS = [
  "github-work-item",
  "github-check-runs",
  "github-delivery-request-list",
  "github-delivery-request-detail",
  "github-merge-delivery-request",
  "repository-ci-workflow",
  "delivery-registry",
  "local-change-record-read",
  "local-git-object-read",
  "-",
] as const;
export type MergeRefusalOperation = (typeof MERGE_REFUSAL_OPERATIONS)[number];
