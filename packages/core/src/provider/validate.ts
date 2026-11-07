/**
 * Provider configuration parsing and semantic validation (GH-182 F-1, F-2).
 *
 * Pure: consumes already-resolved configuration values and returns typed data or
 * a classified failure. No credential resolution, quota fetch, or state write
 * occurs here (TC-PROV-002 step 4).
 */
import {
  type ConfigValue,
  PACING_CLASSES,
  PACING_GOAL_PRIORITIES,
  PROFILE_CAPABILITIES,
  PROVIDER_COST_CLASSES,
  PROVIDER_QUOTA_DEFAULTS,
  PROVIDER_WATCH_MAPPING_KINDS,
  type PacingClass,
  type PacingGoalPriority,
  type ProfileCapability,
  type ProviderChain,
  type ProviderConfiguration,
  type ProviderCredentialDeclaration,
  type ProviderDescriptor,
  type ProviderEnvRecordPolicy,
  type ProviderErrorCode,
  type ProviderPacingConfiguration,
  type ProviderPacingRung,
  type ProviderPeakWindow,
  type ProviderPreferenceChain,
  type ProviderProfile,
  type ProviderProfileConfiguration,
  type ProviderProfileSeat,
  type ProviderProfileTier,
  type ProviderQuotaPolicy,
  type ProviderWatchMappingKind,
  type ProviderWatchTarget,
} from "#contracts";

export type ProviderValidationError = {
  readonly code: Extract<ProviderErrorCode, "provider.chain.invalid" | "provider.chain.empty">;
  readonly detail: string;
  readonly chainName?: string;
  readonly entries?: readonly string[];
};

export type ProviderConfigResult =
  | { readonly ok: true; readonly config: ProviderConfiguration }
  | { readonly ok: false; readonly error: ProviderValidationError };

