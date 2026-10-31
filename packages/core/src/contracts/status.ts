/**
 * The `delivery.status.v1` vocabulary (GH-175 F-2, DM-1..DM-15).
 *
 * Runtime-neutral by construction: types and `as const` data only. Every
 * section id, state, reason, source, outcome, family, cap, limit, threshold,
 * and rank key is declared once here; the pure domain and the command consume
 * it. No clock, randomness, environment, filesystem, or network access exists
 * in this module.
 */

import type { DeliveryRequest, PipelineRun, WorkItem } from "./ports.js";
import type { ProviderConfiguration, ProviderParkView } from "./provider.js";

/** The six section ids in their fixed order (F-2, Appendix C). */
export const STATUS_SECTION_ORDER = [
  "tracker",
  "changes-and-prs",
  "ci",
  "lanes-or-queue",
  "providers",
  "parked-work",
] as const;
export type StatusSectionId = (typeof STATUS_SECTION_ORDER)[number];

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
/** Human digest line cap (Appendix C). */
export const STATUS_MAX_HUMAN_LINES = 24 as const;
/** Human digest byte cap (Appendix C). */
export const STATUS_MAX_HUMAN_BYTES = 4096 as const;
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
};

/** One tracker family list (DM-5). */
export type StatusTrackerFamily = {
  readonly family: StatusTrackerFamilyId;
  readonly state: StatusTrackerFamilyState;
  readonly reason?: StatusEvidenceReason;
  readonly counts: StatusCounts;
  readonly items: readonly StatusTrackerItem[];
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
};

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
  readonly items?: readonly StatusParkedWorkItem[];
};

/** The digest summary counts (DM-1). */
export type StatusSummary = {
  readonly sections: number;
  readonly observed: number;
  readonly degraded: number;
  readonly unknown: number;
  readonly unavailable: number;
  readonly notDelivered: number;
  readonly actionable: number;
};

/** The complete bounded status digest (DM-1). */
export type StatusDigest = {
  readonly schemaVersion: typeof STATUS_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly repository: StatusRepositoryBinding;
  readonly summary: StatusSummary;
  readonly sections: readonly StatusSection[];
};
