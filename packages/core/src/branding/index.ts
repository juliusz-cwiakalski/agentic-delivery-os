/**
 * `@delivery-os/core/branding` — the single name seam.
 * A pure resolver; it performs no ambient environment read.
 *
 * The resolver is the only construction site for the twelve DEC-8 values. It
 * receives config-driven data (`ResolverInput`) from a runtime-aware edge and
 * returns a frozen `BrandIdentity`. M0-S4's layered configuration consumes this
 * contract without reshaping it.
 *
 * ## Derivation rules (authoritative in-repo documentation)
 *
 * | Value | Rule |
 * |-------|------|
 * | `productName` | The effective supplied working name, as supplied (validated, never defaulted). |
 * | `binaryName` | **sanitize**: lowercase; every run outside `[a-z0-9]` collapses to one `-`; leading/trailing `-` stripped. |
 * | `packageScope` | Fixed neutral constant `@delivery-os` until the naming freeze. |
 * | `environmentPrefix` | **snakeUpper**: uppercase; every run outside `[A-Z0-9]` collapses to one `_`; edges stripped; one trailing `_` appended. |
 * | `configDirectoryName` | **dotDir**: the name if it already starts with `.`, otherwise `.` + name. |
 * | `stateDirectoryName` | **dotDir** + `-state`. |
 * | `mcpToolPrefix` | **sanitize** + `_`; a tool name is this prefix plus a canonical primitive ID from `./contracts`. |
 * | `telemetryNamespace` | Fixed brand-neutral constant `delivery` (producer metadata, never part of a schema name). |
 * | `docsBaseUrl` | `https://` + scope org + `.github.io/` + **sanitize** + `/` (scope org is the package scope without `@`). |
 * | `repositoryUrl` | `https://github.com/` + scope org + `/` + **sanitize**. |
 * | `releaseAssetPrefix` | **sanitize** + `-`. |
 * | `installPath` | `~/` + **dotDir** + `/bin/` + **sanitize**. |
 *
 * Precedence: a present, non-empty `override` wins over `workingName`; an
 * override that is present but invalid is a resolver-input error (no silent
 * fallback). Same input always yields the same output; no clock, randomness,
 * environment, or runtime API is consulted. The committed configuration path
 * projection is `<repo>/<configDirectoryName>/config.yaml`.
 */

import type { BrandIdentity, Result } from "#contracts";

export type { BrandIdentity };

/** The seam contract M0-S4 consumes without reshaping. */
export type ResolverInput = {
  readonly workingName: string;
  readonly override?: string;
};

/** Deterministic, echo-free resolver-input error codes. */
export type BrandingInputErrorCode =
  | "not-a-string"
  | "empty"
  | "whitespace-only"
  | "surrounding-whitespace"
  | "path-separator"
  | "control-character"
  | "too-long"
  | "unusable-name";

/** Resolver-input error: names the field and the reason, never the value. */
export type BrandingInputError = {
  readonly field: "workingName" | "override";
  readonly code: BrandingInputErrorCode;
};

const MAX_WORKING_NAME_LENGTH = 64;
const PACKAGE_SCOPE = "@delivery-os";
const SCOPE_ORG = "delivery-os";
const TELEMETRY_NAMESPACE = "delivery";

const sanitize = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const snakeUpper = (name: string): string =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const dotDir = (name: string): string => (name.startsWith(".") ? name : `.${name}`);

const validateName = (
  value: unknown,
  field: BrandingInputError["field"],
): BrandingInputError | undefined => {
  if (typeof value !== "string") return { field, code: "not-a-string" };
  if (value.length === 0) return { field, code: "empty" };
  if (value.trim().length === 0) return { field, code: "whitespace-only" };
  if (value !== value.trim()) return { field, code: "surrounding-whitespace" };
  if (value.includes("/") || value.includes("\\")) return { field, code: "path-separator" };
  if (
    [...value].some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 0x20 || code === 0x7f;
    })
  ) {
    return { field, code: "control-character" };
  }
  if (value.length > MAX_WORKING_NAME_LENGTH) return { field, code: "too-long" };
  if (sanitize(value).length === 0) return { field, code: "unusable-name" };
  return undefined;
};

/**
 * Derive the full DEC-8 value set from one config-driven working name.
 *
 * Pure and total over `ResolverInput`: invalid input returns a deterministic
 * `BrandingInputError`; it never produces a default name.
 */
export function resolveBrandIdentity(
  input: ResolverInput,
): Result<BrandIdentity, BrandingInputError> {
  const workingNameError = validateName(input.workingName, "workingName");
  if (workingNameError !== undefined) return { ok: false, error: workingNameError };

  let effectiveName = input.workingName;
  if (input.override !== undefined) {
    const overrideError = validateName(input.override, "override");
    if (overrideError !== undefined) return { ok: false, error: overrideError };
    effectiveName = input.override;
  }

  const binary = sanitize(effectiveName);
  const identity: BrandIdentity = {
    productName: effectiveName,
    binaryName: binary,
    packageScope: PACKAGE_SCOPE,
    environmentPrefix: `${snakeUpper(effectiveName)}_`,
    configDirectoryName: dotDir(effectiveName),
    stateDirectoryName: `${dotDir(effectiveName)}-state`,
    mcpToolPrefix: `${binary}_`,
    telemetryNamespace: TELEMETRY_NAMESPACE,
    docsBaseUrl: `https://${SCOPE_ORG}.github.io/${binary}/`,
    repositoryUrl: `https://github.com/${SCOPE_ORG}/${binary}`,
    releaseAssetPrefix: `${binary}-`,
    installPath: `~/${dotDir(effectiveName)}/bin/${binary}`,
  };

  return { ok: true, value: Object.freeze(identity) };
}
