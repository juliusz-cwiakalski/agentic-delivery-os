/**
 * Provider model-profile vocabulary (GH-234 F-1, F-3, F-7, F-8, F-9, F-10;
 * DM-1..DM-10).
 *
 * Runtime-neutral by construction: types and `as const` data only. The pure
 * selection/lifecycle/pacing policy lives in the `./provider` core subpath; the
 * vendor watch mappings live in `@delivery-os/adapters/provider-quota`. No
 * clock, randomness, environment, filesystem, or network access is declared
 * here.
 */
import type { ProviderPeakTimezone, QuotaLimit } from "./provider.js";

/** The closed pacing classes (F-7, DEC-1). */
export const PACING_CLASSES = ["judgment", "execution"] as const;
export type PacingClass = (typeof PACING_CLASSES)[number];

/** The closed capability vocabulary for a seat (F-3, DM-2). */
export const PROFILE_CAPABILITIES = ["vision-capable", "text-only"] as const;
export type ProfileCapability = (typeof PROFILE_CAPABILITIES)[number];

/** The closed declared pacing goal priorities (DM-5). Declared order is precedence. */
export const PACING_GOAL_PRIORITIES = [
  "utilize-subscription",
  "hold-judgment",
  "minimize-paid",
] as const;
export type PacingGoalPriority = (typeof PACING_GOAL_PRIORITIES)[number];

/** The closed profile event/announcement codes (EVT-1..EVT-5). */
export const PROFILE_EVENT_CODES = [
  "profile.selected",
  "profile.switched",
  "profile.reverted",
  "profile.ineligible",
  "profile.rung-changed",
] as const;
export type ProfileEventCode = (typeof PROFILE_EVENT_CODES)[number];

/** The two profile event severities (EVT-1..EVT-5). */
export const PROFILE_EVENT_SEVERITIES = ["info", "warning"] as const;
export type ProfileEventSeverity = (typeof PROFILE_EVENT_SEVERITIES)[number];

/**
 * The closed profile evidence allowlist (NFR-8). Exactly the fields a profile
 * event or target record may carry; every value is routing data, never secret
 * material, a raw vendor body, or prompt content.
 */
export const PROFILE_EVIDENCE_FIELDS = [
  "profileName",
  "previousProfile",
  "newProfile",
  "tier",
  "rung",
  "reason",
  "revertCondition",
  "providerName",
  "conditionKinds",
  "blockers",
] as const;

/** Evidence bounds applied to profile events and target records (NFR-8). */
export const PROFILE_EVIDENCE_MAX_BYTES = 1024 as const;
export const PROFILE_EVIDENCE_MAX_FIELDS = 20 as const;

/** The one additive target-profile state record kind (EVT-4). */
export const PROFILE_TARGET_RECORD_KIND = "provider.profile-target" as const;
export const PROFILE_TARGET_SCHEMA_ID = "delivery.provider.profile-target.v1" as const;
export const PROFILE_TARGET_RECORD_KEY = "provider.profile-target" as const;

/** The reasons a target record may carry (EVT-4). */
export const PROFILE_TARGET_REASONS = ["selection", "switch", "revert"] as const;
export type ProfileTargetReason = (typeof PROFILE_TARGET_REASONS)[number];

/** The env-record wire format marker (DM-7, DEC-3). */
export const ENV_RECORD_FORMAT = "data-v1" as const;

/**
 * The default `data-v1` header line. The gated legacy surface is exercised
 * through the injectable grammar options; the default stays brand-neutral.
 */
export const ENV_RECORD_HEADER = "# model-env data-v1" as const;

/**
 * The default model-environment name allowlist shape. It carries the legacy
 * `OC_<PREFIX>_AGENT_<SEAT>_MODEL` shape; the concrete product prefix is a
 * branding/config value, never hardcoded here.
 */
export const DEFAULT_ENV_RECORD_NAME_PATTERN =
  "^OC_[A-Z][A-Z0-9]*_AGENT_[A-Z0-9_]+_MODEL$" as const;

/** The strict identifier rule applied to a record name (Appendix D). */
export const ENV_RECORD_NAME_PATTERN = "^[A-Z_][A-Z0-9_]*$" as const;

/**
 * A model-environment name that has passed the allowlist/identifier rules. The
 * brand prevents a bare `string` from entering an env record unvalidated.
 */
export type EnvRecordName = string & { readonly __brand: "model-env-name" };

/** Default size bounds for the `data-v1` grammar (Appendix D). */
export const ENV_RECORD_MAX_BYTES = 65536 as const;
export const ENV_RECORD_MAX_LINE_BYTES = 8192 as const;
export const ENV_RECORD_MAX_RECORDS = 256 as const;

/** The order classes used by the deterministic profile selection walk (DM-6). */
export const PROFILE_ELIGIBILITY_VERDICTS = ["eligible", "ineligible", "shadowed"] as const;
export type ProfileEligibilityVerdict = (typeof PROFILE_ELIGIBILITY_VERDICTS)[number];

