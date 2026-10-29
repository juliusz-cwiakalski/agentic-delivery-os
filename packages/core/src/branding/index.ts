/**
 * `@delivery-os/core/branding` — the single name seam.
 * A pure resolver; it performs no ambient environment read.
 */

/** Brand values resolved at a runtime-aware edge and passed in as arguments. */
export type BrandIdentity = {
  readonly productName: string;
  readonly binaryName: string;
  readonly environmentPrefix: string;
  readonly configDirectoryName: string;
};