export type ProviderChainSelection =
  | { readonly ok: true; readonly chain: ProviderChain }
  | { readonly ok: false; readonly error: ProviderValidationError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const invalid = (
  detail: string,
  extra: { readonly chainName?: string; readonly entries?: readonly string[] } = {},
): { readonly ok: false; readonly error: ProviderValidationError } => ({
  ok: false,
  error: {
    code: "provider.chain.invalid",
    detail,
    ...(extra.chainName === undefined ? {} : { chainName: extra.chainName }),
    ...(extra.entries === undefined ? {} : { entries: extra.entries }),
  },
});

const integer = (value: unknown, fallback?: number): number | undefined => {
  if (value === undefined) return fallback;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
};

const boolean = (value: unknown, fallback: boolean): boolean | undefined =>
  value === undefined ? fallback : typeof value === "boolean" ? value : undefined;

const string = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const parsePeak = (value: unknown): ProviderPeakWindow | string => {
  if (!isRecord(value)) return "peak";
  const timezone = value.timezone === undefined ? "UTC" : value.timezone;
  if (timezone !== "UTC") return "peak.timezone";
  const start = integer(value.startSecondsOfDay);
  const end = integer(value.endSecondsOfDay);
  const buffer = integer(value.bufferSeconds, 0);
  if (start === undefined || start < 0 || start > 86399) return "peak.startSecondsOfDay";
  if (end === undefined || end < 1 || end > 86399) return "peak.endSecondsOfDay";
  if (end <= start) return "peak.endSecondsOfDay";
  if (buffer === undefined || buffer < 0) return "peak.bufferSeconds";
  return { timezone, startSecondsOfDay: start, endSecondsOfDay: end, bufferSeconds: buffer };
};

const parseQuota = (value: unknown): ProviderQuotaPolicy | string => {
  if (!isRecord(value)) return "quota";
  const enabled = boolean(value.enabled, true);
  if (enabled === undefined) return "quota.enabled";
  if (!enabled) {
    return {
      enabled: false,
      endpoint: string(value.endpoint) ?? "",
      credentialRef: string(value.credentialRef) ?? "",
      timeoutMs: PROVIDER_QUOTA_DEFAULTS.timeoutMs,
      thresholdPercent: PROVIDER_QUOTA_DEFAULTS.thresholdPercent,
      maxSleepLoops: PROVIDER_QUOTA_DEFAULTS.maxSleepLoops,
      outageParkTtlSeconds: PROVIDER_QUOTA_DEFAULTS.outageParkTtlSeconds,
      credentialParkTtlSeconds: PROVIDER_QUOTA_DEFAULTS.credentialParkTtlSeconds,
      capParkTtlSeconds: PROVIDER_QUOTA_DEFAULTS.capParkTtlSeconds,
    };
  }
  const endpoint = string(value.endpoint);
  const credentialRef = string(value.credentialRef);
  if (endpoint === undefined) return "quota.endpoint";
  if (credentialRef === undefined) return "quota.credentialRef";
  const timeoutMs = integer(value.timeoutMs, PROVIDER_QUOTA_DEFAULTS.timeoutMs);
  const thresholdPercent = integer(
    value.thresholdPercent,
    PROVIDER_QUOTA_DEFAULTS.thresholdPercent,
  );
  const maxSleepLoops = integer(value.maxSleepLoops, PROVIDER_QUOTA_DEFAULTS.maxSleepLoops);
  const outageParkTtlSeconds = integer(
    value.outageParkTtlSeconds,
    PROVIDER_QUOTA_DEFAULTS.outageParkTtlSeconds,
  );
  const credentialParkTtlSeconds = integer(
    value.credentialParkTtlSeconds,
    PROVIDER_QUOTA_DEFAULTS.credentialParkTtlSeconds,
  );
  const capParkTtlSeconds = integer(
    value.capParkTtlSeconds,
    PROVIDER_QUOTA_DEFAULTS.capParkTtlSeconds,
  );
  if (timeoutMs === undefined || timeoutMs < 1) return "quota.timeoutMs";
  if (thresholdPercent === undefined || thresholdPercent < 0 || thresholdPercent > 100)
    return "quota.thresholdPercent";
  if (maxSleepLoops === undefined || maxSleepLoops < 1) return "quota.maxSleepLoops";
  if (outageParkTtlSeconds === undefined || outageParkTtlSeconds < 1)
    return "quota.outageParkTtlSeconds";
  if (credentialParkTtlSeconds === undefined || credentialParkTtlSeconds < 1)
    return "quota.credentialParkTtlSeconds";
  if (capParkTtlSeconds === undefined || capParkTtlSeconds < 1) return "quota.capParkTtlSeconds";
  return {
    enabled,
    endpoint,
    credentialRef,
    timeoutMs,
    thresholdPercent,
    maxSleepLoops,
    outageParkTtlSeconds,
    credentialParkTtlSeconds,
    capParkTtlSeconds,
  };
};

const endpointAllowed = (endpoint: string): boolean => {
  const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/.exec(endpoint);
  if (match === null) return false;
  const authority = match[1] ?? "";
  return authority.length > 0 && !authority.includes("@") && !/\s/.test(endpoint);
};

const parseEntry = (name: string, value: unknown): ProviderDescriptor | string => {
  if (!isRecord(value)) return `${name}`;
  const costClass = value.class;
  if (
    typeof costClass !== "string" ||
    !(PROVIDER_COST_CLASSES as readonly string[]).includes(costClass)
  )
    return `entries.${name}.class`;
  const enabled = boolean(value.enabled, true);
  if (enabled === undefined) return `entries.${name}.enabled`;
  const peak = value.peak === undefined ? undefined : parsePeak(value.peak);
  if (typeof peak === "string") return `entries.${name}.${peak}`;
  const quota = value.quota === undefined ? undefined : parseQuota(value.quota);
  if (typeof quota === "string") return `entries.${name}.${quota}`;
  return {
    name,
    class: costClass as ProviderDescriptor["class"],
    enabled,
    ...(peak === undefined ? {} : { peak }),
    ...(quota === undefined ? {} : { quota }),
  };
};

const parseCredential = (name: string, value: unknown): ProviderCredentialDeclaration | string => {
  if (!isRecord(value) || !isRecord(value.sourceKey)) return `credentials.${name}.sourceKey`;
  const style = value.sourceKey.style;
  if (style === "literal") {
    const keyName = string(value.sourceKey.name);
    if (keyName === undefined) return `credentials.${name}.sourceKey.name`;
    return { sourceKey: { style: "literal", name: keyName } };
  }
  if (style === "environment-prefixed") {
    const suffix = string(value.sourceKey.suffix);
    if (suffix === undefined) return `credentials.${name}.sourceKey.suffix`;
    return { sourceKey: { style: "environment-prefixed", suffix } };
  }
  return `credentials.${name}.sourceKey.style`;
};

const parseChain = (name: string, value: unknown): ProviderChain | string => {
  if (!isRecord(value)) return `chains.${name}`;
  const entries = value.entries;
  if (!Array.isArray(entries)) return `chains.${name}.entries`;
  const names: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== "string" || entry.length === 0) return `chains.${name}.entries`;
    names.push(entry);
  }
  const allowPaidFallback = boolean(value.allowPaidFallback, false);
  if (allowPaidFallback === undefined) return `chains.${name}.allowPaidFallback`;
  return { name, entries: names, allowPaidFallback };
};

