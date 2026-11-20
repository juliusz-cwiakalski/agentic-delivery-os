/**
 * Provider-engine vocabulary (GH-182 F-1..F-9, DM-1..DM-13).
 *
 * Runtime-neutral by construction: types and `as const` data only. The pure
 * provider policy lives in the `./provider` core subpath; the quota HTTP
 * transport is an injected port implemented in `@delivery-os/adapters/provider-quota`.
 * No clock, randomness, environment, filesystem, or network access is declared
 * here.
 */
import type { CredentialSourceKey, SecretMaterial } from "./credentials.js";

/** The closed cost classes (DM-2). */
export const PROVIDER_COST_CLASSES = ["subscription", "pay-per-token"] as const;
export type ProviderCostClass = (typeof PROVIDER_COST_CLASSES)[number];

/** The declared default zone; `UTC` is the alias of `Etc/UTC` (GH-350, DM-1). */
export const PROVIDER_DEFAULT_ZONE = "UTC" as const;
/**
 * The IANA zone-name grammar (GH-350, DM-1/Appendix B). Grammar only: existence
 * is decided at the composition edge through the injected zone port.
 */
export const PROVIDER_ZONE_NAME_PATTERN = "^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$" as const;

/** The closed condition kinds that can drive a park (DM-8; GH-350 adds the sixth). */
export const PROVIDER_CONDITION_KINDS = [
  "peak-window",
  "quota-exhausted",
  "budget-exhausted",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
] as const;
export type ProviderConditionKind = (typeof PROVIDER_CONDITION_KINDS)[number];

/** The deterministic tie order used when conditions share an expiry (DM-10, GH-350). */
export const PROVIDER_CONDITION_TIE_ORDER = [
  "peak-window",
  "quota-exhausted",
  "budget-exhausted",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
] as const satisfies readonly ProviderConditionKind[];

/** The closed park causes (DM-10, DEC-5; GH-350 adds the eighth). */
export const PARK_CAUSES = [
  "peak-window",
  "quota-exhausted",
  "budget-exhausted",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
  "chain-exhausted",
  "reevaluation-cap",
] as const;
export type ParkCause = (typeof PARK_CAUSES)[number];

/** The closed nine-value skip-reason set with deterministic precedence (DM-7, GH-350). */
export const PROVIDER_SKIP_REASONS = [
  "disabled",
  "peak-window",
  "quota-exhausted",
  "budget-exhausted",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
  "paid-fallback-not-allowed",
  "shadowed",
] as const;
export type ProviderSkipReason = (typeof PROVIDER_SKIP_REASONS)[number];

/** The closed announcement vocabulary (DM-11, EVT-2..EVT-4; GH-350 adds two). */
export const ANNOUNCEMENT_CODES = [
  "provider.peak.parked",
  "provider.quota.parked",
  "provider.quota.reset_missing",
  "provider.quota.unreachable",
  "provider.quota.http_error",
  "provider.quota.auth_rejected",
  "provider.quota.malformed",
  "provider.credential.missing",
  "provider.chain.exhausted",
  "provider.reevaluation.cap",
  "provider.resumed",
  "provider.budget.parked",
  "provider.budget.crossed",
] as const;
export type AnnouncementCode = (typeof ANNOUNCEMENT_CODES)[number];

/**
 * The closed watch-only condition set (GH-350, TDR-0061). `watch-stale` is a
 * watch view condition only: it joins no park cause, condition kind, skip
 * reason, or announcement code.
 */
export const PROVIDER_WATCH_CONDITIONS = [
  "clear",
  "quota-exhausted",
  "watch-stale",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
] as const;
export type ProviderWatchCondition = (typeof PROVIDER_WATCH_CONDITIONS)[number];

/** The closed budget scope and basis sets (GH-350, DM-2). */
export const PROVIDER_BUDGET_SCOPES = ["ticket", "window"] as const;
export type ProviderBudgetScope = (typeof PROVIDER_BUDGET_SCOPES)[number];
export const PROVIDER_BUDGET_BASES = ["cost", "tokens"] as const;
export type ProviderBudgetBasis = (typeof PROVIDER_BUDGET_BASES)[number];