/** The closed blocker kinds (DM-6): an engine condition or the capability gate. */
export const PROFILE_BLOCKER_KINDS = ["condition", "capability"] as const;
export type ProfileBlockerKind = (typeof PROFILE_BLOCKER_KINDS)[number];

/** A declared tier: a named responsibility group (DM-1). */
export type ProviderProfileTier = {
  readonly name: string;
  readonly description?: string;
};

/** One seat assignment: a model plus the typed capability and pacing fields (DM-2, DM-3). */
export type ProviderProfileSeat = {
  readonly model: string;
  readonly pacingClass: PacingClass;
  readonly capability: ProfileCapability;
  /** Optional explicit env-record name; derived when absent. */
  readonly envName?: string;
};

/** A named model-per-tier assignment (DM-2). */
export type ProviderProfile = {
  readonly name: string;
  readonly tier: string;
  readonly seats: Readonly<Record<string, ProviderProfileSeat>>;
  readonly agentOverrides: Readonly<Record<string, string>>;
  readonly providers: readonly string[];
  /** Declared peak-window rules (GH-294 DM-3); absent means no peak enforcement. */
  readonly peakWindows?: ProviderProfilePeakRules;
};

/** The declared preference chain (DM-4). `order` is base-first, then fallbacks. */
export type ProviderPreferenceChain = {
  readonly base: string;
  readonly fallbacks: readonly string[];
  readonly order: readonly string[];
};

/** One named pacing rung (DM-5). */
export type ProviderPacingRung = {
  readonly name: string;
  readonly thresholdPercent: number;
  readonly executionModel: string;
};

/** The declared pacing configuration (DM-5). */
export type ProviderPacingConfiguration = {
  readonly goalPriorities: readonly PacingGoalPriority[];
  readonly rungs: Readonly<Record<string, ProviderPacingRung>>;
  readonly tailThresholdPercent: number;
};

/**
 * One declared peak-window rule window (GH-294 DM-3, DEC-1).
 *
 * Evaluated on the UTC basis only: the time-zone declaration admits the
 * delivered `UTC` designation and nothing else (OQ-TP-1). The multiplier is
 * declared rule data for cost accounting; it never prices or converts (NG-5).
 */
export type ProviderProfilePeakWindow = {
  readonly timezone: ProviderPeakTimezone;
  readonly startSecondsOfDay: number;
  readonly endSecondsOfDay: number;
  readonly multiplier: number;
  readonly bufferBeforeSeconds: number;
  readonly bufferAfterSeconds: number;
};

/**
 * Parsed per-profile peak-window rules (GH-294 DM-3, DEC-6).
 *
 * `graceSecondsDefault` is the declared profile default; `graceSecondsMax` is
 * derived at parse time as the smallest declared buffer across the profile's
 * windows, so the applied grace can never outlast the window buffer. The
 * bound is data on the parsed value, not an assertion made downstream only.
 */
export type ProviderProfilePeakRules = {
  readonly windows: readonly ProviderProfilePeakWindow[];
  readonly graceSecondsDefault: number;
  readonly graceSecondsMax: number;
};

/** One declared watch target behind a provider entry (DM-9, F-5). */
export type ProviderWatchTarget = {
  readonly mapping: import("./provider.js").ProviderWatchMappingKind;
  readonly endpoint: string;
  readonly credentialRef: string;
  readonly floor?: number;
  readonly thresholdPercent?: number;
};

/** The declared env-record grammar options (DM-7, DEC-3). */
export type ProviderEnvRecordPolicy = {
  readonly header?: string;
  readonly namePattern?: string;
  readonly maxBytes?: number;
  readonly maxLineBytes?: number;
  readonly maxRecords?: number;
};

/** The resolved `provider.profiles` branch (DM-1..DM-5). */
export type ProviderProfileConfiguration = {
  readonly tiers: Readonly<Record<string, ProviderProfileTier>>;
  readonly profiles: Readonly<Record<string, ProviderProfile>>;
  readonly preferenceChain?: ProviderPreferenceChain;
  readonly pacing?: ProviderPacingConfiguration;
  readonly watch?: Readonly<Record<string, ProviderWatchTarget>>;
  readonly envRecord?: ProviderEnvRecordPolicy;
};

/** A named blocker on an eligibility verdict (DM-6, EVT-3). */
export type ProfileBlocker = {
  readonly kind: ProfileBlockerKind;
  readonly value: string;
  readonly detail: string;
};

/** One profile's verdict in the selection walk (DM-6, EVT-3). */
export type ProfileEligibility = {
  readonly profile: string;
  readonly verdict: ProfileEligibilityVerdict;
  readonly blockers: readonly ProfileBlocker[];
};

