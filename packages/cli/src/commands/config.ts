/**
 * `config` command: turns one resolved snapshot into the contracted payload.
 * It performs no I/O and writes nothing; `runCli` owns output and redaction.
 */
import type { ConfigCatalog, ResolvedConfig } from "@delivery-os/core";
import { catalogPaths, originLabel } from "@delivery-os/core";
import type { ConfigFailure, ConfigValue, Result } from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandFlags } from "../index.js";

export type ConfigResolvedSnapshot = {
  readonly config: ResolvedConfig;
  /** Safe legacy notices; resolver warnings are formatted separately. */
  readonly notices: readonly string[];
};

export type ConfigCommandRuntime = {
  readonly resolve: (flags: CommandFlags) => Result<ConfigResolvedSnapshot, ConfigFailure>;
};

const failure = (code: ConfigFailure["code"], key?: string): { readonly error: ConfigFailure } => ({
  error: { kind: "config", code, ...(key !== undefined ? { key } : {}) },
});

const invocationError = (summary: string): { readonly error: Record<string, unknown> } => ({
  error: { kind: "input", code: "input.value.rejected", summary },
});

const lookup = (
  tree: Readonly<Record<string, ConfigValue>>,
  key: string,
): { readonly found: true; readonly value: ConfigValue } | { readonly found: false } => {
  const segments = key.split(".");
  if (segments.some((segment) => segment.length === 0)) return { found: false };
  let current: ConfigValue = tree;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return { found: false };
      const next: ConfigValue | undefined = current[index];
      if (next === undefined) return { found: false };
      current = next;
    } else if (current !== null && typeof current === "object" && Object.hasOwn(current, segment)) {
      const next: ConfigValue | undefined = current[segment];
      if (next === undefined) return { found: false };
      current = next;
    } else {
      return { found: false };
    }
  }
  return { found: true, value: current };
};

const warningText = (warning: ResolvedConfig["warnings"][number]): string => {
  const location = [
    warning.layer === undefined ? undefined : `layer=${warning.layer}`,
    warning.key === undefined ? undefined : `key=${warning.key}`,
  ]
    .filter((part): part is string => part !== undefined)
    .join(" ");
  return location.length === 0 ? warning.kind : `${warning.kind}: ${location}`;
};

const debugPayload = (resolved: ResolvedConfig): Record<string, unknown> => {
  const origins: Record<string, string> = {};
  for (const path of Object.keys(resolved.origins).sort()) {
    const origin = resolved.origins[path];
    if (origin !== undefined) origins[path] = originLabel(origin);
  }
  return {
    config: resolved.values,
    origins,
    loadedFiles: resolved.loadedFiles.map((file) => file.file),
    skippedLayers: resolved.skippedLayers,
  };
};

type ConfigMode =
  | { readonly kind: "basic" }
  | { readonly kind: "debug" }
  | { readonly kind: "get"; readonly key: string };

const resolveMode = (
  positionals: readonly string[],
  flags: CommandFlags,
): ConfigMode | undefined => {
  const debug = flags["--debug"] === true;
  const showOrigin = flags["--show-origin"] === true;
  if (positionals.length === 0) {
    if (showOrigin) return undefined;
    return { kind: debug ? "debug" : "basic" };
  }
  const [mode, key, ...rest] = positionals;
  if (mode === "debug" && key === undefined && rest.length === 0 && !showOrigin) {
    return { kind: "debug" };
  }
  if (mode === "get" && key !== undefined && rest.length === 0 && !debug) {
    return { kind: "get", key };
  }
  return undefined;
};

export const createConfigCommandDefinition = (
  runtime: ConfigCommandRuntime,
  catalog: ConfigCatalog,
): CommandDefinition => {
  const controlFlags = [
    "--strict",
    "--debug",
    "--show-origin",
    "--enable-system-config",
    "--enable-user-config",
    "--enable-project-local-config",
  ];
  const valueFlags = [
    "--config",
    "--project-root",
    ...catalogPaths(catalog).flatMap(([, field]) => (field.flag === undefined ? [] : [field.flag])),
  ];
  return {
    flags: controlFlags,
    requiresValue: [...new Set(valueFlags)],
    positionals: { max: 2 },
    humanSuccess: true,
    handler: ({ flags, positionals }) => {
      const mode = resolveMode(positionals, flags);
      if (mode === undefined) {
        return invocationError(
          "config accepts basic, debug or get <key> and --show-origin only with get",
        );
      }
      const resolved = runtime.resolve(flags);
      if (!resolved.ok) return { error: resolved.error };
      const { config: configSnapshot, notices } = resolved.value;
      const { warnings: configWarnings } = configSnapshot;
      const warnings = [...notices, ...configWarnings.map(warningText)];
      if (mode.kind === "basic") {
        return { data: configSnapshot.values, warnings };
      }
      if (mode.kind === "debug") {
        return { data: debugPayload(configSnapshot), warnings };
      }
      const entry = lookup(configSnapshot.values, mode.key);
      if (!entry.found) return failure("config.key.unknown", mode.key);
      if (flags["--show-origin"] !== true) {
        return { data: entry.value, warnings };
      }
      const origin = configSnapshot.origins[mode.key];
      if (origin === undefined) return failure("config.key.unknown", mode.key);
      return {
        data: { key: mode.key, value: entry.value, origin: originLabel(origin) },
        warnings,
      };
    },
  };
};
