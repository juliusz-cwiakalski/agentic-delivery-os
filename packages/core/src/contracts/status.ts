/**
 * The `delivery.status.v1` vocabulary (GH-175 F-2, DM-1..DM-15).
 *
 * Runtime-neutral by construction: types and `as const` data only. Every
 * section id, state, reason, source, outcome, family, cap, limit, threshold,
 * and rank key is declared once here; the pure domain and the command consume
 * it. No clock, randomness, environment, filesystem, or network access exists
 * in this module.
 */

import type { OwnerGateSlaState, OwnerGateUnknownAgeReason } from "./owner-gate-sla.js";
import type { DeliveryRequest, PipelineRun, WorkItem } from "./ports.js";
import type { ProviderConfiguration, ProviderParkView } from "./provider.js";

/** The nine section ids in their fixed order (DM-3, DEC-1). */
export const STATUS_SECTION_ORDER = [
  "tracker",
  "changes-and-prs",
  "ci",
  "lanes-or-queue",
  "providers",
  "parked-work",
  "ready-to-merge",
  "spend",
  "blockers",
] as const;
export type StatusSectionId = (typeof STATUS_SECTION_ORDER)[number];

/** The closed section-kind vocabulary (DM-12, DEC-17). */
export const STATUS_SECTION_KINDS = {
  tracker: "collector",
  "changes-and-prs": "collector",
  ci: "collector",
  "lanes-or-queue": "declared-gap",
  providers: "collector",
  "parked-work": "collector",
  "ready-to-merge": "collector",
  spend: "placeholder",
  blockers: "placeholder",
} as const;
export type StatusSectionKind = (typeof STATUS_SECTION_KINDS)[StatusSectionId];

/** The two delivered placeholder section ids (DM-12, DEC-17). */
export const STATUS_PLACEHOLDER_SECTION_IDS = ["spend", "blockers"] as const;
export type StatusPlaceholderSectionId = (typeof STATUS_PLACEHOLDER_SECTION_IDS)[number];

/** The declared per-section state-derivation rows (Appendix C, TC-ATT-024). */
export const STATUS_SECTION_DERIVATION: Readonly<
  Record<StatusSectionId, readonly StatusSectionState[]>
> = {
  tracker: ["observed", "degraded", "unknown", "unavailable"],
  "changes-and-prs": ["observed", "degraded", "unknown", "unavailable"],
  ci: ["observed", "unknown", "unavailable"],
  "lanes-or-queue": ["not-delivered"],
  providers: ["observed", "degraded", "unknown", "unavailable"],
  "parked-work": ["observed", "unknown", "unavailable"],
  "ready-to-merge": ["observed", "degraded", "unknown", "unavailable"],
  spend: ["not-delivered"],
  blockers: ["not-delivered"],
};

/** The ready-to-merge derivation row never admits `not-delivered` (Appendix C). */
export const STATUS_READY_TO_MERGE_STATES = [
  "observed",
  "degraded",
  "unknown",
  "unavailable",
] as const;
export type StatusReadyToMergeState = (typeof STATUS_READY_TO_MERGE_STATES)[number];

/** The closed three-value finding-severity vocabulary (DM-2). */
export const STATUS_FINDING_SEVERITIES = ["high", "medium", "low"] as const;
export type StatusFindingSeverity = (typeof STATUS_FINDING_SEVERITIES)[number];

/** The ten shipped finding codes in declared order (Appendix A, DM-1). */
export const STATUS_FINDING_CODES = [
  "ci.red-on-main",
  "tracker.owner-gate-escalated",
  "tracker.stalled-ticket",
  "tracker.hygiene.missing-title",
  "tracker.hygiene.missing-labels",
  "tracker.hygiene.epic-membership",
  "tracker.hygiene.story-points",
  "tracker.hygiene.in-sprint",
  "lane.idle-no-reason",
  "parked.stale-no-condition",
] as const;
export type StatusFindingCode = (typeof STATUS_FINDING_CODES)[number];

