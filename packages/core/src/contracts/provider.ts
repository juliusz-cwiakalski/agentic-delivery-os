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

/** The only timezone basis admitted at v1 (DEC-10). */
export const PROVIDER_PEAK_TIMEZONES = ["UTC"] as const;
export type ProviderPeakTimezone = (typeof PROVIDER_PEAK_TIMEZONES)[number];

/** The closed condition kinds that can drive a park (DM-8). */
export const PROVIDER_CONDITION_KINDS = [
  "peak-window",
  "quota-exhausted",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
] as const;
export type ProviderConditionKind = (typeof PROVIDER_CONDITION_KINDS)[number];

/** The deterministic tie order used when conditions share an expiry (DM-10). */
export const PROVIDER_CONDITION_TIE_ORDER = [
  "peak-window",
  "quota-exhausted",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
] as const satisfies readonly ProviderConditionKind[];

/** The closed park causes (DM-10, DEC-5). */
export const PARK_CAUSES = [
  "peak-window",
  "quota-exhausted",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
  "chain-exhausted",
  "reevaluation-cap",
] as const;
export type ParkCause = (typeof PARK_CAUSES)[number];

/** The closed eight-value skip-reason set with deterministic precedence (DM-7). */
export const PROVIDER_SKIP_REASONS = [
  "disabled",
  "peak-window",
  "quota-exhausted",
  "provider-outage",
  "credential-missing",
  "credential-rejected",
  "paid-fallback-not-allowed",
  "shadowed",
] as const;
export type ProviderSkipReason = (typeof PROVIDER_SKIP_REASONS)[number];

/** The closed announcement vocabulary (DM-11, EVT-2..EVT-4). */
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
] as const;
export type AnnouncementCode = (typeof ANNOUNCEMENT_CODES)[number];

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

/** The closed eight-field park evidence allowlist (DM-10, NFR-5). */
export const PARK_EVIDENCE_FIELDS = [
  "providerName",
  "chainName",
  "conditionKinds",
  "waitSeconds",
  "resetEpochMs",
  "httpStatus",
  "failureClass",
  "credentialRefName",
] as const;

/** The closed eleven-field announcement evidence allowlist (DM-11, NFR-5). */
export const ANNOUNCEMENT_EVIDENCE_FIELDS = [
  ...PARK_EVIDENCE_FIELDS,
  "parkName",
  "parkExpiresAt",
  "announcementCode",
] as const;

/** Evidence bounds applied to park and announcement evidence (NFR-5). */
export const PROVIDER_EVIDENCE_MAX_BYTES = 1024 as const;
export const PROVIDER_EVIDENCE_MAX_FIELDS = 20 as const;

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

/** A UTC peak window (DM-3, DEC-10). */
export type ProviderPeakWindow = {
  readonly timezone: ProviderPeakTimezone;
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

/** The resolved `provider` configuration branch. */
export type ProviderConfiguration = {
  readonly defaultChain?: string;
  readonly credentials: Readonly<Record<string, ProviderCredentialDeclaration>>;
  readonly entries: Readonly<Record<string, ProviderDescriptor>>;
  readonly chains: Readonly<Record<string, ProviderChain>>;
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

/** The park evidence shape: exactly the eight allowlisted fields, all optional. */
export type ProviderParkEvidence = {
  readonly providerName?: string;
  readonly chainName?: string;
  readonly conditionKinds?: readonly ProviderConditionKind[];
  readonly waitSeconds?: number;
  readonly resetEpochMs?: number;
  readonly httpStatus?: number;
  readonly failureClass?: string;
  readonly credentialRefName?: string;
};

/** The announcement evidence shape: the eight base fields plus three (max 11). */
export type ProviderAnnouncementEvidence = ProviderParkEvidence & {
  readonly parkName?: string;
  readonly parkExpiresAt?: string;
  readonly announcementCode?: AnnouncementCode;
};

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

/** Provider classification identities produced by the engine (F-9). */
export type ProviderErrorCode =
  | "provider.quota.exceeded"
  | "provider.outage"
  | "provider.auth.rejected"
  | "provider.chain.empty"
  | "provider.chain.invalid"
  | "config.credential.missing";

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

/** The `resolve` engine result: a decision or a classified provider failure. */
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
      readonly errorCode: ProviderErrorCode;
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
