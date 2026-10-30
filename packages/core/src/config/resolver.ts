import type {
  ConfigFailure,
  ConfigLayer,
  ConfigLoadedFile,
  ConfigNodeOrigins,
  ConfigOrigin,
  ConfigSkippedLayer,
  ConfigSourceFacts,
  ConfigValue,
  ConfigWarning,
  Result,
} from "#contracts";
import { CONFIG_LAYERS } from "#contracts";
import {
  type CatalogField,
  type ConfigCatalog,
  catalogPaths,
  fieldAt,
  PRODUCTION_CATALOG,
} from "./catalog.js";
import { defaultsFor } from "./defaults.js";
import { copyOrigins, removeOrigins } from "./provenance.js";
import { compileTrustedSchema, invalidKey } from "./schema.js";

export type ResolveConfigInput = {
  readonly sources?: readonly ConfigSourceFacts[];
  readonly skipped?: readonly ConfigSkippedLayer[];
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly environmentPrefix?: string;
  readonly excludedEnvironmentNames?: readonly string[];
  readonly flags?: Readonly<Record<string, string>>;
  readonly catalog?: ConfigCatalog;
  /** Shipped defaults-positions.json, loaded and supplied by the runtime-aware edge. */
  readonly defaultPositions?: DefaultPositionManifest;
  readonly strict?: boolean;
};
export type DefaultPositionManifest = {
  readonly source: "core/src/config/defaults.ts";
  readonly sourceHash: string;
  readonly positions: Readonly<Record<string, number>>;
};
export type ResolvedConfig = {
  readonly values: Readonly<Record<string, ConfigValue>>;
  readonly origins: ConfigNodeOrigins;
  readonly loadedFiles: readonly ConfigLoadedFile[];
  readonly skippedLayers: readonly ConfigSkippedLayer[];
  readonly warnings: readonly ConfigWarning[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const failure = (
  code: ConfigFailure["code"],
  layer?: ConfigLayer,
  key?: string,
): ConfigFailure => ({
  kind: "config",
  code,
  ...(layer ? { layer } : {}),
  ...(key ? { key } : {}),
});
const fail = (
  code: ConfigFailure["code"],
  layer?: ConfigLayer,
  key?: string,
): Result<never, ConfigFailure> => ({ ok: false, error: failure(code, layer, key) });
const jsonCompatible = (value: unknown, seen = new Set<object>(), depth = 0): boolean => {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every((child) => jsonCompatible(child, seen, depth + 1))
    : Object.entries(value).every(
        ([key, child]) =>
          key !== "__proto__" &&
          key !== "constructor" &&
          key !== "prototype" &&
          jsonCompatible(child, seen, depth + 1),
      );
  seen.delete(value);
  return valid;
};

const lookup = (tree: Record<string, unknown>, path: readonly string[]): unknown => {
  let value: unknown = tree;
  for (const segment of path) {
    if (!isRecord(value) || !Object.hasOwn(value, segment)) return undefined;
    value = value[segment];
  }
  return value;
};
const setPath = (tree: Record<string, unknown>, path: readonly string[], value: unknown): void => {
  let current = tree;
  for (const segment of path.slice(0, -1)) {
    if (!isRecord(current[segment])) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  }
  current[path[path.length - 1] as string] = value;
};
const deletePath = (tree: Record<string, unknown>, path: readonly string[]): void => {
  let current = tree;
  for (const segment of path.slice(0, -1)) {
    if (!isRecord(current[segment])) return;
    current = current[segment] as Record<string, unknown>;
  }
  delete current[path[path.length - 1] as string];
};

const toRaw = (raw: string, field: CatalogField): unknown => {
  if (field.nullable && raw === "null") return null;
  if (field.type === "string") return raw;
  if (field.type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return undefined;
  }
  if (field.type === "number") {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) return undefined;
    const converted = Number(raw);
    return Number.isFinite(converted) ? converted : undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
};

const mappedSource = (
  layer: "environment" | "cli",
  raw: Readonly<Record<string, string | undefined>>,
  catalog: ConfigCatalog,
  prefix: string,
  excluded: readonly string[],
): Result<ConfigSourceFacts, ConfigFailure> => {
  const values: Record<string, unknown> = {};
  const origins: Record<string, ConfigOrigin> = {};
  const mappings = new Map<string, [string, CatalogField]>();
  for (const [path, field] of catalogPaths(catalog)) {
    const name =
      layer === "environment"
        ? field.env
          ? `${prefix}${path.toUpperCase().replaceAll(".", "__").replaceAll("-", "_")}`
          : undefined
        : field.flag;
    if (name) mappings.set(name, [path, field]);
  }
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined || excluded.includes(name)) continue;
    if (layer === "environment" && (!prefix || !name.startsWith(prefix))) continue;
    const mapped = mappings.get(name);
    if (!mapped)
      return fail(
        layer === "environment" ? "config.environment.unmapped" : "config.key.unknown",
        layer,
      );
    const [path, field] = mapped;
    const converted = toRaw(value, field);
    if (!jsonCompatible(converted)) return fail("config.value.invalid", layer, path);
    setPath(values, path.split("."), converted);
    const origin: ConfigOrigin =
      layer === "environment" ? { layer, env: name } : { layer, flag: name };
    const mark = (node: unknown, key: string): void => {
      origins[key] = origin;
      if (Array.isArray(node))
        node.forEach((child, index) => {
          mark(child, `${key}[${index}]`);
        });
      else if (isRecord(node))
        for (const [child, item] of Object.entries(node)) mark(item, `${key}.${child}`);
    };
    mark(converted, path);
  }
  // Guard-validated: every value was checked JSON-compatible before assignment.
  return { ok: true, value: { layer, values: values as Record<string, ConfigValue>, origins } };
};

