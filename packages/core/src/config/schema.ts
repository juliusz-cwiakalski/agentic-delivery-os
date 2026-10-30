import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { PRODUCTION_CATALOG, type ConfigCatalog, type CatalogField } from "./catalog.js";

export type TrustedSchema = Readonly<Record<string, unknown>>;
const valueSchema = (field: CatalogField, partial: boolean): TrustedSchema => {
  let base: TrustedSchema;
  if (field.type === "object") base = objectSchema(field.fields, partial, false);
  else if (field.type === "array")
    base = { type: "array", items: valueSchema(field.items, partial) };
  else base = { type: field.type };
  return field.nullable ? { anyOf: [base, { type: "null" }] } : base;
};

const objectSchema = (catalog: ConfigCatalog, partial: boolean, vendor: boolean): TrustedSchema => {
  const properties = Object.fromEntries(
    Object.entries(catalog).map(([key, field]) => [key, valueSchema(field, partial)]),
  );
  const required = Object.entries(catalog)
    .filter(([, field]) => !partial && field.required)
    .map(([key]) => key);
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    ...(vendor ? { patternProperties: { "^x-": { $ref: "#/definitions/json" } } } : {}),
    additionalProperties: false,
  };
};

/** One trusted draft-07 schema and a recursive required-relaxed view. */
export const generateConfigSchema = (catalog: ConfigCatalog, partial = false): TrustedSchema => ({
  $schema: "http://json-schema.org/draft-07/schema#",
  ...objectSchema(catalog, partial, true),
  definitions: {
    json: {
      anyOf: [
        { type: "null" },
        { type: "string" },
        { type: "number" },
        { type: "boolean" },
        { type: "array", items: { $ref: "#/definitions/json" } },
        { type: "object", additionalProperties: { $ref: "#/definitions/json" } },
      ],
    },
  },
});

export const PRODUCTION_SCHEMA = generateConfigSchema(PRODUCTION_CATALOG);

/** Stable packed-artifact text; the parity check compares source-derived truth. */
export const serializeProductionSchema = (): string =>
  `${JSON.stringify(PRODUCTION_SCHEMA, null, 2)}\n`;

export const compileTrustedSchema = (
  catalog: ConfigCatalog,
  partial: boolean,
): ValidateFunction => {
  const ajv = new Ajv({
    strict: false,
    allErrors: true,
    coerceTypes: false,
    removeAdditional: false,
    useDefaults: false,
    logger: false,
  });
  return ajv.compile(generateConfigSchema(catalog, partial));
};

/** Never return Ajv's data, params, message or input snippet. */
export const invalidKey = (errors: readonly ErrorObject[] | null | undefined): boolean =>
  (errors ?? []).some((error) => error.keyword === "additionalProperties");
