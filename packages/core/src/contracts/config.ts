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
export const PRIOR_IDENTITY_NOTICE_TOKEN = "prior-identity-fallback";
export const PRIOR_IDENTITY_NOTICE_REASONS = [
  "config-read",
  "config-skipped",
  "state-read",
  "state-skipped",
] as const;
export type PriorIdentityNoticeReason = (typeof PRIOR_IDENTITY_NOTICE_REASONS)[number];

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
          : `the current host root at ${notice.currentLocation} is in effect; the prior ` +
            `identity host root at ${notice.priorLocation} was not used`;
  return `${PRIOR_IDENTITY_NOTICE_TOKEN}: ${notice.reason} ${detail} (${NO_MOVE_STATEMENT})`;
};
