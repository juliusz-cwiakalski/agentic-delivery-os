/**
 * Allowlist mutation fixtures for TC-SECRET-003.
 *
 * Mutations are applied to copies of the registry array only; the live registry
 * is never edited.
 */
import {
  type AllowlistEntry,
  SECRET_READ_ALLOWLIST,
} from "../../../scripts/checks/secret-read-boundary";

const CREDENTIAL_ENTRY: AllowlistEntry = {
  kind: "directory",
  path: "packages/adapters/src/credentials",
  class: "credential-material",
  reason: "The single environment-backed credential-port implementation.",
};

const LEGACY_ENTRY: AllowlistEntry = {
  kind: "file",
  path: "packages/adapters/src/legacy/index.ts",
  class: "configuration-environment-source",
  reason: "Pre-existing legacy-name adapter environment reader.",
};

export const withoutCredentialEntry = (): AllowlistEntry[] =>
  SECRET_READ_ALLOWLIST.filter((entry) => entry.class !== "credential-material");

export const withSecondCredentialEntry = (): AllowlistEntry[] => [
  ...SECRET_READ_ALLOWLIST,
  { ...LEGACY_ENTRY, class: "credential-material" },
];

export const withReasonlessEntry = (): AllowlistEntry[] =>
  SECRET_READ_ALLOWLIST.map((entry) =>
    entry.path === LEGACY_ENTRY.path ? { ...entry, reason: "  " } : entry,
  );

export const withWildcardEntry = (): AllowlistEntry[] => [
  ...SECRET_READ_ALLOWLIST,
  {
    kind: "directory",
    path: `${CREDENTIAL_ENTRY.path}/*`,
    class: "configuration-environment-source",
    reason: "wildcard",
  },
];

export const withPrefixEntry = (): AllowlistEntry[] => [
  ...SECRET_READ_ALLOWLIST,
  {
    kind: "directory",
    path: "packages/adapters/src/creds",
    class: "configuration-environment-source",
    reason: "prefix attempt",
  },
];
