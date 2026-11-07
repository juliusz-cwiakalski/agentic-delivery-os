/**
 * Identity fixtures: two synthetic brands and the caller-audience fact values.
 */
import type { BrandIdentity } from "../../../../packages/core/src/contracts/index";
import { SYNTHETIC_BRAND } from "../../../golden/helpers";

export const BRAND_A: BrandIdentity = SYNTHETIC_BRAND;

export const BRAND_B: BrandIdentity = {
  ...SYNTHETIC_BRAND,
  productName: "second-product",
  binaryName: "second-product",
  packageScope: "@second-scope",
  environmentPrefix: "SECOND_PRODUCT_",
  configDirectoryName: ".second-product",
};

export const EXACT_COORDINATOR = "coordinator";
export const EXACT_OWNER = "owner";
export const ABSENT = undefined;
export const CASE_VARIANT = "Coordinator";
export const UNKNOWN = "admin";
export const EMPTY = "";