/** One closed registry entry: default severity, meaning, owning surface, dormancy (DM-1). */
export type StatusFindingDefinition = {
  readonly severity: StatusFindingSeverity;
  readonly meaning: string;
  readonly surface: StatusSectionId;
  readonly dormant: boolean;
};

/** The closed finding-code registry, declared in Appendix A order (DM-1). */
export const STATUS_FINDING_REGISTRY: Readonly<Record<StatusFindingCode, StatusFindingDefinition>> =
  {
    "ci.red-on-main": {
      severity: "high",
      meaning: "failed CI classification on the declared primary branch",
      surface: "ci",
      dormant: false,
    },
    "tracker.owner-gate-escalated": {
      severity: "high",
      meaning: "owner hand-back gate escalated or default-applied",
      surface: "tracker",
      dormant: false,
    },
    "tracker.stalled-ticket": {
      severity: "medium",
      meaning: "open work item with no activity past the stall threshold",
      surface: "tracker",
      dormant: false,
    },
    "tracker.hygiene.missing-title": {
      severity: "low",
      meaning: "open work item with a blank title",
      surface: "tracker",
      dormant: false,
    },
    "tracker.hygiene.missing-labels": {
      severity: "low",
      meaning: "open work item with no labels",
      surface: "tracker",
      dormant: false,
    },
    "tracker.hygiene.epic-membership": {
      severity: "low",
      meaning: "open work item with no conforming epic label",
      surface: "tracker",
      dormant: false,
    },
    "tracker.hygiene.story-points": {
      severity: "low",
      meaning: "open work item with no conforming story-points label",
      surface: "tracker",
      dormant: false,
    },
    "tracker.hygiene.in-sprint": {
      severity: "low",
      meaning: "open work item with no mapped active-sprint membership",
      surface: "tracker",
      dormant: false,
    },
    "lane.idle-no-reason": {
      severity: "medium",
      meaning: "declared dormant until the lane engine reports an idle lane without a reason",
      surface: "lanes-or-queue",
      dormant: true,
    },
    "parked.stale-no-condition": {
      severity: "low",
      meaning: "parked entry with unknown age and no recorded re-entry condition",
      surface: "parked-work",
      dormant: false,
    },
  };

/** The code-to-trigger-surface map (Appendix A, TC-ATT-001). */
export const STATUS_FINDING_SURFACES: Readonly<Record<StatusFindingCode, StatusSectionId>> = {
  "ci.red-on-main": "ci",
  "tracker.owner-gate-escalated": "tracker",
  "tracker.stalled-ticket": "tracker",
  "tracker.hygiene.missing-title": "tracker",
  "tracker.hygiene.missing-labels": "tracker",
  "tracker.hygiene.epic-membership": "tracker",
  "tracker.hygiene.story-points": "tracker",
  "tracker.hygiene.in-sprint": "tracker",
  "lane.idle-no-reason": "lanes-or-queue",
  "parked.stale-no-condition": "parked-work",
};

/** The dormant code set: declared, never emitted before its delivering story (DEC-7). */
export const STATUS_DORMANT_FINDING_CODES = ["lane.idle-no-reason"] as const;
export type StatusDormantFindingCode = (typeof STATUS_DORMANT_FINDING_CODES)[number];

/** The three named hygiene assertions in declared order (DM-7, F-4). */
export const STATUS_HYGIENE_ASSERTIONS = ["epic-membership", "story-points", "in-sprint"] as const;
export type StatusHygieneAssertionId = (typeof STATUS_HYGIENE_ASSERTIONS)[number];

/** The declared label conventions for the mapped hygiene signals (DM-13, DEC-14). */
export const STATUS_HYGIENE_LABEL_CONVENTIONS = {
  epicToken: "epic",
  epicPrefix: "epic:",
  storyPointsPrefix: "points:",
} as const;