/** The two announcement severities (DM-11). */
export const ANNOUNCEMENT_SEVERITIES = ["info", "warning"] as const;
export type AnnouncementSeverity = (typeof ANNOUNCEMENT_SEVERITIES)[number];

/** The closed provider record kinds inside the delivered state schema (EVT-1/2). */
export const PROVIDER_RECORD_KINDS = ["provider.park", "provider.announcement"] as const;
export type ProviderRecordKind = (typeof PROVIDER_RECORD_KINDS)[number];

/** Park lifecycle states; expiry is derived at read time, never written (DM-12). */
export const PROVIDER_PARK_STATES = ["active", "cleared"] as const;
export type ProviderParkState = (typeof PROVIDER_PARK_STATES)[number];

/** Record payload schema identifiers (DM-10, DM-11). */
export const PROVIDER_PARK_SCHEMA_ID = "delivery.provider.park.v1" as const;
export const PROVIDER_ANNOUNCEMENT_SCHEMA_ID = "delivery.provider.announcement.v1" as const;

/** The rebuildable derived-document name (DM-12). */
export const PROVIDER_PARKS_DOCUMENT_NAME = "provider-parks.json" as const;

/** The projection document schema identifier (DM-12). */
export const PROVIDER_PARKS_PROJECTION_SCHEMA_ID = "delivery.provider.parks.v1" as const;

/** Store-scoped record keys used by the provider ledger records. */
export const PROVIDER_PARK_RECORD_KEY = "provider.parks" as const;
export const PROVIDER_ANNOUNCEMENT_RECORD_KEY = "provider.announcements" as const;

/**
 * The closed fourteen-field park evidence allowlist (DM-10, NFR-5; GH-350 adds
 * `timezone` plus the five budget fields).
 */
export const PARK_EVIDENCE_FIELDS = [
  "providerName",
  "chainName",
  "conditionKinds",
  "waitSeconds",
  "resetEpochMs",
  "httpStatus",
  "failureClass",
  "credentialRefName",
  "timezone",
  "budgetName",
  "budgetScope",
  "budgetBasis",
  "budgetMeasured",
  "budgetCeiling",
] as const;

/**
 * The closed seventeen-field announcement evidence allowlist (DM-11, NFR-5;
 * GH-350 spreads the fourteen-field park list and adds three).
 */
export const ANNOUNCEMENT_EVIDENCE_FIELDS = [
  ...PARK_EVIDENCE_FIELDS,
  "parkName",
  "parkExpiresAt",
  "announcementCode",
] as const;

/** Evidence bounds applied to park and announcement evidence (NFR-5). */
export const PROVIDER_EVIDENCE_MAX_BYTES = 1024 as const;
export const PROVIDER_EVIDENCE_MAX_FIELDS = 20 as const;

/** The declared provider-policy bound constants (GH-350, DM-1/DM-5/DM-7). */
export const PROVIDER_ZONE_NAME_MAX_LENGTH = 64 as const;
export const PROVIDER_SIMULATE_FIXTURE_MAX_BYTES = 65536 as const;
export const PROVIDER_MIGRATE_SOURCE_MAX_BYTES = 65536 as const;
export const PROVIDER_MIGRATE_SOURCE_MAX_LINES = 2000 as const;
export const PROVIDER_MIGRATE_MAX_SOURCES = 64 as const;

/** The documented provider quota defaults (Appendix B). */
export const PROVIDER_QUOTA_DEFAULTS = {
  timeoutMs: 15000,
  thresholdPercent: 100,
  maxSleepLoops: 24,
  outageParkTtlSeconds: 300,
  credentialParkTtlSeconds: 900,
  capParkTtlSeconds: 300,
} as const;

