/**
 * Provider configuration parsing and semantic validation (GH-182 F-1, F-2).
 *
 * Pure: consumes already-resolved configuration values and returns typed data or
 * a classified failure. No credential resolution, quota fetch, or state write
 * occurs here (TC-PROV-002 step 4).
 */
import {
  type ConfigValue,
  PROVIDER_COST_CLASSES,
  PROVIDER_QUOTA_DEFAULTS,
  type ProviderChain,
  type ProviderConfiguration,
  type ProviderCredentialDeclaration,
  type ProviderDescriptor,
  type ProviderErrorCode,
  type ProviderPeakWindow,
  type ProviderQuotaPolicy,
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
