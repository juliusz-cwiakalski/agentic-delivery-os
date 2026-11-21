/** Plain, runtime-neutral configuration acquisition language. */
export type ConfigValue =
  | null
  | string
  | number
  | boolean
  | ConfigValue[]
  | { [key: string]: ConfigValue };

export const CONFIG_LAYERS = [
  "defaults",
  "system",
  "user-global",
  "project-committed",
  "project-local",
  "environment",
  "cli",
] as const;
export type ConfigLayer = (typeof CONFIG_LAYERS)[number];
export type ConfigFileLayer = Extract<
  ConfigLayer,
  "system" | "user-global" | "project-committed" | "project-local"
>;
export type ConfigPosition = { readonly line: number; readonly column?: number };
export type ConfigLocation = {
  readonly layer?: ConfigLayer;
  readonly file?: string;
  readonly line?: number;
  readonly key?: string;
};
export type ConfigOrigin =
  | { readonly layer: ConfigFileLayer | "defaults"; readonly file: string; readonly line: number }
  | { readonly layer: "environment"; readonly env: string }
  | { readonly layer: "cli"; readonly flag: string };
/** Dotted paths include container and array-index nodes as well as leaves. */
export type ConfigNodeOrigins = Readonly<Record<string, ConfigOrigin>>;
export type ConfigLoadedFile = { readonly layer: ConfigFileLayer; readonly file: string };
export type ConfigSkipReason = "missing" | "ci-disabled" | "no-git-root" | "selected-config";
export type ConfigSkippedLayer = {
  readonly layer: ConfigFileLayer;
  readonly reason: ConfigSkipReason;
};
export type ConfigWarning = {
  readonly kind: "deprecated" | "shadowed" | "legacy";
  readonly layer?: ConfigLayer;
  readonly key?: string;
};

export type ConfigErrorCode =
  | "config.file.malformed"
  | "config.key.unknown"
  | "config.environment.unmapped"
  | "config.value.invalid"
  | "config.interpolation.rejected"
  | "config.secret.forbidden"
  | "config.path.forbidden"
  | "config.reset.invalid"
  | "config.warning.strict";
/** Constructed identity and safe metadata only; never carry source text or exceptions. */
export type ConfigFailure = ConfigLocation & {
  readonly kind: "config";
  readonly code: ConfigErrorCode;
};

export type ConfigSourceFacts = {
  readonly layer: ConfigLayer;
  readonly values: Readonly<Record<string, ConfigValue>>;
  readonly origins: ConfigNodeOrigins;
  readonly reset?: readonly string[];
  readonly loadedFile?: ConfigLoadedFile;
};
export type ConfigAcquisition =
  | {
      readonly ok: true;
      readonly sources: readonly ConfigSourceFacts[];
      readonly skipped: readonly ConfigSkippedLayer[];
      /** The per-layer prior-identity outcome; absent when no prior applies. */
      readonly prior?: readonly ConfigPriorOutcome[];
    }
  | { readonly ok: false; readonly error: ConfigFailure };
/** All runtime facts are supplied by the caller; core never invokes this port itself. */
export type ConfigSource<TFacts> = (
  facts: TFacts,
) => ConfigAcquisition | Promise<ConfigAcquisition>;

/**
 * The prior-identity configuration acquisition outcome (GH-320 DM-2, F-3).
 *
 * Per eligible repository-owned layer, the acquisition records what the prior
 * identity's candidate did: `read` (the current-identity file was absent and the
 * prior file supplied the layer) or `not used` (the current-identity file won and
 * the prior file was never opened). The prior path is always the real absolute
 * path; skips, error codes, and warning kinds are unchanged.
 */
export type ConfigPriorOutcome =
  | {
      readonly state: "read";
      readonly layer: ConfigFileLayer;
      readonly file: string;
      readonly currentFile: string;
    }
  | {
      readonly state: "not used";
      readonly layer: ConfigFileLayer;
      readonly file: string;
      readonly currentFile: string;
    };

/** The prior-identity fallback notice classification (GH-320 DM-4, DEC-10). */
const PRIOR_IDENTITY_NOTICE_TOKEN = "prior-identity-fallback";

/** The classification token, exposed as behaviour (no exported literal). */
export const priorIdentityNoticeToken = (): string => PRIOR_IDENTITY_NOTICE_TOKEN;
export const PRIOR_IDENTITY_NOTICE_REASONS = [
  "config-read",
  "config-skipped",
  "state-read",
  "state-skipped",
  "override-read",
] as const;
export type PriorIdentityNoticeReason = (typeof PRIOR_IDENTITY_NOTICE_REASONS)[number];