/** The engine default loop cap when no quota policy overrides it (DM-13). */
export const DEFAULT_MAX_SLEEP_LOOPS = 24 as const;

/** A declared credential reference inside provider configuration (DM-5). */
export type ProviderCredentialDeclaration = {
  readonly sourceKey: CredentialSourceKey;
};

/** A declared peak window; `timezone` is `UTC` or an IANA zone name (DM-1). */
export type ProviderPeakWindow = {
  readonly timezone: string;
  readonly startSecondsOfDay: number;
  readonly endSecondsOfDay: number;
  readonly bufferSeconds: number;
};

/** A subscription quota policy (DM-4). */
export type ProviderQuotaPolicy = {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly credentialRef: string;
  readonly timeoutMs: number;
  readonly thresholdPercent: number;
  readonly maxSleepLoops: number;
  readonly outageParkTtlSeconds: number;
  readonly credentialParkTtlSeconds: number;
  readonly capParkTtlSeconds: number;
};

/** A normalized provider descriptor (DM-1). */
export type ProviderDescriptor = {
  readonly name: string;
  readonly class: ProviderCostClass;
  readonly enabled: boolean;
  readonly peak?: ProviderPeakWindow;
  readonly quota?: ProviderQuotaPolicy;
};

/** A declared provider chain (DM-6). */
export type ProviderChain = {
  readonly name: string;
  readonly entries: readonly string[];
  readonly allowPaidFallback: boolean;
};

/** A declared budget ceiling (GH-350, DM-2). */
export type ProviderBudgetDeclaration = {
  readonly enabled: boolean;
  readonly scope: ProviderBudgetScope;
  readonly basis: ProviderBudgetBasis;
  readonly ceiling: number;
  readonly windowSeconds?: number;
  readonly entries?: readonly string[];
};

/** The resolved `provider` configuration branch. */
export type ProviderConfiguration = {
  readonly defaultChain?: string;
  readonly credentials: Readonly<Record<string, ProviderCredentialDeclaration>>;
  readonly entries: Readonly<Record<string, ProviderDescriptor>>;
  readonly chains: Readonly<Record<string, ProviderChain>>;
  /** GH-350: the declared spend ceilings; absent means no gate and no read. */
  readonly budgets?: Readonly<Record<string, ProviderBudgetDeclaration>>;
};

/** One provider condition result; failures carry a classified identity (DM-8). */
export type ProviderConditionResult =
  | { readonly status: "clear" }
  | {
      readonly status: "parked";
      readonly kind: ProviderConditionKind;
      readonly waitSeconds: number;
      readonly expiresAtMs: number;
      readonly announcementCode: AnnouncementCode;
      readonly evidence: ProviderParkEvidence;
    }
  | {
      readonly status: "failed";
      readonly kind: ProviderConditionKind;
      readonly errorCode: ProviderErrorCode;
      readonly announcementCode: AnnouncementCode;
      readonly evidence: ProviderParkEvidence;
    };

/** The combined state of an entry's conditions (DM-8, AC-F3-4). */
export type CombinedProviderCondition =
  | { readonly status: "clear" }
  | {
      readonly status: "parked";
      readonly cause: ParkCause;
      readonly conditions: readonly ProviderConditionKind[];
      readonly waitSeconds: number;
      readonly expiresAtMs: number;
      readonly announcementCode: AnnouncementCode;
      readonly evidence: ProviderParkEvidence;
    }
  | {
      readonly status: "failed";
      readonly cause: ProviderConditionKind;
      readonly conditions: readonly ProviderConditionKind[];
      readonly errorCode: ProviderErrorCode;
      readonly announcementCode: AnnouncementCode;
      readonly evidence: ProviderParkEvidence;
    };

