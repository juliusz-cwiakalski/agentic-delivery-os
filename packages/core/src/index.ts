/**
 * `@delivery-os/core` — the composition-root (`.`) entry module.
 * Empty-but-enforced: the signature is declared, not implemented, at scaffold.
 */

/** Resolved configuration passed in by a runtime-aware surface. */
export type RuntimeConfig = { readonly __kind: "runtime-config" };

/** Adapter instances passed in by a runtime-aware surface. */
export type RuntimeAdapters = { readonly __kind: "runtime-adapters" };

/** State store instance passed in by a runtime-aware surface. */
export type RuntimeStore = { readonly __kind: "runtime-store" };

/** Time source passed in by a runtime-aware surface. */
export type RuntimeClock = { readonly __kind: "runtime-clock" };

/** Wired application services returned by the composition root. */
export type Runtime = { readonly __kind: "runtime" };

/** The one composition root: `createRuntime({ config, adapters, store, clock })`. */
export declare function createRuntime(options: {
  config: RuntimeConfig;
  adapters: RuntimeAdapters;
  store: RuntimeStore;
  clock: RuntimeClock;
}): Runtime;

export {
  BOOTSTRAP_DESCRIPTOR,
  PRODUCTION_CATALOG,
  PRODUCTION_DEFAULTS,
  PRODUCTION_SCHEMA,
  catalogPaths,
  compileTrustedSchema,
  defaultsFor,
  generateConfigSchema,
  originLabel,
  resolveConfig,
  type CatalogField,
  type ConfigCatalog,
  type DefaultPositionManifest,
  type ResolveConfigInput,
  type ResolvedConfig,
} from "./config/index.js";
