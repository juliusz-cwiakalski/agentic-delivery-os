/**
 * The `delivery.queue-ready.v1` vocabulary (GH-176 F-2, F-3, F-12, DM-1..DM-13).
 *
 * Runtime-neutral by construction: types and `as const` data only. Every
 * condition id, tri-state, evidence source/reason, close class, rank class,
 * reason group, cap, limit, label set, pattern, and schema version is declared
 * once here; the pure domain and the command consume it. No clock, randomness,
 * environment, filesystem, or network access exists in this module.
 */

import type { DeliveryRequestReviewState, DeliveryStateAlias } from "./ports.js";
import type { StatusFacts } from "./status.js";

/** The six condition ids in their fixed order (F-3, Appendix C). */
export const QUEUE_READY_CONDITION_ORDER = [
  "deps-satisfied",
  "repo-free",
  "tier-known",
  "no-owner-gate",
  "ci-healthy",
  "provider-available",
] as const;
export type QueueReadyConditionId = (typeof QUEUE_READY_CONDITION_ORDER)[number];

/** The closed tri-state condition vocabulary (DM-3). */
export const QUEUE_READY_CONDITION_STATES = ["satisfied", "unsatisfied", "unknown"] as const;
export type QueueReadyConditionState = (typeof QUEUE_READY_CONDITION_STATES)[number];

/** The closed close-class vocabulary (DM-5). */
export const QUEUE_READY_CLOSE_CLASSES = [
  "merge-ready",
  "review-pending",
  "new-start",
  "unknown",
  "not-ready",
] as const;
export type QueueReadyCloseClass = (typeof QUEUE_READY_CLOSE_CLASSES)[number];

/** The class rank order; class ranks are 0..4 in this order (DM-7). */
export const QUEUE_READY_RANK_CLASS_ORDER = [
  "merge-ready",
  "review-pending",
  "new-start",
  "unknown",
  "not-ready",
] as const;

/** The seven evidence source ids (DM-4). */
export const QUEUE_READY_EVIDENCE_SOURCES = [
  "tracker",
  "changes",
  "ci",
  "provider-config",
  "provider-parks",
  "local-context",
  "repository-binding",
] as const;
export type QueueReadyEvidenceSource = (typeof QUEUE_READY_EVIDENCE_SOURCES)[number];

/** The closed 41-reason readiness vocabulary in DM-10 order. */
export const QUEUE_READY_EVIDENCE_REASONS = [
  "read-failed",
  "signal-unavailable",
  "work-item-unobserved",
  "addressing-unresolved",
  "remote-unsupported",
  "credential-unavailable",
  "config-invalid",
  "provider-chain-not-declared",
  "provider-chain-unresolved",
  "state-unreadable",
  "commit-unresolved",
  "local-context-missing",
  "local-context-malformed",
  "source-truncated",
  "value-clamped",
  "no-blocked-dependencies",
  "dependencies-done",
  "dependency-open",
  "dependency-unobserved",
  "no-active-change",
  "candidate-is-active",
  "other-active-change",
  "tier-absent",
  "tier-conflict",
  "tier-label",
  "no-owner-labels",
  "owner-labels",
  "ci-succeeded",
  "ci-failed",
  "ci-pending",
  "ci-canceled",
  "ci-none",
  "no-enabled-entry",
  "no-active-park",
  "all-entries-parked",
  "chain-parked",
  "engine-not-run",
  "pr-associated",
  "pr-not-associated",
  "pr-association-unknown",
  "pr-not-open",
] as const;
export type QueueReadyReason = (typeof QUEUE_READY_EVIDENCE_REASONS)[number];

/** The condition-source failure subset rolled into top-level reasons group 5. */
export const QUEUE_READY_SOURCE_FAILURE_REASONS = [
  "read-failed",
  "credential-unavailable",
  "signal-unavailable",
  "work-item-unobserved",
  "commit-unresolved",
  "local-context-missing",
  "local-context-malformed",
] as const;

/** The group-2 payload bounding markers in fixed order. */
export const QUEUE_READY_PAYLOAD_MARKER_REASONS = ["source-truncated", "value-clamped"] as const;