/** Parse a resolved `provider` branch into typed configuration. */
export const parseProviderConfiguration = (values: unknown): ProviderConfigResult => {
  if (values === undefined || values === null) {
    return { ok: true, config: { credentials: {}, entries: {}, chains: {} } };
  }
  if (!isRecord(values)) return invalid("provider");
  const provider = values.provider;
  if (provider === undefined) {
    return { ok: true, config: { credentials: {}, entries: {}, chains: {} } };
  }
  if (!isRecord(provider)) return invalid("provider");
  const credentials: Record<string, ProviderCredentialDeclaration> = {};
  if (provider.credentials !== undefined) {
    if (!isRecord(provider.credentials)) return invalid("provider.credentials");
    for (const [name, value] of Object.entries(provider.credentials)) {
      const parsed = parseCredential(name, value);
      if (typeof parsed === "string") return invalid(parsed);
      credentials[name] = parsed;
    }
  }
  const entries: Record<string, ProviderDescriptor> = {};
  if (provider.entries !== undefined) {
    if (!isRecord(provider.entries)) return invalid("provider.entries");
    for (const [name, value] of Object.entries(provider.entries)) {
      const parsed = parseEntry(name, value);
      if (typeof parsed === "string") return invalid(parsed);
      entries[name] = parsed;
    }
  }
  const chains: Record<string, ProviderChain> = {};
  if (provider.chains !== undefined) {
    if (!isRecord(provider.chains)) return invalid("provider.chains");
    for (const [name, value] of Object.entries(provider.chains)) {
      const parsed = parseChain(name, value);
      if (typeof parsed === "string") return invalid(parsed);
      chains[name] = parsed;
    }
  }
  const defaultChain =
    provider.defaultChain === undefined ? undefined : string(provider.defaultChain);
  if (provider.defaultChain !== undefined && defaultChain === undefined)
    return invalid("provider.defaultChain");
  return {
    ok: true,
    config: {
      ...(defaultChain === undefined ? {} : { defaultChain }),
      credentials,
      entries,
      chains,
    },
  };
};

const checkEntryRelations = (
  chain: ProviderChain,
  entries: Readonly<Record<string, ProviderDescriptor>>,
): ProviderValidationError | undefined => {
  const seen = new Set<string>();
  let paidSeen = false;
  const offending: string[] = [];
  for (const name of chain.entries) {
    const descriptor = entries[name];
    if (descriptor === undefined) {
      return {
        code: "provider.chain.invalid",
        detail: `chain ${chain.name} references unknown provider ${name}`,
        chainName: chain.name,
        entries: [name],
      };
    }
    if (seen.has(name)) {
      return {
        code: "provider.chain.invalid",
        detail: `chain ${chain.name} lists provider ${name} more than once`,
        chainName: chain.name,
        entries: [name],
      };
    }
    seen.add(name);
    if (descriptor.class === "pay-per-token") paidSeen = true;
    else if (paidSeen) offending.push(name);
  }
  if (offending.length > 0) {
    return {
      code: "provider.chain.invalid",
      detail: `chain ${chain.name} places subscription entries after pay-per-token entries`,
      chainName: chain.name,
      entries: offending,
    };
  }
  return undefined;
};

const checkDescriptorRelations = (
  descriptor: ProviderDescriptor,
  credentials: Readonly<Record<string, ProviderCredentialDeclaration>>,
): ProviderValidationError | undefined => {
  const quota = descriptor.quota;
  if (quota === undefined) return undefined;
  // A disabled quota policy is inert: both endpoint and credential-reference
  // relational checks are skipped, so `quota.enabled: false` never fails with
  // the misleading "references unknown credential" detail (review R4).
  if (!quota.enabled) return undefined;
  if (credentials[quota.credentialRef] === undefined) {
    return {
      code: "provider.chain.invalid",
      detail: `provider ${descriptor.name} references unknown credential ${quota.credentialRef}`,
      entries: [descriptor.name],
    };
  }
  if (!endpointAllowed(quota.endpoint)) {
    return {
      code: "provider.chain.invalid",
      detail: `provider ${descriptor.name} quota endpoint must be HTTPS without userinfo`,
      entries: [descriptor.name],
    };
  }
  return undefined;
};