const validateSource = (
  source: ConfigSourceFacts,
  catalog: ConfigCatalog,
  validate: ReturnType<typeof compileTrustedSchema>,
): Result<{ values: Record<string, unknown>; reset: readonly string[] }, ConfigFailure> => {
  const { layer } = source;
  if (!isRecord(source.values) || !jsonCompatible(source.values))
    return fail("config.value.invalid", layer);
  const data = { ...source.values } as Record<string, unknown>;
  const schemaRef = data.$schema;
  if (schemaRef !== undefined && (typeof schemaRef !== "string" || !schemaRef))
    return fail("config.value.invalid", layer);
  const directive = data.reset;
  if (directive !== undefined && source.reset !== undefined)
    return fail("config.reset.invalid", layer);
  const reset = directive === undefined ? (source.reset ?? []) : directive;
  if (
    !Array.isArray(reset) ||
    reset.some(
      (item) =>
        typeof item !== "string" ||
        !/^[a-zA-Z][a-zA-Z0-9-]*(?:\.[a-zA-Z][a-zA-Z0-9-]*)*$/.test(item),
    )
  ) {
    return fail("config.reset.invalid", layer);
  }
  delete data.$schema;
  delete data.reset;
  if (["system", "user-global", "project-committed", "project-local"].includes(layer)) {
    const checkPositions = (node: unknown, path: string): boolean => {
      const origin = source.origins[path];
      if (
        !origin ||
        origin.layer !== layer ||
        !Number.isInteger("line" in origin ? origin.line : NaN) ||
        !("line" in origin && origin.line > 0) ||
        !("file" in origin && origin.file)
      )
        return false;
      if (Array.isArray(node))
        return node.every((child, index) => checkPositions(child, `${path}[${index}]`));
      if (isRecord(node))
        return Object.entries(node).every(([child, item]) =>
          checkPositions(item, `${path}.${child}`),
        );
      return true;
    };
    if (Object.entries(data).some(([key, value]) => !checkPositions(value, key))) {
      return fail("config.value.invalid", layer);
    }
  }
  const inspect = (value: unknown, path: string): ConfigFailure | undefined => {
    const field = fieldAt(catalog, path.split("."));
    if (field?.source === "environment-only" && layer !== "environment")
      return failure("config.secret.forbidden", layer, path);
    if (field?.source === "machine-path" && layer !== "system" && layer !== "user-global")
      return failure("config.path.forbidden", layer, path);
    if (
      layer !== "environment" &&
      layer !== "cli" &&
      typeof value === "string" &&
      (/\$\{[^}]+\}/.test(value) || /\{env:[^}]+\}/.test(value))
    ) {
      return failure("config.interpolation.rejected", layer, field ? path : undefined);
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const error = inspect(item, path);
        if (error) return error;
      }
    } else if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        const error = inspect(child, `${path}.${key}`);
        if (error) return error;
      }
    }
    return undefined;
  };
  for (const [key, value] of Object.entries(data)) {
    const error = inspect(value, key);
    if (error) return { ok: false, error };
  }
  if (!validate(data))
    return fail(invalidKey(validate.errors) ? "config.key.unknown" : "config.value.invalid", layer);
  return { ok: true, value: { values: data, reset } };
};

const merge = (
  target: Record<string, unknown>,
  incoming: Record<string, unknown>,
  origins: Record<string, ConfigOrigin>,
  supplied: ConfigNodeOrigins,
  warnings: ConfigWarning[],
  catalog: ConfigCatalog,
  layer: ConfigLayer,
  prefix = "",
): void => {
  for (const [key, value] of Object.entries(incoming)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const old = target[key];
    if (old !== undefined && isRecord(old) && isRecord(value)) {
      if (supplied[path]) origins[path] = supplied[path];
      merge(old, value, origins, supplied, warnings, catalog, layer, path);
    } else {
      if (old !== undefined && fieldAt(catalog, path.split("."))) {
        warnings.push({ kind: "shadowed", layer, key: path });
      }
      removeOrigins(origins, path);
      target[key] = value;
      copyOrigins(origins, supplied, path);
    }
    if (fieldAt(catalog, path.split("."))?.deprecated) {
      warnings.push({ kind: "deprecated", layer, key: path });
    }
  }
};

