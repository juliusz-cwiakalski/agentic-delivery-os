/**
 * `@delivery-os/core` config tier — schema, defaults, layered merge.
 * Pure resolution and trusted schema; acquisition is supplied as plain facts.
 */

export {
  BOOTSTRAP_DESCRIPTOR,
  type CatalogField,
  type ConfigCatalog,
  catalogPaths,
  PRODUCTION_CATALOG,
} from "./catalog.js";
export { defaultsFor, PRODUCTION_DEFAULTS } from "./defaults.js";
export { originLabel } from "./provenance.js";
export {
  type DefaultPositionManifest,
  type ResolveConfigInput,
  type ResolvedConfig,
  resolveConfig,
} from "./resolver.js";
export {
  compileTrustedSchema,
  generateConfigSchema,
  PRODUCTION_SCHEMA,
  serializeProductionSchema,
} from "./schema.js";