/** The closed lane attention-state vocabulary (DEC-17, F-7). */
export const STATUS_LANE_ATTENTION_STATES = [
  "delivering",
  "idle-with-reason",
  "idle-no-reason",
] as const;
export type StatusLaneAttentionState = (typeof STATUS_LANE_ATTENTION_STATES)[number];

/** The closed ready-to-merge item classes (DM-5, DEC-5). */
export const STATUS_READY_CLASSES = ["merge-ready", "review-pending"] as const;
export type StatusReadyClass = (typeof STATUS_READY_CLASSES)[number];

/** The declared primary-branch convention (Appendix A, §12). */
export const STATUS_PRIMARY_BRANCH = "main" as const;

/** The declared human clamp marker for defensive byte truncation (NFR-2). */
export const STATUS_HUMAN_CLAMP_MARKER = "+" as const;

/** The closed five-value section-state vocabulary (DM-3). */
export const STATUS_SECTION_STATES = [
  "observed",
  "degraded",
  "unknown",
  "unavailable",
  "not-delivered",
] as const;
export type StatusSectionState = (typeof STATUS_SECTION_STATES)[number];

/** The eight evidence source ids (DM-4). */
export const STATUS_EVIDENCE_SOURCES = [
  "tracker",
  "changes",
  "ci",
  "queue-engine",
  "provider-config",
  "provider-parks",
  "local-context",
  "repository-binding",
] as const;
export type StatusEvidenceSource = (typeof STATUS_EVIDENCE_SOURCES)[number];

/** The five evidence outcomes (DM-4). */
export const STATUS_EVIDENCE_OUTCOMES = [
  "read",
  "observed-empty",
  "failed",
  "not-configured",
  "not-delivered",
] as const;
export type StatusEvidenceOutcome = (typeof STATUS_EVIDENCE_OUTCOMES)[number];

/** The closed twenty-value evidence reason set (spec §8.3 order). */
export const STATUS_EVIDENCE_REASONS = [
  "observed",
  "observed-empty",
  "read-failed",
  "source-unavailable",
  "signal-unavailable",
  "addressing-unresolved",
  "remote-unsupported",
  "credential-unavailable",
  "config-invalid",
  "state-unreadable",
  "commit-unresolved",
  "provider-chain-not-declared",
  "provider-chain-unresolved",
  "local-context-missing",
  "local-context-malformed",
  "local-state-untracked",
  "engine-not-delivered",
  "source-truncated",
  "item-signal-absent",
  "partial-evidence",
] as const;
export type StatusEvidenceReason = (typeof STATUS_EVIDENCE_REASONS)[number];

/** The four tracker families in fixed order (DM-5). */
export const STATUS_TRACKER_FAMILIES = [
  "ownerHandBacks",
  "blockedDependencies",
  "stalls",
  "hygiene",
] as const;
export type StatusTrackerFamilyId = (typeof STATUS_TRACKER_FAMILIES)[number];

/** The two tracker family states (DM-5). */
export const STATUS_TRACKER_FAMILY_STATES = ["observed", "unavailable"] as const;
export type StatusTrackerFamilyState = (typeof STATUS_TRACKER_FAMILY_STATES)[number];

/** The two blocked-dependency item states (DM-5). */
export const STATUS_DEPENDENCY_STATES = ["open", "unknown"] as const;
export type StatusDependencyState = (typeof STATUS_DEPENDENCY_STATES)[number];

/** The two stall item states (DM-5). */
export const STATUS_STALL_STATES = ["stalled", "unknown"] as const;
export type StatusStallState = (typeof STATUS_STALL_STATES)[number];

/** The two hygiene findings (DM-5). */
export const STATUS_HYGIENE_FINDINGS = ["missing-title", "missing-labels"] as const;
export type StatusHygieneFinding = (typeof STATUS_HYGIENE_FINDINGS)[number];

/** The closed CI result vocabulary (DM-7). */
export const STATUS_CI_RESULTS = [
  "failed",
  "pending",
  "succeeded",
  "canceled",
  "none",
  "unknown",
] as const;
export type StatusCiResult = (typeof STATUS_CI_RESULTS)[number];