/** One set/unset entry in the structured env record (DM-7). */
export type EnvRecordEntry =
  | { readonly operation: "set"; readonly name: string; readonly value: string }
  | { readonly operation: "unset"; readonly name: string };

/** The structured env record carried by the selection envelope (DM-7, Appendix C). */
export type EnvRecord = {
  readonly recordFormat: typeof ENV_RECORD_FORMAT;
  readonly entries: readonly EnvRecordEntry[];
  readonly serialized: string;
};

/** The bounded evidence carried by a profile event or target record (NFR-8). */
export type ProfileEvidence = {
  readonly profileName?: string;
  readonly previousProfile?: string;
  readonly newProfile?: string;
  readonly tier?: string;
  readonly rung?: string;
  readonly reason?: string;
  readonly revertCondition?: string;
  readonly providerName?: string;
  readonly conditionKinds?: readonly string[];
  readonly blockers?: readonly string[];
};

/** One structured profile event (EVT-1..EVT-3, EVT-5). */
export type ProfileEvent = {
  readonly code: ProfileEventCode;
  readonly severity: ProfileEventSeverity;
  readonly identity: string;
  readonly createdAt: string;
  readonly createdAtMs: number;
  readonly message: string;
  readonly evidence: ProfileEvidence;
};

/** The persisted target-profile record payload (EVT-4). */
export type ProfileTargetRecord = {
  readonly schemaVersion: typeof PROFILE_TARGET_SCHEMA_ID;
  readonly targetProfile: string;
  readonly reason: ProfileTargetReason;
  readonly revertCondition?: string;
  readonly previousProfile?: string;
  readonly providerName?: string;
  readonly createdAt: string;
  readonly createdAtMs: number;
  readonly evidence: ProfileEvidence;
};

/** The active rung plus the execution-seat model movements it implies (F-7). */
export type ProfileRungState = {
  readonly rung: string;
  readonly movedSeats: Readonly<Record<string, string>>;
};

/** A per-provider availability verdict from a probe (F-4). */
export type ProfileProviderAvailability = {
  readonly available: boolean;
  readonly condition: string;
  readonly blockers: readonly ProfileBlocker[];
  readonly source: string;
};

/** The injected availability probe port (F-4, NFR-5). */
export type ProfileProbePort = {
  readonly probe: (providerName: string) => ProfileProviderAvailability;
};

/** The combined selection result (DM-8, Appendix C). */
export type ProfileSelectionDecision = {
  readonly profile: string;
  readonly tier: string;
  readonly rung: string;
  readonly agentOverrides: Readonly<Record<string, string>>;
  readonly eligibility: readonly ProfileEligibility[];
  readonly envRecord?: EnvRecord;
  readonly events: readonly ProfileEvent[];
  readonly seatModels: Readonly<Record<string, string>>;
};

/** The selection outcome: selected, or a classified fail-closed refusal. */
export type ProfileSelectionResult =
  | {
      readonly ok: true;
      readonly outcome: "selected";
      readonly decision: ProfileSelectionDecision;
      readonly target?: ProfileTargetRecord;
      readonly events: readonly ProfileEvent[];
    }
  | {
      readonly ok: true;
      readonly outcome: "switched" | "reverted";
      readonly decision: ProfileSelectionDecision;
      readonly target: ProfileTargetRecord;
      readonly events: readonly ProfileEvent[];
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly summary: string;
      readonly eligibility: readonly ProfileEligibility[];
      readonly events: readonly ProfileEvent[];
    };

/** One read-only watch condition view (DM-9). */
export type ProviderWatchConditionView = {
  readonly name: string;
  readonly condition: string;
  readonly source: string;
  readonly checkedAt: string;
};

/** The normalized snapshot a vendor watch mapping produces (DM-9). */
export type ProviderWatchSnapshot = {
  readonly mapping: import("./provider.js").ProviderWatchMappingKind;
  readonly limits: readonly QuotaLimit[];
  readonly sourceSummary: string;
};

/** The result of normalizing one vendor watch response (F-5). */
export type ProviderWatchNormalization =
  | { readonly status: "clear"; readonly snapshot: ProviderWatchSnapshot }
  | {
      readonly status: "parked";
      readonly snapshot: ProviderWatchSnapshot;
      readonly cause: string;
      readonly condition: string;
      readonly waitSeconds: number;
      readonly expiresAtMs: number;
    }
  | {
      readonly status: "failed";
      readonly errorCode: string;
      readonly announcementCode: string;
      readonly failureClass: string;
      readonly httpStatus: number;
    };

/** The injected watch-mapping port (F-5; implemented by the adapter edge). */
export type ProviderWatchMappingPort = {
  readonly normalize: (input: {
    readonly mapping: import("./provider.js").ProviderWatchMappingKind;
    readonly bodyText: string;
    readonly status: number;
    readonly nowMs: number;
    readonly floor?: number;
    readonly thresholdPercent?: number;
  }) => ProviderWatchNormalization;
};