/** Validate every relational rule the schema cannot express (TC-PROV-002). */
export const validateProviderConfiguration = (
  config: ProviderConfiguration,
): ProviderValidationError | undefined => {
  for (const descriptor of Object.values(config.entries)) {
    const failure = checkDescriptorRelations(descriptor, config.credentials);
    if (failure !== undefined) return failure;
  }
  for (const chain of Object.values(config.chains)) {
    if (chain.entries.length === 0) {
      return {
        code: "provider.chain.empty",
        detail: `chain ${chain.name} has no entries`,
        chainName: chain.name,
      };
    }
    const failure = checkEntryRelations(chain, config.entries);
    if (failure !== undefined) return failure;
  }
  if (config.defaultChain !== undefined && config.chains[config.defaultChain] === undefined) {
    return {
      code: "provider.chain.invalid",
      detail: `default chain ${config.defaultChain} is not declared`,
      chainName: config.defaultChain,
    };
  }
  return undefined;
};

/** Validate then select the requested (or default) chain. */
export const selectProviderChain = (
  config: ProviderConfiguration,
  requested?: string,
): ProviderChainSelection => {
  const validation = validateProviderConfiguration(config);
  if (validation !== undefined) return { ok: false, error: validation };
  const name = requested ?? config.defaultChain;
  if (name === undefined) {
    return {
      ok: false,
      error: {
        code: "provider.chain.empty",
        detail: "--chain is required because no provider.defaultChain is declared",
      },
    };
  }
  const chain = config.chains[name];
  if (chain === undefined) {
    return {
      ok: false,
      error: {
        code: "provider.chain.empty",
        detail: `provider chain ${name} is not declared`,
        chainName: name,
      },
    };
  }
  if (chain.entries.length === 0) {
    return {
      ok: false,
      error: {
        code: "provider.chain.empty",
        detail: `provider chain ${name} has no entries`,
        chainName: name,
      },
    };
  }
  return { ok: true, chain };
};

/** A convenience wrapper for resolved `ConfigValue` trees. */
export const parseAndValidateProviderConfiguration = (
  values: ConfigValue | undefined,
): ProviderConfigResult => {
  const parsed = parseProviderConfiguration(values);
  if (!parsed.ok) return parsed;
  const failure = validateProviderConfiguration(parsed.config);
  return failure === undefined ? parsed : { ok: false, error: failure };
};

/* ------------------------------------------------------------------------- *
 * GH-234 — the typed `provider.profiles` branch (F-1, DM-1..DM-5).
 *
 * Pure: parsing and validation perform no credential resolution, probe, or
 * state write. Every failure is a classified configuration identity naming the
 * offending field, profile, tier, or chain entry; no partial decision escapes.
 * ------------------------------------------------------------------------- */

export type ProfileValidationErrorCode = "provider.profile.absent" | "provider.profile.invalid";

export type ProfileValidationError = {
  readonly code: ProfileValidationErrorCode;
  readonly detail: string;
  readonly field?: string;
};

export type ProfileConfigResult =
  | { readonly ok: true; readonly config: ProviderProfileConfiguration }
  | { readonly ok: false; readonly error: ProfileValidationError };

const profileInvalid = (detail: string, field?: string): ProfileConfigResult => ({
  ok: false,
  error: {
    code: "provider.profile.invalid",
    detail,
    ...(field === undefined ? {} : { field }),
  },
});

const exactKeys = (
  value: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  path: string,
): ProfileConfigResult | undefined => {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) return profileInvalid(`${path}.${key} is not declared`, path);
  }
  return undefined;
};

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const finitePercentage = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : undefined;

const positiveInteger = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;

const parseTier = (name: string, value: unknown): ProviderProfileTier | ProfileConfigResult => {
  if (name.length === 0) return profileInvalid("provider.profiles.tiers name is empty");
  if (!isRecord(value)) return profileInvalid(`tiers.${name} must be an object`, name);
  const extra = exactKeys(value, ["description"], `tiers.${name}`);
  if (extra !== undefined) return extra;
  const description =
    value.description === undefined ? undefined : nonEmptyString(value.description);
  if (value.description !== undefined && description === undefined) {
    return profileInvalid(`tiers.${name}.description must be a non-empty string`, `tiers.${name}`);
  }
  return { name, ...(description === undefined ? {} : { description }) };
};

