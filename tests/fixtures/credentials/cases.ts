/**
 * Credential-port fixtures (TC-PORT-005/006/008).
 *
 * No real secret is used: the canary is a unique test string supplied through
 * an injected environment record. The production wrapper is never exercised
 * against the host environment.
 */

import { resolveBrandIdentity } from "../../../packages/core/src/branding/index";
import type {
  BrandIdentity,
  CredentialReference,
} from "../../../packages/core/src/contracts/index";

const branded = resolveBrandIdentity({ workingName: "Fixture" });
if (!branded.ok) throw new Error("fixture brand is invalid");

/** The fixture brand whose environment prefix feeds derived source keys. */
export const fixtureBrand: BrandIdentity = branded.value;

/** A unique canary with quoting and backslashes to exercise escaped forms. */
export const CANARY = 'canary-"quoted"-\\backslash-9f3a';

/** A declared reference to a literal environment key. */
export const literalReference: CredentialReference = {
  referenceName: "tracker-primary",
  sourceKey: { style: "literal", name: "FIXTURE_CREDENTIAL" },
};

/** A declared reference whose key derives from the branding environment prefix. */
export const prefixedReference: CredentialReference = {
  referenceName: "tracker-prefixed",
  sourceKey: { style: "environment-prefixed", suffix: "TRACKER_TOKEN" },
};

/** A capture sink standing in for any diagnostic/log/error channel. */
export type CaptureSink = {
  readonly entries: unknown[];
  readonly capture: (value: unknown) => void;
};

export const createCaptureSink = (): CaptureSink => {
  const entries: unknown[] = [];
  return { entries, capture: (value) => entries.push(value) };
};