/** The four provider chain states (DM-9). */
export const STATUS_PROVIDER_CHAIN_STATES = ["declared", "parked", "absent", "unknown"] as const;
export type StatusProviderChainState = (typeof STATUS_PROVIDER_CHAIN_STATES)[number];

/** Provider entry availability is `parked` or `unverified`, never `available`. */
export const STATUS_PROVIDER_AVAILABILITY = ["parked", "unverified"] as const;
export type StatusProviderAvailability = (typeof STATUS_PROVIDER_AVAILABILITY)[number];

/** Parked-work item states (DM-10). */
export const STATUS_PARKED_ITEM_STATES = ["observed", "unknown"] as const;
export type StatusParkedItemState = (typeof STATUS_PARKED_ITEM_STATES)[number];

/** A single item-level signal is observed or unknown (never fabricated). */
export type StatusSignalAvailability = "available" | "unavailable";
export type StatusItemSignalState = "observed" | "unknown";

/** Per-family declared signal availability (DM-14). */
export type StatusTrackerAvailability = {
  readonly ownerHandBacks: StatusSignalAvailability;
  readonly blockedDependencies: StatusSignalAvailability;
  readonly stalls: StatusSignalAvailability;
  readonly hygiene: StatusSignalAvailability;
  readonly epicMembership?: StatusSignalAvailability;
  readonly storyPoints?: StatusSignalAvailability;
  readonly inSprint?: StatusSignalAvailability;
};

/** Per-signal declared availability for the VCS source (DM-14). */
export type StatusDeliveryAvailability = {
  readonly state: StatusSignalAvailability;
  readonly refs: StatusSignalAvailability;
  readonly reviewState: StatusSignalAvailability;
  readonly reviewThreads: StatusSignalAvailability;
};

/** The exact per-section titles (Appendix C). */
export const STATUS_SECTION_TITLES: Readonly<Record<StatusSectionId, string>> = {
  tracker: "Tracker",
  "changes-and-prs": "Changes and pull requests",
  ci: "CI",
  "lanes-or-queue": "Lanes or queue",
  providers: "Providers",
  "parked-work": "Parked work",
  "ready-to-merge": "Ready to merge",
  spend: "Spend",
  blockers: "Blockers",
};

/** Rendered-item cap for each non-tracker ranked list (Appendix C). */
export const STATUS_MAX_ITEMS_PER_SECTION = 8 as const;
/** Per-family tracker cap; each family caps independently (Appendix C). */
export const STATUS_MAX_TRACKER_FAMILY_ITEMS = 4 as const;
/** Evidence source cap (Appendix C). */
export const STATUS_MAX_EVIDENCE_SOURCES = 6 as const;
/** Unique reason cap (Appendix C). */
export const STATUS_MAX_REASONS = 6 as const;
/** Provider entry cap (Appendix C). */
export const STATUS_MAX_PROVIDER_ENTRIES = 8 as const;
/** Active park cap (Appendix C). */
export const STATUS_MAX_PROVIDER_PARKS = 8 as const;
/** CI run cap (Appendix C). */
export const STATUS_MAX_PIPELINE_RUNS = 8 as const;
/** Open pull-request cap (Appendix C). */
export const STATUS_MAX_OPEN_PULL_REQUESTS = 8 as const;
/** Parked-work cap (Appendix C). */
export const STATUS_MAX_PARKED_CHANGES = 8 as const;
/** One bounded issues/PRs page (Appendix C). */
export const STATUS_SOURCE_ITEM_LIMIT = 100 as const;
/** One bounded check-runs page, sent as `per_page` (Appendix C). */
export const STATUS_SOURCE_PIPELINE_LIMIT = 20 as const;
/** Item title cap (Appendix C). */
export const STATUS_MAX_TITLE_CHARS = 120 as const;
/** Safe evidence/reason detail cap (Appendix C). */
export const STATUS_MAX_DETAIL_CHARS = 160 as const;
/** Per-section findings cap; defensive headroom (Appendix B, DEC-15). */
export const STATUS_MAX_FINDINGS_PER_SECTION = 8 as const;
/** Per-finding member-identity cap (Appendix B, DM-4). */
export const STATUS_MAX_FINDING_MEMBERS = 8 as const;
/** Ready-to-merge action-list cap (Appendix B, DM-5). */
export const STATUS_MAX_READY_ITEMS = 8 as const;
/** Human digest line cap; defensive headroom (Appendix B, DEC-11). */
export const STATUS_MAX_HUMAN_LINES = 32 as const;
/** Human digest byte cap; the operative bound (Appendix B, DEC-11). */
export const STATUS_MAX_HUMAN_BYTES = 6144 as const;
/** Byte cap on the serialized `data` digest (Appendix C). */
export const STATUS_MAX_MACHINE_BYTES = 65536 as const;
/** Declared stall threshold (Appendix C). */
export const STATUS_STALL_THRESHOLD_DAYS = 14 as const;
/** Declared owner-attention label set (Appendix C). */
export const STATUS_OWNER_ATTENTION_LABELS = ["hand-back", "human-input-needed"] as const;
/** Status payload schema (DM-15). */
export const STATUS_SCHEMA_VERSION = "delivery.status.v1" as const;