const parseSeat = (name: string, value: unknown): ProviderProfileSeat | ProfileConfigResult => {
  if (!isRecord(value)) return profileInvalid(`seat ${name} must be an object`, name);
  const extra = exactKeys(
    value,
    ["model", "pacingClass", "capability", "envName"],
    `seats.${name}`,
  );
  if (extra !== undefined) return extra;
  const model = nonEmptyString(value.model);
  if (model === undefined) return profileInvalid(`seats.${name}.model is required`, name);
  const pacingClass = value.pacingClass;
  if (
    typeof pacingClass !== "string" ||
    !(PACING_CLASSES as readonly string[]).includes(pacingClass)
  ) {
    return profileInvalid(`seats.${name}.pacingClass must be judgment or execution`, name);
  }
  const capability = value.capability;
  if (
    typeof capability !== "string" ||
    !(PROFILE_CAPABILITIES as readonly string[]).includes(capability)
  ) {
    return profileInvalid(`seats.${name}.capability must be vision-capable or text-only`, name);
  }
  const envName = value.envName === undefined ? undefined : nonEmptyString(value.envName);
  if (value.envName !== undefined && envName === undefined) {
    return profileInvalid(`seats.${name}.envName must be a non-empty string`, name);
  }
  return {
    model,
    pacingClass: pacingClass as PacingClass,
    capability: capability as ProfileCapability,
    ...(envName === undefined ? {} : { envName }),
  };
};

const parseProfile = (name: string, value: unknown): ProviderProfile | ProfileConfigResult => {
  if (name.length === 0) return profileInvalid("provider.profiles.profiles name is empty");
  if (!isRecord(value)) return profileInvalid(`profiles.${name} must be an object`, name);
  const extra = exactKeys(
    value,
    ["tier", "providers", "seats", "agentOverrides"],
    `profiles.${name}`,
  );
  if (extra !== undefined) return extra;
  const tier = nonEmptyString(value.tier);
  if (tier === undefined) return profileInvalid(`profiles.${name}.tier is required`, name);
  if (!Array.isArray(value.providers)) {
    return profileInvalid(`profiles.${name}.providers must be a list`, name);
  }
  const providers: string[] = [];
  for (const providerName of value.providers) {
    if (typeof providerName !== "string" || providerName.length === 0) {
      return profileInvalid(`profiles.${name}.providers has an invalid entry`, name);
    }
    providers.push(providerName);
  }
  if (providers.length === 0) {
    return profileInvalid(`profiles.${name}.providers must not be empty`, name);
  }
  if (!isRecord(value.seats)) return profileInvalid(`profiles.${name}.seats is required`, name);
  const seats: Record<string, ProviderProfileSeat> = {};
  for (const [seatName, seatValue] of Object.entries(value.seats)) {
    const seat = parseSeat(seatName, seatValue);
    if ("ok" in seat) return seat;
    seats[seatName] = seat;
  }
  if (Object.keys(seats).length === 0) {
    return profileInvalid(`profiles.${name}.seats must not be empty`, name);
  }
  const agentOverrides: Record<string, string> = {};
  if (value.agentOverrides !== undefined) {
    if (!isRecord(value.agentOverrides)) {
      return profileInvalid(`profiles.${name}.agentOverrides must be a record`, name);
    }
    for (const [agent, seatName] of Object.entries(value.agentOverrides)) {
      if (typeof seatName !== "string" || seats[seatName] === undefined) {
        return profileInvalid(
          `profiles.${name}.agentOverrides.${agent} references unknown seat ${String(seatName)}`,
          name,
        );
      }
      agentOverrides[agent] = seatName;
    }
  }
  return { name, tier, providers, seats, agentOverrides };
};

const parsePreferenceChain = (value: unknown): ProviderPreferenceChain | ProfileConfigResult => {
  if (!isRecord(value))
    return profileInvalid("preferenceChain must be an object", "preferenceChain");
  const extra = exactKeys(value, ["base", "fallbacks"], "preferenceChain");
  if (extra !== undefined) return extra;
  const base = nonEmptyString(value.base);
  if (base === undefined)
    return profileInvalid("preferenceChain.base is required", "preferenceChain");
  const fallbacks: string[] = [];
  if (value.fallbacks !== undefined) {
    if (!Array.isArray(value.fallbacks)) {
      return profileInvalid("preferenceChain.fallbacks must be a list", "preferenceChain");
    }
    for (const entry of value.fallbacks) {
      if (typeof entry !== "string" || entry.length === 0) {
        return profileInvalid("preferenceChain.fallbacks has an invalid entry", "preferenceChain");
      }
      fallbacks.push(entry);
    }
  }
  const order = [base, ...fallbacks];
  if (new Set(order).size !== order.length) {
    return profileInvalid("preferenceChain contains a duplicate profile", "preferenceChain");
  }
  return { base, fallbacks, order };
};