/** The park evidence shape: exactly the fourteen allowlisted fields, all optional. */
export type ProviderParkEvidence = {
  readonly providerName?: string;
  readonly chainName?: string;
  readonly conditionKinds?: readonly ProviderConditionKind[];
  readonly waitSeconds?: number;
  readonly resetEpochMs?: number;
  readonly httpStatus?: number;
  readonly failureClass?: string;
  readonly credentialRefName?: string;
  readonly timezone?: string;
  readonly budgetName?: string;
  readonly budgetScope?: ProviderBudgetScope;
  readonly budgetBasis?: ProviderBudgetBasis;
  readonly budgetMeasured?: number;
  readonly budgetCeiling?: number;
};

/** The announcement evidence shape: the fourteen base fields plus three (max 17). */
export type ProviderAnnouncementEvidence = ProviderParkEvidence & {
  readonly parkName?: string;
  readonly parkExpiresAt?: string;
  readonly announcementCode?: AnnouncementCode;
};

/** One scope requested from the read-only spend-totals port (GH-350, DM-3). */
export type ProviderSpendTotalsScope = {
  readonly scopeKey: string;
  readonly fromMs: number;
};

/** Per-scope spend facts projected from one verified read (GH-350, DM-3). */
export type ProviderSpendTotals = {
  readonly scopeKey: string;
  readonly cost: number;
  readonly tokens: number;
  readonly newestAtMs: number | null;
  /**
   * The delivered fold's cost-sparsity disclosure (GH-350, DEC-10): true when
   * at least one contributing observation carried no harness-reported cost.
   * It rides the announcement message, never the evidence allowlist.
   */
  readonly sparse?: boolean;
};

/** The injected read-only spend-totals input (GH-350, DM-3). */
export type ProviderSpendTotalsInput = {
  readonly workItemRef: string;
  readonly scopes: readonly ProviderSpendTotalsScope[];
};

/** The injected read-only spend-totals result (GH-350, DM-3). */
export type ProviderSpendTotalsRead =
  | { readonly status: "measured"; readonly totals: readonly ProviderSpendTotals[] }
  | { readonly status: "empty" }
  | {
      /**
       * The delivered `state.*` identity of a failed read (GH-350, DM-3, C-5).
       * A failed read is never a clear: the decision refuses with this code.
       */
      readonly status: "failed";
      readonly code: ProviderStateFailureIdentity;
    };

/** The one read-only spend-totals port (GH-350, DM-3): O(budgets), no records. */
export type ProviderSpendTotalsPort = {
  readonly read: (input: ProviderSpendTotalsInput) => Promise<ProviderSpendTotalsRead>;
};

/** The budget facts carried beside a park/refusal (GH-350, DM-4). */
export type ProviderBudgetFacts = {
  readonly budgetName: string;
  readonly scope: ProviderBudgetScope;
  readonly basis: ProviderBudgetBasis;
  readonly measured: number;
  readonly ceiling: number;
};

/** One budget outcome: clear, a window park, or a ticket-scope failure (GH-350). */
export type ProviderBudgetOutcome =
  | { readonly status: "clear"; readonly budgetName: string }
  | {
      readonly status: "parked";
      readonly kind: "budget-exhausted";
      readonly budgetName: string;
      readonly waitSeconds: number;
      readonly expiresAtMs: number;
      readonly announcementCode: "provider.budget.parked";
      readonly evidence: ProviderParkEvidence;
      readonly facts: ProviderBudgetFacts;
      /** The delivered fold's cost-sparsity disclosure (DEC-10); never evidence. */
      readonly sparse?: boolean;
    }
  | {
      readonly status: "failed";
      readonly kind: "budget-exhausted";
      readonly budgetName: string;
      readonly announcementCode: "provider.budget.crossed";
      readonly evidence: ProviderParkEvidence;
      readonly facts: ProviderBudgetFacts;
      /** The delivered fold's cost-sparsity disclosure (DEC-10); never evidence. */
      readonly sparse?: boolean;
    };

/** A resolved work-item ref, or the refusal state (GH-350, TDR-0063). */
export type ProviderWorkItemRefResolution =
  | { readonly status: "resolved"; readonly workItemRef: string }
  | { readonly status: "unresolved" };

