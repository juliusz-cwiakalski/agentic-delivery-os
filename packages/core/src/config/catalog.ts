import type { ConfigValue } from "../contracts/config.js";
import type { ConfigOrigin } from "../contracts/config.js";

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
export type CatalogField = ScalarField | ListField | MapField;
export type ConfigCatalog = Readonly<Record<string, CatalogField>>;

/** Bootstrap identity is supplied before discovery; it is never a resolved key. */
export const BOOTSTRAP_DESCRIPTOR = {
  workingName: { type: "string", required: true },
} as const;
/** No ordinary consumer field or product default exists yet. */
export const PRODUCTION_CATALOG = {} as const satisfies ConfigCatalog;

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