const parseRung = (name: string, value: unknown): ProviderPacingRung | ProfileConfigResult => {
  if (name.length === 0) return profileInvalid("provider.profiles.pacing.rungs name is empty");
  if (!isRecord(value)) return profileInvalid(`pacing.rungs.${name} must be an object`, name);
  const extra = exactKeys(value, ["thresholdPercent", "executionModel"], `pacing.rungs.${name}`);
  if (extra !== undefined) return extra;
  const thresholdPercent = finitePercentage(value.thresholdPercent);
  if (thresholdPercent === undefined) {
    return profileInvalid(`pacing.rungs.${name}.thresholdPercent must be 0..100`, name);
  }
  const executionModel = nonEmptyString(value.executionModel);
  if (executionModel === undefined) {
    return profileInvalid(`pacing.rungs.${name}.executionModel is required`, name);
  }
  return { name, thresholdPercent, executionModel };
};

const parsePacing = (value: unknown): ProviderPacingConfiguration | ProfileConfigResult => {
  if (!isRecord(value)) return profileInvalid("pacing must be an object", "pacing");
  const extra = exactKeys(value, ["goalPriorities", "tailThresholdPercent", "rungs"], "pacing");
  if (extra !== undefined) return extra;
  const goalPriorities: PacingGoalPriority[] = [];
  if (value.goalPriorities !== undefined) {
    if (!Array.isArray(value.goalPriorities)) {
      return profileInvalid("pacing.goalPriorities must be a list", "pacing");
    }
    for (const entry of value.goalPriorities) {
      if (
        typeof entry !== "string" ||
        !(PACING_GOAL_PRIORITIES as readonly string[]).includes(entry)
      ) {
        return profileInvalid(
          `pacing.goalPriorities contains unknown priority ${String(entry)}`,
          "pacing",
        );
      }
      goalPriorities.push(entry as PacingGoalPriority);
    }
    if (new Set(goalPriorities).size !== goalPriorities.length) {
      return profileInvalid("pacing.goalPriorities contains a duplicate priority", "pacing");
    }
  }
  const tailThresholdPercent =
    value.tailThresholdPercent === undefined ? 100 : finitePercentage(value.tailThresholdPercent);
  if (tailThresholdPercent === undefined) {
    return profileInvalid("pacing.tailThresholdPercent must be 0..100", "pacing");
  }
  const rungs: Record<string, ProviderPacingRung> = {};
  if (value.rungs !== undefined) {
    if (!isRecord(value.rungs)) return profileInvalid("pacing.rungs must be a record", "pacing");
    for (const [name, rungValue] of Object.entries(value.rungs)) {
      const rung = parseRung(name, rungValue);
      if ("ok" in rung) return rung;
      rungs[name] = rung;
    }
  }
  return { goalPriorities, tailThresholdPercent, rungs };
};

const parseWatchTarget = (
  name: string,
  value: unknown,
): ProviderWatchTarget | ProfileConfigResult => {
  if (!isRecord(value)) return profileInvalid(`watch.${name} must be an object`, name);
  const extra = exactKeys(
    value,
    ["mapping", "endpoint", "credentialRef", "floor", "thresholdPercent"],
    `watch.${name}`,
  );
  if (extra !== undefined) return extra;
  const mapping = value.mapping;
  if (
    typeof mapping !== "string" ||
    !(PROVIDER_WATCH_MAPPING_KINDS as readonly string[]).includes(mapping)
  ) {
    return profileInvalid(`watch.${name}.mapping is not a declared mapping kind`, name);
  }
  const endpoint = nonEmptyString(value.endpoint);
  if (endpoint === undefined) return profileInvalid(`watch.${name}.endpoint is required`, name);
  if (!endpointAllowed(endpoint)) {
    return profileInvalid(`watch.${name}.endpoint must be HTTPS without userinfo`, name);
  }
  const credentialRef = nonEmptyString(value.credentialRef);
  if (credentialRef === undefined) {
    return profileInvalid(`watch.${name}.credentialRef is required`, name);
  }
  const floor = value.floor === undefined ? undefined : value.floor;
  if (floor !== undefined && (typeof floor !== "number" || !Number.isFinite(floor) || floor < 0)) {
    return profileInvalid(`watch.${name}.floor must be a non-negative number`, name);
  }
  const thresholdPercent =
    value.thresholdPercent === undefined ? undefined : finitePercentage(value.thresholdPercent);
  if (value.thresholdPercent !== undefined && thresholdPercent === undefined) {
    return profileInvalid(`watch.${name}.thresholdPercent must be 0..100`, name);
  }
  return {
    mapping: mapping as ProviderWatchMappingKind,
    endpoint,
    credentialRef,
    ...(floor === undefined ? {} : { floor }),
    ...(thresholdPercent === undefined ? {} : { thresholdPercent }),
  };
};

