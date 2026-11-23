/**
 * TC-COMPAT-001 golden capture entry — the pre-change validation-and-resolution
 * oracle for every shipped credential declaration.
 *
 * The capture records, as committed data: the resolved outcome of every
 * `literal` and `environment-prefixed` declaration in the shipped
 * provider-config fixtures, the source-key derivations, the fixture reference
 * case outcomes, and the shipped tracker reference default. Refresh is
 * explicit and deliberate; a test run never rewrites the committed document:
 *
 *   bun run tests/fixtures/credentials/golden-capture.ts
 *
 * No real credential is used anywhere: every resolved material in the document
 * is a deterministic obviously-fake sentinel derived from the declared key
 * name. The capture reads repository fixture files only — no host environment,
 * no network, no child process.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import {
  createEnvironmentCredentialPort,
  resolveCredentialSourceKey,
} from "../../../packages/adapters/src/credentials/index";
import type {
  CredentialReference,
  CredentialResolution,
  CredentialResolutionFailure,
} from "../../../packages/core/src/contracts/index";
import { parseAndValidateProviderConfiguration } from "../../../packages/core/src/provider/validate";
import { CANARY, fixtureBrand, literalReference, prefixedReference } from "./cases";

const CONFIG_FIXTURE_DIR = "tests/fixtures/provider/config";
const GOLDEN_PATH = "tests/golden/credential-resolution-goldens.json";

/** One resolution outcome as committed data: the material or the row identity. */
export type GoldenResolution =
  | { readonly ok: true; readonly material: string }
  | { readonly ok: false; readonly identity: GoldenFailureIdentity };

/** The six error-table row fields, bound by the delivery suite. */
export type GoldenFailureIdentity = {
  readonly code: string;
  readonly domainKind: string;
  readonly category: string;
  readonly retryable: boolean;
  readonly consequence: string;
  readonly projectionClass: string;
};

/** One shipped fixture's captured credential truth. */
export type GoldenFixture = {
  readonly fixture: string;
  readonly validation: { readonly ok: true } | { readonly ok: false; readonly detail: string };
  readonly credentials: readonly {
    readonly name: string;
    readonly sourceKey: unknown;
    readonly derivedKey: string;
    readonly present: GoldenResolution;
    readonly absent: GoldenResolution;
  }[];
};

/** The committed golden document shape. */
export type CredentialGoldenDocument = {
  readonly schema: "credential-resolution-goldens.v1";
  readonly brandEnvironmentPrefix: string;
  readonly trackerReferenceDefault: {
    readonly referenceName: string;
    readonly sourceKey: unknown;
  };
  readonly cases: {
    readonly literal: {
      readonly derivedKey: string;
      readonly present: GoldenResolution;
      readonly absent: GoldenResolution;
      readonly empty: GoldenResolution;
      readonly whitespace: GoldenResolution;
    };
    readonly prefixed: {
      readonly derivedKey: string;
      readonly present: GoldenResolution;
      readonly absent: GoldenResolution;
    };
  };
  readonly fixtures: readonly GoldenFixture[];
};

/** Deterministic obviously-fake material for a declared key (never secret-shaped). */
const sentinelMaterial = (key: string): string => `fixture-material-for-${key}`;

const resolutionRecord = (resolution: CredentialResolution): GoldenResolution => {
  if (resolution.ok) return { ok: true, material: resolution.material.value };
  const failure: CredentialResolutionFailure = resolution;
  return {
    ok: false,
    identity: {
      code: failure.code,
      domainKind: failure.domainKind,
      category: failure.category,
      retryable: failure.retryable,
      consequence: failure.consequence,
      projectionClass: failure.projectionClass,
    },
  };
};

const resolveIn = (
  reference: CredentialReference,
  environment: Record<string, string | undefined>,
): GoldenResolution =>
  resolutionRecord(
    createEnvironmentCredentialPort({ environment, brand: fixtureBrand }).resolve(reference),
  );

const captureFixture = (fixture: string): GoldenFixture => {
  const text = readFileSync(join(CONFIG_FIXTURE_DIR, fixture), "utf8");
  const outcome = parseAndValidateProviderConfiguration(parse(text));
  if (!outcome.ok) {
    return { fixture, validation: { ok: false, detail: outcome.error.detail }, credentials: [] };
  }
  const credentials: GoldenFixture["credentials"] = [];
  for (const [name, declaration] of Object.entries(outcome.config.credentials)) {
    const reference: CredentialReference = {
      referenceName: name,
      sourceKey: declaration.sourceKey,
    };
    const derivedKey = resolveCredentialSourceKey(reference, fixtureBrand);
    credentials.push({
      name,
      sourceKey: declaration.sourceKey,
      derivedKey,
      present: resolveIn(reference, { [derivedKey]: sentinelMaterial(derivedKey) }),
      absent: resolveIn(reference, {}),
    });
  }
  return { fixture, validation: { ok: true }, credentials };
};

/**
 * Capture the golden document. The tracker reference default is supplied by the
 * caller so the capture module itself stays off the CLI composition's import
 * graph; the explicit capture entry passes the shipped declared reference.
 */
export const captureCredentialGoldens = (input: {
  trackerReferenceDefault: CredentialReference;
}): CredentialGoldenDocument => {
  const fixtures = readdirSync(CONFIG_FIXTURE_DIR)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map(captureFixture);
  const literalDerived = resolveCredentialSourceKey(literalReference, fixtureBrand);
  const prefixedDerived = resolveCredentialSourceKey(prefixedReference, fixtureBrand);
  return {
    schema: "credential-resolution-goldens.v1",
    brandEnvironmentPrefix: fixtureBrand.environmentPrefix,
    trackerReferenceDefault: {
      referenceName: input.trackerReferenceDefault.referenceName,
      sourceKey: input.trackerReferenceDefault.sourceKey,
    },
    cases: {
      literal: {
        derivedKey: literalDerived,
        present: resolveIn(literalReference, { [literalDerived]: CANARY }),
        absent: resolveIn(literalReference, {}),
        empty: resolveIn(literalReference, { [literalDerived]: "" }),
        whitespace: resolveIn(literalReference, { [literalDerived]: "   " }),
      },
      prefixed: {
        derivedKey: prefixedDerived,
        present: resolveIn(prefixedReference, {
          [prefixedDerived]: sentinelMaterial(prefixedDerived),
        }),
        absent: resolveIn(prefixedReference, {}),
      },
    },
    fixtures,
  };
};

/** Render the document as stable, human-reviewable JSON text. */
export const renderCredentialGoldens = (document: CredentialGoldenDocument): string =>
  `${JSON.stringify(document, null, 2)}\n`;

/** Load the committed golden document (the read-only TC-COMPAT-001 oracle). */
export const readCredentialGoldens = (): CredentialGoldenDocument =>
  JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as CredentialGoldenDocument;

if (import.meta.main) {
  const { DECLARED_CREDENTIAL_REFERENCES } = await import("../../../packages/cli/src/production");
  const declared = DECLARED_CREDENTIAL_REFERENCES[0];
  if (declared === undefined) {
    throw new Error("production declares no tracker credential reference");
  }
  writeFileSync(
    GOLDEN_PATH,
    renderCredentialGoldens(captureCredentialGoldens({ trackerReferenceDefault: declared })),
  );
}