/** The declaration-only ref seam the composition supplies (GH-350, TDR-0063). */
export type ProviderWorkItemRefResolver = () => ProviderWorkItemRefResolution;

/**
 * The first-iteration watch mapping kinds (GH-234 F-5, DM-9). Additive only:
 * each identifier binds a configured watch target to one normalized snapshot
 * mapping behind the existing quota transport seam.
 */
export const PROVIDER_WATCH_MAPPING_KINDS = [
  "coding-plan-windows",
  "deepseek-balance",
  "openai-usage-windows",
] as const;
export type ProviderWatchMappingKind = (typeof PROVIDER_WATCH_MAPPING_KINDS)[number];

/** A normalized quota limit (DM-9). */
export type QuotaLimit = {
  readonly type: string;
  readonly percentage: number;
  readonly resetEpochMs?: number;
};

/** A normalized, secret-free quota snapshot (DM-9). */
export type QuotaSnapshot = {
  readonly limits: readonly QuotaLimit[];
};

/** The park record payload (DM-10, EVT-1). */
export type ProviderParkRecord = {
  readonly schemaVersion: typeof PROVIDER_PARK_SCHEMA_ID;
  readonly name: string;
  readonly subjectKind: "provider" | "chain";
  readonly subjectName: string;
  readonly cause: ParkCause;
  readonly conditions: readonly ProviderConditionKind[];
  readonly state: ProviderParkState;
  readonly createdAt: string;
  readonly createdAtMs: number;
  readonly expiresAt: string;
  readonly expiresAtMs: number;
  readonly clearedAt?: string;
  readonly clearedAtMs?: number;
  readonly evidence: ProviderParkEvidence;
};

/** The announcement record payload (DM-11, EVT-2). */
export type ProviderAnnouncementRecord = {
  readonly schemaVersion: typeof PROVIDER_ANNOUNCEMENT_SCHEMA_ID;
  readonly identity: string;
  readonly code: AnnouncementCode;
  readonly severity: AnnouncementSeverity;
  readonly subjectKind: "provider" | "chain";
  readonly subjectName: string;
  readonly createdAt: string;
  readonly cause?: ParkCause;
  readonly conditions?: readonly ProviderConditionKind[];
  readonly parkName?: string;
  readonly parkExpiresAt?: string;
  readonly message: string;
  readonly evidence: ProviderAnnouncementEvidence;
};

/** One non-selected chain entry with exactly one closed reason (DM-7). */
export type ProviderSkippedEntry = {
  readonly providerName: string;
  readonly reason: ProviderSkipReason;
};

/** A selected or parked chain decision (DM-7). */
export type ProviderDecision =
  | {
      readonly kind: "selected";
      readonly chainName: string;
      readonly providerName: string;
      readonly costClass: ProviderCostClass;
    }
  | {
      readonly kind: "parked";
      readonly chainName: string;
      readonly park: ProviderParkRecord;
    };

/** A parked/expired/cleared park view with derived read-time state (DM-12). */
export type ProviderParkView = {
  readonly name: string;
  readonly subjectKind: "provider" | "chain";
  readonly subjectName: string;
  readonly cause: ParkCause;
  readonly conditions: readonly ProviderConditionKind[];
  readonly state: "active" | "expired" | "cleared";
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly clearedAt?: string;
  readonly evidence: ProviderParkEvidence;
};

/** Provider classification identities produced by the engine (F-9; GH-350 adds the budget row). */
export type ProviderErrorCode =
  | "provider.peak.zone-unknown"
  | "provider.quota.exceeded"
  | "provider.budget.exceeded"
  | "provider.outage"
  | "provider.auth.rejected"
  | "provider.chain.empty"
  | "provider.chain.invalid"
  | "config.credential.missing";

/**
 * The delivered state read identity a failed spend-totals read refuses with
 * (GH-350, DM-3/C-5). It is never rounded to a provider or a clear identity.
 */
type ProviderStateFailureIdentity = `state.${string}`;

