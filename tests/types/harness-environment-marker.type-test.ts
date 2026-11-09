/**
 * TC-HDA-001 type half — the additive, variable-only optional marker.
 *
 * Compiled by `pnpm typecheck` (`tests/types/tsconfig.json`), not run by Bun; the
 * `@ts-expect-error` comments are the assertions.
 */
import type {
  HarnessEnvironmentCredential,
  HarnessEnvironmentEntry,
  HarnessEnvironmentVariable,
  HarnessExecutionEnvironmentDescriptor,
} from "../../packages/core/src/contracts/index";

const optionalTrue: HarnessEnvironmentVariable = {
  kind: "variable",
  name: "SYNTHETIC_OPTIONAL",
  optional: true,
};

const optionalFalse: HarnessEnvironmentVariable = {
  kind: "variable",
  name: "SYNTHETIC_REQUIRED_EXPLICIT",
  optional: false,
};

const optionalAbsent: HarnessEnvironmentVariable = {
  kind: "variable",
  name: "SYNTHETIC_REQUIRED_ABSENT",
};

const credential: HarnessEnvironmentCredential = {
  kind: "credential",
  name: "SYNTHETIC_CREDENTIAL",
  reference: {
    referenceName: "synthetic-reference",
    sourceKey: { style: "literal", name: "SYNTHETIC_SOURCE_KEY" },
  },
};

const optionalCredential: HarnessEnvironmentCredential = {
  kind: "credential",
  name: "SYNTHETIC_CREDENTIAL",
  // @ts-expect-error — the marker is variable-only; a credential entry may not carry it.
  optional: true,
  reference: {
    referenceName: "synthetic-reference",
    sourceKey: { style: "literal", name: "SYNTHETIC_SOURCE_KEY" },
  },
};

const nonBooleanMarker: HarnessEnvironmentVariable = {
  kind: "variable",
  name: "SYNTHETIC_OPTIONAL",
  // @ts-expect-error — the marker is a boolean; a widened string is rejected.
  optional: "yes",
};

const entry: HarnessEnvironmentEntry = optionalTrue;

const descriptor: HarnessExecutionEnvironmentDescriptor = {
  kind: "host",
  workDirectory: "/synthetic/work/GH-277",
  environment: [optionalTrue, optionalFalse, optionalAbsent, credential],
};

export {
  credential,
  descriptor,
  entry,
  nonBooleanMarker,
  optionalAbsent,
  optionalCredential,
  optionalFalse,
  optionalTrue,
};