const parseEnvRecordPolicy = (value: unknown): ProviderEnvRecordPolicy | ProfileConfigResult => {
  if (!isRecord(value)) return profileInvalid("envRecord must be an object", "envRecord");
  const extra = exactKeys(
    value,
    ["header", "namePattern", "maxBytes", "maxLineBytes", "maxRecords"],
    "envRecord",
  );
  if (extra !== undefined) return extra;
  const header = value.header === undefined ? undefined : nonEmptyString(value.header);
  if (value.header !== undefined && header === undefined) {
    return profileInvalid("envRecord.header must be a non-empty string", "envRecord");
  }
  const namePattern =
    value.namePattern === undefined ? undefined : nonEmptyString(value.namePattern);
  if (value.namePattern !== undefined && namePattern === undefined) {
    return profileInvalid("envRecord.namePattern must be a non-empty string", "envRecord");
  }
  if (namePattern !== undefined) {
    try {
      new RegExp(namePattern);
    } catch {
      return profileInvalid("envRecord.namePattern is not a valid regular expression", "envRecord");
    }
  }
  const positive = (field: "maxBytes" | "maxLineBytes" | "maxRecords"): number | undefined => {
    const raw = value[field];
    return raw === undefined ? undefined : positiveInteger(raw);
  };
  const maxBytes = positive("maxBytes");
  const maxLineBytes = positive("maxLineBytes");
  const maxRecords = positive("maxRecords");
  if (value.maxBytes !== undefined && maxBytes === undefined) {
    return profileInvalid("envRecord.maxBytes must be a positive integer", "envRecord");
  }
  if (value.maxLineBytes !== undefined && maxLineBytes === undefined) {
    return profileInvalid("envRecord.maxLineBytes must be a positive integer", "envRecord");
  }
  if (value.maxRecords !== undefined && maxRecords === undefined) {
    return profileInvalid("envRecord.maxRecords must be a positive integer", "envRecord");
  }
  return {
    ...(header === undefined ? {} : { header }),
    ...(namePattern === undefined ? {} : { namePattern }),
    ...(maxBytes === undefined ? {} : { maxBytes }),
    ...(maxLineBytes === undefined ? {} : { maxLineBytes }),
    ...(maxRecords === undefined ? {} : { maxRecords }),
  };
};

/**
 * Parse the resolved `provider.profiles` branch. Unknown keys, malformed
 * shapes, and closed-set violations fail closed; the empty branch parses to an
 * empty configuration and is refused later by `validateProfileConfiguration`.
 */
export const parseProfileConfiguration = (values: unknown): ProfileConfigResult => {
  const empty: ProviderProfileConfiguration = {
    tiers: {},
    profiles: {},
  };
  const branch =
    isRecord(values) && isRecord(values.provider) ? values.provider.profiles : undefined;
  if (branch === undefined || branch === null) return { ok: true, config: empty };
  if (!isRecord(branch)) return profileInvalid("provider.profiles must be an object", "profiles");
  const extra = exactKeys(
    branch,
    ["tiers", "profiles", "preferenceChain", "pacing", "watch", "envRecord"],
    "profiles",
  );
  if (extra !== undefined) return extra;

  const tiers: Record<string, ProviderProfileTier> = {};
  if (branch.tiers !== undefined) {
    if (!isRecord(branch.tiers)) return profileInvalid("profiles.tiers must be a record", "tiers");
    for (const [name, tierValue] of Object.entries(branch.tiers)) {
      const tier = parseTier(name, tierValue);
      if ("ok" in tier) return tier;
      tiers[name] = tier;
    }
  }
  const profiles: Record<string, ProviderProfile> = {};
  if (branch.profiles !== undefined) {
    if (!isRecord(branch.profiles)) {
      return profileInvalid("profiles.profiles must be a record", "profiles");
    }
    for (const [name, profileValue] of Object.entries(branch.profiles)) {
      const profile = parseProfile(name, profileValue);
      if ("ok" in profile) return profile;
      profiles[name] = profile;
    }
  }
  const preferenceChain =
    branch.preferenceChain === undefined ? undefined : parsePreferenceChain(branch.preferenceChain);
  if (preferenceChain !== undefined && "ok" in preferenceChain) return preferenceChain;
  const pacing = branch.pacing === undefined ? undefined : parsePacing(branch.pacing);
  if (pacing !== undefined && "ok" in pacing) return pacing;
  const watch: Record<string, ProviderWatchTarget> = {};
  if (branch.watch !== undefined) {
    if (!isRecord(branch.watch)) return profileInvalid("profiles.watch must be a record", "watch");
    for (const [name, targetValue] of Object.entries(branch.watch)) {
      const target = parseWatchTarget(name, targetValue);
      if ("ok" in target) return target;
      watch[name] = target;
    }
  }
  const envRecord =
    branch.envRecord === undefined ? undefined : parseEnvRecordPolicy(branch.envRecord);
  if (envRecord !== undefined && "ok" in envRecord) return envRecord;
  return {
    ok: true,
    config: {
      tiers,
      profiles,
      ...(preferenceChain === undefined ? {} : { preferenceChain }),
      ...(pacing === undefined ? {} : { pacing }),
      ...(Object.keys(watch).length === 0 ? {} : { watch }),
      ...(envRecord === undefined ? {} : { envRecord }),
    },
  };
};

