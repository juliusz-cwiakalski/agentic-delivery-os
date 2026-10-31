import type { ConfigOrigin, ConfigValue } from "#contracts";

type DefaultMetadata = { readonly defaultOrigin?: ConfigOrigin & { readonly layer: "defaults" } };

type FieldMeta = {
  readonly nullable?: boolean;
  readonly deprecated?: boolean;
  readonly env?: boolean;
  readonly flag?: string;
} & (
  | {
      readonly required: true;
      readonly source: "environment-only";
      readonly default?: never;
      readonly defaultOrigin?: never;
    }
  | { readonly required?: false; readonly source: "environment-only" }
  | { readonly required?: boolean; readonly source?: "machine-path" }
);
type Defaultable<T> =
  | { readonly default?: never; readonly defaultOrigin?: never }
  | ({ readonly default: T } & DefaultMetadata);
export type ScalarField = FieldMeta &
  (
    | ({ readonly type: "string" } & Defaultable<string>)
    | ({ readonly type: "number" } & Defaultable<number>)
    | ({ readonly type: "boolean" } & Defaultable<boolean>)
  );
export type ListField = FieldMeta & {
  readonly type: "array";
  readonly items: CatalogField;
} & Defaultable<readonly ConfigValue[]>;
export type MapField = FieldMeta & {
  readonly type: "object";
  readonly fields: Readonly<Record<string, CatalogField>>;
} & Defaultable<Readonly<Record<string, ConfigValue>>>;
/** A dynamic-name map: any child key, one declared value shape (GH-182 PD-F). */
export type RecordField = FieldMeta & {
  readonly type: "record";
  readonly value: CatalogField;
} & Defaultable<Readonly<Record<string, ConfigValue>>>;
export type CatalogField = ScalarField | ListField | MapField | RecordField;
export type ConfigCatalog = Readonly<Record<string, CatalogField>>;

/** Bootstrap identity is supplied before discovery; it is never a resolved key. */
export const BOOTSTRAP_DESCRIPTOR = {
  workingName: { type: "string", required: true },
} as const;
const PROVIDER_CREDENTIAL_VALUE = {
  type: "object",
  required: true,
  fields: {
    sourceKey: {
      type: "object",
      required: true,
      fields: {
        style: { type: "string", required: true },
        name: { type: "string" },
        suffix: { type: "string" },
      },
    },
  },
} as const satisfies CatalogField;

const PROVIDER_PEAK = {
  type: "object",
  fields: {
    timezone: { type: "string", default: "UTC" },
    startSecondsOfDay: { type: "number", required: true },
    endSecondsOfDay: { type: "number", required: true },
    bufferSeconds: { type: "number", default: 0 },
  },
} as const satisfies CatalogField;

const PROVIDER_QUOTA = {
  type: "object",
  fields: {
    enabled: { type: "boolean", default: true },
    endpoint: { type: "string", required: true },
    credentialRef: { type: "string", required: true },
    timeoutMs: { type: "number", default: 15000 },
    thresholdPercent: { type: "number", default: 100 },
    maxSleepLoops: { type: "number", default: 24 },
    outageParkTtlSeconds: { type: "number", default: 300 },
    credentialParkTtlSeconds: { type: "number", default: 900 },
    capParkTtlSeconds: { type: "number", default: 300 },
  },
} as const satisfies CatalogField;

const PROVIDER_ENTRY_VALUE = {
  type: "object",
  required: true,
  fields: {
    class: { type: "string", required: true },
    enabled: { type: "boolean", default: true },
    peak: PROVIDER_PEAK,
    quota: PROVIDER_QUOTA,
  },
} as const satisfies CatalogField;

const PROVIDER_CHAIN_VALUE = {
  type: "object",
  required: true,
  fields: {
    entries: { type: "array", items: { type: "string" }, required: true },
    allowPaidFallback: { type: "boolean", default: false },
  },
} as const satisfies CatalogField;

/**
 * The production catalog. `provider` is a typed branch (GH-182 F-1); its
 * dynamic-name maps use the additive record field kind (PD-F), while every
 * fixed branch keeps exact unknown-key discipline.
 */
export const PRODUCTION_CATALOG = {
  provider: {
    type: "object",
    fields: {
      defaultChain: { type: "string" },
      credentials: { type: "record", value: PROVIDER_CREDENTIAL_VALUE },
      entries: { type: "record", value: PROVIDER_ENTRY_VALUE },
      chains: { type: "record", value: PROVIDER_CHAIN_VALUE },
    },
  },
} as const satisfies ConfigCatalog;

export const fieldAt = (
  catalog: ConfigCatalog,
  path: readonly string[],
): CatalogField | undefined => {
  let fields: ConfigCatalog = catalog;
  let field: CatalogField | undefined;
  for (const segment of path) {
    field = fields[segment];
    if (!field) return undefined;
    fields = field.type === "object" ? field.fields : {};
  }
  return field;
};

export const catalogPaths = (catalog: ConfigCatalog): Array<[string, CatalogField]> => {
  const result: Array<[string, CatalogField]> = [];
  const walk = (fields: ConfigCatalog, prefix: string): void => {
    for (const [name, field] of Object.entries(fields)) {
      const path = prefix ? `${prefix}.${name}` : name;
      result.push([path, field]);
      if (field.type === "object") walk(field.fields, path);
    }
  };
  walk(catalog, "");
  return result;
};
