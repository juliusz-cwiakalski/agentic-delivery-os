/**
 * `@delivery-os/core` config tier — schema, defaults, layered merge.
 * Pure resolution and trusted schema; acquisition is supplied as plain facts.
 */

export {
  BOOTSTRAP_DESCRIPTOR,
  PRODUCTION_CATALOG,
  type CatalogField,
  type ConfigCatalog,
  catalogPaths,
} from "./catalog.js";
export { PRODUCTION_DEFAULTS, defaultsFor } from "./defaults.js";
export { originLabel } from "./provenance.js";
export {
  resolveConfig,
  type DefaultPositionManifest,
  type ResolveConfigInput,
  type ResolvedConfig,
} from "./resolver.js";
export {
  compileTrustedSchema,
  generateConfigSchema,
  PRODUCTION_SCHEMA,
  serializeProductionSchema,
} from "./schema.js";