/** The uniform per-section counts (DM-2). */
export type StatusCounts = {
  readonly observed: number;
  readonly unknown: number;
  readonly total: number;
  readonly omitted: number;
};

/** The bounded evidence record: no raw payload, credential, or free-form message. */
export type StatusEvidence = {
  readonly sources: readonly {
    readonly source: StatusEvidenceSource;
    readonly outcome: StatusEvidenceOutcome;
    readonly failureCode?: string;
    readonly failureClass?: string;
  }[];
  readonly reasons: readonly StatusEvidenceReason[];
};

/** The repository binding derived from `origin` (DM-11). */
export type StatusRepositoryBinding =
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

/** The repository target used by the read sources. */
export type StatusRepositoryTarget = {
  readonly owner: string;
  readonly name: string;
};

/** The checkout HEAD facts (DM-7, DM-11). */
export type StatusHeadFacts = {
  readonly branch?: string;
  readonly sha?: string;
  readonly detached: boolean;
};

/** The repository facts consumed by the aggregator. */
export type StatusRepositoryFacts = {
  readonly binding: StatusRepositoryBinding;
  readonly head: StatusHeadFacts;
};

/** A classified source read failure shared by the readers. */
export type StatusReadFailure = {
  readonly ok: false;
  readonly reason:
    | "read-failed"
    | "credential-unavailable"
    | "not-configured"
    | "commit-unresolved";
  readonly failureCode?: string;
  readonly failureClass?: string;
};

/** The bounded issues read result. */
export type StatusWorkItemRead =
  | {
      readonly ok: true;
      readonly items: readonly WorkItem[];
      readonly pageItemCount: number;
      readonly availability: StatusTrackerAvailability;
    }
  | StatusReadFailure;

/** The bounded open pull-requests read result. */
export type StatusDeliveryRequestRead =
  | {
      readonly ok: true;
      readonly items: readonly DeliveryRequest[];
      readonly pageItemCount: number;
      readonly availability: StatusDeliveryAvailability;
    }
  | StatusReadFailure;

/** The bounded check-runs read result for the checkout SHA. */
export type StatusPipelineRunRead =
  | {
      readonly ok: true;
      readonly items: readonly PipelineRun[];
      readonly pageItemCount: number;
    }
  | StatusReadFailure;

/** The resolved provider configuration read result (DM-4, DM-9). */
export type StatusProviderConfigRead =
  | { readonly ok: true; readonly config: ProviderConfiguration }
  | {
      readonly ok: false;
      readonly reason: "config-invalid" | "provider-chain-unresolved";
      readonly failureCode?: string;
    };

