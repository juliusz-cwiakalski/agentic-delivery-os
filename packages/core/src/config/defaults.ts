import type { ConfigCatalog, PRODUCTION_CATALOG } from "./catalog.js";

/** Typed catalog declarations are the only source of ordinary default values. */
export const PRODUCTION_DEFAULTS = {} as const satisfies Readonly<
  Record<keyof typeof PRODUCTION_CATALOG, never>
>;

export const defaultsFor = (catalog: ConfigCatalog): Record<string, unknown> => {
  const collect = (fields: ConfigCatalog): Record<string, unknown> => {
    const values: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      if ("default" in field && field.default !== undefined) values[key] = field.default;
      else if (field.type === "object") {
        const nested = collect(field.fields);
        if (Object.keys(nested).length) values[key] = nested;
      }
    }
    return values;
  };
  return collect(catalog);
};
