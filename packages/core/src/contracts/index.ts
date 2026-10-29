/**
 * `@delivery-os/core/contracts` — the shared language.
 * Runtime-neutral and I/O-free; types only at scaffold.
 */

/** Discriminated result envelope shared by every package. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: E;
    };

/**
 * The twelve DEC-8 brand values.
 *
 * Defined once in `./contracts`; consumed as parameters; never re-derived.
 * Values originate from the pure resolver in `@delivery-os/core/branding`,
 * invoked at a runtime-aware edge with config-driven data.
 */
export type BrandIdentity = {
  readonly productName: string;
  readonly binaryName: string;
  readonly packageScope: string;
  readonly environmentPrefix: string;
  readonly configDirectoryName: string;
  readonly stateDirectoryName: string;
  readonly mcpToolPrefix: string;
  readonly telemetryNamespace: string;
  readonly docsBaseUrl: string;
  readonly repositoryUrl: string;
  readonly releaseAssetPrefix: string;
  readonly installPath: string;
};

/**
 * EVT-1 — reserved brand-neutral telemetry event schema name.
 *
 * The schema name carries no producer identity. The producer name is branding
 * metadata (`BrandIdentity.telemetryNamespace`); it is never part of a schema
 * name. No emission path exists.
 */
export type TelemetryEventSchemaName = "delivery.event.v1";

/**
 * EVT-2 — reserved brand-neutral telemetry metric schema name (same rule).
 */
export type TelemetryMetricSchemaName = "delivery.metric.v1";