/** The fixed six-group top-level reason order (DM-1). */
export const QUEUE_READY_REASON_ORDER = [
  { group: "binding", reasons: ["addressing-unresolved", "remote-unsupported"] },
  { group: "payload-markers", reasons: QUEUE_READY_PAYLOAD_MARKER_REASONS },
  {
    group: "provider-config",
    reasons: ["config-invalid", "provider-chain-not-declared", "provider-chain-unresolved"],
  },
  { group: "park-fold", reasons: ["state-unreadable"] },
  { group: "condition-source-failure", reasons: QUEUE_READY_SOURCE_FAILURE_REASONS },
  { group: "close-association", reasons: ["pr-association-unknown"] },
] as const;

/** Input and rendered candidate cap (Appendix C). */
export const QUEUE_READY_MAX_CANDIDATES = 8 as const;
/** Parser hard positional bound: 1 subcommand + 32 refs (Appendix C). */
export const QUEUE_READY_MAX_POSITIONALS = 33 as const;
/** Evidence cap per condition (Appendix C). */
export const QUEUE_READY_MAX_EVIDENCE_PER_CONDITION = 2 as const;
/** Top-level reason cap (Appendix C). */
export const QUEUE_READY_MAX_REASONS = 6 as const;
/** `associatedCount` bound; not separately capped (Appendix C). */
export const QUEUE_READY_ASSOCIATED_COUNT_RANGE = { min: 0, max: 100 } as const;
/** Safe evidence detail cap (Appendix C). */
export const QUEUE_READY_MAX_DETAIL_CHARS = 160 as const;
/** Maximum canonical work-item-ref length (Appendix C). */
export const QUEUE_READY_MAX_WORK_ITEM_REF_CHARS = 64 as const;
/** Maximum projected identity (`entityId`) characters (Appendix C). */
export const QUEUE_READY_MAX_IDENTITY_CHARS = 128 as const;
/** Maximum projected provider ref characters (Appendix C). */
export const QUEUE_READY_MAX_REF_CHARS = 128 as const;
/** Maximum projected label characters (Appendix C). */
export const QUEUE_READY_MAX_LABEL_CHARS = 128 as const;
/** Maximum projected labels per observation (Appendix C). */
export const QUEUE_READY_MAX_LABELS = 16 as const;
/** Maximum projected `blocked-by` relations per observation (Appendix C). */
export const QUEUE_READY_MAX_RELATIONS = 16 as const;
/** Maximum projected repository owner characters (Appendix C). */
export const QUEUE_READY_MAX_OWNER_CHARS = 128 as const;
/** Maximum projected repository name characters (Appendix C). */
export const QUEUE_READY_MAX_REPO_NAME_CHARS = 128 as const;
/** Maximum projected head-branch characters (Appendix C). */
export const QUEUE_READY_MAX_BRANCH_CHARS = 256 as const;
/** Maximum projected provider timestamp characters (Appendix C). */
export const QUEUE_READY_MAX_TIMESTAMP_CHARS = 40 as const;
/** Maximum rendered per-candidate provider segment in UTF-8 bytes (renderer only). */
export const QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES = 32 as const;
/** Full-value all-ASCII-digit pattern for the identity bridge (Appendix C). */
export const QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN = "^[0-9]+$" as const;
/** Byte cap on the serialized `data` payload (Appendix C). */
export const QUEUE_READY_MAX_MACHINE_BYTES = 65536 as const;
/** Human digest line cap (Appendix C). */
export const QUEUE_READY_MAX_HUMAN_LINES = 16 as const;
/** Human digest byte cap (Appendix C). */
export const QUEUE_READY_MAX_HUMAN_BYTES = 4096 as const;
/** Reused issues/pulls page limit (Appendix C). */
export const QUEUE_READY_SOURCE_ITEM_LIMIT = 100 as const;
/** Reused check-runs page limit (Appendix C). */
export const QUEUE_READY_SOURCE_PIPELINE_LIMIT = 20 as const;
/** Declared triage-tier label set (Appendix C). */
export const QUEUE_READY_TIER_LABELS = [
  "priority:high",
  "priority:medium",
  "priority:low",
] as const;
/** Declared owner-attention label set (Appendix C). */
export const QUEUE_READY_OWNER_ATTENTION_LABELS = ["hand-back", "human-input-needed"] as const;
/** Work-item-ref grammar (Appendix C). */
export const QUEUE_READY_WORK_ITEM_REF_PATTERN = "^[A-Za-z][A-Za-z0-9]*-[0-9]+$" as const;
/** Minimum source-branch segments for the association convention (Appendix C). */
export const QUEUE_READY_BRANCH_SEGMENT_MIN = 3 as const;
/** The payload schema version (DM-13). */
export const QUEUE_READY_SCHEMA_VERSION = "delivery.queue-ready.v1" as const;

