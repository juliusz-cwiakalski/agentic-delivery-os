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
};

export type LegacyCompat = {
  resolveLegacy(input: LegacyResolveInput): LegacyResolveResult;
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
): LegacyResolveResult => {
  const environment: Record<string, string> = {};
  let legacyEnvironmentPresent = false;
  for (const key of Object.keys(input.facts)) {
    if (!key.startsWith(LEGACY_ENV_PREFIX) || !isOwn(input.facts, key)) continue;
    const value = input.facts[key];
    if (value === undefined) continue;
    environment[`${current.environmentPrefix}${key.slice(LEGACY_ENV_PREFIX.length)}`] = value;
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
  return {
    resolveLegacy: (input) => mapLegacy(state, options.warn, options.current, input),
  };
};

const processState: WarningState = { warned: false };

/** Default process-scoped instance; the warning sink is the console. */
export const resolveProcessLegacy = (
  input: LegacyResolveInput & { readonly current: LegacyCurrentNames },
): LegacyResolveResult =>
  mapLegacy(processState, (message) => console.warn(message), input.current, input);

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