/**
 * Validate the relational rules the schema cannot express (F-1, DM-4, DM-5):
 * unknown references, duplicate names, an empty or ordering-violating chain,
 * and watch credential references. Pure; no I/O.
 */
export const validateProfileConfiguration = (
  config: ProviderProfileConfiguration,
  providers: ProviderConfiguration,
): ProfileValidationError | undefined => {
  const absent = Object.keys(config.profiles).length === 0 && config.preferenceChain === undefined;
  if (absent) {
    return {
      code: "provider.profile.absent",
      detail: "no provider profile or preference chain is declared",
      field: "provider.profiles",
    };
  }
  for (const [name, profile] of Object.entries(config.profiles)) {
    if (config.tiers[profile.tier] === undefined) {
      return {
        code: "provider.profile.invalid",
        detail: `profile ${name} references unknown tier ${profile.tier}`,
        field: `profiles.${name}.tier`,
      };
    }
    for (const providerName of profile.providers) {
      if (providers.entries[providerName] === undefined) {
        return {
          code: "provider.profile.invalid",
          detail: `profile ${name} references unknown provider ${providerName}`,
          field: `profiles.${name}.providers`,
        };
      }
    }
  }
  const chain = config.preferenceChain;
  if (chain === undefined) {
    return {
      code: "provider.profile.absent",
      detail: "no provider preference chain is declared",
      field: "provider.profiles.preferenceChain",
    };
  }
  for (const name of chain.order) {
    if (config.profiles[name] === undefined) {
      return {
        code: "provider.profile.invalid",
        detail: `preference chain references unknown profile ${name}`,
        field: "preferenceChain",
      };
    }
  }
  if (config.pacing !== undefined) {
    for (const rungName of Object.keys(config.pacing.rungs)) {
      if (rungName.length === 0) {
        return {
          code: "provider.profile.invalid",
          detail: "pacing rung name is empty",
          field: "pacing.rungs",
        };
      }
    }
  }
  for (const [name, target] of Object.entries(config.watch ?? {})) {
    if (providers.entries[name] === undefined) {
      return {
        code: "provider.profile.invalid",
        detail: `watch target ${name} does not name a declared provider`,
        field: `watch.${name}`,
      };
    }
    if (providers.credentials[target.credentialRef] === undefined) {
      return {
        code: "provider.profile.invalid",
        detail: `watch target ${name} references unknown credential ${target.credentialRef}`,
        field: `watch.${name}.credentialRef`,
      };
    }
  }
  return undefined;
};

/** Parse then validate the profile branch against the provider branch. */
export const parseAndValidateProfileConfiguration = (
  values: unknown,
  providers: ProviderConfiguration,
): ProfileConfigResult => {
  const parsed = parseProfileConfiguration(values);
  if (!parsed.ok) return parsed;
  const failure = validateProfileConfiguration(parsed.config, providers);
  return failure === undefined ? parsed : { ok: false, error: failure };
};

/** Classify the shipped-empty profile branch (DEC-9) without inventing a model. */
export const emptyProfileConfiguration = (): ProviderProfileConfiguration => ({
  tiers: {},
  profiles: {},
});