/** The verified park-fold read result (DM-9). */
export type StatusParkRead =
  | { readonly ok: true; readonly parks: readonly ProviderParkView[] }
  | {
      readonly ok: false;
      readonly reason: "state-unreadable";
      readonly failureCode?: string;
      readonly failureClass?: string;
    };

/** The provider facts consumed by the aggregator. */
export type StatusProviderFacts = {
  readonly config: StatusProviderConfigRead;
  readonly parks: StatusParkRead;
};

/** The active local change projected from the PM context (DM-6). */
export type StatusActiveChange = {
  readonly workItemRef: string;
  readonly branch?: string;
  readonly changeFolder?: string;
};

/** One parked delivery change projected from the PM context (DM-10). */
export type StatusParkedWorkEntry = {
  readonly workItemRef?: string;
  readonly branch?: string;
  readonly changeFolder?: string;
  readonly reason?: string;
  readonly parkedAt?: string;
};

/** The local PM-context read result (DM-10). */
export type StatusLocalContextRead =
  | {
      readonly ok: true;
      readonly context: {
        readonly path: string;
        readonly tracked: false;
        readonly activeChange?: StatusActiveChange;
        readonly parkedChanges: readonly StatusParkedWorkEntry[];
      };
    }
  | {
      readonly ok: false;
      readonly reason: "missing" | "malformed";
      readonly path: string;
    };

/** The complete injected fact set the pure aggregator consumes. */
export type StatusFacts = {
  readonly nowIso: string;
  readonly nowMs: number;
  readonly repository: StatusRepositoryFacts;
  readonly tracker: StatusWorkItemRead;
  readonly changes: StatusDeliveryRequestRead;
  readonly ci: StatusPipelineRunRead;
  readonly providers: StatusProviderFacts;
  readonly localContext: StatusLocalContextRead;
};

/** The active-change item shape inside the changes section. */
type StatusActiveChangeState =
  | {
      readonly state: "observed";
      readonly workItemRef: string;
      readonly branch?: string;
      readonly changeFolder?: string;
    }
  | { readonly state: "observed-empty" }
  | { readonly state: "unknown"; readonly reason: StatusEvidenceReason };

/** One grouped, registry-coded finding (DM-4, F-2). */
export type StatusFinding = {
  readonly code: StatusFindingCode;
  readonly severity: StatusFindingSeverity;
  readonly count: number;
  readonly members: readonly string[];
  readonly evidenceRef: string;
};

/** One named hygiene assertion's tri-state counts (DM-7, F-4). */
export type StatusHygieneAssertion = {
  readonly assertion: StatusHygieneAssertionId;
  readonly violations: number;
  readonly unknown: number;
  readonly satisfied: number;
};

/** One tracker item with its family-specific signals. */
export type StatusTrackerItem = {
  readonly workItemRef: string;
  readonly title: string;
  readonly family: StatusTrackerFamilyId;
  readonly itemState: StatusItemSignalState;
  readonly labels?: readonly string[];
  readonly dependencyState?: StatusDependencyState;
  readonly activity?: StatusStallState;
  readonly ageDays?: number;
  readonly findings?: readonly StatusHygieneFinding[];
  readonly age?: number | null;
  readonly ageUnknownReason?: OwnerGateUnknownAgeReason;
  readonly slaState?: OwnerGateSlaState;
};

/** One tracker family list (DM-5). */
export type StatusTrackerFamily = {
  readonly family: StatusTrackerFamilyId;
  readonly state: StatusTrackerFamilyState;
  readonly reason?: StatusEvidenceReason;
  readonly counts: StatusCounts;
  readonly items: readonly StatusTrackerItem[];
  readonly assertions?: readonly StatusHygieneAssertion[];
};

/** One open pull request with observed-or-unknown review signals (DM-6). */
export type StatusPullRequestItem = {
  readonly entityId: string;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly deliveryState: DeliveryRequest["reviewState"];
  readonly draft: boolean;
  readonly reviewState: StatusItemSignalState;
  readonly reviewThreads: StatusItemSignalState;
};