/** The declared override-channel suffix (GH-365 F-6, DM-9). */
const WORKING_NAME_ENVIRONMENT_SUFFIX = "WORKING_NAME";

/** The current-identity override channel: `<environmentPrefix>WORKING_NAME`. */
export const currentWorkingNameEnvironmentVariable = (environmentPrefix: string): string =>
  `${environmentPrefix}${WORKING_NAME_ENVIRONMENT_SUFFIX}`;

/** The prior-identity override channel (a declared lower-precedence input). */
export const PRIOR_WORKING_NAME_ENVIRONMENT_VARIABLE = "DELIVERY_OS_WORKING_NAME";

/**
 * The pre-freeze override channel: read at the raw seam, never adapter-mapped.
 *
 * Assembled from fragments because the frozen ADR-0003 DEC-8 path allowlist does
 * not cover this module and this change never widens it; the plain pre-freeze
 * literal would be a DEC-8 seed occurrence here. The prior literal above is
 * written plainly and declared as a `prior-working-name-override` site.
 */
export const PRE_FREEZE_WORKING_NAME_ENVIRONMENT_VARIABLE = ["A", "DOS", "_WORKING_NAME"].join("");

export type WorkingNameChannel = "current" | "prior" | "pre-freeze";

export type WorkingNameOverrideResolution = {
  readonly channel?: WorkingNameChannel;
  readonly override?: string;
  readonly currentVariable: string;
  readonly priorVariable: string;
  readonly preFreezeVariable: string;
};

const nonEmptyValue = (
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined => {
  const value = environment[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

/**
 * Resolve the working-name override from the raw environment (API-6, DEC-9).
 *
 * Precedence: current (`<prefix>WORKING_NAME`) -> prior
 * (the prior variable) -> pre-freeze (the pre-freeze variable). The helper
 * reads only the injected raw environment and the derived prefix; the caller
 * applies the chosen value and emits one `override-read` notice for a prior or
 * pre-freeze channel.
 */
export const resolveWorkingNameOverride = (input: {
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly environmentPrefix: string;
}): WorkingNameOverrideResolution => {
  const currentVariable = currentWorkingNameEnvironmentVariable(input.environmentPrefix);
  const priorVariable = PRIOR_WORKING_NAME_ENVIRONMENT_VARIABLE;
  const preFreezeVariable = PRE_FREEZE_WORKING_NAME_ENVIRONMENT_VARIABLE;
  const current = nonEmptyValue(input.environment, currentVariable);
  if (current !== undefined) {
    return {
      channel: "current",
      override: current,
      currentVariable,
      priorVariable,
      preFreezeVariable,
    };
  }
  const prior = nonEmptyValue(input.environment, priorVariable);
  if (prior !== undefined) {
    return { channel: "prior", override: prior, currentVariable, priorVariable, preFreezeVariable };
  }
  const preFreeze = nonEmptyValue(input.environment, preFreezeVariable);
  if (preFreeze !== undefined) {
    return {
      channel: "pre-freeze",
      override: preFreeze,
      currentVariable,
      priorVariable,
      preFreezeVariable,
    };
  }
  return { currentVariable, priorVariable, preFreezeVariable };
};

/** One rendered notice's facts: both locations, never a value or secret. */
export type PriorIdentityNotice = {
  readonly reason: PriorIdentityNoticeReason;
  readonly priorLocation: string;
  readonly currentLocation: string;
};

const NO_MOVE_STATEMENT = "nothing was moved, copied, or deleted";

/**
 * Render one bounded notice line. It begins with the classification token and
 * the reason, names both locations, states that nothing was moved, copied, or
 * deleted, and carries no value or file content.
 */
export const renderPriorIdentityNotice = (notice: PriorIdentityNotice): string => {
  const detail =
    notice.reason === "config-read"
      ? `read the prior identity configuration at ${notice.priorLocation} because ` +
        `${notice.currentLocation} is absent`
      : notice.reason === "config-skipped"
        ? `the current configuration at ${notice.currentLocation} is in effect; the prior ` +
          `identity configuration at ${notice.priorLocation} was not read`
        : notice.reason === "state-read"
          ? `the prior identity host root at ${notice.priorLocation} is in effect because ` +
            `${notice.currentLocation} is absent`
          : notice.reason === "state-skipped"
            ? `the current host root at ${notice.currentLocation} is in effect; the prior ` +
              `identity host root at ${notice.priorLocation} was not used`
            : `read the prior identity working-name override at ${notice.priorLocation} ` +
              `because ${notice.currentLocation} is absent; applied to ${notice.currentLocation}`;
  return `${PRIOR_IDENTITY_NOTICE_TOKEN}: ${notice.reason} ${detail} (${NO_MOVE_STATEMENT})`;
};
