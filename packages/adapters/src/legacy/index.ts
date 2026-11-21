/**
 * `@delivery-os/adapters/legacy` — legacy compatibility adapter.
 *
 * Maps the pre-freeze environment prefix and config directory to the current
 * names it receives as parameters. It imports no workspace package (branding is
 * never imported) and emits exactly one warning per process when a legacy source
 * is read. Diagnostic text names the legacy source kind and the current name
 * only — never environment values.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

export {
  PROVIDER_LEGACY_MIGRATION_TABLE,
  type ProviderLegacyMigrationAgentModelRule,
  type ProviderLegacyMigrationFlagRule,
  type ProviderLegacyMigrationTable,
} from "./provider-migrate-table.js";

/** Current names supplied by the runtime-aware edge (never derived here). */
export type LegacyCurrentNames = {
  readonly environmentPrefix: string;
  readonly configDirectoryName: string;
};

/** Injected inputs for one legacy read. */
export type LegacyResolveInput = {
  readonly facts: Record<string, string>;
  readonly homeDirectory: string;
};

/** Mapped current names and the detected legacy-source state. */
export type LegacyResolveResult = {
  readonly environment: Record<string, string>;
  readonly configDirectoryPath: string;
  readonly legacySourcesPresent: boolean;
};

export type LegacyCompatOptions = {
  readonly current: LegacyCurrentNames;
  readonly warn: (message: string) => void;
  /**
   * The declared current-prefix environment names (the catalog key set). When
   * supplied, `ADOS_<suffix>` maps only if `<prefix><suffix>` is declared; an
   * undeclared name is inert (not an error, not a value, not a notice).
   * `ADOS_WORKING_NAME` is never mapped here: it is read at the raw
   * entrypoint/edge seam (GH-365 DEC-9).
   */
  readonly catalogEnvironmentNames?: ReadonlySet<string>;
};

export type LegacyConfigInput = LegacyResolveInput & {
  /** Current-name environment facts; these always win over legacy mappings. */
  readonly environment: Readonly<Record<string, string | undefined>>;
  /** A current-name selector, if one was supplied explicitly. */
  readonly selectedConfig?: string;
};

/** Plain config facts produced before catalog-aware environment mapping. */
export type LegacyConfigFacts = {
  readonly environment: Record<string, string | undefined>;
  readonly selectedConfig?: string;
  readonly configDirectoryPath: string;
  readonly legacySourcesPresent: boolean;
};

export type LegacyCompat = {
  resolveLegacy(input: LegacyResolveInput): LegacyResolveResult;
  /** Maps legacy inputs to plain facts; not an eighth configuration layer. */
  resolveConfigFacts(input: LegacyConfigInput): LegacyConfigFacts;
};

const LEGACY_ENV_PREFIX = "ADOS_";
const LEGACY_CONFIG_DIRECTORY = ".ados";

type WarningState = { warned: boolean };

const isOwn = (facts: Record<string, string>, key: string): boolean => Object.hasOwn(facts, key);

const mapLegacy = (
  state: WarningState,
  warn: (message: string) => void,
  current: LegacyCurrentNames,
  input: LegacyResolveInput,
  catalogEnvironmentNames: ReadonlySet<string> | undefined,
): LegacyResolveResult => {
  const environment: Record<string, string> = {};
  let legacyEnvironmentPresent = false;
  for (const key of Object.keys(input.facts)) {
    if (!key.startsWith(LEGACY_ENV_PREFIX) || !isOwn(input.facts, key)) continue;
    const value = input.facts[key];
    if (value === undefined) continue;
    const suffix = key.slice(LEGACY_ENV_PREFIX.length);
    if (suffix === "WORKING_NAME") continue;
    const mappedName = `${current.environmentPrefix}${suffix}`;
    if (catalogEnvironmentNames !== undefined && !catalogEnvironmentNames.has(mappedName)) continue;
    environment[mappedName] = value;
    legacyEnvironmentPresent = true;
  }

  const legacyConfigPresent = existsSync(join(input.homeDirectory, LEGACY_CONFIG_DIRECTORY));

  if ((legacyEnvironmentPresent || legacyConfigPresent) && !state.warned) {
    state.warned = true;
    const parts: string[] = [];
    if (legacyEnvironmentPresent) {
      parts.push(
        `legacy environment variables with prefix ${LEGACY_ENV_PREFIX} map to ${current.environmentPrefix} names`,
      );
    }
    if (legacyConfigPresent) {
      parts.push(
        `the legacy config directory ${LEGACY_CONFIG_DIRECTORY} maps to ${current.configDirectoryName}`,
      );
    }
    warn(`legacy compatibility: ${parts.join("; ")}`);
  }

  return {
    environment,
    configDirectoryPath: join(input.homeDirectory, current.configDirectoryName),
    legacySourcesPresent: legacyEnvironmentPresent || legacyConfigPresent,
  };
};

/** Factory for an isolated instance with its own once-warning state. */
export const createLegacyCompat = (options: LegacyCompatOptions): LegacyCompat => {
  const state: WarningState = { warned: false };
  const configFacts = (input: LegacyConfigInput): LegacyConfigFacts => {
    const mapped = mapLegacy(
      state,
      options.warn,
      options.current,
      input,
      options.catalogEnvironmentNames,
    );
    const environment: Record<string, string | undefined> = {
      ...input.environment,
      ...mapped.environment,
    };
    // Current-name facts always win over their legacy counterparts.
    for (const [key, value] of Object.entries(input.environment)) {
      if (value !== undefined) environment[key] = value;
    }
    const selectorName = `${options.current.environmentPrefix}CONFIG`;
    const selectedConfig =
      input.selectedConfig ?? input.environment[selectorName] ?? mapped.environment[selectorName];
    return {
      environment,
      ...(selectedConfig !== undefined && selectedConfig.length > 0 ? { selectedConfig } : {}),
      configDirectoryPath: mapped.configDirectoryPath,
      legacySourcesPresent: mapped.legacySourcesPresent,
    };
  };
  return {
    resolveLegacy: (input) =>
      mapLegacy(state, options.warn, options.current, input, options.catalogEnvironmentNames),
    resolveConfigFacts: configFacts,
  };
};

const processState: WarningState = { warned: false };

/** Default process-scoped instance; the warning sink is the console. */
export const resolveProcessLegacy = (
  input: LegacyResolveInput & { readonly current: LegacyCurrentNames },
): LegacyResolveResult =>
  mapLegacy(processState, (message) => console.warn(message), input.current, input, undefined);

const processEnvironmentFacts = (): Record<string, string> => {
  const facts: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) facts[key] = value;
  }
  return facts;
};

/** Production I/O wrapper: reads the real process environment, then maps. */
export const resolveProcessLegacyFromEnvironment = (input: {
  readonly current: LegacyCurrentNames;
  readonly homeDirectory: string;
}): LegacyResolveResult =>
  resolveProcessLegacy({
    current: input.current,
    homeDirectory: input.homeDirectory,
    facts: processEnvironmentFacts(),
  });