/** The resolved commit under CI observation (DM-7). */
type StatusCommit = {
  readonly branch?: string;
  readonly sha?: string;
};

/** One provider chain summary (DM-9). */
type StatusProviderChain = {
  readonly state: StatusProviderChainState;
  readonly name?: string;
  readonly entries?: readonly string[];
  readonly cause?: string;
  readonly expiresAt?: string;
};

/** One provider entry with `parked` or `unverified` availability (DM-9). */
export type StatusProviderEntry = {
  readonly name: string;
  readonly class: string;
  readonly enabled: boolean;
  readonly availability: StatusProviderAvailability;
  readonly quotaDeclared: boolean;
  readonly peakDeclared: boolean;
};

/** One active provider park (DM-9). */
export type StatusProviderPark = {
  readonly name: string;
  readonly subjectKind: "provider" | "chain";
  readonly subjectName: string;
  readonly cause: string;
  readonly conditions: readonly string[];
  readonly expiresAt: string;
};

/** The parked-work source marker (DM-10). */
type StatusParkedWorkSource = {
  readonly kind: "local-pm-context";
  readonly path: string;
  readonly tracked: false;
  readonly gitIgnored: true;
};

/** One parked-work item with an observed-or-unknown identity (DM-10). */
export type StatusParkedWorkItem = {
  readonly workItemRef?: string;
  readonly branch?: string;
  readonly changeFolder?: string;
  readonly reason?: string;
  readonly parkedAt?: string;
  readonly ageDays?: number;
  readonly itemState: StatusParkedItemState;
  readonly condition?: string;
};

/** One ready-to-merge action-list item (DM-5, D-9). */
export type StatusReadyItem = {
  readonly ref: string;
  readonly class: StatusReadyClass;
  readonly sourceRef: string;
  readonly targetRef: string;
  readonly reviewState: StatusItemSignalState;
  readonly ciResult: StatusCiResult;
};

/** The uniform per-section item surface (DM-3, D-9). */
export type StatusSectionItem = StatusParkedWorkItem | StatusReadyItem;

/** One digest section: common fields plus its section-specific fields. */
export type StatusSection = {
  readonly id: StatusSectionId;
  readonly title: string;
  readonly state: StatusSectionState;
  readonly evidence: StatusEvidence;
  readonly counts: StatusCounts;
  readonly truncated: boolean;
  readonly families?: readonly StatusTrackerFamily[];
  readonly activeChange?: StatusActiveChangeState;
  readonly pullRequests?: readonly StatusPullRequestItem[];
  readonly commit?: StatusCommit;
  readonly result?: StatusCiResult;
  readonly runs?: readonly PipelineRun[];
  readonly capability?: string;
  readonly expectedStory?: string;
  readonly note?: string;
  readonly chain?: StatusProviderChain;
  readonly entries?: readonly StatusProviderEntry[];
  readonly parks?: readonly StatusProviderPark[];
  readonly source?: StatusParkedWorkSource;
  readonly items?: readonly StatusSectionItem[];
  readonly findings?: readonly StatusFinding[];
  readonly attentionStates?: readonly StatusLaneAttentionState[];
};

/** The digest summary counts (DM-1, DM-12). */
export type StatusSummary = {
  readonly sections: number;
  readonly observed: number;
  readonly degraded: number;
  readonly unknown: number;
  readonly unavailable: number;
  readonly notDelivered: number;
  readonly actionable: number;
  /** Added in M1-S10; present on every digest produced from Phase 2 onward. */
  readonly findingsTotal?: number;
  /** Added in M1-S10; present on every digest produced from Phase 2 onward. */
  readonly placeholderSectionCount?: number;
};

/** The complete bounded status digest (DM-1). */
export type StatusDigest = {
  readonly schemaVersion: typeof STATUS_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly repository: StatusRepositoryBinding;
  readonly summary: StatusSummary;
  readonly sections: readonly StatusSection[];
};
