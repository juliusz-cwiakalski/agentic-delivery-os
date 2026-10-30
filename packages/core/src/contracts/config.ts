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
    }
  | { readonly ok: false; readonly error: ConfigFailure };
/** All runtime facts are supplied by the caller; core never invokes this port itself. */
export type ConfigSource<TFacts> = (
  facts: TFacts,
) => ConfigAcquisition | Promise<ConfigAcquisition>;