/** Pure: consumes already-acquired facts; never consults process, filesystem or clock. */
export function resolveConfig(
  input: ResolveConfigInput = {},
): Result<ResolvedConfig, ConfigFailure> {
  const catalog = input.catalog ?? PRODUCTION_CATALOG;
  const manifest = input.defaultPositions;
  // Pure validation of the injected packed artifact: no source-file or dist read
  // occurs in core. The artifact parity check binds its hash to defaults.ts.
  if (manifest !== undefined) {
    if (
      !isRecord(manifest) ||
      manifest.source !== "core/src/config/defaults.ts" ||
      typeof manifest.sourceHash !== "string" ||
      !/^[0-9a-f]{64}$/.test(manifest.sourceHash) ||
      !isRecord(manifest.positions) ||
      Object.entries(manifest.positions).some(
        ([path, line]) =>
          !Object.hasOwn(PRODUCTION_CATALOG, path) || !Number.isInteger(line) || line < 1,
      )
    ) {
      return fail("config.value.invalid", "defaults");
    }
  }
  const partial = compileTrustedSchema(catalog, true);
  const final = compileTrustedSchema(catalog, false);
  const origins: Record<string, ConfigOrigin> = {};
  const values: Record<string, unknown> = {};
  const warnings: ConfigWarning[] = [];
  const defaults = defaultsFor(catalog);
  const defaultFacts: Record<string, ConfigOrigin> = {};
  for (const [path, field] of catalogPaths(catalog)) {
    if (!("default" in field) || field.default === undefined) continue;
    const line = manifest?.positions[path];
    const origin:
      | { readonly layer: "defaults"; readonly file: string; readonly line: number }
      | undefined =
      catalog === PRODUCTION_CATALOG && line !== undefined
        ? { layer: "defaults", file: "core/src/config/defaults.ts", line }
        : field.defaultOrigin;
    if (!origin || origin.line < 1 || !Number.isInteger(origin.line)) {
      return fail("config.value.invalid", "defaults", path);
    }
    defaultFacts[path] = origin;
  }
  const defaultSource: ConfigSourceFacts = {
    layer: "defaults",
    // Guard-validated: catalog defaults are JSON-compatible by construction.
    values: defaults as Record<string, ConfigValue>,
    origins: defaultFacts,
  };
  const fileSources = input.sources ?? [];
  if (
    fileSources.some(
      (source) =>
        source.layer === "defaults" || source.layer === "environment" || source.layer === "cli",
    )
  ) {
    return fail("config.value.invalid");
  }
  const env = mappedSource(
    "environment",
    input.environment ?? {},
    catalog,
    input.environmentPrefix ?? "",
    input.excludedEnvironmentNames ?? [],
  );
  if (!env.ok) return env;
  const cli = mappedSource("cli", input.flags ?? {}, catalog, "", []);
  if (!cli.ok) return cli;
  const sources: ConfigSourceFacts[] = [defaultSource, ...fileSources, env.value, cli.value];
  const seen = new Set<ConfigLayer>();
  const ordered: ConfigSourceFacts[] = [];
  for (const layer of CONFIG_LAYERS) {
    for (const source of sources.filter((candidate) => candidate.layer === layer)) {
      if (seen.has(layer)) return fail("config.value.invalid", layer);
      seen.add(layer);
      ordered.push(source);
    }
  }
  if (ordered.length !== sources.length) return fail("config.value.invalid");
  const validated: Array<{
    source: ConfigSourceFacts;
    values: Record<string, unknown>;
    reset: readonly string[];
  }> = [];
  for (const source of ordered) {
    const result = validateSource(source, catalog, partial);
    if (!result.ok) return result;
    validated.push({ source, ...result.value });
  }
  for (const { source, values: incoming, reset } of validated) {
    for (const path of reset) {
      if (lookup(values, path.split(".")) === undefined) {
        return fail(
          "config.reset.invalid",
          source.layer,
          fieldAt(catalog, path.split(".")) ? path : undefined,
        );
      }
      deletePath(values, path.split("."));
      removeOrigins(origins, path);
    }
    merge(values, incoming, origins, source.origins, warnings, catalog, source.layer);
  }
  if (!final(values))
    return fail(invalidKey(final.errors) ? "config.key.unknown" : "config.value.invalid");
  if (input.strict && warnings.length)
    return fail("config.warning.strict", warnings[0]?.layer, warnings[0]?.key);
  return {
    ok: true,
    value: {
      // Guard-validated: source and final schema validation accepted every value.
      values: values as Record<string, ConfigValue>,
      origins,
      loadedFiles: ordered.flatMap(({ loadedFile }) => (loadedFile ? [loadedFile] : [])),
      skippedLayers: input.skipped ?? [],
      warnings,
    },
  };
}
