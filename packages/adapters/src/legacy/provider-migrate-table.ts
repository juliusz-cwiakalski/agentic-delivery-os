/**
 * The legacy provider-policy mapping table (GH-350 F-6, Appendix E; TDR-0060 D3).
 *
 * This is the one declared home for the pre-freeze provider variable names and
 * the targets they map to. It lives in the legacy compatibility subpath because
 * the delivered forbidden-literal guard admits pre-freeze tokens only here; the
 * pure provider module owns the grammar, the firewall, and the mapper and
 * receives this table as an injected value, so no vendor literal enters the
 * provider tier.
 *
 * Every row is literal-to-literal except the two declared derivations: the
 * per-agent model address (the declared profile literal plus the lowercased
 * agent token) and the credential reference name (derived in the provider
 * module from the credential-shaped variable name). `unmapped` is a disclosure,
 * never a refusal, and no value of any credential-shaped name is represented.
 */

export type ProviderLegacyMigrationFlagRule = {
  readonly path: readonly string[];
  /** The accepted literal spellings and the boolean each one declares. */
  readonly values: Readonly<Record<string, boolean>>;
};

export type ProviderLegacyMigrationAgentModelRule = {
  readonly pattern: string;
  readonly profileVariable: string;
  readonly targetPrefix: readonly string[];
  readonly agentBefore: readonly string[];
  readonly agentAfter: readonly string[];
};

export type ProviderLegacyMigrationTable = {
  readonly strings: Readonly<Record<string, readonly string[]>>;
  readonly integers: Readonly<Record<string, readonly string[]>>;
  readonly flags: Readonly<Record<string, ProviderLegacyMigrationFlagRule>>;
  readonly unmapped: readonly string[];
  readonly agentModel?: ProviderLegacyMigrationAgentModelRule;
};

/** The closed legacy→policy mapping (Appendix E). */
export const PROVIDER_LEGACY_MIGRATION_TABLE: ProviderLegacyMigrationTable = {
  strings: {
    OC_ADOS_MODEL_PROFILE: ["profiles", "preferenceChain", "base"],
  },
  integers: {
    ADOS_ZAI_PEAK_START_UTC: ["entries", "zai-coding-plan", "peak", "startSecondsOfDay"],
    ADOS_ZAI_PEAK_END_UTC: ["entries", "zai-coding-plan", "peak", "endSecondsOfDay"],
    ADOS_ZAI_BUFFER_SECONDS: ["entries", "zai-coding-plan", "peak", "bufferSeconds"],
    ADOS_ZAI_MAX_SLEEP_LOOPS: ["entries", "zai-coding-plan", "quota", "maxSleepLoops"],
  },
  flags: {
    ADOS_ZAI_QUOTA_DISABLED: {
      path: ["entries", "zai-coding-plan", "quota", "enabled"],
      // The variable means "quota disabled": 1 disables the policy, 0 enables it.
      values: { "1": false, "0": true },
    },
  },
  unmapped: ["ADOS_ZAI_CONDITIONS", "ADOS_HOOK_AGENT", "ADOS_HOOK_ENV_V1"],
  agentModel: {
    pattern: "^OC_ADOS_AGENT_([A-Za-z0-9_]+)_MODEL$",
    profileVariable: "OC_ADOS_MODEL_PROFILE",
    targetPrefix: ["profiles", "profiles"],
    agentBefore: ["seats"],
    agentAfter: ["model"],
  },
};