/** The close association state (DM-6). */
export type QueueReadyAssociation = "associated" | "not-associated" | "unknown";

/** One bounded evidence record: closed source/reason plus an optional safe detail. */
export type QueueReadyEvidence = {
  readonly source: QueueReadyEvidenceSource;
  readonly reason: QueueReadyReason;
  readonly detail?: string;
};

/** One condition with one closed tri-state and bounded evidence. */
export type QueueReadyCondition = {
  readonly id: QueueReadyConditionId;
  readonly state: QueueReadyConditionState;
  readonly evidence: readonly QueueReadyEvidence[];
};

/** One blocking condition projected from a non-satisfied condition. */
export type QueueReadyBlockingCondition = {
  readonly id: QueueReadyConditionId;
  readonly state: QueueReadyConditionState;
};

/** One projected `blocked-by` relation; the identity is `entityId` only. */
export type QueueReadyWorkItemRelation = {
  readonly relationKind: "blocked-by";
  readonly target: { readonly entityId: string };
};

/** The observed-or-unknown work-item projection (DM-2). */
export type QueueReadyWorkItemObservation =
  | {
      readonly state: "observed";
      readonly itemState: DeliveryStateAlias;
      readonly labels?: readonly string[];
      readonly updatedAt?: string;
      readonly relations?: readonly QueueReadyWorkItemRelation[];
    }
  | { readonly state: "unknown"; readonly reason: "work-item-unobserved" };

/** The selected pull request, identity projected as `entityId` only (DM-6). */
export type QueueReadyPullRequest = {
  readonly entityId: string;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly draft: boolean;
  readonly reviewStateObserved: boolean;
  readonly reviewState?: DeliveryRequestReviewState;
};

/** The close association and selected pull request (DM-6). */
export type QueueReadyClose = {
  readonly association: QueueReadyAssociation;
  readonly associatedCount: number;
  readonly pullRequest?: QueueReadyPullRequest;
  readonly reason: "pr-associated" | "pr-not-associated" | "pr-not-open" | "pr-association-unknown";
};

/** One ranked candidate (DM-2). */
export type QueueReadyCandidate = {
  readonly workItemRef: string;
  readonly rank: number;
  readonly ready: boolean;
  readonly closeClass: QueueReadyCloseClass;
  readonly workItem: QueueReadyWorkItemObservation;
  readonly close: QueueReadyClose;
  readonly conditions: readonly QueueReadyCondition[];
  readonly blockingConditions: readonly QueueReadyBlockingCondition[];
  readonly truncated: boolean;
};

/** The checkout HEAD projection (DM-1). */
export type QueueReadyHead = {
  readonly branch?: string;
  readonly sha?: string;
};

/** The repository binding projection (DM-9). */
export type QueueReadyRepository =
  | {
      readonly state: "observed";
      readonly host: "github.com";
      readonly owner: string;
      readonly name: string;
      readonly remoteName: "origin";
    }
  | {
      readonly state: "unavailable";
      readonly reason: "addressing-unresolved" | "remote-unsupported";
    };

/** The summary counts (DM-8). */
export type QueueReadySummary = {
  readonly candidates: number;
  readonly ready: number;
  readonly notReady: number;
  readonly mergeReady: number;
  readonly reviewPending: number;
  readonly newStart: number;
  readonly unknownClose: number;
};

/** The complete bounded payload (DM-1). */
export type QueueReadyPayload = {
  readonly schemaVersion: typeof QUEUE_READY_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly repository: QueueReadyRepository;
  readonly head: QueueReadyHead;
  readonly candidates: readonly QueueReadyCandidate[];
  readonly summary: QueueReadySummary;
  readonly reasons: readonly QueueReadyReason[];
  readonly truncated: boolean;
};

/** The injected fact set: the delivered status facts plus the canonical candidates. */
export type QueueReadyFacts = StatusFacts & { readonly candidates: readonly string[] };
