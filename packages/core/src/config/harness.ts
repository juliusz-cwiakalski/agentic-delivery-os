/**
 * The typed harness configuration resolution (GH-233 F-6, DM-3, DEC-8).
 *
 * Pure over already-resolved configuration values and origins. Declaring
 * nothing resolves to the shipped defaults (opencode, host execution). Invalid
 * values classify with the configuration path and origin; an allowlist entry
 * carrying a literal value is rejected by the existing secret-forbidden
 * identity, never accepted as configuration.
 */
import {
  type ConfigFailure,
  type ConfigNodeOrigins,
  type ConfigOrigin,
  type ConfigValue,
  HARNESS_EXECUTION_KINDS,
  HARNESS_KINDS,
  type HarnessExecutionKind,
  type HarnessKind,
  type Result,
} from "#contracts";

/**
 * One declared allowlist entry: a variable name (optionally optional) or a
 * credential reference. The optional marker is variable-only.
 */
export type HarnessEnvironmentSetting =
  | { readonly name: string; readonly optional?: boolean }
  | { readonly name: string; readonly credentialRef: string };

/** The resolved harness branch. */
export type HarnessSettings = {
  readonly kind: HarnessKind;
  readonly executionKind: HarnessExecutionKind;
  readonly opencodeDatabasePath: string;
  readonly claudeCodeSessionDirectory: string;
  readonly environment: readonly HarnessEnvironmentSetting[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const originOf = (origins: ConfigNodeOrigins, path: string): Partial<ConfigFailure> => {
  const origin: ConfigOrigin | undefined = origins[path];
  if (origin === undefined) return { key: path };
  if (origin.layer === "environment" || origin.layer === "cli") {
    return { key: path, layer: origin.layer };
  }
  return { key: path, layer: origin.layer, file: origin.file, line: origin.line };
};

const failure = (
  code: ConfigFailure["code"],
  origins: ConfigNodeOrigins,
  path: string,
): Result<never, ConfigFailure> => ({
  ok: false,
  error: { kind: "config", code, ...originOf(origins, path) },
});

const lookup = (
  values: Readonly<Record<string, ConfigValue>>,
  path: readonly string[],
): unknown => {
  let current: unknown = values;
  for (const segment of path) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
};

const validPath = (value: string): boolean => value.length > 0 && !value.includes("\u0000");

/**
 * Validate the resolved `harness` branch and project it into typed settings.
 *
 * The schema has already rejected wrong types and unknown keys; this function
 * enforces the closed vocabularies and the allowlist's name/reference-only
 * rule, naming the offending configuration path.
 */
export const resolveHarnessSettings = (
  values: Readonly<Record<string, ConfigValue>>,
  origins: ConfigNodeOrigins = {},
): Result<HarnessSettings, ConfigFailure> => {
  const branch = lookup(values, ["harness"]);
  if (!isRecord(branch)) return failure("config.value.invalid", origins, "harness");

  const kind = lookup(values, ["harness", "kind"]);
  if (typeof kind !== "string" || !(HARNESS_KINDS as readonly string[]).includes(kind)) {
    return failure("config.value.invalid", origins, "harness.kind");
  }
  const executionKind = lookup(values, ["harness", "execution", "kind"]);
  if (
    typeof executionKind !== "string" ||
    !(HARNESS_EXECUTION_KINDS as readonly string[]).includes(executionKind)
  ) {
    return failure("config.value.invalid", origins, "harness.execution.kind");
  }

  const storePaths: Array<[string, string]> = [
    ["opencode", "harness.stores.opencode.databasePath"],
    ["claude-code", "harness.stores.claude-code.sessionDirectory"],
  ];
  const stores: Record<string, string> = {};
  for (const [store, path] of storePaths) {
    const value = lookup(values, path.split("."));
    if (typeof value !== "string" || !validPath(value)) {
      return failure("config.value.invalid", origins, path);
    }
    stores[store] = value;
  }

  const environment = lookup(values, ["harness", "environment"]);
  if (!Array.isArray(environment)) {
    return failure("config.value.invalid", origins, "harness.environment");
  }
  const settings: HarnessEnvironmentSetting[] = [];
  for (const [index, entry] of environment.entries()) {
    const path = `harness.environment[${index}]`;
    if (!isRecord(entry) || typeof entry.name !== "string" || entry.name.length === 0) {
      return failure("config.value.invalid", origins, path);
    }
    if (Object.hasOwn(entry, "value")) {
      return failure("config.secret.forbidden", origins, path);
    }
    if (Object.hasOwn(entry, "credentialRef")) {
      // The optional marker is variable-only; a credential entry stays required.
      if (Object.hasOwn(entry, "optional")) {
        return failure("config.value.invalid", origins, path);
      }
      if (typeof entry.credentialRef !== "string" || entry.credentialRef.length === 0) {
        return failure("config.value.invalid", origins, path);
      }
      if (Object.keys(entry).some((key) => key !== "name" && key !== "credentialRef")) {
        return failure("config.value.invalid", origins, path);
      }
      settings.push({ name: entry.name, credentialRef: entry.credentialRef });
      continue;
    }
    if (Object.hasOwn(entry, "optional") && typeof entry.optional !== "boolean") {
      return failure("config.value.invalid", origins, path);
    }
    if (Object.keys(entry).some((key) => key !== "name" && key !== "optional")) {
      return failure("config.value.invalid", origins, path);
    }
    settings.push(
      entry.optional === true ? { name: entry.name, optional: true } : { name: entry.name },
    );
  }

  return {
    ok: true,
    value: {
      kind: kind as HarnessKind,
      executionKind: executionKind as HarnessExecutionKind,
      opencodeDatabasePath: stores.opencode as string,
      claudeCodeSessionDirectory: stores["claude-code"] as string,
      environment: settings,
    },
  };
};