/**
 * Every identity a `resolve` decision may refuse with (GH-350): the provider
 * conditions, the delivered `state.*` read failure, and the one pre-resolution
 * input refusal for an unresolvable budget work-item ref (TDR-0063 D4).
 */
type ProviderFailureIdentity =
  | ProviderErrorCode
  | ProviderStateFailureIdentity
  | "input.value.rejected";

/** One quota transport request; the credential material is handed over exactly once. */
export type QuotaTransportRequest = {
  readonly endpoint: string;
  readonly method: "GET";
  readonly timeoutMs: number;
  readonly credential: SecretMaterial;
};

/** A sanitized transport result: HTTP status plus the untrusted body text. */
export type QuotaTransportResult = {
  readonly status: number;
  readonly bodyText: string;
};

/** The injectable quota transport port (PD-C). */
export type QuotaTransport = {
  readonly send: (request: QuotaTransportRequest) => Promise<QuotaTransportResult>;
};

/** An injected clock seam (PD-G). */
export type ProviderClock = {
  readonly nowMs: () => number;
};

/**
 * The single zone edge (GH-350, DM-1, ADR-0013 as revised). Three required
 * members: existence, the offset in effect at an instant, and the smallest
 * transition instant at or after an instant. `undefined` from the transition
 * lookup means "no transition in the horizon" — never a refusal, never UTC.
 */
export type ProviderZonePort = {
  readonly isKnownZone: (zone: string) => boolean;
  readonly offsetSecondsAt: (zone: string, atMs: number) => number;
  readonly nextTransitionAtOrAfter: (zone: string, atMs: number) => number | undefined;
};

/** The zone facts one pure evaluation can query; bound to a single zone. */
export type ProviderZoneFacts = {
  readonly offsetSecondsAt: (atMs: number) => number;
  readonly nextTransitionAtOrAfter: (atMs: number) => number | undefined;
};

/** An injected sleep seam; the core never calls a real timer (DEC-9). */
export type ProviderSleep = {
  readonly sleep: (milliseconds: number) => Promise<void>;
};

/** The result of normalizing and evaluating one quota response. */
export type QuotaEvaluation =
  | { readonly status: "clear"; readonly snapshot: QuotaSnapshot }
  | {
      readonly status: "parked";
      readonly waitSeconds: number;
      readonly expiresAtMs: number;
      readonly snapshot: QuotaSnapshot;
      readonly evidence: ProviderParkEvidence;
    }
  | {
      readonly status: "failed";
      readonly errorCode: ProviderErrorCode;
      readonly announcementCode: AnnouncementCode;
      readonly failureClass: string;
      readonly httpStatus: number;
    };

/** One provider's non-mutating quota view (F-8). */
export type ProviderQuotaView = {
  readonly providerName: string;
  readonly status: "clear" | "parked";
  readonly cause?: ParkCause;
  readonly conditions: readonly ProviderConditionKind[];
  readonly resumeAt?: string;
  readonly evidence: ProviderParkEvidence;
};

/** The `resolve` engine result: a decision or a classified refusal. */
export type ProviderResolveResult =
  | {
      readonly ok: true;
      readonly chainName: string;
      readonly decision: ProviderDecision;
      readonly skipped: readonly ProviderSkippedEntry[];
      readonly parks: readonly ProviderParkRecord[];
      readonly announcements: readonly ProviderAnnouncementRecord[];
    }
  | {
      readonly ok: false;
      readonly errorCode: ProviderFailureIdentity;
      readonly announcementCode?: AnnouncementCode;
      readonly summary: string;
    };

/** The `quota` engine result: per-provider views or a classified failure. */
export type ProviderEngineResult =
  | {
      readonly ok: true;
      readonly providers: readonly ProviderQuotaView[];
      readonly announcements: readonly ProviderAnnouncementRecord[];
    }
  | {
      readonly ok: false;
      readonly errorCode: ProviderErrorCode;
      readonly announcementCode?: AnnouncementCode;
      readonly summary: string;
    };
